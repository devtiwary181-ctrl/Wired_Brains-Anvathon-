import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service.js';
import { env } from '../../config/env.js';

export class AuthController {
  /**
   * Step 1: Submit Username/ID & Password -> Receive Challenge ID
   */
  async loginStep1(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const result = await authService.loginStep1(identifier, password, ipAddress);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Credentials verified. 6-digit verification code dispatched.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Step 2: Submit 6-digit OTP -> Set HttpOnly Cookie & Return User Profile
   */
  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { challengeId, otp, rememberDevice } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await authService.verifyOtp(challengeId, otp, rememberDevice, ipAddress, userAgent);

      // Set secure HttpOnly cookie
      res.cookie('dr_staff_token', result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: result.expiresAt,
        path: '/',
      });

      res.status(200).json({
        success: true,
        data: {
          user: result.user,
          token: result.token,
          expiresAt: result.expiresAt,
        },
        message: 'Identity confirmed. Authorized staff session initialized.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend OTP
   */
  async resendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { challengeId } = req.body;
      const ipAddress = req.ip || req.socket.remoteAddress;

      const result = await authService.resendOtp(challengeId, ipAddress);

      res.status(200).json({
        success: true,
        data: result,
        message: 'A new 6-digit verification code has been dispatched.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Current Authenticated Profile
   */
  async getMe(req: Request, res: Response, next: NextFunction) {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  }

  /**
   * Logout
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionToken = req.user?.sessionToken;
      const userId = req.user?.id;
      const ipAddress = req.ip || req.socket.remoteAddress;

      await authService.logout(sessionToken, userId, ipAddress);

      res.clearCookie('dr_staff_token', { path: '/' });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully. All operations tokens invalidated.',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
