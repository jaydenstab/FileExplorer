import { describe, it, expect } from 'vitest';
import {
  applyZoomStep,
  normalizeWheelDelta,
  createZoomAccumulator,
  PDF_ZOOM_MIN,
  PDF_ZOOM_MAX,
} from './zoomInput';

describe('zoomInput', () => {
  describe('applyZoomStep', () => {
    it('zooms in by step', () => {
      expect(applyZoomStep(100, 1)).toBe(110);
      expect(applyZoomStep(100, 2)).toBe(120);
    });

    it('zooms out by step', () => {
      expect(applyZoomStep(100, -1)).toBe(90);
      expect(applyZoomStep(100, -2)).toBe(80);
    });

    it('clamps to text bounds (50-200)', () => {
      expect(applyZoomStep(200, 1)).toBe(200);
      expect(applyZoomStep(50, -1)).toBe(50);
      expect(applyZoomStep(195, 1)).toBe(200);
      expect(applyZoomStep(55, -1)).toBe(50);
    });

    it('respects custom PDF bounds when provided', () => {
      const pdfBounds = { min: PDF_ZOOM_MIN, max: PDF_ZOOM_MAX };
      expect(applyZoomStep(400, 1, undefined, pdfBounds)).toBe(400);
      expect(applyZoomStep(25, -1, undefined, pdfBounds)).toBe(25);
      expect(applyZoomStep(100, 30, undefined, pdfBounds)).toBe(400);
      expect(applyZoomStep(100, -30, undefined, pdfBounds)).toBe(25);
    });
  });

  describe('normalizeWheelDelta', () => {
    it('passes through pixel delta unchanged', () => {
      expect(normalizeWheelDelta(40, 0)).toBe(40);
    });

    it('scales line delta by PIXELS_PER_LINE', () => {
      expect(normalizeWheelDelta(2, 1)).toBe(80);
    });

    it('scales page delta by PIXELS_PER_PAGE', () => {
      expect(normalizeWheelDelta(1, 2)).toBe(800);
    });
  });

  describe('createZoomAccumulator', () => {
    it('accumulates deltas and returns step count when threshold reached', () => {
      const acc = createZoomAccumulator();
      expect(acc.apply(0)).toBe(0);
      expect(acc.apply(30)).toBe(0);
      expect(acc.apply(35)).toBe(1);
    });

    it('returns negative steps for negative delta', () => {
      const acc = createZoomAccumulator();
      expect(acc.apply(-65)).toBe(-1);
    });

    it('reset clears accumulated value', () => {
      const acc = createZoomAccumulator();
      acc.apply(30);
      acc.reset();
      expect(acc.apply(30)).toBe(0);
      expect(acc.apply(35)).toBe(1);
    });

    it('respects custom threshold (sensitivity)', () => {
      const acc = createZoomAccumulator({ threshold: 120 });
      expect(acc.apply(60)).toBe(0);
      expect(acc.apply(65)).toBe(1);
      const fastAcc = createZoomAccumulator({ threshold: 30 });
      expect(fastAcc.apply(35)).toBe(1);
    });
  });
});
