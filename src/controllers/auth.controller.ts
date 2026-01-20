import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import authService from '../services/auth.service';
import logger from '../config/logger';

export class AuthController {
  /**
   * @route   POST /api/auth/register
   * @desc    Register new user with organization
   * @access  Public
   */
  register = asyncHandler(
    async (req: Request, res: Response) => {
      logger.info(`New user registration attempt: ${req.body.email}`);

      const result = await authService.register(req.body);

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

  /**
   * @route   PUT /api/auth/profile
   * @desc    Update current user profile
   * @access  Private
   */
  updateProfile = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const userId = req.user!.userId;
      const { name, phone } = req.body;

      const user = await authService.updateProfile(userId, { name, phone });

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user,
      });
    }
  );

  /**
   * @route   POST /api/auth/change-password
   * @desc    Change user password
   * @access  Private
   */
  changePassword = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;

      await authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    }
  );

  /**
   * @route   POST /api/auth/invite
   * @desc    Invite new user to organization
   * @access  Private (Admin only)
   */
  inviteUser = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const inviterId = req.user!.userId;

      const result = await authService.inviteUser(organizationId, inviterId, req.body);

      res.status(201).json({
        success: true,
        message: 'User invited successfully',
        data: result,
      });
    }
  );

  /**
   * @route   GET /api/auth/users
   * @desc    Get all users in organization
   * @access  Private (Admin only)
   */
  getOrganizationUsers = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;

      const users = await authService.getOrganizationUsers(organizationId);

      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    }
  );

  /**
   * @route   PUT /api/auth/users/:id/status
   * @desc    Update user status (activate/deactivate)
   * @access  Private (Admin only)
   */
  updateUserStatus = asyncHandler(
    async (req: AuthRequest, res: Response) => {
      const organizationId = req.user!.organizationId;
      const userId = req.params.id;
      const { isActive } = req.body;

      const user = await authService.updateUserStatus(organizationId, userId, isActive);

      res.status(200).json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: user,
      });
    }
  );
}

export default new AuthController();
