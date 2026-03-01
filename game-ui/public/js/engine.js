/**
 * engine.js — 3D World Engine
 * Manages the A-Frame scene, tiles loading, camera setup,
 * and coordinates with the game bridge.
 */

(function () {
  // Track ready state at the top level so we never miss the tilesReady event
  var isReady = false;

  function markReady() {
    if (isReady) return;
    isReady = true;
    if (window.gameEngine) window.gameEngine.setReady();

    // Update loading screen visuals (only works after DOM is parsed)
    var loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      var fill = loadingScreen.querySelector('.loader-fill');
      if (fill) fill.style.width = '100%';
      var hint = loadingScreen.querySelector('.loader-hint');
      if (hint) {
        hint.textContent = 'Click to start exploring';
        hint.classList.add('pulse');
      }
    }
  }

  // Listen for tilesReady immediately — tiles component may fire
  // before DOMContentLoaded since A-Frame inits during body parse
  window.addEventListener('tilesReady', markReady);

  // Fallback: if nothing signals ready within 2 seconds of DOM parse, force it
  document.addEventListener('DOMContentLoaded', function () {
    var scene = document.querySelector('#game-scene');
    var loadingScreen = document.getElementById('loading-screen');

    // If tiles already signaled ready before DOM was parsed, apply visuals now
    if (isReady || (window.gameEngine && window.gameEngine.isReady)) {
      markReady();
    }

    // Fallback timer
    setTimeout(markReady, 2000);

    // Register loading screen click handler — only dismiss when ready
    if (loadingScreen) {
      loadingScreen.addEventListener('click', function () {
        if (!isReady) return; // Don't let user through until ready
        loadingScreen.classList.add('hidden');
        if (scene && scene.canvas && scene.canvas.requestPointerLock) {
          scene.canvas.requestPointerLock();
        }
      });
    }

    // Scene lifecycle logging
    if (scene) {
      scene.addEventListener('loaded', function () {
        console.log('A-Frame scene loaded');
      });
      scene.addEventListener('renderstart', function () {
        console.log('Rendering started');
      });
    }
  });

  // Override fullscreen to use document.body so the HUD stays visible
  document.addEventListener('fullscreenchange', function () {
    // If A-Frame fullscreened just the canvas, exit and re-fullscreen the body
    if (document.fullscreenElement && document.fullscreenElement.tagName === 'CANVAS') {
      document.exitFullscreen().then(function () {
        document.body.requestFullscreen().catch(function () {});
      });
    }
  });

  // Keyboard shortcuts (safe to register on document immediately)
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'm' || e.key === 'M') {
      window.dispatchEvent(new CustomEvent('toggleMinimap'));
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('toggleChat'));
    }
    if (e.key === 'Escape') {
      window.dispatchEvent(new CustomEvent('closeOverlays'));
    }
  });
})();
