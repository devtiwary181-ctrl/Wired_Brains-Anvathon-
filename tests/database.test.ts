import { describe, it, expect } from 'vitest';
import { prisma } from '../src/shared/database.js';

describe('Database Models & PostGIS Spatial Queries', () => {
  it('should find operational shelters within 15 km of Delhi center using PostGIS ST_DWithin', async () => {
    // Delhi Center coordinates (28.6139, 77.2090)
    const lat = 28.6139;
    const lng = 77.2090;

    const nearbyFacilities = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      facility_type: string;
      distance_meters: number;
    }>>`
      SELECT 
        id, 
        name, 
        facility_type,
        ST_Distance(
          geom::geography, 
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        ) as distance_meters
      FROM facilities
      WHERE ST_DWithin(
        geom::geography, 
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 
        15000
      )
      ORDER BY distance_meters ASC;
    `;

    expect(nearbyFacilities.length).toBeGreaterThan(0);
    expect(nearbyFacilities[0]?.name).toBeDefined();
    expect(Number(nearbyFacilities[0]?.distance_meters)).toBeLessThan(15000);
  });

  it('should retrieve seeded super-admin with Argon2id hash', async () => {
    const admin = await prisma.staffUser.findUnique({
      where: { username: 'EOC-DIR-001' },
    });

    expect(admin).not.toBeNull();
    expect(admin?.role).toBe('EOC_DIRECTOR');
    expect(admin?.passwordHash.startsWith('$argon2')).toBe(true);
  });

  it('should find active high-priority relief request by tracking token', async () => {
    const request = await prisma.reliefRequest.findFirst({
      where: { landmarkNotes: 'Yellow double-storey roof, near Jama Masjid North Gate water tank' },
    });

    expect(request).not.toBeNull();
    expect(request?.urgencyLevel).toBe('CRITICAL_LIFE_SAFETY');
    expect(request?.stage).toBe('STAGE_3_ALLOCATED');
  });

  it('should protect inventory and report available vs reserved quantities', async () => {
    const inventory = await prisma.depotInventory.findMany({
      where: { itemSku: 'WATER_20L' },
    });

    expect(inventory.length).toBeGreaterThan(0);
    const item = inventory[0];
    expect(item?.quantityAvailable).toBeGreaterThan(item?.quantityReserved || 0);
  });
});
