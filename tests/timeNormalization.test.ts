/**
 * Tests for time normalization utilities
 */

import { describe, it, expect } from 'vitest';
import { normalizeTime, formatTime, determineTimeScale } from '../src/utils/timeNormalization';

describe('normalizeTime', () => {
  it('should normalize BCE/CE format', () => {
    expect(normalizeTime({ value: 500, unit: 'bce' })).toBe(-500);
    expect(normalizeTime({ value: 1492, unit: 'ce' })).toBe(1492);
  });

  it('should normalize geological time (mya)', () => {
    expect(normalizeTime({ value: 65, unit: 'mya' })).toBe(-65_000_000);
  });

  it('should normalize ISO date strings', () => {
    const result = normalizeTime('2024-01-01T00:00:00Z');
    expect(result).toBeCloseTo(2024, 0);
  });

  it('should normalize Temporal.Instant', () => {
    const instant = Temporal.Instant.from('2024-01-01T00:00:00Z');
    const result = normalizeTime(instant);
    expect(result).toBeCloseTo(2024, 0);
  });
});

describe('formatTime', () => {
  it('should format geological time', () => {
    expect(formatTime(-65_000_000, 'geological')).toBe('65.0 MYA');
  });

  it('should format BCE dates', () => {
    expect(formatTime(-500, 'historical')).toBe('500 BCE');
  });

  it('should format CE dates', () => {
    expect(formatTime(1492, 'historical')).toBe('1492 CE');
  });

  it('should format modern dates', () => {
    expect(formatTime(2024, 'modern')).toBe('2024');
  });
});

describe('determineTimeScale', () => {
  it('should detect geological scale', () => {
    expect(determineTimeScale(-65_000_000, -1_000_000)).toBe('geological');
  });

  it('should detect prehistoric scale', () => {
    expect(determineTimeScale(-50_000, -10_000)).toBe('prehistoric');
  });

  it('should detect historical scale', () => {
    expect(determineTimeScale(-500, 1500)).toBe('historical');
  });

  it('should detect modern scale', () => {
    expect(determineTimeScale(1900, 2024)).toBe('modern');
  });

  it('should detect precise scale', () => {
    expect(determineTimeScale(2024.0, 2024.5)).toBe('precise');
  });
});
