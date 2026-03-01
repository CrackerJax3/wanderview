import React, { useEffect, useRef, useCallback, useState } from 'react';
import create360Viewer from '360-image-viewer';
import canvasFit from 'canvas-fit';

const SV_STATIC = 'https://maps.googleapis.com/maps/api/streetview';
const SLICES = 12;
const SLICE_FOV = 30;
const IMG_SIZE = 640;

function headingToPhi(deg) {
  return ((deg) * Math.PI) / 180;
}

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
        if (++loaded >= SLICES) resolve(canvas);
      };
      img.onerror = () => {
        if (++loaded >= SLICES) resolve(canvas);
      };
    }
  });
}

export default function StreetViewOverlay({ position, active }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const fitFnRef = useRef(null);
  const locKeyRef = useRef('');
  const [ready, setReady] = useState(false);

  const getApiKey = useCallback(() => {
    return window.WANDERVIEW_GOOGLE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
  }, []);

  useEffect(() => {
    window._streetViewActive = !!active;

    if (!active || !position) {
      setReady(false);
      if (viewerRef.current) viewerRef.current.stop();
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) return;

    const lat = position.lat?.toFixed(4);
    const lng = position.lng?.toFixed(4);
    const locKey = `${lat},${lng}`;

    if (locKey === locKeyRef.current && viewerRef.current) {
      viewerRef.current.phi = headingToPhi(position.heading || 0);
      viewerRef.current.start();
      if (fitFnRef.current) fitFnRef.current();
      setReady(true);
      return;
    }
    locKeyRef.current = locKey;

    if (document.pointerLockElement) document.exitPointerLock();

    let cancelled = false;

    (async () => {
      try {
        const panoCanvas = await buildPanorama(lat, lng, apiKey);
        if (cancelled) return;

        if (viewerRef.current) {
          viewerRef.current.texture(panoCanvas);
          viewerRef.current.phi = headingToPhi(position.heading || 0);
          viewerRef.current.start();
          setReady(true);
          return;
        }

        const viewer = create360Viewer({
          image: panoCanvas,
          fov: Math.PI / 2,
          rotateSpeed: -0.15,
          damping: 0.275,
        });

        viewer.phi = headingToPhi(position.heading || 0);

        const container = containerRef.current;
        if (container && !cancelled) {
          container.appendChild(viewer.canvas);
          const fit = canvasFit(viewer.canvas, window, window.devicePixelRatio);
          fitFnRef.current = fit;
          window.addEventListener('resize', fit);
          fit();
        }

        viewer.start();
        viewerRef.current = viewer;
        setReady(true);
      } catch (err) {
        console.error('[StreetView] Error:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [position?.lat, position?.lng, active, getApiKey]);

  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
      if (fitFnRef.current) {
        window.removeEventListener('resize', fitFnRef.current);
      }
    };
  }, []);

  if (!active) return null;

  return (
    <div ref={containerRef} className={`streetview-overlay ${ready ? 'visible' : ''}`}>
      <div className="streetview-badge">Street View</div>
    </div>
  );
}
