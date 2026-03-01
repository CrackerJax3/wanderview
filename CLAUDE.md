# WanderView

A first-person walking game set in Hell's Kitchen, NYC. Players explore a 3D recreation of the real neighborhood with AI narration powered by Mistral and real place data from Google.

## Architecture

Two-layer system:
1. **3D Layer** (A-Frame + vanilla JS in `game-ui/public/js/`) — full-screen 3D scene with Google 3D Map Tiles or procedural fallback
2. **UI Overlay** (React + Vite in `game-ui/src/`) — transparent React app mounted over the 3D scene

Communication between layers uses `window.gameEngine` and `window.gameNavigation` globals, plus custom DOM events (`toggleChat`, `toggleMinimap`, `closeOverlays`).

## Project Structure

```
wanderview/
├── package.json            # Root scripts (delegates to game-ui)
├── .env.example            # Environment variable template
└── game-ui/                # Vite + React project
    ├── index.html           # Entry: A-Frame scene + React mount
    ├── vite.config.js
    ├── public/
    │   ├── css/style.css    # Base styles, loading screen
    │   └── js/              # Vanilla JS engine (see CLAUDE.md in game-ui/)
    └── src/
        ├── main.jsx         # React entry
        ├── App.jsx          # Root component, game state machine
        ├── index.css        # React overlay styles
        ├── components/      # UI components
        └── services/        # API integrations (Mistral, Google Places)
```

## Environment Variables

API keys are configured via environment variables (Vite `VITE_` prefix):
- `VITE_MISTRAL_API_KEY` — Mistral AI API key for narration/chat
- `VITE_GOOGLE_API_KEY` — Google Maps API key for 3D Tiles + Places

Set these in `.env.local` for local dev or in Vercel project settings for production.

## Commands

- `npm run dev` — Start dev server (from root, delegates to game-ui)
- `npm run build` — Production build
- `npm run preview` — Preview production build

## Code Conventions

- React components: functional components with hooks, JSX files
- No external state management — all state in App.jsx via useState
- Services are module-scoped singletons (mistral.js, places.js)
- Vanilla JS engine files use IIFEs, no modules
- CSS: plain CSS, no frameworks. Light theme with navy/blue accents
- No TypeScript (plain JS/JSX)

## Design Language

- Light theme: white/light gray backgrounds
- Primary color: navy blue (#1B2A4A)
- Accent: teal/green (#2DD4A8), warm orange for alerts
- Rounded corners (12-16px), soft shadows
- Glassmorphism on panels over the 3D scene
- Clean, modern typography (Inter or system font stack)
