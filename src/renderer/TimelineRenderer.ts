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
  RenderConstraints,
} from "../core/types";
import { normalizeTime } from "../utils/timeNormalization";
import { assignLanes } from "../layout/laneAssignment";
import { BIG_BANG_TIME } from "../utils/validation";

export class TimelineRenderer {
  private container: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private data: TimelineData | null = null;
  private options: Required<RendererOptions>;
  private viewport: ViewportState;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private laneAssignments: import("../core/types").LaneAssignment[] = [];

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

    // Set default options
    this.options = {
      width: options.width ?? this.container.clientWidth,
      height: options.height ?? this.container.clientHeight,
      initialStartTime: options.initialStartTime ?? "1900-01-01",
      initialEndTime: options.initialEndTime ?? new Date().toISOString(),
      minZoom: options.minZoom ?? 0.1,
      maxZoom: options.maxZoom ?? 100,
      theme: options.theme ?? "light",
      constraints: options.constraints ?? {
        minEventWidth: 2,
        maxEventWidth: 20,
        minPeriodHeight: 20,
        maxPeriodHeight: 60,
        laneHeight: 80,
        laneGap: 10,
      },
    };

    // Initialize viewport
    this.viewport = {
      startTime: normalizeTime(this.options.initialStartTime),
      endTime: normalizeTime(this.options.initialEndTime),
      zoomLevel: 1,
      centerTime: 0,
    };
    this.viewport.centerTime =
      (this.viewport.startTime + this.viewport.endTime) / 2;
  }

  /**
   * Render timeline with data
   */
  render(timelineData: TimelineData): void {
    this.data = timelineData;

    // Calculate the full time range of all data
    const { minTime, maxTime } = this.calculateDataTimeRange(timelineData);

    // Update viewport to show full range initially
    this.viewport.startTime = minTime;
    this.viewport.endTime = maxTime;
    this.viewport.centerTime = (minTime + maxTime) / 2;
    this.viewport.zoomLevel = 1;

    // Assign lanes
    const assignments = assignLanes(timelineData.periods, timelineData.events);

    // Store assignments for rendering
    this.laneAssignments = assignments;

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
    this.viewport.startTime = normalizeTime(startTime);
    this.viewport.endTime = normalizeTime(endTime);
    this.viewport.centerTime =
      (this.viewport.startTime + this.viewport.endTime) / 2;
    // Reset zoom level to 1 when explicitly setting time range
    this.viewport.zoomLevel = 1;
    this.updateView();
  }

  setZoomLevel(level: number, centerTime?: number): void {
    if (!this.data) return;

    const oldZoomLevel = this.viewport.zoomLevel;
    const oldRange = this.viewport.endTime - this.viewport.startTime;

    // If centerTime is provided, use it; otherwise keep current center
    const targetCenter =
      centerTime !== undefined ? centerTime : this.viewport.centerTime;

    // Calculate the maximum zoom out level (showing all data)
    const { minTime, maxTime } = this.calculateDataTimeRange(this.data);
    const fullDataRange = maxTime - minTime;

    // Calculate the minimum zoom level that shows all data
    const currentViewRange = this.viewport.endTime - this.viewport.startTime;
    const dynamicMinZoom = Math.min(
      this.options.minZoom,
      oldZoomLevel * (currentViewRange / fullDataRange)
    );

    // Clamp the new zoom level
    const newZoomLevel = Math.max(
      dynamicMinZoom,
      Math.min(this.options.maxZoom, level)
    );

    // If zoom level didn't change (hit limits), don't update
    if (newZoomLevel === oldZoomLevel) {
      return;
    }

    this.viewport.zoomLevel = newZoomLevel;

    // Adjust time range based on zoom level change (inverse relationship)
    // Higher zoom = smaller range (more zoomed in)
    let newRange = oldRange * (oldZoomLevel / newZoomLevel);

    // Ensure we don't zoom out beyond the full data range
    newRange = Math.min(newRange, fullDataRange * 1.05); // 5% padding

    // Center on target time
    this.viewport.centerTime = targetCenter;
    this.viewport.startTime = targetCenter - newRange / 2;
    this.viewport.endTime = targetCenter + newRange / 2;

    // Clamp viewport to not go beyond data range (with small padding)
    const padding = fullDataRange * 0.025; // 2.5% padding on each side
    if (this.viewport.startTime < minTime - padding) {
      const shift = minTime - padding - this.viewport.startTime;
      this.viewport.startTime += shift;
      this.viewport.endTime += shift;
      this.viewport.centerTime += shift;
    }
    if (this.viewport.endTime > maxTime + padding) {
      const shift = this.viewport.endTime - (maxTime + padding);
      this.viewport.startTime -= shift;
      this.viewport.endTime -= shift;
      this.viewport.centerTime -= shift;
    }

    this.updateView();
    this.emit("zoom", this.viewport.zoomLevel);
  }

  /**
   * Pan controls
   */
  panTo(centerTime: TimeInput): void {
    this.viewport.centerTime = normalizeTime(centerTime);
    this.recalculateViewportBounds();
    this.updateView();
    this.emit("pan", this.viewport.centerTime);
  }

  panBy(deltaPixels: number): void {
    const timeRange = this.viewport.endTime - this.viewport.startTime;
    const deltaTime = (deltaPixels / this.options.width) * timeRange;
    this.viewport.centerTime += deltaTime;
    this.recalculateViewportBounds();
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
    updates: Partial<TimelineEvent | TimelinePeriod>
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
    return { ...this.viewport };
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

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", this.options.width.toString());

    // Calculate height based on number of lanes
    const numLanes =
      this.laneAssignments.length > 0
        ? Math.max(...this.laneAssignments.map((a) => a.lane)) + 1
        : 1;
    const { laneHeight, laneGap } = this.options.constraints;
    const calculatedHeight = 60 + numLanes * (laneHeight + laneGap) + 20;
    const height = Math.max(this.options.height, calculatedHeight);

    this.svg.setAttribute("height", height.toString());
    this.svg.style.border = "1px solid #ccc";
    this.svg.style.background = "#fff";
    this.svg.style.cursor = "grab";

    // Add drag-to-pan support
    this.setupDragToPan();

    this.container.appendChild(this.svg);
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

      this.viewport.centerTime = startCenterTime + deltaTime;
      this.recalculateViewportBounds();
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
      const delta = e.deltaY;
      if (delta < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
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
    const clickedTime = this.xToTime(clickX);

    // Zoom in one level, centered on the clicked time
    const newZoomLevel = this.viewport.zoomLevel * 1.5;
    this.setZoomLevel(newZoomLevel, clickedTime);
  }

  /**
   * Convert pixel position to time
   */
  private xToTime(x: number): number {
    const timeRange = this.viewport.endTime - this.viewport.startTime;
    const timeProgress = x / this.options.width;
    return this.viewport.startTime + timeRange * timeProgress;
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
   * Calculate the time range that encompasses all data
   */
  private calculateDataTimeRange(data: TimelineData): {
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
      const endTime = normalizeTime(period.endTime);
      minTime = Math.min(minTime, startTime);
      maxTime = Math.max(maxTime, endTime);
    }

    // If no data, use default range
    if (minTime === Infinity || maxTime === -Infinity) {
      minTime = normalizeTime(this.options.initialStartTime);
      maxTime = normalizeTime(this.options.initialEndTime);
    }

    // Add a small padding (2.5% on each side)
    const range = maxTime - minTime;
    const padding = range * 0.025;

    return {
      minTime: minTime - padding,
      maxTime: maxTime + padding,
    };
  }

  /**
   * Recalculate viewport start/end times based on center and current range
   */
  private recalculateViewportBounds(): void {
    const timeRange = this.viewport.endTime - this.viewport.startTime;
    this.viewport.startTime = this.viewport.centerTime - timeRange / 2;
    this.viewport.endTime = this.viewport.centerTime + timeRange / 2;
  }

  /**
   * Convert normalized time to pixel position
   */
  private timeToX(time: number): number {
    const timeRange = this.viewport.endTime - this.viewport.startTime;
    const pixelPerYear = this.options.width / timeRange;
    return (time - this.viewport.startTime) * pixelPerYear;
  }

  /**
   * Get Y position for a lane
   * Layout pattern repeats: Period, Event, Event, Event, Period, Event, Event, Event, ...
   */
  private laneToY(lane: number, type?: "period" | "event"): number {
    const periodHeight = this.options.constraints.minPeriodHeight;
    const eventHeight = 20; // Height of event row
    const periodGap = 10; // Gap after period row
    const eventGap = 5; // Gap between event rows
    const blockGap = 15; // Gap after last event row before next period

    const timeAxisOffset = 60; // Offset for time axis at top

    // Each "block" = 1 period + 3 events
    // Block height = period + gap + 3*event + 2*eventGap + blockGap
    const blockHeight =
      periodHeight + periodGap + eventHeight * 3 + eventGap * 2 + blockGap;

    if (type === "period") {
      // Period lanes: each period starts a new block
      return timeAxisOffset + lane * blockHeight;
    } else {
      // Event lanes: 3 events per block
      const blockIndex = Math.floor(lane / 3);
      const eventIndexInBlock = lane % 3; // 0, 1, or 2

      const blockStartY = timeAxisOffset + blockIndex * blockHeight;
      const eventsStartY = blockStartY + periodHeight + periodGap;

      return eventsStartY + eventIndexInBlock * (eventHeight + eventGap);
    }
  }

  /**
   * Main rendering method
   */
  private renderTimeline(): void {
    if (!this.svg || !this.data) return;

    // Clear existing content
    this.svg.innerHTML = "";

    // Render time axis
    this.renderTimeAxis();

    // Render periods
    for (const period of this.data.periods) {
      this.renderPeriod(period);
    }

    // Render events
    for (const event of this.data.events) {
      this.renderEvent(event);
    }

    // Render connectors
    for (const connector of this.data.connectors) {
      this.renderConnector(connector);
    }
  }

  /**
   * Render time axis
   */
  private renderTimeAxis(): void {
    if (!this.svg) return;

    // Background
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", this.options.width.toString());
    bg.setAttribute("height", "40");
    bg.setAttribute("fill", "#f8f9fa");
    this.svg.appendChild(bg);

    // Render Big Bang boundary if visible
    this.renderBigBangBoundary();

    // Axis line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "40");
    line.setAttribute("x2", this.options.width.toString());
    line.setAttribute("y2", "40");
    line.setAttribute("stroke", "#666");
    line.setAttribute("stroke-width", "2");
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
      const tick = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      tick.setAttribute("x1", pixelPosition.toString());
      tick.setAttribute("y1", "40");
      tick.setAttribute("x2", pixelPosition.toString());
      tick.setAttribute("y2", "50");
      tick.setAttribute("stroke", "#666");
      tick.setAttribute("stroke-width", "1");
      this.svg.appendChild(tick);

      // Label (only if time is after Big Bang)
      if (time >= BIG_BANG_TIME) {
        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text"
        );
        text.setAttribute("x", pixelPosition.toString());
        text.setAttribute("y", "25");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "11");
        text.setAttribute("fill", "#666");
        text.textContent = this.formatTimeLabel(time);
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
      defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      this.svg.insertBefore(defs, this.svg.firstChild);
    }

    // Remove existing pattern if it exists
    const existingPattern = defs.querySelector(`#${patternId}`);
    if (existingPattern) {
      existingPattern.remove();
    }

    // Create noise pattern using SVG filter
    const filter = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "filter"
    );
    filter.setAttribute("id", "noise-filter");
    filter.setAttribute("x", "0");
    filter.setAttribute("y", "0");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");

    const turbulence = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "feTurbulence"
    );
    turbulence.setAttribute("type", "fractalNoise");
    turbulence.setAttribute("baseFrequency", "2.5");
    turbulence.setAttribute("numOctaves", "5");
    turbulence.setAttribute("result", "noise");

    const colorMatrix = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "feColorMatrix"
    );
    colorMatrix.setAttribute("in", "noise");
    colorMatrix.setAttribute("type", "matrix");
    colorMatrix.setAttribute(
      "values",
      "0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1 0"
    );

    filter.appendChild(turbulence);
    filter.appendChild(colorMatrix);
    defs.appendChild(filter);

    // Render the noisy region (before Big Bang)
    if (bigBangX > 0) {
      const noiseRect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect"
      );
      noiseRect.setAttribute("x", "0");
      noiseRect.setAttribute("y", "40");
      noiseRect.setAttribute("width", bigBangX.toString());
      noiseRect.setAttribute("height", (svgHeight - 40).toString());
      noiseRect.setAttribute("fill", "#d0d0d0");
      noiseRect.setAttribute("filter", "url(#noise-filter)");
      noiseRect.setAttribute("opacity", "0.35");
      this.svg.appendChild(noiseRect);

      // Draw vertical line at Big Bang (dashed and thicker)
      const bigBangLine = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      bigBangLine.setAttribute("x1", bigBangX.toString());
      bigBangLine.setAttribute("y1", "40");
      bigBangLine.setAttribute("x2", bigBangX.toString());
      bigBangLine.setAttribute("y2", svgHeight.toString());
      bigBangLine.setAttribute("stroke", "#333");
      bigBangLine.setAttribute("stroke-width", "2");
      bigBangLine.setAttribute("stroke-dasharray", "5,5");
      this.svg.appendChild(bigBangLine);

      // Add label for Big Bang
      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      label.setAttribute("x", (bigBangX - 5).toString());
      label.setAttribute("y", "55");
      label.setAttribute("text-anchor", "end");
      label.setAttribute("font-size", "10");
      label.setAttribute("fill", "#666");
      label.setAttribute("font-style", "italic");
      label.textContent = "Big Bang";
      this.svg.appendChild(label);
    }
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
   * Render a period as a rectangle
   */
  private renderPeriod(period: TimelinePeriod): void {
    if (!this.svg) return;

    const assignment = this.laneAssignments.find((a) => a.itemId === period.id);
    if (!assignment) return;

    const startX = this.timeToX(assignment.startTime);
    const endX = this.timeToX(assignment.endTime);
    const y = this.laneToY(assignment.lane, "period");
    const width = Math.max(2, endX - startX);
    const height = this.options.constraints.minPeriodHeight;

    // Period rectangle with fully rounded ends
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", startX.toString());
    rect.setAttribute("y", y.toString());
    rect.setAttribute("width", width.toString());
    rect.setAttribute("height", height.toString());
    rect.setAttribute("fill", "#000");
    rect.setAttribute("fill-opacity", "0.85");
    rect.setAttribute("stroke", "#000");
    rect.setAttribute("stroke-width", "1");
    rect.setAttribute("rx", (height / 2).toString()); // Fully rounded ends
    this.svg.appendChild(rect);

    // Label (if there's enough space)
    if (width > 40) {
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      text.setAttribute("x", (startX + width / 2).toString());
      text.setAttribute("y", (y + height / 2 + 4).toString());
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("font-size", "11");
      text.setAttribute("fill", "#fff");
      text.setAttribute("font-weight", "bold");
      text.textContent = period.name;
      this.svg.appendChild(text);
    }
  }

  /**
   * Render an event as a marker
   */
  private renderEvent(event: TimelineEvent): void {
    if (!this.svg) return;

    const assignment = this.laneAssignments.find((a) => a.itemId === event.id);
    if (!assignment) return;

    const x = this.timeToX(assignment.startTime);
    const y = this.laneToY(assignment.lane, "event");
    const height = 20; // Event row height

    // Event marker (hollow circle, smaller)
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("cx", x.toString());
    circle.setAttribute("cy", (y + height / 2).toString());
    circle.setAttribute("r", "4");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "#000");
    circle.setAttribute("stroke-width", "2");
    this.svg.appendChild(circle);

    // Label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", (x + 8).toString());
    text.setAttribute("y", (y + height / 2 + 4).toString());
    text.setAttribute("font-size", "10");
    text.setAttribute("fill", "#333");
    text.textContent = event.name;
    this.svg.appendChild(text);
  }

  /**
   * Render a connector between periods
   */
  private renderConnector(connector: TimelineConnector): void {
    if (!this.svg || !this.data) return;

    const fromAssignment = this.laneAssignments.find(
      (a) => a.itemId === connector.fromId
    );
    const toAssignment = this.laneAssignments.find(
      (a) => a.itemId === connector.toId
    );

    if (!fromAssignment || !toAssignment) return;

    // Calculate the connection point on the "from" period
    // If "to" starts before "from" ends (overlapping periods),
    // connect at the point where "to" begins, not at the end of "from"
    // This prevents connectors from going backward in time
    const connectionTime = Math.min(
      fromAssignment.endTime,
      toAssignment.startTime
    );
    const fromX = this.timeToX(connectionTime);
    const toX = this.timeToX(toAssignment.startTime);
    const fromY =
      this.laneToY(fromAssignment.lane, fromAssignment.type) +
      this.options.constraints.minPeriodHeight / 2;
    const toY =
      this.laneToY(toAssignment.lane, toAssignment.type) +
      this.options.constraints.minPeriodHeight / 2;

    // Simple line connector
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", fromX.toString());
    line.setAttribute("y1", fromY.toString());
    line.setAttribute("x2", toX.toString());
    line.setAttribute("y2", toY.toString());
    line.setAttribute("stroke", "#6c757d");
    line.setAttribute("stroke-width", "2");

    if (connector.type === "undefined") {
      line.setAttribute("stroke-dasharray", "5,5");
      line.setAttribute("stroke-opacity", "0.5");
    } else {
      line.setAttribute("stroke-opacity", "0.7");
    }

    this.svg.appendChild(line);

    // Arrow head
    const arrowSize = 6;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const arrowX1 = toX - arrowSize * Math.cos(angle - Math.PI / 6);
    const arrowY1 = toY - arrowSize * Math.sin(angle - Math.PI / 6);
    const arrowX2 = toX - arrowSize * Math.cos(angle + Math.PI / 6);
    const arrowY2 = toY - arrowSize * Math.sin(angle + Math.PI / 6);

    const arrow = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    arrow.setAttribute(
      "points",
      `${toX},${toY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`
    );
    arrow.setAttribute("fill", "#6c757d");
    arrow.setAttribute(
      "opacity",
      connector.type === "undefined" ? "0.5" : "0.7"
    );
    this.svg.appendChild(arrow);
  }
}
