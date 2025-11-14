/**
 * Thymeline - Interactive Timeline Renderer
 * Main entry point
 */

export { TimelineRenderer } from './renderer/TimelineRenderer';

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
export { assignLanes, getLaneCount } from './layout/laneAssignment';
export { validateTimelineData, formatValidationResult, BIG_BANG_TIME } from './utils/validation';
export type { ValidationResult, ValidationError } from './utils/validation';

// Default export
export { TimelineRenderer as default } from './renderer/TimelineRenderer';
