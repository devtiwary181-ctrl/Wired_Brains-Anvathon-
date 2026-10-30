import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting DisasterReady India Database Seeding (Demo & Test Data)...');

  // 1. Initial Super-Admin Setup (Argon2id password)
  const defaultAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@DisasterReady2026!';
  const hashedPassword = await argon2.hash(defaultAdminPassword);

  // 2. Administrative Districts
  const centralDelhi = await prisma.district.upsert({
    where: { code: 'IN-DL-CENTRAL' },
    update: {},
    create: {
      code: 'IN-DL-CENTRAL',
      name: 'Central Delhi',
      state: 'Delhi',
      eocPhone: '+91-11-2338-1122',
    },
  });

  const kolkataSouth = await prisma.district.upsert({
    where: { code: 'IN-WB-KOLKATA' },
    update: {},
    create: {
      code: 'IN-WB-KOLKATA',
      name: 'South 24 Parganas & Kolkata',
      state: 'West Bengal',
      eocPhone: '+91-33-2214-5566',
    },
  });

  // 3. Staff Users
  await prisma.staffUser.upsert({
    where: { username: 'EOC-DIR-001' },
    update: {},
    create: {
      username: 'EOC-DIR-001',
      fullName: 'Dr. Rajesh Sharma',
      email: 'rajesh.sharma@ndma.gov.in',
      phoneNumber: '+919811122233',
      passwordHash: hashedPassword,
      role: 'EOC_DIRECTOR',
      districtId: centralDelhi.id,
      isActive: true,
    },
  });

  await prisma.staffUser.upsert({
    where: { username: 'LOG-OFF-002' },
    update: {},
    create: {
      username: 'LOG-OFF-002',
      fullName: 'Priya Mukherjee',
      email: 'priya.mukherjee@sdma.wb.gov.in',
      phoneNumber: '+919833344455',
      passwordHash: hashedPassword,
      role: 'LOGISTICS_OFFICER',
      districtId: kolkataSouth.id,
      isActive: true,
    },
  });

  // 4. Official Disaster Alerts (IMD / NDMA)
  await prisma.disasterAlert.createMany({
    data: [
      {
        districtId: centralDelhi.id,
        title: 'Yamuna River Flash Inundation Advisory - Orange Alert',
        severity: 'WARNING',
        disasterType: 'FLOOD',
        summary: 'Water level at Old Railway Bridge reached 206.4m, crossing danger mark. Low-lying riverbeds under active evacuation.',
        instructions: 'Avoid Ring Road underpass and Kashmiri Gate bus terminus. Proceed to nearest designated dry relief shelters.',
        sourceAgency: 'Central Water Commission & NDMA',
        isActive: true,
      },
      {
        districtId: kolkataSouth.id,
        title: 'Severe Cyclone Coastal Alert (Category 3)',
        severity: 'DANGER',
        disasterType: 'CYCLONE',
        summary: 'Gale wind gusts up to 110 kmph accompanied by tidal surge expected in coastal river estuaries.',
        instructions: 'All fishing activities prohibited. Residents within 2 km of embankment must shift to Cyclone Shelters.',
        sourceAgency: 'India Meteorological Department (IMD)',
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  // 5. Verified Safe Places (Shelters & Hospitals)
  const shelters = [
    {
      districtId: centralDelhi.id,
      facilityType: 'SHELTER',
      name: 'Sarvodaya Kanya Vidyalaya Relief Camp',
      address: 'Near Old Delhi Railway Station, SPM Marg',
      latitude: 28.6562,
      longitude: 77.2285,
      contactPhone: '+91-11-2386-4512',
      inChargeName: 'Inspector Anita Verma',
      totalCapacity: 450,
      currentOccupancy: 285,
      isVerified: true,
      hasMedicalSupport: true,
      hasGeneratorPower: true,
      hasDrinkingWater: true,
      hasInfantCare: true,
      isPetFriendly: true,
      operatingStatus: 'OPERATIONAL',
    },
    {
      districtId: centralDelhi.id,
      facilityType: 'HOSPITAL',
      name: 'Lok Nayak Jai Prakash Narayan Hospital (LNJP)',
      address: 'Jawaharlal Nehru Marg, Delhi Gate',
      latitude: 28.6366,
      longitude: 77.2415,
      contactPhone: '+91-11-2323-3000',
      inChargeName: 'Dr. Suresh Kumar (Medical Director)',
      totalCapacity: 2000,
      currentOccupancy: 1720,
      isVerified: true,
      hasMedicalSupport: true,
      hasGeneratorPower: true,
      hasDrinkingWater: true,
      hasInfantCare: true,
      operatingStatus: 'OPERATIONAL',
    },
    {
      districtId: kolkataSouth.id,
      facilityType: 'SHELTER',
      name: 'Kakdwip Multipurpose Cyclone Shelter',
      address: 'Embankment Road, Kakdwip Sub-Division',
      latitude: 21.8744,
      longitude: 88.1887,
      contactPhone: '+91-3210-255-123',
      inChargeName: 'Subrata Mondal (Block Officer)',
      totalCapacity: 800,
      currentOccupancy: 420,
      isVerified: true,
      hasMedicalSupport: true,
      hasGeneratorPower: true,
      hasDrinkingWater: true,
      hasInfantCare: true,
      isPetFriendly: true,
      operatingStatus: 'OPERATIONAL',
    },
  ];

  for (const f of shelters) {
    await prisma.facility.create({ data: f });
  }

  // 6. Hazard Incidents & Inundation Polygons
  const hazard1 = await prisma.hazardIncident.create({
    data: {
      districtId: centralDelhi.id,
      hazardType: 'WATERLOGGING',
      severity: 'SEVERE',
      latitude: 28.6655,
      longitude: 77.2341,
      addressLandmark: 'Salimgarh Bypass Bridge Underpass',
      waterDepthCm: 85,
      status: 'VERIFIED_ACTIVE',
      reportedByCitizen: false,
    },
  });

  await prisma.hazardPolygon.create({
    data: {
      incidentId: hazard1.id,
      zoneType: 'INUNDATION_ZONE',
      depthM: 0.85,
      isActive: true,
      coordinates: [
        [28.667, 77.232],
        [28.668, 77.236],
        [28.663, 77.237],
        [28.662, 77.231],
      ],
    },
  });

  // 7. Relief Depots & Available Inventory
  const depot = await prisma.reliefDepot.create({
    data: {
      districtId: centralDelhi.id,
      name: 'NDRF Central Warehousing & Airfield Base',
      latitude: 28.5833,
      longitude: 77.2167,
      contactPhone: '+91-11-2462-8900',
      isOperational: true,
    },
  });

  await prisma.depotInventory.createMany({
    data: [
      {
        depotId: depot.id,
        itemSku: 'WATER_20L',
        itemName: '20L Potable Water Jerrycan',
        quantityAvailable: 1200,
        quantityReserved: 150,
        unit: 'cans',
      },
      {
        depotId: depot.id,
        itemSku: 'DRY_RATION_KIT',
        itemName: '72-Hour Family Dry Ration Pack',
        quantityAvailable: 850,
        quantityReserved: 90,
        unit: 'kits',
      },
      {
        depotId: depot.id,
        itemSku: 'BABY_FORMULA',
        itemName: 'Infant Milk Formula & Baby Food Pack',
        quantityAvailable: 320,
        quantityReserved: 40,
        unit: 'packs',
      },
      {
        depotId: depot.id,
        itemSku: 'FIRST_AID_KIT',
        itemName: 'Emergency Medical & Trauma Bandage Kit',
        quantityAvailable: 500,
        quantityReserved: 25,
        unit: 'kits',
      },
      {
        depotId: depot.id,
        itemSku: 'TARPAULIN',
        itemName: 'Heavy Duty Waterproof Tarpaulin (12x18ft)',
        quantityAvailable: 700,
        quantityReserved: 80,
        unit: 'sheets',
      },
    ],
  });

  // 8. Sample Citizen Relief Requests (Multi-Stage Triage)
  await prisma.reliefRequest.upsert({
    where: { trackingToken: 'RELIEF-IN-8492-XQ7' },
    update: {},
    create: {
      trackingToken: 'RELIEF-IN-8492-XQ7',
      districtId: centralDelhi.id,
      requesterPhone: '+919876543210',
      headcountAdults: 4,
      headcountChildren: 2,
      headcountInfants: 1,
      headcountSeniors: 1,
      deliveryContext: 'ROOFTOP_STRANDED',
      urgencyLevel: 'CRITICAL_LIFE_SAFETY',
      latitude: 28.6612,
      longitude: 77.2319,
      landmarkNotes: 'Yellow double-storey roof, near Jama Masjid North Gate water tank',
      itemsRequested: {
        drinkingWater: true,
        foodKits: 6,
        babyFormula: true,
        firstAidKit: true,
      },
      specialMedicalNeeds: 'Insulin refrigeration required for 68-year-old grandfather',
      stage: 'STAGE_3_ALLOCATED',
      assignedDepotId: depot.id,
      etaMinutes: 35,
    },
  });

  // 9. Preparedness Guides
  await prisma.preparednessGuide.createMany({
    data: [
      {
        disasterType: 'FLOOD',
        title: 'National Flood Safety & Survival Protocol',
        sections: {
          goBag: [
            '3-day bottled drinking water (3L/person/day)',
            'Water purification tablets (Chlorine/Halazone)',
            'Non-perishable food (roasted gram, biscuits, dates)',
            'Battery-operated AM/FM pocket radio',
            'Waterproof pouch for Aadhaar, ration card, property deeds',
            'Heavy-duty whistle with lanyard',
          ],
          duringFlood: [
            'Switch off main electrical circuit board immediately before water enters premises.',
            'Never walk through moving water deeper than 15cm; currents can sweep adults away.',
            'Watch for displaced venomous snakes and reptiles seeking dry shelter on furniture and roofs.',
          ],
        },
      },
      {
        disasterType: 'CYCLONE',
        title: 'Coastal Cyclone Readiness & Evacuation Protocol',
        sections: {
          preparation: [
            'Board or tape glass window panes to prevent flying shard injuries.',
            'Clear tree branches touching overhead electrical cables.',
            'Store emergency mobile power banks charged to 100%.',
          ],
        },
      },
    ],
  });

  // 10. Public Transparency Ledger Entry #1
  await prisma.transparencyLedger.create({
    data: {
      transactionType: 'INITIAL_SYSTEM_GENESIS',
      districtId: centralDelhi.id,
      details: {
        action: 'Relief inventory allocated for Central Delhi Flood Response',
        authorizedBy: 'EOC Director Dr. Rajesh Sharma',
        timestamp: new Date().toISOString(),
      },
      previousBlockHash: '0000000000000000000000000000000000000000000000000000000000000000',
      currentBlockHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
  });

  // PostGIS spatial sync for newly inserted seeds
  await prisma.$executeRawUnsafe(`UPDATE hazard_incidents SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE geom IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE facilities SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE geom IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE relief_requests SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE geom IS NULL;`);
  await prisma.$executeRawUnsafe(`UPDATE relief_depots SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE geom IS NULL;`);

  console.log('✅ Seeding completed successfully with realistic Indian disaster management data.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
