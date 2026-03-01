import React, { useState, useEffect, useRef } from 'react';
import { callMistral } from '../services/mistral';
import { getNearbyPlaces } from '../services/places';

export default function AIChat({ position, gameMode, mission }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

      const reply = await callMistral(userMsg, {
        lat: position?.lat || 40.7608,
        lng: position?.lng || -73.9941,
        heading: position?.heading || 0,
        places,
        gameMode,
        mission,
      });

      setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
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
}
