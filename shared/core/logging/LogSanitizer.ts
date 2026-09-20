const SENSITIVE_KEY_PATTERNS = [
  /otp/i,
  /password/i,
  /pass/i,
  /token/i,
  /jwt/i,
  /authorization/i,
  /auth/i,
  /secret/i,
  /paymentsessionid/i,
  /card/i,
  /cvv/i,
  /pin/i,
];

export const maskMobile = (mobile?: string): string => {
  if (!mobile) return '';
  const str = mobile.toString().replace(/\D/g, '');
  if (str.length < 6) return '****';
  return `${str.slice(0, 2)}****${str.slice(-4)}`;
};

export const isSensitiveKey = (key: string): boolean => {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
};

export const sanitizeValue = (key: string, value: any): any => {
  if (value === null || value === undefined) return value;

  if (typeof key === 'string' && isSensitiveKey(key)) {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    // Check if string contains bearer token
    if (value.toLowerCase().startsWith('bearer ')) {
      return 'Bearer [REDACTED]';
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, idx) => sanitizeValue(`item_${idx}`, item));
  }

  if (typeof value === 'object') {
    return sanitizeMetadata(value);
  }

  return value;
};

export const sanitizeMetadata = (metadata?: Record<string, any>): Record<string, any> => {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(metadata)) {
    cleaned[key] = sanitizeValue(key, val);
  }
  return cleaned;
};
