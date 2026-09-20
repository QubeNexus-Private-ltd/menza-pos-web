import { LogEntry, NormalizedError } from './LogTypes';
import { sanitizeMetadata } from './LogSanitizer';

export const normalizeError = (error: any): NormalizedError => {
  if (!error) {
    return {
      name: 'UnknownError',
      message: 'No error details provided',
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
    };
  }

  const name = error.name || error.constructor?.name || 'Error';
  let message = error.message || 'An unexpected error occurred';
  let status: number | undefined;
  let code: string | number | undefined = error.code;

  if (error.isAxiosError || error.response) {
    status = error.response?.status;
    const responseData = error.response?.data;
    if (responseData) {
      if (typeof responseData === 'string') {
        message = responseData;
      } else if (responseData.message) {
        message = responseData.message;
      } else if (responseData.error) {
        message = typeof responseData.error === 'string' ? responseData.error : JSON.stringify(responseData.error);
      }
    }
  }

  return {
    name,
    message,
    code,
    status,
    stack: error.stack ? error.stack.split('\n').slice(0, 4).join('\n') : undefined,
  };
};

export const formatTerminalLog = (entry: LogEntry): string => {
  const dateStr = entry.timestamp.replace('T', ' ').substring(0, 19);
  const sanitizedMeta = entry.metadata ? sanitizeMetadata(entry.metadata) : {};

  const lines: string[] = [];

  // Line 1: Header [YYYY-MM-DD HH:MM:SS] LEVEL  CATEGORY
  lines.push(`[${dateStr}] ${entry.level.padEnd(5)} ${entry.category}`);

  // Line 2: Event name or Method + Endpoint
  if (entry.category === 'API') {
    if (entry.event === 'API_REQUEST') {
      lines.push(`[API_REQUEST] ${entry.requestId || ''}`);
      lines.push(`${entry.httpMethod || 'GET'} ${entry.apiEndpoint || ''}`);
      if (entry.restaurantId) lines.push(`restaurantId=${entry.restaurantId}`);
    } else if (entry.event === 'API_RESPONSE') {
      lines.push(`[API_RESPONSE] ${entry.requestId || ''}`);
      lines.push(`${entry.httpMethod || 'GET'} ${entry.apiEndpoint || ''}`);
      if (entry.statusCode) lines.push(`status=${entry.statusCode}`);
      if (entry.durationMs !== undefined) lines.push(`duration=${entry.durationMs}ms`);
    } else if (entry.event === 'API_ERROR') {
      lines.push(`[API_ERROR] ${entry.requestId || ''}`);
      lines.push(`${entry.httpMethod || 'GET'} ${entry.apiEndpoint || ''}`);
      if (entry.statusCode) lines.push(`status=${entry.statusCode}`);
      if (entry.durationMs !== undefined) lines.push(`duration=${entry.durationMs}ms`);
      lines.push(`message=${entry.errorMessage || entry.message}`);
    } else {
      lines.push(`${entry.event}`);
      lines.push(`${entry.message}`);
    }
  } else {
    lines.push(`${entry.event}`);
    if (entry.message && entry.message !== entry.event) {
      lines.push(`message=${entry.message}`);
    }
    if (entry.screen) {
      lines.push(`screen=${entry.screen}`);
    }
    if (entry.restaurantId) {
      lines.push(`restaurantId=${entry.restaurantId}`);
    }
    if (entry.userId) {
      lines.push(`userId=${entry.userId}`);
    }
  }

  // Key-value metadata pairs
  if (sanitizedMeta && Object.keys(sanitizedMeta).length > 0) {
    for (const [k, v] of Object.entries(sanitizedMeta)) {
      if (typeof v === 'object' && v !== null) {
        lines.push(`${k}=${JSON.stringify(v)}`);
      } else {
        lines.push(`${k}=${v}`);
      }
    }
  }

  const isDev = typeof (globalThis as any).__DEV__ !== 'undefined' ? Boolean((globalThis as any).__DEV__) : process.env.NODE_ENV !== 'production';
  if (entry.level === 'ERROR' && entry.errorStack && isDev) {
    lines.push(`stack trace:\n${entry.errorStack}`);
  }

  return lines.join('\n');
};
