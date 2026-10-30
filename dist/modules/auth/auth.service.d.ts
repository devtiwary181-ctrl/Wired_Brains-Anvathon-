import { PermissionType } from './rbac.js';
export declare class AuthService {
    /**
     * Step 1: Verify Username/Email + Password -> Generate 6-digit OTP -> Send SMS
     */
    loginStep1(identifier: string, passwordPlain: string, ipAddress?: string): Promise<{
        challengeId: string;
        maskedPhone: string;
        expiresInSeconds: number;
        fullName: string;
        username: string;
        devOtp: string | undefined;
    }>;
    /**
     * Step 2: Verify 6-digit OTP -> Create authenticated Session & JWT token
     */
    verifyOtp(challengeId: string, otpInput: string, rememberDevice?: boolean, ipAddress?: string, userAgent?: string): Promise<{
        token: string;
        expiresAt: Date;
        user: {
            id: string;
            username: string;
            fullName: string;
            email: string;
            phoneNumber: string;
            role: string;
            districtId: string | null;
            permissions: PermissionType[];
        };
    }>;
    /**
     * Resend OTP for active challenge
     */
    resendOtp(challengeId: string, ipAddress?: string): Promise<{
        challengeId: string;
        expiresInSeconds: number;
        devOtp: string | undefined;
    }>;
    /**
     * Logout and invalidate session
     */
    logout(sessionToken?: string, userId?: string, ipAddress?: string): Promise<{
        message: string;
    }>;
}
export declare const authService: AuthService;
