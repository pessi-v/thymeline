/**
 * Event layout algorithm
 * Events are laid out in a separate section from periods
 */

import type { TimelineEvent, LaneAssignment, NormalizedTime } from '../../core/types';
import { normalizeTime } from '../../utils/timeNormalization';

/**
 * Check if an event overlaps with the last end time in a lane
 */
function overlaps(
  time: NormalizedTime,
  lastEndTime: NormalizedTime
): boolean {
  return time < lastEndTime;
}

/**
 * Assign events to lanes (limited to 3 lanes)
 * Events are treated as point-in-time items
 */
export function assignEventLanes(
  events: TimelineEvent[],
  laneOffset: number = 0
): LaneAssignment[] {
  const assignments: LaneAssignment[] = [];

  // Normalize events to point-in-time items
  const eventItems = events.map((event) => {
    const time = normalizeTime(event.time);
    return {
      id: event.id,
      time,
    };
  });

  eventItems.sort((a, b) => a.time - b.time);

  // Track the latest end time for each event lane (max 3 lanes)
  const lanes: Array<{ endTime: NormalizedTime }> = [];

  for (const item of eventItems) {
    // Find the first available lane within the 3 event lanes
    let assignedLane = -1;
    for (let i = 0; i < Math.min(lanes.length, 3); i++) {
      if (!overlaps(item.time, lanes[i]!.endTime)) {
        assignedLane = i;
        break;
      }
    }

    // If no lane available and we haven't used all 3 lanes, create a new one
    if (assignedLane === -1 && lanes.length < 3) {
      assignedLane = lanes.length;
      lanes.push({ endTime: item.time });
    } else if (assignedLane === -1) {
      // Use the lane with the earliest end time
      let earliestLane = 0;
      let earliestTime = lanes[0]!.endTime;
      for (let i = 1; i < 3; i++) {
        if (lanes[i]!.endTime < earliestTime) {
          earliestLane = i;
          earliestTime = lanes[i]!.endTime;
        }
      }
      assignedLane = earliestLane;
      lanes[assignedLane]!.endTime = item.time;
    } else {
      lanes[assignedLane]!.endTime = item.time;
    }

    assignments.push({
      itemId: item.id,
      lane: assignedLane + laneOffset,
      startTime: item.time,
      endTime: item.time,
      type: 'event',
    });
  }

  return assignments;
}
