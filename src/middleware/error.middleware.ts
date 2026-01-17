import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import config from '../config';

// Custom Error Class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Centralized Error Handler Middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  // Handle custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }
  // Handle Prisma errors
  else if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';
    const prismaError = err as any;
    
    // Handle unique constraint violation
    if (prismaError.code === 'P2002') {
      message = `Duplicate value for field: ${prismaError.meta?.target?.join(', ')}`;
    }
    // Handle foreign key constraint violation
    else if (prismaError.code === 'P2003') {
      message = 'Related record not found';
    }
    // Handle record not found
    else if (prismaError.code === 'P2025') {
      message = 'Record not found';
      statusCode = 404;
    }
  }
  // Handle validation errors (Zod)
  else if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation failed';
  }
  // Handle JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log error
  if (statusCode >= 500) {
    logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
      error: err,
      stack: err.stack,
    });
  } else {
    logger.warn(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  // Send error response
  const response: any = {
    success: false,
    message,
  };

  // Include stack trace only in development
  if (config.nodeEnv === 'development' && !isOperational) {
    response.stack = err.stack;
  }

  // Include validation errors for Zod
  if (err.name === 'ZodError') {
    const zodError = err as any;
    response.errors = zodError.errors;
  }

  res.status(statusCode).json(response);
};

// Not Found Handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

// Async Handler Wrapper (to avoid try-catch in every controller)
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
