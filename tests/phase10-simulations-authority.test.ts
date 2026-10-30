import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/database.js';

const app = createApp();
const createdUsers: string[] = [];
const createdSessions: string[] = [];
let districtId: string;
let directorToken: string;
let operatorToken: string;

async function createStaffWithRole(role: 'EOC_DIRECTOR' | 'DATA_OPERATOR') {
  const username = `phase10-${role.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`;
  const user = await prisma.staffUser.create({
    data: {
      username,
      fullName: `Phase 10 ${role}`,
      email: `${username}@example.invalid`,
      phoneNumber: '+919988112233',
      passwordHash: 'not-used',
      role,
      districtId,
      isActive: true,
    },
  });
  createdUsers.push(user.id);
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.staffSession.create({ data: { staffUserId: user.id, sessionToken, expiresAt } });
  createdSessions.push(sessionToken);
  return jwt.sign({ userId: user.id, username, role, districtId, sessionToken }, env.JWT_SECRET, { expiresIn: '1h' });
}

beforeAll(async () => {
  const district = await prisma.district.findFirst();
  if (!district) throw new Error('Requires seeded district');
  districtId = district.id;

  directorToken = await createStaffWithRole('EOC_DIRECTOR');
  operatorToken = await createStaffWithRole('DATA_OPERATOR');
});

afterAll(async () => {
  await prisma.staffSession.deleteMany({ where: { sessionToken: { in: createdSessions } } });
  await prisma.auditLog.deleteMany({ where: { staffUserId: { in: createdUsers } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: createdUsers } } });
  await prisma.simulationScenario.deleteMany({ where: { name: { startsWith: '[SIMULATION] Phase 10' } } });
});

describe('Phase 10 — Simulations, Staff Tools, Analytics & Transparency', () => {
  let createdSimId: string;

  it('1. Disaster Simulations: Rule-based multi-hazard modeling with strict non-destructive isolation', async () => {
    // Floods simulation
    const floodRes = await request(app)
      .post('/api/v1/authority/simulations')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        name: 'Phase 10 Urban Flood Breach Test',
        disasterType: 'FLOOD',
        severity: 'SEVERE',
        districtId,
        affectedAreaNames: ['Sector 4 Bellandur', 'Ward 174 Agrahara'],
        scenarioParameters: {
          rainfallMmPerHour: 95,
          damReleaseCusecs: 28000,
          blockedCorridors: ['Route 4 - Bellandur Causeway Bypass (Ch. 14+200)'],
          inducedStockDeficitLiters: 4000,
          targetDepotName: 'Depot A - Domlur Central',
        },
      });

    expect(floodRes.status).toBe(200);
    expect(floodRes.body.success).toBe(true);
    expect(floodRes.body.data.isSimulated).toBe(true);
    expect(floodRes.body.data.safetyNotice).toContain('NON-DESTRUCTIVE SIMULATION');
    expect(floodRes.body.data.estimatedImpact.affectedPopulation).toBeGreaterThan(0);
    expect(floodRes.body.data.estimatedImpact.vulnerableIndividuals.infants).toBeGreaterThan(0);
    expect(floodRes.body.data.estimatedImpact.vulnerableIndividuals.elderly).toBeGreaterThan(0);
    expect(floodRes.body.data.estimatedImpact.blockedTransitCorridors.length).toBe(1);
    expect(floodRes.body.data.estimatedImpact.blockedTransitCorridors[0].status).toBe('BLOCKED_SIMULATED');
    expect(floodRes.body.data.resourceRequirements.potableWaterLiters).toBeGreaterThan(0);
    expect(floodRes.body.data.resourceRequirements.recommendedInterDepotTransfers.length).toBeGreaterThan(0);
    expect(floodRes.body.data.summaryNarrative).toContain('[SIMULATION ONLY — NOT LIVE DISASTER DATA]');

    createdSimId = floodRes.body.data.simulationId;

    // Verify simulation did NOT publish any live alert or incident
    const liveAlerts = await prisma.disasterAlert.findMany({
      where: { title: { contains: 'Phase 10 Urban Flood Breach Test' } },
    });
    expect(liveAlerts.length).toBe(0);

    // Cyclone simulation
    const cycloneRes = await request(app)
      .post('/api/v1/authority/simulations')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        name: 'Phase 10 Super Cyclone Bay Test',
        disasterType: 'CYCLONE',
        severity: 'CATASTROPHIC',
        districtId,
        affectedAreaNames: ['Coastal Belt A', 'Port Zone B'],
        scenarioParameters: {
          windSpeedKmph: 185,
        },
      });

    expect(cycloneRes.status).toBe(200);
    expect(cycloneRes.body.data.disasterType).toBe('CYCLONE');
    expect(cycloneRes.body.data.estimatedImpact.predictedInundatedKm2).toBeGreaterThan(0);

    // List simulations
    const listRes = await request(app)
      .get('/api/v1/authority/simulations')
      .set('Authorization', `Bearer ${directorToken}`);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.data)).toBe(true);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('2. Role Restrictions & RBAC: Operators cannot execute simulations or manage staff', async () => {
    // Attempt simulation as DATA_OPERATOR (missing SIMULATION_RUN permission)
    const simRes = await request(app)
      .post('/api/v1/authority/simulations')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        name: 'Unauthorized Sim Attempt',
        disasterType: 'FLOOD',
        severity: 'MODERATE',
        affectedAreaNames: ['Area 1'],
      });

    expect(simRes.status).toBe(403);
    expect(simRes.body.error.code).toBe('PERMISSION_DENIED');

    // Attempt staff management as DATA_OPERATOR (missing STAFF_MANAGE permission)
    const staffRes = await request(app)
      .get('/api/v1/authority/staff')
      .set('Authorization', `Bearer ${operatorToken}`);

    expect(staffRes.status).toBe(403);
  });

  it('3. Staff Tools: User creation, role assignments, and audit logging', async () => {
    const newUsername = `staff-p10-${crypto.randomUUID().slice(0, 8)}`;
    const createRes = await request(app)
      .post('/api/v1/authority/staff')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        username: newUsername,
        fullName: 'Field Logistics Commander',
        email: `${newUsername}@disasterready.gov.in`,
        phoneNumber: '+919876543210',
        password: 'SecurePassword123!',
        role: 'LOGISTICS_OFFICER',
        districtId,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.role).toBe('LOGISTICS_OFFICER');
    expect(createRes.body.data.permissions).toContain('inventory:allocate');
    expect(createRes.body.data.permissions).not.toContain('simulation:run');

    const createdStaffId = createRes.body.data.id;
    createdUsers.push(createdStaffId);

    // Update staff role and status
    const updateRes = await request(app)
      .patch(`/api/v1/authority/staff/${createdStaffId}`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        role: 'FIELD_COMMANDER',
        isActive: true,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.role).toBe('FIELD_COMMANDER');

    // Inspect staff activity audit history
    const historyRes = await request(app)
      .get(`/api/v1/authority/staff/${createdStaffId}/history`)
      .set('Authorization', `Bearer ${directorToken}`);

    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body.data)).toBe(true);
    expect(historyRes.body.data.length).toBeGreaterThan(0);
    expect(historyRes.body.data[0].action).toBe('CREATE_STAFF_ACCOUNT');
  });

  it('4. Real Database Analytics: Live metrics calculated from production records without fake data', async () => {
    const res = await request(app)
      .get(`/api/v1/authority/analytics/summary?districtId=${districtId}`)
      .set('Authorization', `Bearer ${directorToken}`);

    if (res.status !== 200) console.error('ANALYTICS ERROR BODY:', res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isRealDatabaseCalculated).toBe(true);
    expect(res.body.data.isDemoData).toBe(false);
    expect(res.body.data.incidents).toBeDefined();
    expect(res.body.data.incidents.bySeverity).toBeDefined();
    expect(res.body.data.reliefRequests).toBeDefined();
    expect(res.body.data.inventory).toBeDefined();
    expect(res.body.data.facilities).toBeDefined();
  });

  it('5. Public Transparency Portal: Civic metrics, zero-PII ledger, and official data sources', async () => {
    const res = await request(app).get(`/api/v1/authority/transparency/portal?districtId=${districtId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.zeroPiiEnforced).toBe(true);
    expect(res.body.data.officialDataSources.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.civicMetrics).toBeDefined();
    expect(Array.isArray(res.body.data.immutableAuditLedger)).toBe(true);
    expect(Array.isArray(res.body.data.areaWiseReliefLedger)).toBe(true);

    // Verify zero PII in area-wise records
    res.body.data.areaWiseReliefLedger.forEach((area: any) => {
      expect(area.areaName).toBeDefined();
      expect(area.totalRequests).toBeDefined();
      expect(area.phone).toBeUndefined();
      expect(area.aadhaar).toBeUndefined();
      expect(area.requesterName).toBeUndefined();
    });
  });

  it('6. Multilingual Broadcasts: Retain original official English source alongside all 12 Indian languages', async () => {
    const sourceText =
      'URGENT RELIEF NOTICE: Heavy rainfall warning. Drinking water distribution active at community center. Emergency SOS: Dial 112.';

    const res = await request(app)
      .post('/api/v1/authority/announcements/translate')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        sourceText,
        sourceLanguage: 'en',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.originalText).toBe(sourceText);
    expect(res.body.data.retainedOfficialSource).toContain(sourceText);
    expect(res.body.data.complianceNotice).toContain('CRITICAL SAFETY POLICY');

    const translations = res.body.data.translations;
    expect(translations.length).toBe(12);

    const langCodes = translations.map((t: any) => t.languageCode);
    const expectedLangs = ['en', 'hi', 'kn', 'ta', 'te', 'ml', 'mr', 'bn', 'gu', 'or', 'pa', 'as'];
    expectedLangs.forEach((code) => expect(langCodes).toContain(code));

    // Verify reviewed translations for critical terms
    const hindi = translations.find((t: any) => t.languageCode === 'hi');
    expect(hindi.translatedText).toContain('112 पर डायल करें');
    expect(hindi.isReviewedOfficial).toBe(true);

    const kannada = translations.find((t: any) => t.languageCode === 'kn');
    expect(kannada.translatedText).toContain('112 ಗೆ ಕರೆ ಮಾಡಿ');
    expect(kannada.isReviewedOfficial).toBe(true);
  });
});
