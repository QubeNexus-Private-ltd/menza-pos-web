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
 * Extracts 4 to 6 digit OTP numbers from an incoming SMS body
 */
export const extractOtpFromSms = (smsBody: string): string | null => {
  if (!smsBody) return null;
  // Match 6 digit OTP or 4 digit OTP in message
  const match = smsBody.match(/\b\d{6}\b/) || smsBody.match(/\b\d{4}\b/);
  return match ? match[0] : null;
};

/**
 * Formats an SMS OTP message template for backend API implementation
 */
export const buildSmsRetrieverTemplate = (otpCode: string, smsHash: string = '7nP3ic8JzV5'): string => {
  return `<#> Your Menza verification code is ${otpCode}. ${smsHash}`;
};
