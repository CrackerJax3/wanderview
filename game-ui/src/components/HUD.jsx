import React, { useState, useEffect, useRef, useCallback } from 'react';

const BADGE_COLORS = ['red', 'green', 'blue', 'orange', 'purple'];
const TILE_SIZE = 256;
const MINIMAP_ZOOM = 17;
const tileCache = {};

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}

function latLngToTile(lat, lng, zoom) {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function loadTile(tx, ty, zoom) {
  const key = `${zoom}/${tx}/${ty}`;
  if (tileCache[key]) return tileCache[key];

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;

  const promise = new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });

  tileCache[key] = { img, ready: false, promise };
  promise.then((loaded) => {
    if (loaded) tileCache[key].ready = true;
  });

  return tileCache[key];
}

function drawPlayerArrow(ctx, cx, cy, headingDeg) {
  const rad = (headingDeg * Math.PI) / 180;
  const r = 32;

  ctx.save();
  ctx.translate(cx, cy);

  // Directional arrow rotated around center
  ctx.rotate(rad);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(-r * 0.5, r * 0.35);
  ctx.lineTo(0, r * 0.05);
  ctx.lineTo(r * 0.5, r * 0.35);
  ctx.closePath();

  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Center dot
  ctx.rotate(-rad);
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  ctx.restore();
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = String(timeStr).match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2] || '0', 10);
  const period = (match[3] || '').toLowerCase();
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return hours * 60 + mins;
}

export default function HUD({ position, gameMode, score, onAnalyze, schedule = [] }) {
  const [street, setStreet] = useState({ street: '46th St', avenue: '9th Ave' });
  const [landmarks, setLandmarks] = useState([]);
  const [showMinimap, setShowMinimap] = useState(true);
  const [tilesLoaded, setTilesLoaded] = useState(0);
  const [viewHeight, setViewHeight] = useState(-15);
  const canvasRef = useRef(null);
  const heading = position?.heading || 0;

  const scheduleRoute = React.useMemo(() => {
    const list = schedule.filter((i) => i.status === 'confirmed' && i.lat != null && i.lng != null);
    return [...list].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }, [schedule]);

  const HEIGHT_MIN = -30;
  const HEIGHT_MAX = 80;
  const HEIGHT_MARKS = [
    { label: 'Street', height: -25 },
    { label: 'Elevated', height: 10 },
    { label: 'Sky View', height: 60 },
  ];

  const heightToSlider = useCallback((h) => {
    return ((h - HEIGHT_MIN) / (HEIGHT_MAX - HEIGHT_MIN)) * 100;
  }, []);

  const sliderToHeight = useCallback((v) => {
    return (v / 100) * (HEIGHT_MAX - HEIGHT_MIN) + HEIGHT_MIN;
  }, []);

  const handleHeightSlider = useCallback((e) => {
    const val = parseFloat(e.target.value);
    const h = sliderToHeight(val);
    setViewHeight(h);
    window.dispatchEvent(new CustomEvent('setViewHeight', { detail: { height: h } }));
  }, [sliderToHeight]);

  // Sync slider when scroll wheel changes height
  useEffect(() => {
    const handler = (e) => setViewHeight(e.detail.height);
    window.addEventListener('scrollViewHeight', handler);
    return () => window.removeEventListener('scrollViewHeight', handler);
  }, []);

  const handleHeightMark = useCallback((h) => {
    setViewHeight(h);
    window.dispatchEvent(new CustomEvent('setViewHeight', { detail: { height: h } }));
  }, []);

  useEffect(() => {
    if (!position || !window.gameNavigation) return;

    setStreet(window.gameNavigation.getCurrentStreet(position.lat, position.lng));
    setLandmarks(window.gameNavigation.getNearbyLandmarks(position.lat, position.lng, 300));
  }, [position]);

  // Minimap toggle
  useEffect(() => {
    const handler = () => setShowMinimap((prev) => !prev);
    window.addEventListener('toggleMinimap', handler);
    return () => window.removeEventListener('toggleMinimap', handler);
  }, []);

  // Draw minimap (accepts optional pos for real-time updates; uses position prop if not provided)
  const drawMinimap = useCallback((posOverride) => {
    const canvas = canvasRef.current;
    const pos = posOverride || position;
    if (!canvas || !pos) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const scale = w / (3 * TILE_SIZE);
    const logicalSize = 3 * TILE_SIZE;
    const centerX = logicalSize / 2;
    const centerY = logicalSize / 2;
    const heading = pos.heading != null ? pos.heading : (position?.heading ?? 0);

    ctx.save();
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, logicalSize, logicalSize);
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(0, 0, logicalSize, logicalSize);

    // Calculate tile position for player
    const tilePos = latLngToTile(pos.lat, pos.lng, MINIMAP_ZOOM);
    const tileX = Math.floor(tilePos.x);
    const tileY = Math.floor(tilePos.y);
    const fracX = tilePos.x - tileX;
    const fracY = tilePos.y - tileY;

    // Draw a 3x3 grid of tiles centered on the player
    let pendingTiles = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tx = tileX + dx;
        const ty = tileY + dy;
        const tile = loadTile(tx, ty, MINIMAP_ZOOM);

        const drawX = centerX + (dx - fracX) * TILE_SIZE;
        const drawY = centerY + (dy - fracY) * TILE_SIZE;

        if (tile.ready) {
          ctx.drawImage(tile.img, drawX, drawY, TILE_SIZE, TILE_SIZE);
        } else {
          pendingTiles++;
          tile.promise.then(() => setTilesLoaded((n) => n + 1));
        }
      }
    }

    // Draw landmark dots on top of tiles
    if (window.gameNavigation) {
      const nav = window.gameNavigation;
      const colors = ['#FF3B30', '#34C759', '#007AFF', '#FF9500', '#AF52DE'];
      nav.LANDMARKS.forEach((lm, i) => {
        const lmTile = latLngToTile(lm.lat, lm.lng, MINIMAP_ZOOM);
        const lx = centerX + (lmTile.x - tilePos.x) * TILE_SIZE;
        const ly = centerY + (lmTile.y - tilePos.y) * TILE_SIZE;

        if (lx > 5 && lx < logicalSize - 5 && ly > 5 && ly < logicalSize - 5) {
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.arc(lx, ly, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });
    }

    // Draw schedule route (confirmed destinations with lat/lng, in time order)
    const route = scheduleRoute || [];
    if (route.length >= 2) {
      const points = route.map((p) => {
        const rt = latLngToTile(p.lat, p.lng, MINIMAP_ZOOM);
        return {
          x: centerX + (rt.x - tilePos.x) * TILE_SIZE,
          y: centerY + (rt.y - tilePos.y) * TILE_SIZE,
        };
      });
      ctx.strokeStyle = '#007AFF';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      points.forEach((pt, i) => {
        if (pt.x > 5 && pt.x < logicalSize - 5 && pt.y > 5 && pt.y < logicalSize - 5) {
          ctx.fillStyle = '#007AFF';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    } else if (route.length === 1) {
      const rt = latLngToTile(route[0].lat, route[0].lng, MINIMAP_ZOOM);
      const lx = centerX + (rt.x - tilePos.x) * TILE_SIZE;
      const ly = centerY + (rt.y - tilePos.y) * TILE_SIZE;
      if (lx > 5 && lx < logicalSize - 5 && ly > 5 && ly < logicalSize - 5) {
        ctx.fillStyle = '#007AFF';
        ctx.beginPath();
        ctx.arc(lx, ly, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw player arrow with heading (offset northwest to align with tile position)
    drawPlayerArrow(ctx, centerX - 6, centerY - 6, heading);

    ctx.restore();
  }, [position, tilesLoaded, scheduleRoute]);

  useEffect(() => {
    drawMinimap();
  }, [drawMinimap]);

  // Real-time minimap: redraw every frame with latest heading from game engine so arrow turns smoothly
  useEffect(() => {
    let rafId;
    function tick() {
      rafId = requestAnimationFrame(tick);
      const pos = window.gameEngine?.getPosition();
      if (!pos || !canvasRef.current || !showMinimap) return;
      drawMinimap(pos);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drawMinimap, showMinimap]);

  const compassDirection = window.gameNavigation?.getCompassDirection(heading) || 'N';

  const modeLabels = {
    explorer: 'Explorer Mode',
    scavenger: 'Scavenger Hunt',
    history: 'History Tour',
    mystery: 'Mystery Mode',
  };

  return (
    <>
      {/* Score — top left */}
      <div className="hud">
        <div className="hud-score">
          <div className="score-label">Score</div>
          <div className="score-value">{score}</div>
        </div>
        <div className="hud-mode">{modeLabels[gameMode] || 'Explorer Mode'}</div>
      </div>

      {/* Compass — top right (reference-style with red/navy needle) */}
      <div className="compass-wrapper">
        <button className="analyzer-btn interactive" onClick={onAnalyze}>
          Analyzer
        </button>
        <div className="compass-ring">
          <span className="compass-n">N</span>
          <span className="compass-e">E</span>
          <span className="compass-s">S</span>
          <span className="compass-w">W</span>
          <div
            className="compass-needle-container"
            style={{ transform: `rotate(${-heading}deg)` }}
          >
            <div className="compass-needle-n" />
            <div className="compass-needle-s" />
            <div className="compass-needle-dot" />
          </div>
        </div>
        <div className="compass-heading">{compassDirection} {Math.round(heading)}°</div>
      </div>

      {/* Height Slider — left side */}
      <div className="height-slider-wrapper interactive">
        <div className="height-slider-track">
          <input
            type="range"
            className="height-slider"
            min="0"
            max="100"
            step="0.5"
            value={heightToSlider(viewHeight)}
            onChange={handleHeightSlider}
            orient="vertical"
          />
          <div className="height-marks">
            {HEIGHT_MARKS.map((mark) => (
              <button
                key={mark.label}
                className="height-mark interactive"
                style={{ bottom: `${heightToSlider(mark.height)}%` }}
                onClick={() => handleHeightMark(mark.height)}
                title={mark.label}
              >
                {mark.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Location Info — bottom left (with colored distance badges) */}
      <div className="location-info">
        <div className="location-card">
          <div className="location-street">
            {street.street} & {street.avenue}
          </div>
          <div className="location-coords">
            {position?.lat?.toFixed(4)}, {position?.lng?.toFixed(4)}
          </div>
          {landmarks.length > 0 && (
            <div className="location-landmarks">
              {landmarks.slice(0, 3).map((lm, i) => (
                <div key={lm.name} className="landmark-row">
                  <span className="landmark-name">{lm.icon} {lm.name}</span>
                  <span className={`landmark-badge ${BADGE_COLORS[i % BADGE_COLORS.length]}`}>
                    {formatDistance(lm.distance)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Minimap — bottom right */}
      <div className={`minimap interactive ${!showMinimap ? 'hidden' : ''}`}>
        <canvas ref={canvasRef} width={512} height={512} />
      </div>

      {/* Crosshair */}
      <div className="crosshair" />
    </>
  );
}
