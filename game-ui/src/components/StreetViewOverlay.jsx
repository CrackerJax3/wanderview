import React, { useEffect, useRef, useCallback, useState } from 'react';

const SV_STATIC = 'https://maps.googleapis.com/maps/api/streetview';
const SLICES = 12;
const SLICE_FOV = 30;
const IMG_SIZE = 640;

function buildPanorama(lat, lng, apiKey) {
  return new Promise((resolve) => {
    const panoW = SLICES * IMG_SIZE;
    const panoH = panoW / 2;
    const canvas = document.createElement('canvas');
    canvas.width = panoW;
    canvas.height = panoH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, panoW, panoH);

    let loaded = 0;
    const bandY = Math.round((panoH - IMG_SIZE) / 2);

    for (let i = 0; i < SLICES; i++) {
      const heading = i * SLICE_FOV;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `${SV_STATIC}?size=${IMG_SIZE}x${IMG_SIZE}&location=${lat},${lng}&heading=${heading}&pitch=0&fov=${SLICE_FOV}&key=${apiKey}`;
      const idx = i;
      img.onload = () => {
        ctx.drawImage(img, idx * IMG_SIZE, bandY, IMG_SIZE, IMG_SIZE);
        loaded++;
        if (loaded >= SLICES) resolve(canvas);
      };
      img.onerror = () => {
        console.warn(`[StreetView] Failed to load slice ${idx}`);
        loaded++;
        if (loaded >= SLICES) resolve(canvas);
      };
    }
  });
}

export default function StreetViewOverlay({ position, active }) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    mesh: null,
    raf: null,
    dragging: false,
    prevX: 0,
    prevY: 0,
    lon: 0,
    lat: 0,
    initialized: false,
  });
  const locKeyRef = useRef('');
  const [ready, setReady] = useState(false);

  const getApiKey = useCallback(() => {
    return window.WANDERVIEW_GOOGLE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
  }, []);

  function initThreeScene() {
    const s = stateRef.current;
    if (s.initialized) return;
    const THREE = window.THREE;
    if (!THREE) { console.error('[StreetView] THREE not found'); return; }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    s.renderer = renderer;

    const scene = new THREE.Scene();
    s.scene = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1100);
    s.camera = camera;

    const geo = new THREE.SphereGeometry(500, 60, 40);
    geo.scale(-1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    s.mesh = mesh;
    s.initialized = true;
  }

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

    function animate() {
      s.raf = requestAnimationFrame(animate);
      const clampedLat = Math.max(-85, Math.min(85, s.lat));
      const phi = window.THREE.MathUtils.degToRad(90 - clampedLat);
      const theta = window.THREE.MathUtils.degToRad(s.lon);
      s.camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta)
      );
      s.renderer.render(s.scene, s.camera);
    }
    animate();
  }

  function stopRenderLoop() {
    const s = stateRef.current;
    if (s.raf) { cancelAnimationFrame(s.raf); s.raf = null; }
  }

  useEffect(() => {
    window._streetViewActive = !!active;

    if (!active || !position) {
      setReady(false);
      stopRenderLoop();
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) { console.warn('[StreetView] No API key'); return; }

    initThreeScene();

    const lat = position.lat?.toFixed(4);
    const lng = position.lng?.toFixed(4);
    const locKey = `${lat},${lng}`;

    if (document.pointerLockElement) document.exitPointerLock();

    const heading = position.heading || 0;
    stateRef.current.lon = heading;
    stateRef.current.lat = 0;

    if (locKey === locKeyRef.current) {
      startRenderLoop();
      setReady(true);
      return;
    }
    locKeyRef.current = locKey;

    let cancelled = false;

    (async () => {
      try {
        console.log('[StreetView] Loading panorama for', lat, lng);
        const panoCanvas = await buildPanorama(lat, lng, apiKey);
        if (cancelled) return;

        console.log('[StreetView] Panorama stitched, creating texture');
        const THREE = window.THREE;
        const texture = new THREE.CanvasTexture(panoCanvas);
        if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;

        const s = stateRef.current;
        if (s.mesh) {
          s.mesh.material.dispose();
          s.mesh.material = new THREE.MeshBasicMaterial({ map: texture });
        }

        startRenderLoop();
        setReady(true);
        console.log('[StreetView] Rendering started');
      } catch (err) {
        console.error('[StreetView] Error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [position?.lat, position?.lng, active, getApiKey]);

  // Mouse drag for looking around
  useEffect(() => {
    if (!active) return;
    const s = stateRef.current;

    const onDown = (e) => {
      if (e.target.closest('.streetview-badge')) return;
      s.dragging = true;
      s.prevX = e.clientX;
      s.prevY = e.clientY;
    };
    const onMove = (e) => {
      if (!s.dragging) return;
      s.lon += (s.prevX - e.clientX) * 0.15;
      s.lat += (e.clientY - s.prevY) * 0.15;
      s.prevX = e.clientX;
      s.prevY = e.clientY;
    };
    const onUp = () => { s.dragging = false; };
    const onResize = () => {
      if (!s.renderer || !s.camera) return;
      s.renderer.setSize(window.innerWidth, window.innerHeight);
      s.camera.aspect = window.innerWidth / window.innerHeight;
      s.camera.updateProjectionMatrix();
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('mousedown', onDown);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    window.addEventListener('resize', onResize);

    return () => {
      if (el) el.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.removeEventListener('resize', onResize);
    };
  }, [active]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      stopRenderLoop();
      if (s.renderer) { s.renderer.dispose(); s.renderer = null; }
      if (s.mesh) {
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
      }
      s.initialized = false;
    };
  }, []);

  if (!active) return null;

  return (
    <div ref={containerRef} className={`streetview-overlay ${ready ? 'visible' : ''}`}>
      <div className="streetview-badge">Street View</div>
    </div>
  );
}
