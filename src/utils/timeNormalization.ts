/**
 * Time normalization utilities
 * Converts various time input formats to a unified representation (years from 0 CE)
 */

import type { TimeInput, NormalizedTime, TimelinePeriod } from '../core/types';

/**
 * Normalize any time input to years from 0 CE
 * Reference point: 0 CE
 * - Geological time: negative values (e.g., -4,543,000,000 for Earth formation)
 * - Historical BCE: negative values
 * - Historical CE/modern: positive values
 */
export function normalizeTime(input: TimeInput): NormalizedTime {
  // Handle string (ISO 8601 date string)
  if (typeof input === 'string') {
    const date = new Date(input);
    return dateToYears(date);
  }

  // Handle Date object
  if (input instanceof Date) {
    return dateToYears(input);
  }

  // Handle { year: number; era: 'BCE' | 'CE' }
  if ('year' in input && 'era' in input) {
    return input.era === 'CE' ? input.year : -input.year;
  }

  // Handle { value: number; unit: 'mya' | 'years-ago' }
  if ('value' in input && 'unit' in input) {
    const currentYear = new Date().getFullYear();
    if (input.unit === 'mya') {
      // Million years ago
      return -(input.value * 1_000_000);
    } else {
      // Years ago from current year
      return currentYear - input.value;
    }
  }

  // Handle { localTime: string; timezone: string }
  if ('localTime' in input && 'timezone' in input) {
    // For now, parse as ISO string
    // TODO: Implement proper timezone handling
    const date = new Date(input.localTime);
    return dateToYears(date);
  }

  throw new Error(`Unsupported time input format: ${JSON.stringify(input)}`);
}

/**
 * Convert a JavaScript Date to years from 0 CE
 */
function dateToYears(date: Date): NormalizedTime {
  // Check if the date is valid
  const timestamp = date.getTime();
  if (isNaN(timestamp)) {
    throw new Error('Invalid date');
  }

  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1).getTime();
  const endOfYear = new Date(year + 1, 0, 1).getTime();
  const yearProgress = (timestamp - startOfYear) / (endOfYear - startOfYear);

  return year + yearProgress;
}

/**
 * Format a normalized time for display
 */
export function formatTime(
  normalizedTime: NormalizedTime,
  scale: 'geological' | 'prehistoric' | 'historical' | 'modern' | 'precise'
): string {
  if (normalizedTime < -1_000_000) {
    // Geological scale (millions of years)
    const mya = Math.abs(normalizedTime) / 1_000_000;
    return `${mya.toFixed(1)} MYA`;
  } else if (normalizedTime < -10_000) {
    // Prehistoric scale (thousands of years ago)
    const kya = Math.abs(normalizedTime) / 1_000;
    return `${kya.toFixed(1)} KYA`;
  } else if (normalizedTime < 0) {
    // Historical BCE
    return `${Math.abs(Math.floor(normalizedTime))} BCE`;
  } else if (normalizedTime < 1000) {
    // Early CE
    return `${Math.floor(normalizedTime)} CE`;
  } else {
    // Modern era
    const year = Math.floor(normalizedTime);
    if (scale === 'precise') {
      const date = yearsToDate(normalizedTime);
      return date.toISOString();
    }
    return year.toString();
  }
}

/**
 * Convert years from 0 CE back to a JavaScript Date
 */
function yearsToDate(years: NormalizedTime): Date {
  const year = Math.floor(years);
  const yearProgress = years - year;
  const startOfYear = new Date(year, 0, 1).getTime();
  const endOfYear = new Date(year + 1, 0, 1).getTime();
  const timestamp = startOfYear + yearProgress * (endOfYear - startOfYear);

  return new Date(timestamp);
}

/**
 * Determine the appropriate time scale based on the range
 */
export function determineTimeScale(
  startTime: NormalizedTime,
  endTime: NormalizedTime
): 'geological' | 'prehistoric' | 'historical' | 'modern' | 'precise' {
  const range = endTime - startTime;

  if (range > 1_000_000 || startTime < -1_000_000) {
    return 'geological';
  } else if (range > 10_000 || startTime < -10_000) {
    return 'prehistoric';
  } else if (range > 1_000) {
    return 'historical';
  } else if (range > 1) {
    return 'modern';
  } else {
    return 'precise';
  }
}

/**
 * Get the current time as normalized time (years from 0 CE)
 */
export function getCurrentTime(): NormalizedTime {
  return dateToYears(new Date());
}

/**
 * Check if a period is ongoing (has no defined end time)
 */
export function isOngoing(period: TimelinePeriod): boolean {
  return period.endTime === undefined || period.endTime === null;
}

/**
 * Normalize the end time of a period, treating undefined as "current time" for display
 * or a far future date for layout calculations
 *
 * @param endTime - The end time input (may be undefined for ongoing periods)
 * @param useInfinity - If true, return Infinity for undefined; otherwise use current time
 */
export function normalizeEndTime(endTime: TimeInput | undefined, useInfinity: boolean = false): NormalizedTime {
  if (endTime === undefined || endTime === null) {
    return useInfinity ? Infinity : getCurrentTime();
  }
  return normalizeTime(endTime);
}
