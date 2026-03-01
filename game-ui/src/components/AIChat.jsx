import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { callMistral, callMistralVision, callMistralSchedule, isScheduleRequest, parseScheduleFromResponse, parseTeleportFromResponse } from '../services/mistral';
import { getNearbyPlaces } from '../services/places';

const AIChat = forwardRef(function AIChat({ position, gameMode, mission, onScheduleUpdate }, ref) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const sendAnalysis = useCallback(async (imageDataUrl, coords) => {
    const targetLat = coords?.lat || position?.lat || 40.7608;
    const targetLng = coords?.lng || position?.lng || -73.9941;
    const coordLabel = `${targetLat.toFixed(4)}, ${targetLng.toFixed(4)}`;

    setExpanded(true);
    setMessages((prev) => [...prev, {
      role: 'user',
      text: `Analyze this area (${coordLabel})`,
      image: imageDataUrl,
    }]);
    setIsLoading(true);

    try {
      const places = await getNearbyPlaces(targetLat, targetLng);

      const reply = await callMistralVision(imageDataUrl, {
        lat: targetLat,
        lng: targetLng,
        heading: position?.heading || 0,
        places,
        gameMode,
        mission,
      });

      setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: "Sorry, I couldn't analyze that area. Try again." },
      ]);
    }

    setIsLoading(false);
  }, [position, gameMode, mission]);

  useImperativeHandle(ref, () => ({ sendAnalysis }), [sendAnalysis]);

  // Toggle chat with Tab key
  useEffect(() => {
    const handler = () => {
      setExpanded((prev) => {
        const next = !prev;
        if (next) {
          setTimeout(() => inputRef.current?.focus(), 100);
        }
        return next;
      });
    };
    window.addEventListener('toggleChat', handler);
    return () => window.removeEventListener('toggleChat', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = () => setExpanded(false);
    window.addEventListener('closeOverlays', handler);
    return () => window.removeEventListener('closeOverlays', handler);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    if (!expanded) setExpanded(true);

    try {
      const places = await getNearbyPlaces(
        position?.lat || 40.7608,
        position?.lng || -73.9941
      );

      const context = {
        lat: position?.lat || 40.7608,
        lng: position?.lng || -73.9941,
        heading: position?.heading || 0,
        places,
        gameMode,
        mission,
      };

      let reply;
      let schedule = null;

      if (isScheduleRequest(userMsg)) {
        const result = await callMistralSchedule(userMsg, context);
        reply = result.message || 'Here\'s your plan. Check the schedule on the right.';
        schedule = result.schedule;
      } else {
        const rawReply = await callMistral(userMsg, context);
        const parsed = parseScheduleFromResponse(rawReply);
        reply = parsed.message;
        schedule = parsed.schedule;
      }

      const teleportParsed = parseTeleportFromResponse(reply);
      if (teleportParsed.lat != null && teleportParsed.lng != null && window.gameEngine) {
        window.gameEngine.teleportTo(teleportParsed.lat, teleportParsed.lng);
        reply = teleportParsed.message || reply;
      } else if (teleportParsed.message) {
        reply = teleportParsed.message;
      }

      setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
      if (schedule && schedule.length > 0 && onScheduleUpdate) {
        onScheduleUpdate(schedule);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: "Sorry, the game master's taking a coffee break. Try again." },
      ]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
    e.stopPropagation();
  };

  return (
    <div className={`chat-container ${expanded ? 'expanded' : ''}`}>
      {expanded && (
        <>
          <div className="chat-header interactive" onClick={() => setExpanded(false)}>
            <span>Game Master Chat</span>
            <span className="chat-collapse-icon">&#9660;</span>
          </div>
          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-message ai">
                Welcome to WanderView! Ask me anything about the neighborhood, or just keep walking.
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`chat-message ${msg.role}`}>
                {msg.image && (
                  <img src={msg.image} alt="Screen capture" className="chat-capture-img" />
                )}
                {msg.text}
              </div>
            ))}
            {isLoading && (
              <div className="chat-message ai" style={{ opacity: 0.5 }}>
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </>
      )}

      <div className="chat-bottom-bar interactive">
        {!expanded && (
          <button className="chat-expand-btn" onClick={() => setExpanded(true)} title="Open chat">
            &#9650;
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          placeholder="Message the Game Master..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => !expanded && setExpanded(true)}
        />
        <button onClick={sendMessage} disabled={isLoading}>
          &#9654;
        </button>
      </div>
    </div>
  );
});

export default AIChat;
