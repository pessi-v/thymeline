/**
 * Renders the time axis, including tick marks, labels,
 * Big Bang boundary, and Today marker
 */

import { BIG_BANG_TIME } from "../utils/validation";
import { getCurrentTime } from "../utils/timeNormalization";
import {
  createSvgElement,
  createTextElement,
  createLineElement,
  createRectElement,
} from "./svgFactory";
import type { Viewport } from "./Viewport";

export interface TimeAxisConfig {
  width: number;
  axisHeight: number;
  tickHeight: number;
  margin: number;
  numMarkers: number;
}

const DEFAULT_CONFIG: TimeAxisConfig = {
  width: 800,
  axisHeight: 40,
  tickHeight: 10,
  margin: 40,
  numMarkers: 10,
};

export class TimeAxisRenderer {
  private config: TimeAxisConfig;

  constructor(config: Partial<TimeAxisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update configuration (e.g., on resize)
   */
  setConfig(config: Partial<TimeAxisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Render the complete time axis
   */
  render(svg: SVGSVGElement, viewport: Viewport): void {
    this.renderBackground(svg);
    this.renderBigBangBoundary(svg, viewport);
    this.renderAxisLine(svg);
    this.renderTicksAndLabels(svg, viewport);
  }

  /**
   * Render the today marker line (called separately after other elements)
   */
  renderTodayLine(svg: SVGSVGElement, viewport: Viewport): void {
    const todayTime = getCurrentTime();
    const todayX = viewport.timeToX(todayTime);

    // Only render if today is visible in current viewport
    if (todayX < 0 || todayX > this.config.width) {
      return;
    }

    const svgHeight = parseFloat(svg.getAttribute("height") || "500");

    // Draw vertical line at today (dashed)
    const todayLine = createLineElement(
      todayX,
      this.config.axisHeight,
      todayX,
      svgHeight,
      {
        stroke: "#333",
        "stroke-width": 2,
        "stroke-dasharray": "5,5",
      },
    );
    svg.appendChild(todayLine);

    // Add label for Today
    const label = createTextElement("Today", {
      x: todayX + 5,
      y: this.config.axisHeight + 15,
      "text-anchor": "start",
      "font-size": 10,
      "font-style": "italic",
    });
    svg.appendChild(label);
  }

  /**
   * Render axis background
   */
  private renderBackground(svg: SVGSVGElement): void {
    const bg = createRectElement(0, 0, this.config.width, this.config.axisHeight, {
      id: "time-axis-background",
      fill: "#f8f9fa",
    });
    svg.appendChild(bg);
  }

  /**
   * Render main axis line
   */
  private renderAxisLine(svg: SVGSVGElement): void {
    const line = createLineElement(
      0,
      this.config.axisHeight,
      this.config.width,
      this.config.axisHeight,
      {
        "stroke-width": 2,
      },
    );
    svg.appendChild(line);
  }

  /**
   * Render tick marks and time labels
   */
  private renderTicksAndLabels(svg: SVGSVGElement, viewport: Viewport): void {
    const { width, axisHeight, tickHeight, margin, numMarkers } = this.config;
    const usableWidth = width - margin * 2;
    const timeRange = viewport.endTime - viewport.startTime;

    for (let i = 0; i <= numMarkers; i++) {
      const pixelPosition = margin + (usableWidth / numMarkers) * i;
      const timeProgress = pixelPosition / width;
      const time = viewport.startTime + timeRange * timeProgress;

      // Tick mark
      const tick = createLineElement(
        pixelPosition,
        axisHeight,
        pixelPosition,
        axisHeight + tickHeight,
      );
      svg.appendChild(tick);

      // Label (only if time is after Big Bang)
      if (time >= BIG_BANG_TIME) {
        const text = createTextElement(this.formatTimeLabel(time), {
          x: pixelPosition,
          y: 25,
          "text-anchor": "middle",
        });
        svg.appendChild(text);
      }
    }
  }

  /**
   * Render Big Bang boundary and static noise effect
   */
  private renderBigBangBoundary(svg: SVGSVGElement, viewport: Viewport): void {
    const bigBangX = viewport.timeToX(BIG_BANG_TIME);

    // Only render if Big Bang is visible in current viewport
    if (bigBangX < 0 || bigBangX > this.config.width) {
      return;
    }

    const svgHeight = parseFloat(svg.getAttribute("height") || "500");

    // Ensure defs element exists
    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = createSvgElement("defs");
      svg.insertBefore(defs, svg.firstChild);
    }

    // Remove existing pattern if it exists
    const existingPattern = defs.querySelector("#static-noise-pattern");
    if (existingPattern) {
      existingPattern.remove();
    }

    // Create noise filter
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
      const noiseRect = createRectElement(
        0,
        this.config.axisHeight,
        bigBangX,
        svgHeight - this.config.axisHeight,
        {
          fill: "#d0d0d0",
          filter: "url(#noise-filter)",
          opacity: 0.35,
        },
      );
      svg.appendChild(noiseRect);

      // Draw vertical line at Big Bang (dashed)
      const bigBangLine = createLineElement(
        bigBangX,
        this.config.axisHeight,
        bigBangX,
        svgHeight,
        {
          stroke: "#333",
          "stroke-width": 2,
          "stroke-dasharray": "5,5",
        },
      );
      svg.appendChild(bigBangLine);

      // Add label for Big Bang
      const label = createTextElement("Big Bang", {
        x: bigBangX - 5,
        y: this.config.axisHeight + 15,
        "text-anchor": "end",
        "font-size": 10,
        "font-style": "italic",
      });
      svg.appendChild(label);
    }
  }

  /**
   * Format time value for axis labels
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
}
