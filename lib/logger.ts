import { logger as coreLogger } from '@shared/core/logging/Logger';
import { sanitizeMetadata } from '@shared/core/logging/LogSanitizer';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const isBrowser = typeof window !== 'undefined';
const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV);

/**
 * Enterprise Production & Testing Logger for Menza Web
 * - In Development & Testing: Emits rich, colored, inspectable logs with timings & data payloads.
 * - In Production (Vercel): Emits structured JSON, redacts secrets, and forwards critical telemetry to /api/log.
 */
export const logger = {
  /**
   * Log informational messages
   */
  info: (msg: string, ...args: any[]) => {
    if (!isProd) {
      console.log(`%c[INFO] ℹ️ ${msg}`, 'color: #3b82f6; font-weight: bold;', ...args);
    } else {
      coreLogger.info('SYSTEM', 'APP_INFO', msg, sanitizeArgs(args));
    }
  },

  /**
   * Log warnings with stack or context
   */
  warn: (msg: string, ...args: any[]) => {
    if (!isProd) {
      console.warn(`%c[WARN] ⚠️ ${msg}`, 'color: #f59e0b; font-weight: bold;', ...args);
    } else {
      coreLogger.warn('SYSTEM', 'APP_WARN', msg, sanitizeArgs(args));
      forwardToLogEndpoint('WARN', msg, sanitizeArgs(args));
    }
  },

  /**
   * Log errors with normalized message and stack trace
   */
  error: (msg: string, error?: any, context?: Record<string, any>) => {
    if (!isProd) {
      console.error(`%c[ERROR] ❌ ${msg}`, 'color: #ef4444; font-weight: bold;', error, context || '');
    } else {
      coreLogger.error('ERROR', 'APP_ERROR', error || msg, {
        errorMessage: msg,
        context: sanitizeMetadata(context),
      });
      forwardToLogEndpoint('ERROR', msg, {
        error: error?.message || String(error),
        stack: error?.stack,
        context: sanitizeMetadata(context),
      });
    }
  },

  /**
   * Log debug information (only active during development/testing)
   */
  debug: (msg: string, ...args: any[]) => {
    if (!isProd) {
      console.debug(`%c[DEBUG] 🔍 ${msg}`, 'color: #8b5cf6;', ...args);
    }
  },

  /**
   * Dedicated testing and QA verification logger
   */
  test: (testName: string, status: 'PASSED' | 'FAILED' | 'RUNNING', details?: any) => {
    const color = status === 'PASSED' ? '#10b981' : status === 'FAILED' ? '#ef4444' : '#6366f1';
    const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⏳';
    console.log(
      `%c[TEST] ${icon} [${status}] ${testName}`,
      `color: ${color}; font-weight: bold; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px;`,
      details ? sanitizeMetadata(details) : ''
    );
  },

  /**
   * Specialized API Request/Response logger for network observability
   */
  api: (
    event: 'REQUEST' | 'RESPONSE' | 'ERROR' | 'SLOW',
    method: string,
    url: string,
    details?: Record<string, any>
  ) => {
    const sanitized = sanitizeMetadata(details);
    if (!isProd) {
      const tagColor =
        event === 'REQUEST' ? '#0ea5e9' : event === 'RESPONSE' ? '#10b981' : event === 'SLOW' ? '#f59e0b' : '#ef4444';
      const icon = event === 'REQUEST' ? '📤' : event === 'RESPONSE' ? '📥' : event === 'SLOW' ? '🐢' : '💥';
      console.log(
        `%c[API:${event}] ${icon} ${method.toUpperCase()} ${url}`,
        `color: ${tagColor}; font-weight: 600;`,
        sanitized || ''
      );
    } else {
      const level = event === 'ERROR' ? 'ERROR' : event === 'SLOW' ? 'WARN' : 'INFO';
      coreLogger.api(
        event === 'ERROR' ? 'API_ERROR' : event === 'SLOW' ? 'API_SLOW_REQUEST' : event === 'REQUEST' ? 'API_REQUEST' : 'API_RESPONSE',
        `${method.toUpperCase()} ${url}`,
        sanitized
      );
      if (event === 'ERROR' || event === 'SLOW') {
        forwardToLogEndpoint(level, `${method.toUpperCase()} ${url}`, sanitized);
      }
    }
  },

  /**
   * Set user and restaurant context for correlation
   */
  setContext: (context: { userId?: string | number; restaurantId?: string | number; screen?: string }) => {
    coreLogger.setContext(context);
  },
};

function sanitizeArgs(args: any[]): Record<string, any> {
  if (!args || args.length === 0) return {};
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    return sanitizeMetadata(args[0]);
  }
  return { details: args.map((a) => (typeof a === 'object' ? sanitizeMetadata(a) : String(a))) };
}

/**
 * Forward critical client events to /api/log for Vercel Log Drain ingestion
 */
function forwardToLogEndpoint(level: LogLevel, message: string, metadata?: Record<string, any>) {
  if (!isBrowser || !isProd) return;
  try {
    const payload = JSON.stringify({
      level,
      category: 'CLIENT',
      message,
      metadata,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/log', payload);
    } else {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Avoid recursion or logging crashes
  }
}
