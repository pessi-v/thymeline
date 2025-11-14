/**
 * Tests for lane assignment algorithm
 */

import { describe, it, expect } from 'vitest';
import { assignLanes, getLaneCount } from '../src/layout/laneAssignment';
import type { TimelinePeriod, TimelineEvent } from '../src/core/types';

describe('assignLanes', () => {
  it('should assign non-overlapping periods to the same lane', () => {
    const periods: TimelinePeriod[] = [
      {
        id: 'p1',
        name: 'Period 1',
        startTime: '2020-01-01',
        endTime: '2020-06-01',
      },
      {
        id: 'p2',
        name: 'Period 2',
        startTime: '2020-07-01',
        endTime: '2020-12-01',
      },
    ];

    const assignments = assignLanes(periods, []);
    expect(assignments).toHaveLength(2);
    expect(assignments[0]?.lane).toBe(0);
    expect(assignments[1]?.lane).toBe(0); // Should be in same lane
  });

  it('should assign overlapping periods to different lanes', () => {
    const periods: TimelinePeriod[] = [
      {
        id: 'p1',
        name: 'Period 1',
        startTime: '2020-01-01',
        endTime: '2020-12-01',
      },
      {
        id: 'p2',
        name: 'Period 2',
        startTime: '2020-06-01',
        endTime: '2021-06-01',
      },
    ];

    const assignments = assignLanes(periods, []);
    expect(assignments).toHaveLength(2);
    expect(assignments[0]?.lane).toBe(0);
    expect(assignments[1]?.lane).toBe(1); // Should be in different lane
  });

  it('should handle events as zero-duration periods', () => {
    const events: TimelineEvent[] = [
      {
        id: 'e1',
        name: 'Event 1',
        time: '2020-01-01',
      },
      {
        id: 'e2',
        name: 'Event 2',
        time: '2020-06-01',
      },
    ];

    const assignments = assignLanes([], events);
    expect(assignments).toHaveLength(2);
    expect(assignments[0]?.lane).toBe(0);
    expect(assignments[1]?.lane).toBe(0); // Non-overlapping events in same lane
  });
});

describe('getLaneCount', () => {
  it('should return correct lane count', () => {
    const assignments = [
      { itemId: '1', lane: 0, startTime: 0, endTime: 10 },
      { itemId: '2', lane: 1, startTime: 5, endTime: 15 },
      { itemId: '3', lane: 2, startTime: 10, endTime: 20 },
    ];

    expect(getLaneCount(assignments)).toBe(3);
  });

  it('should return 0 for empty assignments', () => {
    expect(getLaneCount([])).toBe(0);
  });
});
