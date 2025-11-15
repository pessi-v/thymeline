/**
 * Greedy lane assignment algorithm for periods
 * Assigns periods to lanes without overlap using a greedy approach
 */

import type { TimelinePeriod, LaneAssignment, NormalizedTime } from '../../core/types';
import { normalizeTime } from '../../utils/timeNormalization';

export interface PeriodLayoutAlgorithm {
  name: string;
  description: string;
  layout(periods: TimelinePeriod[]): LaneAssignment[];
}

/**
 * Check if a period starts before the last end time in a lane
 */
function overlaps(
  start: NormalizedTime,
  lastEndTime: NormalizedTime
): boolean {
  return start < lastEndTime;
}

/**
 * Greedy layout algorithm for periods
 * 1. Sort periods by start time
 * 2. For each period, find the first available lane where it fits without overlap
 * 3. If no lane available, create a new lane
 */
export const greedyPeriodLayout: PeriodLayoutAlgorithm = {
  name: 'Greedy',
  description: 'Simple greedy algorithm - assigns periods to first available lane',

  layout(periods: TimelinePeriod[]): LaneAssignment[] {
    const assignments: LaneAssignment[] = [];

    // Normalize and sort periods by start time
    const periodItems = periods.map((period) => ({
      id: period.id,
      startTime: normalizeTime(period.startTime),
      endTime: normalizeTime(period.endTime),
    }));

    periodItems.sort((a, b) => a.startTime - b.startTime);

    // Track the latest end time for each lane
    const lanes: Array<{ endTime: NormalizedTime }> = [];

    for (const item of periodItems) {
      // Find the first available lane
      let assignedLane = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (!overlaps(item.startTime, lanes[i]!.endTime)) {
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
        type: 'period',
      });
    }

    return assignments;
  },
};
