/**
 * Event layout algorithm
 * Events can be laid out in a separate section from periods,
 * or positioned below a specific period if they have a relates_to reference
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
 * Assign events to lanes
 * - Events with relates_to are assigned to the same lane as their related period
 * - Events without relates_to are assigned to lanes after all periods (limited to 3 lanes)
 */
export function assignEventLanes(
  events: TimelineEvent[],
  laneOffset: number = 0,
  periodAssignments: LaneAssignment[] = []
): LaneAssignment[] {
  const assignments: LaneAssignment[] = [];

  // Build a map of period id to lane assignment for quick lookup
  const periodLaneMap = new Map<string, number>();
  for (const assignment of periodAssignments) {
    periodLaneMap.set(assignment.itemId, assignment.lane);
  }

  // Separate events into related (have relates_to) and unrelated
  const relatedEvents: TimelineEvent[] = [];
  const unrelatedEvents: TimelineEvent[] = [];

  for (const event of events) {
    if (event.relates_to && periodLaneMap.has(event.relates_to)) {
      relatedEvents.push(event);
    } else {
      unrelatedEvents.push(event);
    }
  }

  // Assign related events to the same lane as their related period
  for (const event of relatedEvents) {
    const periodLane = periodLaneMap.get(event.relates_to!)!;
    const time = normalizeTime(event.time);
    assignments.push({
      itemId: event.id,
      lane: periodLane,
      startTime: time,
      endTime: time,
      type: 'event',
    });
  }

  // Assign unrelated events using the original algorithm
  const eventItems = unrelatedEvents.map((event) => {
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
