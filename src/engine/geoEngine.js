/* ── GEO ENGINE ──────────────────────────────────────────────────────────────
   Live geospatial intelligence layer.
   resolveAddress           → Nominatim geocoding
   getCircleRateForLocation → Haversine micromarket zone lookup (Karnataka SRO)
   fetchInfrastructureSignals → Overpass amenity signals with caching
*/

import { fetchWithRetry } from '../lib/fetchWithRetry';

/* ── IN-MEMORY GEO CACHE ─────────────────────────────────────────────────── */
const GEO_CACHE = {};

/* Nominatim enforces 1 req/sec per OSM policy */
let lastNominatimCall = 0;
async function nominatimThrottle() {
  const now  = Date.now();
  const wait = 1000 - (now - lastNominatimCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatimCall = Date.now();
}

export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('geo_timeout')), ms)
    ),
  ]);
}

function haversineMetres(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineKm(lat1, lng1, lat2, lng2) {
  return haversineMetres(lat1, lng1, lat2, lng2) / 1000;
}

/* ── NOMINATIM GEOCODING ─────────────────────────────────────────────────── */
export async function resolveAddress(address) {
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  try {
    await nominatimThrottle();
    const res  = await fetchWithRetry(url, {
      headers: { 'User-Agent': 'CollatiqApp/2.0', 'Accept-Language': 'en' },
    }, { maxAttempts: 2, baseDelayMs: 500 });
    const data = await res.json();
    if (!data || data.length === 0)
      return { resolved: false, lat: null, lng: null, displayName: null };
    const item = data[0];
    return {
      resolved: true,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      displayName: item.display_name,
    };
  } catch {
    return { resolved: false, lat: null, lng: null, displayName: null };
  }
}

/* ── BENGALURU MICROMARKET ZONE TABLE ────────────────────────────────────── */
export const BENGALURU_ZONES = [
  { name: 'MG Road',           lat: 12.9756, lng: 77.6097, radiusKm: 1.5,  ratePerSqft: 11200 },
  { name: 'Brigade Road',      lat: 12.9716, lng: 77.6077, radiusKm: 1.2,  ratePerSqft: 11000 },
  { name: 'Richmond Town',     lat: 12.9638, lng: 77.6008, radiusKm: 1.8,  ratePerSqft: 10800 },
  { name: 'Cunningham Road',   lat: 12.9980, lng: 77.5960, radiusKm: 1.5,  ratePerSqft: 10400 },
  { name: 'Koramangala',       lat: 12.9352, lng: 77.6245, radiusKm: 2.5,  ratePerSqft: 10200 },
  { name: 'Indiranagar',       lat: 12.9784, lng: 77.6408, radiusKm: 2.2,  ratePerSqft: 9800  },
  { name: 'Malleshwaram',      lat: 13.0035, lng: 77.5711, radiusKm: 2.0,  ratePerSqft: 9000  },
  { name: 'Basavanagudi',      lat: 12.9416, lng: 77.5752, radiusKm: 2.2,  ratePerSqft: 8800  },
  { name: 'Old Airport Road',  lat: 12.9588, lng: 77.6490, radiusKm: 2.0,  ratePerSqft: 8800  },
  { name: 'HSR Layout',        lat: 12.9116, lng: 77.6389, radiusKm: 2.8,  ratePerSqft: 8600  },
  { name: 'Rajajinagar',       lat: 12.9918, lng: 77.5556, radiusKm: 2.5,  ratePerSqft: 8400  },
  { name: 'Jayanagar',         lat: 12.9308, lng: 77.5838, radiusKm: 2.5,  ratePerSqft: 8200  },
  { name: 'BTM Layout',        lat: 12.9166, lng: 77.6101, radiusKm: 2.0,  ratePerSqft: 8000  },
  { name: 'Bellandur',         lat: 12.9258, lng: 77.6762, radiusKm: 2.5,  ratePerSqft: 7800  },
  { name: 'Hebbal',            lat: 13.0353, lng: 77.5971, radiusKm: 2.5,  ratePerSqft: 7600  },
  { name: 'JP Nagar',          lat: 12.9102, lng: 77.5847, radiusKm: 2.8,  ratePerSqft: 7600  },
  { name: 'Whitefield',        lat: 12.9698, lng: 77.7499, radiusKm: 4.0,  ratePerSqft: 7400  },
  { name: 'Banashankari',      lat: 12.9255, lng: 77.5468, radiusKm: 2.5,  ratePerSqft: 7400  },
  { name: 'Marathahalli',      lat: 12.9591, lng: 77.7009, radiusKm: 2.5,  ratePerSqft: 7200  },
  { name: 'Vijayanagar',       lat: 12.9714, lng: 77.5227, radiusKm: 2.5,  ratePerSqft: 7200  },
  { name: 'Sarjapur Road',     lat: 12.9010, lng: 77.6860, radiusKm: 3.5,  ratePerSqft: 7000  },
  { name: 'Bannerghatta Road', lat: 12.8933, lng: 77.5969, radiusKm: 3.0,  ratePerSqft: 6800  },
  { name: 'Nagarbhavi',        lat: 12.9617, lng: 77.5063, radiusKm: 2.0,  ratePerSqft: 6600  },
  { name: 'Hennur',            lat: 13.0435, lng: 77.6395, radiusKm: 2.5,  ratePerSqft: 6400  },
  { name: 'Thanisandra',       lat: 13.0650, lng: 77.6215, radiusKm: 2.5,  ratePerSqft: 6200  },
  { name: 'KR Puram',          lat: 13.0045, lng: 77.6940, radiusKm: 2.5,  ratePerSqft: 6000  },
  { name: 'Yelahanka',         lat: 13.1007, lng: 77.5963, radiusKm: 3.0,  ratePerSqft: 5800  },
  { name: 'Mysore Road',       lat: 12.9418, lng: 77.4965, radiusKm: 3.0,  ratePerSqft: 5800  },
  { name: 'Tumkur Road',       lat: 13.0297, lng: 77.5141, radiusKm: 3.0,  ratePerSqft: 5600  },
  { name: 'Kadugodi',          lat: 12.9956, lng: 77.7613, radiusKm: 2.5,  ratePerSqft: 5600  },
  { name: 'Kengeri',           lat: 12.9094, lng: 77.4823, radiusKm: 2.5,  ratePerSqft: 5400  },
  { name: 'Electronic City',   lat: 12.8399, lng: 77.6770, radiusKm: 3.5,  ratePerSqft: 5200  },
  { name: 'Devanahalli',       lat: 13.2489, lng: 77.7150, radiusKm: 3.5,  ratePerSqft: 4200  },
  { name: 'Hoskote',           lat: 13.0707, lng: 77.7990, radiusKm: 3.0,  ratePerSqft: 3800  },
];

/* ── OTHER CITY MICROMARKET ZONES ────────────────────────────────────────── */
export const MUMBAI_ZONES = [
  { name: 'Bandra West',    lat: 19.0596, lng: 72.8295, radiusKm: 2.0, ratePerSqft: 22000 },
  { name: 'Andheri West',   lat: 19.1364, lng: 72.8296, radiusKm: 2.5, ratePerSqft: 14500 },
  { name: 'Juhu',           lat: 19.0883, lng: 72.8263, radiusKm: 1.8, ratePerSqft: 20000 },
  { name: 'Powai',          lat: 19.1176, lng: 72.9060, radiusKm: 2.5, ratePerSqft: 13000 },
  { name: 'Worli',          lat: 19.0176, lng: 72.8150, radiusKm: 1.5, ratePerSqft: 25000 },
  { name: 'Lower Parel',    lat: 18.9978, lng: 72.8302, radiusKm: 1.5, ratePerSqft: 23000 },
  { name: 'Goregaon',       lat: 19.1663, lng: 72.8526, radiusKm: 2.5, ratePerSqft: 11000 },
  { name: 'Thane',          lat: 19.2183, lng: 72.9781, radiusKm: 3.5, ratePerSqft: 8500  },
  { name: 'Navi Mumbai',    lat: 19.0368, lng: 73.0158, radiusKm: 4.0, ratePerSqft: 7500  },
];

export const HYDERABAD_ZONES = [
  { name: 'Banjara Hills',  lat: 17.4156, lng: 78.4347, radiusKm: 2.5, ratePerSqft: 12000 },
  { name: 'Jubilee Hills',  lat: 17.4319, lng: 78.4071, radiusKm: 2.5, ratePerSqft: 13000 },
  { name: 'Gachibowli',     lat: 17.4401, lng: 78.3489, radiusKm: 3.0, ratePerSqft: 8500  },
  { name: 'Madhapur',       lat: 17.4483, lng: 78.3915, radiusKm: 2.5, ratePerSqft: 9200  },
  { name: 'Kondapur',       lat: 17.4593, lng: 78.3535, radiusKm: 2.5, ratePerSqft: 7800  },
  { name: 'Kukatpally',     lat: 17.4948, lng: 78.3996, radiusKm: 3.0, ratePerSqft: 6500  },
  { name: 'Secunderabad',   lat: 17.4399, lng: 78.4983, radiusKm: 3.0, ratePerSqft: 7000  },
];

export const CHENNAI_ZONES = [
  { name: 'Anna Nagar',     lat: 13.0850, lng: 80.2101, radiusKm: 2.5, ratePerSqft: 9500  },
  { name: 'T Nagar',        lat: 13.0418, lng: 80.2341, radiusKm: 2.0, ratePerSqft: 12000 },
  { name: 'Adyar',          lat: 13.0012, lng: 80.2565, radiusKm: 2.5, ratePerSqft: 10500 },
  { name: 'Nungambakkam',   lat: 13.0569, lng: 80.2425, radiusKm: 2.0, ratePerSqft: 13000 },
  { name: 'Velachery',      lat: 12.9815, lng: 80.2180, radiusKm: 2.5, ratePerSqft: 7500  },
  { name: 'OMR',            lat: 12.9165, lng: 80.2274, radiusKm: 4.0, ratePerSqft: 6800  },
  { name: 'Sholinganallur', lat: 12.9010, lng: 80.2279, radiusKm: 2.5, ratePerSqft: 6500  },
];

export const PUNE_ZONES = [
  { name: 'Koregaon Park',  lat: 18.5362, lng: 73.8930, radiusKm: 2.0, ratePerSqft: 12000 },
  { name: 'Viman Nagar',    lat: 18.5679, lng: 73.9143, radiusKm: 2.5, ratePerSqft: 8800  },
  { name: 'Kothrud',        lat: 18.5074, lng: 73.8077, radiusKm: 2.5, ratePerSqft: 9500  },
  { name: 'Hinjewadi',      lat: 18.5912, lng: 73.7390, radiusKm: 3.0, ratePerSqft: 6500  },
  { name: 'Baner',          lat: 18.5590, lng: 73.7868, radiusKm: 2.5, ratePerSqft: 8500  },
  { name: 'Wakad',          lat: 18.5996, lng: 73.7627, radiusKm: 2.5, ratePerSqft: 7200  },
  { name: 'Hadapsar',       lat: 18.5089, lng: 73.9260, radiusKm: 3.0, ratePerSqft: 6000  },
];

export const DELHI_ZONES = [
  { name: 'Defence Colony',  lat: 28.5744, lng: 77.2319, radiusKm: 2.0, ratePerSqft: 18000 },
  { name: 'Vasant Vihar',    lat: 28.5572, lng: 77.1569, radiusKm: 2.5, ratePerSqft: 16000 },
  { name: 'Greater Kailash', lat: 28.5422, lng: 77.2416, radiusKm: 2.5, ratePerSqft: 15000 },
  { name: 'Dwarka',          lat: 28.5921, lng: 77.0460, radiusKm: 3.5, ratePerSqft: 8000  },
  { name: 'Gurgaon Sec 49',  lat: 28.4133, lng: 77.0428, radiusKm: 3.0, ratePerSqft: 7500  },
  { name: 'Noida Sec 150',   lat: 28.5685, lng: 77.3562, radiusKm: 3.0, ratePerSqft: 5500  },
];

export const AHMEDABAD_ZONES = [
  { name: 'Navrangpura',     lat: 23.0395, lng: 72.5604, radiusKm: 2.0, ratePerSqft: 9500  },
  { name: 'Satellite',       lat: 23.0285, lng: 72.5174, radiusKm: 2.5, ratePerSqft: 9000  },
  { name: 'Bodakdev',        lat: 23.0443, lng: 72.5029, radiusKm: 2.0, ratePerSqft: 8500  },
  { name: 'Prahlad Nagar',   lat: 23.0225, lng: 72.5080, radiusKm: 2.0, ratePerSqft: 8000  },
  { name: 'SG Highway',      lat: 23.0393, lng: 72.4936, radiusKm: 3.5, ratePerSqft: 6500  },
  { name: 'Bopal',           lat: 23.0265, lng: 72.4672, radiusKm: 2.5, ratePerSqft: 5500  },
  { name: 'Chandkheda',      lat: 23.1056, lng: 72.5831, radiusKm: 2.5, ratePerSqft: 5000  },
];

export const KOLKATA_ZONES = [
  { name: 'Alipore',         lat: 22.5334, lng: 88.3351, radiusKm: 1.5, ratePerSqft: 18000 },
  { name: 'Park Street',     lat: 22.5535, lng: 88.3511, radiusKm: 1.5, ratePerSqft: 16000 },
  { name: 'Ballygunge',      lat: 22.5239, lng: 88.3627, radiusKm: 2.0, ratePerSqft: 14000 },
  { name: 'Salt Lake',       lat: 22.5791, lng: 88.4147, radiusKm: 3.0, ratePerSqft: 8500  },
  { name: 'New Town',        lat: 22.5925, lng: 88.4842, radiusKm: 3.5, ratePerSqft: 6000  },
  { name: 'Rajarhat',        lat: 22.6223, lng: 88.4725, radiusKm: 3.0, ratePerSqft: 5500  },
  { name: 'Howrah',          lat: 22.5895, lng: 88.2952, radiusKm: 3.0, ratePerSqft: 5000  },
];

export const KOCHI_ZONES = [
  { name: 'Marine Drive',    lat: 9.9815,  lng: 76.2726, radiusKm: 1.5, ratePerSqft: 12000 },
  { name: 'Palarivattom',    lat: 9.9824,  lng: 76.3040, radiusKm: 2.0, ratePerSqft: 9500  },
  { name: 'Edapally',        lat: 10.0224, lng: 76.3032, radiusKm: 2.0, ratePerSqft: 8500  },
  { name: 'Vytila',          lat: 9.9674,  lng: 76.3029, radiusKm: 2.0, ratePerSqft: 8000  },
  { name: 'Kakkanad',        lat: 9.9890,  lng: 76.3486, radiusKm: 2.5, ratePerSqft: 7000  },
];

export const NAGPUR_ZONES = [
  { name: 'Sitabuldi',       lat: 21.1500, lng: 79.0880, radiusKm: 1.5, ratePerSqft: 9000  },
  { name: 'Civil Lines',     lat: 21.1575, lng: 79.0742, radiusKm: 2.0, ratePerSqft: 8000  },
  { name: 'Dharampeth',      lat: 21.1413, lng: 79.0619, radiusKm: 2.0, ratePerSqft: 7500  },
  { name: 'Wardha Road',     lat: 21.1086, lng: 79.1116, radiusKm: 3.0, ratePerSqft: 5500  },
  { name: 'Koradi Road',     lat: 21.1950, lng: 79.0640, radiusKm: 2.5, ratePerSqft: 4500  },
];

export const INDORE_ZONES = [
  { name: 'Palasia',         lat: 22.7175, lng: 75.8672, radiusKm: 1.5, ratePerSqft: 8500  },
  { name: 'AB Road',         lat: 22.7196, lng: 75.8577, radiusKm: 2.5, ratePerSqft: 7000  },
  { name: 'Vijay Nagar',     lat: 22.7428, lng: 75.8874, radiusKm: 2.5, ratePerSqft: 6000  },
  { name: 'Bhawarkua',       lat: 22.6992, lng: 75.8470, radiusKm: 2.5, ratePerSqft: 5500  },
  { name: 'Super Corridor',  lat: 22.7563, lng: 75.9153, radiusKm: 3.0, ratePerSqft: 4800  },
];

export const JAIPUR_ZONES = [
  { name: 'C-Scheme',        lat: 26.9124, lng: 75.7873, radiusKm: 2.0, ratePerSqft: 12000 },
  { name: 'Malviya Nagar',   lat: 26.8620, lng: 75.8056, radiusKm: 2.5, ratePerSqft: 7500  },
  { name: 'Vaishali Nagar',  lat: 26.9134, lng: 75.7377, radiusKm: 2.5, ratePerSqft: 6500  },
  { name: 'Mansarovar',      lat: 26.8601, lng: 75.7514, radiusKm: 3.0, ratePerSqft: 5500  },
  { name: 'Jagatpura',       lat: 26.8241, lng: 75.8244, radiusKm: 3.0, ratePerSqft: 5000  },
];

export const LUCKNOW_ZONES = [
  { name: 'Hazratganj',      lat: 26.8486, lng: 80.9462, radiusKm: 1.5, ratePerSqft: 12000 },
  { name: 'Gomti Nagar',     lat: 26.8566, lng: 81.0023, radiusKm: 3.0, ratePerSqft: 6500  },
  { name: 'Aliganj',         lat: 26.8832, lng: 80.9500, radiusKm: 2.5, ratePerSqft: 5500  },
  { name: 'Indira Nagar',    lat: 26.8863, lng: 81.0005, radiusKm: 2.5, ratePerSqft: 5000  },
  { name: 'Alambagh',        lat: 26.8062, lng: 80.9095, radiusKm: 2.5, ratePerSqft: 4500  },
];

export const SURAT_ZONES = [
  { name: 'Athwa Lines',     lat: 21.1817, lng: 72.8185, radiusKm: 1.5, ratePerSqft: 9000  },
  { name: 'City Light',      lat: 21.1730, lng: 72.8094, radiusKm: 2.0, ratePerSqft: 8500  },
  { name: 'Vesu',            lat: 21.1502, lng: 72.7940, radiusKm: 2.5, ratePerSqft: 7000  },
  { name: 'Adajan',          lat: 21.2113, lng: 72.7910, radiusKm: 2.5, ratePerSqft: 6500  },
  { name: 'Pal',             lat: 21.1647, lng: 72.7660, radiusKm: 2.5, ratePerSqft: 5500  },
];

export const VADODARA_ZONES = [
  { name: 'Alkapuri',        lat: 22.3119, lng: 73.1723, radiusKm: 2.0, ratePerSqft: 8000  },
  { name: 'Fatehganj',       lat: 22.3272, lng: 73.1879, radiusKm: 2.0, ratePerSqft: 6500  },
  { name: 'Vasna',           lat: 22.2839, lng: 73.1750, radiusKm: 2.5, ratePerSqft: 5500  },
  { name: 'Manjalpur',       lat: 22.2683, lng: 73.1967, radiusKm: 2.5, ratePerSqft: 5000  },
];

export const CHANDIGARH_ZONES = [
  { name: 'Sector 17',       lat: 30.7388, lng: 76.7795, radiusKm: 1.5, ratePerSqft: 14000 },
  { name: 'Sector 8',        lat: 30.7453, lng: 76.7894, radiusKm: 2.0, ratePerSqft: 12000 },
  { name: 'Sector 35',       lat: 30.7183, lng: 76.7731, radiusKm: 2.0, ratePerSqft: 10000 },
  { name: 'Mohali Phase 5',  lat: 30.7046, lng: 76.7177, radiusKm: 2.5, ratePerSqft: 8000  },
  { name: 'Panchkula Sec 5', lat: 30.6885, lng: 76.8456, radiusKm: 2.5, ratePerSqft: 7500  },
];

export const COIMBATORE_ZONES = [
  { name: 'Race Course',     lat: 11.0053, lng: 76.9637, radiusKm: 2.0, ratePerSqft: 8000  },
  { name: 'Saibaba Colony',  lat: 11.0257, lng: 76.9600, radiusKm: 2.0, ratePerSqft: 7000  },
  { name: 'Peelamedu',       lat: 11.0237, lng: 77.0283, radiusKm: 2.5, ratePerSqft: 6500  },
  { name: 'Hopes College',   lat: 11.0101, lng: 76.9544, radiusKm: 1.5, ratePerSqft: 5500  },
];

export const BHOPAL_ZONES = [
  { name: 'Arera Colony',    lat: 23.2132, lng: 77.4305, radiusKm: 2.5, ratePerSqft: 7000  },
  { name: 'MP Nagar',        lat: 23.2333, lng: 77.4320, radiusKm: 2.0, ratePerSqft: 6500  },
  { name: 'Hoshangabad Rd',  lat: 23.1971, lng: 77.3789, radiusKm: 3.0, ratePerSqft: 5000  },
  { name: 'Kolar Road',      lat: 23.1716, lng: 77.4417, radiusKm: 3.0, ratePerSqft: 4500  },
];

export const VISAKHAPATNAM_ZONES = [
  { name: 'MVP Colony',      lat: 17.7365, lng: 83.2905, radiusKm: 2.0, ratePerSqft: 8000  },
  { name: 'Dwaraka Nagar',   lat: 17.7232, lng: 83.3146, radiusKm: 2.0, ratePerSqft: 7500  },
  { name: 'Rushikonda',      lat: 17.7823, lng: 83.3735, radiusKm: 2.5, ratePerSqft: 6500  },
  { name: 'Madhurawada',     lat: 17.7895, lng: 83.4042, radiusKm: 3.0, ratePerSqft: 5500  },
  { name: 'Gajuwaka',        lat: 17.6892, lng: 83.2157, radiusKm: 2.5, ratePerSqft: 4500  },
];

/* ── CITY BOUNDING BOXES ──────────────────────────────────────────────────── */
export const ALL_CITY_ZONES = [
  { name: 'Bengaluru',      abbr: 'BLR', center: [12.9716, 77.5946], zoom: 11, zones: BENGALURU_ZONES     },
  { name: 'Mumbai',         abbr: 'MUM', center: [19.0760, 72.8777], zoom: 11, zones: MUMBAI_ZONES        },
  { name: 'Hyderabad',      abbr: 'HYD', center: [17.4400, 78.4300], zoom: 11, zones: HYDERABAD_ZONES     },
  { name: 'Chennai',        abbr: 'CHN', center: [13.0827, 80.2707], zoom: 11, zones: CHENNAI_ZONES       },
  { name: 'Pune',           abbr: 'PUN', center: [18.5204, 73.8567], zoom: 11, zones: PUNE_ZONES          },
  { name: 'Delhi NCR',      abbr: 'DEL', center: [28.5500, 77.1500], zoom: 10, zones: DELHI_ZONES         },
  { name: 'Ahmedabad',      abbr: 'AMD', center: [23.0225, 72.5714], zoom: 11, zones: AHMEDABAD_ZONES     },
  { name: 'Kolkata',        abbr: 'CCU', center: [22.5726, 88.3639], zoom: 11, zones: KOLKATA_ZONES       },
  { name: 'Kochi',          abbr: 'COK', center: [9.9816,  76.2999], zoom: 11, zones: KOCHI_ZONES         },
  { name: 'Nagpur',         abbr: 'NAG', center: [21.1458, 79.0882], zoom: 11, zones: NAGPUR_ZONES        },
  { name: 'Indore',         abbr: 'IDR', center: [22.7196, 75.8577], zoom: 11, zones: INDORE_ZONES        },
  { name: 'Jaipur',         abbr: 'JAI', center: [26.9124, 75.7873], zoom: 11, zones: JAIPUR_ZONES        },
  { name: 'Lucknow',        abbr: 'LKO', center: [26.8467, 80.9462], zoom: 11, zones: LUCKNOW_ZONES       },
  { name: 'Surat',          abbr: 'STV', center: [21.1702, 72.8311], zoom: 11, zones: SURAT_ZONES         },
  { name: 'Vadodara',       abbr: 'BDQ', center: [22.3072, 73.1812], zoom: 11, zones: VADODARA_ZONES      },
  { name: 'Chandigarh',     abbr: 'IXC', center: [30.7333, 76.7794], zoom: 11, zones: CHANDIGARH_ZONES    },
  { name: 'Coimbatore',     abbr: 'CJB', center: [11.0168, 76.9558], zoom: 11, zones: COIMBATORE_ZONES    },
  { name: 'Bhopal',         abbr: 'BHO', center: [23.2599, 77.4126], zoom: 11, zones: BHOPAL_ZONES        },
  { name: 'Visakhapatnam',  abbr: 'VTZ', center: [17.6868, 83.2185], zoom: 11, zones: VISAKHAPATNAM_ZONES },
];

const CITY_CONFIGS = [
  { name: 'Bengaluru',     zones: BENGALURU_ZONES,     bounds: { latMin: 12.75, latMax: 13.35, lngMin: 77.35, lngMax: 77.95 }, fallbackRate: 5500 },
  { name: 'Mumbai',        zones: MUMBAI_ZONES,        bounds: { latMin: 18.85, latMax: 19.35, lngMin: 72.75, lngMax: 73.10 }, fallbackRate: 9000 },
  { name: 'Hyderabad',     zones: HYDERABAD_ZONES,     bounds: { latMin: 17.30, latMax: 17.55, lngMin: 78.30, lngMax: 78.60 }, fallbackRate: 5800 },
  { name: 'Chennai',       zones: CHENNAI_ZONES,       bounds: { latMin: 12.85, latMax: 13.20, lngMin: 80.15, lngMax: 80.32 }, fallbackRate: 6000 },
  { name: 'Pune',          zones: PUNE_ZONES,          bounds: { latMin: 18.40, latMax: 18.65, lngMin: 73.70, lngMax: 73.98 }, fallbackRate: 5500 },
  { name: 'Delhi',         zones: DELHI_ZONES,         bounds: { latMin: 28.35, latMax: 28.80, lngMin: 76.90, lngMax: 77.45 }, fallbackRate: 7000 },
  { name: 'Ahmedabad',     zones: AHMEDABAD_ZONES,     bounds: { latMin: 22.90, latMax: 23.15, lngMin: 72.40, lngMax: 72.70 }, fallbackRate: 5500 },
  { name: 'Kolkata',       zones: KOLKATA_ZONES,       bounds: { latMin: 22.45, latMax: 22.75, lngMin: 88.25, lngMax: 88.55 }, fallbackRate: 5500 },
  { name: 'Kochi',         zones: KOCHI_ZONES,         bounds: { latMin: 9.85,  latMax: 10.10, lngMin: 76.20, lngMax: 76.45 }, fallbackRate: 6500 },
  { name: 'Nagpur',        zones: NAGPUR_ZONES,        bounds: { latMin: 21.05, latMax: 21.25, lngMin: 78.95, lngMax: 79.20 }, fallbackRate: 4500 },
  { name: 'Indore',        zones: INDORE_ZONES,        bounds: { latMin: 22.60, latMax: 22.85, lngMin: 75.75, lngMax: 76.00 }, fallbackRate: 4500 },
  { name: 'Jaipur',        zones: JAIPUR_ZONES,        bounds: { latMin: 26.75, latMax: 27.05, lngMin: 75.60, lngMax: 75.95 }, fallbackRate: 4500 },
  { name: 'Lucknow',       zones: LUCKNOW_ZONES,       bounds: { latMin: 26.70, latMax: 27.00, lngMin: 80.80, lngMax: 81.15 }, fallbackRate: 4000 },
  { name: 'Surat',         zones: SURAT_ZONES,         bounds: { latMin: 21.10, latMax: 21.35, lngMin: 72.70, lngMax: 72.95 }, fallbackRate: 5000 },
  { name: 'Vadodara',      zones: VADODARA_ZONES,      bounds: { latMin: 22.20, latMax: 22.45, lngMin: 73.10, lngMax: 73.40 }, fallbackRate: 4500 },
  { name: 'Chandigarh',    zones: CHANDIGARH_ZONES,    bounds: { latMin: 30.60, latMax: 30.90, lngMin: 76.65, lngMax: 76.95 }, fallbackRate: 6500 },
  { name: 'Coimbatore',    zones: COIMBATORE_ZONES,    bounds: { latMin: 10.90, latMax: 11.15, lngMin: 76.85, lngMax: 77.15 }, fallbackRate: 4500 },
  { name: 'Bhopal',        zones: BHOPAL_ZONES,        bounds: { latMin: 23.10, latMax: 23.40, lngMin: 77.30, lngMax: 77.60 }, fallbackRate: 4000 },
  { name: 'Visakhapatnam', zones: VISAKHAPATNAM_ZONES, bounds: { latMin: 17.60, latMax: 17.85, lngMin: 83.15, lngMax: 83.45 }, fallbackRate: 4500 },
];

/* ── CIRCLE RATE LOOKUP (Multi-city Haversine micromarket + fallback) ──── */
export function getCircleRateForLocation(lat, lng) {
  // Determine which city the coordinates fall in
  for (const city of CITY_CONFIGS) {
    const { bounds, zones, name, fallbackRate } = city;
    if (lat >= bounds.latMin && lat <= bounds.latMax && lng >= bounds.lngMin && lng <= bounds.lngMax) {
      // Layer 1 — find closest zone within its radius
      let best = null;
      let bestDist = Infinity;
      for (const zone of zones) {
        const dist = haversineKm(lat, lng, zone.lat, zone.lng);
        if (dist < bestDist) { bestDist = dist; best = zone; }
      }
      if (best && bestDist <= best.radiusKm) {
        return { ratePerSqft: best.ratePerSqft, zone: best.name, confidence: 'high', fallback: false };
      }
      // Layer 2 — city-level fallback
      return { ratePerSqft: fallbackRate, zone: name, confidence: 'medium', fallback: false };
    }
  }

  // Outside all coverage areas
  return { ratePerSqft: 5000, zone: 'Outside Coverage', confidence: 'low', fallback: true };
}

/* ── OVERPASS INFRASTRUCTURE SIGNALS ────────────────────────────────────── */
export async function fetchInfrastructureSignals(lat, lng) {
  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  if (GEO_CACHE[cacheKey]) return GEO_CACHE[cacheKey];

  const query = `[out:json][timeout:10];
(
  node["amenity"~"hospital|clinic"](around:1200,${lat},${lng});
  way["amenity"~"hospital|clinic"](around:1200,${lat},${lng});
  node["amenity"~"school|college"](around:1200,${lat},${lng});
  way["amenity"~"school|college"](around:1200,${lat},${lng});
  node["railway"="station"](around:1200,${lat},${lng});
  way["railway"="station"](around:1200,${lat},${lng});
  node["highway"="bus_stop"](around:1200,${lat},${lng});
  node["amenity"~"bank|atm"](around:1200,${lat},${lng});
  way["amenity"~"bank|atm"](around:1200,${lat},${lng});
  node["shop"~"supermarket|mall"](around:1200,${lat},${lng});
  way["shop"~"supermarket|mall"](around:1200,${lat},${lng});
  way["highway"~"primary|secondary|residential"](around:1200,${lat},${lng});
);
out center;`;

  const fallback = {
    infraScore: 60, amenityDensity: 5,
    hospitalCount: 1, schoolCount: 1, transitCount: 1,
    bankCount: 1, retailCount: 1, roadDensity: 0.5,
    localityGrade: 'Developing', fallback: true,
  };

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetchWithRetry('https://overpass-api.de/api/interpreter', {
      method:  'POST',
      body:    `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal:  controller.signal,
    }, { maxAttempts: 2, baseDelayMs: 1000 });
    clearTimeout(timeoutId);
    const data     = await res.json();
    const elements = data.elements || [];

    const hospitalCount = elements.filter(el =>
      el.tags?.amenity === 'hospital' || el.tags?.amenity === 'clinic').length;
    const schoolCount   = elements.filter(el =>
      el.tags?.amenity === 'school'   || el.tags?.amenity === 'college').length;
    const transitCount  = elements.filter(el =>
      el.tags?.railway === 'station'  || el.tags?.highway === 'bus_stop').length;
    const bankCount     = elements.filter(el =>
      el.tags?.amenity === 'bank'     || el.tags?.amenity === 'atm').length;
    const retailCount   = elements.filter(el =>
      el.tags?.shop === 'supermarket' || el.tags?.shop === 'mall').length;
    const roadCount     = elements.filter(el =>
      el.tags?.highway === 'primary'  || el.tags?.highway === 'secondary' ||
      el.tags?.highway === 'residential').length;

    const roadDensity    = Math.min(1.0, roadCount / 10);
    const amenityDensity = hospitalCount + schoolCount + transitCount + bankCount + retailCount;

    let infraScore = 50;
    infraScore += Math.min(18, hospitalCount * 6);
    infraScore += Math.min(12, schoolCount   * 4);
    infraScore += Math.min(15, transitCount  * 5);
    infraScore += Math.min(6,  bankCount     * 2);
    infraScore += Math.min(9,  retailCount   * 3);
    infraScore  = Math.min(100, Math.round(infraScore));

    const localityGrade =
      infraScore >= 85 ? 'Premium'     :
      infraScore >= 70 ? 'Established' :
      infraScore >= 55 ? 'Developing'  :
      infraScore >= 40 ? 'Emerging'    : 'Peripheral';

    const result = {
      infraScore, amenityDensity,
      hospitalCount, schoolCount, transitCount,
      bankCount, retailCount, roadDensity,
      localityGrade, fallback: false,
    };
    GEO_CACHE[cacheKey] = result;
    return result;
  } catch {
    clearTimeout(timeoutId);
    return fallback;
  }
}

/* ── LEGACY BOUNDING-BOX CIRCLE RATE (keyword / batch fallback) ──────────── */
const ZONE_RATES = [
  { name: 'Indiranagar',      minLat: 12.970, maxLat: 12.995, minLng: 77.620, maxLng: 77.650, rates: { residential: 9500,  commercial: 15000, industrial: 5500 } },
  { name: 'Koramangala',      minLat: 12.910, maxLat: 12.940, minLng: 77.600, maxLng: 77.638, rates: { residential: 8500,  commercial: 13500, industrial: 5000 } },
  { name: 'Whitefield',       minLat: 12.960, maxLat: 12.990, minLng: 77.720, maxLng: 77.775, rates: { residential: 7200,  commercial: 11000, industrial: 4200 } },
  { name: 'HSR Layout',       minLat: 12.900, maxLat: 12.930, minLng: 77.635, maxLng: 77.665, rates: { residential: 7800,  commercial: 12000, industrial: 4500 } },
  { name: 'Jayanagar',        minLat: 12.910, maxLat: 12.942, minLng: 77.565, maxLng: 77.600, rates: { residential: 8200,  commercial: 12500, industrial: 4800 } },
  { name: 'JP Nagar',         minLat: 12.876, maxLat: 12.912, minLng: 77.565, maxLng: 77.610, rates: { residential: 6500,  commercial: 10000, industrial: 3800 } },
  { name: 'Marathahalli',     minLat: 12.940, maxLat: 12.975, minLng: 77.690, maxLng: 77.730, rates: { residential: 6800,  commercial: 10500, industrial: 3900 } },
  { name: 'Hebbal',           minLat: 13.030, maxLat: 13.065, minLng: 77.575, maxLng: 77.625, rates: { residential: 6900,  commercial: 10800, industrial: 4000 } },
  { name: 'Yelahanka',        minLat: 13.090, maxLat: 13.135, minLng: 77.575, maxLng: 77.625, rates: { residential: 5500,  commercial: 8500,  industrial: 3200 } },
  { name: 'Electronic City',  minLat: 12.830, maxLat: 12.873, minLng: 77.655, maxLng: 77.700, rates: { residential: 5800,  commercial: 9000,  industrial: 3500 } },
  { name: 'Bannerghatta Road',minLat: 12.856, maxLat: 12.908, minLng: 77.565, maxLng: 77.618, rates: { residential: 6200,  commercial: 9500,  industrial: 3600 } },
  { name: 'Greater Bengaluru',minLat: 12.700, maxLat: 13.200, minLng: 77.350, maxLng: 77.950, rates: { residential: 4200,  commercial: 6800,  industrial: 2800 } },
];

export function fetchCircleRate(lat, lng, propertyType) {
  const key = ['residential', 'commercial', 'industrial'].includes(
    (propertyType || '').toLowerCase()
  ) ? propertyType.toLowerCase() : 'residential';
  for (const zone of ZONE_RATES) {
    if (lat >= zone.minLat && lat <= zone.maxLat && lng >= zone.minLng && lng <= zone.maxLng)
      return zone.rates[key];
  }
  return 4200;
}

const KEYWORD_RATES = {
  // Bengaluru
  indiranagar:       { residential: 9500,  commercial: 15000, industrial: 5500 },
  koramangala:       { residential: 8500,  commercial: 13500, industrial: 5000 },
  whitefield:        { residential: 7200,  commercial: 11000, industrial: 4200 },
  'hsr layout':      { residential: 7800,  commercial: 12000, industrial: 4500 },
  jayanagar:         { residential: 8200,  commercial: 12500, industrial: 4800 },
  'jp nagar':        { residential: 6500,  commercial: 10000, industrial: 3800 },
  marathahalli:      { residential: 6800,  commercial: 10500, industrial: 3900 },
  hebbal:            { residential: 6900,  commercial: 10800, industrial: 4000 },
  yelahanka:         { residential: 5500,  commercial: 8500,  industrial: 3200 },
  'electronic city': { residential: 5800,  commercial: 9000,  industrial: 3500 },
  bannerghatta:      { residential: 6200,  commercial: 9500,  industrial: 3600 },
  malleswaram:       { residential: 8800,  commercial: 13000, industrial: 5000 },
  rajajinagar:       { residential: 7500,  commercial: 11500, industrial: 4300 },
  // Mumbai
  'bandra':          { residential: 22000, commercial: 28000, industrial: 8000 },
  'andheri':         { residential: 14500, commercial: 18000, industrial: 6500 },
  'juhu':            { residential: 20000, commercial: 25000, industrial: 7500 },
  'powai':           { residential: 13000, commercial: 16000, industrial: 6000 },
  'worli':           { residential: 25000, commercial: 30000, industrial: 9000 },
  'lower parel':     { residential: 23000, commercial: 28000, industrial: 8500 },
  'goregaon':        { residential: 11000, commercial: 14000, industrial: 5000 },
  'thane':           { residential: 8500,  commercial: 11000, industrial: 4200 },
  'navi mumbai':     { residential: 7500,  commercial: 10000, industrial: 3800 },
  // Hyderabad
  'banjara hills':   { residential: 12000, commercial: 16000, industrial: 5500 },
  'jubilee hills':   { residential: 13000, commercial: 17000, industrial: 6000 },
  'gachibowli':      { residential: 8500,  commercial: 11000, industrial: 4200 },
  'madhapur':        { residential: 9200,  commercial: 12000, industrial: 4500 },
  'kondapur':        { residential: 7800,  commercial: 10000, industrial: 4000 },
  'kukatpally':      { residential: 6500,  commercial: 8500,  industrial: 3500 },
  // Chennai
  'anna nagar':      { residential: 9500,  commercial: 12000, industrial: 4500 },
  't nagar':         { residential: 12000, commercial: 15000, industrial: 5500 },
  'adyar':           { residential: 10500, commercial: 13000, industrial: 5000 },
  'nungambakkam':    { residential: 13000, commercial: 16000, industrial: 6000 },
  'velachery':       { residential: 7500,  commercial: 9500,  industrial: 3800 },
  // Pune
  'koregaon park':   { residential: 12000, commercial: 15000, industrial: 5500 },
  'viman nagar':     { residential: 8800,  commercial: 11000, industrial: 4300 },
  'kothrud':         { residential: 9500,  commercial: 12000, industrial: 4500 },
  'hinjewadi':       { residential: 6500,  commercial: 8500,  industrial: 3500 },
  'baner':           { residential: 8500,  commercial: 10500, industrial: 4200 },
  // Delhi NCR
  'defence colony':  { residential: 18000, commercial: 22000, industrial: 7000 },
  'vasant vihar':    { residential: 16000, commercial: 20000, industrial: 6500 },
  'greater kailash': { residential: 15000, commercial: 18000, industrial: 6000 },
  'dwarka':          { residential: 8000,  commercial: 10000, industrial: 4000 },
  'gurgaon':         { residential: 7500,  commercial: 9500,  industrial: 3800 },
  'noida':           { residential: 5500,  commercial: 7000,  industrial: 3200 },
  // Ahmedabad
  'navrangpura':     { residential: 9500,  commercial: 13000, industrial: 4500 },
  'satellite':       { residential: 9000,  commercial: 12500, industrial: 4300 },
  'bodakdev':        { residential: 8500,  commercial: 12000, industrial: 4200 },
  'prahlad nagar':   { residential: 8000,  commercial: 11000, industrial: 4000 },
  'sg highway':      { residential: 6500,  commercial: 9000,  industrial: 3500 },
  'bopal':           { residential: 5500,  commercial: 7500,  industrial: 3000 },
  // Kolkata
  'alipore':         { residential: 18000, commercial: 22000, industrial: 7000 },
  'park street':     { residential: 16000, commercial: 20000, industrial: 6500 },
  'ballygunge':      { residential: 14000, commercial: 18000, industrial: 6000 },
  'salt lake':       { residential: 8500,  commercial: 11000, industrial: 4200 },
  'new town':        { residential: 6000,  commercial: 8000,  industrial: 3500 },
  'rajarhat':        { residential: 5500,  commercial: 7500,  industrial: 3000 },
  // Kochi
  'marine drive':    { residential: 12000, commercial: 15000, industrial: 5000 },
  'palarivattom':    { residential: 9500,  commercial: 12500, industrial: 4500 },
  'edapally':        { residential: 8500,  commercial: 11000, industrial: 4000 },
  'kakkanad':        { residential: 7000,  commercial: 9500,  industrial: 3500 },
  // Nagpur
  'sitabuldi':       { residential: 9000,  commercial: 12000, industrial: 4200 },
  'civil lines':     { residential: 8000,  commercial: 10500, industrial: 4000 },
  'dharampeth':      { residential: 7500,  commercial: 10000, industrial: 3800 },
  'wardha road':     { residential: 5500,  commercial: 7500,  industrial: 3000 },
  // Indore
  'palasia':         { residential: 8500,  commercial: 11000, industrial: 4200 },
  'vijay nagar':     { residential: 6000,  commercial: 8000,  industrial: 3200 },
  'ab road':         { residential: 7000,  commercial: 9500,  industrial: 3500 },
  // Jaipur
  'c-scheme':        { residential: 12000, commercial: 15000, industrial: 5000 },
  'malviya nagar':   { residential: 7500,  commercial: 10000, industrial: 3800 },
  'vaishali nagar':  { residential: 6500,  commercial: 8500,  industrial: 3200 },
  'mansarovar':      { residential: 5500,  commercial: 7500,  industrial: 3000 },
  // Lucknow
  'hazratganj':      { residential: 12000, commercial: 15000, industrial: 5000 },
  'gomti nagar':     { residential: 6500,  commercial: 8500,  industrial: 3200 },
  'aliganj':         { residential: 5500,  commercial: 7000,  industrial: 2800 },
  // Surat
  'athwa lines':     { residential: 9000,  commercial: 12000, industrial: 4200 },
  'city light':      { residential: 8500,  commercial: 11000, industrial: 4000 },
  'vesu':            { residential: 7000,  commercial: 9500,  industrial: 3500 },
  'adajan':          { residential: 6500,  commercial: 8500,  industrial: 3200 },
  // Vadodara
  'alkapuri':        { residential: 8000,  commercial: 10500, industrial: 4000 },
  'fatehganj':       { residential: 6500,  commercial: 8500,  industrial: 3200 },
  // Chandigarh
  'sector 17':       { residential: 14000, commercial: 18000, industrial: 6000 },
  'sector 8':        { residential: 12000, commercial: 15000, industrial: 5000 },
  'sector 35':       { residential: 10000, commercial: 13000, industrial: 4500 },
  'mohali':          { residential: 8000,  commercial: 10500, industrial: 4000 },
  // Coimbatore
  'race course':     { residential: 8000,  commercial: 10500, industrial: 4000 },
  'saibaba colony':  { residential: 7000,  commercial: 9000,  industrial: 3500 },
  'peelamedu':       { residential: 6500,  commercial: 8500,  industrial: 3200 },
  // Bhopal
  'arera colony':    { residential: 7000,  commercial: 9000,  industrial: 3500 },
  'mp nagar':        { residential: 6500,  commercial: 8500,  industrial: 3200 },
  // Visakhapatnam / Vizag
  'mvp colony':      { residential: 8000,  commercial: 10500, industrial: 4000 },
  'dwaraka nagar':   { residential: 7500,  commercial: 10000, industrial: 3800 },
  'rushikonda':      { residential: 6500,  commercial: 8500,  industrial: 3200 },
  'madhurawada':     { residential: 5500,  commercial: 7500,  industrial: 3000 },
};

// City-level default rates when no keyword matches but city name is detected
const CITY_DEFAULT_RATES = {
  bengaluru:      4200, bangalore:   4200,
  mumbai:         9000, bombay:      9000,
  hyderabad:      5800,
  chennai:        6000, madras:      6000,
  pune:           5500,
  delhi:          7000,
  ahmedabad:      5500,
  kolkata:        5500, calcutta:    5500,
  kochi:          6500, cochin:      6500,
  nagpur:         4500,
  indore:         4500,
  jaipur:         4500,
  lucknow:        4000,
  surat:          5000,
  vadodara:       4500, baroda:      4500,
  chandigarh:     6500,
  coimbatore:     4500,
  bhopal:         4000,
  visakhapatnam:  4500, vizag:       4500,
};

export function circleRateFromKeyword(address, propertyType) {
  const a   = (address || '').toLowerCase();
  const key = ['residential', 'commercial', 'industrial'].includes(
    (propertyType || '').toLowerCase()
  ) ? propertyType.toLowerCase() : 'residential';

  // Try specific zone keywords first
  for (const [zone, rates] of Object.entries(KEYWORD_RATES)) {
    if (a.includes(zone)) return rates[key];
  }

  // Fallback to city-level default
  for (const [city, rate] of Object.entries(CITY_DEFAULT_RATES)) {
    if (a.includes(city)) return rate;
  }

  return 4200;
}

/* ── MARKET DYNAMICS (Overpass supply/demand/competition signals) ─────────── */
export async function fetchMarketDynamics(lat, lng) {
  const cacheKey = `md_${lat.toFixed(3)}_${lng.toFixed(3)}`;
  if (GEO_CACHE[cacheKey]) return GEO_CACHE[cacheKey];

  const query = `[out:json][timeout:10];
(
  way["building"="construction"](around:1500,${lat},${lng});
  node["landuse"="construction"](around:1500,${lat},${lng});
  node["amenity"="real_estate_agent"](around:2000,${lat},${lng});
  node["shop"="estate_agent"](around:2000,${lat},${lng});
  node["office"~"company|it|coworking|government"](around:1500,${lat},${lng});
  way["office"~"company|it|coworking|government"](around:1500,${lat},${lng});
  way["building"="residential"](around:1000,${lat},${lng});
  way["building"="apartments"](around:1000,${lat},${lng});
);
out count;`;

  const fallback = {
    supplyPressure:   'medium',
    demandSignal:     'moderate',
    competitionIndex: 50,
    rentalYieldEst:   3.0,
    liquidityPremium: 0,
    activeConstruction: 0,
    officeCount:        0,
    estateAgentCount:   0,
    residentialDensity: 0,
    fallback: true,
  };

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetchWithRetry('https://overpass-api.de/api/interpreter', {
      method:  'POST',
      body:    `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal:  controller.signal,
    }, { maxAttempts: 2, baseDelayMs: 1000 });
    clearTimeout(timeoutId);
    const data     = await res.json();
    const elements = data.elements || [];

    const activeConstruction = elements.filter(el =>
      el.tags?.building === 'construction' || el.tags?.landuse === 'construction').length;
    const estateAgentCount = elements.filter(el =>
      el.tags?.amenity === 'real_estate_agent' || el.tags?.shop === 'estate_agent').length;
    const officeCount = elements.filter(el =>
      el.tags?.office === 'company' || el.tags?.office === 'it' ||
      el.tags?.office === 'coworking' || el.tags?.office === 'government').length;
    const residentialDensity = elements.filter(el =>
      el.tags?.building === 'residential' || el.tags?.building === 'apartments').length;

    const supplyPressure = activeConstruction > 5 ? 'high' : activeConstruction > 2 ? 'medium' : 'low';
    const demandSignal   = officeCount > 8 ? 'strong' : officeCount > 3 ? 'moderate' : 'weak';

    // Competition index 0–100
    const competitionIndex = Math.min(100, Math.round(
      (estateAgentCount * 12) + (Math.min(10, residentialDensity) * 3) + (activeConstruction * 8)
    ));

    // Rental yield estimate based on employment density: 2.5–4.5% gross yield
    const rentalYieldEst = officeCount > 8 ? 4.2 : officeCount > 3 ? 3.5 : 2.8;

    // Composite liquidity adjustment: demand pull minus supply drag
    const demandNum       = { strong: 2, moderate: 0, weak: -1 }[demandSignal];
    const supplyNum       = { low: 1, medium: 0, high: -2 }[supplyPressure];
    const liquidityPremium = Math.max(-0.06, Math.min(0.06, (demandNum + supplyNum) * 0.02));

    const result = {
      supplyPressure, demandSignal, competitionIndex, rentalYieldEst,
      liquidityPremium, activeConstruction, officeCount, estateAgentCount,
      residentialDensity, fallback: false,
    };
    GEO_CACHE[cacheKey] = result;
    return result;
  } catch {
    clearTimeout(timeoutId);
    return fallback;
  }
}
