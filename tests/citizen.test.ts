/**
 * Phase 4 — Complete Citizen Services Integration Test Suite
 * DisasterReady India
 *
 * Covers all public citizen endpoints:
 * - Geo / location onboarding
 * - Dashboard
 * - Alerts & Announcements
 * - Hazard map & reporting
 * - Facilities / Shelters & Hospitals
 * - Preparedness guides
 * - Relief request creation & tracking
 * - SOS logging
 *
 * NO login or authentication is required for any of these endpoints.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

// ============================================================================
// Screen 01 — Language & Location Onboarding
// ============================================================================
describe('Screen 01 — Language & Location Onboarding', () => {
  it('GET /api/v1/geo/reverse-geocode should return district, state and coordinates', async () => {
    const res = await request(app).get('/api/v1/geo/reverse-geocode?lat=28.6139&lng=77.2090');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.district).toBeDefined();
    expect(res.body.data.state).toBeDefined();
    expect(res.body.data.coordinates.lat).toBe(28.6139);
    expect(res.body.data.coordinates.lng).toBe(77.209);
  });

  it('GET /api/v1/geo/reverse-geocode with invalid coords returns 400', async () => {
    const res = await request(app).get('/api/v1/geo/reverse-geocode?lat=abc&lng=xyz');
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/geo/districts?q=Delhi should return matching districts', async () => {
    const res = await request(app).get('/api/v1/geo/districts?q=Delhi');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].name).toBeDefined();
    expect(res.body.data[0].state).toBeDefined();
  });

  it('GET /api/v1/geo/districts?q=x (single char) returns empty array', async () => {
    const res = await request(app).get('/api/v1/geo/districts?q=x');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });
});

// ============================================================================
// Screen 02 — Citizen Dashboard
// ============================================================================
describe('Screen 02 — Citizen Dashboard', () => {
  it('GET /api/v1/dashboard should return aggregated data structure', async () => {
    const res = await request(app).get('/api/v1/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { data } = res.body;
    expect(data.meta).toBeDefined();
    expect(data.meta.disclaimer).toBeDefined();
    expect(data.summary).toBeDefined();
    expect(data.summary.operationalShelterCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.alerts)).toBe(true);
    expect(Array.isArray(data.recentHazards)).toBe(true);
    expect(Array.isArray(data.nearestShelters)).toBe(true);
    expect(Array.isArray(data.announcements)).toBe(true);
  });

  it('GET /api/v1/dashboard includes at least one active alert in seeded data', async () => {
    const res = await request(app).get('/api/v1/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.alerts.length).toBeGreaterThan(0);
    expect(res.body.data.alerts[0].severity).toBeDefined();
    expect(res.body.data.alerts[0].freshness).toBeDefined();
  });
});

// ============================================================================
// Alerts & Announcements
// ============================================================================
describe('Alerts & Announcements', () => {
  it('GET /api/v1/alerts/active returns official active alerts with freshness', async () => {
    const res = await request(app).get('/api/v1/alerts/active');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    const alert = res.body.data[0];
    expect(alert.title).toBeDefined();
    expect(alert.severity).toBeDefined();
    expect(alert.instructions).toBeDefined();
    expect(alert.sourceAgency).toBeDefined();
    expect(alert.freshness).toBeDefined();
  });

  it('GET /api/v1/announcements returns announcement feed', async () => {
    const res = await request(app).get('/api/v1/announcements');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ============================================================================
// Screens 03–05 — Hazard Overview & Map
// ============================================================================
describe('Screens 03–05 — Hazard Map', () => {
  it('GET /api/v1/hazards/spatial returns hazard markers with polygons and classification', async () => {
    const res = await request(app).get('/api/v1/hazards/spatial');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const hazard = res.body.data[0];
    expect(hazard.coordinates.lat).toBeDefined();
    expect(hazard.coordinates.lng).toBeDefined();
    expect(hazard.hazardType).toBeDefined();
    expect(hazard.reportCategory).toBeDefined(); // 'OFFICIAL_VERIFIED', 'COMMUNITY_VERIFIED', etc.
    expect(hazard.polygons).toBeDefined();
    expect(Array.isArray(hazard.polygons)).toBe(true);
    expect(hazard.disclaimer).toBeDefined(); // Safety disclaimer always present
    expect(hazard.freshness).toBeDefined();
  });

  it('GET /api/v1/hazards/spatial?hazardType=WATERLOGGING filters by type', async () => {
    const res = await request(app).get('/api/v1/hazards/spatial?hazardType=WATERLOGGING');
    expect(res.status).toBe(200);
    res.body.data.forEach((h: { hazardType: string }) => {
      expect(h.hazardType).toBe('WATERLOGGING');
    });
  });
});

describe('Phase 5 — Route provider contract', () => {
  it('POST /api/v1/routes/compare rejects identical locations', async () => {
    const res = await request(app).post('/api/v1/routes/compare').send({
      origin: { lat: 12.9, lng: 77.6 },
      destination: { lat: 12.9, lng: 77.6 },
      travelMode: 'WALK',
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/routes/compare refuses to fabricate routes without a provider key', async () => {
    const res = await request(app).post('/api/v1/routes/compare').send({
      origin: { lat: 12.9, lng: 77.6 },
      destination: { lat: 12.91, lng: 77.61 },
      travelMode: 'WALK',
    });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('ROUTES_NOT_CONFIGURED');
  });

  it('GET /api/v1/maps/config does not expose a server credential', async () => {
    const res = await request(app).get('/api/v1/maps/config');
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.data.browserApiKey).not.toBe(process.env.GOOGLE_MAPS_API_KEY);
    }
  });

  it('GET /api/v1/geo/search returns an empty list for too-short queries without a provider call', async () => {
    const res = await request(app).get('/api/v1/geo/search?q=ab');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('POST /api/v1/routes/check-risk rejects incomplete route geometry', async () => {
    const res = await request(app).post('/api/v1/routes/check-risk').send({
      coordinates: [{ lat: 12.9, lng: 77.6 }],
    });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Screen 06 — Hazard Reporting
// ============================================================================
describe('Screen 06 — Citizen Hazard Reporting', () => {
  it('POST /api/v1/hazards/report submits new hazard and returns UNVERIFIED status', async () => {
    const latitude = 10 + Math.random() * 20;
    const longitude = 70 + Math.random() * 20;
    const res = await request(app).post('/api/v1/hazards/report').send({
      hazardType: 'FALLEN_TREE',
      severity: 'MODERATE',
      latitude,
      longitude,
      addressLandmark: 'Chandni Chowk, Near Lal Qila',
      description: 'Large tree blocks both lanes.',
      observationTime: new Date().toISOString(),
      contactInfo: '+919876543210',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UNVERIFIED');
    expect(res.body.data.incidentId).toBeDefined();
    expect(res.body.data.isDuplicate).toBe(false);

    const saved = await (await import('../src/shared/database.js')).prisma.hazardIncident.findUnique({
      where: { id: res.body.data.incidentId },
      include: { evidence: true },
    });
    expect(saved?.description).toBe('Large tree blocks both lanes.');
    expect(saved?.observedAt).toBeInstanceOf(Date);
    expect(saved?.contactInfo).toBe('+919876543210');
  });

  it('POST /api/v1/hazards/report with invalid hazardType returns validation error', async () => {
    const res = await request(app).post('/api/v1/hazards/report').send({
      hazardType: 'ALIEN_INVASION',
      severity: 'MODERATE',
      latitude: 28.62,
      longitude: 77.21,
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/hazards/report duplicate detection: second identical report returns DUPLICATE_PENDING', async () => {
    const payload = {
      hazardType: 'WATERLOGGING',
      severity: 'SEVERE',
      latitude: 28.6321,
      longitude: 77.2185,
      addressLandmark: 'Near Minto Bridge Underpass',
      waterDepthCm: 90,
    };

    // First submission
    await request(app).post('/api/v1/hazards/report').send(payload);

    // Second nearly identical submission within 30 min → should flag as duplicate
    const res = await request(app).post('/api/v1/hazards/report').send(payload);
    expect(res.status).toBe(200); // 200 for duplicate (not 201 created)
    expect(res.body.data.status).toBe('DUPLICATE_PENDING');
    expect(res.body.data.isDuplicate).toBe(true);
  });
});

// ============================================================================
// Screen 07 — Shelters & Hospitals
// ============================================================================
describe('Screen 07 — Safe Places Directory', () => {
  it('GET /api/v1/facilities returns verified shelters with distance and services', async () => {
    const res = await request(app).get('/api/v1/facilities?lat=28.6139&lng=77.2090&facilityType=SHELTER');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const f = res.body.data[0];
    expect(f.availableBeds).toBeGreaterThanOrEqual(0);
    expect(f.distanceKm).toBeDefined();
    expect(f.services).toBeDefined();
    expect(f.services.medical).toBeDefined();
    expect(f.services.generatorPower).toBeDefined();
    expect(f.source).toBeDefined(); // Always clarifies source of data
  });

  it('GET /api/v1/facilities?facilityType=HOSPITAL returns hospitals', async () => {
    const res = await request(app).get('/api/v1/facilities?lat=28.6139&lng=77.2090&facilityType=HOSPITAL');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((f: { facilityType: string }) => {
      expect(f.facilityType).toBe('HOSPITAL');
    });
  });

  it('GET /api/v1/facilities?hasMedical=true filters by medical support', async () => {
    const res = await request(app).get('/api/v1/facilities?hasMedical=true');
    expect(res.status).toBe(200);
    res.body.data.forEach((f: { services: { medical: boolean } }) => {
      expect(f.services.medical).toBe(true);
    });
  });

  it('GET /api/v1/facilities rejects invalid or partial coordinates', async () => {
    const invalidRange = await request(app).get('/api/v1/facilities?lat=91&lng=77');
    expect(invalidRange.status).toBe(400);
    const partialPair = await request(app).get('/api/v1/facilities?lat=28.6');
    expect(partialPair.status).toBe(400);
  });

  it('Facilities are sorted nearest-first by distance', async () => {
    const res = await request(app).get('/api/v1/facilities?lat=28.6139&lng=77.2090');
    expect(res.status).toBe(200);
    const distances: number[] = res.body.data.map((f: { distanceKm: number }) => f.distanceKm);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });
});

// ============================================================================
// Screen 11 — Disaster Preparedness
// ============================================================================
describe('Screen 11 — Preparedness Guides', () => {
  it('GET /api/v1/preparedness/guides returns all guides', async () => {
    const res = await request(app).get('/api/v1/preparedness/guides');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/preparedness/guides?disasterType=FLOOD returns FLOOD guide with goBag checklist', async () => {
    const res = await request(app).get('/api/v1/preparedness/guides?disasterType=FLOOD');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    const guide = res.body.data[0];
    expect(guide.disasterType).toBe('FLOOD');
    expect(guide.sections.goBag).toBeDefined();
    expect(Array.isArray(guide.sections.goBag)).toBe(true);
    expect(guide.sections.goBag.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/preparedness/guides?disasterType=CYCLONE returns CYCLONE guide', async () => {
    const res = await request(app).get('/api/v1/preparedness/guides?disasterType=CYCLONE');
    expect(res.status).toBe(200);
    expect(res.body.data[0].disasterType).toBe('CYCLONE');
  });
});

// ============================================================================
// Screens 08–10 — Relief Requests & Tracking
// ============================================================================
describe('Screens 08–10 — Relief Request Submission & Tracking', () => {
  let createdToken: string;

  it('POST /api/v1/relief-requests creates anonymous request and returns tracking token', async () => {
    const res = await request(app).post('/api/v1/relief-requests').send({
      headcountAdults: 3,
      headcountChildren: 1,
      headcountInfants: 0,
      headcountSeniors: 1,
      deliveryContext: 'ROOFTOP_STRANDED',
      urgencyLevel: 'HIGH',
      latitude: 28.6501,
      longitude: 77.2301,
      landmarkNotes: 'Three-storey orange building near Jama Masjid East Gate',
      itemsRequested: {
        drinkingWater: true,
        foodKits: 4,
        babyFormula: false,
        firstAidKit: true,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingToken).toBeDefined();
    expect(res.body.data.trackingToken).toMatch(/^DR-[A-Za-z0-9_-]{43}$/);
    expect(res.body.data.stage).toBe('STAGE_1_TRIAGED');
    expect(res.body.data.estimatedResponseMinutes).toBe(60);

    createdToken = res.body.data.trackingToken;
  });

  it('GET /api/v1/relief-requests/track/:token tracks the newly created request', async () => {
    if (!createdToken) {
      console.warn('Skipping — creation test failed to produce token');
      return;
    }
    const res = await request(app).get(`/api/v1/relief-requests/track/${createdToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingToken).toBe(createdToken);
    expect(res.body.data.stage).toBe('STAGE_1_TRIAGED');
    expect(res.body.data.stageLabel).toBeDefined();
    expect(res.body.data.headcount.total).toBe(5); // 3+1+0+1
    expect(Array.isArray(res.body.data.timeline)).toBe(true);
  });

  it('GET /api/v1/relief-requests/track rejects legacy predictable tokens', async () => {
    const res = await request(app).get('/api/v1/relief-requests/track/RELIEF-IN-8492-XQ7');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN_FORMAT');
  });

  it('GET /api/v1/relief-requests/track/INVALID-TOKEN-FORMAT returns 400', async () => {
    const res = await request(app).get('/api/v1/relief-requests/track/NOT-A-VALID-TOKEN');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN_FORMAT');
  });

  it('GET /api/v1/relief-requests/track/:token returns 404 for an unknown high-entropy token', async () => {
    const res = await request(app).get(`/api/v1/relief-requests/track/DR-${'A'.repeat(43)}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TOKEN_NOT_FOUND');
  });

  it('POST /api/v1/relief-requests with invalid body returns 400', async () => {
    const res = await request(app).post('/api/v1/relief-requests').send({
      // Missing required fields
      headcountAdults: 'not-a-number',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ============================================================================
// Screen 12 — SOS & Emergency Help
// ============================================================================
describe('Screen 12 — SOS Logging', () => {
  it('POST /api/v1/sos logs SOS intent and returns emergency numbers', async () => {
    const res = await request(app).post('/api/v1/sos').send({
      serviceType: '112_NATIONAL',
      latitude: 28.6139,
      longitude: 77.209,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sosId).toBeDefined();
    expect(res.body.data.status).toBe('LOGGED');
    expect(res.body.data.emergency_numbers['112']).toBeDefined();
    expect(res.body.data.emergency_numbers['1078']).toBeDefined();
  });

  it('POST /api/v1/sos without location coordinates still logs successfully', async () => {
    const res = await request(app).post('/api/v1/sos').send({
      serviceType: '108_AMBULANCE',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.serviceType).toBe('108_AMBULANCE');
  });

  it('POST /api/v1/sos with invalid service type returns 400', async () => {
    const res = await request(app).post('/api/v1/sos').send({
      serviceType: 'FAKE_SERVICE',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
