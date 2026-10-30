import { Router } from 'express';
import { z } from 'zod';
import { authController } from './auth.controller.js';
import { requireAuth } from './auth.middleware.js';
import { validateRequest } from '../../middleware/validate.js';
export const authRouter = Router();
const loginStep1Schema = z.object({
    identifier: z.string().min(3, 'Username or Email must be at least 3 characters'),
    password: z.string().min(6, 'Password is required'),
});
const verifyOtpSchema = z.object({
    challengeId: z.string().uuid('Invalid challenge ID format'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
    rememberDevice: z.boolean().optional(),
});
const resendOtpSchema = z.object({
    challengeId: z.string().uuid('Invalid challenge ID format'),
});
// Step 1: Credential Check
authRouter.post('/login-step1', validateRequest({ body: loginStep1Schema }), (req, res, next) => authController.loginStep1(req, res, next));
// Step 2: OTP Verification
authRouter.post('/verify-otp', validateRequest({ body: verifyOtpSchema }), (req, res, next) => authController.verifyOtp(req, res, next));
// Resend OTP
authRouter.post('/resend-otp', validateRequest({ body: resendOtpSchema }), (req, res, next) => authController.resendOtp(req, res, next));
// Profile
authRouter.get('/me', requireAuth, (req, res, next) => authController.getMe(req, res, next));
// Logout
authRouter.post('/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));
//# sourceMappingURL=auth.routes.js.map