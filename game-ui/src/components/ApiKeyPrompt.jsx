import React, { useState } from 'react';

export default function ApiKeyPrompt({ onSubmit }) {
  const [mistralKey, setMistralKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ mistralKey: mistralKey.trim(), googleKey: googleKey.trim() });
  };

  const handleSkip = () => {
    onSubmit({ mistralKey: '', googleKey: '' });
  };

  return (
    <div className="api-key-prompt interactive">
      <h2>WanderView</h2>
      <p className="prompt-subtitle">
        API keys are optional — the game works great without them.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="api-field">
          <label>Mistral AI API Key</label>
          <input
            type="password"
            value={mistralKey}
            onChange={(e) => setMistralKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div className="api-field">
          <label>Google Maps API Key</label>
          <input
            type="password"
            value={googleKey}
            onChange={(e) => setGoogleKey(e.target.value)}
            placeholder="AIza..."
          />
        </div>

        <button type="submit" className="btn-primary">
          Start with API Keys
        </button>
        <button type="button" className="btn-secondary" onClick={handleSkip}>
          Play Demo Mode
        </button>
      </form>
    </div>
  );
}
