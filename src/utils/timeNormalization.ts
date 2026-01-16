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
    // Check if string has timezone info (Z or +/- offset)
    const hasTimezone = /Z|[+-]\d{2}:\d{2}$/.test(input);
    let instant: Temporal.Instant;

    if (hasTimezone) {
      instant = Temporal.Instant.from(input);
    } else {
      // No timezone - treat as UTC
      // First try as PlainDateTime, then as PlainDate
      try {
        const dateTime = Temporal.PlainDateTime.from(input);
        instant = dateTime.toZonedDateTime('UTC').toInstant();
      } catch {
        const date = Temporal.PlainDate.from(input);
        instant = date.toZonedDateTime('UTC').toInstant();
      }
    }
    return instantToYears(instant);
  }

  // Handle Temporal.Instant
  if (input instanceof Temporal.Instant) {
    return instantToYears(input);
  }

  // Handle { year: number; era: 'BCE' | 'CE' }
  if ('year' in input && 'era' in input) {
    return input.era === 'CE' ? input.year : -input.year;
  }

  // Handle { value: number; unit: 'mya' | 'years-ago' }
  if ('value' in input && 'unit' in input) {
    const currentYear = Temporal.Now.plainDateISO().year;
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
    // Parse local time in the specified timezone and convert to Instant
    const zonedDateTime = Temporal.PlainDateTime.from(input.localTime)
      .toZonedDateTime(input.timezone);
    return instantToYears(zonedDateTime.toInstant());
  }

  throw new Error(`Unsupported time input format: ${JSON.stringify(input)}`);
}

/**
 * Convert a Temporal.Instant to years from 0 CE
 */
function instantToYears(instant: Temporal.Instant): NormalizedTime {
  // Convert to ZonedDateTime in UTC to extract year and compute progress
  const utcDateTime = instant.toZonedDateTimeISO('UTC');
  const year = utcDateTime.year;

  // Calculate year progress (fraction through the year)
  const startOfYear = Temporal.ZonedDateTime.from({
    year,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    timeZone: 'UTC'
  });
  const startOfNextYear = Temporal.ZonedDateTime.from({
    year: year + 1,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    timeZone: 'UTC'
  });

  const yearDurationNs = startOfNextYear.epochNanoseconds - startOfYear.epochNanoseconds;
  const progressNs = instant.epochNanoseconds - startOfYear.toInstant().epochNanoseconds;
  const yearProgress = Number(progressNs) / Number(yearDurationNs);

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
      const instant = yearsToInstant(normalizedTime);
      return instant.toString();
    }
    if (scale === 'historical') {
      return `${year} CE`;
    }
    return year.toString();
  }
}

/**
 * Convert years from 0 CE back to a Temporal.Instant
 */
function yearsToInstant(years: NormalizedTime): Temporal.Instant {
  const year = Math.floor(years);
  const yearProgress = years - year;

  const startOfYear = Temporal.ZonedDateTime.from({
    year,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    timeZone: 'UTC'
  });
  const startOfNextYear = Temporal.ZonedDateTime.from({
    year: year + 1,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    timeZone: 'UTC'
  });

  const yearDurationNs = startOfNextYear.epochNanoseconds - startOfYear.epochNanoseconds;
  const progressNs = BigInt(Math.round(yearProgress * Number(yearDurationNs)));
  const targetNs = startOfYear.epochNanoseconds + progressNs;

  return Temporal.Instant.fromEpochNanoseconds(targetNs);
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
  return instantToYears(Temporal.Now.instant());
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
