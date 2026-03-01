/**
 * subway.js — Nearby subway entrances (Hell's Kitchen / Midtown West).
 * Ranks by distance. Next-train time is placeholder (can be wired to MTA GTFS-RT later).
 */

const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LNG_AT_40 = 111320 * Math.cos((40 * Math.PI) / 180);

const SUBWAY_ENTRANCES = [
  { id: '42-pa', name: '42 St - Port Authority', lines: 'A C E', lat: 40.7563, lng: -73.9901 },
  { id: '50-ce', name: '50 St', lines: 'C E', lat: 40.7623, lng: -73.9859 },
  { id: '42-tsq', name: '42 St - Times Sq', lines: '1 2 3 7 N Q R W A C E', lat: 40.7559, lng: -73.9865 },
  { id: '49-nrw', name: '49 St', lines: 'N R W', lat: 40.7604, lng: -73.9842 },
  { id: '34-hy', name: '34 St - Hudson Yards', lines: '7', lat: 40.7558, lng: -74.0019 },
  { id: '34-penn', name: '34 St - Penn Station', lines: '1 2 3 A C E', lat: 40.7506, lng: -73.9910 },
  { id: '59-cc', name: '59 St - Columbus Circle', lines: 'A B C D 1', lat: 40.7681, lng: -73.9819 },
  { id: '42-bp', name: '42 St - Bryant Park', lines: 'B D F M 7', lat: 40.7542, lng: -73.9846 },
  { id: '50-1', name: '50 St', lines: '1', lat: 40.7617, lng: -73.9858 },
  { id: '66-lc', name: '66 St - Lincoln Center', lines: '1 2', lat: 40.7734, lng: -73.9820 },
  { id: '40-tsq', name: '40 St - Times Sq', lines: 'N Q R W', lat: 40.7546, lng: -73.9868 },
  { id: '34-7av', name: '34 St - 7 Av', lines: '1 2 3', lat: 40.7523, lng: -73.9908 },
];

function distanceMeters(lat1, lng1, lat2, lng2) {
  const dlat = (lat2 - lat1) * METERS_PER_DEG_LAT;
  const dlng = (lng2 - lng1) * METERS_PER_DEG_LNG_AT_40;
  return Math.round(Math.sqrt(dlat * dlat + dlng * dlng));
}

/**
 * Returns subway entrances near the given point, sorted closest first.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusMeters
 * @returns {Array<{ id, name, lines, lat, lng, distance }>}
 */
export function getNearbySubwayEntrances(lat, lng, radiusMeters = 1200) {
  const nearby = SUBWAY_ENTRANCES
    .map((s) => ({
      ...s,
      distance: distanceMeters(lat, lng, s.lat, s.lng),
    }))
    .filter((s) => s.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance);
  return nearby;
}

/**
 * Placeholder next-train time in minutes (stable per station for demo).
 * Replace with MTA GTFS-RT when API key is available.
 * @param {string} stationId
 * @returns {number | null} minutes or null if unknown
 */
export function getNextTrainMinutes(stationId) {
  if (!stationId) return null;
  const hash = stationId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return (hash % 9) + 1;
}
