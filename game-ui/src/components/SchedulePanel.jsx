import React, { useState } from 'react';

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

/** Estimate dollars from price string for budget total (per person) */
function priceToEstimate(priceStr) {
  if (!priceStr || typeof priceStr !== 'string') return 0;
  const t = priceStr.trim().toLowerCase();
  if (t === 'free' || t === '') return 0;
  const dollarCount = (priceStr.match(/\$/g) || []).length;
  if (dollarCount >= 1 && !/\d/.test(priceStr)) {
    const map = { 1: 12, 2: 25, 3: 45, 4: 80 };
    return map[Math.min(dollarCount, 4)] ?? 25;
  }
  const numbers = priceStr.replace(/[^0-9.-]/g, ' ').split(/\s+/).map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
  if (numbers.length >= 2) {
    const [lo, hi] = numbers.slice(0, 2);
    return Math.round((lo + hi) / 2);
  }
  if (numbers.length === 1) return numbers[0];
  return 0;
}

export default function SchedulePanel({ items, onAccept, onDecline, onClear }) {
  const [minimized, setMinimized] = useState(false);

  const list = items || [];
  const confirmed = list.filter((i) => i.status === 'confirmed');
  const suggested = list.filter((i) => i.status === 'suggested');
  const sorted = [...confirmed, ...suggested].sort((a, b) => {
    return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
  });
  const hasItems = sorted.length > 0;

  const totalBudgetPerPerson = hasItems
    ? sorted.reduce((sum, item) => sum + priceToEstimate(item.pricePerPerson), 0)
    : 0;

  const totalTimeMinutes = hasItems && sorted.length > 0
    ? (() => {
        const first = parseTimeToMinutes(sorted[0].time);
        const last = parseTimeToMinutes(sorted[sorted.length - 1].time);
        return last > first ? last - first : first - last;
      })()
    : 0;
  const totalTimeLabel = totalTimeMinutes > 0
    ? `${Math.floor(totalTimeMinutes / 60)}h ${totalTimeMinutes % 60}m`
    : '';

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
                      {item.pricePerPerson && (
                        <div className="schedule-item-price">Per person: {item.pricePerPerson}</div>
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
              {hasItems && (totalBudgetPerPerson > 0 || totalTimeLabel) && (
                <div className="schedule-totals">
                  {totalBudgetPerPerson > 0 && (
                    <div className="schedule-total-row">
                      <span>Budget (per person)</span>
                      <strong>~${totalBudgetPerPerson}</strong>
                    </div>
                  )}
                  {totalTimeLabel && (
                    <div className="schedule-total-row">
                      <span>Total time</span>
                      <strong>{totalTimeLabel}</strong>
                    </div>
                  )}
                </div>
              )}
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
