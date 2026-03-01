import React, { useEffect, useRef, useCallback, useState } from 'react';

const SV_STATIC = 'https://maps.googleapis.com/maps/api/streetview';
const H_SLICES = 6;
const H_FOV = 60;
const IMG_SIZE = 640;
const PITCHES = [45, 0, -45];
const PANO_W = H_SLICES * IMG_SIZE;
const PANO_H = PANO_W / 2;

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

    function animate() {
      s.raf = requestAnimationFrame(animate);
      const clampedLat = Math.max(-85, Math.min(85, s.lat));
      const phi = THREE.MathUtils.degToRad(90 - clampedLat);
      const theta = THREE.MathUtils.degToRad(s.lon);
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
    if (!apiKey) return;

    initThreeScene();

    const lat = position.lat?.toFixed(4);
    const lng = position.lng?.toFixed(4);
    const locKey = `${lat},${lng}`;

    if (document.pointerLockElement) document.exitPointerLock();

    stateRef.current.lon = position.heading || 0;
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
        const panoCanvas = await buildPanorama(lat, lng, apiKey);
        if (cancelled) return;

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
      } catch (err) {
        console.error('[StreetView]', err);
      }
    })();

    return () => { cancelled = true; };
  }, [position?.lat, position?.lng, active, getApiKey]);

  // Pointer lock controls — click to lock, mouse movement controls view
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

    const onResize = () => {
      if (!s.renderer || !s.camera) return;
      s.renderer.setSize(window.innerWidth, window.innerHeight);
      s.camera.aspect = window.innerWidth / window.innerHeight;
      s.camera.updateProjectionMatrix();
    };

    const el = containerRef.current;
    if (el) el.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    return () => {
      if (el) el.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
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
      <div className="streetview-badge">Street View — click to look around</div>
    </div>
  );
}
