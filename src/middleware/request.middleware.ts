import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../config/logger';

// Add request ID to every request for tracking
export const requestId = (req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || randomUUID();
  next();
};

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`Request timeout: ${req.method} ${req.originalUrl}`);
        res.status(408).json({
          success: false,
          message: 'Request timeout',
        });
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
};

// Request logger with request ID
export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'];
  logger.info(`[${requestId}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
};
