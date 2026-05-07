import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ZOOM_DEFAULT,
  normalizeWheelDelta,
  createZoomAccumulator,
  applyZoomStep,
  PDF_ZOOM_MIN,
  PDF_ZOOM_MAX,
} from './zoomInput';
import { usePreviewZoomPreferences } from './usePreviewZoomPreferences';

export interface UsePreviewZoomControlsParams {
  isPdfPreview: boolean;
  hasZoomControls: boolean;
  currentContentPath: string | null;
}

export interface UsePreviewZoomControlsResult {
  zoomPercent: number;
  wrapLines: boolean;
  setWrapLines: React.Dispatch<React.SetStateAction<boolean>>;
  sensitivity: 'slow' | 'normal' | 'fast';
  setSensitivity: (v: 'slow' | 'normal' | 'fast') => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  /** Ref to attach to the panel container for wheel/keyboard and focus containment. */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Debug: wheel tick count in DEV. */
  wheelTicksRef: React.MutableRefObject<number>;
}

export function usePreviewZoomControls({
  isPdfPreview,
  hasZoomControls,
  currentContentPath,
}: UsePreviewZoomControlsParams): UsePreviewZoomControlsResult {
  const [zoomPercent, setZoomPercent] = useState(ZOOM_DEFAULT);
  const [wrapLines, setWrapLines] = useState(false);
  const prevPathRef = useRef<string | null>(null);
  const { sensitivity, setSensitivity, getWheelThreshold } = usePreviewZoomPreferences();
  const zoomAccumulatorRef = useRef(
    createZoomAccumulator({ threshold: getWheelThreshold() })
  );
  const rafRef = useRef<number | null>(null);
  const wheelTicksRef = useRef(0);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    zoomAccumulatorRef.current = createZoomAccumulator({
      threshold: getWheelThreshold(),
    });
    zoomAccumulatorRef.current.reset();
  }, [sensitivity, getWheelThreshold]);

  useEffect(() => {
    if (currentContentPath !== prevPathRef.current) {
      prevPathRef.current = currentContentPath;
      zoomAccumulatorRef.current.reset();
      if (currentContentPath) {
        setZoomPercent(ZOOM_DEFAULT);
        setWrapLines(false);
      }
    }
  }, [currentContentPath]);

  const applyZoomDelta = useCallback(
    (stepDelta: number) => {
      setZoomPercent((p) =>
        applyZoomStep(
          p,
          stepDelta,
          undefined,
          isPdfPreview ? { min: PDF_ZOOM_MIN, max: PDF_ZOOM_MAX } : undefined
        )
      );
    },
    [isPdfPreview]
  );

  const handleZoomIn = useCallback(() => applyZoomDelta(1), [applyZoomDelta]);
  const handleZoomOut = useCallback(() => applyZoomDelta(-1), [applyZoomDelta]);
  const handleZoomReset = useCallback(() => setZoomPercent(ZOOM_DEFAULT), []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (!panelRef.current?.contains(document.activeElement)) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        applyZoomDelta(1);
      } else if (e.key === '-') {
        e.preventDefault();
        applyZoomDelta(-1);
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomPercent(ZOOM_DEFAULT);
      }
    },
    [applyZoomDelta]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (!panelRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      const normalized = normalizeWheelDelta(e.deltaY, e.deltaMode);
      const steps = zoomAccumulatorRef.current.apply(normalized);
      if (steps === 0) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyZoomDelta(-steps);
        if (import.meta.env.DEV) wheelTicksRef.current += Math.abs(steps);
      });
    },
    [applyZoomDelta]
  );

  useEffect(() => {
    if (!hasZoomControls) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasZoomControls, handleKeyDown]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || !hasZoomControls) return;
    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener('wheel', handleWheel, { capture: true });
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasZoomControls, handleWheel]);

  return {
    zoomPercent,
    wrapLines,
    setWrapLines,
    sensitivity,
    setSensitivity,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    panelRef,
    wheelTicksRef,
  };
}
