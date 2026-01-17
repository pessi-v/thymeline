/**
 * Core type definitions for Thymeline
 */

/**
 * Flexible time input formats
 */
export type TimeInput =
  | string // ISO 8601 date string
  | Temporal.Instant // Temporal Instant for precise UTC timestamps
  | { year: number; era: 'BCE' | 'CE' }
  | { value: number; unit: 'mya' | 'years-ago' }
  | { localTime: string; timezone: string };

/**
 * Timeline event - represents a point in time
 */
export interface TimelineEvent {
  id: string;
  name: string;
  time: TimeInput;
  info?: string;
  metadata?: Record<string, any>;
}

/**
 * Timeline period - represents a span of time
 * If endTime is undefined, the period is considered "ongoing"
 */
export interface TimelinePeriod {
  id: string;
  name: string;
  startTime: TimeInput;
  endTime?: TimeInput; // Optional - undefined means "ongoing"
  info?: string;
  metadata?: Record<string, any>;
}

/**
 * Timeline connector - represents relationships between periods
 */
export interface TimelineConnector {
  id: string;
  fromId: string; // References period id
  toId: string; // References period id
  type: 'defined' | 'undefined'; // e.g., succession vs. lineage
  metadata?: Record<string, any>;
}

/**
 * Timeline configuration options
 */
export interface TimelineConfig {
  initialStartTime?: TimeInput;
  initialEndTime?: TimeInput;
  minZoom?: number;
  maxZoom?: number;
  theme?: 'light' | 'dark' | 'custom';
  constraints?: RenderConstraints;
}

/**
 * Complete timeline data structure
 */
export interface TimelineData {
  events: TimelineEvent[];
  periods: TimelinePeriod[];
  connectors: TimelineConnector[];
  config?: TimelineConfig;
}

/**
 * Rendering constraints for element sizing
 */
export interface RenderConstraints {
  minEventWidth: number; // Minimum pixel width for events
  maxEventWidth: number; // Maximum pixel width for events
  periodHeight: number; // Pixel height for periods
  laneHeight: number; // Vertical spacing between lanes
  laneGap: number; // Gap between lanes
}

/**
 * Renderer options
 */
export interface RendererOptions {
  width?: number; // Default: container width
  height?: number; // Default: container height
  initialStartTime?: TimeInput;
  initialEndTime?: TimeInput;
  minZoom?: number;
  maxZoom?: number;
  theme?: 'light' | 'dark' | 'custom';
  constraints?: RenderConstraints;
  periodLayoutAlgorithm?: string; // Default: 'succession'
  connectorRenderer?: string; // Default: 'sigmoid'
  showRowNumbers?: boolean; // Default: false
}

/**
 * Internal normalized time representation (years from 0 CE)
 */
export type NormalizedTime = number;

/**
 * Lane assignment for layout
 */
export interface LaneAssignment {
  itemId: string;
  lane: number;
  startTime: NormalizedTime;
  endTime: NormalizedTime;
  type?: 'period' | 'event';
}

/**
 * Viewport state
 */
export interface ViewportState {
  startTime: NormalizedTime;
  endTime: NormalizedTime;
  zoomLevel: number;
  centerTime: NormalizedTime;
}

/**
 * Event callbacks
 */
export type ZoomCallback = (zoomLevel: number) => void;
export type PanCallback = (centerTime: number) => void;
export type ItemClickCallback = (item: TimelineEvent | TimelinePeriod) => void;
export type ItemHoverCallback = (item: TimelineEvent | TimelinePeriod | null) => void;
