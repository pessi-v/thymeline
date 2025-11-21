/**
 * Period layout algorithms registry
 */

import type { PeriodLayoutAlgorithm } from "./greedyPeriodLayout";
import { greedyPeriodLayout } from "./greedyPeriodLayout";
import { treePeriodLayout } from "./treePeriodLayout";
import { successionPeriodLayout } from "./successionPeriodLayout";

// Registry of all available period layout algorithms
export const PERIOD_LAYOUT_ALGORITHMS: Record<string, PeriodLayoutAlgorithm> = {
  succession: successionPeriodLayout,
  greedy: greedyPeriodLayout,
  tree: treePeriodLayout,
};

// Default algorithm
export const DEFAULT_PERIOD_LAYOUT = "greedy";

// Export types and event layout
export type { PeriodLayoutAlgorithm } from "./greedyPeriodLayout";
export { assignEventLanes } from "./eventLayout";
