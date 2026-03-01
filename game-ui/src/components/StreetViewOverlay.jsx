import React, { useState, useEffect, useRef, useCallback } from 'react';

const SV_BASE = 'https://maps.googleapis.com/maps/api/streetview';
const HEADING_STEP = 30;
const HEADING_COUNT = 360 / HEADING_STEP;
const FOV = 90;

function buildUrl(lat, lng, heading, apiKey) {
  return `${SV_BASE}?size=640x640&location=${lat},${lng}&heading=${heading}&pitch=0&fov=${FOV}&key=${apiKey}`;
}

function snapHeading(h) {
  return Math.round(h / HEADING_STEP) * HEADING_STEP % 360;
}

export default function StreetViewOverlay({ position, active }) {
  const [ready, setReady] = useState(false);
  const cacheRef = useRef({});
  const locationKeyRef = useRef('');
  const canvasRef = useRef(null);

  const getApiKey = useCallback(() => {
    return window.WANDERVIEW_GOOGLE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || '';
  }, []);

  // Preload all headings for current position
  useEffect(() => {
    if (!active || !position) {
      setReady(false);
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) return;

    const lat = position.lat?.toFixed(5);
    const lng = position.lng?.toFixed(5);
    const locKey = `${lat},${lng}`;

    if (locKey === locationKeyRef.current) {
      const hasLoadedImages = Object.values(cacheRef.current).some(img => img !== null);
      if (hasLoadedImages) setReady(true);
      return;
    }
    locationKeyRef.current = locKey;

    const cache = {};
    let loadedCount = 0;

    for (let i = 0; i < HEADING_COUNT; i++) {
      const h = i * HEADING_STEP;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = buildUrl(lat, lng, h, apiKey);
      img.onload = () => {
        cache[h] = img;
        loadedCount++;
        if (loadedCount >= 4) setReady(true);
      };
      img.onerror = () => {
        loadedCount++;
      };
      cache[h] = null;
    }

    cacheRef.current = cache;
  }, [position?.lat, position?.lng, active, getApiKey]);

  // Draw the correct heading image to canvas
  useEffect(() => {
    if (!active || !ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const heading = snapHeading(position?.heading || 0);
    const img = cacheRef.current[heading];
    if (!img) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, [position?.heading, active, ready]);

  if (!active) return null;

  return (
    <div className={`streetview-overlay ${ready ? 'visible' : ''}`}>
      <canvas ref={canvasRef} />
      <div className="streetview-badge">Street View</div>
    </div>
  );
}
