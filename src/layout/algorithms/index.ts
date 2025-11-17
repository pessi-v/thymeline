/**
 * Period layout algorithms registry
 */

import type { PeriodLayoutAlgorithm } from './greedyPeriodLayout';
import { greedyPeriodLayout } from './greedyPeriodLayout';
import { treePeriodLayout } from './treePeriodLayout';

// Registry of all available period layout algorithms
export const PERIOD_LAYOUT_ALGORITHMS: Record<string, PeriodLayoutAlgorithm> = {
  greedy: greedyPeriodLayout,
  tree: treePeriodLayout,
};

// Default algorithm
export const DEFAULT_PERIOD_LAYOUT = 'greedy';

// Export types and event layout
export type { PeriodLayoutAlgorithm } from './greedyPeriodLayout';
export { assignEventLanes } from './eventLayout';
