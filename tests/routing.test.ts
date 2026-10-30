import { describe, expect, it } from 'vitest';
import { afterEach, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { prisma } from '../src/shared/database.js';
import { checkRouteRisk, compareRoutes, decodeGooglePolyline, rankRouteResults, scoreRouteFactors } from '../src/modules/citizen/routing.service.js';

const originalMapsKey = env.GOOGLE_MAPS_API_KEY;

afterEach(() => {
  env.GOOGLE_MAPS_API_KEY = originalMapsKey;
  vi.restoreAllMocks();
});

describe('route geometry and ranking', () => {
  it('decodes Google encoded polylines into latitude/longitude coordinates', () => {
    expect(decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('prioritizes confirmed closures and severe hazards before speed', () => {
    const ranked = rankRouteResults([
      { id: 'fast-closed', confirmedClosures: 1, confirmedSevereHazards: 0, riskScore: 5, durationSeconds: 100, distanceMeters: 100 },
      { id: 'slow-clear', confirmedClosures: 0, confirmedSevereHazards: 0, riskScore: 30, durationSeconds: 300, distanceMeters: 300 },
      { id: 'severe', confirmedClosures: 0, confirmedSevereHazards: 1, riskScore: 2, durationSeconds: 50, distanceMeters: 50 },
    ]);
    expect(ranked.map((route) => route.id)).toEqual(['slow-clear', 'severe', 'fast-closed']);
  });

  it('keeps route risk bounded and increases with severe exposure and closure', () => {
    const noRecordedRisk = scoreRouteFactors({ severity: 0, exposure: 0, closure: 0, freshness: 0, uncertainty: 0 });
    const severeClosed = scoreRouteFactors({ severity: 1, exposure: 1, closure: 1, freshness: 1, uncertainty: 1 });
    expect(noRecordedRisk).toBe(0);
    expect(severeClosed).toBe(100);
  });

  it('assesses provider alternatives against PostGIS intersections and ranks a closure-free option first', async () => {
    env.GOOGLE_MAPS_API_KEY = 'unit-test-server-key';
    vi.spyOn(prisma.hazardIncident, 'findMany').mockResolvedValue([{
      id: 'incident-1',
      hazardType: 'WATERLOGGING',
      severity: 'CRITICAL',
      latitude: 38.5,
      longitude: -120.2,
      status: 'VERIFIED_ACTIVE',
      updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      polygons: [{
        id: 'zone-critical',
        coordinates: [[38.49, -120.21], [38.51, -120.21], [38.51, -120.19], [38.49, -120.19]],
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      }],
    }] as never);
    vi.spyOn(prisma.roadSegment, 'findMany').mockResolvedValue([{
      id: 'road-closed',
      status: 'CLOSED_SUBMERGED',
      lastInspected: new Date(Date.now() - 3 * 60 * 60 * 1000),
      pathLine: { type: 'LineString', coordinates: [[-120.21, 38.49], [-120.19, 38.51]] },
      startLat: 38.49,
      startLng: -120.21,
      endLat: 38.51,
      endLng: -120.19,
    }] as never);
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([
      { route_id: 'google-1', feature_id: 'zone-critical', exposure_meters: 125 },
      { route_id: 'google-1', feature_id: 'road-closed', exposure_meters: 0 },
    ] as never);

    const result = await compareRoutes({
      origin: { lat: 38.5, lng: -120.2 },
      destination: { lat: 38.6, lng: -120.3 },
      travelMode: 'WALK',
    }, async () => new Response(JSON.stringify({ routes: [
      { description: 'Fast route', distanceMeters: 1000, duration: '300s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } },
      { description: 'Clear alternative', distanceMeters: 1400, duration: '420s', polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' } },
    ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    expect(result.alternatives).toHaveLength(2);
    expect(result.alternatives[0].label).toBe('Clear alternative');
    expect(result.alternatives[1].confirmedClosures).toBe(1);
    expect(result.alternatives[1].hazardIntersections[0].verification).toBe('VERIFIED');
    expect(result.alternatives[1].riskScore).toBeGreaterThan(result.alternatives[0].riskScore);
    expect(result.alternatives[1].riskFactors.freshness).toBe(0.7);
    expect(Date.parse(result.alternatives[1].dataUpdatedAt)).toBeLessThan(Date.now() - 2 * 60 * 60 * 1000);
    expect(result.source).toContain('Google Routes API');
  });

  it('returns an honest error when the Google Routes API fails', async () => {
    env.GOOGLE_MAPS_API_KEY = 'unit-test-server-key';
    await expect(compareRoutes({
      origin: { lat: 38.5, lng: -120.2 },
      destination: { lat: 38.6, lng: -120.3 },
      travelMode: 'DRIVE',
    }, async () => new Response('{}', { status: 503 }))).rejects.toMatchObject({
      code: 'ROUTES_PROVIDER_ERROR',
      statusCode: 502,
    });
  });

  it('rejects malformed successful responses from Google Routes', async () => {
    env.GOOGLE_MAPS_API_KEY = 'unit-test-server-key';
    await expect(compareRoutes({
      origin: { lat: 38.5, lng: -120.2 },
      destination: { lat: 38.6, lng: -120.3 },
      travelMode: 'DRIVE',
    }, async () => new Response('not-json', { status: 200 }))).rejects.toMatchObject({
      code: 'ROUTES_PROVIDER_ERROR',
      statusCode: 502,
    });
  });

  it('route monitoring flags a new closure and freshness worsening', async () => {
    vi.spyOn(prisma.hazardIncident, 'findMany').mockResolvedValue([{
      id: 'incident-stale',
      hazardType: 'LANDSLIDE',
      severity: 'MODERATE',
      latitude: 12.9,
      longitude: 77.6,
      status: 'VERIFIED_ACTIVE',
      updatedAt: new Date(Date.now() - 70 * 60 * 1000),
      polygons: [{
        id: 'zone-stale',
        coordinates: [[12.89, 77.59], [12.91, 77.59], [12.91, 77.61], [12.89, 77.61]],
        updatedAt: new Date(Date.now() - 70 * 60 * 1000),
      }],
    }] as never);
    vi.spyOn(prisma.roadSegment, 'findMany').mockResolvedValue([{
      id: 'new-closure',
      status: 'DEBRIS_BLOCKED',
      lastInspected: new Date(),
      pathLine: { type: 'LineString', coordinates: [[77.59, 12.89], [77.61, 12.91]] },
      startLat: 12.89,
      startLng: 77.59,
      endLat: 12.91,
      endLng: 77.61,
    }] as never);
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([
      { route_id: 'monitor', feature_id: 'zone-stale', exposure_meters: 60 },
      { route_id: 'monitor', feature_id: 'new-closure', exposure_meters: 0 },
    ] as never);

    const result = await checkRouteRisk({
      coordinates: [{ lat: 12.9, lng: 77.6 }, { lat: 12.91, lng: 77.61 }],
      knownFeatureIds: ['zone-stale'],
      previousRiskScore: 0,
      previousFreshness: 0,
    });
    expect(result.materialChange).toBe(true);
    expect(result.recalculateRecommended).toBe(true);
    expect(result.newClosures).toEqual([{ id: 'new-closure', status: 'DEBRIS_BLOCKED' }]);
    expect(result.freshness).toBe(0.7);
    expect(result.currentFeatureIds).toContain('new-closure');
  });
});