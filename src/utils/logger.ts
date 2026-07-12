// ChatYX runtime logger.

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private listeners: ((entry: LogEntry) => void)[] = [];

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private log(level: LogLevel, category: string, message: string, data?: any) {
    if (level < this.level) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.listeners.forEach(listener => listener(entry));

    // Console output with colors
    const levelName = LogLevel[level];
    const time = entry.timestamp.toLocaleTimeString();
    const prefix = `[${time}] [${levelName}] [${category}]`;

    switch (level) {
      case LogLevel.DEBUG:
        // Disabled for performance
        break;
      case LogLevel.INFO:
        // Disabled for performance
        break;
      case LogLevel.WARN:
        // Disabled for performance
        break;
      case LogLevel.ERROR:
        console.error(`%c${prefix} ${message}`, 'color: #ff4a4a', data || '');
        break;
    }
  }

  debug(category: string, message: string, data?: any) {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: any) {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log(LogLevel.ERROR, category, message, data);
  }

  // Event-specific logging
  event(category: string, eventType: string, data?: any) {
    this.info(category, `Event: ${eventType}`, data);
  }

  // WebSocket logging
  ws(category: string, action: 'connect' | 'disconnect' | 'send' | 'receive' | 'error', data?: any) {
    const message = `WebSocket ${action}`;
    if (action === 'error') {
      this.error(category, message, data);
    } else {
      this.debug(category, message, data);
    }
  }

  // API logging
  api(category: string, method: string, url: string, status?: number, data?: any) {
    const message = `${method} ${url}${status ? ` - ${status}` : ''}`;
    if (status && status >= 400) {
      this.error(category, message, data);
    } else {
      this.debug(category, message, data);
    }
  }

  // Service lifecycle logging
  service(category: string, action: 'init' | 'start' | 'stop' | 'error', message: string, data?: any) {
    if (action === 'error') {
      this.error(category, `[${action}] ${message}`, data);
    } else {
      this.info(category, `[${action}] ${message}`, data);
    }
  }

  // Subscribe to log events
  subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Get recent logs
  getLogs(count?: number): LogEntry[] {
    return count ? this.logs.slice(-count) : [...this.logs];
  }

  // Clear logs
  clear() {
    this.logs = [];
  }

  // Export logs as JSON
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Filter logs
  filter(options: {
    level?: LogLevel;
    category?: string;
    startTime?: Date;
    endTime?: Date;
  }): LogEntry[] {
    return this.logs.filter(entry => {
      if (options.level !== undefined && entry.level < options.level) return false;
      if (options.category && entry.category !== options.category) return false;
      if (options.startTime && entry.timestamp < options.startTime) return false;
      if (options.endTime && entry.timestamp > options.endTime) return false;
      return true;
    });
  }
}

// Global logger instance
export const logger = new Logger(
  // Set debug level if in development
  import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.INFO
);

// Convenience exports
export const log = {
  debug: (category: string, message: string, data?: any) => logger.debug(category, message, data),
  info: (category: string, message: string, data?: any) => logger.info(category, message, data),
  warn: (category: string, message: string, data?: any) => logger.warn(category, message, data),
  error: (category: string, message: string, data?: any) => logger.error(category, message, data),
  event: (category: string, eventType: string, data?: any) => logger.event(category, eventType, data),
  ws: (category: string, action: 'connect' | 'disconnect' | 'send' | 'receive' | 'error', data?: any) => 
    logger.ws(category, action, data),
  api: (category: string, method: string, url: string, status?: number, data?: any) => 
    logger.api(category, method, url, status, data),
  service: (category: string, action: 'init' | 'start' | 'stop' | 'error', message: string, data?: any) => 
    logger.service(category, action, message, data),
};

// Category constants
export const LOG_CATEGORIES = {
  TWITCH_IRC: 'Twitch IRC',
  IRC: 'IRC',
  SEVENTV_WS: '7TV WebSocket',
  SEVENTV_API: '7TV API',
  EMOTES: 'Emotes',
  BADGE: 'Badges',
  BADGES: 'Badges',
  PAINTS: 'Paints',
  BOT_FILTER: 'Bot Filter',
  CHAT: 'Chat',
  INTEGRATION: 'Integration',
  LAYOUT: 'Layout',
  ANIMATION: 'Animation',
  FADE: 'Fade',
};
