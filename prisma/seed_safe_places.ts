import { prisma } from '../src/shared/database.js';

// Realistic distribution across Indian states
const STATE_DISTRICTS = [
  { state: 'Karnataka', districtName: 'Bengaluru (Bangalore) Urban', baseLat: 12.9716, baseLng: 77.5946 },
  { state: 'Karnataka', districtName: 'Bengaluru (Bangalore) Rural', baseLat: 13.2847, baseLng: 77.5543 },
  { state: 'Maharashtra', districtName: 'Mumbai', baseLat: 18.9220, baseLng: 72.8347 },
  { state: 'Maharashtra', districtName: 'Pune', baseLat: 18.5204, baseLng: 73.8567 },
  { state: 'Delhi (NCT)', districtName: 'Central Delhi', baseLat: 28.6139, baseLng: 77.2090 },
  { state: 'Tamil Nadu', districtName: 'Chennai', baseLat: 13.0827, baseLng: 80.2707 },
  { state: 'Telangana', districtName: 'Hyderabad', baseLat: 17.3850, baseLng: 78.4867 },
  { state: 'Andhra Pradesh', districtName: 'Visakhapatnam', baseLat: 17.6868, baseLng: 83.2185 },
  { state: 'Kerala', districtName: 'Wayanad', baseLat: 11.6854, baseLng: 76.1320 },
  { state: 'Kerala', districtName: 'Ernakulam', baseLat: 9.9816, baseLng: 76.2999 },
  { state: 'West Bengal', districtName: 'Kolkata', baseLat: 22.5726, baseLng: 88.3639 },
  { state: 'Odisha', districtName: 'Puri', baseLat: 19.8135, baseLng: 85.8312 },
  { state: 'Gujarat', districtName: 'Ahmedabad', baseLat: 23.0225, baseLng: 72.5714 },
  { state: 'Uttar Pradesh', districtName: 'Lucknow', baseLat: 26.8467, baseLng: 80.9462 },
  { state: 'Bihar', districtName: 'Patna', baseLat: 25.5941, baseLng: 85.1376 },
  { state: 'Assam', districtName: 'Kamrup Metropolitan (Guwahati)', baseLat: 26.1445, baseLng: 91.7362 },
  { state: 'Goa', districtName: 'North Goa', baseLat: 15.4909, baseLng: 73.8278 }
];

const SHELTER_TYPES = ['COMMUNITY_CENTER', 'GOVERNMENT_SCHOOL', 'INDOOR_STADIUM', 'RELIEF_CAMP', 'POLYTECHNIC_COLLEGE'];
const HAZARDS = ['flood', 'cyclone', 'earthquake', 'fire', 'landslide'];

async function main() {
  console.log('Seeding shelters and hospitals across Indian states...');

  // Match or find districts in the DB
  const allDistricts = await prisma.district.findMany({
    select: { id: true, name: true, state: true }
  });

  const resolvedDistricts = [];
  for (const item of STATE_DISTRICTS) {
    const matched = allDistricts.find(d => 
      d.state.toLowerCase().includes(item.state.toLowerCase()) && 
      (d.name.toLowerCase().includes(item.districtName.toLowerCase()) || item.districtName.toLowerCase().includes(d.name.toLowerCase()))
    ) || allDistricts.find(d => d.state.toLowerCase().includes(item.state.toLowerCase()));

    if (matched) {
      resolvedDistricts.push({ ...item, districtId: matched.id, actualName: matched.name });
    }
  }

  console.log(`Resolved ${resolvedDistricts.length} base district clusters.`);

  // Generate 180 Shelters and 120 Hospitals
  const facilitiesToCreate = [];

  let shelterCounter = 1;
  let hospitalCounter = 1;

  for (const cluster of resolvedDistricts) {
    // 10-12 shelters per cluster
    const sheltersInCluster = 11;
    for (let i = 0; i < sheltersInCluster; i++) {
      const latOffset = (Math.random() - 0.5) * 0.15;
      const lngOffset = (Math.random() - 0.5) * 0.15;
      const lat = cluster.baseLat + latOffset;
      const lng = cluster.baseLng + lngOffset;

      const type = SHELTER_TYPES[i % SHELTER_TYPES.length];
      const hasRamp = Math.random() > 0.3;
      const hasWomen = Math.random() > 0.25;
      const hasInfant = Math.random() > 0.35;
      const hasGen = Math.random() > 0.2;
      const hasDoc = Math.random() > 0.3;
      const hasPet = Math.random() > 0.5;
      const hasWater = true;

      // Assign hazard suitability
      const suitableHazards = HAZARDS.filter(() => Math.random() > 0.4);
      if (suitableHazards.length === 0) suitableHazards.push('flood', 'cyclone');

      facilitiesToCreate.push({
        districtId: cluster.districtId,
        facilityType: 'SHELTER',
        name: `Civil Safe Haven #${shelterCounter} - ${cluster.actualName} ${type.replace(/_/g, ' ')}`,
        address: `Sector ${i + 1}, Near Relief Depot ${cluster.state}, ${cluster.actualName}`,
        latitude: lat,
        longitude: lng,
        contactPhone: `+91 ${Math.floor(6000000000 + Math.random() * 3999999999)}`,
        inChargeName: `Relief Officer ${String.fromCharCode(65 + (i % 26))}. Sharma`,
        totalCapacity: Math.floor(150 + Math.random() * 600),
        currentOccupancy: Math.floor(20 + Math.random() * 120),
        isVerified: true,
        hasMedicalSupport: hasDoc,
        hasGeneratorPower: hasGen,
        hasDrinkingWater: hasWater,
        hasInfantCare: hasInfant,
        isPetFriendly: hasPet,
        hasWheelchairRamp: hasRamp,
        hasWomenWing: hasWomen,
        hazardSuitability: suitableHazards,
        operatingStatus: 'OPERATIONAL'
      });
      shelterCounter++;
    }

    // 7-8 hospitals per cluster
    const hospitalsInCluster = 7;
    for (let j = 0; j < hospitalsInCluster; j++) {
      const latOffset = (Math.random() - 0.5) * 0.14;
      const lngOffset = (Math.random() - 0.5) * 0.14;
      const lat = cluster.baseLat + latOffset;
      const lng = cluster.baseLng + lngOffset;

      facilitiesToCreate.push({
        districtId: cluster.districtId,
        facilityType: 'HOSPITAL',
        name: `District Emergency Hospital #${hospitalCounter} - ${cluster.actualName}`,
        address: `Civil Hospital Road, Zone ${j + 1}, ${cluster.actualName}, ${cluster.state}`,
        latitude: lat,
        longitude: lng,
        contactPhone: `+91 ${Math.floor(7000000000 + Math.random() * 2999999999)}`,
        inChargeName: `Dr. ${String.fromCharCode(65 + (j % 26))}. Mukherjee (Chief Medical Officer)`,
        totalCapacity: Math.floor(200 + Math.random() * 800),
        currentOccupancy: Math.floor(80 + Math.random() * 250),
        isVerified: true,
        hasMedicalSupport: true,
        hasGeneratorPower: true,
        hasDrinkingWater: true,
        hasInfantCare: true,
        isPetFriendly: false,
        hasWheelchairRamp: true,
        hasWomenWing: true,
        hazardSuitability: ['flood', 'cyclone', 'earthquake', 'fire', 'landslide'],
        operatingStatus: 'OPERATIONAL'
      });
      hospitalCounter++;
    }
  }

  console.log(`Generated ${facilitiesToCreate.length} facilities (${shelterCounter - 1} shelters, ${hospitalCounter - 1} hospitals). Inserting into DB...`);

  // Bulk create in chunks
  const chunkSize = 50;
  for (let i = 0; i < facilitiesToCreate.length; i += chunkSize) {
    const chunk = facilitiesToCreate.slice(i, i + chunkSize);
    await prisma.facility.createMany({
      data: chunk
    });
  }

  // Update PostGIS geom point column if present
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE facilities 
      SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
      WHERE geom IS NULL;
    `);
    console.log('Updated PostGIS geometry columns successfully!');
  } catch (err) {
    console.log('PostGIS update note:', err.message);
  }

  const finalShelterCount = await prisma.facility.count({ where: { facilityType: 'SHELTER' } });
  const finalHospitalCount = await prisma.facility.count({ where: { facilityType: 'HOSPITAL' } });
  console.log(`DATABASE SEED COMPLETE: ${finalShelterCount} Shelters, ${finalHospitalCount} Hospitals.`);
}

main().catch(console.error).finally(() => process.exit(0));

