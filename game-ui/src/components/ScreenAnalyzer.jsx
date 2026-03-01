import React, { useState, useRef, useCallback, useEffect } from 'react';

export default function ScreenAnalyzer({ active, onCapture, onCancel }) {
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (active) {
      window._analyzerActive = true;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    } else {
      window._analyzerActive = false;
      setDrawing(false);
      setStart(null);
      setEnd(null);
    }
    return () => { window._analyzerActive = false; };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [active, onCancel]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDrawing(true);
    setStart({ x: e.clientX, y: e.clientY });
    setEnd({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!drawing) return;
    e.preventDefault();
    setEnd({ x: e.clientX, y: e.clientY });
  }, [drawing]);

  const handleMouseUp = useCallback((e) => {
    if (!drawing || !start || !end) return;
    e.preventDefault();
    e.stopPropagation();
    setDrawing(false);

    const rect = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };

    if (rect.width < 10 || rect.height < 10) {
      onCancel();
      return;
    }

    captureRegion(rect);
  }, [drawing, start, end, onCancel]);

  const captureRegion = useCallback((rect) => {
    const sceneEl = document.querySelector('a-scene');
    if (!sceneEl || !sceneEl.renderer || !sceneEl.canvas) {
      onCancel();
      return;
    }

    // Force a render so the drawing buffer has current frame data
    sceneEl.renderer.render(sceneEl.object3D, sceneEl.camera);

    const gl = sceneEl.renderer.getContext();
    const dpr = sceneEl.renderer.getPixelRatio();
    const canvasWidth = gl.drawingBufferWidth;
    const canvasHeight = gl.drawingBufferHeight;

    const sx = Math.round(rect.x * dpr);
    const sy = Math.round((window.innerHeight - rect.y - rect.height) * dpr);
    const sw = Math.round(rect.width * dpr);
    const sh = Math.round(rect.height * dpr);

    const pixels = new Uint8Array(sw * sh * 4);
    gl.readPixels(sx, sy, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const ctx = tempCanvas.getContext('2d');
    const imageData = ctx.createImageData(sw, sh);

    // WebGL readPixels is bottom-up, flip vertically
    for (let row = 0; row < sh; row++) {
      const srcOffset = row * sw * 4;
      const dstOffset = (sh - row - 1) * sw * 4;
      imageData.data.set(pixels.subarray(srcOffset, srcOffset + sw * 4), dstOffset);
    }

    ctx.putImageData(imageData, 0, 0);
    const dataUrl = tempCanvas.toDataURL('image/png');
    onCapture(dataUrl);
  }, [onCapture, onCancel]);

  if (!active) return null;

  const selectionStyle = start && end ? {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  } : null;

  return (
    <div
      ref={overlayRef}
      className="analyzer-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="analyzer-instructions">
        Click and drag to select an area to analyze &middot; Press <kbd>Esc</kbd> to cancel
      </div>

      {selectionStyle && selectionStyle.width > 0 && (
        <div className="analyzer-selection" style={selectionStyle} />
      )}
    </div>
  );
}
