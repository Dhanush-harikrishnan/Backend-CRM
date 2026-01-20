import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../config/database';
import config from '../config';
import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';
import organizationService from './organization.service';
import expenseService from './expense.service';

export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'STAFF';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  organizationId?: string;
  role?: UserRole;
  // For creating new organization during signup
  organizationName?: string;
  businessType?: string;
  gstNumber?: string;
  state?: string;
  phone?: string;
}

export class AuthService {
  /**
   * Register a new user with organization
   */
  async register(data: RegisterInput) {
    const { email, password, name, organizationId, role, organizationName, businessType, gstNumber, state, phone } = data;

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    let orgId = organizationId;
    let userRole: UserRole = role || 'STAFF';

    // If no organizationId provided, create new organization (user becomes OWNER)
    if (!orgId && organizationName) {
      const orgResult = await organizationService.createOrganization({
        name: organizationName,
        email,
        phone,
        businessType: businessType as any,
        gstNumber,
        state,
      });
      orgId = orgResult.id;
      userRole = 'OWNER';

      // Create default expense categories
      await expenseService.createDefaultCategories(orgId);
    }

    if (!orgId) {
      throw new AppError('Organization ID or organization name is required', 400);
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    // Check if user already exists in this organization
    const existingUser = await prisma.user.findUnique({
      where: { 
        organizationId_email: {
          organizationId: orgId,
          email,
        }
      },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists in this organization', 400);
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        passwordHash,
        name,
        phone,
        role: userRole,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role as UserRole, user.organizationId, user.name);

    logger.info(`User registered: ${user.email} for org ${organization.name}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
      token,
    };
  }

  /**
   * Login user
   */
  async login(email: string, password: string) {
    // Find user by email (could be in any organization)
    const users = await prisma.user.findMany({
      where: { email },
      include: {
        organization: {
          select: { id: true, name: true, logo: true },
        },
      },
    });

    if (users.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    // For now, take the first match (in production, you might want to handle multiple orgs)
    const user = users[0];

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role as UserRole, user.organizationId, user.name);

    logger.info(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
      token,
    };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        canCreateInvoice: true,
        canEditInvoice: true,
        canDeleteInvoice: true,
        canViewReports: true,
        canManageCustomers: true,
        canManageProducts: true,
        canManageSettings: true,
        organization: {
          select: {
            id: true,
            name: true,
            businessType: true,
            gstNumber: true,
            panNumber: true,
            email: true,
            phone: true,
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
            logo: true,
            currencyCode: true,
            currencySymbol: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    logger.info(`Password changed for user: ${user.email}`);
    return { message: 'Password changed successfully' };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
      },
    });

    logger.info(`Profile updated for user: ${user.email}`);
    return user;
  }

  /**
   * Invite user to organization
   */
  async inviteUser(
    organizationId: string, 
    inviterId: string,
    data: { email: string; name: string; role: UserRole; password: string }
  ) {
    // Check if inviter has permission
    const inviter = await prisma.user.findUnique({
      where: { id: inviterId },
    });

    if (!inviter || !['OWNER', 'ADMIN'].includes(inviter.role)) {
      throw new AppError('You do not have permission to invite users', 403);
    }

    // Check if user already exists in this organization
    const existingUser = await prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: data.email,
        },
      },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists in this organization', 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        organizationId,
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    logger.info(`User invited: ${user.email} to organization by ${inviter.email}`);

    return user;
  }

  /**
   * Get all users in organization
   */
  async getOrganizationUsers(organizationId: string) {
    return prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update user status (activate/deactivate)
   */
  async updateUserStatus(organizationId: string, userId: string, isActive: boolean) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Prevent deactivating the last owner
    if (!isActive && user.role === 'OWNER') {
      const ownerCount = await prisma.user.count({
        where: { organizationId, role: 'OWNER', isActive: true },
      });

      if (ownerCount <= 1) {
        throw new AppError('Cannot deactivate the last owner of the organization', 400);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    logger.info(`User ${isActive ? 'activated' : 'deactivated'}: ${user.email}`);
    return updatedUser;
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(
    organizationId: string,
    userId: string,
    permissions: {
      canCreateInvoice?: boolean;
      canEditInvoice?: boolean;
      canDeleteInvoice?: boolean;
      canViewReports?: boolean;
      canManageCustomers?: boolean;
      canManageProducts?: boolean;
      canManageSettings?: boolean;
    }
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return prisma.user.update({
      where: { id: userId },
      data: permissions,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        canCreateInvoice: true,
        canEditInvoice: true,
        canDeleteInvoice: true,
        canViewReports: true,
        canManageCustomers: true,
        canManageProducts: true,
        canManageSettings: true,
      },
    });
  }

  /**
   * Generate JWT token
   */
  private generateToken(
    userId: string,
    email: string,
    role: UserRole,
    organizationId: string,
    name: string
  ): string {
    const payload = {
      userId,
      email,
      role,
      organizationId,
      name,
    };

    const options: SignOptions = {
      expiresIn: config.jwt.expiresIn as any,
    };

    return jwt.sign(payload, config.jwt.secret, options);
  }
}

export default new AuthService();
