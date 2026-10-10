import { LogCategory, LogEntry, LogLevel } from './LogTypes';
import { formatTerminalLog, normalizeError } from './LogFormatter';
import { sanitizeMetadata } from './LogSanitizer';

class Logger {
  private static instance: Logger;
  private currentScreen?: string;
  private currentUserId?: string | number;
  private currentRestaurantId?: string | number;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setContext(context: { screen?: string; userId?: string | number; restaurantId?: string | number }): void {
    if (context.screen !== undefined) this.currentScreen = context.screen;
    if (context.userId !== undefined) this.currentUserId = context.userId;
    if (context.restaurantId !== undefined) this.currentRestaurantId = context.restaurantId;
  }

  public setScreen(screen: string): void {
    this.currentScreen = screen;
  }

  public setUserId(userId: string | number | undefined): void {
    this.currentUserId = userId;
  }

  public setRestaurantId(restaurantId: string | number | undefined): void {
    this.currentRestaurantId = restaurantId;
  }

  private shouldLog(level: LogLevel): boolean {
    const isDev = typeof (globalThis as any).__DEV__ !== 'undefined' ? Boolean((globalThis as any).__DEV__) : process.env.NODE_ENV !== 'production';
    if (isDev) {
      return true; // All levels enabled in development
    }
    // Production: Only WARN and ERROR
    return level === 'WARN' || level === 'ERROR';
  }

  private createEntry(
    level: LogLevel,
    category: LogCategory,
    event: string,
    message: string,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): LogEntry {
    const sanitizedMeta = metadata ? sanitizeMetadata(metadata) : undefined;

    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      event,
      message,
      metadata: sanitizedMeta,
      screen: extraContext?.screen || this.currentScreen,
      userId: extraContext?.userId || this.currentUserId,
      restaurantId: extraContext?.restaurantId || this.currentRestaurantId,
      requestId: extraContext?.requestId,
      apiEndpoint: extraContext?.apiEndpoint,
      httpMethod: extraContext?.httpMethod,
      statusCode: extraContext?.statusCode,
      durationMs: extraContext?.durationMs,
      errorName: extraContext?.errorName,
      errorMessage: extraContext?.errorMessage,
      errorStack: extraContext?.errorStack,
    };
  }

  private dispatch(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const isBrowser = typeof window !== 'undefined';
    const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV);

    // In production, output structured JSON for Vercel log drain parsing; in dev, format terminal colors
    const outputText = isProd ? JSON.stringify(entry) : formatTerminalLog(entry);

    switch (entry.level) {
      case 'DEBUG':
        console.debug(outputText);
        break;
      case 'INFO':
        console.info(outputText);
        break;
      case 'WARN':
        console.warn(outputText);
        break;
      case 'ERROR':
        console.error(outputText);
        break;
      default:
        console.log(outputText);
        break;
    }

    // In client browser on production, forward critical errors to /api/log for Vercel runtime ingestion
    if (isBrowser && isProd && (entry.level === 'ERROR' || entry.level === 'WARN')) {
      try {
        const payload = JSON.stringify({
          ...entry,
          url: window.location.href,
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
        // Silently prevent logging errors from breaking application flow
      }
    }
  }

  public debug(
    category: LogCategory,
    event: string,
    message: string,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): void {
    const entry = this.createEntry('DEBUG', category, event, message, metadata, extraContext);
    this.dispatch(entry);
  }

  public info(
    category: LogCategory,
    event: string,
    message: string,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): void {
    const entry = this.createEntry('INFO', category, event, message, metadata, extraContext);
    this.dispatch(entry);
  }

  public warn(
    category: LogCategory,
    event: string,
    message: string,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): void {
    const entry = this.createEntry('WARN', category, event, message, metadata, extraContext);
    this.dispatch(entry);
  }

  public error(
    category: LogCategory,
    event: string,
    errorOrMessage: any,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): void {
    const normErr = normalizeError(errorOrMessage);
    const msg = normErr.message || (typeof errorOrMessage === 'string' ? errorOrMessage : 'An error occurred');

    const entry = this.createEntry('ERROR', category, event, msg, metadata, {
      ...extraContext,
      errorName: normErr.name,
      errorMessage: normErr.message,
      errorStack: normErr.stack,
      statusCode: extraContext?.statusCode || normErr.status,
    });

    this.dispatch(entry);
  }

  public api(
    event: 'API_REQUEST' | 'API_RESPONSE' | 'API_ERROR' | 'API_SLOW_REQUEST',
    message: string,
    metadata?: Record<string, any>,
    extraContext?: Partial<LogEntry>
  ): void {
    const level: LogLevel = event === 'API_ERROR' ? 'ERROR' : event === 'API_SLOW_REQUEST' ? 'WARN' : 'INFO';
    const entry = this.createEntry(level, 'API', event, message, metadata, extraContext);
    this.dispatch(entry);
  }

  public auth(
    event:
      | 'APP_ONBOARDING_CHECK'
      | 'ONBOARDING_COMPLETED'
      | 'LOGIN_SCREEN_OPENED'
      | 'OTP_REQUEST_STARTED'
      | 'OTP_REQUEST_SUCCESS'
      | 'OTP_REQUEST_FAILED'
      | 'OTP_VERIFICATION_STARTED'
      | 'OTP_VERIFICATION_SUCCESS'
      | 'OTP_VERIFICATION_FAILED'
      | 'SMS_RETRIEVER_STARTED'
      | 'SMS_RETRIEVER_START_FAILED'
      | 'SMS_RETRIEVER_HASH_ERROR'
      | 'SMS_OTP_AUTO_DETECTED'
      | 'AUTH_SESSION_CREATED'
      | 'AUTH_SESSION_EXPIRED'
      | 'TOKEN_REFRESH_STARTED'
      | 'TOKEN_REFRESH_SUCCESS'
      | 'TOKEN_REFRESH_FAILED'
      | 'TERMS_ACCEPTED'
      | 'LOGOUT_STARTED'
      | 'LOGOUT_COMPLETED',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = event.endsWith('_FAILED') || event.endsWith('_EXPIRED') ? 'ERROR' : 'INFO';
    const entry = this.createEntry(level, 'AUTH', event, message, metadata);
    this.dispatch(entry);
  }

  public navigation(screenName: string, metadata?: Record<string, any>): void {
    this.setScreen(screenName);
    const entry = this.createEntry('INFO', 'NAVIGATION', 'SCREEN_VIEW', `Navigated to ${screenName}`, metadata, {
      screen: screenName,
    });
    this.dispatch(entry);
  }

  public action(category: LogCategory, event: string, message: string, metadata?: Record<string, any>): void {
    const entry = this.createEntry('INFO', category, event, message, metadata);
    this.dispatch(entry);
  }

  public payment(
    event:
      | 'PAYMENT_STARTED'
      | 'PAYMENT_ORDER_CREATED'
      | 'PAYMENT_SDK_STARTED'
      | 'PAYMENT_SDK_COMPLETED'
      | 'PAYMENT_VERIFICATION_STARTED'
      | 'PAYMENT_VERIFICATION_SUCCESS'
      | 'PAYMENT_VERIFICATION_FAILED'
      | 'PAYMENT_STATUS_POLLING'
      | 'PAYMENT_TIMEOUT',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = event.endsWith('_FAILED') || event.endsWith('_TIMEOUT') ? 'ERROR' : 'INFO';
    const entry = this.createEntry(level, 'PAYMENT', event, message, metadata);
    this.dispatch(entry);
  }
}

export const logger = Logger.getInstance();
