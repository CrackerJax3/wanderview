/**
 * places.js — Google Places API Service
 * Fetches real nearby places and caches results to avoid API spam.
 */

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';

let apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_RADIUS = 0.001; // ~100m in degrees — reuse cache within this radius

// Hardcoded Hell's Kitchen places as fallback
const FALLBACK_PLACES = [
  { name: "Rudy's Bar & Grill", lat: 40.7605, lng: -73.9929, type: 'bar', description: 'Legendary dive bar with free hot dogs since 1933' },
  { name: "Don Antonio", lat: 40.7590, lng: -73.9895, type: 'restaurant', description: 'Neapolitan pizzeria on Restaurant Row' },
  { name: "Marseille", lat: 40.7587, lng: -73.9893, type: 'restaurant', description: 'French-Mediterranean brasserie on Restaurant Row' },
  { name: "Gotham West Market", lat: 40.7626, lng: -73.9953, type: 'food_hall', description: 'Upscale food hall with multiple vendors' },
  { name: "Print Restaurant", lat: 40.7610, lng: -73.9945, type: 'restaurant', description: 'Farm-to-table in the Ink48 Hotel' },
  { name: "Terminal 5", lat: 40.7680, lng: -73.9929, type: 'music_venue', description: 'Major live music venue' },
  { name: "Daisy's Diner", lat: 40.7600, lng: -73.9940, type: 'restaurant', description: 'Classic American diner' },
  { name: "Landmark Tavern", lat: 40.7592, lng: -73.9975, type: 'bar', description: 'Historic 1868 Irish pub on 11th Avenue' },
  { name: "Pier 84", lat: 40.7650, lng: -74.0010, type: 'park', description: 'Hudson River Park pier with kayaking' },
  { name: "Hell's Kitchen Flea Market", lat: 40.7615, lng: -73.9938, type: 'market', description: 'Weekend flea market on 39th Street' },
  { name: "Sacred Chow", lat: 40.7598, lng: -73.9935, type: 'restaurant', description: 'Vegan comfort food' },
  { name: "Al Hirschfeld Theatre", lat: 40.7590, lng: -73.9880, type: 'theater', description: 'Historic Broadway theater' },
  { name: "John's Pizzeria", lat: 40.7584, lng: -73.9888, type: 'restaurant', description: 'Legendary Times Square coal-oven pizza' },
  { name: "Birdland Jazz Club", lat: 40.7588, lng: -73.9905, type: 'music_venue', description: 'Iconic jazz club since 1949' },
  { name: "Intrepid Museum", lat: 40.7645, lng: -74.0003, type: 'museum', description: 'Aircraft carrier turned museum on Pier 86' },
  { name: "DeWitt Clinton Park", lat: 40.7665, lng: -73.9950, type: 'park', description: 'Neighborhood park with playground and dog run' },
  { name: "Hudson Yards", lat: 40.7539, lng: -74.0005, type: 'landmark', description: 'Massive modern development with The Vessel' },
  { name: "Port Authority Bus Terminal", lat: 40.7570, lng: -73.9903, type: 'transit', description: 'Major bus terminal connecting NYC to NJ' },
];

export function setApiKey(key) {
  apiKey = key;
}

function getCacheKey(lat, lng) {
  // Round to nearest cache radius for spatial caching
  const roundedLat = Math.round(lat / CACHE_RADIUS) * CACHE_RADIUS;
  const roundedLng = Math.round(lng / CACHE_RADIUS) * CACHE_RADIUS;
  return `${roundedLat.toFixed(4)},${roundedLng.toFixed(4)}`;
}

export async function getNearbyPlaces(lat, lng, radius = 300) {
  const cacheKey = getCacheKey(lat, lng);

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.places;
  }

  if (!apiKey) {
    const places = getFallbackPlaces(lat, lng, radius);
    cache.set(cacheKey, { places, timestamp: Date.now() });
    return places;
  }

  try {
    const response = await fetch(PLACES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types,places.primaryType',
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radius,
          },
        },
        maxResultCount: 10,
      }),
    });

    if (!response.ok) {
      console.warn('Places API error, using fallback');
      const places = getFallbackPlaces(lat, lng, radius);
      cache.set(cacheKey, { places, timestamp: Date.now() });
      return places;
    }

    const data = await response.json();
    const places = (data.places || []).map((p) => ({
      name: p.displayName?.text || 'Unknown',
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      type: p.primaryType || p.types?.[0] || 'place',
      address: p.formattedAddress || '',
    }));

    cache.set(cacheKey, { places, timestamp: Date.now() });
    return places;
  } catch (err) {
    console.error('Places API failed:', err);
    const places = getFallbackPlaces(lat, lng, radius);
    cache.set(cacheKey, { places, timestamp: Date.now() });
    return places;
  }
}

function getFallbackPlaces(lat, lng, radius) {
  const radiusDeg = radius / 111320;
  return FALLBACK_PLACES
    .filter((p) => {
      const dlat = p.lat - lat;
      const dlng = p.lng - lng;
      return Math.sqrt(dlat * dlat + dlng * dlng) < radiusDeg;
    })
    .map((p) => {
      const dlat = (p.lat - lat) * 111320;
      const dlng = (p.lng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
      return {
        ...p,
        distance: Math.round(Math.sqrt(dlat * dlat + dlng * dlng)),
      };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);
}

export function clearCache() {
  cache.clear();
}
