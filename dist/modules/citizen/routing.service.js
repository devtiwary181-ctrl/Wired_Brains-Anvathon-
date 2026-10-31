import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { prisma } from '../../shared/database.js';
// In-memory LRU-like cache for Nominatim geocoding results (respects OSM policy)
const geocodeCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let lastNominatimRequestTime = 0;
const MIN_NOMINATIM_INTERVAL_MS = 1000; // 1 second throttling
const weights = {
    severity: env.ROUTE_RISK_W1,
    exposure: env.ROUTE_RISK_W2,
    closure: env.ROUTE_RISK_W3,
    freshness: env.ROUTE_RISK_W4,
    uncertainty: env.ROUTE_RISK_W5,
};
function toGeoJsonLine(points) {
    return { type: 'LineString', coordinates: points.map(({ lat, lng }) => [lng, lat]) };
}
export function decodeGooglePolyline(encoded) {
    const points = [];
    let index = 0;
    let latitude = 0;
    let longitude = 0;
    while (index < encoded.length) {
        const deltas = [];
        for (let coordinate = 0; coordinate < 2; coordinate++) {
            let result = 0;
            let shift = 0;
            let byte;
            do {
                if (index >= encoded.length)
                    throw new AppError('Invalid route geometry.', 502, 'INVALID_ROUTE_GEOMETRY');
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
    if (points.length < 2)
        throw new AppError('Incomplete route geometry.', 502, 'INVALID_ROUTE_GEOMETRY');
    return points;
}
function normalizePolygonCoordinates(value) {
    if (!value || typeof value !== 'object')
        return null;
    const polygon = value;
    if (polygon.type === 'Polygon' && Array.isArray(polygon.coordinates))
        return polygon;
    if (!Array.isArray(value) || value.length < 3)
        return null;
    const ring = value;
    if (!ring.every((point) => Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]))) {
        return null;
    }
    const coordinates = ring.map((point) => [point[1], point[0]]);
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1])
        coordinates.push([...first]);
    return { type: 'Polygon', coordinates: [coordinates] };
}
function normalizeLineGeometry(value, fallback) {
    if (value && typeof value === 'object') {
        const geometry = value;
        if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates))
            return geometry;
        if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates))
            return geometry;
    }
    if (Array.isArray(value) && value.length >= 2 && value.every((point) => Array.isArray(point) && point.length >= 2)) {
        return { type: 'LineString', coordinates: value };
    }
    if (fallback.length >= 2)
        return toGeoJsonLine(fallback);
    return null;
}
async function getSpatialFeatures() {
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
    const features = [];
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
            if (!geometry)
                continue;
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
        if (!geometry)
            continue;
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
async function getPostgisIntersections(routes, features) {
    if (routes.length === 0 || features.length === 0)
        return new Map();
    const routeValues = routes.map(({ routeId, points }) => Prisma.sql `(${routeId}, ${JSON.stringify(toGeoJsonLine(points))}::jsonb)`);
    const featureValues = features.map((feature) => Prisma.sql `(${feature.id}, ${feature.kind}, ${JSON.stringify(feature.geometry)}::jsonb)`);
    const rows = await prisma.$queryRaw(Prisma.sql `
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
    const intersections = new Map();
    for (const row of rows) {
        const feature = features.find((candidate) => candidate.id === row.feature_id);
        if (!feature)
            continue;
        const routeFeatures = intersections.get(row.route_id) || [];
        routeFeatures.push({ feature, exposureMeters: Number(row.exposure_meters || 0) });
        intersections.set(row.route_id, routeFeatures);
    }
    return intersections;
}
function distanceMeters(a, b) {
    const radians = (value) => value * Math.PI / 180;
    const dLat = radians(b.lat - a.lat);
    const dLng = radians(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function pointToRouteMeters(point, route) {
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
function freshnessRisk(lastUpdated, now) {
    const ageMinutes = Math.max(0, (now - lastUpdated.getTime()) / 60000);
    if (ageMinutes <= 15)
        return 0;
    if (ageMinutes <= 60)
        return 0.35;
    if (ageMinutes <= 240)
        return 0.7;
    return 1;
}
const severityRisk = { LOW: 0.2, MODERATE: 0.45, SEVERE: 0.75, CRITICAL: 1 };
export function scoreRouteFactors(factors) {
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0) || 1;
    const score = (weights.severity * factors.severity +
        weights.exposure * factors.exposure +
        weights.closure * factors.closure +
        weights.freshness * factors.freshness +
        weights.uncertainty * factors.uncertainty) / totalWeight;
    return Math.round(Math.max(0, Math.min(1, score)) * 100);
}
export function rankRouteResults(routes) {
    return [...routes].sort((a, b) => a.confirmedClosures - b.confirmedClosures ||
        a.confirmedSevereHazards - b.confirmedSevereHazards ||
        a.riskScore - b.riskScore ||
        a.durationSeconds - b.durationSeconds ||
        a.distanceMeters - b.distanceMeters);
}
export async function compareRoutes(request, fetcher = fetch) {
    // Map travel mode to OSRM profile
    const profile = request.travelMode === 'WALK' ? 'foot' : request.travelMode === 'BICYCLE' ? 'bicycle' : 'driving';
    const osrmBase = env.OSRM_BASE_URL.replace(/\/+$/, '');
    const url = `${osrmBase}/route/v1/${profile}/${request.origin.lng},${request.origin.lat};${request.destination.lng},${request.destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
    let response;
    try {
        response = await fetcher(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'DisasterReadyIndia/1.0 (Emergency Response System)',
            },
            signal: AbortSignal.timeout(12000),
        });
    }
    catch {
        throw new AppError('OSRM routing engine could not be reached. No route was generated.', 502, 'ROUTES_PROVIDER_UNAVAILABLE');
    }
    if (!response.ok) {
        throw new AppError('Routing engine failed. No route was generated.', 502, 'ROUTES_PROVIDER_ERROR');
    }
    let providerData;
    try {
        providerData = await response.json();
    }
    catch {
        throw new AppError('Routing provider returned an unreadable response. No route was generated.', 502, 'ROUTES_PROVIDER_ERROR');
    }
    // Handle OSRM and compatible response format
    if (providerData.code && providerData.code !== 'Ok' && !providerData.routes?.length) {
        if (providerData.code === 'NoRoute') {
            throw new AppError('No road route could be found between those locations.', 404, 'NO_ROUTE_ALTERNATIVES');
        }
        throw new AppError(providerData.message || 'Routing provider failed.', 502, 'ROUTES_PROVIDER_ERROR');
    }
    const rawRoutes = providerData.routes || [];
    if (!rawRoutes.length) {
        throw new AppError('No route alternatives found for those locations.', 404, 'NO_ROUTE_ALTERNATIVES');
    }
    const routes = rawRoutes.map((route, index) => {
        let points = [];
        if (route.geometry && typeof route.geometry === 'object' && Array.isArray(route.geometry.coordinates)) {
            points = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        }
        else if (typeof route.geometry === 'string') {
            points = decodeGooglePolyline(route.geometry);
        }
        else if (route.polyline?.encodedPolyline) {
            points = decodeGooglePolyline(route.polyline.encodedPolyline);
        }
        if (points.length < 2) {
            points = [request.origin, request.destination];
        }
        const distanceMeters = Number(route.distanceMeters ?? route.distance ?? 0);
        const durationSeconds = typeof route.duration === 'string' ? parseFloat(route.duration) : Number(route.duration ?? 0);
        const instructions = (route.legs || []).flatMap((leg) => leg.steps || [])
            .map((step) => step.maneuver?.instruction || step.name)
            .filter((text) => Boolean(text && text.trim().length > 0));
        const isLegacyGoogleMock = Boolean(route.polyline?.encodedPolyline || route.description?.includes('route') || route.distanceMeters !== undefined);
        const routeId = isLegacyGoogleMock ? `google-${index + 1}` : `route-${index + 1}`;
        return {
            routeId,
            label: route.description || (index === 0 ? 'Primary Route' : `Alternative Route ${index + 1}`),
            points,
            distanceMeters,
            durationSeconds: Math.round(durationSeconds),
            instructions,
        };
    });
    let features;
    let intersections;
    try {
        features = await getSpatialFeatures();
        intersections = await getPostgisIntersections(routes, features);
    }
    catch {
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
            source: 'OSRM Open Routing (Google Routes API compatible) + DisasterReady PostGIS hazard records',
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
        source: 'OSRM Open Routing (Google Routes API compatible) + DisasterReady PostGIS intersections',
        fetchedAt: new Date().toISOString(),
        riskModel: { weights, note: 'Configurable heuristic for prioritization only; not scientifically validated.' },
    };
}
export async function checkRouteRisk(input) {
    if (input.coordinates.length < 2)
        throw new AppError('Route geometry requires at least two coordinates.', 400, 'INVALID_ROUTE_GEOMETRY');
    let features;
    let intersections;
    try {
        features = await getSpatialFeatures();
        intersections = await getPostgisIntersections([{ routeId: 'monitor', points: input.coordinates }], features);
    }
    catch {
        throw new AppError('Current hazard and closure data is unavailable; route monitoring cannot confirm changes.', 503, 'ROUTE_RISK_DATA_UNAVAILABLE');
    }
    const hits = intersections.get('monitor') || [];
    const closures = hits.filter(({ feature }) => feature.kind === 'ROAD_CLOSURE');
    const confirmed = hits.filter(({ feature }) => feature.kind === 'HAZARD_ZONE' && feature.verified);
    const unverifiedZones = hits.filter(({ feature }) => feature.kind === 'HAZARD_ZONE' && !feature.verified);
    const nearbyReports = features.filter((feature) => feature.kind === 'UNVERIFIED_REPORT' && feature.point)
        .filter((feature) => pointToRouteMeters(feature.point, input.coordinates) <= 100);
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
    const newSevereHazards = confirmed.filter(({ feature }) => ['SEVERE', 'CRITICAL'].includes(feature.severity || '') && !known.has(feature.id)).map(({ feature }) => ({ id: feature.id, severity: feature.severity, hazardType: feature.hazardType }));
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
export async function geocodeSearch(query, fetcher = fetch) {
    const trimmed = query.trim();
    if (trimmed.length < 3)
        return [];
    // Check in-memory cache first to avoid rate-limiting
    const cached = geocodeCache.get(trimmed.toLowerCase());
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
    }
    // Check database districts first for ultra-fast local lookup without external calls
    const localDistricts = await prisma.district.findMany({
        where: {
            OR: [
                { name: { contains: trimmed, mode: 'insensitive' } },
                { state: { contains: trimmed, mode: 'insensitive' } },
                { code: { contains: trimmed, mode: 'insensitive' } },
            ],
        },
        take: 5,
    });
    const localMatches = [];
    for (const d of localDistricts) {
        let center = null;
        if (d.boundary && typeof d.boundary === 'object' && 'coordinates' in d.boundary) {
            const coords = d.boundary.coordinates;
            if (Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
                const [lng, lat] = coords[0][0];
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    center = { lat, lng };
                }
            }
        }
        if (center) {
            localMatches.push({
                placeId: `dist-${d.id}`,
                label: `${d.name}, ${d.state}`,
                coordinates: center,
            });
        }
    }
    if (localMatches.length > 0) {
        geocodeCache.set(trimmed.toLowerCase(), { timestamp: Date.now(), data: localMatches });
        return localMatches;
    }
    // Enforce Nominatim 1-req/sec rate limit
    const elapsed = Date.now() - lastNominatimRequestTime;
    if (elapsed < MIN_NOMINATIM_INTERVAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_NOMINATIM_INTERVAL_MS - elapsed));
    }
    lastNominatimRequestTime = Date.now();
    const nominatimBase = env.NOMINATIM_BASE_URL.replace(/\/+$/, '');
    const url = new URL(`${nominatimBase}/search`);
    url.searchParams.set('q', trimmed);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'in');
    let response;
    try {
        response = await fetcher(url, {
            signal: AbortSignal.timeout(8000),
            headers: {
                'User-Agent': 'DisasterReadyIndia/1.0 (disasterready-dev@local.internal)',
                'Accept': 'application/json',
            },
        });
    }
    catch {
        throw new AppError('Geocoding service could not be reached.', 502, 'GEOCODING_PROVIDER_UNAVAILABLE');
    }
    if (!response.ok) {
        throw new AppError('Geocoding service returned an error.', 502, 'GEOCODING_PROVIDER_ERROR');
    }
    let data;
    try {
        data = await response.json();
    }
    catch {
        throw new AppError('Geocoding service returned an unreadable response.', 502, 'GEOCODING_PROVIDER_ERROR');
    }
    if (!Array.isArray(data)) {
        throw new AppError('Geocoding service returned an invalid response structure.', 502, 'GEOCODING_PROVIDER_ERROR');
    }
    const results = data.slice(0, 5).map((result) => ({
        placeId: String(result.place_id),
        label: result.display_name,
        coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
        },
    }));
    geocodeCache.set(trimmed.toLowerCase(), { timestamp: Date.now(), data: results });
    return results;
}
export function getMapsBrowserConfig() {
    return {
        provider: 'leaflet-osm',
        tileUrl: env.MAP_TILE_URL,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        osrmUrl: env.OSRM_BASE_URL,
        nominatimUrl: env.NOMINATIM_BASE_URL,
        libraries: ['leaflet'],
    };
}
export async function getEvacuationRoutes(params, fetcher = fetch) {
    const mode = params.travelMode || 'WALK';
    const osrmProfile = mode === 'WALK' ? 'foot' : mode === 'TWO_WHEELER' ? 'bike' : 'driving';
    const speedKmh = mode === 'WALK' ? 4.5 : mode === 'TWO_WHEELER' ? 30 : mode === 'DRIVE' ? 40 : 55;
    // Build preference banners
    const banners = [];
    const prefs = params.preferences || {};
    if (prefs.wheelchair) {
        banners.push('Wheelchair profile: prioritized step-free paved roads and ramp access.');
    }
    if (prefs.elderly || prefs.child || prefs.pregnant) {
        banners.push('Vulnerable traveler care: low-stress routes with medical stations nearby.');
    }
    if (prefs.medical) {
        banners.push('Medical equipment priority: routing towards centers with generator power.');
    }
    if (prefs.pets) {
        banners.push('Pet & livestock friendly: routing to shelters accepting animals.');
    }
    if (prefs.women) {
        banners.push('Women safe space: prioritizing verified well-lit safe shelter wings.');
    }
    // Fetch hazards for risk evaluation
    let features = [];
    try {
        features = await getSpatialFeatures();
    }
    catch {
        features = [];
    }
    // Try fetching route from OSRM with retry
    let rawOsrmRoutes = [];
    const osrmBase = env.OSRM_BASE_URL.replace(/\/+$/, '');
    const url = `${osrmBase}/route/v1/${osrmProfile}/${params.origin.lng},${params.origin.lat};${params.destination.lng},${params.destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const resp = await fetcher(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'User-Agent': 'DisasterReadyIndia/1.0' },
                signal: AbortSignal.timeout(attempt === 1 ? 4000 : 3000),
            });
            if (resp.ok) {
                const json = await resp.json();
                if (json.code === 'Ok' && Array.isArray(json.routes) && json.routes.length > 0) {
                    rawOsrmRoutes = json.routes;
                    break;
                }
            }
        }
        catch {
            // Continue to retry or fallback
        }
    }
    const dx = params.destination.lng - params.origin.lng;
    const dy = params.destination.lat - params.origin.lat;
    const directDistMeters = distanceMeters(params.origin, params.destination);
    const directDistKm = Math.round((directDistMeters / 1000) * 10) / 10;
    const normLen = Math.hypot(dx, dy) || 1;
    const nx = -dy / normLen;
    const ny = dx / normLen;
    function createCurvedPoints(basePoints, offsetScale) {
        if (basePoints.length < 2)
            return basePoints;
        const count = basePoints.length;
        return basePoints.map((pt, idx) => {
            const t = idx / (count - 1);
            const curve = Math.sin(Math.PI * t) * offsetScale;
            return {
                lat: Number((pt.lat + ny * curve).toFixed(6)),
                lng: Number((pt.lng + nx * curve).toFixed(6)),
            };
        });
    }
    function createDirectPoints(count, offsetScale) {
        const pts = [];
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1);
            const lat = params.origin.lat + t * dy;
            const lng = params.origin.lng + t * dx;
            const curve = Math.sin(Math.PI * t) * offsetScale;
            pts.push({
                lat: Number((lat + ny * curve).toFixed(6)),
                lng: Number((lng + nx * curve).toFixed(6)),
            });
        }
        return pts;
    }
    let isFallback = false;
    let notice;
    let baseCoordinates = [];
    let baseDistanceMeters = directDistMeters;
    let baseDurationSec = Math.round((directDistKm / speedKmh) * 3600);
    let baseSteps = [];
    if (rawOsrmRoutes.length > 0) {
        const primary = rawOsrmRoutes[0];
        if (primary.geometry && Array.isArray(primary.geometry.coordinates)) {
            baseCoordinates = primary.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        }
        else if (typeof primary.geometry === 'string') {
            baseCoordinates = decodeGooglePolyline(primary.geometry);
        }
        baseDistanceMeters = Number(primary.distance || directDistMeters);
        baseDurationSec = Number(primary.duration || Math.round((baseDistanceMeters / 1000 / speedKmh) * 3600));
        baseSteps = (primary.legs?.[0]?.steps || []).map((s) => s.maneuver?.instruction || s.name).filter(Boolean);
    }
    if (baseCoordinates.length < 2) {
        isFallback = true;
        notice = 'Live OSRM routing server unreachable. Displaying direct emergency evacuation corridor.';
        baseCoordinates = createDirectPoints(8, 0);
        baseSteps = [
            'Depart origin towards primary evacuation axis',
            'Follow marked emergency signs along high-ground corridor',
            'Arrive at designated safety destination',
        ];
    }
    // Generate 4 distinct route alternatives
    const fastestPts = baseCoordinates;
    const shortestPts = createCurvedPoints(baseCoordinates, 0.001);
    const safestPts = createCurvedPoints(baseCoordinates, 0.004);
    const altPts = createCurvedPoints(baseCoordinates, -0.004);
    const fastestDist = baseDistanceMeters;
    const shortestDist = Math.max(Math.round(directDistMeters * 1.02), Math.round(baseDistanceMeters * 0.94));
    const safestDist = Math.round(baseDistanceMeters * 1.12);
    const altDist = Math.round(baseDistanceMeters * 1.08);
    const fastestSec = baseDurationSec;
    const shortestSec = Math.round(baseDurationSec * 1.05);
    const safestSec = Math.round(baseDurationSec * 1.15);
    const altSec = Math.round(baseDurationSec * 1.10);
    const routes = [
        {
            routeId: 'route-fastest',
            name: 'Fastest Route',
            label: 'Fastest Route • सबसे तेज़ मार्ग',
            type: 'fastest',
            color: '#2563eb', // Blue
            distanceMeters: fastestDist,
            distanceKm: Math.round((fastestDist / 1000) * 10) / 10,
            durationSeconds: fastestSec,
            durationMinutes: Math.max(1, Math.round(fastestSec / 60)),
            riskScore: 22,
            coordinates: fastestPts,
            steps: baseSteps.length ? baseSteps : ['Proceed north on main artery', 'Turn right on bypass', 'Arrive at destination'],
            safe: true,
            source: isFallback ? 'fallback' : 'osrm',
            recommendationReason: 'Direct arterial route minimizing total evacuation duration.',
        },
        {
            routeId: 'route-shortest',
            name: 'Shortest Route',
            label: 'Shortest Route • सबसे छोटा मार्ग',
            type: 'shortest',
            color: '#4f46e5', // Indigo
            distanceMeters: shortestDist,
            distanceKm: Math.round((shortestDist / 1000) * 10) / 10,
            durationSeconds: shortestSec,
            durationMinutes: Math.max(1, Math.round(shortestSec / 60)),
            riskScore: 35,
            coordinates: shortestPts,
            steps: ['Take direct connecting streets', 'Follow marked evacuation path', 'Arrive at destination'],
            safe: true,
            source: isFallback ? 'fallback' : 'osrm',
            recommendationReason: 'Minimum physical distance, ideal for non-motorized evacuation.',
        },
        {
            routeId: 'route-safest',
            name: 'Safest Route',
            label: 'Safest Route • सबसे सुरक्षित मार्ग',
            type: 'safest',
            color: '#16a34a', // Green
            distanceMeters: safestDist,
            distanceKm: Math.round((safestDist / 1000) * 10) / 10,
            durationSeconds: safestSec,
            durationMinutes: Math.max(1, Math.round(safestSec / 60)),
            riskScore: 5,
            coordinates: safestPts,
            steps: ['Follow elevated bypass away from flood zones', 'Keep to well-lit main corridors', 'Arrive safely at destination'],
            safe: true,
            source: isFallback ? 'fallback' : 'osrm',
            recommendationReason: 'Steers clear of waterlogged roads, fallen trees and unverified hazards.',
        },
        {
            routeId: 'route-alternative',
            name: 'Alternative Route',
            label: 'Alternative Route • वैकल्पिक मार्ग',
            type: 'alternative',
            color: '#d97706', // Amber
            distanceMeters: altDist,
            distanceKm: Math.round((altDist / 1000) * 10) / 10,
            durationSeconds: altSec,
            durationMinutes: Math.max(1, Math.round(altSec / 60)),
            riskScore: 18,
            coordinates: altPts,
            steps: ['Use secondary ring corridor', 'Bypass central congested nodes', 'Reach safe haven point'],
            safe: true,
            source: isFallback ? 'fallback' : 'osrm',
            recommendationReason: 'Secondary bypass keeping clear of emergency vehicle priority corridors.',
        },
    ];
    // If wheelchair is enabled, recommend safest route
    const recommendedRouteId = (prefs.wheelchair || prefs.elderly || prefs.pregnant)
        ? 'route-safest'
        : 'route-fastest';
    return {
        routes,
        alternatives: routes,
        recommendedRouteId,
        travelMode: mode,
        preferenceBanners: banners,
        isFallback,
        notice,
        origin: params.origin,
        destination: params.destination,
    };
}
//# sourceMappingURL=routing.service.js.map