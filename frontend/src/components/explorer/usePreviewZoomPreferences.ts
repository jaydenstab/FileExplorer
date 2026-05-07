import { useState, useEffect, useCallback } from 'react';
import { ZOOM_WHEEL_THRESHOLD_DEFAULT } from './zoomInput';

const STORAGE_KEY = 'preview-zoom-sensitivity';

export type ZoomSensitivity = 'slow' | 'normal' | 'fast';

/** Threshold multiplier: higher = less sensitive (more scroll needed per step) */
const SENSITIVITY_MULTIPLIERS: Record<ZoomSensitivity, number> = {
  slow: 1.5,
  normal: 1,
  fast: 0.6,
};

function loadStoredSensitivity(): ZoomSensitivity {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'slow' || stored === 'normal' || stored === 'fast') return stored;
  } catch {
    /* ignore */
  }
  return 'normal';
}

/**
 * Returns persisted zoom sensitivity and a setter.
 * Use getWheelThreshold() to obtain the threshold for createZoomAccumulator.
 */
export function usePreviewZoomPreferences() {
  const [sensitivity, setSensitivityState] = useState<ZoomSensitivity>(loadStoredSensitivity);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, sensitivity);
    } catch {
      /* ignore */
    }
  }, [sensitivity]);

  const setSensitivity = useCallback((value: ZoomSensitivity) => {
    setSensitivityState(value);
  }, []);

  const getWheelThreshold = useCallback(() => {
    const mult = SENSITIVITY_MULTIPLIERS[sensitivity];
    return Math.round(ZOOM_WHEEL_THRESHOLD_DEFAULT * mult);
  }, [sensitivity]);

  return { sensitivity, setSensitivity, getWheelThreshold };
}
