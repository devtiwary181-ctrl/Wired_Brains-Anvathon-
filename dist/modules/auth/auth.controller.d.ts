import { Request, Response, NextFunction } from 'express';
export declare class AuthController {
    /**
     * Step 1: Submit Username/ID & Password -> Receive Challenge ID
     */
    loginStep1(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Step 2: Submit 6-digit OTP -> Set HttpOnly Cookie & Return User Profile
     */
    verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Resend OTP
     */
    resendOtp(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Get Current Authenticated Profile
     */
    getMe(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * Logout
     */
    logout(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const authController: AuthController;
