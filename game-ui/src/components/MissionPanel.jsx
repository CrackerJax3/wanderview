import React, { useState, useEffect } from 'react';

export default function MissionPanel({ mission, position, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!mission || !position || !mission.target) return;

    const dlat = (mission.target.lat - position.lat) * 111320;
    const dlng =
      (mission.target.lng - position.lng) *
      111320 *
      Math.cos((position.lat * Math.PI) / 180);
    const distance = Math.sqrt(dlat * dlat + dlng * dlng);

    const maxDist = 500;
    const pct = Math.max(0, Math.min(100, ((maxDist - distance) / maxDist) * 100));
    setProgress(pct);

    if (distance < 30 && !completed) {
      setCompleted(true);
      if (onComplete) onComplete(mission);
    }
  }, [mission, position, completed, onComplete]);

  useEffect(() => {
    setCompleted(false);
    setProgress(0);
  }, [mission?.title]);

  if (!mission) return null;

  return (
    <div className="mission-panel">
      <div className="mission-card">
        <div className="mission-header">
          <div className={`mission-status-dot ${completed ? 'completed' : ''}`} />
          <span className="mission-title">
            {completed ? 'Completed' : 'Active Mission'}
          </span>
        </div>
        <div className="mission-name">{mission.title}</div>
        <div className="mission-description">{mission.description}</div>
        <div className="mission-progress-track">
          <div
            className="mission-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        {mission.hint && !completed && (
          <div className="mission-hint">{mission.hint}</div>
        )}
        {completed && mission.reward && (
          <div className="mission-reward">+{mission.reward} points!</div>
        )}
      </div>
    </div>
  );
}
