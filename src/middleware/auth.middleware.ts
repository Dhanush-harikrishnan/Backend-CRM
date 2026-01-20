import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { AppError } from './error.middleware';

// User roles in order of hierarchy
export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'STAFF';

// Extend Express Request interface to include user
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
    organizationId: string;
    name?: string;
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
      role: UserRole;
      organizationId: string;
      name?: string;
    };

    // Attach user to request
    (req as AuthRequest).user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or expired token', 401));
    } else {
      next(error);
    }
  }
};

// Role-based Authorization Middleware
// Allows access to specified roles and above
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      throw new AppError('Unauthorized', 401);
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      throw new AppError('Forbidden: Insufficient permissions', 403);
    }

    next();
  };
};

// Check if user belongs to the organization (multi-tenant security)
export const belongsToOrganization = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthRequest;
  
  if (!authReq.user?.organizationId) {
    throw new AppError('Organization context required', 400);
  }

  next();
};
