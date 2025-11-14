/**
 * Lane assignment algorithm for timeline layout
 * Uses a greedy algorithm to assign periods to lanes without overlap
 */

import type { TimelinePeriod, TimelineEvent, LaneAssignment, NormalizedTime } from '../core/types';
import { normalizeTime } from '../utils/timeNormalization';

/**
 * Assign lanes to periods and events using a greedy algorithm
 * 1. Sort items by start time
 * 2. For each item, find the first available lane where it fits without overlap
 * 3. If no lane available, create a new lane
 */
export function assignLanes(
  periods: TimelinePeriod[],
  events: TimelineEvent[]
): LaneAssignment[] {
  // Convert events to period-like objects (zero-duration)
  const eventItems = events.map((event) => {
    const time = normalizeTime(event.time);
    return {
      id: event.id,
      startTime: time,
      endTime: time,
    };
  });

  const periodItems = periods.map((period) => ({
    id: period.id,
    startTime: normalizeTime(period.startTime),
    endTime: normalizeTime(period.endTime),
  }));

  // Combine and sort by start time
  const allItems = [...periodItems, ...eventItems].sort(
    (a, b) => a.startTime - b.startTime
  );

  const assignments: LaneAssignment[] = [];
  const lanes: Array<{ endTime: NormalizedTime }> = [];

  for (const item of allItems) {
    // Find the first available lane
    let assignedLane = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (!overlaps(item.startTime, item.endTime, lanes[i]!.endTime)) {
        assignedLane = i;
        break;
      }
    }

    // If no lane available, create a new one
    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push({ endTime: item.endTime });
    } else {
      lanes[assignedLane]!.endTime = item.endTime;
    }

    assignments.push({
      itemId: item.id,
      lane: assignedLane,
      startTime: item.startTime,
      endTime: item.endTime,
    });
  }

  return assignments;
}

/**
 * Check if two time ranges overlap
 */
function overlaps(
  start1: NormalizedTime,
  end1: NormalizedTime,
  lastEndTime: NormalizedTime
): boolean {
  return start1 < lastEndTime;
}

/**
 * Get the total number of lanes required
 */
export function getLaneCount(assignments: LaneAssignment[]): number {
  if (assignments.length === 0) return 0;
  return Math.max(...assignments.map((a) => a.lane)) + 1;
}
