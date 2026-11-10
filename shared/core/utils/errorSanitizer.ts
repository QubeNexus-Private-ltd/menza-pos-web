/**
 * Security-Hardened Error Sanitizer
 * 
 * Prevents CWE-209 (Generation of Error Message Containing Sensitive Information)
 * and OWASP API8:2023 (Security Misconfiguration / Information Disclosure).
 * 
 * Intercepts technical Axios errors, server stack traces, database schema errors,
 * and internal HTTP status codes so external actors cannot probe backend vulnerabilities.
 */

// Known signatures of raw backend / infrastructure leakage
const TECHNICAL_LEAK_PATTERNS: RegExp[] = [
  /request failed with status code/i,
  /network error/i,
  /timeout of \d+ms exceeded/i,
  /econnrefused/i,
  /econnreset/i,
  /etimedout/i,
  /unhandled/i,
  /exception/i,
  /stacktrace/i,
  /stack trace/i,
  /at\s+[a-zA-Z0-9_.]+\(/i,
  /syntax error/i,
  /syntax\s+error\s+near/i,
  /\bselect\b.*\bfrom\b/i,
  /\binsert\b.*\binto\b/i,
  /\bupdate\b.*\bset\b/i,
  /\bdelete\b.*\bfrom\b/i,
  /database/i,
  /sqlclient/i,
  /entityframework/i,
  /dbcontext/i,
  /internal server error/i,
  /nullreference/i,
  /object reference not set/i,
  /index was outside the bounds/i,
  /axioserror/i,
  /<html/i,
  /<!doctype/i,
  /<head>/i,
  /system\.[a-zA-Z0-9_.]+/i,
  /microsoft\.[a-zA-Z0-9_.]+/i,
  /\.cs:line\s+\d+/i,
  /\.java:\d+/i,
  /\.kt:\d+/i,
];

/**
 * Checks whether an error stems from an unreachable host, offline device, timeout,
 * or 5xx server crash.
 */
export function isNetworkOrServerError(err: any): boolean {
  if (!err) return false;

  // No HTTP response received (device offline, DNS resolution failure, connection refused)
  if (!err.response) {
    return true;
  }

  const status = Number(err.response?.status);
  // HTTP 5xx Server Crashes, Bad Gateways, Service Unavailable, Gateway Timeouts
  if (status >= 500 && status <= 599) {
    return true;
  }

  // Axios specific network codes
  const code = String(err.code || '');
  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK' || code === 'ETIMEDOUT') {
    return true;
  }

  const msg = String(err.message || '').toLowerCase();
  if (
    msg.includes('network error') ||
    msg.includes('timeout') ||
    msg.includes('offline') ||
    msg.includes('socket hang up')
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts a safe, human-readable error message from Axios / backend response,
 * filtering out technical leakages and HTML dumps.
 */
export function extractApiErrorMessage(err: any): string | null {
  if (!err) return null;

  // 1. If err itself is a string
  if (typeof err === 'string' && err.trim().length > 0 && !err.includes('<html')) {
    const candidate = err.trim();
    if (!TECHNICAL_LEAK_PATTERNS.some((p) => p.test(candidate)) && candidate.length <= 160) {
      return candidate;
    }
  }

  // 2. Resolve payload from err.response?.data, err.data, or err directly
  const data = err.response?.data ?? err.data ?? (err.status || err.name || err.config ? null : err);

  // Plain text response
  if (typeof data === 'string' && data.trim().length > 0 && !data.includes('<html')) {
    const candidate = data.trim();
    if (!TECHNICAL_LEAK_PATTERNS.some((p) => p.test(candidate)) && candidate.length <= 160) {
      return candidate;
    }
  }

  // JSON Object response (message, Message, detail, title, error)
  if (data && typeof data === 'object') {
    const rawMsg =
      data.message ||
      data.Message ||
      data.detail ||
      data.Detail ||
      data.error ||
      data.Error ||
      data.title;

    if (typeof rawMsg === 'string' && rawMsg.trim().length > 0) {
      const candidate = rawMsg.trim();
      if (
        candidate !== 'One or more validation errors occurred.' &&
        candidate !== 'Unauthorized' &&
        !TECHNICAL_LEAK_PATTERNS.some((p) => p.test(candidate)) &&
        candidate.length <= 160
      ) {
        return candidate;
      }
    }

    // ASP.NET Validation errors dictionary
    if (data.errors && typeof data.errors === 'object') {
      const firstKey = Object.keys(data.errors)[0];
      if (firstKey && Array.isArray(data.errors[firstKey]) && data.errors[firstKey].length > 0) {
        const candidate = String(data.errors[firstKey][0]).trim();
        if (!TECHNICAL_LEAK_PATTERNS.some((p) => p.test(candidate)) && candidate.length <= 160) {
          return candidate;
        }
      }
    }
  }

  // 3. Check err.message if safe and not a raw technical wrapper
  if (typeof err.message === 'string' && err.message.trim().length > 0) {
    const candidate = err.message.trim();
    if (
      !candidate.startsWith('Request failed with') &&
      !candidate.includes('status code') &&
      !TECHNICAL_LEAK_PATTERNS.some((p) => p.test(candidate)) &&
      candidate.length <= 160
    ) {
      return candidate;
    }
  }

  return null;
}

/**
 * Sanitizes Authentication & OTP errors.
 * 
 * Rules:
 * - If server returned an explicit error -> use sanitized server message
 * - If network or server crash -> "Unable to connect to server. Please check your internet connection."
 * - If OTP verification fails (wrong code, expired code, 400, 401) -> "Invalid or expired verification code."
 * - If OTP generation / send fails due to client input -> "Please enter a valid 10-digit mobile number."
 * - If rate limited (429) -> "Too many attempts. Please try again later."
 */
export function getAuthErrorMessage(
  err: any,
  context: 'verify_otp' | 'send_otp' | 'resend_otp' = 'verify_otp'
): string {
  // 1. High priority: explicit server message
  const serverMsg = extractApiErrorMessage(err);
  if (serverMsg) {
    return serverMsg;
  }

  if (isNetworkOrServerError(err)) {
    return 'Unable to connect to server. Please check your internet connection.';
  }

  const status = Number(err?.response?.status || err?.status);

  if (context === 'verify_otp') {
    if (status === 404) {
      return 'No registered account found for this mobile number.';
    }
    if (status === 403) {
      return 'Account access is restricted or inactive. Contact store manager.';
    }
    if (status === 429) {
      return 'Too many attempts. Please wait a few moments before trying again.';
    }
    return 'Invalid or expired verification code. Please check and try again.';
  }

  if (context === 'send_otp' || context === 'resend_otp') {
    if (status === 429) {
      return 'Too many attempts. Please wait a few moments before requesting another OTP.';
    }
    if (status === 400 || status === 422) {
      return 'Please enter a valid 10-digit mobile number.';
    }
    return 'Unable to send OTP. Please check your mobile number and try again.';
  }

  return 'Authentication failed. Please verify your credentials.';
}

/**
 * Sanitizes Staff PIN Authentication errors.
 * 
 * Returns precise, context-aware messages for invalid credentials,
 * wrong 4-digit PIN, unregistered mobile, deactivated staff account, or offline terminal.
 */
export function getPinAuthErrorMessage(
  err: any,
  mobile?: string,
  isPinConfigured: boolean = false
): string {
  // 1. High priority: explicit business message from backend API
  const serverMsg = extractApiErrorMessage(err);
  if (serverMsg) {
    return serverMsg;
  }

  // 2. Network / server unreachable fallback
  if (isNetworkOrServerError(err)) {
    return 'Server unreachable. Please check connection or use offline PIN.';
  }

  const status = Number(err?.response?.status || err?.status);
  const cleanMobile = mobile ? mobile.replace(/[^0-9]/g, '').slice(-10) : '';
  const formattedMobile = cleanMobile
    ? `+91 ${cleanMobile.slice(0, 5)} ${cleanMobile.slice(5)}`
    : '';

  if (status === 401) {
    return formattedMobile
      ? `Incorrect PIN for ${formattedMobile}. Please try again.`
      : 'Incorrect PIN. Please try again.';
  }

  if (status === 404) {
    return formattedMobile
      ? `No staff account found for ${formattedMobile}. Check number or contact manager.`
      : 'No staff account found for this terminal. Please switch operator.';
  }

  if (status === 403) {
    return 'Staff account is inactive or not authorized for this outlet. Contact store manager.';
  }

  if (status === 400 || status === 422) {
    return 'Invalid credentials format. Please verify mobile and 4-digit PIN.';
  }

  if (status === 429) {
    return 'Too many failed PIN attempts. Please wait a moment before trying again.';
  }

  return 'Invalid Staff PIN or credentials. Please try again.';
}

/**
 * General purpose error sanitizer for screens (POS, Tables, Catalog, Settings, Reports, etc.)
 * 
 * Prevents raw Axios error strings (e.g. "Request failed with status code 500"),
 * JSON dumps, and stack traces from leaking into Alert popups and toasts.
 */
export function getSanitizedErrorMessage(
  err: any,
  fallbackMessage: string = 'Something went wrong'
): string {
  if (!err) return fallbackMessage;

  // Always mask network errors and 5xx crashes with a clean, safe message
  if (isNetworkOrServerError(err)) {
    return 'Something went wrong';
  }

  const serverMsg = extractApiErrorMessage(err);
  if (serverMsg) {
    return serverMsg;
  }

  return fallbackMessage;
}
