/**
 * Main TimelineRenderer class
 */

import type {
  TimelineData,
  RendererOptions,
  TimelineEvent,
  TimelinePeriod,
  TimelineConnector,
  TimeInput,
  ZoomCallback,
  PanCallback,
  ItemClickCallback,
  ItemHoverCallback,
  ViewportState,
  LaneAssignment,
} from "../core/types";
import { getCurrentTime } from "../utils/timeNormalization";
import { assignLanes } from "../layout/laneAssignment";
import { BIG_BANG_TIME } from "../utils/validation";
import { CONNECTOR_RENDERERS, DEFAULT_CONNECTOR } from "./connectors";
import { InfoPopup } from "./InfoPopup";
import {
  createSvgElement,
  createTextElement,
  createLineElement,
  createRectElement,
  createCircleElement,
} from "./svgFactory";
import { Viewport } from "./Viewport";

/**
 * Bounds for an event's circle and potential label positions
 */
interface EventBounds {
  id: string;
  circleX: number;
  circleY: number;
  circleRadius: number;
  labelY: number;
  labelHeight: number;
  labelWidth: number;
  rightLabelX: number; // Left edge of right-side label
  leftLabelX: number; // Left edge of left-side label
  subLane: number; // Current sub-lane assignment
  row: number; // Row number
  isRelatedEvent: boolean; // Whether this event relates to a period
  labelPosition?: LabelPosition; // Actual label position (set when placed)
}

/**
 * Bounding box for connector collision detection
 */
interface ConnectorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Label position result after overlap detection
 */
type LabelPosition = "right" | "left" | "hidden";

export class TimelineRenderer {
  private container: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private data: TimelineData | null = null;
  private options: Required<RendererOptions>;
  private viewport: Viewport;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private laneAssignments: import("../core/types").LaneAssignment[] = [];
  private rowMapping: Map<string, number> = new Map();
  private infoPopup: InfoPopup | null = null;

  constructor(selector: string | HTMLElement, options: RendererOptions = {}) {
    // Get container element
    if (typeof selector === "string") {
      const element = document.querySelector(selector);
      if (!element || !(element instanceof HTMLElement)) {
        throw new Error(`Container element not found: ${selector}`);
      }
      this.container = element;
    } else {
      this.container = selector;
    }

    // Ensure container has relative positioning for info popup placement
    this.container.style.position = "relative";

    // Set default options
    this.options = {
      width: options.width ?? this.container.clientWidth,
      height: options.height ?? this.container.clientHeight,
      initialStartTime: options.initialStartTime ?? "1900-01-01",
      initialEndTime:
        options.initialEndTime ?? Temporal.Now.instant().toString(),
      minZoom: options.minZoom ?? 0.1,
      maxZoom: options.maxZoom ?? 1_000_000_000, // Support geological/astronomical to human timescales
      theme: options.theme ?? "light",
      constraints: options.constraints ?? {
        minEventWidth: 2,
        maxEventWidth: 20,
        periodHeight: 28,
        laneGap: 39,
      },
      periodLayoutAlgorithm: options.periodLayoutAlgorithm ?? "succession",
      connectorRenderer: options.connectorRenderer ?? DEFAULT_CONNECTOR,
      showRowNumbers: options.showRowNumbers ?? false,
    };

    // Initialize viewport
    this.viewport = new Viewport({
      width: this.options.width,
      minZoom: this.options.minZoom,
      maxZoom: this.options.maxZoom,
      initialStartTime: this.options.initialStartTime,
      initialEndTime: this.options.initialEndTime,
    });
  }

  /**
   * Render timeline with data
   */
  render(timelineData: TimelineData): void {
    this.data = timelineData;

    // Update viewport with data and fit to show all
    this.viewport.setData(timelineData);
    this.viewport.fitToData();

    // Assign lanes using the selected period layout algorithm
    const assignments = assignLanes(
      timelineData.periods,
      timelineData.events,
      this.options.periodLayoutAlgorithm,
      timelineData.connectors,
    );

    // Store assignments for rendering
    this.laneAssignments = assignments;

    // Build row mapping (normalize sparse lanes to dense rows)
    this.rowMapping = this.buildRowMapping();

    // Create SVG element (now that we know how many lanes we need)
    this.createSVG();

    // Render all elements
    this.renderTimeline();
  }

  /**
   * Zoom controls
   */
  zoomIn(): void {
    this.setZoomLevel(this.viewport.zoomLevel * 1.5);
  }

  zoomOut(): void {
    this.setZoomLevel(this.viewport.zoomLevel / 1.5);
  }

  zoomTo(startTime: TimeInput, endTime: TimeInput): void {
    this.viewport.zoomTo(startTime, endTime);
    this.updateView();
  }

  setZoomLevel(level: number, centerTime?: number): void {
    if (!this.data) return;

    const changed = this.viewport.setZoomLevel(level, centerTime);
    if (changed) {
      this.updateView();
      this.emit("zoom", this.viewport.zoomLevel);
    }
  }

  /**
   * Pan controls
   */
  panTo(centerTime: TimeInput): void {
    this.viewport.panTo(centerTime);
    this.updateView();
    this.emit("pan", this.viewport.centerTime);
  }

  panBy(deltaPixels: number): void {
    this.viewport.panBy(deltaPixels);
    this.updateView();
    this.emit("pan", this.viewport.centerTime);
  }

  /**
   * Data manipulation
   */
  addEvent(event: TimelineEvent): void {
    if (!this.data) return;
    this.data.events.push(event);
    this.render(this.data);
  }

  addPeriod(period: TimelinePeriod): void {
    if (!this.data) return;
    this.data.periods.push(period);
    this.render(this.data);
  }

  addConnector(connector: TimelineConnector): void {
    if (!this.data) return;
    this.data.connectors.push(connector);
    this.render(this.data);
  }

  removeItem(id: string): void {
    if (!this.data) return;
    this.data.events = this.data.events.filter((e) => e.id !== id);
    this.data.periods = this.data.periods.filter((p) => p.id !== id);
    this.data.connectors = this.data.connectors.filter((c) => c.id !== id);
    this.render(this.data);
  }

  updateItem(
    id: string,
    updates: Partial<TimelineEvent | TimelinePeriod>,
  ): void {
    if (!this.data) return;

    const event = this.data.events.find((e) => e.id === id);
    if (event) {
      Object.assign(event, updates);
    }

    const period = this.data.periods.find((p) => p.id === id);
    if (period) {
      Object.assign(period, updates);
    }

    this.render(this.data);
  }

  /**
   * Toggle row numbers visibility
   */
  setShowRowNumbers(show: boolean): void {
    this.options.showRowNumbers = show;
    this.renderTimeline();
  }

  /**
   * Export
   */
  toSVG(): string {
    return this.svg?.outerHTML ?? "";
  }

  async toPNG(): Promise<Blob> {
    // TODO: Implement PNG export
    throw new Error("PNG export not yet implemented");
  }

  destroy(): void {
    if (this.infoPopup) {
      this.infoPopup.destroy();
      this.infoPopup = null;
    }
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
    this.eventListeners.clear();
  }

  /**
   * Get current viewport state (for debugging)
   */
  getViewport(): Readonly<ViewportState> {
    return this.viewport.getState();
  }

  /**
   * Event handling
   */
  on(event: "zoom", callback: ZoomCallback): void;
  on(event: "pan", callback: PanCallback): void;
  on(event: "itemClick", callback: ItemClickCallback): void;
  on(event: "itemHover", callback: ItemHoverCallback): void;
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Private methods
   */
  private createSVG(): void {
    if (this.svg) {
      this.svg.remove();
    }

    // Calculate height based on actual number of rows used
    // Layout from top: unrelated events lane, sub-lane -1, periods with sub-lanes 0/1
    const numRows =
      this.rowMapping.size > 0 ? Math.max(...this.rowMapping.values()) + 1 : 1;
    const periodHeight = this.options.constraints.periodHeight;
    const rowGap = this.options.constraints.laneGap;
    const timeAxisOffset = 60;
    const subLaneHeight = rowGap / 3; // Each sub-lane takes 1/3 of the gap
    const unrelatedEventsLaneHeight = subLaneHeight; // Lane for unrelated events at very top
    const topSubLaneSpace = subLaneHeight; // 1 sub-lane above first period (for sub-lane -1)
    const bottomSubLaneSpace = subLaneHeight * 2; // 2 sub-lanes below last period
    const bottomPadding = 20;
    const calculatedHeight =
      timeAxisOffset +
      unrelatedEventsLaneHeight +
      topSubLaneSpace +
      numRows * (periodHeight + rowGap) +
      bottomSubLaneSpace +
      bottomPadding;
    const height = Math.max(this.options.height, calculatedHeight);

    this.svg = createSvgElement("svg", {
      width: this.options.width,
      height,
    });
    this.svg.style.border = "1px solid #ccc";
    this.svg.style.background = "#fff";
    this.svg.style.cursor = "grab";
    this.svg.style.userSelect = "none";

    // Add drag-to-pan support
    this.setupDragToPan();

    this.container.appendChild(this.svg);

    // Initialize info popup
    if (!this.infoPopup) {
      this.infoPopup = new InfoPopup(this.container);
    }
  }

  /**
   * Set up mouse drag to pan and double-click to zoom
   */
  private setupDragToPan(): void {
    if (!this.svg) return;

    let isDragging = false;
    let startX = 0;
    let startCenterTime = 0;
    let lastClickTime = 0;

    this.svg.addEventListener("mousedown", (e) => {
      const currentTime = Date.now();
      const timeSinceLastClick = currentTime - lastClickTime;

      // Check for double-click (within 300ms)
      if (timeSinceLastClick < 300) {
        // Double-click detected - zoom in centered on click position
        this.handleDoubleClick(e);
        lastClickTime = 0; // Reset to prevent triple-click
        return;
      }

      lastClickTime = currentTime;
      isDragging = true;
      startX = e.clientX;
      startCenterTime = this.viewport.centerTime;
      if (this.svg) {
        this.svg.style.cursor = "grabbing";
      }
    });

    this.svg.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const timeRange = this.viewport.endTime - this.viewport.startTime;
      const deltaTime = (-deltaX / this.options.width) * timeRange;
      const newCenterTime = startCenterTime + deltaTime;

      this.viewport.panTo(newCenterTime);
      this.updateView();
      this.emit("pan", this.viewport.centerTime);
    });

    const stopDragging = () => {
      if (isDragging && this.svg) {
        isDragging = false;
        this.svg.style.cursor = "grab";
      }
    };

    this.svg.addEventListener("mouseup", stopDragging);
    this.svg.addEventListener("mouseleave", stopDragging);

    // Add mouse wheel zoom support
    this.svg.addEventListener("wheel", (e) => {
      e.preventDefault();

      // Get the cursor position relative to the SVG
      const rect = this.svg!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;

      // Convert pixel position to time
      const cursorTime = this.viewport.xToTime(cursorX);

      // Calculate zoom factor proportional to scroll delta
      const sensitivity = 0.001;
      const zoomFactor = 1 + Math.abs(e.deltaY) * sensitivity;
      const newZoomLevel =
        e.deltaY < 0
          ? this.viewport.zoomLevel * zoomFactor
          : this.viewport.zoomLevel / zoomFactor;

      // Zoom centered on the cursor position
      this.setZoomLevel(newZoomLevel, cursorTime);
    });
  }

  /**
   * Handle double-click to zoom in centered on click position
   */
  private handleDoubleClick(e: MouseEvent): void {
    if (!this.svg) return;

    // Get the click position relative to the SVG
    const rect = this.svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    // Convert pixel position to time
    const clickedTime = this.viewport.xToTime(clickX);

    // Zoom in one level, centered on the clicked time
    const newZoomLevel = this.viewport.zoomLevel * 1.5;
    this.setZoomLevel(newZoomLevel, clickedTime);
  }

  private updateView(): void {
    if (this.data) {
      this.renderTimeline();
    }
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(...args));
    }
  }

  /**
   * Convert normalized time to pixel position
   */
  private timeToX(time: number): number {
    return this.viewport.timeToX(time);
  }

  /**
   * Convert lane assignments to sequential row numbers
   * This normalizes sparse lane assignments (e.g., 0, 1, 5, 10) to dense rows (0, 1, 2, 3)
   */
  private buildRowMapping(): Map<string, number> {
    const rowMap = new Map<string, number>();

    // Separate periods and events
    const periodAssignments = this.laneAssignments.filter(
      (a) => a.type === "period",
    );
    const eventAssignments = this.laneAssignments.filter(
      (a) => a.type === "event",
    );

    // Get unique lanes and sort them
    const periodLanes = [...new Set(periodAssignments.map((a) => a.lane))].sort(
      (a, b) => a - b,
    );

    // Map period lanes to sequential rows
    periodAssignments.forEach((assignment) => {
      const row = periodLanes.indexOf(assignment.lane);
      rowMap.set(assignment.itemId, row);
    });

    // Separate related events (whose lane matches a period lane) from unrelated events
    const periodLaneSet = new Set(periodLanes);
    const relatedEventAssignments = eventAssignments.filter((a) =>
      periodLaneSet.has(a.lane),
    );
    const unrelatedEventAssignments = eventAssignments.filter(
      (a) => !periodLaneSet.has(a.lane),
    );

    // Map related events to the same row as their corresponding period lane
    relatedEventAssignments.forEach((assignment) => {
      const row = periodLanes.indexOf(assignment.lane);
      rowMap.set(assignment.itemId, row);
    });

    // Map unrelated events to sequential rows (starting after periods)
    const periodRowCount = periodLanes.length;
    const unrelatedEventLanes = [
      ...new Set(unrelatedEventAssignments.map((a) => a.lane)),
    ].sort((a, b) => a - b);
    unrelatedEventAssignments.forEach((assignment) => {
      const eventRow = unrelatedEventLanes.indexOf(assignment.lane);
      const row = periodRowCount + eventRow;
      rowMap.set(assignment.itemId, row);
    });

    return rowMap;
  }

  /**
   * Get Y position for a row
   * Simple row-based positioning with configurable gaps
   * Layout: unrelated events lane -> sub-lane -1 -> periods with sub-lanes 0/1
   */
  private rowToY(row: number, type?: "period" | "event"): number {
    const periodHeight = this.options.constraints.periodHeight;
    const eventHeight = 20;
    const rowGap = this.options.constraints.laneGap;
    const timeAxisOffset = 60;
    const subLaneHeight = rowGap / 3;
    const unrelatedEventsLaneHeight = subLaneHeight; // Lane for unrelated events at very top
    const topSubLaneSpace = subLaneHeight; // 1 sub-lane above first period (for sub-lane -1)

    if (type === "period") {
      return timeAxisOffset + unrelatedEventsLaneHeight + topSubLaneSpace + row * (periodHeight + rowGap);
    } else {
      return timeAxisOffset + unrelatedEventsLaneHeight + topSubLaneSpace + row * (eventHeight + rowGap);
    }
  }

  /**
   * Get Y position for an event with sub-lane support
   * @param row The row number (same as period row for related events)
   * @param subLane The sub-lane (-1, 0, or 1) within the row's vertical space
   * @param isRelatedEvent Whether this event relates to a period
   */
  private eventToY(
    row: number,
    subLane: number,
    isRelatedEvent: boolean,
  ): number {
    const periodHeight = this.options.constraints.periodHeight;
    const rowGap = this.options.constraints.laneGap;
    const timeAxisOffset = 60;
    const subLaneHeight = rowGap / 3;
    const unrelatedEventsLaneHeight = subLaneHeight; // Lane for unrelated events at very top
    const topSubLaneSpace = subLaneHeight; // 1 sub-lane above first period (for sub-lane -1)

    if (isRelatedEvent) {
      // Calculate period Y position
      const periodY =
        timeAxisOffset + unrelatedEventsLaneHeight + topSubLaneSpace + row * (periodHeight + rowGap);

      if (subLane === -1) {
        // Position above the period (offset accounts for event height + clearance)
        return periodY - subLaneHeight - 4;
      } else {
        // Sub-lane 0 is just below period, sub-lane 1 is further below
        return periodY + periodHeight + subLane * subLaneHeight;
      }
    } else {
      // Unrelated events go in the very top lane (above all periods)
      return timeAxisOffset;
    }
  }

  /**
   * Main rendering method
   */
  private renderTimeline(): void {
    if (!this.svg || !this.data) return;

    // Clear existing content
    this.svg.innerHTML = "";

    // Render row numbers (if enabled)
    if (this.options.showRowNumbers) {
      this.renderRowNumbers();
    }

    // Render time axis
    this.renderTimeAxis();

    // Render undefined connectors first (behind all other elements)
    for (const connector of this.data.connectors) {
      if (connector.type === "undefined") {
        this.renderConnector(connector);
      }
    }

    // Render defined connectors (behind periods and events, but above undefined connectors)
    for (const connector of this.data.connectors) {
      if (connector.type !== "undefined") {
        this.renderConnector(connector);
      }
    }

    // Render periods
    for (const period of this.data.periods) {
      this.renderPeriod(period);
    }

    // Render events with smart label positioning
    this.renderEventsWithLabelPositioning(this.data.events);

    // Render today line marker
    this.renderTodayLine();
  }

  /**
   * Render row numbers for debugging
   */
  private renderRowNumbers(): void {
    if (!this.svg) return;

    const numRows =
      this.rowMapping.size > 0 ? Math.max(...this.rowMapping.values()) + 1 : 0;
    const periodHeight = this.options.constraints.periodHeight;

    for (let row = 0; row < numRows; row++) {
      // Determine if this row contains periods or events
      let isEventRow = true;
      for (const [itemId, itemRow] of this.rowMapping.entries()) {
        if (itemRow === row) {
          const assignment = this.laneAssignments.find(
            (a) => a.itemId === itemId,
          );
          if (assignment?.type === "period") {
            isEventRow = false;
            break;
          }
        }
      }

      const y = this.rowToY(row, isEventRow ? "event" : "period");

      // Row number background
      const rect = createRectElement(0, y, 30, periodHeight, {
        fill: "#f0f0f0",
        stroke: "#ccc",
        "stroke-width": 0.5,
      });
      this.svg.appendChild(rect);

      // Row number text
      const text = createTextElement(row.toString(), {
        x: 15,
        y: y + periodHeight / 2 + 4,
        "text-anchor": "middle",
        "font-size": 10,
        "font-family": "monospace",
      });
      this.svg.appendChild(text);
    }
  }

  /**
   * Render time axis
   */
  private renderTimeAxis(): void {
    if (!this.svg) return;

    // Background
    const bg = createRectElement(0, 0, this.options.width, 40, {
      id: "time-axis-background",
      fill: "#f8f9fa",
    });
    this.svg.appendChild(bg);

    // Render Big Bang boundary if visible
    this.renderBigBangBoundary();

    // Axis line
    const line = createLineElement(0, 40, this.options.width, 40, {
      "stroke-width": 2,
    });
    this.svg.appendChild(line);

    // Calculate tick positions with margin from edges
    const margin = 40; // Pixels from edge
    const usableWidth = this.options.width - margin * 2;
    const numMarkers = 10; // Increased from 5 to 10
    const timeRange = this.viewport.endTime - this.viewport.startTime;

    for (let i = 0; i <= numMarkers; i++) {
      // Calculate position with margin
      const pixelPosition = margin + (usableWidth / numMarkers) * i;

      // Calculate corresponding time value
      // Map pixel position back to time
      const timeProgress = (pixelPosition - 0) / this.options.width;
      const time = this.viewport.startTime + timeRange * timeProgress;

      // Tick mark
      const tick = createLineElement(pixelPosition, 40, pixelPosition, 50);
      this.svg.appendChild(tick);

      // Label (only if time is after Big Bang)
      if (time >= BIG_BANG_TIME) {
        const text = createTextElement(this.formatTimeLabel(time), {
          x: pixelPosition,
          y: 25,
          "text-anchor": "middle",
        });
        this.svg.appendChild(text);
      }
    }
  }

  /**
   * Render Big Bang boundary and static noise
   */
  private renderBigBangBoundary(): void {
    if (!this.svg) return;

    const bigBangX = this.timeToX(BIG_BANG_TIME);

    // Only render if Big Bang is visible in current viewport
    if (bigBangX < 0 || bigBangX > this.options.width) {
      return;
    }

    // Get SVG height
    const svgHeight = parseFloat(this.svg.getAttribute("height") || "500");

    // Create noise pattern
    const patternId = "static-noise-pattern";
    let defs = this.svg.querySelector("defs");
    if (!defs) {
      defs = createSvgElement("defs");
      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    // Remove existing pattern if it exists
    const existingPattern = defs.querySelector(`#${patternId}`);
    if (existingPattern) {
      existingPattern.remove();
    }

    // Create noise pattern using SVG filter
    const filter = createSvgElement("filter", {
      id: "noise-filter",
      x: 0,
      y: 0,
      width: "100%",
      height: "100%",
    });

    const turbulence = createSvgElement("feTurbulence", {
      type: "fractalNoise",
      baseFrequency: 2.5,
      numOctaves: 5,
      result: "noise",
    });

    const colorMatrix = createSvgElement("feColorMatrix", {
      in: "noise",
      type: "matrix",
      values: "0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1 0",
    });

    filter.appendChild(turbulence);
    filter.appendChild(colorMatrix);
    defs.appendChild(filter);

    // Render the noisy region (before Big Bang)
    if (bigBangX > 0) {
      const noiseRect = createRectElement(0, 40, bigBangX, svgHeight - 40, {
        fill: "#d0d0d0",
        filter: "url(#noise-filter)",
        opacity: 0.35,
      });
      this.svg.appendChild(noiseRect);

      // Draw vertical line at Big Bang (dashed and thicker)
      const bigBangLine = createLineElement(bigBangX, 40, bigBangX, svgHeight, {
        stroke: "#333",
        "stroke-width": 2,
        "stroke-dasharray": "5,5",
      });
      this.svg.appendChild(bigBangLine);

      // Add label for Big Bang
      const label = createTextElement("Big Bang", {
        x: bigBangX - 5,
        y: 55,
        "text-anchor": "end",
        "font-size": 10,
        "font-style": "italic",
      });
      this.svg.appendChild(label);
    }
  }

  /**
   * Render today line marker
   */
  private renderTodayLine(): void {
    if (!this.svg) return;

    const todayTime = getCurrentTime();
    const todayX = this.timeToX(todayTime);

    // Only render if today is visible in current viewport
    if (todayX < 0 || todayX > this.options.width) {
      return;
    }

    // Get SVG height
    const svgHeight = parseFloat(this.svg.getAttribute("height") || "500");

    // Draw vertical line at today (dashed)
    const todayLine = createLineElement(todayX, 40, todayX, svgHeight, {
      stroke: "#333",
      "stroke-width": 2,
      "stroke-dasharray": "5,5",
    });
    this.svg.appendChild(todayLine);

    // Add label for Today
    const label = createTextElement("Today", {
      x: todayX + 5,
      y: 55,
      "text-anchor": "start",
      "font-size": 10,
      "font-style": "italic",
    });
    this.svg.appendChild(label);
  }

  /**
   * Format time for axis labels
   */
  private formatTimeLabel(time: number): string {
    if (time < -1_000_000) {
      return `${(Math.abs(time) / 1_000_000).toFixed(0)}M BCE`;
    } else if (time < 0) {
      return `${Math.abs(Math.floor(time))} BCE`;
    } else if (time < 1000) {
      return `${Math.floor(time)} CE`;
    } else {
      return Math.floor(time).toString();
    }
  }

  /**
   * Format TimeInput for display in info popup
   */
  private formatTimeForDisplay(time: TimeInput): string {
    if (typeof time === "string") {
      // ISO 8601 string - parse and format nicely
      try {
        const date = new Date(time);
        return date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch {
        return time;
      }
    } else if (time instanceof Temporal.Instant) {
      const date = new Date(time.epochMilliseconds);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } else if ("unit" in time) {
      if (time.unit === "mya") {
        return `${time.value} million years ago`;
      } else if (time.unit === "years-ago") {
        return `${time.value} years ago`;
      } else if (time.unit === "bce") {
        return `${time.value} BCE`;
      } else if (time.unit === "ce") {
        return `${time.value} CE`;
      }
    } else if ("localTime" in time) {
      return `${time.localTime} (${time.timezone})`;
    }
    return String(time);
  }

  /**
   * Render a period as a rectangle
   */
  private renderPeriod(period: TimelinePeriod): void {
    if (!this.svg) return;

    const assignment = this.laneAssignments.find((a) => a.itemId === period.id);
    if (!assignment) return;

    const row = this.rowMapping.get(period.id);
    if (row === undefined) return;

    const startX = this.timeToX(assignment.startTime);
    // For ongoing periods (endTime = Infinity), render to current time
    const displayEndTime =
      assignment.endTime === Infinity ? getCurrentTime() : assignment.endTime;
    const endX = this.timeToX(displayEndTime);
    const y = this.rowToY(row, "period");
    const width = Math.max(2, endX - startX);
    const height = this.options.constraints.periodHeight;

    // Period rectangle with fully rounded ends
    const rect = createRectElement(startX, y, width, height, {
      id: period.id,
      fill: "#000",
      "fill-opacity": 1,
      stroke: "#000",
      "stroke-width": 1,
      rx: 5,
      ry: height * 0.35,
    });

    // Add click handler for info popup
    rect.style.cursor = "pointer";
    rect.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.infoPopup) {
        const startLabel = this.formatTimeForDisplay(period.startTime);
        const endLabel = period.endTime
          ? this.formatTimeForDisplay(period.endTime)
          : "ongoing";
        let content = `${period.name}\n${startLabel} – ${endLabel}`;
        if (period.info) {
          content += `\n\n${period.info}`;
        }
        this.infoPopup.show(content, e.clientX, e.clientY);
      }
      this.emit("itemClick", period);
    });

    this.svg.appendChild(rect);

    // Label (if there's enough space)
    const labelShown = this.renderPeriodLabel(
      period.name,
      startX,
      y,
      width,
      height,
    );

    // Add hover label for periods with hidden labels
    if (!labelShown) {
      let hoverLabel: SVGTextElement | null = null;

      rect.addEventListener("mouseenter", () => {
        if (!this.svg) return;

        hoverLabel = createTextElement(period.name, {
          x: startX + width / 2,
          y: y + height + 14,
          "text-anchor": "middle",
          fill: "#000",
          "font-weight": "bold",
          "pointer-events": "none",
        });
        this.svg.appendChild(hoverLabel);
      });

      rect.addEventListener("mouseleave", () => {
        if (hoverLabel) {
          hoverLabel.remove();
          hoverLabel = null;
        }
      });
    }
  }

  /**
   * Render a period label, with two-line layout if needed
   * Returns true if label was shown, false if hidden
   */
  private renderPeriodLabel(
    name: string,
    startX: number,
    y: number,
    width: number,
    height: number,
  ): boolean {
    if (!this.svg) return false;

    const padding = 8; // Horizontal padding inside the period
    const availableWidth = width - padding * 2;

    if (availableWidth <= 0) return false;

    const centerX = startX + width / 2;
    const fontSize = 11;
    const lineHeight = fontSize + 2;

    // Create a temporary text element to measure text width
    const measureText = (str: string): number => {
      const temp = createTextElement(str, {
        x: 0,
        y: 0,
        "font-size": fontSize,
        "font-weight": "bold",
      });
      this.svg!.appendChild(temp);
      const bbox = temp.getBBox();
      temp.remove();
      return bbox.width;
    };

    // Try single line first
    const singleLineWidth = measureText(name);

    if (singleLineWidth <= availableWidth) {
      // Single line fits
      const text = createTextElement(name, {
        x: centerX,
        y: y + height / 2 + fontSize / 3,
        "text-anchor": "middle",
        "font-size": fontSize,
        fill: "#fff",
        "font-weight": "bold",
        "pointer-events": "none",
      });
      this.svg.appendChild(text);
      return true;
    }

    // Try two lines if there are multiple words
    const words = name.split(" ");
    if (words.length < 2) {
      // Single word that doesn't fit - don't show
      return false;
    }

    // Find the best split point (closest to middle)
    let bestSplit = 1;
    let bestMaxWidth = Infinity;

    for (let i = 1; i < words.length; i++) {
      const line1 = words.slice(0, i).join(" ");
      const line2 = words.slice(i).join(" ");
      const maxWidth = Math.max(measureText(line1), measureText(line2));

      if (maxWidth < bestMaxWidth) {
        bestMaxWidth = maxWidth;
        bestSplit = i;
      }
    }

    // Check if two lines fit
    if (bestMaxWidth > availableWidth) {
      // Even two lines don't fit - don't show
      return false;
    }

    const line1 = words.slice(0, bestSplit).join(" ");
    const line2 = words.slice(bestSplit).join(" ");

    // Render two lines
    const text1 = createTextElement(line1, {
      x: centerX,
      y: y + height / 2 - lineHeight / 2 + fontSize / 3,
      "text-anchor": "middle",
      "font-size": fontSize,
      fill: "#fff",
      "font-weight": "bold",
      "pointer-events": "none",
    });
    this.svg.appendChild(text1);

    const text2 = createTextElement(line2, {
      x: centerX,
      y: y + height / 2 + lineHeight / 2 + fontSize / 3,
      "text-anchor": "middle",
      "font-size": fontSize,
      fill: "#fff",
      "font-weight": "bold",
      "pointer-events": "none",
    });
    this.svg.appendChild(text2);

    return true;
  }

  /**
   * Calculate bounding boxes for all visible connectors for collision detection
   * Samples the connector paths at intervals and creates boxes around segments
   */
  private calculateConnectorBounds(): ConnectorBox[] {
    if (!this.data) return [];

    const boxes: ConnectorBox[] = [];
    const strokeWidth = 5; // Connector stroke width

    for (const connector of this.data.connectors) {
      const fromAssignment = this.laneAssignments.find(
        (a) => a.itemId === connector.fromId,
      );
      const toAssignment = this.laneAssignments.find(
        (a) => a.itemId === connector.toId,
      );

      if (!fromAssignment || !toAssignment) continue;

      // Calculate pixel widths to check visibility (same as renderConnector)
      const fromStartX = this.timeToX(fromAssignment.startTime);
      const fromEndX = this.timeToX(fromAssignment.endTime);
      const fromWidth = fromEndX - fromStartX;
      const toStartX = this.timeToX(toAssignment.startTime);
      const toEndX = this.timeToX(toAssignment.endTime);
      const toWidth = toEndX - toStartX;

      // Skip if either period is too small (same logic as renderConnector)
      if (fromWidth < 10 || toWidth < 10) continue;

      const fromRow = this.rowMapping.get(connector.fromId);
      const toRow = this.rowMapping.get(connector.toId);
      if (fromRow === undefined || toRow === undefined) continue;

      // Calculate connection points (matching connector renderer logic)
      const connectionTime = Math.min(
        fromAssignment.endTime,
        toAssignment.startTime,
      );
      let fromX = this.timeToX(connectionTime) - 5; // Adjusted like in connector
      const toX = this.timeToX(toAssignment.startTime) + 5;
      let fromY =
        this.rowToY(fromRow, fromAssignment.type) +
        this.options.constraints.periodHeight / 2;
      const toY =
        this.rowToY(toRow, toAssignment.type) +
        this.options.constraints.periodHeight / 2;

      // Adjust Y position on 'from' side based on relative position
      if (toY < fromY) {
        fromY = fromY - 5;
      } else if (toY > fromY) {
        fromY = fromY + 5;
      }

      // Sample the connector path and create bounding boxes
      const pathBoxes = this.sampleConnectorPath(
        fromX,
        fromY,
        toX,
        toY,
        strokeWidth,
      );
      boxes.push(...pathBoxes);
    }

    return boxes;
  }

  /**
   * Sample a connector path and create bounding boxes for collision detection
   */
  private sampleConnectorPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    strokeWidth: number,
  ): ConnectorBox[] {
    const boxes: ConnectorBox[] = [];
    const horizontalDistance = Math.abs(toX - fromX);
    const maxCurveDistance = 50;
    const padding = strokeWidth / 2 + 2; // Add some padding for collision buffer

    // Sigmoid function
    const sigmoid = (t: number) => 1 / (1 + Math.exp(-2 * t));

    // Generate sample points along the path
    const samplePoints: { x: number; y: number }[] = [];
    const limit = 3;
    const numSamples = 20;

    if (horizontalDistance <= maxCurveDistance) {
      // Full sigmoid curve
      for (let i = 0; i <= numSamples; i++) {
        const t = -limit + (i / numSamples) * (2 * limit);
        const normalizedT = (t + limit) / (2 * limit);
        const sigmoidValue = sigmoid(t);
        samplePoints.push({
          x: fromX + normalizedT * (toX - fromX),
          y: fromY + sigmoidValue * (toY - fromY),
        });
      }
    } else {
      // Sigmoid curve to maxCurveDistance, then straight line
      const isGoingRight = toX > fromX;
      const curveEndX = isGoingRight
        ? fromX + maxCurveDistance
        : fromX - maxCurveDistance;

      // Sample the sigmoid portion
      for (let i = 0; i <= numSamples; i++) {
        const t = -limit + (i / numSamples) * (2 * limit);
        const normalizedT = (t + limit) / (2 * limit);
        const sigmoidValue = sigmoid(t);
        samplePoints.push({
          x: fromX + normalizedT * (curveEndX - fromX),
          y: fromY + sigmoidValue * (toY - fromY),
        });
      }

      // Add the end point of the straight line
      samplePoints.push({ x: toX, y: toY });
    }

    // Create bounding boxes from consecutive sample points
    for (let i = 0; i < samplePoints.length - 1; i++) {
      const p1 = samplePoints[i]!;
      const p2 = samplePoints[i + 1]!;

      const minX = Math.min(p1.x, p2.x) - padding;
      const maxX = Math.max(p1.x, p2.x) + padding;
      const minY = Math.min(p1.y, p2.y) - padding;
      const maxY = Math.max(p1.y, p2.y) + padding;

      boxes.push({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }

    return boxes;
  }

  /**
   * Render all events with smart label positioning to avoid overlaps
   * Algorithm:
   * 1. Try current sub-lane + right label
   * 2. Try alternative sub-lanes (in preference order) with right then left label
   * 3. Try current sub-lane + left label
   * 4. Hide label (last resort)
   */
  private renderEventsWithLabelPositioning(events: TimelineEvent[]): void {
    if (!this.svg) return;

    const eventHeight = 20;
    const circleRadius = 4;
    const labelGap = 8; // Gap between circle and label
    const fontSize = 10;
    const charWidth = 6; // Approximate width per character at font-size 10
    const labelHeight = fontSize + 4; // Approximate label height

    // Calculate connector bounds for collision detection
    const connectorBoxes = this.calculateConnectorBounds();

    // Build a list of events with their assignments, sorted by time (left to right)
    const eventData: Array<{
      event: TimelineEvent;
      assignment: LaneAssignment;
      row: number;
      isRelatedEvent: boolean;
    }> = [];

    for (const event of events) {
      const assignment = this.laneAssignments.find(
        (a) => a.itemId === event.id,
      );
      if (!assignment) continue;

      const row = this.rowMapping.get(event.id);
      if (row === undefined) continue;

      eventData.push({
        event,
        assignment,
        row,
        isRelatedEvent: !!event.relates_to,
      });
    }

    // Sort by time (left to right)
    eventData.sort((a, b) => a.assignment.startTime - b.assignment.startTime);

    // Track all placed event bounds (updated as we place events)
    const placedBounds: EventBounds[] = [];

    // Track sub-lane end times per row for time overlap detection
    const subLaneEndTimes = new Map<string, number>(); // "row:subLane" -> endTime

    // Final positions for rendering
    const finalPositions = new Map<
      string,
      { subLane: number; labelPosition: LabelPosition }
    >();

    // Sub-lane preference order for related events
    const subLanePreference = [0, 1, -1];

    for (const { event, assignment, row, isRelatedEvent } of eventData) {
      const x = this.timeToX(assignment.startTime);
      const originalSubLane = assignment.subLane ?? 0;
      const labelWidth = event.name.length * charWidth;

      // Helper to calculate bounds for a given sub-lane
      const calcBounds = (subLane: number): EventBounds => {
        const y = this.eventToY(row, subLane, isRelatedEvent);
        const circleY = y + eventHeight / 2;
        return {
          id: event.id,
          circleX: x,
          circleY,
          circleRadius,
          labelY: circleY - labelHeight / 2,
          labelHeight,
          labelWidth,
          rightLabelX: x + labelGap,
          leftLabelX: x - labelGap - labelWidth,
          subLane,
          row,
          isRelatedEvent,
        };
      };

      // Helper to check if a sub-lane has time overlap with existing events
      const hasTimeOverlap = (subLane: number): boolean => {
        const key = `${row}:${subLane}`;
        const endTime = subLaneEndTimes.get(key);
        return endTime !== undefined && assignment.startTime < endTime;
      };

      // Helper to try a position (sub-lane + label position)
      const tryPosition = (
        subLane: number,
        labelPos: "right" | "left",
      ): boolean => {
        // Skip if this sub-lane has time overlap
        if (hasTimeOverlap(subLane)) {
          return false;
        }

        const bounds = calcBounds(subLane);
        const overlaps = this.checkLabelOverlap(
          bounds,
          labelPos,
          placedBounds,
          connectorBoxes,
        );
        return !overlaps;
      };

      let chosenSubLane = originalSubLane;
      let chosenLabelPosition: LabelPosition = "right";
      let foundPosition = false;

      if (isRelatedEvent) {
        // Step 1: Try original sub-lane + right label
        if (tryPosition(originalSubLane, "right")) {
          chosenSubLane = originalSubLane;
          chosenLabelPosition = "right";
          foundPosition = true;
        }

        // Step 2: Try alternative sub-lanes (in preference order)
        if (!foundPosition) {
          for (const subLane of subLanePreference) {
            if (subLane === originalSubLane) continue; // Already tried

            // Try right label first
            if (tryPosition(subLane, "right")) {
              chosenSubLane = subLane;
              chosenLabelPosition = "right";
              foundPosition = true;
              break;
            }

            // Try left label
            if (tryPosition(subLane, "left")) {
              chosenSubLane = subLane;
              chosenLabelPosition = "left";
              foundPosition = true;
              break;
            }
          }
        }

        // Step 3: Try original sub-lane + left label
        if (!foundPosition && tryPosition(originalSubLane, "left")) {
          chosenSubLane = originalSubLane;
          chosenLabelPosition = "left";
          foundPosition = true;
        }

        // Step 4: Fall back to hiding label
        if (!foundPosition) {
          chosenSubLane = originalSubLane;
          chosenLabelPosition = "hidden";
        }
      } else {
        // Unrelated events: use simpler logic (no sub-lane switching)
        const bounds = calcBounds(originalSubLane);
        const rightOverlaps = this.checkLabelOverlap(
          bounds,
          "right",
          placedBounds,
          connectorBoxes,
        );

        if (!rightOverlaps) {
          chosenLabelPosition = "right";
        } else {
          const leftOverlaps = this.checkLabelOverlap(
            bounds,
            "left",
            placedBounds,
            connectorBoxes,
          );
          chosenLabelPosition = leftOverlaps ? "hidden" : "left";
        }
        chosenSubLane = originalSubLane;
      }

      // Record the final position
      finalPositions.set(event.id, {
        subLane: chosenSubLane,
        labelPosition: chosenLabelPosition,
      });

      // Add to placed bounds with the chosen label position
      const finalBounds = calcBounds(chosenSubLane);
      finalBounds.labelPosition = chosenLabelPosition;
      placedBounds.push(finalBounds);

      // Update sub-lane end time for time overlap tracking
      const key = `${row}:${chosenSubLane}`;
      const currentEndTime = subLaneEndTimes.get(key) ?? -Infinity;
      // Use a minimum width for time overlap (approximating label + circle width)
      const eventEndTime =
        assignment.startTime +
        ((labelWidth + labelGap + circleRadius * 2) / this.options.width) *
          (this.viewport.endTime - this.viewport.startTime);
      subLaneEndTimes.set(key, Math.max(currentEndTime, eventEndTime));
    }

    // Render all events with their determined positions
    for (const { event, row, isRelatedEvent } of eventData) {
      const position = finalPositions.get(event.id);
      if (!position) continue;

      this.renderEventWithSubLane(
        event,
        row,
        position.subLane,
        isRelatedEvent,
        position.labelPosition,
      );
    }
  }

  /**
   * Check if a label at the given position would overlap with other events, labels, or connectors
   */
  private checkLabelOverlap(
    bounds: EventBounds,
    position: "right" | "left",
    placedBounds: EventBounds[],
    connectorBoxes: ConnectorBox[],
  ): boolean {
    const labelX =
      position === "right" ? bounds.rightLabelX : bounds.leftLabelX;
    const labelRight = labelX + bounds.labelWidth;
    const labelTop = bounds.labelY;
    const labelBottom = bounds.labelY + bounds.labelHeight;

    // Also check the circle bounds
    const circleLeft = bounds.circleX - bounds.circleRadius;
    const circleRight = bounds.circleX + bounds.circleRadius;
    const circleTop = bounds.circleY - bounds.circleRadius;
    const circleBottom = bounds.circleY + bounds.circleRadius;

    // Check overlap with placed events and their labels
    for (const other of placedBounds) {
      if (other.id === bounds.id) continue;

      // Check if our circle overlaps with other's circle
      const otherCircleLeft = other.circleX - other.circleRadius;
      const otherCircleRight = other.circleX + other.circleRadius;
      const otherCircleTop = other.circleY - other.circleRadius;
      const otherCircleBottom = other.circleY + other.circleRadius;

      if (
        circleLeft < otherCircleRight &&
        circleRight > otherCircleLeft &&
        circleTop < otherCircleBottom &&
        circleBottom > otherCircleTop
      ) {
        return true; // Our circle overlaps with other's circle
      }

      // Check label overlap with other event's circle
      if (
        labelX < otherCircleRight &&
        labelRight > otherCircleLeft &&
        labelTop < otherCircleBottom &&
        labelBottom > otherCircleTop
      ) {
        return true; // Label overlaps with other's circle
      }

      // Check overlap with other event's label (if visible)
      if (other.labelPosition && other.labelPosition !== "hidden") {
        const otherLabelX =
          other.labelPosition === "right" ? other.rightLabelX : other.leftLabelX;
        const otherLabelRight = otherLabelX + other.labelWidth;
        const otherLabelTop = other.labelY;
        const otherLabelBottom = other.labelY + other.labelHeight;

        if (
          labelX < otherLabelRight &&
          labelRight > otherLabelX &&
          labelTop < otherLabelBottom &&
          labelBottom > otherLabelTop
        ) {
          return true; // Overlaps with other label
        }
      }
    }

    // Check overlap with connector paths
    for (const box of connectorBoxes) {
      const boxRight = box.x + box.width;
      const boxBottom = box.y + box.height;

      // Check if label overlaps with connector box
      if (
        labelX < boxRight &&
        labelRight > box.x &&
        labelTop < boxBottom &&
        labelBottom > box.y
      ) {
        return true; // Label overlaps with connector
      }

      // Check if circle overlaps with connector box
      if (
        circleLeft < boxRight &&
        circleRight > box.x &&
        circleTop < boxBottom &&
        circleBottom > box.y
      ) {
        return true; // Circle overlaps with connector
      }
    }

    return false;
  }

  /**
   * Render an event with a specific sub-lane position
   * Used by the smart positioning algorithm
   */
  private renderEventWithSubLane(
    event: TimelineEvent,
    row: number,
    subLane: number,
    isRelatedEvent: boolean,
    labelPosition: LabelPosition = "right",
  ): void {
    if (!this.svg) return;

    const assignment = this.laneAssignments.find((a) => a.itemId === event.id);
    if (!assignment) return;

    const x = this.timeToX(assignment.startTime);
    const height = 20; // Event row height

    // Calculate Y position using the specified sub-lane
    const y = this.eventToY(row, subLane, isRelatedEvent);

    // Event marker (hollow circle, smaller)
    const circle = createCircleElement(x, y + height / 2, 4, {
      id: event.id,
      fill: "none",
      stroke: "#000",
      "stroke-width": 2,
    });

    // Add click handler for info popup
    circle.style.cursor = "pointer";
    circle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.infoPopup) {
        const timeLabel = this.formatTimeForDisplay(event.time);
        let content = `${event.name}\n${timeLabel}`;
        if (event.info) {
          content += `\n\n${event.info}`;
        }
        this.infoPopup.show(content, e.clientX, e.clientY);
      }
      this.emit("itemClick", event);
    });

    this.svg.appendChild(circle);

    // Label (only if not hidden)
    if (labelPosition !== "hidden") {
      const text = createTextElement(event.name, {
        x: labelPosition === "right" ? x + 8 : x - 8,
        y: y + height / 2 + 4,
        "text-anchor": labelPosition === "right" ? "start" : "end",
        "font-size": 10,
        fill: "#333",
        "pointer-events": "none",
      });
      this.svg.appendChild(text);
    }
  }

  /**
   * Render a connector between periods
   */
  private renderConnector(connector: TimelineConnector): void {
    if (!this.svg || !this.data) return;

    const fromAssignment = this.laneAssignments.find(
      (a) => a.itemId === connector.fromId,
    );
    const toAssignment = this.laneAssignments.find(
      (a) => a.itemId === connector.toId,
    );

    if (!fromAssignment || !toAssignment) return;

    // Calculate pixel widths of both periods
    const fromStartX = this.timeToX(fromAssignment.startTime);
    const fromEndX = this.timeToX(fromAssignment.endTime);
    const fromWidth = fromEndX - fromStartX;

    const toStartX = this.timeToX(toAssignment.startTime);
    const toEndX = this.timeToX(toAssignment.endTime);
    const toWidth = toEndX - toStartX;

    // Hide connector if either period is less than 10px wide
    if (fromWidth < 10 || toWidth < 10) {
      return;
    }

    const fromRow = this.rowMapping.get(connector.fromId);
    const toRow = this.rowMapping.get(connector.toId);
    if (fromRow === undefined || toRow === undefined) return;

    // Get the "from" period to extract its color
    const fromPeriod = this.data.periods.find((p) => p.id === connector.fromId);
    const periodColor = fromPeriod ? "#000" : "#f587f3"; // Default to black for periods

    // Calculate the connection point on the "from" period
    // If "to" starts before "from" ends (overlapping periods),
    // connect at the point where "to" begins, not at the end of "from"
    // This prevents connectors from going backward in time
    const connectionTime = Math.min(
      fromAssignment.endTime,
      toAssignment.startTime,
    );
    const fromX = this.timeToX(connectionTime);
    const toX = this.timeToX(toAssignment.startTime);
    const fromY =
      this.rowToY(fromRow, fromAssignment.type) +
      this.options.constraints.periodHeight / 2;
    const toY =
      this.rowToY(toRow, toAssignment.type) +
      this.options.constraints.periodHeight / 2;

    // Get the connector renderer
    const renderer = CONNECTOR_RENDERERS[this.options.connectorRenderer];
    if (!renderer) {
      console.warn(
        `Connector renderer not found: ${this.options.connectorRenderer}`,
      );
      return;
    }

    // Render using the selected connector renderer
    const elements = renderer.render({
      fromX,
      fromY,
      toX,
      toY,
      connectorType: connector.type,
      color: periodColor,
      opacity: 0.85,
    });

    // Append all elements to SVG and add connector ID
    elements.forEach((element) => {
      element.setAttribute("id", connector.id);
      this.svg!.appendChild(element);
    });
  }
}
