/**
 * Thymeline - NPM Package Entry Point
 * Minimal exports for published package
 */

export { TimelineRenderer } from './renderer/TimelineRenderer.package';

export type {
  TimelineData,
  TimelineEvent,
  TimelinePeriod,
  TimelineConnector,
  TimelineConfig,
  RendererOptions,
  RenderConstraints,
  TimeInput,
  NormalizedTime,
  LaneAssignment,
  ViewportState,
  ZoomCallback,
  PanCallback,
  ItemClickCallback,
  ItemHoverCallback,
} from './core/types';

export { normalizeTime, formatTime, determineTimeScale } from './utils/timeNormalization';
export { assignLanes, getLaneCount } from './layout/laneAssignment.package';
export { validateTimelineData, formatValidationResult, BIG_BANG_TIME } from './utils/validation';
export type { ValidationResult, ValidationError } from './utils/validation';

// Export only succession layout algorithm
export { successionPeriodLayout } from './layout/algorithms/successionPeriodLayout';
export type { PeriodLayoutAlgorithm } from './layout/algorithms/greedyPeriodLayout';

// Export only sigmoidHorizontalLimited connector
export { sigmoidHorizontalLimitedConnector } from './renderer/connectors/sigmoidHorizontalLimitedConnector';
export type { ConnectorRenderer, ConnectorRenderContext } from './renderer/connectors/types';

// Default export
export { TimelineRenderer as default } from './renderer/TimelineRenderer.package';
