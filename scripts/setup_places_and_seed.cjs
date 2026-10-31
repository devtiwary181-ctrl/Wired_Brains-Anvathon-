/**
 * Setup Places Table and Seed 2,000+ Realistic Sample Places
 *
 * NOTE: The data seeded in this table represents realistic SAMPLE DATA
 * across Indian states and districts for NDMA emergency evacuation simulation.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setup() {
  console.log('--- 1. Creating places table and indexes in PostgreSQL ---');
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS places (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      name_hi VARCHAR(255),
      alt_names TEXT[] DEFAULT '{}',
      type VARCHAR(50) NOT NULL,
      district VARCHAR(100) NOT NULL,
      state VARCHAR(100) NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS places_name_trgm_idx ON places USING gin (name gin_trgm_ops);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS places_name_hi_trgm_idx ON places USING gin (name_hi gin_trgm_ops);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS places_district_idx ON places (district);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS places_state_idx ON places (state);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS places_type_idx ON places (type);`);

  console.log('--- 2. Generating 2,000+ Realistic Sample Places across India ---');

  // Core regions with accurate baseline coordinates
  const regions = [
    {
      state: 'Gujarat',
      district: 'Devbhumi Dwarka',
      baseLat: 22.2442,
      baseLng: 68.9685,
      cities: ['Dwarka', 'Okha', 'Beyt Dwarka', 'Kuranga', 'Varwala', 'Rupen', 'Mithapur'],
      namesEn: [
        'Dwarkadhish Temple', 'Dwarka Lighthouse', 'Gomti Ghat', 'Rukmini Devi Temple',
        'Shivrajpur Beach Evacuation Center', 'Okha Port Terminal', 'Beyt Dwarka Jetty',
        'Dwarka Central Bus Stand', 'Dwarka Railway Station', 'Dwarka Civil Hospital',
        'Okha Community Hall', 'Mithapur High School', 'Dwarka Market Square',
        'Gopi Talav Relief Point', 'Nageshwar Jyotirlinga Camp', 'Kuranga Village Node',
        'Varwala Panchayat Ghar', 'Rupen Port Assembly Point', 'Dwarka Post Office Ward',
        'Dwarka Sector 1 Relief Depot', 'Dwarka Sector 2 Primary Health Center',
        'Dwarka Sector 3 Colony Ground', 'Dwarka Sector 4 Cyclone Safe Haven',
        'Dwarka Highway Bypass Chowk', 'Okha Railway Colony', 'Dwarka Coast Guard Station'
      ],
      namesHi: [
        'द्वारकाधीश मंदिर', 'द्वारका लाइटहाउस', 'गोमती घाट', 'रुक्मिणी देवी मंदिर',
        'शिवराजपुर बीच राहत केंद्र', 'ओखा बंदरगाह टर्मिनल', 'बेट द्वारका जेटी',
        'द्वारका केंद्रीय बस स्टैंड', 'द्वारका रेलवे स्टेशन', 'द्वारका सिविल अस्पताल',
        'ओखा कम्युनिटी हॉल', 'मीठापुर हाई स्कूल', 'द्वारका मार्केट चौक',
        'गोपी तालाब राहत केंद्र', 'नागेश्वर ज्योतिर्लिंग शिविर', 'कुरंगा ग्राम सभा',
        'वरवाला पंचायत घर', 'रूपाण बंदरगाह सभा स्थल', 'द्वारका डाकघर वार्ड',
        'द्वारका सेक्टर 1 राहत डिपो', 'द्वारका सेक्टर 2 प्राथमिक स्वास्थ्य केंद्र',
        'द्वारका सेक्टर 3 कॉलोनी ग्राउंड', 'द्वारका सेक्टर 4 चक्रवात शरणार्थी केंद्र',
        'द्वारका हाईवे बाईपास चौक', 'ओखा रेलवे कॉलोनी', 'द्वारका तटरक्षक स्टेशन'
      ]
    },
    {
      state: 'Delhi',
      district: 'South West Delhi',
      baseLat: 28.5921,
      baseLng: 77.0460,
      cities: ['Dwarka', 'Janakpuri', 'Najafgarh', 'Palam', 'Uttam Nagar', 'Vasant Kunj'],
      namesEn: [
        'Dwarka Sector 1 Market', 'Dwarka Sector 2 DDA Colony', 'Dwarka Sector 3 Metro Station',
        'Dwarka Sector 4 Community Center', 'Dwarka Sector 5 Government School', 'Dwarka Sector 6 Central Hospital',
        'Dwarka Sector 7 Ramphal Chowk', 'Dwarka Sector 8 DTC Bus Depot', 'Dwarka Sector 9 Metro Gate',
        'Dwarka Sector 10 District Court', 'Dwarka Sector 11 Sports Complex', 'Dwarka Sector 12 City Center Mall',
        'Dwarka Sector 13 Metro Station', 'Dwarka Sector 14 University Campus', 'Dwarka Sector 15 Police Post',
        'Dwarka Sector 16 GGSIPU Gate', 'Dwarka Sector 17 Sub-City Park', 'Dwarka Sector 18 Primary School',
        'Dwarka Sector 19 Amity Junction', 'Dwarka Sector 20 Ward Office', 'Dwarka Sector 21 Inter-State Bus Terminal',
        'Dwarka Sector 22 Golf Course Area', 'Dwarka Sector 23 Pochanpur Village', 'Dwarka Sector 24 Bharthal Chowk',
        'Janakpuri District Centre', 'Palam Railway Station', 'Najafgarh Mandi Chowk'
      ],
      namesHi: [
        'द्वारका सेक्टर 1 मार्केट', 'द्वारका सेक्टर 2 डीडीए कॉलोनी', 'द्वारका सेक्टर 3 मेट्रो स्टेशन',
        'द्वारका सेक्टर 4 कम्युनिटी सेंटर', 'द्वारका सेक्टर 5 सरकारी स्कूल', 'द्वारका सेक्टर 6 सेंट्रल अस्पताल',
        'द्वारका सेक्टर 7 रामफल चौक', 'द्वारका सेक्टर 8 डीटीसी बस डिपो', 'द्वारका सेक्टर 9 मेट्रो गेट',
        'द्वारका सेक्टर 10 जिला न्यायालय', 'द्वारका सेक्टर 11 खेल परिसर', 'द्वारका सेक्टर 12 सिटी सेंटर मॉल',
        'द्वारका सेक्टर 13 मेट्रो स्टेशन', 'द्वारका सेक्टर 14 विश्वविद्यालय परिसर', 'द्वारका सेक्टर 15 पुलिस चौकी',
        'द्वारका सेक्टर 16 आईपी यूनिवर्सिटी गेट', 'द्वारका सेक्टर 17 पार्क', 'द्वारका सेक्टर 18 प्राथमिक विद्यालय',
        'द्वारका सेक्टर 19 एमिटी जंक्शन', 'द्वारका सेक्टर 20 वार्ड कार्यालय', 'द्वारका सेक्टर 21 अंतरराज्यीय बस टर्मिनल',
        'द्वारका सेक्टर 22 गोल्फ कोर्स क्षेत्र', 'द्वारका सेक्टर 23 पोचनपुर गांव', 'द्वारका सेक्टर 24 भरथल चौक',
        'जनकपुरी डिस्ट्रिक्ट सेंटर', 'पालम रेलवे स्टेशन', 'नजफगढ़ मंडी चौक'
      ]
    },
    {
      state: 'Karnataka',
      district: 'Bengaluru Urban',
      baseLat: 12.9716,
      baseLng: 77.5946,
      cities: ['Bengaluru', 'Koramangala', 'Indiranagar', 'Whitefield', 'BTM Layout', 'Jayanagar', 'Hebbal', 'Electronic City'],
      namesEn: [
        'Silk Board Junction Flyover', 'Majestic KSR Bengaluru Railway Station', 'Koramangala 4th Block Club',
        'Koramangala 5th Block Indoor Stadium', 'Indiranagar 100ft Road Metro', 'Whitefield ITPL Main Gate',
        'BTM Layout 2nd Stage Water Tank', 'Hebbal Flyover Relief Junction', 'Jayanagar 4th Block Complex',
        'Electronic City Toll Plaza', 'Malleshwaram 8th Cross Market', 'HSR Layout Sector 1 BDA Complex',
        'Yelahanka Old Town Bus Stand', 'Shivajinagar Bus Station', 'Victoria Hospital Emergency Ward',
        'Bowring and Lady Curzon Hospital', 'St Johns Medical College Hospital', 'Mekhri Circle Evacuation Point',
        'KR Market Metro Terminal', 'MG Road Trinity Circle', 'Banashankari Temple Bus Terminal',
        'Rajajinagar 1st Block Ground', 'Yeshwanthpur Railway Station', 'Bellandur EcoSpace Junction',
        'Marathahalli Bridge Bus Stop', 'Kengeri Satellite Town Bus Stand', 'Nagavara Manyata Tech Park Gate'
      ],
      namesHi: [
        'सिल्क बोर्ड जंक्शन फ्लाईओवर', 'मजेस्टिक केएसआर बेंगलुरु रेलवे स्टेशन', 'कोरमंगला 4था ब्लॉक क्लब',
        'कोरमंगला 5वां ब्लॉक इंडोर स्टेडियम', 'इंदिरानगर 100 फीट रोड मेट्रो', 'व्हाइटफील्ड आईटीपीएल मेन गेट',
        'बीटीएम लेआउट 2रा स्टेज वाटर टैंक', 'हेब्बाल फ्लाईओवर राहत जंक्शन', 'जयनगर 4था ब्लॉक कॉम्प्लेक्स',
        'इलेक्ट्रॉनिक सिटी टोल प्लाजा', 'मल्लेश्वरम 8वां क्रॉस मार्केट', 'एचएसआर लेआउट सेक्टर 1 बीडीए कॉम्प्लेक्स',
        'येलाहंका पुराना बस स्टैंड', 'शिवाजीनगर बस स्टेशन', 'विक्टोरिया अस्पताल आपातकालीन वार्ड',
        'बोवरिंग अस्पताल', 'सेंट जॉन्स मेडिकल कॉलेज अस्पताल', 'मेखरी सर्कल निकासी बिंदु',
        'केआर मार्केट मेट्रो टर्मिनल', 'एमजी रोड ट्रिनिटी सर्कल', 'बनाशंकरी मंदिर बस टर्मिनल',
        'राजाजीनगर 1ला ब्लॉक ग्राउंड', 'यशवंतपुर रेलवे स्टेशन', 'बेलंदूर इकोस्पेस जंक्शन',
        'मराठाहल्ली ब्रिज बस स्टॉप', 'केंगेरी सैटेलाइट टाउन बस स्टैंड', 'मान्यता टेक पार्क गेट'
      ]
    },
    {
      state: 'Maharashtra',
      district: 'Mumbai Suburban',
      baseLat: 19.0760,
      baseLng: 72.8777,
      cities: ['Mumbai', 'Bandra', 'Andheri', 'Dadar', 'Borivali', 'Ghatkopar', 'Kurla', 'Colaba', 'Juhu'],
      namesEn: [
        'Dadar Western Railway Terminus', 'Bandra Kurla Complex (BKC) Ground', 'Andheri West Metro Interchange',
        'Chhatrapati Shivaji Maharaj Terminus (CSMT)', 'Kurla Nehru Nagar Bus Depot', 'Borivali National Park Gate',
        'Ghatkopar East R-City Mall Junction', 'Colaba Causeway Post Office', 'Juhu Beach Relief Camp',
        'KEM Hospital Parel', 'Lilavati Hospital Bandra', 'Cooper Hospital Vile Parle',
        'Sion Circle Evacuation Point', 'Powai IIT Bombay Main Gate', 'Chembur Diamond Garden',
        'Worli Sea Face Promenade', 'Malad Marve Road Chowk', 'Kandivali Station West',
        'Vashi Toll Plaza Entry', 'Thane Station West Bus Stand', 'Mulund Check Naka'
      ],
      namesHi: [
        'दादर पश्चिम रेलवे टर्मिनल', 'बांद्रा कुर्ला कॉम्प्लेक्स (बीकेसी) ग्राउंड', 'अंधेरी पश्चिम मेट्रो इंटरचेंज',
        'छत्रपति शिवाजी महाराज टर्मिनस (सीएसएमटी)', 'कुर्ला नेहरू नगर बस डिपो', 'बोरीवली नेशनल पार्क गेट',
        'घाटकोपर पूर्व आर-सिटी मॉल जंक्शन', 'कोलाबा कॉजवे डाकघर', 'जुहू बीच राहत शिविर',
        'केईएम अस्पताल परेल', 'लीलावती अस्पताल बांद्रा', 'कूपर अस्पताल विले पार्ले',
        'सायन सर्कल निकासी बिंदु', 'पवई आईआईटी बॉम्बे मेन गेट', 'चेंबूर डायमंड गार्डन',
        'वर्ली सी फेस प्रोमेनेड', 'मलाड मार्वे रोड चौक', 'कांदिवली स्टेशन वेस्ट',
        'वाशी टोल प्लाजा', 'ठाणे स्टेशन वेस्ट बस स्टैंड', 'मुलुंड चेक नाका'
      ]
    },
    {
      state: 'Tamil Nadu',
      district: 'Chennai',
      baseLat: 13.0827,
      baseLng: 80.2707,
      cities: ['Chennai', 'T. Nagar', 'Adyar', 'Velachery', 'Anna Nagar', 'Mylapore', 'Tambaram', 'Guindy'],
      namesEn: [
        'Chennai Central Puratchi Thalaivar Station', 'T. Nagar Panagal Park', 'Adyar Signal Junction',
        'Velachery MRTS Railway Station', 'Anna Nagar Roundtana', 'Mylapore Kapaleeshwarar Temple Square',
        'Tambaram Sanatorium Bus Stand', 'Guindy Kathipara Junction', 'Marina Beach Light House Relief Camp',
        'Rajiv Gandhi Government General Hospital', 'Apollo Hospital Greams Road', 'Koyambedu CMBT Bus Terminus',
        'Egmore Railway Station', 'Besant Nagar Elliot Beach Point', 'Chromepet Grand Southern Trunk Road'
      ],
      namesHi: [
        'चेन्नई सेंट्रल रेलवे स्टेशन', 'टी. नगर पनागल पार्क', 'अड्यार सिग्नल जंक्शन',
        'वेलाचेरी एमआरटीएस रेलवे स्टेशन', 'अन्ना नगर राउंडटाना', 'मयिलापुर कपालीश्वरर मंदिर चौक',
        'तांबरम सेनेटोरियम बस स्टैंड', 'गिंडी काठीपारा जंक्शन', 'मरीना बीच लाइट हाउस राहत शिविर',
        'राजीव गांधी सरकारी सामान्य अस्पताल', 'अपोलो अस्पताल ग्रीम्स रोड', 'कोयम्बेडु सीएमबीटी बस टर्मिनस',
        'एग्मोर रेलवे स्टेशन', 'बेसेंट नगर इलियट बीच पॉइंट', 'क्रोमपेट जीएसटी रोड'
      ]
    },
    {
      state: 'Telangana',
      district: 'Hyderabad',
      baseLat: 17.3850,
      baseLng: 78.4867,
      cities: ['Hyderabad', 'Secunderabad', 'Hitec City', 'Banjara Hills', 'Jubilee Hills', 'Charminar', 'Gachibowli'],
      namesEn: [
        'Secunderabad Junction Railway Station', 'Hitec City Cyber Towers Chowk', 'Banjara Hills Road No 12',
        'Jubilee Hills Check Post', 'Charminar Historic Square', 'Gachibowli Stadium Evacuation Camp',
        'KIMS Hospital Secunderabad', 'Osmania General Hospital Afzal Gunj', 'MGBS Central Bus Station Imlibun',
        'Kukatpally Housing Board (KPHB) Colony', 'Begumpet Airport Evacuation Node', 'Dilsukhnagar Bus Depot'
      ],
      namesHi: [
        'सिकंदराबाद जंक्शन रेलवे स्टेशन', 'हाईटेक सिटी साइबर टावर्स चौक', 'बंजारा हिल्स रोड नंबर 12',
        'जुबली हिल्स चेक पोस्ट', 'चारमीनार ऐतिहासिक चौक', 'गाचीबोवली स्टेडियम राहत शिविर',
        'किम्स अस्पताल सिकंदराबाद', 'उस्मानिया जनरल अस्पताल अफजल गंज', 'एमजीबीएस केंद्रीय बस स्टेशन',
        'कुकटपल्ली केपीएचबी कॉलोनी', 'बेगमपेट हवाई अड्डा राहत केंद्र', 'दिलसुखनगर बस डिपो'
      ]
    },
    {
      state: 'West Bengal',
      district: 'Kolkata',
      baseLat: 22.5726,
      baseLng: 88.3639,
      cities: ['Kolkata', 'Howrah', 'Salt Lake', 'New Town', 'Dum Dum', 'Park Street', 'Esplanade'],
      namesEn: [
        'Howrah Junction Railway Station', 'Sealdah Railway Terminus', 'Salt Lake Karunamoyee Bus Station',
        'New Town Eco Park Evacuation Center', 'Esplanade Metro Interchange', 'Park Street Asiatic Society',
        'SSKM Hospital Bhowanipore', 'Calcutta Medical College Hospital', 'Dum Dum Airport Terminal 2',
        'Gariahat Crossing South Kolkata', 'Shyambazar Five Point Crossing', 'Ballygunge Phari Market'
      ],
      namesHi: [
        'हावड़ा जंक्शन रेलवे स्टेशन', 'सियालदह रेलवे टर्मिनस', 'सॉल्ट लेक करुणामयी बस स्टेशन',
        'न्यू टाउन इको पार्क राहत केंद्र', 'एस्प्लेनेड मेट्रो इंटरचेंज', 'पार्क स्ट्रीट एशियाटिक सोसाइटी',
        'एसएसकेएम अस्पताल भवानीपुर', 'कलकत्ता मेडिकल कॉलेज अस्पताल', 'दम दम हवाई अड्डा टर्मिनल 2',
        'गड़ियाहाट क्रॉसिंग', 'श्यामबाजार फाइव पॉइंट क्रॉसिंग', 'बालीगंज फाड़ी मार्केट'
      ]
    },
    {
      state: 'Maharashtra',
      district: 'Pune',
      baseLat: 18.5204,
      baseLng: 73.8567,
      cities: ['Pune', 'Shivajinagar', 'Kothrud', 'Hinjewadi', 'Viman Nagar', 'Hadapsar', 'Baner', 'Wakad'],
      namesEn: [
        'Pune Railway Station Junction', 'Shivajinagar Bus Depot and Metro', 'Hinjewadi IT Park Phase 1 Circle',
        'Kothrud Chandani Chowk Flyover', 'Sassoon General Hospital Station Rd', 'Swargate MSRTC Bus Station',
        'Viman Nagar Phoenix Market City Area', 'Hadapsar Magarpatta City Gate', 'Baner High Street Junction',
        'Deccan Gymkhana Bus Stop', 'Wakad Dange Chowk Relief Node', 'Camp MG Road Central Market'
      ],
      namesHi: [
        'पुणे रेलवे स्टेशन जंक्शन', 'शिवाजीनगर बस डिपो और मेट्रो', 'हिंजवड़ी आईटी पार्क फेज 1 सर्कल',
        'कोथरुड चांदनी चौक फ्लाईओवर', 'ससून जनरल अस्पताल', 'स्वारगेट एमएसआरटीसी बस स्टेशन',
        'विमान नगर फीनिक्स मार्केट सिटी', 'हड़पसर मगरपट्टा सिटी गेट', 'बानेर हाई स्ट्रीट जंक्शन',
        'डेक्कन जिमखाना बस स्टॉप', 'वाकड डांगे चौक राहत केंद्र', 'कैंप एमजी रोड सेंट्रल मार्केट'
      ]
    },
    {
      state: 'Rajasthan',
      district: 'Jaipur',
      baseLat: 26.9124,
      baseLng: 75.7873,
      cities: ['Jaipur', 'C-Scheme', 'Malviya Nagar', 'Vaishali Nagar', 'Mansarovar', 'Amer', 'Sanganer'],
      namesEn: [
        'Jaipur Junction Railway Station', 'Sindhi Camp Central Bus Stand', 'SMS Hospital Emergency Block',
        'Hawa Mahal Badi Chaupar Square', 'Malviya Nagar Gaurav Tower Chowk', 'Vaishali Nagar Amrapali Circle',
        'Mansarovar Metro Terminal', 'Amer Fort Tourist Parking Safe Haven', 'C-Scheme Statue Circle Park',
        'Sanganer Airport Terminal Road', 'Tonk Road Gandhi Nagar Railway Station', 'Raja Park Gol Market'
      ],
      namesHi: [
        'जयपुर जंक्शन रेलवे स्टेशन', 'सिंधी कैंप केंद्रीय बस स्टैंड', 'एसएमएस अस्पताल आपातकालीन ब्लॉक',
        'हवा महल बड़ी चौपड़ चौक', 'मालवीय नगर गौरव टावर चौक', 'वैशाली नगर आम्रपाली सर्कल',
        'मानसरोवर मेट्रो टर्मिनल', 'आमेर किला पार्किंग राहत केंद्र', 'सी-स्कीम स्टैच्यू सर्कल पार्क',
        'सांगानेर हवाई अड्डा रोड', 'टोंक रोड गांधी नगर रेलवे स्टेशन', 'राजा पार्क गोल मार्केट'
      ]
    },
    {
      state: 'Uttar Pradesh',
      district: 'Lucknow',
      baseLat: 26.8467,
      baseLng: 80.9462,
      cities: ['Lucknow', 'Hazratganj', 'Gomti Nagar', 'Alambagh', 'Indira Nagar', 'Charbagh', 'Chowk'],
      namesEn: [
        'Charbagh Lucknow Junction Station', 'Hazratganj GPO Square', 'Gomti Nagar Railway Station Ground',
        'Alambagh Inter-State Bus Terminal', 'King George Medical University (KGMU)', 'Dr Ram Manohar Lohia Hospital',
        'Chowk Clock Tower Heritage Point', 'Indira Nagar Munshi Pulia Metro', 'Mahanagar Gole Market Chowk',
        'Bara Imambara Assembly Ground', 'Shaheed Path Relief Corridor Node', 'Telibagh Military Hospital Area'
      ],
      namesHi: [
        'चारबाग लखनऊ जंक्शन स्टेशन', 'हजरतगंज जीपीओ चौराहा', 'गोमती नगर रेलवे स्टेशन ग्राउंड',
        'आलमबाग इंटर-स्टेट बस टर्मिनल', 'केजीएमयू मेडिकल यूनिवर्सिटी', 'डॉ. राम मनोहर लोहिया अस्पताल',
        'चौक घंटाघर हेरिटेज पॉइंट', 'इंदिरा नगर मुंशी पुलिया मेट्रो', 'महानगर गोल मार्केट चौक',
        'बड़ा इमामबाड़ा सभा मैदान', 'शहीद पथ राहत कॉरिडोर', 'तेलीबाग मिलिट्री अस्पताल क्षेत्र'
      ]
    },
    {
      state: 'Bihar',
      district: 'Patna',
      baseLat: 25.5941,
      baseLng: 85.1376,
      cities: ['Patna', 'Kankarbagh', 'Boring Road', 'Bailey Road', 'Danapur', 'Gandhi Maidan', 'Patna Sahib'],
      namesEn: [
        'Patna Junction Railway Station', 'Gandhi Maidan Mega Evacuation Camp', 'Patna Medical College Hospital (PMCH)',
        'AIIMS Patna Phulwari Sharif', 'Boring Road Chauraha Crossing', 'Kankarbagh Colony Auto Stand',
        'Danapur Cantonment Military Station', 'Patna Sahib Gurudwara Road', 'Bailey Road Saguna More Junction',
        'Mithapur Bus Stand Terminal', 'Rajendra Nagar Terminal Station', 'Dak Bungalow Chauraha Central Point'
      ],
      namesHi: [
        'पटना जंक्शन रेलवे स्टेशन', 'गांधी मैदान विशाल राहत शिविर', 'पीएमसीएच अस्पताल पटना',
        'एम्स पटना फुलवारी शरीफ', 'बोरिंग रोड चौराहा', 'कंकड़बाग कॉलोनी ऑटो स्टैंड',
        'दानापुर छावनी मिलिट्री स्टेशन', 'पटना साहिब गुरुद्वारा रोड', 'बेली रोड सगुना मोड़ जंक्शन',
        'मीठापुर बस स्टैंड टर्मिनल', 'राजेन्द्र नगर टर्मिनल स्टेशन', 'डाकबंगला चौराहा'
      ]
    },
    {
      state: 'Odisha',
      district: 'Khordha',
      baseLat: 20.2961,
      baseLng: 85.8245,
      cities: ['Bhubaneswar', 'Cuttack', 'Patia', 'Saheed Nagar', 'Nayapalli', 'Jaydev Vihar', 'Khandagiri'],
      namesEn: [
        'Bhubaneswar Master Canteen Station Square', 'Baramunda Inter State Bus Terminal (ISBT)', 'AIIMS Bhubaneswar Sijua',
        'SCB Medical College Cuttack', 'Jaydev Vihar Pal Heights Square', 'Patia KIIT Square Campus 6',
        'Saheed Nagar Community Hall', 'Khandagiri Caves Tourist Shelter', 'Nayapalli IRC Village Ground',
        'Rasulgarh Cuttack Road Junction', 'Kalpana Square Old Town Link', 'Janpath State Secretariat Road'
      ],
      namesHi: [
        'भुवनेश्वर मास्टर कैंटीन स्टेशन चौक', 'बरमुंडा अंतरराज्यीय बस टर्मिनल', 'एम्स भुवनेश्वर सिजुआ',
        'एससीबी मेडिकल कॉलेज कटक', 'जयदेव विहार पाल हाइट्स चौक', 'पटिया केआईआईटी स्क्वायर',
        'शहीद नगर कम्युनिटी हॉल', 'खंडगिरि गुफाएं राहत शिविर', 'नयापल्ली आईआरसी विलेज ग्राउंड',
        'रसूलगढ़ कटक रोड जंक्शन', 'कल्पना स्क्वायर ओल्ड टाउन लिंक', 'जनपथ राज्य सचिवालय रोड'
      ]
    },
    {
      state: 'Assam',
      district: 'Kamrup Metropolitan',
      baseLat: 26.1445,
      baseLng: 91.7362,
      cities: ['Guwahati', 'Dispur', 'Paltan Bazaar', 'Jalukbari', 'Maligaon', 'Pan Bazaar', 'Uzan Bazaar'],
      namesEn: [
        'Guwahati Railway Station Paltan Bazaar', 'ISBT Betkuchi Central Bus Terminal', 'Gauhati Medical College Hospital (GMCH)',
        'Dispur Capital Complex Secretariat', 'Jalukbari Rotunda Flyover Point', 'Kamakhya Temple Foot Hills Shelter',
        'Maligaon Northeast Frontier Railway HQ', 'Pan Bazaar Don Bosco High School', 'Uzan Bazaar Brahmaputra Riverfront',
        'Ganeshguri Flyover Junction', 'Khanapara Veterinary Field Evacuation Camp', 'Chandmari Colony Bus Stop'
      ],
      namesHi: [
        'गुवाहाटी रेलवे स्टेशन पलटन बाजार', 'आईएसबीटी बेटकुची बस टर्मिनल', 'गुवाहाटी मेडिकल कॉलेज अस्पताल',
        'दिसपुर राजधानी परिसर सचिवालय', 'जालुकबारी रोटुंडा फ्लाईओवर पॉइंट', 'कामाख्या मंदिर तलहटी राहत शिविर',
        'मालीगांव एनएफ रेलवे मुख्यालय', 'पान बाजार डॉन बॉस्को हाई स्कूल', 'उजान बाजार ब्रह्मपुत्र रिवरफ्रंट',
        'गणेशगुड़ी फ्लाईओवर जंक्शन', 'खानापारा वेटरनरी फील्ड राहत शिविर', 'चांदमारी कॉलोनी बस स्टॉप'
      ]
    },
    {
      state: 'Kerala',
      district: 'Ernakulam',
      baseLat: 9.9312,
      baseLng: 76.2673,
      cities: ['Kochi', 'Ernakulam', 'Fort Kochi', 'Edappally', 'Kakkanad', 'Aluva', 'Palarivattom'],
      namesEn: [
        'Ernakulam South Junction Railway Station', 'KSRTC Central Bus Stand Stand Ernakulam', 'Government Medical College Hospital Kalamassery',
        'Fort Kochi Boat Jetty Terminal', 'Edappally Toll LuLu Mall Metro', 'Kakkanad Infopark Express Highway',
        'Aluva Periyar River Flood Relief Camp', 'Palarivattom Flyover Junction', 'Marine Drive Rainbow Bridge Grounds',
        'MG Road Maharaja College Metro', 'Thoppumpady Harbour Bridge Chowk', 'Vytilla Mobility Hub Terminal'
      ],
      namesHi: [
        'एर्नाकुलम दक्षिण रेलवे स्टेशन', 'केएसआरटीसी सेंट्रल बस स्टैंड एर्नाकुलम', 'सरकारी मेडिकल कॉलेज अस्पताल कलामसेरी',
        'फोर्ट कोच्चि बोट जेटी टर्मिनल', 'इडप्पल्ली लुलु मॉल मेट्रो', 'कक्कनाड इन्फोपार्क एक्सप्रेस हाईवे',
        'अलुवा पेरियार नदी बाढ़ राहत शिविर', 'पलारिवट्टम फ्लाईओवर जंक्शन', 'मरीन ड्राइव रेनबो ब्रिज मैदान',
        'एमजी रोड महाराजा कॉलेज मेट्रो', 'थोपम्पडी हार्बर ब्रिज चौक', 'वायटिला मोबिलिटी हब टर्मिनल'
      ]
    },
    {
      state: 'Andhra Pradesh',
      district: 'Visakhapatnam',
      baseLat: 17.6868,
      baseLng: 83.2185,
      cities: ['Visakhapatnam', 'Dwaraka Nagar', 'Gajuwaka', 'Beach Road', 'Madhurawada', 'Pendurthi', 'MVP Colony'],
      namesEn: [
        'Visakhapatnam Railway Junction (Waltair)', 'Dwaraka RTC Complex Bus Station', 'King George Hospital (KGH) Maharani Peta',
        'RK Beach War Memorial Relief Camp', 'MVP Colony AS Raja Community Hall', 'Gajuwaka Industrial Corridor Junction',
        'Madhurawada Cricket Stadium Safe Ground', 'Siripuram Circle Andhra University Gate', 'Pendurthi Railway Gate Colony',
        'Jagadamba Junction Cinema Road', 'Bheemunipatnam (Bheemili) Beach Shelter', 'Scindia Naval Dockyard Main Gate'
      ],
      namesHi: [
        'विशाखापट्टनम रेलवे जंक्शन', 'द्वारका आरटीसी कॉम्प्लेक्स बस स्टेशन', 'किंग जॉर्ज अस्पताल (केजीएच)',
        'आरके बीच युद्ध स्मारक राहत शिविर', 'एमवीपी कॉलोनी कम्युनिटी हॉल', 'गाजुवाका औद्योगिक गलियारा जंक्शन',
        'मधुरवाड़ा क्रिकेट स्टेडियम राहत मैदान', 'सिरिपुरम सर्कल आंध्रा यूनिवर्सिटी गेट', 'पेंडुरथी रेलवे गेट कॉलोनी',
        'जगदम्बा जंक्शन सिनेमा रोड', 'भीमुनिपटनम (भीमिली) बीच राहत शिविर', 'सिंधिया नेवल डॉकयार्ड मेन गेट'
      ]
    },
    {
      state: 'Goa',
      district: 'North Goa',
      baseLat: 15.2993,
      baseLng: 74.1240,
      cities: ['Panaji', 'Margao', 'Mapusa', 'Vasco da Gama', 'Ponda', 'Calangute', 'Candolim', 'Porvorim'],
      namesEn: [
        'Panaji Kadam Bus Terminus', 'Goa Medical College and Hospital Bambolim', 'Margao Madgaon Railway Station',
        'Mapusa Municipal Market Square', 'Vasco da Gama Railway Terminus', 'Ponda Tisk Kranti Circle',
        'Calangute Beach Relief Point', 'Candolim Primary Health Center', 'Porvorim Secretariat Assembly Complex',
        'Miramar Beach Coastal Guard Post', 'Old Goa Basilica Heritage Ground', 'Dabolim International Airport Exit'
      ],
      namesHi: [
        'पणजी कदम बस टर्मिनस', 'गोवा मेडिकल कॉलेज और अस्पताल बाम्बोलिम', 'मडगांव रेलवे स्टेशन',
        'मापुसा म्युनिसिपल मार्केट चौक', 'वास्को द गामा रेलवे टर्मिनस', 'पोंडा तिस्क क्रांति सर्कल',
        'कलंगूट बीच राहत शिविर', 'कैंडोलिम प्राथमिक स्वास्थ्य केंद्र', 'पोरवोरिम सचिवालय परिसर',
        'मिरामार बीच तटरक्षक चौकी', 'ओल्ड गोवा बेसिलिका मैदान', 'डाबोलिम अंतरराष्ट्रीय हवाई अड्डा'
      ]
    }
  ];

  const placeTypes = [
    'landmark', 'bus stand', 'ward', 'colony', 'village',
    'railway station', 'hospital', 'school', 'temple', 'market'
  ];

  const allPlaces = [];

  // 1. Add specific named landmarks from regions
  regions.forEach(region => {
    for (let i = 0; i < region.namesEn.length; i++) {
      const nameEn = region.namesEn[i];
      const nameHi = region.namesHi[i] || nameEn;
      const latOffset = (Math.random() - 0.5) * 0.08;
      const lngOffset = (Math.random() - 0.5) * 0.08;
      
      let type = 'landmark';
      if (/bus/i.test(nameEn)) type = 'bus stand';
      else if (/railway|station|terminus/i.test(nameEn)) type = 'railway station';
      else if (/hospital|medical|health/i.test(nameEn)) type = 'hospital';
      else if (/school|college|university|iit|amity/i.test(nameEn)) type = 'school';
      else if (/temple|church|gurudwara|jyotirlinga|basilica/i.test(nameEn)) type = 'temple';
      else if (/market|chowk|chauraha|crossing|circle/i.test(nameEn)) type = 'market';
      else if (/colony|housing|dda/i.test(nameEn)) type = 'colony';
      else if (/village|nagar|ward/i.test(nameEn)) type = 'ward';

      allPlaces.push({
        name: nameEn,
        name_hi: nameHi,
        alt_names: [nameEn.toLowerCase(), nameHi, `${region.district} ${type}`, `${region.state}`],
        type,
        district: region.district,
        state: region.state,
        latitude: parseFloat((region.baseLat + latOffset).toFixed(6)),
        longitude: parseFloat((region.baseLng + lngOffset).toFixed(6))
      });
    }
  });

  // 2. Generate systematic realistic sample places across all Indian districts to exceed 2,000 records
  const sampleDistricts = [
    { district: 'Devbhumi Dwarka', state: 'Gujarat', baseLat: 22.24, baseLng: 68.96 },
    { district: 'South West Delhi', state: 'Delhi', baseLat: 28.59, baseLng: 77.04 },
    { district: 'Bengaluru Urban', state: 'Karnataka', baseLat: 12.97, baseLng: 77.59 },
    { district: 'Mumbai Suburban', state: 'Maharashtra', baseLat: 19.07, baseLng: 72.87 },
    { district: 'Chennai', state: 'Tamil Nadu', baseLat: 13.08, baseLng: 80.27 },
    { district: 'Hyderabad', state: 'Telangana', baseLat: 17.38, baseLng: 78.48 },
    { district: 'Kolkata', state: 'West Bengal', baseLat: 22.57, baseLng: 88.36 },
    { district: 'Pune', state: 'Maharashtra', baseLat: 18.52, baseLng: 73.85 },
    { district: 'Jaipur', state: 'Rajasthan', baseLat: 26.91, baseLng: 75.78 },
    { district: 'Lucknow', state: 'Uttar Pradesh', baseLat: 26.84, baseLng: 80.94 },
    { district: 'Patna', state: 'Bihar', baseLat: 25.59, baseLng: 85.13 },
    { district: 'Khordha', state: 'Odisha', baseLat: 20.29, baseLng: 85.82 },
    { district: 'Kamrup Metropolitan', state: 'Assam', baseLat: 26.14, baseLng: 91.73 },
    { district: 'Ernakulam', state: 'Kerala', baseLat: 9.93, baseLng: 76.26 },
    { district: 'Visakhapatnam', state: 'Andhra Pradesh', baseLat: 17.68, baseLng: 83.21 },
    { district: 'North Goa', state: 'Goa', baseLat: 15.49, baseLng: 73.82 },
    { district: 'South Goa', state: 'Goa', baseLat: 15.28, baseLng: 73.98 },
    { district: 'Ahmedabad', state: 'Gujarat', baseLat: 23.02, baseLng: 72.57 },
    { district: 'Surat', state: 'Gujarat', baseLat: 21.17, baseLng: 72.83 },
    { district: 'Bhopal', state: 'Madhya Pradesh', baseLat: 23.25, baseLng: 77.41 },
    { district: 'Indore', state: 'Madhya Pradesh', baseLat: 22.71, baseLng: 75.85 },
    { district: 'Varanasi', state: 'Uttar Pradesh', baseLat: 25.31, baseLng: 82.97 },
    { district: 'Kanpur Nagar', state: 'Uttar Pradesh', baseLat: 26.44, baseLng: 80.33 },
    { district: 'Dehradun', state: 'Uttarakhand', baseLat: 30.31, baseLng: 78.03 },
    { district: 'Shimla', state: 'Himachal Pradesh', baseLat: 31.10, baseLng: 77.17 },
    { district: 'Chandigarh', state: 'Chandigarh', baseLat: 30.73, baseLng: 76.77 },
    { district: 'Ranchi', state: 'Jharkhand', baseLat: 23.34, baseLng: 85.30 },
    { district: 'Raipur', state: 'Chhattisgarh', baseLat: 21.25, baseLng: 81.62 }
  ];

  const prefixes = [
    { en: 'Sector', hi: 'सेक्टर' },
    { en: 'Ward', hi: 'वार्ड' },
    { en: 'Block', hi: 'ब्लॉक' },
    { en: 'Phase', hi: 'फेज' },
    { en: 'Nagar', hi: 'नगर' },
    { en: 'Colony', hi: 'कॉलोनी' },
    { en: 'Village', hi: 'गांव' },
    { en: 'Enclave', hi: 'एन्क्लेव' },
    { en: 'Layout', hi: 'लेआउट' },
    { en: 'Panchayat', hi: 'पंचायत' }
  ];

  const subTypes = [
    { en: 'Community Hall', hi: 'सामुदायिक भवन', type: 'landmark' },
    { en: 'Primary Health Center', hi: 'प्राथमिक स्वास्थ्य केंद्र', type: 'hospital' },
    { en: 'Government High School', hi: 'राजकीय उच्च विद्यालय', type: 'school' },
    { en: 'Bus Terminal', hi: 'बस टर्मिनल', type: 'bus stand' },
    { en: 'Railway Station Yard', hi: 'रेलवे स्टेशन यार्ड', type: 'railway station' },
    { en: 'Weekly Haat Market', hi: 'साप्ताहिक हाट बाजार', type: 'market' },
    { en: 'Hanuman Mandir', hi: 'हनुमान मंदिर', type: 'temple' },
    { en: 'Relief Shelter Camp', hi: 'राहत शिविर कैंप', type: 'landmark' },
    { en: 'Panchayat Ghar', hi: 'पंचायत घर', type: 'village' },
    { en: 'Water Tank Colony', hi: 'वाटर टैंक कॉलोनी', type: 'colony' }
  ];

  let sampleIdCounter = 1;
  while (allPlaces.length < 2150) {
    for (const dist of sampleDistricts) {
      if (allPlaces.length >= 2150) break;
      const pref = prefixes[sampleIdCounter % prefixes.length];
      const sub = subTypes[(sampleIdCounter * 3) % subTypes.length];
      const num = (sampleIdCounter % 40) + 1;
      
      const nameEn = `${dist.district} ${pref.en} ${num} ${sub.en}`;
      const nameHi = `${dist.district} ${pref.hi} ${num} ${sub.hi}`;
      
      // Radius ~15km around district center
      const latOffset = (Math.sin(sampleIdCounter) * 0.12);
      const lngOffset = (Math.cos(sampleIdCounter) * 0.12);

      allPlaces.push({
        name: nameEn,
        name_hi: nameHi,
        alt_names: [nameEn.toLowerCase(), nameHi, `${dist.district} ${sub.type}`, pref.en.toLowerCase()],
        type: sub.type,
        district: dist.district,
        state: dist.state,
        latitude: parseFloat((dist.baseLat + latOffset).toFixed(6)),
        longitude: parseFloat((dist.baseLng + lngOffset).toFixed(6))
      });
      sampleIdCounter++;
    }
  }

  console.log(`Generated ${allPlaces.length} sample places. Inserting into database in batches...`);

  // Clear existing places table if re-running
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE places;`);

  // Batch insert 200 at a time
  const batchSize = 200;
  for (let i = 0; i < allPlaces.length; i += batchSize) {
    const chunk = allPlaces.slice(i, i + batchSize);
    const valueTuples = chunk.map(p => {
      const cleanName = p.name.replace(/'/g, "''");
      const cleanNameHi = p.name_hi.replace(/'/g, "''");
      const altNamesArr = "ARRAY[" + p.alt_names.map(a => `'${a.replace(/'/g, "''")}'`).join(',') + "]::TEXT[]";
      return `('${cleanName}', '${cleanNameHi}', ${altNamesArr}, '${p.type}', '${p.district}', '${p.state}', ${p.latitude}, ${p.longitude})`;
    }).join(',');

    await prisma.$executeRawUnsafe(`
      INSERT INTO places (name, name_hi, alt_names, type, district, state, latitude, longitude)
      VALUES ${valueTuples};
    `);
  }

  const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM places;`);
  const finalCount = countResult[0].count;
  console.log(`✓ Successfully seeded places table with ${finalCount} sample records!`);

  // Test typo and Hindi search
  const dwarkaSearch = await prisma.$queryRawUnsafe(`
    SELECT name, name_hi, district, type
    FROM places
    WHERE name ILIKE '%Dwarka%' OR name_hi ILIKE '%द्वारका%'
    LIMIT 5;
  `);
  console.log('Sample search results for "Dwarka":', dwarkaSearch);

  await prisma.$disconnect();
}

setup().catch(err => {
  console.error('Failed to setup places:', err);
  process.exit(1);
});
