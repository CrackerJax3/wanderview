import React, { useState, useEffect, useRef, useCallback } from 'react';

const BADGE_COLORS = ['red', 'green', 'blue', 'orange', 'purple'];

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}

export default function HUD({ position, gameMode, score }) {
  const [street, setStreet] = useState({ street: '46th St', avenue: '9th Ave' });
  const [heading, setHeading] = useState(0);
  const [landmarks, setLandmarks] = useState([]);
  const [showMinimap, setShowMinimap] = useState(true);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!position || !window.gameNavigation) return;

    setStreet(window.gameNavigation.getCurrentStreet(position.lat, position.lng));
    setHeading(position.heading || 0);
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
    if (!canvas || !position || !window.gameNavigation) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const scale = w / 0.005;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(0, 0, w, h);

    // Draw street grid
    const nav = window.gameNavigation;
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;

    // East-West streets
    nav.STREETS.eastWest.forEach((st) => {
      const dy = (st.lat - position.lat) * scale;
      const y = centerY - dy;
      if (y > 0 && y < h) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        ctx.fillStyle = '#9CA3AF';
        ctx.font = '500 7px Inter, sans-serif';
        ctx.fillText(st.name, 4, y - 2);
      }
    });

    // North-South avenues
    nav.STREETS.northSouth.forEach((ave) => {
      const dx = (ave.lng - position.lng) * scale;
      const x = centerX + dx;
      if (x > 0 && x < w) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    });

    // Draw landmarks with colored dots
    const colors = ['#FF3B30', '#34C759', '#007AFF', '#FF9500', '#AF52DE'];
    nav.LANDMARKS.forEach((lm, i) => {
      const dx = (lm.lng - position.lng) * scale;
      const dy = (lm.lat - position.lat) * scale;
      const x = centerX + dx;
      const y = centerY - dy;

      if (x > 5 && x < w - 5 && y > 5 && y < h - 5) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // White border
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // Player dot (green with white border)
    ctx.fillStyle = '#4CD964';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player heading indicator
    const headingRad = -(heading * Math.PI) / 180 + Math.PI / 2;
    ctx.strokeStyle = '#4CD964';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(headingRad) * 14,
      centerY - Math.sin(headingRad) * 14
    );
    ctx.stroke();
  }, [position, heading]);

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
        <canvas ref={canvasRef} width={180} height={180} />
      </div>

      {/* Crosshair */}
      <div className="crosshair" />
    </>
  );
}
