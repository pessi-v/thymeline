/**
 * Lane assignment algorithm for timeline layout
 * Uses a greedy algorithm to assign periods to lanes without overlap
 */

import type { TimelinePeriod, TimelineEvent, LaneAssignment, NormalizedTime } from '../core/types';
import { normalizeTime } from '../utils/timeNormalization';

/**
 * Assign lanes to periods and events using a greedy algorithm
 * Periods and events are assigned to separate lane groups
 * 1. Sort items by start time
 * 2. For each item, find the first available lane where it fits without overlap
 * 3. If no lane available, create a new lane
 */
export function assignLanes(
  periods: TimelinePeriod[],
  events: TimelineEvent[]
): LaneAssignment[] {
  const assignments: LaneAssignment[] = [];

  // Assign periods to lanes first
  const periodItems = periods.map((period) => ({
    id: period.id,
    startTime: normalizeTime(period.startTime),
    endTime: normalizeTime(period.endTime),
  }));

  periodItems.sort((a, b) => a.startTime - b.startTime);

  const periodLanes: Array<{ endTime: NormalizedTime }> = [];

  for (const item of periodItems) {
    // Find the first available lane
    let assignedLane = -1;
    for (let i = 0; i < periodLanes.length; i++) {
      if (!overlaps(item.startTime, item.endTime, periodLanes[i]!.endTime)) {
        assignedLane = i;
        break;
      }
    }

    // If no lane available, create a new one
    if (assignedLane === -1) {
      assignedLane = periodLanes.length;
      periodLanes.push({ endTime: item.endTime });
    } else {
      periodLanes[assignedLane]!.endTime = item.endTime;
    }

    assignments.push({
      itemId: item.id,
      lane: assignedLane,
      startTime: item.startTime,
      endTime: item.endTime,
      type: 'period', // Mark as period
    });
  }

  // Assign events to their own lanes (starting after period lanes)
  // Events get 3 lanes allocated
  const eventItems = events.map((event) => {
    const time = normalizeTime(event.time);
    return {
      id: event.id,
      startTime: time,
      endTime: time,
    };
  });

  eventItems.sort((a, b) => a.startTime - b.startTime);

  const eventLanes: Array<{ endTime: NormalizedTime }> = [];
  const eventLaneOffset = periodLanes.length; // Events start after periods

  for (const item of eventItems) {
    // Find the first available lane within the 3 event lanes
    let assignedLane = -1;
    for (let i = 0; i < Math.min(eventLanes.length, 3); i++) {
      if (!overlaps(item.startTime, item.endTime, eventLanes[i]!.endTime)) {
        assignedLane = i;
        break;
      }
    }

    // If no lane available and we haven't used all 3 lanes, create a new one
    if (assignedLane === -1 && eventLanes.length < 3) {
      assignedLane = eventLanes.length;
      eventLanes.push({ endTime: item.endTime });
    } else if (assignedLane === -1) {
      // Use the lane with the earliest end time
      let earliestLane = 0;
      let earliestTime = eventLanes[0]!.endTime;
      for (let i = 1; i < 3; i++) {
        if (eventLanes[i]!.endTime < earliestTime) {
          earliestLane = i;
          earliestTime = eventLanes[i]!.endTime;
        }
      }
      assignedLane = earliestLane;
      eventLanes[assignedLane]!.endTime = item.endTime;
    } else {
      eventLanes[assignedLane]!.endTime = item.endTime;
    }

    assignments.push({
      itemId: item.id,
      lane: assignedLane + eventLaneOffset,
      startTime: item.startTime,
      endTime: item.endTime,
      type: 'event', // Mark as event
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
