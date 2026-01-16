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
export { PERIOD_LAYOUT_ALGORITHMS, DEFAULT_PERIOD_LAYOUT } from './layout/algorithms';
export type { PeriodLayoutAlgorithm } from './layout/algorithms';
export { CONNECTOR_RENDERERS, DEFAULT_CONNECTOR } from './renderer/connectors';
export type { ConnectorRenderer, ConnectorRenderContext } from './renderer/connectors';
