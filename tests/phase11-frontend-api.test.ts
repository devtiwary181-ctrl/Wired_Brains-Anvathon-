import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/database.js';

describe('Phase 11 — Centralized Frontend API Integration', () => {
  let server: any;
  let baseUrl: string;
  let districtId: string;
  let directorToken: string;
  let clientSandbox: any;
  let DR: any;

  const createdStaffUsers: string[] = [];
  const createdSessions: string[] = [];

  beforeAll(async () => {
    // 1. Find or verify seeded district
    const district = await prisma.district.findFirst();
    if (!district) throw new Error('Requires seeded district');
    districtId = district.id;

    // 2. Create authenticated staff user with JWT session
    const username = `phase11-director-${crypto.randomUUID().slice(0, 8)}`;
    const staff = await prisma.staffUser.create({
      data: {
        username,
        fullName: 'Phase 11 EOC Director',
        email: `${username}@example.gov.in`,
        phoneNumber: '+919988112244',
        passwordHash: 'not-used',
        role: 'EOC_DIRECTOR',
        districtId,
        isActive: true,
      },
    });
    createdStaffUsers.push(staff.id);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.staffSession.create({
      data: { staffUserId: staff.id, sessionToken, expiresAt },
    });
    createdSessions.push(sessionToken);

    directorToken = jwt.sign(
      { userId: staff.id, username, role: 'EOC_DIRECTOR', districtId, sessionToken },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Start express app on dynamic local port
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        resolve();
      });
    });

    // 4. Load stitch-reference/api-client.js into a browser-like sandbox
    const scriptPath = path.resolve(process.cwd(), 'stitch-reference/api-client.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    const storageMock = () => {
      const store = new Map<string, string>();
      return {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
        clear: () => store.clear(),
      };
    };

    clientSandbox = {
      window: {} as any,
      process: { env: { VITE_API_BASE_URL: baseUrl } },
      localStorage: storageMock(),
      sessionStorage: storageMock(),
      navigator: { onLine: true },
      fetch: globalThis.fetch,
      FormData: globalThis.FormData,
      Blob: globalThis.Blob,
      URLSearchParams: globalThis.URLSearchParams,
      AbortController: globalThis.AbortController,
      CustomEvent: class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, opts: any = {}) {
          this.type = type;
          this.detail = opts.detail;
        }
      },
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      console: console,
    };
    clientSandbox.window = clientSandbox;

    vm.createContext(clientSandbox);
    vm.runInContext(scriptContent, clientSandbox);

    DR = clientSandbox.window.DisasterReadyAPI;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (createdSessions.length > 0) {
      await prisma.staffSession.deleteMany({ where: { sessionToken: { in: createdSessions } } });
    }
    if (createdStaffUsers.length > 0) {
      await prisma.staffUser.deleteMany({ where: { id: { in: createdStaffUsers } } });
    }
  });

  describe('1. API Client Core Capabilities', () => {
    it('initializes with centralized base URL', () => {
      expect(DR).toBeDefined();
      expect(DR.client.BASE_URL).toBe(baseUrl);
    });

    it('exposes core HTTP helper verbs', () => {
      expect(typeof DR.client.get).toBe('function');
      expect(typeof DR.client.post).toBe('function');
      expect(typeof DR.client.patch).toBe('function');
      expect(typeof DR.client.put).toBe('function');
      expect(typeof DR.client.del).toBe('function');
    });

    it('handles request timeout and produces user-safe timeout error', async () => {
      await expect(
        DR.client.get('/health', { timeout: 1 })
      ).rejects.toThrow('The emergency server took too long to respond');
    });

    it('supports request cancellation via AbortSignal', async () => {
      const ac = new AbortController();
      const promise = DR.client.get('/health', { signal: ac.signal });
      ac.abort();
      await expect(promise).rejects.toMatchObject({ code: 'TIMEOUT' });
    });

    it('normalizes HTTP 404 error safely without exposing stack traces', async () => {
      try {
        await DR.client.get('/nonexistent-path-safe-check');
        expect.unreachable('Should have failed with 404');
      } catch (err: any) {
        expect(err.status).toBe(404);
        expect(err.isApiError).toBe(true);
        expect(err.message).toBeDefined();
        expect(err.stack).not.toContain('prisma');
      }
    });
  });

  describe('2. All 17 API Service Modules', () => {
    it('1) authApi: validates unauthenticated session state & login step 1 rejection', async () => {
      expect(DR.authApi).toBeDefined();
      expect(DR.authApi.isAuthenticated()).toBe(false);

      // Invalid login step 1 should throw understandable validation / auth error
      await expect(
        DR.authApi.loginStep1('invalid-user', 'wrong-pass')
      ).rejects.toThrow();
    });

    it('2) dashboardApi: fetches citizen dashboard data without requiring login', async () => {
      expect(DR.dashboardApi).toBeDefined();
      const res = await DR.dashboardApi.get(districtId);
      expect(res).toBeDefined();
      expect(Array.isArray(res.alerts)).toBe(true);
      expect(Array.isArray(res.recentHazards)).toBe(true);
      expect(Array.isArray(res.nearestShelters)).toBe(true);
    });

    it('3) hazardApi: queries active verified hazards and spatial filters', async () => {
      expect(DR.hazardApi).toBeDefined();
      const hazards = await DR.hazardApi.getSpatial({ districtId });
      expect(Array.isArray(hazards)).toBe(true);
    });

    it('4) alertApi: queries active emergency alerts', async () => {
      expect(DR.alertApi).toBeDefined();
      const alerts = await DR.alertApi.getActive(districtId);
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('5) locationApi: searches districts and geolocates coordinates', async () => {
      expect(DR.locationApi).toBeDefined();
      const searchRes = await DR.locationApi.searchDistricts('Delhi');
      expect(Array.isArray(searchRes)).toBe(true);
    });

    it('6) routingApi: checks multi-criteria evacuation route risk', async () => {
      expect(DR.routingApi).toBeDefined();
      // checkRisk validates geometry against active hazard zones
      const riskAssessment = await DR.routingApi.checkRisk({
        coordinates: [
          { lat: 28.6139, lng: 77.2090 },
          { lat: 28.6150, lng: 77.2100 },
          { lat: 28.6160, lng: 77.2120 },
        ],
      });
      expect(riskAssessment).toBeDefined();
      expect(typeof riskAssessment.riskScore).toBe('number');
    });

    it('7) facilityApi: lists operational shelters and relief facilities', async () => {
      expect(DR.facilityApi).toBeDefined();
      const facilities = await DR.facilityApi.get({ districtId, facilityType: 'SHELTER' });
      expect(Array.isArray(facilities)).toBe(true);
    });

    it('8) reportApi: submits public citizen hazard report with multipart payload', async () => {
      expect(DR.reportApi).toBeDefined();
      const reportRes = await DR.reportApi.submit({
        hazardType: 'FALLEN_TREE',
        severity: 'MODERATE',
        latitude: 28.6200,
        longitude: 77.2100,
        addressLandmark: 'Near Connaught Place Outer Circle',
        description: 'Large banyan tree fallen across roadway.',
      });
      expect(reportRes).toBeDefined();
      expect(reportRes.incidentId || reportRes.id).toBeDefined();
    });

    it('9) supplyApi: submits public supply request and generates tracking token', async () => {
      expect(DR.supplyApi).toBeDefined();
      const reqRes = await DR.supplyApi.submit({
        headcountAdults: 3,
        headcountChildren: 1,
        deliveryContext: 'ROOFTOP_STRANDED',
        urgencyLevel: 'HIGH',
        latitude: 28.6501,
        longitude: 77.2301,
        itemsRequested: {
          drinkingWater: true,
          foodKits: 4,
          babyFormula: false,
          firstAidKit: true,
        },
      });
      expect(reqRes).toBeDefined();
      expect(reqRes.trackingToken).toBeDefined();
      expect(reqRes.trackingToken).toMatch(/^DR-[A-Za-z0-9_-]{43}$/);
      expect(reqRes.stage).toBe('STAGE_1_TRIAGED');

      // 10) trackingApi: tracks supply request using high-entropy token
      expect(DR.trackingApi).toBeDefined();
      const trackRes = await DR.trackingApi.track(reqRes.trackingToken);
      expect(trackRes).toBeDefined();
      expect(trackRes.trackingToken).toBe(reqRes.trackingToken);
      expect(trackRes.stage).toBe('STAGE_1_TRIAGED');
    });

    it('11) sosApi: logs citizen emergency SOS without login requirement', async () => {
      expect(DR.sosApi).toBeDefined();
      const sosRes = await DR.sosApi.log('112_NATIONAL', 28.6139, 77.2090, {
        emergencyType: 'MEDICAL',
        description: 'Citizen requires immediate medical evacuation',
      });
      expect(sosRes).toBeDefined();
      expect(sosRes.status).toBe('LOGGED');
    });

    it('12) preparednessApi: retrieves disaster survival guides', async () => {
      expect(DR.preparednessApi).toBeDefined();
      const guides = await DR.preparednessApi.getGuides('FLOOD');
      expect(Array.isArray(guides)).toBe(true);
    });

    it('13) notificationApi: handles web push subscription', async () => {
      expect(DR.notificationApi).toBeDefined();
      const dummyToken = `fcm-token-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const subRes = await DR.notificationApi.subscribe({
        token: dummyToken,
        topic: 'DISASTER_ALERTS',
        districtId,
      });
      expect(subRes).toBeDefined();
      expect(subRes.success).toBe(true);
      expect(subRes.id).toBeDefined();

      const unsubRes = await DR.notificationApi.unsubscribe(dummyToken);
      expect(unsubRes).toBeDefined();
      expect(unsubRes.success).toBe(true);
    });

    it('14) copilotApi: executes natural language emergency query', async () => {
      expect(DR.copilotApi).toBeDefined();
      const chatRes = await DR.copilotApi.chat({
        query: 'Are there any active cyclone or flood warnings in effect right now?',
        language: 'en',
        districtId,
      });
      expect(chatRes).toBeDefined();
      expect(chatRes.response).toBeDefined();
      expect(chatRes.toolUsed).toBeDefined();
    });

    it('15) adminApi & 16) inventoryApi & 17) simulationApi: handles authenticated authority operations', async () => {
      expect(DR.adminApi).toBeDefined();
      expect(DR.inventoryApi).toBeDefined();
      expect(DR.simulationApi).toBeDefined();

      // Set staff token in sessionStorage
      clientSandbox.sessionStorage.setItem('dr_staff_token', directorToken);
      expect(DR.authApi.isAuthenticated()).toBe(true);

      // adminApi: authority dashboard
      const dash = await DR.adminApi.dashboard();
      expect(dash).toBeDefined();
      expect(dash.metrics).toBeDefined();

      // inventoryApi: list stock
      const inventory = await DR.inventoryApi.list();
      expect(Array.isArray(inventory)).toBe(true);

      // simulationApi: run disaster simulation
      const sim = await DR.simulationApi.run({
        disasterType: 'FLOOD',
        name: 'Phase 11 Frontend Integration Simulation',
        severity: 'SEVERE',
        districtId,
        affectedAreaNames: ['Sector 4 Bellandur', 'Ward 174 Agrahara'],
        scenarioParameters: {
          rainfallMmPerHour: 95,
          damReleaseCusecs: 28000,
        },
      });
      expect(sim).toBeDefined();
      expect(sim.simulationId).toBeDefined();
      expect(sim.isSimulated).toBe(true);

      // Test staff logout
      await DR.authApi.logout();
      expect(DR.authApi.isAuthenticated()).toBe(false);
      expect(clientSandbox.sessionStorage.getItem('dr_staff_token')).toBeNull();
    });
  });
});
