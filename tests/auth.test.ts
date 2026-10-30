import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/shared/database.js';

describe('Staff 2FA Authentication Flow', () => {
  const app = createApp();

  it('Step 1: should reject invalid username/password', async () => {
    const res = await request(app).post('/api/v1/auth/login-step1').send({
      identifier: 'nonexistent@demo.in',
      password: 'WrongPassword123',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('Step 1: should verify valid credentials and generate OTP challenge', async () => {
    const res = await request(app).post('/api/v1/auth/login-step1').send({
      identifier: 'EOC-DIR-001',
      password: 'Admin@DisasterReady2026!',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.challengeId).toBeDefined();
    expect(res.body.data.maskedPhone).toContain('***');
    expect(res.body.data.devOtp).toMatch(/^\d{6}$/);
  });

  it('Step 2: should reject incorrect 6-digit OTP', async () => {
    // 1. Get challenge
    const step1 = await request(app).post('/api/v1/auth/login-step1').send({
      identifier: 'EOC-DIR-001',
      password: 'Admin@DisasterReady2026!',
    });
    const challengeId = step1.body.data.challengeId;

    // 2. Submit wrong OTP
    const res = await request(app).post('/api/v1/auth/verify-otp').send({
      challengeId,
      otp: '999999',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INCORRECT_OTP');
  });

  it('Step 2: should verify correct OTP, set HttpOnly cookie, and return user profile with permissions', async () => {
    // 1. Get challenge and devOtp
    const step1 = await request(app).post('/api/v1/auth/login-step1').send({
      identifier: 'EOC-DIR-001',
      password: 'Admin@DisasterReady2026!',
    });
    const { challengeId, devOtp } = step1.body.data;

    // 2. Submit valid OTP
    const res = await request(app).post('/api/v1/auth/verify-otp').send({
      challengeId,
      otp: devOtp,
      rememberDevice: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.username).toBe('EOC-DIR-001');
    expect(res.body.data.user.role).toBe('EOC_DIRECTOR');
    expect(res.body.data.user.permissions).toContain('alerts:publish');

    // Verify Set-Cookie header
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toContain('dr_staff_token=');
    expect(cookieStr).toContain('HttpOnly');

    // 3. Test Protected /me endpoint with Bearer token
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.data.token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.username).toBe('EOC-DIR-001');

    // 4. Test Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${res.body.data.token}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // 5. Subsequent access should be revoked
    const revokedRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.data.token}`);

    expect(revokedRes.status).toBe(401);
  });
});
