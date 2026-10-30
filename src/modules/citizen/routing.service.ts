import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { prisma } from '../../shared/database.js';

export type Coordinate = { lat: number; lng: number };
export type RouteMode = 'WALK' | 'BICYCLE' | 'DRIVE' | 'TWO_WHEELER';

type RouteRequest = {
  origin: Coordinate;
  destination: Coordinate;
  travelMode: RouteMode;
};

type GoogleRoute = {
  distanceMeters?: number;
  duration?: string;
  description?: string;
  polyline?: { encodedPolyline?: string };
  legs?: Array<{ steps?: Array<{ navigationInstruction?: { instructions?: string } }> }>;
};

type SpatialFeature = {
  id: string;
  geometry: Record<string, unknown>;
  kind: 'HAZARD_ZONE' | 'ROAD_CLOSURE' | 'UNVERIFIED_REPORT';
  hazardType?: string;
  severity?: string;
  status?: string;
  verified?: boolean;
  point?: Coordinate;
  lastUpdated: Date;
};

const weights = {
  severity: env.ROUTE_RISK_W1,
  exposure: env.ROUTE_RISK_W2,
  closure: env.ROUTE_RISK_W3,
  freshness: env.ROUTE_RISK_W4,
  uncertainty: env.ROUTE_RISK_W5,
};

function configuredServerKey(): string {
  const key = env.GOOGLE_MAPS_API_KEY.trim();
  if (!key || /^(mock|your_|replace)/i.test(key)) {
    throw new AppError('Google routing is not configured. No route was generated.', 503, 'ROUTES_NOT_CONFIGURED');
  }
  return key;
}

export function decodeGooglePolyline(encoded: string): Coordinate[] {
  const points: Coordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const deltas: number[] = [];
    for (let coordinate = 0; coordinate < 2; coordinate++) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        if (index >= encoded.length) throw new AppError('Google returned invalid route geometry.', 502, 'INVALID_ROUTE_GEOMETRY');
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      deltas.push((result & 1) ? ~(result >> 1) : result >> 1);
    }
    latitude += deltas[0];
    longitude += deltas[1];
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }

  if (points.length < 2) throw new AppError('Google returned incomplete route geometry.', 502, 'INVALID_ROUTE_GEOMETRY');
  return points;
}

function toGeoJsonLine(points: Coordinate[]) {
  return { type: 'LineString', coordinates: points.map(({ lat, lng }) => [lng, lat]) };
}

function normalizePolygonCoordinates(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const polygon = value as { type?: string; coordinates?: unknown };
  if (polygon.type === 'Polygon' && Array.isArray(polygon.coordinates)) return polygon;
  if (!Array.isArray(value) || value.length < 3) return null;
  const ring = value as unknown[];
  if (!ring.every((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))) {
    return null;
  }
  const coordinates = ring.map((point) => [(point as number[])[1], (point as number[])[0]]);
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push([...first]);
  return { type: 'Polygon', coordinates: [coordinates] };
}

function normalizeLineGeometry(value: unknown, fallback: Coordinate[]): Record<string, unknown> | null {
  if (value && typeof value === 'object') {
    const geometry = value as { type?: string; coordinates?: unknown };
    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) return geometry;
    if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) return geometry;
  }
  if (Array.isArray(value) && value.length >= 2 && value.every((point) => Array.isArray(point) && point.length >= 2)) {
    return { type: 'LineString', coordinates: value };
  }
  if (fallback.length >= 2) return toGeoJsonLine(fallback);
  return null;
}

async function getSpatialFeatures(): Promise<SpatialFeature[]> {
  const [incidents, closures] = await Promise.all([
    prisma.hazardIncident.findMany({
      where: { status: { in: ['VERIFIED_ACTIVE', 'UNVERIFIED'] } },
      select: {
        id: true,
        hazardType: true,
        severity: true,
        latitude: true,
        longitude: true,
        status: true,
        updatedAt: true,
        polygons: {
          where: { isActive: true },
          select: { id: true, coordinates: true, updatedAt: true },
        },
      },
      take: 500,
    }),
    prisma.roadSegment.findMany({
      where: { status: { in: ['CLOSED_SUBMERGED', 'DEBRIS_BLOCKED'] } },
      take: 500,
    }),
  ]);

  const features: SpatialFeature[] = [];
  for (const incident of incidents) {
    if (incident.status === 'UNVERIFIED') {
      features.push({
        id: `report-${incident.id}`,
        geometry: { type: 'Point', coordinates: [incident.longitude, incident.latitude] },
        kind: 'UNVERIFIED_REPORT',
        hazardType: incident.hazardType,
        severity: incident.severity,
        status: incident.status,
        verified: false,
        point: { lat: incident.latitude, lng: incident.longitude },
        lastUpdated: incident.updatedAt,
      });
    }
    for (const polygon of incident.polygons) {
      const geometry = normalizePolygonCoordinates(polygon.coordinates);
      if (!geometry) continue;
      features.push({
        id: polygon.id,
        geometry,
        kind: 'HAZARD_ZONE',
        hazardType: incident.hazardType,
        severity: incident.severity,
        status: incident.status,
        verified: incident.status === 'VERIFIED_ACTIVE',
        lastUpdated: polygon.updatedAt,
      });
    }
  }

  for (const road of closures) {
    const geometry = normalizeLineGeometry(road.pathLine, [
      { lat: road.startLat, lng: road.startLng },
      { lat: road.endLat, lng: road.endLng },
    ]);
    if (!geometry) continue;
    features.push({
      id: road.id,
      geometry,
      kind: 'ROAD_CLOSURE',
      status: road.status,
      verified: true,
      lastUpdated: road.lastInspected,
    });
  }
  return features;
}

async function getPostgisIntersections(routes: Array<{ routeId: string; points: Coordinate[] }>, features: SpatialFeature[]) {
  if (routes.length === 0 || features.length === 0) return new Map<string, Array<{ feature: SpatialFeature; exposureMeters: number }>>();
  const routeValues = routes.map(({ routeId, points }) => Prisma.sql`(${routeId}, ${JSON.stringify(toGeoJsonLine(points))}::jsonb)`);
  const featureValues = features.map((feature) => Prisma.sql`(${feature.id}, ${feature.kind}, ${JSON.stringify(feature.geometry)}::jsonb)`);

  const rows = await prisma.$queryRaw<Array<{ route_id: string; feature_id: string; exposure_meters: number | null }>>(Prisma.sql`
    WITH route_geometries AS (
      SELECT route_id, ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326) AS geom
      FROM (VALUES ${Prisma.join(routeValues)}) AS route_input(route_id, geometry)
    ), feature_geometries AS (
      SELECT feature_id, kind, ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326) AS geom
      FROM (VALUES ${Prisma.join(featureValues)}) AS feature_input(feature_id, kind, geometry)
    )
    SELECT routes.route_id, features.feature_id,
      CASE WHEN features.kind = 'HAZARD_ZONE'
        THEN ST_Length(ST_Intersection(routes.geom, features.geom)::geography)
        ELSE 0
      END AS exposure_meters
    FROM route_geometries routes
    JOIN feature_geometries features ON ST_Intersects(routes.geom, features.geom)
  `);

  const intersections = new Map<string, Array<{ feature: SpatialFeature; exposureMeters: number }>>();
  for (const row of rows) {
    const feature = features.find((candidate) => candidate.id === row.feature_id);
    if (!feature) continue;
    const routeFeatures = intersections.get(row.route_id) || [];
    routeFeatures.push({ feature, exposureMeters: Number(row.exposure_meters || 0) });
    intersections.set(row.route_id, routeFeatures);
  }
  return intersections;
}

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function pointToRouteMeters(point: Coordinate, route: Coordinate[]): number {
  let nearest = Infinity;
  for (let index = 1; index < route.length; index++) {
    const start = route[index - 1];
    const end = route[index];
    const latitudeScale = 111320;
    const longitudeScale = latitudeScale * Math.cos(point.lat * Math.PI / 180);
    const dx = (end.lng - start.lng) * longitudeScale;
    const dy = (end.lat - start.lat) * latitudeScale;
    const px = (point.lng - start.lng) * longitudeScale;
    const py = (point.lat - start.lat) * latitudeScale;
    const denominator = dx * dx + dy * dy;
    const t = denominator ? Math.max(0, Math.min(1, (px * dx + py * dy) / denominator)) : 0;
    nearest = Math.min(nearest, Math.hypot(px - t * dx, py - t * dy));
  }
  return nearest;
}

function freshnessRisk(lastUpdated: Date, now: number): number {
  const ageMinutes = Math.max(0, (now - lastUpdated.getTime()) / 60000);
  if (ageMinutes <= 15) return 0;
  if (ageMinutes <= 60) return 0.35;
  if (ageMinutes <= 240) return 0.7;
  return 1;
}

const severityRisk: Record<string, number> = { LOW: 0.2, MODERATE: 0.45, SEVERE: 0.75, CRITICAL: 1 };

export function scoreRouteFactors(factors: { severity: number; exposure: number; closure: number; freshness: number; uncertainty: number }) {
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 1;
  const score = (
    weights.severity * factors.severity +
    weights.exposure * factors.exposure +
    weights.closure * factors.closure +
    weights.freshness * factors.freshness +
    weights.uncertainty * factors.uncertainty
  ) / totalWeight;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function rankRouteResults<T extends { confirmedClosures: number; confirmedSevereHazards: number; riskScore: number; durationSeconds: number; distanceMeters: number }>(routes: T[]): T[] {
  return [...routes].sort((a, b) =>
    a.confirmedClosures - b.confirmedClosures ||
    a.confirmedSevereHazards - b.confirmedSevereHazards ||
    a.riskScore - b.riskScore ||
    a.durationSeconds - b.durationSeconds ||
    a.distanceMeters - b.distanceMeters,
  );
}

function parseDurationSeconds(value?: string): number {
  const match = value?.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : 0;
}

export async function compareRoutes(request: RouteRequest, fetcher: typeof fetch = fetch) {
  const key = configuredServerKey();
  let googleResponse: Response;
  try {
    googleResponse = await fetcher('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.description,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction.instructions',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: request.origin.lat, longitude: request.origin.lng } } },
        destination: { location: { latLng: { latitude: request.destination.lat, longitude: request.destination.lng } } },
        travelMode: request.travelMode,
        computeAlternativeRoutes: true,
        languageCode: 'en-IN',
        units: 'METRIC',
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new AppError('Google Routes API could not be reached. No route was generated.', 502, 'ROUTES_PROVIDER_UNAVAILABLE');
  }
  if (!googleResponse.ok) {
    throw new AppError('Google Routes API failed. No fallback route is available.', 502, 'ROUTES_PROVIDER_ERROR');
  }

  let providerData: { routes?: GoogleRoute[] };
  try {
    providerData = await googleResponse.json() as { routes?: GoogleRoute[] };
  } catch {
    throw new AppError('Google Routes API returned an unreadable response. No route was generated.', 502, 'ROUTES_PROVIDER_ERROR');
  }
  const providerRoutes = providerData.routes || [];
  if (!providerRoutes.length) throw new AppError('Google found no route alternatives for those locations.', 404, 'NO_ROUTE_ALTERNATIVES');

  const routes = providerRoutes.map((route, index) => ({
    routeId: `google-${index + 1}`,
    label: route.description || `Alternative ${index + 1}`,
    points: decodeGooglePolyline(route.polyline?.encodedPolyline || ''),
    distanceMeters: Number(route.distanceMeters || 0),
    durationSeconds: parseDurationSeconds(route.duration),
    instructions: (route.legs || []).flatMap((leg) => leg.steps || []).map((step) => step.navigationInstruction?.instructions).filter((text): text is string => Boolean(text)),
  }));

  let features: SpatialFeature[];
  let intersections: Map<string, Array<{ feature: SpatialFeature; exposureMeters: number }>>;
  try {
    features = await getSpatialFeatures();
    intersections = await getPostgisIntersections(routes, features);
  } catch {
    throw new AppError('Hazard and road-closure data could not be checked. Routes are withheld until risk data is available.', 503, 'ROUTE_RISK_DATA_UNAVAILABLE');
  }

  const now = Date.now();
  const evaluated = routes.map((route) => {
    const intersected = intersections.get(route.routeId) || [];
    const confirmedHazards = intersected.filter(({ feature }) => feature.kind === 'HAZARD_ZONE' && feature.verified);
    const unverifiedZones = intersected.filter(({ feature }) => feature.kind === 'HAZARD_ZONE' && !feature.verified);
    const closures = intersected.filter(({ feature }) => feature.kind === 'ROAD_CLOSURE' && feature.verified);
    const nearbyUnverifiedReports = features
      .filter((feature) => feature.kind === 'UNVERIFIED_REPORT')
      .filter((feature) => {
        return feature.point ? pointToRouteMeters(feature.point, route.points) <= 100 : false;
      });
    const severeHazards = confirmedHazards.filter(({ feature }) => ['SEVERE', 'CRITICAL'].includes(feature.severity || ''));
    const maxSeverity = confirmedHazards.reduce((max, { feature }) => Math.max(max, severityRisk[feature.severity || ''] || 0), 0);
    const exposureMeters = confirmedHazards.reduce((sum, hit) => sum + hit.exposureMeters, 0);
    const intersectedHazards = [...confirmedHazards, ...unverifiedZones].map(({ feature }) => ({
      id: feature.id,
      hazardType: feature.hazardType,
      severity: feature.severity,
      verification: feature.verified ? 'VERIFIED' : 'UNVERIFIED',
      lastUpdated: feature.lastUpdated.toISOString(),
    }));
    const relevantFeatures = [...intersected, ...nearbyUnverifiedReports.map((feature) => ({ feature, exposureMeters: 0 }))];
    const latestFeature = relevantFeatures.reduce((latest, current) => current.feature.lastUpdated > latest ? current.feature.lastUpdated : latest, new Date(0));
    const oldestFeature = relevantFeatures.reduce((oldest, current) => oldest.getTime() === 0 || current.feature.lastUpdated < oldest ? current.feature.lastUpdated : oldest, new Date(0));
    const freshness = oldestFeature.getTime() ? freshnessRisk(oldestFeature, now) : 0.5;
    const factors = {
      severity: maxSeverity,
      exposure: Math.min(1, exposureMeters / Math.max(100, route.distanceMeters * 0.25)),
      closure: closures.length ? 1 : 0,
      freshness,
      uncertainty: Math.min(1, (unverifiedZones.length + nearbyUnverifiedReports.length) / Math.max(1, confirmedHazards.length + closures.length + 1)),
    };
    return {
      ...route,
      coordinates: route.points,
      confirmedClosures: closures.length,
      confirmedSevereHazards: severeHazards.length,
      riskScore: scoreRouteFactors(factors),
      riskFactors: factors,
      hazardExposureMeters: Math.round(exposureMeters),
      hazardIntersections: intersectedHazards,
      nearbyUnverifiedReports: nearbyUnverifiedReports.map(({ id, hazardType, severity, lastUpdated }) => ({ id, hazardType, severity, lastUpdated: lastUpdated.toISOString() })),
      roadClosures: closures.map(({ feature }) => ({ id: feature.id, status: feature.status, lastUpdated: feature.lastUpdated.toISOString() })),
      riskExplanation: closures.length
        ? 'Intersects a recorded road closure. Avoid unless emergency authorities direct otherwise.'
        : severeHazards.length
          ? 'Intersects one or more verified severe hazards.'
          : unverifiedZones.length || nearbyUnverifiedReports.length
            ? 'Unverified citizen reports are near this route; they are not treated as confirmed closures.'
            : 'No intersecting verified hazard polygons or recorded closures were returned. This is not a safety guarantee.',
      source: 'Google Routes API + DisasterReady hazard and road records',
      dataUpdatedAt: latestFeature.getTime() ? latestFeature.toISOString() : new Date(now).toISOString(),
    };
  });

  const ranked = rankRouteResults(evaluated);
  const lowRiskAvailable = ranked.some((route) => route.confirmedClosures === 0 && route.confirmedSevereHazards === 0 && route.riskScore < 30);
  return {
    alternatives: ranked.map((route, index) => ({ ...route, rank: index + 1, recommended: index === 0 && lowRiskAvailable })),
    recommendedRouteId: lowRiskAvailable ? ranked[0]?.routeId ?? null : null,
    noReliablyLowRiskRoute: !lowRiskAvailable,
    message: lowRiskAvailable
      ? 'Routes are ranked by recorded closures, verified severe hazards, risk score, and travel time. No route is guaranteed safe.'
      : 'No reliably low-risk route is currently available from these alternatives. Follow local emergency instructions.',
    source: 'Google Routes API + DisasterReady PostGIS intersections',
    fetchedAt: new Date().toISOString(),
    riskModel: { weights, note: 'Configurable heuristic for prioritization only; not scientifically validated.' },
  };
}

export async function checkRouteRisk(input: { coordinates: Coordinate[]; knownFeatureIds?: string[]; previousRiskScore?: number; previousFreshness?: number }) {
  if (input.coordinates.length < 2) throw new AppError('Route geometry requires at least two coordinates.', 400, 'INVALID_ROUTE_GEOMETRY');
  let features: SpatialFeature[];
  let intersections: Map<string, Array<{ feature: SpatialFeature; exposureMeters: number }>>;
  try {
    features = await getSpatialFeatures();
    intersections = await getPostgisIntersections([{ routeId: 'monitor', points: input.coordinates }], features);
  } catch {
    throw new AppError('Current hazard and closure data is unavailable; route monitoring cannot confirm changes.', 503, 'ROUTE_RISK_DATA_UNAVAILABLE');
  }
  const hits = intersections.get('monitor') || [];
  const closures = hits.filter(({ feature }) => feature.kind === 'ROAD_CLOSURE');
  const confirmed = hits.filter(({ feature }) => feature.kind === 'HAZARD_ZONE' && feature.verified);
  const unverifiedZones = hits.filter(({ feature }) => feature.kind === 'HAZARD_ZONE' && !feature.verified);
  const nearbyReports = features.filter((feature) => feature.kind === 'UNVERIFIED_REPORT' && feature.point)
    .filter((feature) => pointToRouteMeters(feature.point!, input.coordinates) <= 100);
  const relevantFeatures = [...hits.map(({ feature }) => feature), ...nearbyReports];
  const oldest = relevantFeatures.reduce((current, feature) => current.getTime() === 0 || feature.lastUpdated < current ? feature.lastUpdated : current, new Date(0));
  const lengthMeters = input.coordinates.slice(1).reduce((sum, point, index) => sum + distanceMeters(input.coordinates[index], point), 0);
  const factors = {
    severity: confirmed.reduce((maximum, hit) => Math.max(maximum, severityRisk[hit.feature.severity || ''] || 0), 0),
    exposure: Math.min(1, confirmed.reduce((sum, hit) => sum + hit.exposureMeters, 0) / Math.max(100, lengthMeters * 0.25)),
    closure: closures.length ? 1 : 0,
    freshness: oldest.getTime() ? freshnessRisk(oldest, Date.now()) : 0.5,
    uncertainty: Math.min(1, (unverifiedZones.length + nearbyReports.length) / Math.max(1, confirmed.length + closures.length + 1)),
  };
  const riskScore = scoreRouteFactors(factors);
  const known = new Set(input.knownFeatureIds || []);
  const newClosures = closures.filter(({ feature }) => !known.has(feature.id)).map(({ feature }) => ({ id: feature.id, status: feature.status }));
  const newSevereHazards = confirmed.filter(({ feature }) =>
    ['SEVERE', 'CRITICAL'].includes(feature.severity || '') && !known.has(feature.id),
  ).map(({ feature }) => ({ id: feature.id, severity: feature.severity, hazardType: feature.hazardType }));
  const riskDelta = input.previousRiskScore == null ? 0 : riskScore - input.previousRiskScore;
  const freshnessChanged = input.previousFreshness != null && factors.freshness > input.previousFreshness;
  const materialChange = newClosures.length > 0 || newSevereHazards.length > 0 || Math.abs(riskDelta) >= 5 || freshnessChanged;
  return {
    materialChange,
    recalculateRecommended: newClosures.length > 0 || newSevereHazards.length > 0 || riskDelta >= 5 || freshnessChanged,
    riskScore,
    riskDelta,
    freshness: factors.freshness,
    newClosures,
    newSevereHazards,
    currentFeatureIds: hits.map(({ feature }) => feature.id).concat(nearbyReports.map((feature) => feature.id)),
    nearbyUnverifiedReports: nearbyReports.map(({ id, hazardType, severity }) => ({ id, hazardType, severity })),
    checkedAt: new Date().toISOString(),
    message: materialChange
      ? 'Recorded route risk changed. Review these updates and request a new route comparison.'
      : 'No material recorded route-risk change detected. This does not confirm that the route is safe.',
  };
}

export async function geocodeSearch(query: string, fetcher: typeof fetch = fetch) {
  if (query.trim().length < 3) return [];
  const key = configuredServerKey();
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query.trim());
  url.searchParams.set('key', key);
  let response: Response;
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new AppError('Google Geocoding API could not be reached.', 502, 'GEOCODING_PROVIDER_UNAVAILABLE');
  }
  if (!response.ok) throw new AppError('Google Geocoding API failed.', 502, 'GEOCODING_PROVIDER_ERROR');
  let data: { status?: string; results?: Array<{ place_id: string; formatted_address: string; geometry: { location: { lat: number; lng: number } } }> };
  try {
    data = await response.json() as typeof data;
  } catch {
    throw new AppError('Google Geocoding API returned an unreadable response.', 502, 'GEOCODING_PROVIDER_ERROR');
  }
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') throw new AppError('Google Geocoding API returned no usable results.', 502, 'GEOCODING_PROVIDER_ERROR');
  return (data.results || []).slice(0, 5).map((result) => ({
    placeId: result.place_id,
    label: result.formatted_address,
    coordinates: result.geometry.location,
  }));
}

export function getMapsBrowserConfig() {
  const key = env.GOOGLE_MAPS_BROWSER_API_KEY.trim();
  if (!key || /^(mock|your_|replace)/i.test(key)) {
    throw new AppError('Google Maps JavaScript API is not configured.', 503, 'MAPS_NOT_CONFIGURED');
  }
  return { browserApiKey: key, libraries: ['maps', 'marker'] as const };
}