/**
 * Lane assignment algorithm for timeline layout
 * Coordinates period and event layout using pluggable algorithms
 */

import type { TimelinePeriod, TimelineEvent, LaneAssignment } from '../core/types';
import { PERIOD_LAYOUT_ALGORITHMS, DEFAULT_PERIOD_LAYOUT, assignEventLanes } from './algorithms';

/**
 * Assign lanes to periods and events
 * Periods and events are assigned to separate lane groups using configurable algorithms
 */
export function assignLanes(
  periods: TimelinePeriod[],
  events: TimelineEvent[],
  periodLayoutAlgorithm: string = DEFAULT_PERIOD_LAYOUT
): LaneAssignment[] {
  // Get the period layout algorithm
  const algorithm = PERIOD_LAYOUT_ALGORITHMS[periodLayoutAlgorithm];
  if (!algorithm) {
    throw new Error(`Unknown period layout algorithm: ${periodLayoutAlgorithm}`);
  }

  // Assign periods using the selected algorithm
  const periodAssignments = algorithm.layout(periods);

  // Calculate the lane offset for events (after all period lanes)
  const maxPeriodLane = periodAssignments.length > 0
    ? Math.max(...periodAssignments.map(a => a.lane))
    : -1;
  const eventLaneOffset = maxPeriodLane + 1;

  // Assign events using the event layout algorithm
  const eventAssignments = assignEventLanes(events, eventLaneOffset);

  // Combine assignments
  return [...periodAssignments, ...eventAssignments];
}

/**
 * Get the total number of lanes required
 */
export function getLaneCount(assignments: LaneAssignment[]): number {
  if (assignments.length === 0) return 0;
  return Math.max(...assignments.map((a) => a.lane)) + 1;
}
