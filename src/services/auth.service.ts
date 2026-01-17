import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../config/database';
import config from '../config';
import { AppError } from '../middleware/error.middleware';

export class AuthService {
  /**
   * Register a new user
   */
  async register(email: string, password: string, name: string, role: 'ADMIN' | 'STAFF' = 'STAFF') {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash,
        name,
        role,
      },
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  /**
   * Login user
   */
  async login(email: string, password: string) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string, email: string, role: string): string {
    const payload = { userId, email, role };
    const signOptions: SignOptions = { expiresIn: config.jwt.expiresIn as `${number}${'ms' | 's' | 'm' | 'h' | 'd'}` };
    return jwt.sign(payload, config.jwt.secret, signOptions);
  }
}

export default new AuthService();
