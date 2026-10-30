import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/database.js';

describe('Phase 12 — Complete 14-Page Frontend-Backend Integration Workflow', () => {
  let server: any;
  let baseUrl: string;
  let districtId: string;
  let directorToken: string;
  let clientSandbox: any;
  let DR: any;

  const createdStaffUsers: string[] = [];
  const createdSessions: string[] = [];
  const createdHazards: string[] = [];

  beforeAll(async () => {
    // 1. Find seeded district
    const district = await prisma.district.findFirst();
    if (!district) throw new Error('Requires seeded district');
    districtId = district.id;

    // 2. Create staff user for authority verification
    const username = `phase12-director-${crypto.randomUUID().slice(0, 8)}`;
    const staff = await prisma.staffUser.create({
      data: {
        username,
        fullName: 'Phase 12 EOC Director',
        email: `${username}@test.gov.in`,
        phoneNumber: '+919988112255',
        passwordHash: 'dummy_hash',
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

    // 3. Start express server on dynamic port
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        resolve();
      });
    });

    // 4. Setup browser VM context
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
    if (createdHazards.length > 0) {
      await prisma.hazardIncident.deleteMany({ where: { id: { in: createdHazards } } });
    }
  });

  it('Page 1 — Language and Location Onboarding', async () => {
    // 1. Language preference persistence
    DR.storage.setLang('hi');
    expect(DR.storage.getLang()).toBe('hi');

    // 2. Manual search
    const districts = await DR.locationApi.searchDistricts('Delhi');
    expect(Array.isArray(districts)).toBe(true);

    // 3. Location confirmation
    DR.storage.setDistrict(districts[0]);
    DR.storage.setLocationLabel('Connaught Place, New Delhi');
    expect(DR.storage.getDistrict().name).toBeDefined();
  });

  it('Page 2 — Citizen Home Dashboard & Real-Time Alerts', async () => {
    const dashboardData = await DR.dashboardApi.get(districtId);
    expect(dashboardData).toBeDefined();
    expect(Array.isArray(dashboardData.alerts)).toBe(true);
    expect(Array.isArray(dashboardData.recentHazards)).toBe(true);
    expect(Array.isArray(dashboardData.nearestShelters)).toBe(true);
    expect(Array.isArray(dashboardData.announcements)).toBe(true);
  });

  it('Page 3 — Shared Hazard Overview & Visibility Boundary', async () => {
    const hazards = await DR.hazardApi.getSpatial({ districtId });
    expect(Array.isArray(hazards)).toBe(true);
    if (hazards.length > 0) {
      expect(hazards[0].reportCategory).toBeDefined();
      expect(hazards[0].disclaimer).toBeDefined();
    }
  });

  it('Page 4 & 5 — Route Planning, Risk Check & Evacuation Copilot', async () => {
    // Check risk on navigation path
    const risk = await DR.routingApi.checkRisk({
      coordinates: [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6200, lng: 77.2150 },
      ],
    });
    expect(risk).toBeDefined();
    expect(typeof risk.riskScore).toBe('number');

    // Consult Copilot for path guidance
    const copilotAdvice = await DR.copilotApi.chat({
      query: 'Is the evacuation route through Outer Circle safe right now?',
      districtId,
    });
    expect(copilotAdvice).toBeDefined();
    expect(copilotAdvice.response).toBeDefined();
  });

  it('Page 6 — Public Hazard Reporting with Multipart Support', async () => {
    const report = await DR.reportApi.submit({
      hazardType: 'LIVE_WIRE',
      severity: 'CRITICAL',
      latitude: 28.6250,
      longitude: 77.2180,
      description: 'High voltage wire snapped and submerged in water puddle.',
      districtId,
    });
    expect(report).toBeDefined();
    expect(report.incidentId).toBeDefined();
    createdHazards.push(report.incidentId);
  });

  it('Page 7 — Shelters & Hospitals Capacity Lookups', async () => {
    const shelters = await DR.facilityApi.get({ districtId, facilityType: 'SHELTER' });
    expect(Array.isArray(shelters)).toBe(true);
    shelters.forEach((f: any) => {
      expect(f.operatingStatus).toBeDefined();
      expect(typeof f.availableBeds).toBe('number');
    });
  });

  it('Page 8 & 9/10 — Anonymous Relief Request, 256-Bit Token & Tracking', async () => {
    const requestRes = await DR.supplyApi.submit({
      headcountAdults: 2,
      headcountChildren: 2,
      deliveryContext: 'GROUND_FLOOR',
      urgencyLevel: 'HIGH',
      latitude: 28.6300,
      longitude: 77.2200,
      itemsRequested: { drinkingWater: true, foodKits: 4 },
    });
    expect(requestRes.trackingToken).toMatch(/^DR-[A-Za-z0-9_-]{43}$/);

    const tracked = await DR.trackingApi.track(requestRes.trackingToken);
    expect(tracked).toBeDefined();
    expect(tracked.trackingToken).toBe(requestRes.trackingToken);
    expect(tracked.stage).toBe('STAGE_1_TRIAGED');
    expect(Array.isArray(tracked.timeline)).toBe(true);
  });

  it('Page 11 — Disaster Preparedness & Survival Checklists', async () => {
    const guides = await DR.preparednessApi.getGuides('FLOOD');
    expect(Array.isArray(guides)).toBe(true);
    expect(guides.length).toBeGreaterThan(0);
    expect(guides[0].sections.goBag).toBeDefined();
  });

  it('Page 12 — SOS Logging with Offline Distinction', async () => {
    const sos = await DR.sosApi.log('112_NATIONAL', 28.6250, 77.2180, {
      emergencyType: 'MEDICAL',
      description: 'Elderly citizen requires rescue from waterlogged residence',
    });
    expect(sos).toBeDefined();
    expect(sos.status).toBe('LOGGED');
    expect(sos.emergency_numbers).toBeDefined();
    expect(sos.emergency_numbers['112']).toBe('112');
  });

  it('Page 13 — Staff Sign-In 2FA & Authority Operations Dashboard', async () => {
    clientSandbox.sessionStorage.setItem('dr_staff_token', directorToken);
    expect(DR.authApi.isAuthenticated()).toBe(true);

    const dashboard = await DR.adminApi.dashboard();
    expect(dashboard).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
    expect(typeof dashboard.metrics.activeIncidents).toBe('number');
  });

  it('Page 14 — Simulations, RBAC Staff Tools & Transparency Portal', async () => {
    clientSandbox.sessionStorage.setItem('dr_staff_token', directorToken);

    // 1. Run multi-hazard simulation
    const sim = await DR.simulationApi.run({
      name: 'Phase 12 Comprehensive Flood Inundation Model',
      disasterType: 'FLOOD',
      severity: 'SEVERE',
      districtId,
      affectedAreaNames: ['Bellandur Basin', 'Yamuna Khadar'],
      scenarioParameters: { rainfallMmPerHour: 110 },
    });
    expect(sim.isSimulated).toBe(true);
    expect(sim.safetyNotice).toContain('NON-DESTRUCTIVE SIMULATION');

    // 2. List simulations
    const allSims = await DR.simulationApi.list();
    expect(Array.isArray(allSims)).toBe(true);

    // 3. Transparency portal public query
    const portal = await DR.client.get(`/authority/transparency/portal?districtId=${districtId}`);
    expect(portal).toBeDefined();
    expect(portal.civicMetrics).toBeDefined();
  });
});
