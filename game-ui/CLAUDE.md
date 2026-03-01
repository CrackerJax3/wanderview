# game-ui

Vite + React project for the WanderView UI overlay.

## Structure

```
game-ui/
├── index.html              # A-Frame 3D scene + React mount point
├── vite.config.js          # Vite config, output to dist/
├── public/
│   ├── css/style.css       # Base/loading screen styles
│   └── js/
│       ├── bridge.js       # window.gameEngine — shared API between 3D and React
│       ├── engine.js       # A-Frame scene lifecycle, keyboard shortcuts
│       ├── controls.js     # FPS look (pointer lock) + WASD movement components
│       ├── tiles-component.js  # Google 3D Tiles A-Frame component + procedural fallback
│       └── navigation.js   # Street grid data, compass, landmarks
└── src/
    ├── main.jsx            # React entry, mounts to #game-ui div
    ├── App.jsx             # Root component, 3-screen flow: api_keys → mode_select → playing
    ├── index.css           # All React overlay CSS
    ├── components/
    │   ├── ApiKeyPrompt.jsx   # Optional API key entry (now reads from env vars first)
    │   ├── ModeSelector.jsx   # Game mode picker (explorer/scavenger/history/mystery)
    │   ├── NarrationBar.jsx   # AI narration with typewriter effect
    │   ├── HUD.jsx            # Score, compass, location, minimap canvas
    │   ├── MissionPanel.jsx   # Active mission card with proximity progress
    │   └── AIChat.jsx         # Player ↔ AI chat (Tab to open)
    └── services/
        ├── mistral.js      # Mistral AI integration + mock fallbacks
        └── places.js       # Google Places API (New) + hardcoded fallbacks
```

## Environment Variables

Access via `import.meta.env.VITE_*`:
- `VITE_MISTRAL_API_KEY` — auto-loaded into mistral.js
- `VITE_GOOGLE_API_KEY` — auto-loaded into places.js and tiles-component

## Key Patterns

- API keys: check `import.meta.env` first, fall back to user prompt, fall back to demo mode
- All Mistral/Places API calls gracefully degrade to mock data on failure
- Position sync: A-Frame controls.js → bridge.js → React App.jsx via callbacks
- Narration auto-triggers every ~100m of player movement
- Missions complete when player is within 30m of target

## Dev Server

```bash
npm run dev    # starts on http://localhost:3000
```
