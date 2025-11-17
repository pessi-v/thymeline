/**
 * Validation utilities for timeline data
 */

import type { TimelineData } from '../core/types';
import { normalizeTime } from './timeNormalization';

export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  itemId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Big Bang time limit (13.8 billion years ago)
 */
export const BIG_BANG_TIME = -13_800_000_000;

/**
 * Validate timeline data for logical consistency
 */
export function validateTimelineData(data: TimelineData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check for duplicate IDs
  const allIds = [
    ...data.events.map((e) => e.id),
    ...data.periods.map((p) => p.id),
    ...data.connectors.map((c) => c.id),
  ];
  const duplicates = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    errors.push({
      type: 'error',
      message: `Duplicate IDs found: ${[...new Set(duplicates)].join(', ')}`,
    });
  }

  // Validate periods
  for (const period of data.periods) {
    try {
      const startTime = normalizeTime(period.startTime);
      const endTime = normalizeTime(period.endTime);

      if (startTime > endTime) {
        errors.push({
          type: 'error',
          message: `Period "${period.name}" has start time after end time`,
          itemId: period.id,
        });
      }

      // Check Big Bang limit
      if (startTime < BIG_BANG_TIME) {
        errors.push({
          type: 'error',
          message: `Period "${period.name}" starts before the Big Bang (13.8 billion years ago). Start time: ${startTime.toExponential(2)}`,
          itemId: period.id,
        });
      }
      if (endTime < BIG_BANG_TIME) {
        errors.push({
          type: 'error',
          message: `Period "${period.name}" ends before the Big Bang (13.8 billion years ago). End time: ${endTime.toExponential(2)}`,
          itemId: period.id,
        });
      }
    } catch (err) {
      errors.push({
        type: 'error',
        message: `Period "${period.name}" has invalid time format: ${err instanceof Error ? err.message : String(err)}`,
        itemId: period.id,
      });
    }
  }

  // Validate connectors
  for (const connector of data.connectors) {
    const fromPeriod = data.periods.find((p) => p.id === connector.fromId);
    const toPeriod = data.periods.find((p) => p.id === connector.toId);

    // Check that referenced periods exist
    if (!fromPeriod) {
      errors.push({
        type: 'error',
        message: `Connector "${connector.id}" references non-existent period: ${connector.fromId}`,
        itemId: connector.id,
      });
      continue;
    }

    if (!toPeriod) {
      errors.push({
        type: 'error',
        message: `Connector "${connector.id}" references non-existent period: ${connector.toId}`,
        itemId: connector.id,
      });
      continue;
    }

    // Check temporal logic: warn only if "from" period starts after "to" period ends
    // (overlapping periods are valid and handled by the renderer)
    try {
      const fromStartTime = normalizeTime(fromPeriod.startTime);
      const toEndTime = normalizeTime(toPeriod.endTime);

      if (fromStartTime > toEndTime) {
        const timeDiff = fromStartTime - toEndTime;
        warnings.push({
          type: 'warning',
          message: `Connector "${connector.id}" connects "${fromPeriod.name}" → "${toPeriod.name}", but "${fromPeriod.name}" starts ${timeDiff.toFixed(0)} years after "${toPeriod.name}" ends. The periods don't overlap in time.`,
          itemId: connector.id,
        });
      }
    } catch (err) {
      // Time parsing errors already caught in period validation
    }
  }

  // Validate events
  for (const event of data.events) {
    try {
      const time = normalizeTime(event.time);

      // Check Big Bang limit
      if (time < BIG_BANG_TIME) {
        errors.push({
          type: 'error',
          message: `Event "${event.name}" is set before the Big Bang (13.8 billion years ago). Time: ${time.toExponential(2)}`,
          itemId: event.id,
        });
      }
    } catch (err) {
      errors.push({
        type: 'error',
        message: `Event "${event.name}" has invalid time format: ${err instanceof Error ? err.message : String(err)}`,
        itemId: event.id,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation result as a human-readable string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid && result.warnings.length === 0) {
    lines.push('✓ Timeline data is valid');
    return lines.join('\n');
  }

  if (result.errors.length > 0) {
    lines.push('✗ Timeline validation failed:');
    lines.push('');
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  • ${error.message}`);
    }
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Warnings:');
    for (const warning of result.warnings) {
      lines.push(`  ⚠ ${warning.message}`);
    }
  }

  return lines.join('\n');
}
