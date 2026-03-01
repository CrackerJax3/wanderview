import React from 'react';

const MODES = [
  {
    id: 'explorer',
    name: 'Explorer Mode',
    icon: '\uD83C\uDF0D',
    description: 'Free walk through the neighborhood. The AI narrates as you explore.',
  },
  {
    id: 'scavenger',
    name: 'Scavenger Hunt',
    icon: '\uD83C\uDFAF',
    description: 'Find specific places and landmarks. Race against the clock!',
  },
  {
    id: 'history',
    name: 'History Tour',
    icon: '\uD83D\uDCDA',
    description: 'Learn the rich history of every block — gangs, theaters, immigrants.',
  },
  {
    id: 'mystery',
    name: 'Mystery Mode',
    icon: '\uD83D\uDD75\uFE0F',
    description: 'A noir detective story unfolds as you walk. Find clues, solve the case.',
  },
];

export default function ModeSelector({ visible, onSelect }) {
  if (!visible) return null;

  return (
    <div className="mode-selector interactive">
      <h2>Choose Your Adventure</h2>
      <p className="mode-subtitle">How do you want to explore Hell's Kitchen?</p>
      {MODES.map((mode) => (
        <button
          key={mode.id}
          className="mode-option"
          onClick={() => onSelect(mode.id)}
        >
          <div className={`mode-icon ${mode.id}`}>{mode.icon}</div>
          <div className="mode-text">
            <span className="mode-name">{mode.name}</span>
            <span className="mode-desc">{mode.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
