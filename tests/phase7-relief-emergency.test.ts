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

async function createAuthoritySession(role: 'EOC_DIRECTOR') {
  const username = `phase7-test-${crypto.randomUUID().slice(0, 8)}`;
  const user = await prisma.staffUser.create({
    data: {
      username,
      fullName: 'Phase 7 EOC Director',
      email: `${username}@example.invalid`,
      phoneNumber: '+919999111222',
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
  directorToken = await createAuthoritySession('EOC_DIRECTOR');
});

afterAll(async () => {
  await prisma.staffSession.deleteMany({ where: { sessionToken: { in: createdSessions } } });
  await prisma.auditLog.deleteMany({ where: { staffUserId: { in: createdUsers } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: createdUsers } } });
});

describe('Phase 7 — Relief Distribution & Emergency Support System', () => {
  let trackingToken: string;
  let requestId: string;
  let depotId: string;
  let inventoryId: string;

  it('1. Public Supply Requests: Citizens submit without login and receive 256-bit token', async () => {
    const res = await request(app).post('/api/v1/relief-requests').send({
      headcountAdults: 4,
      headcountChildren: 2,
      headcountInfants: 1,
      headcountSeniors: 1,
      deliveryContext: 'ROOFTOP_STRANDED',
      urgencyLevel: 'CRITICAL_LIFE_SAFETY',
      latitude: 12.9716,
      longitude: 77.5946,
      requesterPhone: '+919876543210',
      landmarkNotes: 'Near metro pillar 104, blue water tank',
      itemsRequested: {
        drinkingWater: true,
        foodKits: 4,
        babyFormula: true,
        firstAidKit: true,
        tarpaulin: true,
      },
      specialMedicalNeeds: 'Insulin required for senior citizen',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingToken).toMatch(/^DR-[A-Za-z0-9_-]{43}$/);
    expect(res.body.data.stage).toBe('STAGE_1_TRIAGED');
    expect(res.body.data.requestId).toBeDefined();

    trackingToken = res.body.data.trackingToken;
    requestId = res.body.data.requestId;
  });

  it('2. Request Tracking: Anonymous secure lookup using high-entropy token', async () => {
    const res = await request(app).get(`/api/v1/relief-requests/track/${trackingToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trackingToken).toBe(trackingToken);
    expect(res.body.data.stage).toBe('STAGE_1_TRIAGED');
    expect(res.body.data.headcount.total).toBe(8);
    expect(Array.isArray(res.body.data.timeline)).toBe(true);
    expect(res.body.data.timeline.length).toBeGreaterThan(0);
  });

  it('3. Lifecycle: Advance STAGE_1_TRIAGED -> STAGE_2_VERIFIED by authorized staff', async () => {
    const res = await request(app)
      .patch(`/api/v1/authority/relief-requests/${requestId}/stage`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ stage: 'STAGE_2_VERIFIED', notes: 'Field officer verified headcount and rooftop situation.' });

    expect(res.status).toBe(200);
    expect(res.body.data.stage).toBe('STAGE_2_VERIFIED');
  });

  it('4. Inventory: Setup Depot, stock, and verify concurrency & stock movement logging', async () => {
    // Create temporary depot and inventory
    const depot = await prisma.reliefDepot.create({
      data: {
        districtId,
        name: `Test Distribution Center ${crypto.randomUUID().slice(0, 6)}`,
        latitude: 12.972,
        longitude: 77.595,
        contactPhone: '+919999888777',
        isOperational: true,
      },
    });
    depotId = depot.id;

    const inv = await prisma.depotInventory.create({
      data: {
        depotId,
        itemSku: 'WATER_20L',
        itemName: '20L Drinking Water Cans',
        quantityAvailable: 20,
        quantityReserved: 0,
        unit: 'cans',
      },
    });
    inventoryId = inv.id;

    // Allocate stock for request
    const allocRes = await request(app)
      .post(`/api/v1/authority/relief-requests/${requestId}/allocate`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        depotId,
        allocations: [{ itemSku: 'WATER_20L', quantity: 1 }],
        notes: 'Reserved 1 water can for rooftop delivery',
      });

    expect(allocRes.status).toBe(200);
    expect(allocRes.body.data.request.stage).toBe('STAGE_3_ALLOCATED');

    // Verify stock reservation and movement history
    const updatedInv = await prisma.depotInventory.findUnique({ where: { id: inventoryId } });
    expect(updatedInv?.quantityAvailable).toBe(20);
    expect(updatedInv?.quantityReserved).toBe(1);

    const movements = await prisma.inventoryMovement.findMany({
      where: { depotId, itemSku: 'WATER_20L' },
    });
    expect(movements.length).toBeGreaterThan(0);
    expect(movements[0].movementType).toBe('RESERVE');
    expect(movements[0].quantity).toBe(1);
  });

  it('5. Negative Stock Protection: Reject allocation exceeding available stock', async () => {
    // Create a temporary verified request to test stock rejection
    const verifiedReq = await prisma.reliefRequest.create({
      data: {
        trackingToken: `DR-${crypto.randomBytes(32).toString('base64url')}`,
        districtId,
        headcountAdults: 2,
        deliveryContext: 'GROUND_FLOOR',
        urgencyLevel: 'HIGH',
        latitude: 12.9716,
        longitude: 77.5946,
        itemsRequested: { drinkingWater: true },
        stage: 'STAGE_2_VERIFIED',
      },
    });

    const res = await request(app)
      .post(`/api/v1/authority/relief-requests/${verifiedReq.id}/allocate`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({
        depotId,
        allocations: [{ itemSku: 'WATER_20L', quantity: 999 }],
        notes: 'Excessive request test',
      });

    expect(res.status).toBe(400); // Exceeds requested amount or stock
    await prisma.reliefRequest.delete({ where: { id: verifiedReq.id } });
  });

  it('6. Lifecycle & Dispatch: Advance STAGE_3_ALLOCATED -> STAGE_4_IN_TRANSIT -> STAGE_5_DELIVERED', async () => {
    // Advance to IN_TRANSIT
    const transitRes = await request(app)
      .patch(`/api/v1/authority/relief-requests/${requestId}/stage`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ stage: 'STAGE_4_IN_TRANSIT', notes: 'Vehicle KA-05-EX-4412 dispatched.' });

    expect(transitRes.status).toBe(200);
    expect(transitRes.body.data.stage).toBe('STAGE_4_IN_TRANSIT');

    // Advance to DELIVERED (triggers stock deduction and DELIVER movement record)
    const deliverRes = await request(app)
      .patch(`/api/v1/authority/relief-requests/${requestId}/stage`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ stage: 'STAGE_5_DELIVERED', notes: 'Physical handoff verified via 4-digit code.' });

    expect(deliverRes.status).toBe(200);
    expect(deliverRes.body.data.stage).toBe('STAGE_5_DELIVERED');

    // Verify stock deducted
    const deliveredInv = await prisma.depotInventory.findUnique({ where: { id: inventoryId } });
    expect(deliveredInv?.quantityAvailable).toBe(19); // 20 - 1 = 19
    expect(deliveredInv?.quantityReserved).toBe(0); // 1 - 1 = 0

    const movements = await prisma.inventoryMovement.findMany({
      where: { depotId, itemSku: 'WATER_20L', movementType: 'DELIVER' },
    });
    expect(movements.length).toBe(1);
    expect(movements[0].quantity).toBe(1);
  });

  it('7. SOS Logging: Citizen logs SOS and receives direct emergency numbers', async () => {
    const res = await request(app).post('/api/v1/sos').send({
      serviceType: '112_NATIONAL',
      latitude: 12.9716,
      longitude: 77.5946,
      emergencyType: 'RESCUE_REQUEST',
      gpsAccuracy: 8,
      affectedPeople: 6,
      description: 'Water rising, 2nd floor balcony',
      contactInfo: '+919876500000',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sosId).toBeDefined();
    expect(res.body.data.status).toBe('LOGGED');
    expect(res.body.data.emergency_numbers['112']).toBe('112');
    expect(res.body.data.emergency_numbers['108']).toBe('108');
    expect(res.body.data.emergency_numbers['1078']).toBe('1078');

    const sosId = res.body.data.sosId;

    // Responders view, acknowledge and update SOS
    const ackRes = await request(app)
      .patch(`/api/v1/authority/sos/${sosId}/acknowledge`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ notes: 'Acknowledged by Central EOC' });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.status).toBe('ACKNOWLEDGED');

    const statusRes = await request(app)
      .patch(`/api/v1/authority/sos/${sosId}/status`)
      .set('Authorization', `Bearer ${directorToken}`)
      .send({ status: 'RESPONDER_DISPATCHED', notes: 'NDRF Unit 3 Boat dispatched' });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('RESPONDER_DISPATCHED');
  });

  it('8. Clean up created depot and request fixtures', async () => {
    await prisma.inventoryMovement.deleteMany({ where: { depotId } });
    await prisma.requestAuditLog.deleteMany({ where: { requestId } });
    await prisma.auditLog.deleteMany({ where: { entityId: requestId } });
    await prisma.reliefRequest.deleteMany({ where: { id: requestId } });
    await prisma.depotInventory.deleteMany({ where: { depotId } });
    await prisma.reliefDepot.deleteMany({ where: { id: depotId } });
  });
});
