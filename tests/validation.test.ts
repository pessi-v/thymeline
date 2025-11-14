/**
 * Tests for timeline validation
 */

import { describe, it, expect } from 'vitest';
import { validateTimelineData } from '../src/utils/validation';
import type { TimelineData } from '../src/core/types';

describe('validateTimelineData', () => {
  it('should pass validation for valid timeline data', () => {
    const data: TimelineData = {
      events: [
        { id: 'e1', name: 'Event 1', time: '2020-01-01' },
      ],
      periods: [
        {
          id: 'p1',
          name: 'Period 1',
          startTime: '2020-01-01',
          endTime: '2020-12-31',
        },
      ],
      connectors: [],
    };

    const result = validateTimelineData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect duplicate IDs', () => {
    const data: TimelineData = {
      events: [
        { id: 'duplicate', name: 'Event 1', time: '2020-01-01' },
      ],
      periods: [
        {
          id: 'duplicate',
          name: 'Period 1',
          startTime: '2020-01-01',
          endTime: '2020-12-31',
        },
      ],
      connectors: [],
    };

    const result = validateTimelineData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('Duplicate IDs');
  });

  it('should detect periods with start time after end time', () => {
    const data: TimelineData = {
      events: [],
      periods: [
        {
          id: 'p1',
          name: 'Invalid Period',
          startTime: '2020-12-31',
          endTime: '2020-01-01',
        },
      ],
      connectors: [],
    };

    const result = validateTimelineData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('start time after end time');
  });

  it('should detect connectors referencing non-existent periods', () => {
    const data: TimelineData = {
      events: [],
      periods: [
        {
          id: 'p1',
          name: 'Period 1',
          startTime: '2020-01-01',
          endTime: '2020-12-31',
        },
      ],
      connectors: [
        {
          id: 'c1',
          fromId: 'p1',
          toId: 'nonexistent',
          type: 'defined',
        },
      ],
    };

    const result = validateTimelineData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('non-existent period');
  });

  it('should warn about connectors connecting non-overlapping periods', () => {
    const data: TimelineData = {
      events: [],
      periods: [
        {
          id: 'p1',
          name: 'Later Period',
          startTime: '2020-01-01',
          endTime: '2020-12-31',
        },
        {
          id: 'p2',
          name: 'Earlier Period',
          startTime: '2019-01-01',
          endTime: '2019-06-01', // Ends before p1 starts
        },
      ],
      connectors: [
        {
          id: 'c1',
          fromId: 'p1', // Starts in 2020
          toId: 'p2', // Ends in 2019 (no overlap!)
          type: 'defined',
        },
      ],
    };

    const result = validateTimelineData(data);
    expect(result.valid).toBe(true); // Not an error, just a warning
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.message).toContain('starts');
    expect(result.warnings[0]?.message).toContain('after');
  });

  it('should allow connectors between overlapping periods without warning', () => {
    const data: TimelineData = {
      events: [],
      periods: [
        {
          id: 'p1',
          name: 'Period 1',
          startTime: '2020-01-01',
          endTime: '2020-06-01',
        },
        {
          id: 'p2',
          name: 'Period 2',
          startTime: '2020-05-01', // Overlaps with p1
          endTime: '2020-12-31',
        },
      ],
      connectors: [
        {
          id: 'c1',
          fromId: 'p1',
          toId: 'p2',
          type: 'defined',
        },
      ],
    };

    const result = validateTimelineData(data);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0); // No warning for overlapping periods
  });

  it('should detect invalid time formats', () => {
    const data: TimelineData = {
      events: [
        { id: 'e1', name: 'Bad Event', time: 'not-a-date' },
      ],
      periods: [],
      connectors: [],
    };

    const result = validateTimelineData(data);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('invalid time format');
  });
});
