import React, { useState } from 'react';

export default function SchedulePanel({ items, onAccept, onDecline, onClear }) {
  const [minimized, setMinimized] = useState(false);

  const list = items || [];
  const confirmed = list.filter((i) => i.status === 'confirmed');
  const suggested = list.filter((i) => i.status === 'suggested');
  const sorted = [...confirmed, ...suggested].sort((a, b) => {
    return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
  });
  const hasItems = sorted.length > 0;

  return (
    <div className="schedule-panel schedule-hud-widget">
      <div className="schedule-header interactive" onClick={() => setMinimized((p) => !p)}>
        <span className="schedule-dot" />
        <span className="schedule-title">My Schedule</span>
        <span className={`schedule-toggle ${minimized ? 'collapsed' : ''}`}>
          {minimized ? '\u25B6' : '\u25BC'}
        </span>
      </div>

      {!minimized && (
        <div className="schedule-body">
          {hasItems ? (
            <>
              <div className="schedule-items">
                {sorted.map((item) => (
                  <div
                    key={item.id}
                    className={`schedule-item ${item.status}`}
                  >
                    <div className="schedule-item-time">{item.time}</div>
                    <div className="schedule-item-content">
                      <div className="schedule-item-title">{item.title}</div>
                      {item.location && (
                        <div className="schedule-item-location">{item.location}</div>
                      )}
                      {item.status === 'suggested' && (
                        <div className="schedule-item-actions interactive">
                          <button
                            className="schedule-accept"
                            onClick={(e) => { e.stopPropagation(); onAccept(item.id); }}
                            title="Accept"
                          >
                            &#10003;
                          </button>
                          <button
                            className="schedule-decline"
                            onClick={(e) => { e.stopPropagation(); onDecline(item.id); }}
                            title="Decline"
                          >
                            &#10005;
                          </button>
                        </div>
                      )}
                      {item.status === 'confirmed' && (
                        <span className="schedule-confirmed-badge">Confirmed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="schedule-clear interactive" onClick={onClear}>
                Clear Schedule
              </button>
            </>
          ) : (
            <div className="schedule-empty">
              <p>Ask the Game Master to plan your day in chat.</p>
              <p className="schedule-empty-hint">e.g. &quot;Plan my day — visit Place X at 9am, Place Y at 3pm&quot;</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2] || '0', 10);
  const period = (match[3] || '').toLowerCase();
  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  return hours * 60 + mins;
}
