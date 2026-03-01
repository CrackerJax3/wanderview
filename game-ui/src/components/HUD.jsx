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
  const size = 10;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);

  // Arrow body
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(-size * 0.6, size * 0.6);
  ctx.lineTo(0, size * 0.2);
  ctx.lineTo(size * 0.6, size * 0.6);
  ctx.closePath();

  ctx.fillStyle = '#4CD964';
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

export default function HUD({ position, gameMode, score, onAnalyze }) {
  const [street, setStreet] = useState({ street: '46th St', avenue: '9th Ave' });
  const [landmarks, setLandmarks] = useState([]);
  const [showMinimap, setShowMinimap] = useState(true);
  const [tilesLoaded, setTilesLoaded] = useState(0);
  const [viewLevel, setViewLevel] = useState('street');
  const canvasRef = useRef(null);
  const heading = position?.heading || 0;

  const VIEW_LEVELS = [
    { id: 'street', label: 'Street', icon: '\uD83D\uDEB6', height: 1.6 },
    { id: 'elevated', label: 'Elevated', icon: '\uD83C\uDFD9\uFE0F', height: 50 },
    { id: 'sky', label: 'Sky View', icon: '\u2708\uFE0F', height: 300 },
  ];

  const handleViewLevel = useCallback((level) => {
    setViewLevel(level.id);
    window.dispatchEvent(new CustomEvent('setViewHeight', { detail: { height: level.height } }));
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

  // Draw minimap
  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !position) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(0, 0, w, h);

    // Calculate tile position for player
    const tilePos = latLngToTile(position.lat, position.lng, MINIMAP_ZOOM);
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

        if (lx > 5 && lx < w - 5 && ly > 5 && ly < h - 5) {
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

    // Draw player arrow with heading
    drawPlayerArrow(ctx, centerX, centerY, heading);
  }, [position, heading, tilesLoaded]);

  useEffect(() => {
    drawMinimap();
  }, [drawMinimap]);

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

      {/* View Level — left side */}
      <div className="view-level-menu">
        {VIEW_LEVELS.map((level) => (
          <button
            key={level.id}
            className={`view-level-btn interactive ${viewLevel === level.id ? 'active' : ''}`}
            onClick={() => handleViewLevel(level)}
            title={level.label}
          >
            <span className="view-level-icon">{level.icon}</span>
            <span className="view-level-label">{level.label}</span>
          </button>
        ))}
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
        <canvas ref={canvasRef} width={256} height={256} />
      </div>

      {/* Crosshair */}
      <div className="crosshair" />
    </>
  );
}
