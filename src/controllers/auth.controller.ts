import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import authService from '../services/auth.service';
import logger from '../config/logger';

export class AuthController {
  /**
   * @route   POST /api/auth/register
   * @desc    Register new user
   * @access  Public (but should be restricted in production)
   */
  register = asyncHandler(
    async (req: Request, res: Response) => {
      const { email, password, name, role } = req.body;

      logger.info(`New user registration attempt: ${email}`);

      const result = await authService.register(email, password, name, role);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    }
  );

  /**
   * @route   POST /api/auth/login
   * @desc    Login user
   * @access  Public
   */
  login = asyncHandler(
    async (req: Request, res: Response) => {
      const { email, password } = req.body;

      logger.info(`Login attempt: ${email}`);

      const result = await authService.login(email, password);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    }
  );

  /**
   * @route   GET /api/auth/profile
   * @desc    Get current user profile
   * @access  Private
   */
  getProfile = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const userId = req.user!.userId;

      const user = await authService.getProfile(userId);

      res.status(200).json({
        success: true,
        data: user,
      });
    }
  );
}

export default new AuthController();
