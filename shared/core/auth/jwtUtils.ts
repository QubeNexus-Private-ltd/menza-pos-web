/**
 * JWT Utility Functions for Client-Side Validation
 * Safely decodes JWT claims and verifies token lifetime across all JS runtimes (Hermes, JSC, Node).
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function safeBase64Decode(input: string): string {
  const str = input.replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 string');
  }
  for (let bc = 0, bs = 0, buffer, idx = 0; (buffer = str.charAt(idx++)); ) {
    const charIndex = BASE64_CHARS.indexOf(buffer);
    if (~charIndex) {
      bs = bc % 4 ? bs * 64 + charIndex : charIndex;
      if (bc++ % 4) {
        output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
      }
    }
  }
  return output;
}

/**
 * Decode payload claims from a JWT token without verifying cryptographic signature.
 */
export function decodeJwtClaims(token: string | null | undefined): Record<string, any> {
  if (!token || typeof token !== 'string') return {};
  try {
    const parts = token.trim().split('.');
    if (parts.length < 2) return {};

    let base64Url = parts[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const decoded = typeof atob === 'function' ? atob(base64) : safeBase64Decode(base64);

    try {
      return JSON.parse(decodeURIComponent(escape(decoded)));
    } catch {
      return JSON.parse(decoded);
    }
  } catch {
    return {};
  }
}

/**
 * Check whether a JWT access token is expired or close to expiring within bufferSeconds.
 * Returns true if the token is null, invalid, or expired.
 */
export function isJwtExpired(token: string | null | undefined, bufferSeconds: number = 30): boolean {
  if (!token || typeof token !== 'string') return true;

  // Mock tokens used in tests or offline preview never expire
  if (token.startsWith('mock-') || token.includes('mock')) {
    return false;
  }

  const claims = decodeJwtClaims(token);
  if (!claims || typeof claims.exp !== 'number') {
    // If no exp claim could be parsed from token string, treat as expired/invalid
    return true;
  }

  const expEpochMs = claims.exp * 1000;
  const nowMs = Date.now();
  return nowMs + bufferSeconds * 1000 >= expEpochMs;
}

/**
 * Extract expiration Date from JWT claims, or null if invalid.
 */
export function getJwtExpirationDate(token: string | null | undefined): Date | null {
  const claims = decodeJwtClaims(token);
  if (!claims || typeof claims.exp !== 'number') return null;
  return new Date(claims.exp * 1000);
}
