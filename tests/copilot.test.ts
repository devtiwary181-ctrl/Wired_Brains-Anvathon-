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

async function createStaffUser(role: 'EOC_DIRECTOR' | 'DATA_OPERATOR') {
  const username = `copilot-test-${crypto.randomUUID().slice(0, 8)}`;
  const user = await prisma.staffUser.create({
    data: {
      username,
      fullName: `Copilot Test ${role}`,
      email: `${username}@test.ndma.gov.in`,
      phoneNumber: '+919876543210',
      passwordHash: 'dummy_hash',
      role,
      districtId,
      isActive: true,
    },
  });
  createdUsers.push(user.id);

  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.staffSession.create({
    data: { staffUserId: user.id, sessionToken, expiresAt },
  });
  createdSessions.push(sessionToken);

  return jwt.sign(
    { userId: user.id, username, role, districtId, sessionToken },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeAll(async () => {
  const district = await prisma.district.findFirst();
  if (!district) throw new Error('Requires seeded district in database');
  districtId = district.id;

  directorToken = await createStaffUser('EOC_DIRECTOR');
  operatorToken = await createStaffUser('DATA_OPERATOR');
});

afterAll(async () => {
  await prisma.staffSession.deleteMany({ where: { sessionToken: { in: createdSessions } } });
  await prisma.auditLog.deleteMany({ where: { staffUserId: { in: createdUsers } } });
  await prisma.staffUser.deleteMany({ where: { id: { in: createdUsers } } });
});

describe('PHASE 8 — DisasterReady AI Copilot Verification', () => {
  // 1. Citizen Queries
  describe('1. Citizen Capabilities', () => {
    it('answers active disaster alerts questions without login', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'Are there any active cyclone or flood warnings in effect right now?',
          districtId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolUsed).toBe('get_active_alerts');
      expect(res.body.data.response).toBeDefined();
      expect(res.body.data.safetyDisclaimer).toContain('112');
      expect(res.body.data.dataSources).toBeInstanceOf(Array);
      expect(res.body.data.dataSources[0].verified).toBe(true);
    });

    it('retrieves verified nearby shelters and returns actionCard', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'Where is the nearest relief camp or shelter for safe stay?',
          districtId,
          coordinates: { lat: 12.9716, lng: 77.5946 },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolUsed).toBe('get_nearby_shelters');
      expect(res.body.data.actionCard).toBeDefined();
      expect(res.body.data.actionCard.type).toBe('FACILITY_CARD');
    });

    it('retrieves verified nearby hospitals and emergency medical centres', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'I need an urgent medical clinic or hospital near me',
          districtId,
          coordinates: { lat: 12.9716, lng: 77.5946 },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolUsed).toBe('get_nearby_hospitals');
      expect(res.body.data.actionCard?.type).toBe('FACILITY_CARD');
    });

    it('queries route safety and explicitly includes no-absolute-safety warning', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'What is the safest available route to reach dry ground?',
          toolParameters: {
            origin: { lat: 12.9716, lng: 77.5946 },
            destination: { lat: 12.9766, lng: 77.5996 },
            travelMode: 'WALK',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolUsed).toBe('compare_routes');
      // Must NEVER claim a route is completely safe
      expect(res.body.data.safetyDisclaimer.toLowerCase()).toContain('never guarantees complete route safety');
    });

    it('returns verified preparedness guides and emergency go-bag checklist', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'What should I pack in an emergency go-bag for flood protocol?',
          requestedTool: 'get_preparedness_guide',
          toolParameters: { disasterType: 'FLOOD' },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolUsed).toBe('get_preparedness_guide');
      expect(res.body.data.response).toContain('water');
      expect(res.body.data.response).toContain('112');
    });
  });

  // 2. Admin Capabilities & Authorization Restrictions
  describe('2. Admin Capabilities & RBAC Permission Validation', () => {
    it('allows authorized EOC_DIRECTOR to analyze resource shortages', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          query: 'Analyze resource shortages across depots',
          requestedTool: 'analyze_resource_shortages',
          toolParameters: { districtId },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolUsed).toBe('analyze_resource_shortages');
      expect(res.body.data.actionCard?.title).toContain('Inventory Allocation Review');
    });

    it('blocks unauthenticated citizen from invoking admin tool analyze_resource_shortages', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'Analyze resource shortages across depots',
          requestedTool: 'analyze_resource_shortages',
          toolParameters: { districtId },
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('blocks DATA_OPERATOR role from invoking inventory:allocate protected tool', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          query: 'Analyze resource shortages across depots',
          requestedTool: 'analyze_resource_shortages',
          toolParameters: { districtId },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('drafts official warning requiring mandatory human authorization', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          query: 'Draft an urgent evacuation announcement for flooding in Low-lying Sector 4',
          requestedTool: 'draft_announcement',
          toolParameters: {
            title: 'Urgent Evacuation Warning — Sector 4',
            hazardType: 'WATERLOGGING',
            severity: 'CRITICAL',
            keyInstructions: 'Move to designated upper floor shelters immediately.',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.actionCard?.type).toBe('RECOMMENDATION_DRAFT_CARD');
      // Crucial: Human signoff flag must be true
      expect(res.body.data.actionCard?.requiresHumanConfirmation).toBe(true);
      expect(res.body.data.response).toContain('HUMAN AUTHORIZATION REQUIRED');
    });
  });

  // 3. Schema & Input Validation
  describe('3. Tool Schema & Parameter Validation', () => {
    it('rejects invalid disaster type in preparedness guide tool', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'Guide',
          requestedTool: 'get_preparedness_guide',
          toolParameters: { disasterType: 'VOLCANO_ERUPTION_INVALID' },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects out-of-range coordinates in chat payload', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'Help',
          coordinates: { lat: 999, lng: 999 },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // 4. Multilingual Support
  describe('4. Multilingual 12 Languages Support & Dual-Text Retention', () => {
    it('returns Hindi response while retaining English original text and emergency hotline', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'कहाँ है नज़दीकी आश्रय?',
          language: 'hi',
          districtId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.detectedLanguage).toBe('hi');
      // Multilingual responses must retain the original text alongside
      expect(res.body.data.originalLanguageText).toBeDefined();
      expect(res.body.data.response).toContain('112');
    });

    it('translates official announcement to Tamil while preserving original text', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          query: 'Translate announcement to Tamil',
          requestedTool: 'translate_announcement',
          toolParameters: {
            text: 'Evacuation alert: All residents in Ward 12 must proceed to St. Mary High School shelter immediately.',
            targetLanguage: 'ta',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.toolUsed).toBe('translate_announcement');
      expect(res.body.data.response).toContain('Original Announcement');
    });
  });

  // 5. Emergency Helpline Fallback & Provider Graceful Degradation
  describe('5. Provider Resilience & Verified Fallbacks', () => {
    it('provides clear fallback guidance and direct emergency hotlines when query fails', async () => {
      const res = await request(app)
        .post('/api/v1/copilot/chat')
        .send({
          query: 'Non-existent random query without tools or context',
          requestedTool: 'non_existent_tool_xyz',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isFallback).toBe(true);
      expect(res.body.data.response).toContain('112');
      expect(res.body.data.response).toContain('1078');
    });
  });
});
