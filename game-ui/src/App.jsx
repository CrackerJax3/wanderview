import React, { useState, useEffect, useRef, useCallback } from 'react';
import NarrationBar from './components/NarrationBar';
import HUD from './components/HUD';
import MissionPanel from './components/MissionPanel';
import AIChat from './components/AIChat';
import ModeSelector from './components/ModeSelector';
import ScreenAnalyzer from './components/ScreenAnalyzer';
import { setApiKey as setMistralApiKey, getNarration, generateMission, hasApiKey as hasMistralKey } from './services/mistral';
import { setApiKey as setPlacesApiKey, getNearbyPlaces } from './services/places';

// Expose API keys to vanilla JS layer (also done in inline <script> in index.html)
if (import.meta.env.VITE_GOOGLE_API_KEY) {
  window.WANDERVIEW_GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
}
if (import.meta.env.VITE_MISTRAL_API_KEY) {
  window.WANDERVIEW_MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;
}

// Game flow states — go straight to mode select (no API key prompt)
const FLOW_MODE_SELECT = 'mode_select';
const FLOW_PLAYING = 'playing';

export default function App() {
  const [flow, setFlow] = useState(FLOW_MODE_SELECT);
  const [gameMode, setGameMode] = useState('explorer');
  const [position, setPosition] = useState({ lat: 40.7608, lng: -73.9941, heading: 0 });
  const [narration, setNarration] = useState('');
  const [narrationVisible, setNarrationVisible] = useState(false);
  const [mission, setMission] = useState(null);
  const [score, setScore] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const lastNarrationPos = useRef({ lat: 0, lng: 0 });
  const narrationTimer = useRef(null);
  const chatRef = useRef(null);

  // Listen for position changes from game engine
  useEffect(() => {
    if (!window.gameEngine) return;

    const unsub = window.gameEngine.onPositionChange((pos) => {
      setPosition({ ...pos });
    });

    return unsub;
  }, []);

  // Handle mode selection
  const handleModeSelect = useCallback(async (mode) => {
    setGameMode(mode);
    if (window.gameEngine) window.gameEngine.gameMode = mode;
    setFlow(FLOW_PLAYING);

    // Generate first narration
    const places = await getNearbyPlaces(position.lat, position.lng);
    const text = await getNarration({
      lat: position.lat,
      lng: position.lng,
      heading: position.heading,
      places,
      gameMode: mode,
    });
    setNarration(text);
    setNarrationVisible(true);
    lastNarrationPos.current = { lat: position.lat, lng: position.lng };

    // Auto-hide narration after 8 seconds
    if (narrationTimer.current) clearTimeout(narrationTimer.current);
    narrationTimer.current = setTimeout(() => setNarrationVisible(false), 8000);

    // Generate first mission (except in explorer mode)
    if (mode !== 'explorer') {
      const missionData = await generateMission({
        lat: position.lat,
        lng: position.lng,
        places,
        gameMode: mode,
      });
      setMission(missionData);
      if (window.gameEngine) window.gameEngine.setMission(missionData);
    }

    // Hide controls hint after 10 seconds
    setTimeout(() => setShowControls(false), 10000);
  }, [position]);

  // Auto-narration when player moves enough distance
  useEffect(() => {
    if (flow !== FLOW_PLAYING) return;

    const lastPos = lastNarrationPos.current;
    const dlat = (position.lat - lastPos.lat) * 111320;
    const dlng = (position.lng - lastPos.lng) * 111320 * Math.cos(position.lat * Math.PI / 180);
    const distance = Math.sqrt(dlat * dlat + dlng * dlng);

    // Trigger new narration every ~100m of movement
    if (distance > 100) {
      lastNarrationPos.current = { lat: position.lat, lng: position.lng };

      (async () => {
        const places = await getNearbyPlaces(position.lat, position.lng);
        const text = await getNarration({
          lat: position.lat,
          lng: position.lng,
          heading: position.heading,
          places,
          gameMode,
        });
        setNarration(text);
        setNarrationVisible(true);

        if (narrationTimer.current) clearTimeout(narrationTimer.current);
        narrationTimer.current = setTimeout(() => setNarrationVisible(false), 8000);
      })();
    }
  }, [position, flow, gameMode]);

  // Handle mission completion
  const handleMissionComplete = useCallback(async (completedMission) => {
    const reward = completedMission.reward || 100;
    setScore((prev) => prev + reward);
    if (window.gameEngine) window.gameEngine.score += reward;

    // Auto-narrate the completion
    setNarration(`Mission complete! You found ${completedMission.target?.name || 'the target'}! +${reward} points!`);
    setNarrationVisible(true);
    if (narrationTimer.current) clearTimeout(narrationTimer.current);
    narrationTimer.current = setTimeout(() => setNarrationVisible(false), 6000);

    // Generate next mission after a delay
    setTimeout(async () => {
      const places = await getNearbyPlaces(position.lat, position.lng);
      const newMission = await generateMission({
        lat: position.lat,
        lng: position.lng,
        places,
        gameMode,
      });
      setMission(newMission);
      if (window.gameEngine) window.gameEngine.setMission(newMission);
    }, 3000);
  }, [position, gameMode]);

  return (
    <>
      {/* Mode Selector */}
      {flow === FLOW_MODE_SELECT && (
        <ModeSelector visible={true} onSelect={handleModeSelect} />
      )}

      {/* Game UI — only show when playing */}
      {flow === FLOW_PLAYING && (
        <>
          <NarrationBar text={narration} visible={narrationVisible} />

          <HUD
            position={position}
            gameMode={gameMode}
            score={score}
            onAnalyze={() => setAnalyzing(true)}
          />

          <MissionPanel
            mission={mission}
            position={position}
            onComplete={handleMissionComplete}
          />

          <AIChat
            ref={chatRef}
            position={position}
            gameMode={gameMode}
            mission={mission}
          />

          <ScreenAnalyzer
            active={analyzing}
            onCapture={(dataUrl) => {
              setAnalyzing(false);
              chatRef.current?.sendAnalysis(dataUrl);
            }}
            onCancel={() => setAnalyzing(false)}
          />

          {showControls && (
            <div className="controls-hint">
              <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move &nbsp;|&nbsp;
              <kbd>Mouse</kbd> Look &nbsp;|&nbsp;
              <kbd>Shift</kbd> Sprint &nbsp;|&nbsp;
              <kbd>Tab</kbd> Chat &nbsp;|&nbsp;
              <kbd>M</kbd> Minimap
            </div>
          )}
        </>
      )}
    </>
  );
}
