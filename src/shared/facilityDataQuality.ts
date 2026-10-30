import { prisma } from './database.js';

export const FACILITY_TRACKED_FIELDS = [
  'contactPhone',
  'totalCapacity',
  'currentOccupancy',
  'hasMedicalSupport',
  'hasGeneratorPower',
  'hasDrinkingWater',
  'hasInfantCare',
  'isPetFriendly',
] as const;

export type FacilityTrackedField = (typeof FACILITY_TRACKED_FIELDS)[number];

export async function getFacilityUnknownFields(facilityIds: string[]) {
  const result = new Map<string, Set<FacilityTrackedField>>();
  if (!facilityIds.length) return result;
  const logs = await prisma.auditLog.findMany({
    where: { entityType: 'Facility', entityId: { in: facilityIds } },
    select: { entityId: true, action: true, metadata: true, timestamp: true },
    orderBy: { timestamp: 'desc' },
  });
  const decided = new Map<string, Set<string>>();
  const valid = new Set<string>(FACILITY_TRACKED_FIELDS);
  for (const log of logs) {
    const metadata = log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
      ? log.metadata as Record<string, unknown>
      : {};
    const unknown = Array.isArray(metadata.markedUnknown) ? metadata.markedUnknown.filter((field): field is FacilityTrackedField => typeof field === 'string' && valid.has(field)) : [];
    const changed = Array.isArray(metadata.changedFields) ? metadata.changedFields.filter((field): field is string => typeof field === 'string' && valid.has(field)) : [];
    const handled = decided.get(log.entityId) || new Set<string>();
    const values = result.get(log.entityId) || new Set<FacilityTrackedField>();
    for (const field of [...unknown, ...changed]) {
      if (handled.has(field)) continue;
      handled.add(field);
      if (unknown.includes(field as FacilityTrackedField)) values.add(field as FacilityTrackedField);
    }
    decided.set(log.entityId, handled);
    result.set(log.entityId, values);
  }
  return result;
}
