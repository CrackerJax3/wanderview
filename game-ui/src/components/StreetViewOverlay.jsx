import React, { useState, useEffect, useRef } from 'react';

const SV_BASE = 'https://maps.googleapis.com/maps/api/streetview';
const UPDATE_INTERVAL = 300;

export default function StreetViewOverlay({ position, active }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const lastUpdate = useRef(0);
  const lastParams = useRef('');

  useEffect(() => {
    if (!active || !position) {
      setLoaded(false);
      return;
    }

    const apiKey = window.WANDERVIEW_GOOGLE_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) return;

    const now = Date.now();
    if (now - lastUpdate.current < UPDATE_INTERVAL) return;

    const heading = Math.round(position.heading || 0);
    const lat = position.lat?.toFixed(5);
    const lng = position.lng?.toFixed(5);
    const paramKey = `${lat},${lng},${heading}`;

    if (paramKey === lastParams.current) return;
    lastParams.current = paramKey;
    lastUpdate.current = now;

    const url = `${SV_BASE}?size=640x640&location=${lat},${lng}&heading=${heading}&pitch=0&fov=90&key=${apiKey}`;
    setImgUrl(url);
  }, [position, active]);

  if (!active || !imgUrl) return null;

  return (
    <div className={`streetview-overlay ${loaded ? 'visible' : ''}`}>
      <img
        src={imgUrl}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
        draggable={false}
      />
      <div className="streetview-badge">Street View</div>
    </div>
  );
}
