import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Healthcheck API Endpoints', () => {
  const app = createApp();

  it('GET /api/v1/health should return 200 and operational status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('ONLINE');
  });

  it('GET /api/v1/health/database should connect to PostgreSQL & PostGIS', async () => {
    const res = await request(app).get('/api/v1/health/database');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.database).toBe('PostgreSQL 16');
  });

  it('GET /api/v1/health/services should report both DB and Redis as healthy', async () => {
    const res = await request(app).get('/api/v1/health/services');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.services.database.status).toBe('HEALTHY');
    expect(res.body.services.redis.status).toBe('HEALTHY');
  });
});
