import React, { useState, useEffect, useRef } from 'react';

export default function NarrationBar({ text, visible }) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!text) return;

    // Typewriter effect
    setIsTyping(true);
    setDisplayText('');
    let i = 0;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(intervalRef.current);
        setIsTyping(false);
      }
    }, 25);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text]);

  return (
    <div className={`narration-bar ${!visible || !text ? 'hidden' : ''}`}>
      <div className="narration-text">
        {displayText}
        {isTyping && <span className="typing-cursor">|</span>}
      </div>
    </div>
  );
}
