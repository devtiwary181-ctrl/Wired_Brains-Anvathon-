import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Public Citizen Services API (Zero-Login)', () => {
  const app = createApp();

  it('GET /api/v1/geo/reverse-geocode should return district and state', async () => {
    const res = await request(app).get('/api/v1/geo/reverse-geocode?lat=28.6139&lng=77.2090');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.district).toBeDefined();
    expect(res.body.data.state).toBeDefined();
  });

  it('GET /api/v1/alerts/active should return official active NDMA alerts', async () => {
    const res = await request(app).get('/api/v1/alerts/active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].title).toBeDefined();
  });

  it('GET /api/v1/hazards/spatial should return hazard points and polygons', async () => {
    const res = await request(app).get('/api/v1/hazards/spatial');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].coordinates.lat).toBeDefined();
    expect(res.body.data[0].polygons).toBeDefined();
  });

  it('POST /api/v1/hazards/report should submit a new pending citizen hazard report', async () => {
    const res = await request(app).post('/api/v1/hazards/report').send({
      hazardType: 'WATERLOGGING',
      severity: 'SEVERE',
      latitude: 28.6321,
      longitude: 77.2185,
      addressLandmark: 'Near Minto Bridge Underpass',
      waterDepthCm: 90,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UNVERIFIED');
    expect(res.body.data.incidentId).toBeDefined();
  });

  it('GET /api/v1/facilities should query nearby operational shelters with PostGIS distances', async () => {
    const res = await request(app).get('/api/v1/facilities?lat=28.6139&lng=77.2090&facilityType=SHELTER');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].availableBeds).toBeGreaterThanOrEqual(0);
    expect(res.body.data[0].distanceKm).toBeDefined();
  });

  it('GET /api/v1/relief-requests/track/:token should return public tracking timeline without login', async () => {
    const res = await request(app).get('/api/v1/relief-requests/track/RELIEF-IN-8492-XQ7');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingToken).toBe('RELIEF-IN-8492-XQ7');
    expect(res.body.data.stage).toBe('STAGE_3_ALLOCATED');
    expect(res.body.data.headcount.total).toBe(8);
  });

  it('GET /api/v1/preparedness/guides should return emergency survival checklists', async () => {
    const res = await request(app).get('/api/v1/preparedness/guides?disasterType=FLOOD');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].sections.goBag).toBeDefined();
  });
});
