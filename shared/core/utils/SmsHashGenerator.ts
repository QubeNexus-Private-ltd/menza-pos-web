/**
 * SMS Retriever Hash Utility for Menza OS
 * 
 * Helper functions to generate, format, and parse SMS Retriever OTP codes.
 */

export interface SmsHashInfo {
  packageName: string;
  smsHash: string;
  sampleSmsMessage: string;
}

/**
 * Extracts 4 to 8 digit OTP numbers from an incoming SMS body
 */
export const extractOtpFromSms = (smsBody: string, numberOfDigits: number = 6): string | null => {
  if (!smsBody || typeof smsBody !== 'string') return null;

  // 1. Look for patterns with explicit keywords like OTP / code / verification:
  // Matches "OTP for Menza login is 123456", "verification code is 123456", "OTP: 123456", "code is 123456"
  const keywordPattern = new RegExp(`(?:otp|code|verification|login is)[^\\d]*(\\d{${numberOfDigits}})`, 'i');
  const keywordMatch = smsBody.match(keywordPattern);
  if (keywordMatch && keywordMatch[1]) {
    return keywordMatch[1];
  }

  // 2. Exact match on target digit count (e.g. 6 digits)
  const exactPattern = new RegExp(`\\b\\d{${numberOfDigits}}\\b`);
  const exactMatch = smsBody.match(exactPattern);
  if (exactMatch) {
    return exactMatch[0];
  }

  // 3. Fallback to 6-digit or 4-digit numeric sequences
  const fallbackMatch = smsBody.match(/\b\d{6}\b/) || smsBody.match(/\b\d{4}\b/);
  return fallbackMatch ? fallbackMatch[0] : null;
};

/**
 * Formats an SMS OTP message template for backend API implementation
 */
export const buildSmsRetrieverTemplate = (otpCode: string, smsHash: string = ''): string => {
  return smsHash
    ? `<#> Your Menza verification code is ${otpCode}. ${smsHash}`.trim()
    : `<#> Your Menza verification code is ${otpCode}.`;
};
