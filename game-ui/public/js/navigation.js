/**
 * navigation.js — Navigation & Position Tracking
 * Minimap, compass, and street-level position tracking.
 */

(function () {
  // Street data for Hell's Kitchen
  const STREETS = {
    eastWest: [
      { name: '42nd St', lat: 40.7565 },
      { name: '43rd St', lat: 40.7574 },
      { name: '44th St', lat: 40.7583 },
      { name: '45th St', lat: 40.7591 },
      { name: '46th St', lat: 40.7600 },
      { name: '47th St', lat: 40.7608 },
      { name: '48th St', lat: 40.7617 },
      { name: '49th St', lat: 40.7625 },
      { name: '50th St', lat: 40.7634 },
      { name: '51st St', lat: 40.7643 },
      { name: '52nd St', lat: 40.7651 },
      { name: '53rd St', lat: 40.7660 },
      { name: '54th St', lat: 40.7668 },
      { name: '55th St', lat: 40.7677 },
      { name: '56th St', lat: 40.7685 },
      { name: '57th St', lat: 40.7694 },
    ],
    northSouth: [
      { name: '8th Ave', lng: -73.9878 },
      { name: '9th Ave', lng: -73.9918 },
      { name: '10th Ave', lng: -73.9962 },
      { name: '11th Ave', lng: -74.0004 },
      { name: '12th Ave', lng: -74.0040 },
    ],
  };

  // Landmarks
  const LANDMARKS = [
    { name: 'Times Square', lat: 40.7580, lng: -73.9855, icon: '🎭' },
    { name: 'Restaurant Row', lat: 40.7590, lng: -73.9895, icon: '🍽️' },
    { name: 'Intrepid Museum', lat: 40.7645, lng: -74.0003, icon: '🚢' },
    { name: "Hell's Kitchen Park", lat: 40.7628, lng: -73.9966, icon: '🌳' },
    { name: 'DeWitt Clinton Park', lat: 40.7665, lng: -73.9950, icon: '🌿' },
    { name: 'Terminal 5', lat: 40.7680, lng: -73.9929, icon: '🎵' },
    { name: 'Port Authority', lat: 40.7570, lng: -73.9903, icon: '🚌' },
  ];

  // Determine current street from lat/lng
  function getCurrentStreet(lat, lng) {
    let closestStreet = '';
    let closestAve = '';
    let minStreetDist = Infinity;
    let minAveDist = Infinity;

    STREETS.eastWest.forEach(function (st) {
      const dist = Math.abs(lat - st.lat);
      if (dist < minStreetDist) {
        minStreetDist = dist;
        closestStreet = st.name;
      }
    });

    STREETS.northSouth.forEach(function (ave) {
      const dist = Math.abs(lng - ave.lng);
      if (dist < minAveDist) {
        minAveDist = dist;
        closestAve = ave.name;
      }
    });

    return { street: closestStreet, avenue: closestAve };
  }

  // Get nearby landmarks
  function getNearbyLandmarks(lat, lng, radiusMeters) {
    radiusMeters = radiusMeters || 200;
    return LANDMARKS.filter(function (lm) {
      const dlat = (lm.lat - lat) * 111320;
      const dlng = (lm.lng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
      const dist = Math.sqrt(dlat * dlat + dlng * dlng);
      return dist <= radiusMeters;
    }).map(function (lm) {
      const dlat = (lm.lat - lat) * 111320;
      const dlng = (lm.lng - lng) * 111320 * Math.cos(lat * Math.PI / 180);
      return {
        ...lm,
        distance: Math.round(Math.sqrt(dlat * dlat + dlng * dlng)),
      };
    }).sort(function (a, b) {
      return a.distance - b.distance;
    });
  }

  // Compass direction from heading
  function getCompassDirection(heading) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(heading / 45) % 8;
    return dirs[idx];
  }

  // Expose navigation utilities to window
  window.gameNavigation = {
    getCurrentStreet: getCurrentStreet,
    getNearbyLandmarks: getNearbyLandmarks,
    getCompassDirection: getCompassDirection,
    STREETS: STREETS,
    LANDMARKS: LANDMARKS,
  };
})();
