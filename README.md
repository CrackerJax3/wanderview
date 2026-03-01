# WanderView

First-person walking game exploring **Hell's Kitchen, NYC** with AI narration, missions, and real-world 3D tiles.

## Features

- **Explore** Manhattan (Hell's Kitchen area) in a 3D first-person view powered by Google 3D Tiles.
- **Game modes**: Explorer, Scavenger Hunt, History Tour, Mystery Mode.
- **AI Game Master** (Mistral): narration as you walk, chat, missions, day planning, and teleport.
- **Schedule panel**: Ask the AI to plan your day; see activities with price per person, budget tally, and total time. Approved stops show as a **route on the minimap**.
- **Subway widget**: Nearby subway entrances (closest to furthest) with next-train estimate. Collapsed: train icon; expanded: list with distance and “Next train: ~X min”.
- **Photo pinpoint**: Upload your own photo; the AI identifies the NYC location and **teleports** you there when possible.
- **Analyzer**: Select a region on screen for the AI to describe (with optional raycast coordinates).
- **Minimap** (toggle with **M**): OSM tiles, player heading, landmarks, and schedule route.
- **Street View overlay**: Optional street-level imagery when you look down.

## Prerequisites

- **Node.js** 18+
- **npm** (or yarn/pnpm)

## Setup

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd wanderviewJAXgHub
   npm install
   ```

2. **Environment variables**

   Copy the example env file and add your API keys:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   | Variable | Description |
   |----------|-------------|
   | `VITE_MISTRAL_API_KEY` | [Mistral](https://console.mistral.ai/) — narration, chat, missions, schedule, photo pinpoint |
   | `VITE_GOOGLE_API_KEY` | [Google Cloud](https://console.cloud.google.com/) — 3D Tiles + Places API (Map Tiles API, Places API (New)) |

   Without keys, the game still runs with fallback narration and static place data.

## Run

- **Development**: `npm run dev` (starts Vite; open the URL shown).
- **Production build**: `npm run build` (output in `game-ui/dist`).
- **Preview build**: `npm run preview` (serve the built app).

## Controls

| Key | Action |
|-----|--------|
| **W A S D** | Move |
| **Mouse** | Look around |
| **Q / E** | Down / Up (elevation) |
| **Scroll** | Zoom |
| **Shift** | Sprint |
| **Tab** | Toggle chat |
| **M** | Toggle minimap |

Use the **Analyzer** button (top right) to select an area on screen for the AI to describe. Use the **camera icon** in chat to upload a photo and pinpoint a location.

## Project structure

- **Root**: `package.json` scripts run the UI app; `postinstall` installs `game-ui` deps.
- **`game-ui/`**: Vite + React app.
  - **`/src`**: React components (HUD, AIChat, SchedulePanel, SubwayWidget, MissionPanel, etc.), services (Mistral, places, subway), styles.
  - **`/public`**: Static assets and game scripts (A-Frame, 3D Tiles loader, engine, navigation).
- **`.env.example`** / **`.env.local`**: API keys (not committed).

## License

See repository license if present.
