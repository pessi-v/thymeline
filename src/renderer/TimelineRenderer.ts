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
} from "../core/types";
import { getCurrentTime } from "../utils/timeNormalization";
import { assignLanes } from "../layout/laneAssignment";
import { CONNECTOR_RENDERERS, DEFAULT_CONNECTOR } from "./connectors";
import { InfoPopup } from "./InfoPopup";
import {
  createSvgElement,
  createTextElement,
  createRectElement,
  createCircleElement,
} from "./svgFactory";
import { Viewport } from "./Viewport";
import { TimeAxisRenderer } from "./TimeAxisRenderer";
import {
  LabelPositioner,
  sampleConnectorPath,
  type CollisionBox,
  type LabelPosition,
  type EventPositionData,
} from "./LabelPositioner";
import { InteractionHandler } from "./InteractionHandler";

export class TimelineRenderer {
  private container: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private data: TimelineData | null = null;
  private options: Required<RendererOptions>;
  private viewport: Viewport;
  private timeAxisRenderer: TimeAxisRenderer;
  private labelPositioner: LabelPositioner;
  private interactionHandler: InteractionHandler | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private laneAssignments: import("../core/types").LaneAssignment[] = [];
  private rowMapping: Map<string, number> = new Map();
  private infoPopup: InfoPopup | null = null;
  private scrollY = 0;
  private contentHeight = 0;
  private contentGroup: SVGGElement | null = null;

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

    // Initialize time axis renderer
    this.timeAxisRenderer = new TimeAxisRenderer({
      width: this.options.width,
    });

    // Initialize label positioner
    this.labelPositioner = new LabelPositioner();
  }

  /**
   * Render timeline with data
   */
  render(timelineData: TimelineData): void {
    this.data = timelineData;
    this.scrollY = 0;

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
    if (this.interactionHandler) {
      this.interactionHandler.detach();
      this.interactionHandler = null;
    }
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
    this.contentHeight = Math.max(this.options.height, calculatedHeight);
    const height = this.options.height;

    this.svg = createSvgElement("svg", {
      width: this.options.width,
      height,
    });
    this.svg.style.border = "1px solid #ccc";
    this.svg.style.background = "#fff";
    this.svg.style.cursor = "grab";
    this.svg.style.userSelect = "none";

    // Set up interaction handling
    if (this.interactionHandler) {
      this.interactionHandler.detach();
    }
    this.interactionHandler = new InteractionHandler(this.svg, {
      onPan: (centerTime) => {
        this.viewport.panTo(centerTime);
        this.updateView();
        this.emit("pan", this.viewport.centerTime);
      },
      onVerticalPan: (scrollY) => {
        const maxScroll = Math.max(0, this.contentHeight - this.options.height);
        this.scrollY = Math.max(-maxScroll, Math.min(0, scrollY));
        this.updateView();
      },
      onZoom: (zoomLevel, centerTime) => {
        this.setZoomLevel(zoomLevel, centerTime);
      },
      xToTime: (x) => this.viewport.xToTime(x),
      getZoomLevel: () => this.viewport.zoomLevel,
      getCenterTime: () => this.viewport.centerTime,
      getTimeRange: () => this.viewport.endTime - this.viewport.startTime,
      getWidth: () => this.options.width,
      getScrollY: () => this.scrollY,
    });

    this.container.appendChild(this.svg);

    // Initialize info popup
    if (!this.infoPopup) {
      this.infoPopup = new InfoPopup(this.container);
    }
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

    // Set up clip path that masks the scrollable content area below the time axis
    const timeAxisOffset = 60;
    const defs = createSvgElement("defs", {});
    const clipPath = createSvgElement("clipPath", { id: "thymeline-content-clip" });
    const clipRect = createRectElement(
      0,
      timeAxisOffset,
      this.options.width,
      this.options.height - timeAxisOffset,
    );
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    this.svg.appendChild(defs);

    // Create a fixed clip wrapper (no transform) so the clip rect stays in SVG coordinates.
    // If the clip-path were on the scrolling group itself, it would move with the content
    // and always show the same elements regardless of scroll position.
    const clipWrapper = createSvgElement("g", {
      "clip-path": "url(#thymeline-content-clip)",
    });
    this.svg.appendChild(clipWrapper);

    // Create the scrollable content group (transform only, no clip-path)
    const contentGroup = createSvgElement("g", {
      transform: `translate(0, ${this.scrollY})`,
    });
    this.contentGroup = contentGroup;
    clipWrapper.appendChild(contentGroup);

    // Render row numbers into content group (if enabled)
    if (this.options.showRowNumbers) {
      this.renderRowNumbers();
    }

    // Render time axis fixed on top (appended after contentGroup so it renders above it)
    this.timeAxisRenderer.render(this.svg, this.viewport);

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

    // Render today line marker (fixed, on top of everything)
    this.timeAxisRenderer.renderTodayLine(this.svg, this.viewport);
  }

  /**
   * Render row numbers for debugging
   */
  private renderRowNumbers(): void {
    if (!this.contentGroup) return;

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
      this.contentGroup.appendChild(rect);

      // Row number text
      const text = createTextElement(row.toString(), {
        x: 15,
        y: y + periodHeight / 2 + 4,
        "text-anchor": "middle",
        "font-size": 10,
        "font-family": "monospace",
      });
      this.contentGroup.appendChild(text);
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

    this.contentGroup!.appendChild(rect);

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
        if (!this.contentGroup) return;

        hoverLabel = createTextElement(period.name, {
          x: startX + width / 2,
          y: y + height + 14,
          "text-anchor": "middle",
          fill: "#000",
          "font-weight": "bold",
          "pointer-events": "none",
        });
        this.contentGroup.appendChild(hoverLabel);
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
    if (!this.svg || !this.contentGroup) return false;

    const padding = 8; // Horizontal padding inside the period
    const availableWidth = width - padding * 2;

    if (availableWidth <= 0) return false;

    const centerX = startX + width / 2;
    const fontSize = 11;
    const lineHeight = fontSize + 2;

    // Create a temporary text element to measure text width (appended to svg for getBBox())
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
      this.contentGroup.appendChild(text);
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
    this.contentGroup.appendChild(text1);

    const text2 = createTextElement(line2, {
      x: centerX,
      y: y + height / 2 + lineHeight / 2 + fontSize / 3,
      "text-anchor": "middle",
      "font-size": fontSize,
      fill: "#fff",
      "font-weight": "bold",
      "pointer-events": "none",
    });
    this.contentGroup.appendChild(text2);

    return true;
  }

  /**
   * Calculate bounding boxes for all visible connectors for collision detection
   */
  private calculateConnectorBounds(): CollisionBox[] {
    if (!this.data) return [];

    const boxes: CollisionBox[] = [];

    for (const connector of this.data.connectors) {
      const fromAssignment = this.laneAssignments.find(
        (a) => a.itemId === connector.fromId,
      );
      const toAssignment = this.laneAssignments.find(
        (a) => a.itemId === connector.toId,
      );

      if (!fromAssignment || !toAssignment) continue;

      // Calculate pixel widths to check visibility
      const fromStartX = this.timeToX(fromAssignment.startTime);
      const fromEndX = this.timeToX(fromAssignment.endTime);
      const fromWidth = fromEndX - fromStartX;
      const toStartX = this.timeToX(toAssignment.startTime);
      const toEndX = this.timeToX(toAssignment.endTime);
      const toWidth = toEndX - toStartX;

      if (fromWidth < 10 || toWidth < 10) continue;

      const fromRow = this.rowMapping.get(connector.fromId);
      const toRow = this.rowMapping.get(connector.toId);
      if (fromRow === undefined || toRow === undefined) continue;

      const connectionTime = Math.min(
        fromAssignment.endTime,
        toAssignment.startTime,
      );
      const fromX = this.timeToX(connectionTime) - 5;
      const toX = this.timeToX(toAssignment.startTime) + 5;
      let fromY =
        this.rowToY(fromRow, fromAssignment.type) +
        this.options.constraints.periodHeight / 2;
      const toY =
        this.rowToY(toRow, toAssignment.type) +
        this.options.constraints.periodHeight / 2;

      if (toY < fromY) {
        fromY = fromY - 5;
      } else if (toY > fromY) {
        fromY = fromY + 5;
      }

      const pathBoxes = sampleConnectorPath(fromX, fromY, toX, toY);
      boxes.push(...pathBoxes);
    }

    return boxes;
  }

  /**
   * Render all events with smart label positioning to avoid overlaps
   */
  private renderEventsWithLabelPositioning(events: TimelineEvent[]): void {
    if (!this.svg) return;

    // Calculate connector bounds for collision detection
    const connectorBoxes = this.calculateConnectorBounds();

    // Build event position data
    const eventData: EventPositionData[] = [];

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

    // Calculate placements using the label positioner
    const placements = this.labelPositioner.calculatePlacements(
      eventData,
      connectorBoxes,
      {
        timeToX: (time) => this.timeToX(time),
        eventToY: (row, subLane, isRelated) =>
          this.eventToY(row, subLane, isRelated),
      },
      {
        width: this.options.width,
        startTime: this.viewport.startTime,
        endTime: this.viewport.endTime,
      },
    );

    // Build placement lookup
    const placementMap = new Map(placements.map((p) => [p.eventId, p]));

    // Render all events with their determined positions
    for (const { event, row, isRelatedEvent } of eventData) {
      const placement = placementMap.get(event.id);
      if (!placement) continue;

      this.renderEventWithSubLane(
        event,
        row,
        placement.subLane,
        isRelatedEvent,
        placement.labelPosition,
      );
    }
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

    this.contentGroup!.appendChild(circle);

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
      this.contentGroup!.appendChild(text);
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

    // Append all elements to content group and add connector ID
    elements.forEach((element) => {
      element.setAttribute("id", connector.id);
      this.contentGroup!.appendChild(element);
    });
  }
}
