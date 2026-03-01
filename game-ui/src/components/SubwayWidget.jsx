import React, { useState, useMemo } from 'react';
import { getNearbySubwayEntrances, getNextTrainMinutes } from '../services/subway';

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

export default function SubwayWidget({ position }) {
  const [minimized, setMinimized] = useState(false);

  const lat = position?.lat ?? 40.7608;
  const lng = position?.lng ?? -73.9941;

  const entrances = useMemo(
    () => getNearbySubwayEntrances(lat, lng, 1200),
    [lat, lng]
  );

  return (
    <div className="subway-panel schedule-hud-widget">
      <div className="subway-header interactive" onClick={() => setMinimized((p) => !p)}>
        <span className="subway-icon" aria-hidden="true">
          &#128646;
        </span>
        <span className="subway-title">Subway</span>
        <span className={`subway-toggle ${minimized ? 'collapsed' : ''}`}>
          {minimized ? '\u25B6' : '\u25BC'}
        </span>
      </div>

      {!minimized && (
        <div className="subway-body">
          {entrances.length > 0 ? (
            <ul className="subway-list">
              {entrances.map((station) => {
                const nextMin = getNextTrainMinutes(station.id);
                return (
                  <li key={station.id} className="subway-item">
                    <div className="subway-item-main">
                      <span className="subway-item-name">{station.name}</span>
                      <span className="subway-item-lines">{station.lines}</span>
                    </div>
                    <div className="subway-item-meta">
                      <span className="subway-item-distance">{formatDistance(station.distance)}</span>
                      <span className="subway-item-next">
                        Next train: {nextMin != null ? `~${nextMin} min` : '—'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="subway-empty">
              No subway entrances within 1.2 km. Move closer to Midtown / Hell&apos;s Kitchen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
