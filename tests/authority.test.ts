import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/database.js';

const app = createApp();
const createdUsers: string[] = [];
const createdSessions: string[] = [];
let districtId: string;
let directorToken: string;
let operatorToken: string;

async function createAuthoritySession(role: 'EOC_DIRECTOR' | 'DATA_OPERATOR') {
  const username = `authority-test-${role.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`;
  const user = await prisma.staffUser.create({
    data: {
      username,
      fullName: `Test ${role}`,
      email: `${username}@example.invalid`,
      phoneNumber: '+919999000001',
      passwordHash: 'not-used-by-session-fixture',
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
  if (!district) throw new Error('Authority integration tests require a seeded district.');
  districtId = district.id;
  directorToken = await createAuthoritySession('EOC_DIRECTOR');
  operatorToken = await createAuthoritySession('DATA_OPERATOR');
});

afterAll(async () => {
  await prisma.staffSession.deleteMany({ where: { sessionToken: { in: createdSessions } } });
  await prisma.auditLog.deleteMany({ where: { staffUserId: { in: createdUsers } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: createdUsers } } });
});

describe('Authority dashboard and RBAC', () => {
  it('rejects anonymous access to the operations dashboard', async () => {
    const response = await request(app).get('/api/v1/authority/dashboard');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns live database dashboard metrics only to an authenticated role', async () => {
    const response = await request(app).get('/api/v1/authority/dashboard').set('Authorization', `Bearer ${directorToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.metrics.activeIncidents).toEqual(expect.any(Number));
    expect(response.body.data.metrics.pendingReports).toEqual(expect.any(Number));
    expect(response.body.data.metrics.criticalAlerts).toEqual(expect.any(Number));
    expect(response.body.data.fetchedAt).toBeDefined();
  });

  it('denies hazard verification to roles without hazards:verify', async () => {
    const response = await request(app).get('/api/v1/authority/hazards').set('Authorization', `Bearer ${operatorToken}`);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('denies facility mutations to roles without facilities:manage', async () => {
    const response = await request(app)
      .patch(`/api/v1/authority/facilities/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ operatingStatus: 'UNKNOWN' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('requires an audit reason before accepting a hazard decision', async () => {
    const response = await request(app)
      .patch(`/api/v1/authority/hazards/${crypto.randomUUID()}/decision`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ decision: 'VERIFY', reason: 'no' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('prevents a non-super-admin from granting the super-admin role', async () => {
    const response = await request(app)
      .post('/api/v1/authority/staff')
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        username: `escalation-${crypto.randomUUID().slice(0, 8)}`,
        fullName: 'Privilege Escalation Test',
        email: `${crypto.randomUUID()}@example.invalid`,
        phoneNumber: '+919999000002',
        password: 'a-long-test-password-123',
        role: 'SUPER_ADMIN',
        districtId,
      });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ROLE_ESCALATION_DENIED');
  });

  it('requires explicit publication confirmation and exposes supplied translations to citizens', async () => {
    const alertBody = {
      districtId,
      title: 'Authority test flood advisory',
      severity: 'WARNING',
      disasterType: 'FLOOD',
      summary: 'Water levels are rising in the test area.',
      instructions: 'Avoid low-lying roads and follow official directions.',
      sourceAgency: 'District EOC',
      publish: true,
      translations: { hi: { title: 'बाढ़ चेतावनी', summary: 'जलस्तर बढ़ रहा है।', instructions: 'नीचे वाली सड़कों से बचें।' } },
    };
    const missingConfirmation = await request(app).post('/api/v1/authority/alerts').set('Authorization', `Bearer ${directorToken}`).send(alertBody);
    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body.error.code).toBe('PUBLISH_CONFIRMATION_REQUIRED');

    const created = await request(app).post('/api/v1/authority/alerts').set('Authorization', `Bearer ${directorToken}`).send({ ...alertBody, confirmationText: 'PUBLISH' });
    expect(created.status).toBe(201);
    try {
      const citizenAlerts = await request(app).get(`/api/v1/alerts/active?districtId=${districtId}`);
      expect(citizenAlerts.status).toBe(200);
      expect(citizenAlerts.body.data.find((alert: { id: string }) => alert.id === created.body.data.id).translations.hi.title).toBe('बाढ़ चेतावनी');
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityType: 'DisasterAlert', entityId: created.body.data.id } });
      await prisma.disasterAlert.delete({ where: { id: created.body.data.id } });
    }
  });
});

describe('Authority hazard verification', () => {
  it('verifies a pending citizen report and records the decision in the audit log', async () => {
    const incidentId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO hazard_incidents (id, district_id, hazard_type, severity, latitude, longitude, status, reported_by_citizen, water_depth_cm)
      VALUES (${incidentId}, ${districtId}, 'FALLEN_TREE', 'MODERATE', 12.9716, 77.5946, 'UNVERIFIED', true, 0)
    `;
    try {
      const response = await request(app)
        .patch(`/api/v1/authority/hazards/${incidentId}/decision`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ decision: 'VERIFY', reason: 'Field team confirmed the blocked road and location.' });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.data.status).toBe('VERIFIED_ACTIVE');
      const saved = await prisma.hazardIncident.findUnique({ where: { id: incidentId }, select: { status: true, verifiedByStaffId: true, verifiedAt: true } });
      expect(saved?.status).toBe('VERIFIED_ACTIVE');
      expect(saved?.verifiedByStaffId).toBeDefined();
      const audit = await prisma.auditLog.findFirst({ where: { entityType: 'HazardIncident', entityId: incidentId, action: 'VERIFY_HAZARD' } });
      expect(audit?.metadata).toMatchObject({ reason: 'Field team confirmed the blocked road and location.' });
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityType: 'HazardIncident', entityId: incidentId } });
      await prisma.$executeRaw`DELETE FROM hazard_incidents WHERE id = ${incidentId}`;
    }
  });

  it('does not allow district staff to verify an incident assigned to another district', async () => {
    const otherDistrict = await prisma.district.findFirst({ where: { id: { not: districtId } } });
    if (!otherDistrict) return;
    const incidentId = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO hazard_incidents (id, district_id, hazard_type, severity, latitude, longitude, status, reported_by_citizen, water_depth_cm)
      VALUES (${incidentId}, ${otherDistrict.id}, 'FALLEN_TREE', 'LOW', 13.0, 77.7, 'UNVERIFIED', true, 0)
    `;
    try {
      const response = await request(app)
        .patch(`/api/v1/authority/hazards/${incidentId}/decision`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ decision: 'VERIFY', reason: 'Field team independently inspected this report.' });
      expect(response.status).toBe(404);
      expect((await prisma.hazardIncident.findUnique({ where: { id: incidentId }, select: { status: true } }))?.status).toBe('UNVERIFIED');
    } finally {
      await prisma.$executeRaw`DELETE FROM hazard_incidents WHERE id = ${incidentId}`;
    }
  });

  it('reserves depot stock and advances a verified relief request in one audited allocation', async () => {
    const depot = await prisma.reliefDepot.create({ data: {
      districtId,
      name: `Authority test depot ${crypto.randomUUID().slice(0, 8)}`,
      latitude: 12.9716,
      longitude: 77.5946,
      contactPhone: '+919999000003',
      isOperational: true,
    } });
    const stock = await prisma.depotInventory.create({ data: {
      depotId: depot.id,
      itemSku: 'WATER_20L',
      itemName: 'Test water packs',
      quantityAvailable: 10,
      quantityReserved: 0,
      unit: 'packs',
    } });
    const relief = await prisma.reliefRequest.create({ data: {
      trackingToken: `DR-${crypto.randomBytes(32).toString('base64url')}`,
      districtId,
      headcountAdults: 2,
      headcountChildren: 0,
      headcountInfants: 0,
      headcountSeniors: 0,
      deliveryContext: 'ROOFTOP_STRANDED',
      urgencyLevel: 'HIGH',
      latitude: 12.9716,
      longitude: 77.5946,
      itemsRequested: { drinkingWater: true, foodKits: 0 },
      stage: 'STAGE_2_VERIFIED',
    } });
    try {
      const response = await request(app)
        .post(`/api/v1/authority/relief-requests/${relief.id}/allocate`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ depotId: depot.id, allocations: [{ itemSku: stock.itemSku, quantity: 1 }], notes: 'Reserved supplies for verified request.' });
      expect(response.status).toBe(200);
      expect(response.body.data.request.stage).toBe('STAGE_3_ALLOCATED');
      const updatedStock = await prisma.depotInventory.findUnique({ where: { id: stock.id } });
      expect(updatedStock?.quantityReserved).toBe(1);
      const audit = await prisma.auditLog.findFirst({ where: { entityType: 'ReliefRequest', entityId: relief.id, action: 'ALLOCATE_RELIEF_REQUEST' } });
      expect(audit?.metadata).toMatchObject({ depotId: depot.id });
    } finally {
      await prisma.requestAuditLog.deleteMany({ where: { requestId: relief.id } });
      await prisma.auditLog.deleteMany({ where: { entityType: 'ReliefRequest', entityId: relief.id } });
      await prisma.reliefRequest.delete({ where: { id: relief.id } });
      await prisma.depotInventory.delete({ where: { id: stock.id } });
      await prisma.reliefDepot.delete({ where: { id: depot.id } });
    }
  });

  it('marks facility data unknown for authority and citizen views', async () => {
    const facility = await prisma.facility.create({ data: {
      districtId,
      facilityType: 'SHELTER',
      name: `Authority test shelter ${crypto.randomUUID().slice(0, 8)}`,
      address: 'Test ward, near the district office',
      latitude: 12.9716,
      longitude: 77.5946,
      contactPhone: '+919999000004',
      totalCapacity: 100,
      currentOccupancy: 20,
      isVerified: true,
      hasMedicalSupport: false,
      hasGeneratorPower: true,
      hasDrinkingWater: true,
      hasInfantCare: false,
      isPetFriendly: false,
      operatingStatus: 'OPERATIONAL',
    } });
    try {
      const update = await request(app)
        .patch(`/api/v1/authority/facilities/${facility.id}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({ markUnknown: ['totalCapacity', 'currentOccupancy', 'contactPhone'] });
      expect(update.status).toBe(200);
      const citizenFacilities = await request(app).get(`/api/v1/facilities?districtId=${districtId}`);
      expect(citizenFacilities.status).toBe(200);
      const result = citizenFacilities.body.data.find((item: { id: string }) => item.id === facility.id);
      expect(result.contactPhone).toBeNull();
      expect(result.availableBeds).toBeNull();
      expect(result.dataQuality.unknownFields).toContain('totalCapacity');
    } finally {
      await prisma.auditLog.deleteMany({ where: { entityType: 'Facility', entityId: facility.id } });
      await prisma.facility.delete({ where: { id: facility.id } });
    }
  });
});
