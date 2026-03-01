import React, { useEffect, useRef, useCallback, useState } from 'react';
import create360Viewer from '360-image-viewer';
import canvasFit from 'canvas-fit';

const PANO_ZOOM = 3;
const PANO_COLS = 8;
const PANO_ROWS = 4;
const TILE_PX = 512;

function getPanoTileUrl(panoId, x, y, zoom) {
  return `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${encodeURIComponent(panoId)}&x=${x}&y=${y}&zoom=${zoom}&nbt=1&fover=2`;
}

function headingToPhi(deg) {
  return ((-deg * Math.PI) / 180) + Math.PI;
}

function stitchPanorama(panoId) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = PANO_COLS * TILE_PX;
    canvas.height = PANO_ROWS * TILE_PX;
    const ctx = canvas.getContext('2d');

    let done = 0;
    const total = PANO_COLS * PANO_ROWS;

    for (let y = 0; y < PANO_ROWS; y++) {
      for (let x = 0; x < PANO_COLS; x++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = getPanoTileUrl(panoId, x, y, PANO_ZOOM);
        const cx = x, cy = y;
        img.onload = () => {
          ctx.drawImage(img, cx * TILE_PX, cy * TILE_PX);
          if (++done >= total) resolve(canvas);
        };
        img.onerror = () => {
          if (++done >= total) resolve(canvas);
        };
      }
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
    window._streetViewActive = active;
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
      setReady(true);
      return;
    }
    locKeyRef.current = locKey;

    if (document.pointerLockElement) document.exitPointerLock();

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${apiKey}`
        );
        const meta = await res.json();
        if (cancelled || meta.status !== 'OK' || !meta.pano_id) return;

        const panoCanvas = await stitchPanorama(meta.pano_id);
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
          fov: Math.PI / 2.5,
          rotateSpeed: -0.3,
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
