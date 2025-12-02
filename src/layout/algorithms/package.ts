/**
 * Minimal period layout algorithms registry for package distribution
 * Only includes succession-based layout
 */

import type { PeriodLayoutAlgorithm } from "./greedyPeriodLayout";
import { successionPeriodLayout } from "./successionPeriodLayout";

// Registry of all available period layout algorithms
export const PERIOD_LAYOUT_ALGORITHMS: Record<string, PeriodLayoutAlgorithm> = {
  succession: successionPeriodLayout,
};

// Default algorithm
export const DEFAULT_PERIOD_LAYOUT = "succession";

// Export types and event layout
export type { PeriodLayoutAlgorithm } from "./greedyPeriodLayout";
export { assignEventLanes } from "./eventLayout";
