/**
 * Period layout algorithms registry
 */

import type { PeriodLayoutAlgorithm } from "../laneAssignment";
import { successionPeriodLayout } from "./successionPeriodLayout";

// Import debug algorithms - tree-shaking will remove them when __DEBUG__ is false
import { greedyPeriodLayout } from "./greedyPeriodLayout";
import { treePeriodLayout } from "./treePeriodLayout";

// Registry of all available period layout algorithms
// When __DEBUG__ is false, tree-shaking will remove unused algorithms
export const PERIOD_LAYOUT_ALGORITHMS: Record<string, PeriodLayoutAlgorithm> =
  /* @__PURE__ */ (() => {
    const algorithms: Record<string, PeriodLayoutAlgorithm> = {
      succession: successionPeriodLayout,
    };

    // In production builds (__DEBUG__ = false), debug algorithms are removed by tree-shaking
    if (__DEBUG__) {
      algorithms.greedy = greedyPeriodLayout;
      algorithms.tree = treePeriodLayout;
    }

    return algorithms;
  })();

// Default algorithm
export const DEFAULT_PERIOD_LAYOUT = "succession";

// Export types and event layout
export type { PeriodLayoutAlgorithm } from "../laneAssignment";
export { assignEventLanes } from "./eventLayout";
