import crypto from 'crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../../shared/database.js';
import { redis } from '../../shared/redis.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import { AppError } from '../../middleware/errorHandler.js';
import { RoleType, ROLE_PERMISSIONS, PermissionType } from './rbac.js';

export class AuthService {
  /**
   * Step 1: Verify Username/Email + Password -> Generate 6-digit OTP -> Send SMS
   */
  async loginStep1(identifier: string, passwordPlain: string, ipAddress?: string) {
    const user = await prisma.staffUser.findFirst({
      where: {
        OR: [
          { username: identifier.trim() },
          { email: identifier.trim().toLowerCase() },
        ],
      },
    });

    if (!user) {
      // Secure constant-time fake comparison to avoid timing attacks
      await argon2.verify('$argon2id$v=19$m=65536,t=3,p=4$fakehashfakehashfakehash$fakehash', 'fakepassword').catch(() => {});
      throw new AppError('Invalid credentials. Check your details or contact your district nodal IT officer.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('This staff account has been deactivated. Contact NDMA IT NOC.', 403, 'ACCOUNT_DEACTIVATED');
    }

    const isValidPassword = await argon2.verify(user.passwordHash, passwordPlain);
    if (!isValidPassword) {
      // Audit Failed Login Attempt
      await prisma.auditLog.create({
        data: {
          staffUserId: user.id,
          action: 'LOGIN_FAILED_CREDENTIALS',
          entityType: 'StaffUser',
          entityId: user.id,
          ipAddress,
        },
      });
      throw new AppError('Invalid credentials. Check your details or contact your district nodal IT officer.', 401, 'INVALID_CREDENTIALS');
    }

    // Invalidate any existing unused OTP challenges for this user
    await prisma.staffOtpChallenge.updateMany({
      where: { staffUserId: user.id, isUsed: false },
      data: { isUsed: true },
    });

    // Generate secure 6-digit OTP
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await argon2.hash(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const challenge = await prisma.staffOtpChallenge.create({
      data: {
        staffUserId: user.id,
        otpHash,
        expiresAt,
        attemptCount: 0,
        isUsed: false,
      },
    });

    // Mask phone number for display (+91 98*** **412)
    const phone = user.phoneNumber;
    const maskedPhone = phone.length > 5 
      ? `${phone.slice(0, 5)}*** **${phone.slice(-3)}`
      : 'registered mobile';

    // In non-production, log a sanitized notification for test engineers
    if (env.NODE_ENV !== 'production') {
      logger.info({ challengeId: challenge.id, devOtp: rawOtp }, '🔑 [DEV MODE OTP DISPATCHED]');
    }

    // Audit successful Step 1
    await prisma.auditLog.create({
      data: {
        staffUserId: user.id,
        action: 'LOGIN_STEP1_SUCCESS',
        entityType: 'StaffOtpChallenge',
        entityId: challenge.id,
        ipAddress,
      },
    });

    return {
      challengeId: challenge.id,
      maskedPhone,
      expiresInSeconds: 300,
      fullName: user.fullName,
      username: user.username,
      devOtp: env.NODE_ENV !== 'production' ? rawOtp : undefined,
    };
  }

  /**
   * Step 2: Verify 6-digit OTP -> Create authenticated Session & JWT token
   */
  async verifyOtp(challengeId: string, otpInput: string, rememberDevice = false, ipAddress?: string, userAgent?: string) {
    const challenge = await prisma.staffOtpChallenge.findUnique({
      where: { id: challengeId },
      include: { staffUser: true },
    });

    if (!challenge || challenge.isUsed) {
      throw new AppError('OTP session is invalid or has already been used. Please start over.', 400, 'INVALID_OTP_CHALLENGE');
    }

    if (new Date() > challenge.expiresAt) {
      await prisma.staffOtpChallenge.update({
        where: { id: challengeId },
        data: { isUsed: true },
      });
      throw new AppError('This verification code has expired. Please request a new code.', 400, 'OTP_EXPIRED');
    }

    if (challenge.attemptCount >= 3) {
      await prisma.staffOtpChallenge.update({
        where: { id: challengeId },
        data: { isUsed: true },
      });
      throw new AppError('Too many failed OTP attempts. Security challenge revoked.', 429, 'OTP_MAX_ATTEMPTS');
    }

    // Verify OTP
    const isOtpValid = await argon2.verify(challenge.otpHash, otpInput.trim());

    if (!isOtpValid) {
      await prisma.staffOtpChallenge.update({
        where: { id: challengeId },
        data: { attemptCount: challenge.attemptCount + 1 },
      });

      // Audit failed OTP attempt
      await prisma.auditLog.create({
        data: {
          staffUserId: challenge.staffUserId,
          action: 'LOGIN_FAILED_OTP',
          entityType: 'StaffOtpChallenge',
          entityId: challenge.id,
          metadata: { remainingAttempts: 3 - (challenge.attemptCount + 1) },
          ipAddress,
        },
      });

      throw new AppError('Incorrect verification code. Please check your SMS or Authenticator.', 400, 'INCORRECT_OTP');
    }

    // Mark challenge used
    await prisma.staffOtpChallenge.update({
      where: { id: challengeId },
      data: { isUsed: true },
    });

    const user = challenge.staffUser;
    const sessionDurationDays = rememberDevice ? 7 : 1;
    const expiresAt = new Date(Date.now() + sessionDurationDays * 24 * 60 * 60 * 1000);

    const sessionToken = crypto.randomBytes(32).toString('hex');

    await prisma.staffSession.create({
      data: {
        staffUserId: user.id,
        sessionToken,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // Sign JWT
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        districtId: user.districtId,
        sessionToken,
      },
      env.JWT_SECRET,
      { expiresIn: `${sessionDurationDays}d` }
    );

    // Audit successful login
    await prisma.auditLog.create({
      data: {
        staffUserId: user.id,
        action: 'LOGIN_SUCCESS_2FA',
        entityType: 'StaffSession',
        entityId: sessionToken,
        ipAddress,
      },
    });

    const role = user.role as RoleType;
    const permissions = ROLE_PERMISSIONS[role] || [];

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        districtId: user.districtId,
        permissions,
      },
    };
  }

  /**
   * Resend OTP for active challenge
   */
  async resendOtp(challengeId: string, ipAddress?: string) {
    const existing = await prisma.staffOtpChallenge.findUnique({
      where: { id: challengeId },
      include: { staffUser: true },
    });

    if (!existing || existing.isUsed) {
      throw new AppError('Cannot resend code for invalid or closed challenge.', 400, 'INVALID_CHALLENGE');
    }

    // Cooldown check via Redis (1 request per 30 seconds)
    const cooldownKey = `otp_cooldown:${existing.staffUserId}`;
    const inCooldown = await redis.get(cooldownKey);
    if (inCooldown) {
      throw new AppError('Please wait 30 seconds before requesting another SMS code.', 429, 'RESEND_COOLDOWN');
    }
    await redis.set(cooldownKey, '1', 'EX', 30);

    // Invalidate old challenge
    await prisma.staffOtpChallenge.update({
      where: { id: challengeId },
      data: { isUsed: true },
    });

    // Create new challenge
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await argon2.hash(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const newChallenge = await prisma.staffOtpChallenge.create({
      data: {
        staffUserId: existing.staffUserId,
        otpHash,
        expiresAt,
        attemptCount: 0,
        isUsed: false,
      },
    });

    if (env.NODE_ENV !== 'production') {
      logger.info({ challengeId: newChallenge.id, devOtp: rawOtp }, '🔑 [DEV RESEND OTP DISPATCHED]');
    }

    return {
      challengeId: newChallenge.id,
      expiresInSeconds: 300,
      devOtp: env.NODE_ENV !== 'production' ? rawOtp : undefined,
    };
  }

  /**
   * Logout and invalidate session
   */
  async logout(sessionToken?: string, userId?: string, ipAddress?: string) {
    if (sessionToken) {
      await prisma.staffSession.deleteMany({
        where: { sessionToken },
      });
    }

    if (userId) {
      await prisma.auditLog.create({
        data: {
          staffUserId: userId,
          action: 'LOGOUT',
          entityType: 'StaffSession',
          entityId: sessionToken || 'unknown',
          ipAddress,
        },
      });
    }

    return { message: 'Logged out successfully' };
  }
}

export const authService = new AuthService();
