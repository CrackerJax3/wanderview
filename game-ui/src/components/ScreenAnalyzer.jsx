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
    const sceneCanvas = document.querySelector('a-scene')?.canvas;
    if (!sceneCanvas) {
      onCancel();
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const sx = rect.x * dpr;
    const sy = rect.y * dpr;
    const sw = rect.width * dpr;
    const sh = rect.height * dpr;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rect.width;
    tempCanvas.height = rect.height;
    const ctx = tempCanvas.getContext('2d');

    ctx.drawImage(sceneCanvas, sx, sy, sw, sh, 0, 0, rect.width, rect.height);

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
