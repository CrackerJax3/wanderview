/**
 * tiles-component.js — Google 3D Tiles A-Frame Component
 *
 * Uses the UMD build of three-loader-3dtiles (loaded before this script)
 * which re-uses A-Frame's window.THREE — no dual Three.js instances.
 *
 * Strategy: always render fallback scene first, then layer real tiles on top.
 */

// Diagnostic: test tiles from browser console via window.testTiles('YOUR_KEY')
window.testTiles = async function(apiKey) {
  apiKey = apiKey || window.WANDERVIEW_GOOGLE_API_KEY;
  if (!apiKey) { console.error('No API key. Usage: testTiles("AIza...")'); return; }
  console.log('Testing with key:', apiKey.substring(0, 8) + '...');
  try {
    var resp = await fetch('https://tile.googleapis.com/v1/3dtiles/root.json?key=' + apiKey);
    console.log('root.json:', resp.status, resp.statusText);
    if (!resp.ok) { console.error('Body:', await resp.text()); return; }
    var json = await resp.json();
    console.log('Tileset version:', json.asset?.version, '| Children:', json.root?.children?.length);
    // Test loading a child tile
    if (json.root?.children?.[0]?.content?.uri) {
      var childUrl = 'https://tile.googleapis.com' + json.root.children[0].content.uri;
      var childResp = await fetch(childUrl);
      console.log('Child tile:', childResp.status, childResp.statusText, '(' + childUrl.substring(0, 80) + '...)');
    }
    console.log('API key works! If tiles still fail, the issue is in the loader.');
    // Check loader availability
    console.log('ThreeLoader3DTiles:', !!window.ThreeLoader3DTiles);
    console.log('THREE.GLTFLoader:', !!THREE.GLTFLoader);
    console.log('THREE.DRACOLoader:', !!THREE.DRACOLoader);
    console.log('THREE.KTX2Loader:', !!THREE.KTX2Loader);
  } catch (e) { console.error('Test failed:', e.message); }
};

AFRAME.registerComponent('google-3dtiles', {
  schema: {
    lat: { type: 'number', default: 40.7608 },
    lng: { type: 'number', default: -73.9941 },
    height: { type: 'number', default: 0 },
  },

  init: function () {
    this.tilesRuntime = null;
    this.tilesModel = null;
    this.fallbackEl = null;

    // Always show fallback scene first
    this._loadFallbackScene();
    this._signalReady();

    // Then attempt real Google 3D Tiles
    var apiKey = this._getApiKey();
    console.log('[3DTiles] API key status:', apiKey ? 'found (' + apiKey.substring(0, 8) + '...)' : 'MISSING');
    if (apiKey) {
      this._attemptGoogleTiles(apiKey);
    } else {
      console.warn('[3DTiles] No API key found. Checked: window.WANDERVIEW_GOOGLE_API_KEY, meta[name=google-api-key], window.GOOGLE_API_KEY');
    }
  },

  _getApiKey: function () {
    if (window.WANDERVIEW_GOOGLE_API_KEY) return window.WANDERVIEW_GOOGLE_API_KEY;
    var metaTag = document.querySelector('meta[name="google-api-key"]');
    if (metaTag && metaTag.content) return metaTag.content;
    return window.GOOGLE_API_KEY || '';
  },

  _attemptGoogleTiles: function (apiKey) {
    var self = this;
    var sceneEl = this.el.sceneEl;

    function tryLoad() {
      // Wait for A-Frame renderer
      if (!sceneEl.renderer || !sceneEl.camera) {
        console.log('[3DTiles] Waiting for A-Frame renderer...');
        sceneEl.addEventListener('renderstart', tryLoad);
        return;
      }
      console.log('[3DTiles] A-Frame renderer ready, loading tiles...');
      self._loadGoogleTiles(apiKey);
    }

    // The UMD build is loaded synchronously via script tag before this file
    if (window.ThreeLoader3DTiles) {
      console.log('[3DTiles] UMD build found, Loader3DTiles:', !!window.ThreeLoader3DTiles.Loader3DTiles);
      tryLoad();
    } else {
      console.error('[3DTiles] three-loader-3dtiles UMD not found on window.ThreeLoader3DTiles');
    }
  },

  _loadGoogleTiles: async function (apiKey) {
    try {
      console.log('[3DTiles] Loading Google Photorealistic 3D Tiles...');
      console.log('[3DTiles] THREE.GLTFLoader available:', !!THREE.GLTFLoader);
      console.log('[3DTiles] THREE.DRACOLoader available:', !!THREE.DRACOLoader);

      var Loader3DTiles = window.ThreeLoader3DTiles.Loader3DTiles;

      // First, verify the API key works by testing root.json
      console.log('[3DTiles] Testing API key with root.json fetch...');
      try {
        var testResp = await fetch('https://tile.googleapis.com/v1/3dtiles/root.json?key=' + apiKey);
        console.log('[3DTiles] root.json response:', testResp.status, testResp.statusText);
        if (!testResp.ok) {
          var errBody = await testResp.text();
          console.error('[3DTiles] API key test failed:', errBody);
          return;
        }
      } catch (fetchErr) {
        console.error('[3DTiles] API key test fetch error:', fetchErr.message);
      }

      var canvas = this.el.sceneEl.canvas;
      var viewport = {
        width: canvas.width,
        height: canvas.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      };
      console.log('[3DTiles] Viewport:', viewport);
      console.log('[3DTiles] Calling Loader3DTiles.load()...');
      var result = await Loader3DTiles.load({
        url: 'https://tile.googleapis.com/v1/3dtiles/root.json',
        viewport: viewport,
        renderer: this.el.sceneEl.renderer,
        options: {
          googleApiKey: apiKey,
          maximumScreenSpaceError: 48,
          maximumMemoryUsage: 128,
          updateTransforms: true,
          dracoDecoderPath: 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/',
          basisTranscoderPath: 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/',
        },
      });

      console.log('[3DTiles] Loader returned:', { model: !!result.model, runtime: !!result.runtime });

      // Orient the globe to Hell's Kitchen, NYC
      console.log('[3DTiles] Orienting to geo coords:', { lat: this.data.lat, long: this.data.lng, height: this.data.height });
      result.runtime.orientToGeocoord({
        lat: this.data.lat,
        long: this.data.lng,
        height: this.data.height,
      });

      // Add the tiles model to the scene
      this.el.sceneEl.object3D.add(result.model);
      this.tilesModel = result.model;
      this.tilesRuntime = result.runtime;

      // Hide fallback scene
      if (this.fallbackEl) {
        this.fallbackEl.setAttribute('visible', 'false');
      }

      console.log('[3DTiles] Google 3D Tiles loaded successfully!');
    } catch (err) {
      console.error('[3DTiles] Google 3D Tiles failed:', err.message);
      console.error('[3DTiles] Stack:', err.stack);
      // Fallback scene stays visible
    }
  },

  _loadFallbackScene: function () {
    var container = document.createElement('a-entity');
    container.setAttribute('id', 'fallback-scene');
    this.el.appendChild(container);
    this.fallbackEl = container;

    // Ground plane
    var ground = document.createElement('a-plane');
    ground.setAttribute('rotation', '-90 0 0');
    ground.setAttribute('width', '4000');
    ground.setAttribute('height', '4000');
    ground.setAttribute('color', '#555555');
    ground.setAttribute('material', 'roughness: 0.9');
    container.appendChild(ground);

    this._createStreetGrid(container);
    this._createBuildings(container);
    console.log('Fallback scene loaded');
  },

  _createStreetGrid: function (parent) {
    var ORIGIN_LAT = 40.7608;
    var ORIGIN_LNG = -73.9941;
    var M_PER_DEG_LAT = 111320;
    var M_PER_DEG_LNG = 111320 * Math.cos(ORIGIN_LAT * Math.PI / 180);

    function lngToX(lng) { return (lng - ORIGIN_LNG) * M_PER_DEG_LNG; }
    function latToZ(lat) { return -(lat - ORIGIN_LAT) * M_PER_DEG_LAT; }

    var avenues = [
      { name: '8th Ave',  lng: -73.9878 },
      { name: '9th Ave',  lng: -73.9918 },
      { name: '10th Ave', lng: -73.9962 },
      { name: '11th Ave', lng: -74.0004 },
      { name: '12th Ave', lng: -74.0040 },
    ];

    var streets = [
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
    ];

    var gridLen = 2000;

    avenues.forEach(function (ave) {
      var x = lngToX(ave.lng);
      var line = document.createElement('a-plane');
      line.setAttribute('rotation', '-90 0 0');
      line.setAttribute('width', '15');
      line.setAttribute('height', '' + gridLen);
      line.setAttribute('position', x + ' 0.01 0');
      line.setAttribute('color', '#444444');
      line.setAttribute('material', 'roughness: 1');
      parent.appendChild(line);

      [-9, 9].forEach(function (sx) {
        var sidewalk = document.createElement('a-plane');
        sidewalk.setAttribute('rotation', '-90 0 0');
        sidewalk.setAttribute('width', '3');
        sidewalk.setAttribute('height', '' + gridLen);
        sidewalk.setAttribute('position', (x + sx) + ' 0.02 0');
        sidewalk.setAttribute('color', '#777777');
        parent.appendChild(sidewalk);
      });
    });

    streets.forEach(function (st) {
      var z = latToZ(st.lat);
      var line = document.createElement('a-plane');
      line.setAttribute('rotation', '-90 0 0');
      line.setAttribute('width', '' + gridLen);
      line.setAttribute('height', '12');
      line.setAttribute('position', '0 0.01 ' + z);
      line.setAttribute('color', '#444444');
      parent.appendChild(line);

      var label = document.createElement('a-text');
      label.setAttribute('value', st.name);
      label.setAttribute('position', (lngToX(avenues[0].lng) + 30) + ' 0.5 ' + z);
      label.setAttribute('color', '#ffffff');
      label.setAttribute('width', '20');
      label.setAttribute('align', 'center');
      parent.appendChild(label);
    });
  },

  _createBuildings: function (parent) {
    var ORIGIN_LAT = 40.7608;
    var ORIGIN_LNG = -73.9941;
    var M_PER_DEG_LAT = 111320;
    var M_PER_DEG_LNG = 111320 * Math.cos(ORIGIN_LAT * Math.PI / 180);

    function lngToX(lng) { return (lng - ORIGIN_LNG) * M_PER_DEG_LNG; }
    function latToZ(lat) { return -(lat - ORIGIN_LAT) * M_PER_DEG_LAT; }

    var aveLngs = [-73.9878, -73.9918, -73.9962, -74.0004];
    var stLats = [40.7565, 40.7574, 40.7583, 40.7591, 40.7600, 40.7608,
                  40.7617, 40.7625, 40.7634, 40.7643, 40.7651, 40.7660,
                  40.7668, 40.7677, 40.7685, 40.7694];

    var colors = [
      '#8B4513', '#A0522D', '#D2691E', '#CD853F',
      '#BC8F8F', '#A9A9A9', '#808080', '#696969',
      '#B8860B', '#DAA520', '#C0C0C0', '#778899',
    ];

    for (var ax = 0; ax < aveLngs.length - 1; ax++) {
      var blockLeftX = lngToX(aveLngs[ax]);
      var blockRightX = lngToX(aveLngs[ax + 1]);
      var blockCenterX = (blockLeftX + blockRightX) / 2;
      var blockW = Math.abs(blockLeftX - blockRightX) - 30;

      for (var si = 0; si < stLats.length - 1; si++) {
        var blockTopZ = latToZ(stLats[si + 1]);
        var blockBotZ = latToZ(stLats[si]);
        var blockCenterZ = (blockTopZ + blockBotZ) / 2;
        var blockD = Math.abs(blockTopZ - blockBotZ) - 20;
        var count = 3 + Math.floor(Math.random() * 5);

        for (var b = 0; b < count; b++) {
          var bx = blockCenterX + (Math.random() - 0.5) * blockW;
          var bz = blockCenterZ + (Math.random() - 0.5) * blockD;
          var h = 15 + Math.random() * 50;
          var w = 10 + Math.random() * 20;
          var d = 10 + Math.random() * 20;
          var c = colors[Math.floor(Math.random() * colors.length)];

          var building = document.createElement('a-box');
          building.setAttribute('position', bx + ' ' + (h / 2) + ' ' + bz);
          building.setAttribute('width', '' + w);
          building.setAttribute('height', '' + h);
          building.setAttribute('depth', '' + d);
          building.setAttribute('color', c);
          building.setAttribute('material', 'roughness: 0.8; metalness: 0.1');
          parent.appendChild(building);

          if (h > 20) {
            for (var wy = 5; wy < h - 3; wy += 4) {
              var win = document.createElement('a-box');
              win.setAttribute('position', bx + ' ' + wy + ' ' + (bz - d / 2 - 0.05));
              win.setAttribute('width', '' + (w * 0.8));
              win.setAttribute('height', '1.5');
              win.setAttribute('depth', '0.1');
              var emissive = Math.random() > 0.3 ? 0.3 : 0;
              win.setAttribute('material', 'color: #ffd; emissive: #ffa; emissiveIntensity: ' + emissive + '; roughness: 0.2; metalness: 0.8');
              parent.appendChild(win);
            }
          }
        }
      }
    }
  },

  _signalReady: function () {
    window.dispatchEvent(new CustomEvent('tilesReady'));
    if (window.gameEngine) {
      window.gameEngine.setReady();
    }
  },

  tick: function (t, dt) {
    if (this.tilesRuntime) {
      try {
        this.tilesRuntime.update(dt || 0, this.el.sceneEl.camera);
      } catch (err) {
        console.error('Tiles runtime error, disabling:', err.message);
        this.tilesRuntime = null;
        if (this.fallbackEl) {
          this.fallbackEl.setAttribute('visible', 'true');
        }
      }
    }
  },

  remove: function () {
    if (this.tilesRuntime) {
      try { this.tilesRuntime.dispose(); } catch (e) { /* ignore */ }
    }
    if (this.tilesModel && this.tilesModel.parent) {
      this.tilesModel.parent.remove(this.tilesModel);
    }
  },
});
