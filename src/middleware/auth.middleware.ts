import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { AppError } from './error.middleware';

// Extend Express Request interface to include user
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

// JWT Authentication Middleware
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token required', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      email: string;
      role: string;
    };

    // Attach user to request
    (req as AuthRequest).user = decoded;
    
    next();
  } catch (error) {
    next(error);
  }
};

// Role-based Authorization Middleware
export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      throw new AppError('Unauthorized', 401);
    }

    if (!roles.includes(authReq.user.role)) {
      throw new AppError('Forbidden: Insufficient permissions', 403);
    }

    next();
  };
};
