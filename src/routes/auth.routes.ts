import { Router, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { loginSchema, registerSchema } from '../validators';
import { AppError } from '../middleware/error.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with organization
 * @access  Public
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError('User not found', 404);
      }
      const profile = await authService.getProfile(req.user.userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError('User not found', 404);
      }
      const { name, phone } = req.body;
      const profile = await authService.updateProfile(req.user.userId, { name, phone });
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId) {
        throw new AppError('User not found', 404);
      }
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user.userId, currentPassword, newPassword);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/auth/users
 * @desc    Get organization users
 * @access  Private (Admin/Owner only)
 */
router.get(
  '/users',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const users = await authService.getOrganizationUsers(req.user.organizationId);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/auth/invite
 * @desc    Invite user to organization
 * @access  Private (Admin/Owner only)
 */
router.post(
  '/invite',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId || !req.user?.userId) {
        throw new AppError('Organization not found', 404);
      }
      const { email, name, role, password } = req.body;
      const result = await authService.inviteUser(
        req.user.organizationId,
        req.user.userId,
        { email, name, role, password }
      );
      res.status(201).json({
        success: true,
        message: 'User invited successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PATCH /api/auth/users/:id/status
 * @desc    Activate/Deactivate user
 * @access  Private (Admin/Owner only)
 */
router.patch(
  '/users/:id/status',
  authenticate,
  authorize('OWNER', 'ADMIN'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.organizationId) {
        throw new AppError('Organization not found', 404);
      }
      const { isActive } = req.body;
      const user = await authService.updateUserStatus(
        req.user.organizationId,
        req.params.id,
        isActive
      );
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
