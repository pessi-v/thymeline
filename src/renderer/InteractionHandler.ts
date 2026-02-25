/**
 * Handles mouse/touch interactions for the timeline
 * Supports drag-to-pan, scroll-to-zoom, and double-click-to-zoom
 */

/**
 * Callbacks for interaction events
 */
export interface InteractionCallbacks {
  onPan: (centerTime: number) => void;
  onVerticalPan: (scrollY: number) => void;
  onZoom: (zoomLevel: number, centerTime: number) => void;
  xToTime: (x: number) => number;
  getZoomLevel: () => number;
  getCenterTime: () => number;
  getTimeRange: () => number;
  getWidth: () => number;
  getScrollY: () => number;
}

/**
 * Configuration for interaction behavior
 */
export interface InteractionConfig {
  zoomSensitivity: number;
  doubleClickZoomFactor: number;
  doubleClickThreshold: number;
}

const DEFAULT_CONFIG: InteractionConfig = {
  zoomSensitivity: 0.001,
  doubleClickZoomFactor: 1.5,
  doubleClickThreshold: 300,
};

export class InteractionHandler {
  private svg: SVGSVGElement;
  private callbacks: InteractionCallbacks;
  private config: InteractionConfig;

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private startCenterTime = 0;
  private startScrollY = 0;
  private lastClickTime = 0;

  private boundHandlers: {
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: () => void;
    mouseleave: () => void;
    wheel: (e: WheelEvent) => void;
  };

  constructor(
    svg: SVGSVGElement,
    callbacks: InteractionCallbacks,
    config: Partial<InteractionConfig> = {},
  ) {
    this.svg = svg;
    this.callbacks = callbacks;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Bind handlers so they can be removed later
    this.boundHandlers = {
      mousedown: this.handleMouseDown.bind(this),
      mousemove: this.handleMouseMove.bind(this),
      mouseup: this.handleMouseUp.bind(this),
      mouseleave: this.handleMouseUp.bind(this),
      wheel: this.handleWheel.bind(this),
    };

    this.attach();
  }

  /**
   * Attach event listeners to the SVG element
   */
  attach(): void {
    this.svg.addEventListener("mousedown", this.boundHandlers.mousedown);
    this.svg.addEventListener("mousemove", this.boundHandlers.mousemove);
    this.svg.addEventListener("mouseup", this.boundHandlers.mouseup);
    this.svg.addEventListener("mouseleave", this.boundHandlers.mouseleave);
    this.svg.addEventListener("wheel", this.boundHandlers.wheel);
  }

  /**
   * Remove event listeners from the SVG element
   */
  detach(): void {
    this.svg.removeEventListener("mousedown", this.boundHandlers.mousedown);
    this.svg.removeEventListener("mousemove", this.boundHandlers.mousemove);
    this.svg.removeEventListener("mouseup", this.boundHandlers.mouseup);
    this.svg.removeEventListener("mouseleave", this.boundHandlers.mouseleave);
    this.svg.removeEventListener("wheel", this.boundHandlers.wheel);
  }

  /**
   * Handle mouse down - start drag or detect double-click
   */
  private handleMouseDown(e: MouseEvent): void {
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - this.lastClickTime;

    // Check for double-click
    if (timeSinceLastClick < this.config.doubleClickThreshold) {
      this.handleDoubleClick(e);
      this.lastClickTime = 0;
      return;
    }

    this.lastClickTime = currentTime;
    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startCenterTime = this.callbacks.getCenterTime();
    this.startScrollY = this.callbacks.getScrollY();
    this.svg.style.cursor = "grabbing";
  }

  /**
   * Handle mouse move - pan if dragging
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.startX;
    const timeRange = this.callbacks.getTimeRange();
    const width = this.callbacks.getWidth();
    const deltaTime = (-deltaX / width) * timeRange;
    const newCenterTime = this.startCenterTime + deltaTime;
    this.callbacks.onPan(newCenterTime);

    const deltaY = e.clientY - this.startY;
    this.callbacks.onVerticalPan(this.startScrollY + deltaY);
  }

  /**
   * Handle mouse up - stop dragging
   */
  private handleMouseUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.svg.style.cursor = "grab";
    }
  }

  /**
   * Handle mouse wheel - zoom
   */
  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.svg.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorTime = this.callbacks.xToTime(cursorX);

    const zoomFactor = 1 + Math.abs(e.deltaY) * this.config.zoomSensitivity;
    const currentZoom = this.callbacks.getZoomLevel();
    const newZoomLevel =
      e.deltaY < 0 ? currentZoom * zoomFactor : currentZoom / zoomFactor;

    this.callbacks.onZoom(newZoomLevel, cursorTime);
  }

  /**
   * Handle double-click - zoom in centered on click position
   */
  private handleDoubleClick(e: MouseEvent): void {
    const rect = this.svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedTime = this.callbacks.xToTime(clickX);

    const currentZoom = this.callbacks.getZoomLevel();
    const newZoomLevel = currentZoom * this.config.doubleClickZoomFactor;

    this.callbacks.onZoom(newZoomLevel, clickedTime);
  }
}
