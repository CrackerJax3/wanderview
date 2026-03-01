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

  let currentPosition = { lat: ORIGIN_LAT, lng: ORIGIN_LNG, heading: 0 };
  let positionCallbacks = [];
  let missionCallbacks = [];

  // Convert lat/lng to scene position (meters from origin)
  function latLngToScene(lat, lng) {
    const x = (lng - ORIGIN_LNG) * METERS_PER_DEG_LNG * SCALE;
    const z = -(lat - ORIGIN_LAT) * METERS_PER_DEG_LAT * SCALE;
    return { x, z };
  }

  // Convert scene position to lat/lng
  function sceneToLatLng(x, z) {
    const lng = ORIGIN_LNG + x / (METERS_PER_DEG_LNG * SCALE);
    const lat = ORIGIN_LAT - z / (METERS_PER_DEG_LAT * SCALE);
    return { lat, lng };
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

    // Get current player position as lat/lng/heading
    getPosition: function () {
      return { ...currentPosition };
    },

    // Update position (called by engine.js on each frame)
    updatePosition: function (lat, lng, heading) {
      const prev = { ...currentPosition };
      currentPosition = { lat, lng, heading };
      // Notify listeners if position changed meaningfully
      const dist = Math.sqrt(
        Math.pow((lat - prev.lat) * METERS_PER_DEG_LAT, 2) +
        Math.pow((lng - prev.lng) * METERS_PER_DEG_LNG, 2)
      );
      if (dist > 0.5 || Math.abs(heading - prev.heading) > 5) {
        positionCallbacks.forEach(function (cb) {
          try { cb(currentPosition); } catch (e) { console.error('Position callback error:', e); }
        });
      }
    },

    // Teleport player to a lat/lng
    teleportTo: function (lat, lng) {
      const scene = latLngToScene(lat, lng);
      const rig = document.getElementById('player-rig');
      if (rig) {
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
