export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export type LogCategory =
  | 'AUTH'
  | 'API'
  | 'NAVIGATION'
  | 'ACTION'
  | 'PAYMENT'
  | 'MENU'
  | 'POS'
  | 'TABLE'
  | 'STAFF'
  | 'PRINTER'
  | 'SUBSCRIPTION'
  | 'SUPERADMIN'
  | 'SYSTEM'
  | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  event: string;
  message: string;
  metadata?: Record<string, any>;
  screen?: string;
  userId?: string | number;
  restaurantId?: string | number;
  requestId?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  durationMs?: number;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
}

export interface NormalizedError {
  name: string;
  message: string;
  code?: string | number;
  stack?: string;
  status?: number;
}

export interface LogFilterOptions {
  date?: string;
  level?: LogLevel;
  category?: LogCategory;
  query?: string;
}
