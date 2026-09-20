/**
 * Core formatting utilities for Menza mobile POS & Admin application.
 * Centralizes currency, date/time, and input sanitizers to ensure consistency
 * and reduce duplicate functions across screens.
 */

/**
 * Formats a numeric value or string into standard Indian Rupee (INR) currency format.
 * Examples:
 *   formatINR(1299) => "₹1,299.00"
 *   formatINR(1299, { hideDecimals: true }) => "₹1,299"
 *   formatINR(null) => "₹0.00"
 */
export function formatINR(
  amount: number | string | null | undefined,
  options?: { hideDecimals?: boolean }
): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return options?.hideDecimals ? '₹0' : '₹0.00';
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) {
    return options?.hideDecimals ? '₹0' : '₹0.00';
  }

  if (options?.hideDecimals) {
    return `₹${Math.round(num).toLocaleString('en-IN')}`;
  }

  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Extracts and sanitizes clean 10-digit Indian mobile number.
 */
export function cleanMobile(input: string | null | undefined): string {
  if (!input) return '';
  return input.replace(/[^0-9]/g, '').slice(-10);
}

/**
 * Extracts only digits up to a maximum length.
 */
export function cleanDigits(input: string | null | undefined, maxLength = 10): string {
  if (!input) return '';
  return input.replace(/[^0-9]/g, '').slice(0, maxLength);
}

/**
 * Safely parses any date string (including UTC strings lacking 'Z') into a proper Date object.
 */
export function parseUtcDate(dateStr: string | Date | undefined | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  let str = String(dateStr).trim();
  if (!str) return new Date();
  if (!str.endsWith('Z') && !str.includes('+') && !/-\d{2}:\d{2}$/.test(str)) {
    str += 'Z';
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date(dateStr) : parsed;
}

/**
 * Formats a Date or ISO string into 12-hour IST time (e.g. "04:30 PM").
 */
export function formatToIstTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = parseUtcDate(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a Date or ISO string into friendly IST date format (e.g., "27 Aug 2026").
 */
export function formatToIstDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = parseUtcDate(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a Date or ISO string into friendly IST date and time (e.g., "27 Aug 2026, 04:30 PM").
 */
export function formatToIstDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = parseUtcDate(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return `${formatToIstDate(d)}, ${formatToIstTime(d)}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats a Date or ISO string into friendly date format (e.g., "27 Aug 2026") in IST.
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  return formatToIstDate(dateInput);
}

/**
 * Formats a Date or ISO string into 12-hour time format (e.g., "04:30 PM") in IST.
 */
export function formatTime(dateInput: string | Date | null | undefined): string {
  return formatToIstTime(dateInput);
}

/**
 * Formats a Date or ISO string into date and time (e.g., "27 Aug 2026, 04:30 PM") in IST.
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  return formatToIstDateTime(dateInput);
}
