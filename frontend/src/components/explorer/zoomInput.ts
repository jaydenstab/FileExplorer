/**
 * Normalizes wheel input across deltaMode values and converts to deterministic zoom ticks.
 * Reduces sensitivity variance across different trackpad/mouse settings.
 */

/** WheelEvent.deltaMode values */
const DELTA_MODE_PIXEL = 0;
const DELTA_MODE_LINE = 1;
const DELTA_MODE_PAGE = 2;

/** Pixels per "line" for deltaMode LINE (typical browser default) */
const PIXELS_PER_LINE = 40;

/** Pixels per "page" for deltaMode PAGE */
const PIXELS_PER_PAGE = 800;

/**
 * Normalize wheel delta to a consistent pixel value regardless of deltaMode.
 */
export function normalizeWheelDelta(deltaY: number, deltaMode: number): number {
  switch (deltaMode) {
    case DELTA_MODE_LINE:
      return deltaY * PIXELS_PER_LINE;
    case DELTA_MODE_PAGE:
      return deltaY * PIXELS_PER_PAGE;
    case DELTA_MODE_PIXEL:
    default:
      return deltaY;
  }
}

/** Default threshold (in normalized pixels) to trigger one zoom step. Tuned for macOS trackpad. */
export const ZOOM_WHEEL_THRESHOLD_DEFAULT = 60;

export interface ZoomAccumulator {
  apply: (normalizedDelta: number) => number;
  reset: () => void;
}

export interface CreateZoomAccumulatorOptions {
  /** Threshold in normalized pixels per zoom step. Higher = less sensitive. */
  threshold?: number;
}

/**
 * Creates an accumulator that converts normalized wheel deltas into zoom step counts.
 * Accumulates small deltas until threshold is reached; returns signed step count.
 */
export function createZoomAccumulator(
  options?: CreateZoomAccumulatorOptions
): ZoomAccumulator {
  const threshold = options?.threshold ?? ZOOM_WHEEL_THRESHOLD_DEFAULT;
  let accumulated = 0;

  return {
    apply(normalizedDelta: number) {
      accumulated += normalizedDelta;

      let steps = 0;
      while (Math.abs(accumulated) >= threshold) {
        steps += accumulated > 0 ? 1 : -1;
        accumulated -= accumulated > 0 ? threshold : -threshold;
      }
      return steps;
    },
    reset() {
      accumulated = 0;
    },
  };
}

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;
export const ZOOM_DEFAULT = 80;

/** PDF-specific zoom range (wider for document viewing) */
export const PDF_ZOOM_MIN = 25;
export const PDF_ZOOM_MAX = 400;

/**
 * Clamps zoom percent to valid range and applies step delta.
 */
export function applyZoomStep(
  currentPercent: number,
  stepDelta: number,
  step: number = ZOOM_STEP,
  bounds?: { min: number; max: number }
): number {
  const { min, max } = bounds ?? { min: ZOOM_MIN, max: ZOOM_MAX };
  const next = currentPercent + stepDelta * step;
  return Math.max(min, Math.min(max, next));
}
