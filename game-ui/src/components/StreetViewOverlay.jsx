import React, { useEffect, useRef, useCallback, useState } from 'react';

const SV_STATIC = 'https://maps.googleapis.com/maps/api/streetview';
const H_SLICES = 6;
const H_FOV = 60;
const IMG_SIZE = 640;
const PITCHES = [45, 0, -45];
const PANO_W = H_SLICES * IMG_SIZE;
const PANO_H = PANO_W / 2;
const STEP_METERS = 12;
const MOVE_COOLDOWN_MS = 400;
const DRIFT_SPEED = 40;
const DRIFT_MAX = 35;

function buildPanorama(lat, lng, apiKey) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = PANO_W;
    canvas.height = PANO_H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, PANO_W, PANO_H);

    const total = H_SLICES * PITCHES.length;
    let loaded = 0;

    PITCHES.forEach((pitch) => {
      const yCenter = (PANO_H / 2) * (1 - pitch / 90);
      const bandY = Math.round(yCenter - IMG_SIZE / 2);

      for (let i = 0; i < H_SLICES; i++) {
        const heading = i * H_FOV;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = `${SV_STATIC}?size=${IMG_SIZE}x${IMG_SIZE}&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${H_FOV}&key=${apiKey}`;
        const x = i * IMG_SIZE;
        const y = bandY;
        img.onload = () => {
          ctx.drawImage(img, x, y, IMG_SIZE, IMG_SIZE);
          if (++loaded >= total) resolve(canvas);
        };
        img.onerror = () => {
          if (++loaded >= total) resolve(canvas);
        };
      }
    });
  });
}

function moveLatLng(lat, lng, headingDeg, meters) {
  const rad = (headingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111320;
  const dLng = (meters * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

export default function StreetViewOverlay({ position, active }) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    mesh: null,
    raf: null,
    lon: 0,
    lat: 0,
    currentLat: 0,
    currentLng: 0,
    keys: { w: false, a: false, s: false, d: false },
    loading: false,
    lastMoveTime: 0,
    driftX: 0,
    driftZ: 0,
    initialized: false,
  });
  const locKeyRef = useRef('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const getApiKey = useCallback(() => {
    return window.WANDERVIEW_GOOGLE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
  }, []);

  function initThreeScene() {
    const s = stateRef.current;
    if (s.initialized) return;
    const THREE = window.THREE;
    if (!THREE) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    s.renderer = renderer;

    s.scene = new THREE.Scene();
    s.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1100);

    const geo = new THREE.SphereGeometry(500, 60, 40);
    geo.scale(-1, 1, 1);
    s.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
    s.scene.add(s.mesh);
    s.initialized = true;
  }

  const loadPanoAt = useCallback(async (lat, lng) => {
    const apiKey = getApiKey();
    if (!apiKey) return;

    const s = stateRef.current;
    s.loading = true;
    setLoading(true);

    try {
      const panoCanvas = await buildPanorama(lat.toFixed(5), lng.toFixed(5), apiKey);
      const THREE = window.THREE;
      const texture = new THREE.CanvasTexture(panoCanvas);
      if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;

      if (s.mesh) {
        s.mesh.material.dispose();
        s.mesh.material = new THREE.MeshBasicMaterial({ map: texture });
      }

      s.currentLat = lat;
      s.currentLng = lng;
      s.driftX = 0;
      s.driftZ = 0;
      s.camera.position.set(0, 0, 0);
      locKeyRef.current = `${lat.toFixed(4)},${lng.toFixed(4)}`;

      if (window.gameEngine) {
        const scene = window.gameEngine.latLngToScene(lat, lng);
        const rig = document.getElementById('player-rig');
        if (rig) {
          const curY = rig.object3D.position.y;
          rig.object3D.position.set(scene.x, curY, scene.z);
        }
        window.gameEngine.updatePosition(lat, lng, s.lon);
      }
    } catch (err) {
      console.error('[StreetView] Move error:', err);
    }
    s.loading = false;
    setLoading(false);
  }, [getApiKey]);

  function startRenderLoop() {
    const s = stateRef.current;
    if (!s.renderer || !s.scene || !s.camera) return;
    const container = containerRef.current;
    if (container && !container.contains(s.renderer.domElement)) {
      container.insertBefore(s.renderer.domElement, container.firstChild);
    }
    s.renderer.setSize(window.innerWidth, window.innerHeight);
    s.camera.aspect = window.innerWidth / window.innerHeight;
    s.camera.updateProjectionMatrix();

    if (s.raf) cancelAnimationFrame(s.raf);
    const THREE = window.THREE;
    let prevTime = performance.now();

    function animate(now) {
      s.raf = requestAnimationFrame(animate);
      const dt = Math.min((now - prevTime) / 1000, 0.1);
      prevTime = now;

      // WASD movement: drift camera inside sphere for visual feedback
      const moving = s.keys.w || s.keys.s || s.keys.a || s.keys.d;
      if (moving && !s.loading) {
        let moveAngle = s.lon;
        if (s.keys.a && !s.keys.d) moveAngle -= 90;
        else if (s.keys.d && !s.keys.a) moveAngle += 90;
        if (s.keys.s && !s.keys.w) moveAngle += 180;

        const rad = THREE.MathUtils.degToRad(moveAngle);
        s.driftX += Math.sin(rad) * DRIFT_SPEED * dt;
        s.driftZ += Math.cos(rad) * DRIFT_SPEED * dt;

        const dist = Math.sqrt(s.driftX * s.driftX + s.driftZ * s.driftZ);
        if (dist > DRIFT_MAX) {
          s.driftX *= DRIFT_MAX / dist;
          s.driftZ *= DRIFT_MAX / dist;
        }
        s.camera.position.set(s.driftX, 0, s.driftZ);

        if (now - s.lastMoveTime > MOVE_COOLDOWN_MS) {
          s.lastMoveTime = now;
          const next = moveLatLng(s.currentLat, s.currentLng, moveAngle, STEP_METERS);
          loadPanoAt(next.lat, next.lng);
        }
      } else if (!moving) {
        s.driftX *= 0.9;
        s.driftZ *= 0.9;
        if (Math.abs(s.driftX) < 0.1 && Math.abs(s.driftZ) < 0.1) {
          s.driftX = 0;
          s.driftZ = 0;
        }
        s.camera.position.set(s.driftX, 0, s.driftZ);
      }

      const clampedLat = Math.max(-85, Math.min(85, s.lat));
      const phi = THREE.MathUtils.degToRad(90 - clampedLat);
      const theta = THREE.MathUtils.degToRad(s.lon);
      const lookX = s.driftX + 500 * Math.sin(phi) * Math.cos(theta);
      const lookY = 500 * Math.cos(phi);
      const lookZ = s.driftZ + 500 * Math.sin(phi) * Math.sin(theta);
      s.camera.lookAt(lookX, lookY, lookZ);
      s.renderer.render(s.scene, s.camera);
    }
    animate(performance.now());
  }

  function stopRenderLoop() {
    const s = stateRef.current;
    if (s.raf) { cancelAnimationFrame(s.raf); s.raf = null; }
  }

  // Load initial panorama
  useEffect(() => {
    window._streetViewActive = !!active;
    if (!active || !position) {
      setReady(false);
      stopRenderLoop();
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) return;

    initThreeScene();

    const lat = position.lat;
    const lng = position.lng;
    const locKey = `${lat?.toFixed(4)},${lng?.toFixed(4)}`;

    if (document.pointerLockElement) document.exitPointerLock();

    const s = stateRef.current;
    s.lon = position.heading || 0;
    s.lat = 0;
    s.currentLat = lat;
    s.currentLng = lng;
    s.keys = { w: false, a: false, s: false, d: false };

    if (locKey === locKeyRef.current) {
      startRenderLoop();
      setReady(true);
      return;
    }
    locKeyRef.current = locKey;

    let cancelled = false;
    (async () => {
      try {
        const panoCanvas = await buildPanorama(lat.toFixed(5), lng.toFixed(5), apiKey);
        if (cancelled) return;

        const THREE = window.THREE;
        const texture = new THREE.CanvasTexture(panoCanvas);
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;

        if (s.mesh) {
          s.mesh.material.dispose();
          s.mesh.material = new THREE.MeshBasicMaterial({ map: texture });
        }
        startRenderLoop();
        setReady(true);
      } catch (err) {
        console.error('[StreetView]', err);
      }
    })();

    return () => { cancelled = true; };
  }, [position?.lat, position?.lng, active, getApiKey]);

  // Pointer lock + keyboard controls
  useEffect(() => {
    if (!active) return;
    const s = stateRef.current;

    const onClick = () => {
      const canvas = s.renderer?.domElement;
      if (canvas && !document.pointerLockElement) {
        canvas.requestPointerLock();
      }
    };

    const onMouseMove = (e) => {
      if (!s.renderer) return;
      if (document.pointerLockElement !== s.renderer.domElement) return;
      s.lon += e.movementX * 0.1;
      s.lat -= e.movementY * 0.1;
    };

    const onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const map = { w: 'w', arrowup: 'w', s: 's', arrowdown: 's', a: 'a', arrowleft: 'a', d: 'd', arrowright: 'd' };
      const k = map[e.key.toLowerCase()];
      if (k) { e.preventDefault(); s.keys[k] = true; }
    };

    const onKeyUp = (e) => {
      const map = { w: 'w', arrowup: 'w', s: 's', arrowdown: 's', a: 'a', arrowleft: 'a', d: 'd', arrowright: 'd' };
      const k = map[e.key.toLowerCase()];
      if (k) s.keys[k] = false;
    };

    const onResize = () => {
      if (!s.renderer || !s.camera) return;
      s.renderer.setSize(window.innerWidth, window.innerHeight);
      s.camera.aspect = window.innerWidth / window.innerHeight;
      s.camera.updateProjectionMatrix();
    };

    const el = containerRef.current;
    if (el) el.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);

    return () => {
      if (el) el.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [active]);

  useEffect(() => {
    return () => {
      const s = stateRef.current;
      stopRenderLoop();
      if (s.renderer) { s.renderer.dispose(); s.renderer = null; }
      if (s.mesh) { s.mesh.geometry.dispose(); s.mesh.material.dispose(); }
      s.initialized = false;
    };
  }, []);

  if (!active) return null;

  return (
    <div ref={containerRef} className={`streetview-overlay ${ready ? 'visible' : ''}`}>
      <div className="streetview-badge">
        Street View {loading ? '— loading...' : '— click to look, WASD to move'}
      </div>
    </div>
  );
}
