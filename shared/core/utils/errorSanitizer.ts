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
 * Sanitizes Authentication & OTP errors.
 * 
 * Rules:
 * - If network or server crash -> "Something went wrong"
 * - If OTP verification fails (wrong code, expired code, 400, 401) -> "Invalid OTP"
 * - If OTP generation / send fails due to client input -> "Please enter a valid 10-digit mobile number."
 * - If rate limited (429) -> "Too many attempts. Please try again later."
 */
export function getAuthErrorMessage(
  err: any,
  context: 'verify_otp' | 'send_otp' | 'resend_otp' = 'verify_otp'
): string {
  if (isNetworkOrServerError(err)) {
    return 'Something went wrong';
  }

  const status = Number(err?.response?.status);

  if (context === 'verify_otp') {
    // 400 Bad Request, 401 Unauthorized, 404 Not Found, 422 Unprocessable Entity
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) {
      return 'Invalid OTP';
    }
    return 'Invalid OTP';
  }

  if (context === 'send_otp' || context === 'resend_otp') {
    if (status === 429) {
      return 'Too many attempts. Please try again later.';
    }
    if (status === 400 || status === 422) {
      return 'Please enter a valid 10-digit mobile number.';
    }
    return 'Something went wrong';
  }

  return 'Something went wrong';
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

  // Check if server returned a custom application message
  const rawMsg = err.response?.data?.message || err.response?.data?.Message;
  if (typeof rawMsg === 'string' && rawMsg.trim().length > 0) {
    const candidate = rawMsg.trim();

    // Check if the message contains any technical vulnerability leak signatures
    const hasLeak = TECHNICAL_LEAK_PATTERNS.some((pattern) => pattern.test(candidate));

    // Allow only clean, safe, human-readable business error messages
    if (!hasLeak && candidate.length <= 120 && !candidate.includes('{') && !candidate.includes('}')) {
      return candidate;
    }
  }

  return fallbackMessage;
}
