/**
 * Viewport management for timeline rendering
 * Handles coordinate transforms, zoom, and pan operations
 */

import type {
  TimelineData,
  TimeInput,
  ViewportState,
} from "../core/types";
import {
  normalizeTime,
  normalizeEndTime,
} from "../utils/timeNormalization";

export interface ViewportOptions {
  width: number;
  minZoom: number;
  maxZoom: number;
  initialStartTime: TimeInput;
  initialEndTime: TimeInput;
}

export class Viewport {
  private state: ViewportState;
  private data: TimelineData | null = null;

  constructor(private options: ViewportOptions) {
    const startTime = normalizeTime(options.initialStartTime);
    const endTime = normalizeTime(options.initialEndTime);

    this.state = {
      startTime,
      endTime,
      zoomLevel: 1,
      centerTime: (startTime + endTime) / 2,
    };
  }

  /**
   * Get current viewport state (read-only copy)
   */
  getState(): Readonly<ViewportState> {
    return { ...this.state };
  }

  /**
   * Get current start time
   */
  get startTime(): number {
    return this.state.startTime;
  }

  /**
   * Get current end time
   */
  get endTime(): number {
    return this.state.endTime;
  }

  /**
   * Get current zoom level
   */
  get zoomLevel(): number {
    return this.state.zoomLevel;
  }

  /**
   * Get current center time
   */
  get centerTime(): number {
    return this.state.centerTime;
  }

  /**
   * Update the canvas width (e.g., on resize)
   */
  setWidth(width: number): void {
    this.options.width = width;
  }

  /**
   * Set the timeline data for bounds calculations
   */
  setData(data: TimelineData): void {
    this.data = data;
  }

  /**
   * Reset viewport to show the full data range
   */
  fitToData(): void {
    if (!this.data) return;

    const { minTime, maxTime } = this.calculateDataTimeRange(this.data);
    this.state.startTime = minTime;
    this.state.endTime = maxTime;
    this.state.centerTime = (minTime + maxTime) / 2;
    this.state.zoomLevel = 1;
  }

  /**
   * Convert normalized time to pixel position
   */
  timeToX(time: number): number {
    const timeRange = this.state.endTime - this.state.startTime;
    const pixelPerYear = this.options.width / timeRange;
    return (time - this.state.startTime) * pixelPerYear;
  }

  /**
   * Convert pixel position to time
   */
  xToTime(x: number): number {
    const timeRange = this.state.endTime - this.state.startTime;
    const timeProgress = x / this.options.width;
    return this.state.startTime + timeRange * timeProgress;
  }

  /**
   * Zoom to a specific time range
   */
  zoomTo(startTime: TimeInput, endTime: TimeInput): void {
    this.state.startTime = normalizeTime(startTime);
    this.state.endTime = normalizeTime(endTime);
    this.state.centerTime = (this.state.startTime + this.state.endTime) / 2;
    this.state.zoomLevel = 1;
  }

  /**
   * Set zoom level, optionally centered on a specific time
   * Returns true if zoom changed, false if it hit limits
   */
  setZoomLevel(level: number, centerTime?: number): boolean {
    if (!this.data) return false;

    const oldZoomLevel = this.state.zoomLevel;
    const oldRange = this.state.endTime - this.state.startTime;

    // If centerTime is provided, use it; otherwise keep current center
    const targetCenter = centerTime ?? this.state.centerTime;

    // Calculate the maximum zoom out level (showing all data)
    const { minTime, maxTime } = this.calculateDataTimeRange(this.data);
    const fullDataRange = maxTime - minTime;

    // Calculate the minimum zoom level that shows all data
    const currentViewRange = this.state.endTime - this.state.startTime;
    const dynamicMinZoom = Math.min(
      this.options.minZoom,
      oldZoomLevel * (currentViewRange / fullDataRange),
    );

    // Calculate the maximum zoom in level (shortest period occupies 10% of canvas)
    const shortestPeriod = this.findShortestPeriod();
    let dynamicMaxZoom = this.options.maxZoom;
    if (shortestPeriod !== null) {
      const minTimeRange = shortestPeriod * 10;
      dynamicMaxZoom = Math.min(
        this.options.maxZoom,
        fullDataRange / minTimeRange,
      );
    }

    // Clamp the new zoom level
    const newZoomLevel = Math.max(
      dynamicMinZoom,
      Math.min(dynamicMaxZoom, level),
    );

    // If zoom level didn't change (hit limits), don't update
    if (newZoomLevel === oldZoomLevel) {
      return false;
    }

    this.state.zoomLevel = newZoomLevel;

    // Adjust time range based on zoom level change (inverse relationship)
    let newRange = oldRange * (oldZoomLevel / newZoomLevel);

    // Ensure we don't zoom out beyond the full data range
    newRange = Math.min(newRange, fullDataRange * 1.05);

    // Center on target time and update viewport bounds
    this.state.centerTime = targetCenter;
    this.state.startTime = targetCenter - newRange / 2;
    this.state.endTime = targetCenter + newRange / 2;

    // Apply pan limits
    this.clampPanPosition();
    this.recalculateViewportBounds();

    return true;
  }

  /**
   * Pan to a specific center time (normalized number or TimeInput)
   */
  panTo(centerTime: number | TimeInput): void {
    this.state.centerTime =
      typeof centerTime === "number" ? centerTime : normalizeTime(centerTime);
    this.clampPanPosition();
    this.recalculateViewportBounds();
  }

  /**
   * Pan by a pixel delta
   */
  panBy(deltaPixels: number): void {
    const timeRange = this.state.endTime - this.state.startTime;
    const deltaTime = (deltaPixels / this.options.width) * timeRange;
    this.state.centerTime += deltaTime;
    this.clampPanPosition();
    this.recalculateViewportBounds();
  }

  /**
   * Calculate the time range that encompasses all data
   */
  calculateDataTimeRange(data: TimelineData): {
    minTime: number;
    maxTime: number;
  } {
    let minTime = Infinity;
    let maxTime = -Infinity;

    // Check all events
    for (const event of data.events) {
      const time = normalizeTime(event.time);
      minTime = Math.min(minTime, time);
      maxTime = Math.max(maxTime, time);
    }

    // Check all periods
    for (const period of data.periods) {
      const startTime = normalizeTime(period.startTime);
      const endTime = normalizeEndTime(period.endTime, false);
      minTime = Math.min(minTime, startTime);
      maxTime = Math.max(maxTime, endTime);
    }

    // If no data, use default range
    if (minTime === Infinity || maxTime === -Infinity) {
      minTime = normalizeTime(this.options.initialStartTime);
      maxTime = normalizeTime(this.options.initialEndTime);
    }

    // Add padding (2.5% on each side)
    const range = maxTime - minTime;
    const padding = range * 0.025;

    return {
      minTime: minTime - padding,
      maxTime: maxTime + padding,
    };
  }

  /**
   * Find the shortest period duration in the data
   */
  private findShortestPeriod(): number | null {
    if (!this.data || this.data.periods.length === 0) {
      return null;
    }

    let shortestDuration = Infinity;

    for (const period of this.data.periods) {
      if (period.endTime === undefined || period.endTime === null) {
        continue;
      }

      const startTime = normalizeTime(period.startTime);
      const endTime = normalizeTime(period.endTime);
      const duration = endTime - startTime;

      if (duration > 0) {
        shortestDuration = Math.min(shortestDuration, duration);
      }
    }

    return shortestDuration === Infinity ? null : shortestDuration;
  }

  /**
   * Clamp pan position to prevent excessive empty space
   */
  private clampPanPosition(): void {
    if (!this.data) return;

    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const event of this.data.events) {
      const time = normalizeTime(event.time);
      minTime = Math.min(minTime, time);
      maxTime = Math.max(maxTime, time);
    }

    for (const period of this.data.periods) {
      const startTime = normalizeTime(period.startTime);
      const endTime = normalizeEndTime(period.endTime, false);
      minTime = Math.min(minTime, startTime);
      maxTime = Math.max(maxTime, endTime);
    }

    if (minTime === Infinity || maxTime === -Infinity) {
      return;
    }

    const timeRange = this.state.endTime - this.state.startTime;
    const maxEmptySpaceTime = timeRange * 0.15;

    const minCenterTime = minTime - maxEmptySpaceTime + timeRange / 2;
    const maxCenterTime = maxTime + maxEmptySpaceTime - timeRange / 2;

    this.state.centerTime = Math.max(
      minCenterTime,
      Math.min(maxCenterTime, this.state.centerTime),
    );
  }

  /**
   * Recalculate viewport start/end times based on center and current range
   */
  private recalculateViewportBounds(): void {
    const timeRange = this.state.endTime - this.state.startTime;
    this.state.startTime = this.state.centerTime - timeRange / 2;
    this.state.endTime = this.state.centerTime + timeRange / 2;
  }
}
