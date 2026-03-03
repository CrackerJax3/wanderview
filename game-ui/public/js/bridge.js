/**
 * bridge.js — Game Engine Bridge
 * Shared API between 3D world (Person A) and UI (Person B)
 * Exposes window.gameEngine for cross-system communication.
 */

(function () {
  // Hell's Kitchen center coordinates
  const ORIGIN_LAT = 40.7608;
  const ORIGIN_LNG = -73.9941;

  // Meters per degree at this latitude
  const METERS_PER_DEG_LAT = 111320;
  const METERS_PER_DEG_LNG = 111320 * Math.cos((ORIGIN_LAT * Math.PI) / 180);

  // Scale factor: 3D scene units to meters
  const SCALE = 1.0;

  const GEO_OFFSET_STORAGE_KEY = 'wanderview_geo_offset_v1';
  let geoOffset = { lat: 0, lng: 0 };
  try {
    const raw = localStorage.getItem(GEO_OFFSET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
        geoOffset = { lat: parsed.lat, lng: parsed.lng };
      }
    }
  } catch (e) {
    // ignore
  }

  let currentPosition = { lat: ORIGIN_LAT, lng: ORIGIN_LNG, heading: 0 };
  let positionCallbacks = [];
  let missionCallbacks = [];

  function persistGeoOffset() {
    try {
      localStorage.setItem(GEO_OFFSET_STORAGE_KEY, JSON.stringify(geoOffset));
    } catch (e) {
      // ignore
    }
  }

  function notifyPosition() {
    positionCallbacks.forEach(function (cb) {
      try { cb({ ...currentPosition }); } catch (e) { console.error('Position callback error:', e); }
    });
  }

  // Convert lat/lng to scene position (meters from origin)
  function latLngToScene(lat, lng) {
    lat = lat - geoOffset.lat;
    lng = lng - geoOffset.lng;
    const x = (lng - ORIGIN_LNG) * METERS_PER_DEG_LNG * SCALE;
    const z = -(lat - ORIGIN_LAT) * METERS_PER_DEG_LAT * SCALE;
    return { x, z };
  }

  // Convert scene position to lat/lng
  function sceneToLatLng(x, z) {
    const lng = ORIGIN_LNG + x / (METERS_PER_DEG_LNG * SCALE);
    const lat = ORIGIN_LAT - z / (METERS_PER_DEG_LAT * SCALE);
    return { lat: lat + geoOffset.lat, lng: lng + geoOffset.lng };
  }

  window.gameEngine = {
    // Constants
    ORIGIN_LAT,
    ORIGIN_LNG,
    METERS_PER_DEG_LAT,
    METERS_PER_DEG_LNG,
    SCALE,

    // Coordinate conversions
    latLngToScene,
    sceneToLatLng,

    // Geo calibration offset
    getGeoOffset: function () {
      return { ...geoOffset };
    },
    setGeoOffset: function (latOffset, lngOffset) {
      const next = {
        lat: typeof latOffset === 'number' ? latOffset : 0,
        lng: typeof lngOffset === 'number' ? lngOffset : 0,
      };
      const dLat = next.lat - geoOffset.lat;
      const dLng = next.lng - geoOffset.lng;
      geoOffset = next;
      persistGeoOffset();

      currentPosition = { ...currentPosition, lat: currentPosition.lat + dLat, lng: currentPosition.lng + dLng };
      window.dispatchEvent(new CustomEvent('geoOffsetChange', { detail: { offset: { ...geoOffset } } }));
      notifyPosition();
    },
    nudgeGeoOffsetMeters: function (eastMeters, northMeters) {
      eastMeters = typeof eastMeters === 'number' ? eastMeters : 0;
      northMeters = typeof northMeters === 'number' ? northMeters : 0;
      const dLat = northMeters / METERS_PER_DEG_LAT;
      const dLng = eastMeters / METERS_PER_DEG_LNG;
      this.setGeoOffset(geoOffset.lat + dLat, geoOffset.lng + dLng);
    },

    // Get current player position as lat/lng/heading
    getPosition: function () {
      return { ...currentPosition };
    },

    // Update position (called by engine.js on each frame)
    updatePosition: function (lat, lng, heading) {
      const prev = { ...currentPosition };
      currentPosition = { lat, lng, heading };
    // Notify listeners if position or heading changed (small threshold so minimap arrow updates in real time)
    const dist = Math.sqrt(
      Math.pow((lat - prev.lat) * METERS_PER_DEG_LAT, 2) +
      Math.pow((lng - prev.lng) * METERS_PER_DEG_LNG, 2)
    );
    const headingDelta = Math.abs(heading - prev.heading);
    const headingWrap = Math.min(headingDelta, 360 - headingDelta);
    if (dist > 0.5 || headingWrap > 0.01) {
      notifyPosition();
    }
    },

    // Teleport player to a lat/lng (same coordinate system as 2D minimap: WGS84 → local tangent plane at origin)
    teleportTo: function (lat, lng) {
      const scene = latLngToScene(lat, lng);
      const rig = document.getElementById('player-rig');
      if (rig) {
        rig.object3D.position.set(scene.x, 0, scene.z);
        rig.setAttribute('position', { x: scene.x, y: 0, z: scene.z });
      }
      currentPosition.lat = lat;
      currentPosition.lng = lng;
      positionCallbacks.forEach(function (cb) {
        try { cb(currentPosition); } catch (e) { console.error('Teleport callback error:', e); }
      });
    },

    // Subscribe to position changes
    onPositionChange: function (callback) {
      positionCallbacks.push(callback);
      return function () {
        positionCallbacks = positionCallbacks.filter(function (cb) { return cb !== callback; });
      };
    },

    // Mission system
    currentMission: null,
    setMission: function (mission) {
      this.currentMission = mission;
      missionCallbacks.forEach(function (cb) {
        try { cb(mission); } catch (e) { console.error('Mission callback error:', e); }
      });
    },
    onMissionChange: function (callback) {
      missionCallbacks.push(callback);
      return function () {
        missionCallbacks = missionCallbacks.filter(function (cb) { return cb !== callback; });
      };
    },

    // Game state
    gameMode: 'explorer', // explorer | scavenger | history | mystery
    score: 0,
    placesVisited: [],
    isReady: false,

    // Mark engine as ready
    setReady: function () {
      this.isReady = true;
      window.dispatchEvent(new CustomEvent('gameEngineReady'));
    },
  };
})();
