/**
 * Horizontal sigmoid curve connector renderer
 * Uses D3's sigmoid function with 90-degree rotation (travels horizontally first)
 */

import * as d3 from "d3";
import type { ConnectorRenderer, ConnectorRenderContext } from "./types";

export const sigmoidHorizontalConnector: ConnectorRenderer = {
  name: "Sigmoid Horizontal",
  description: "Smooth sigmoid curve that travels horizontally first",

  render(ctx: ConnectorRenderContext): SVGElement[] {
    const elements: SVGElement[] = [];

    // Adjust connection points:
    // - Start 5px to the left of the "from" period
    // - End 5px to the right of the "to" period
    const fromX = ctx.fromX - 5;
    const fromY = ctx.fromY;
    const toX = ctx.toX + 5;
    const toY = ctx.toY;

    // Calculate dimensions
    const width = Math.abs(toX - fromX);
    const height = Math.abs(toY - fromY);
    const isReversed = toX < fromX;
    const isGoingDown = toY > fromY;

    // Sigmoid function: 1 / (1 + e^(-2*t))
    const sigmoid = (t: number) => 1 / (1 + Math.exp(-2 * t));

    // Generate sigmoid data points
    // Use limit of 3 for a good S-curve shape (captures most of the transition)
    const limit = 3;
    const step = 0.1;
    const sigmoidData: [number, number][] = [];

    for (let t = -limit; t <= limit; t += step) {
      const sigmoidValue = sigmoid(t);
      sigmoidData.push([sigmoidValue, t]);
    }

    // Create scales to map sigmoid values to our connector coordinates
    // ROTATED: sigmoid now controls Y position, t controls X position
    const scaleX = d3
      .scaleLinear()
      .domain([0, 1]) // Normalized horizontal progress
      .range([fromX, toX]);

    const scaleY = d3
      .scaleLinear()
      .domain([0, 1]) // Sigmoid output range
      .range([fromY, toY]); // Always map 0->fromY, 1->toY

    // Create D3 line generator
    const lineGenerator = d3
      .line<[number, number]>()
      .x((d) => {
        // Map t value to 0-1 range for horizontal positioning
        const normalizedT = (d[1] + limit) / (2 * limit);
        return scaleX(normalizedT);
      })
      .y((d) => scaleY(d[0])); // Sigmoid controls vertical position

    // Generate the path data
    const pathData = lineGenerator(sigmoidData);

    if (!pathData) {
      // Fallback to simple line if path generation fails
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", `M ${fromX},${fromY} L ${toX},${toY}`);
      path.setAttribute("stroke", ctx.color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      elements.push(path);
      return elements;
    }

    // Create SVG path element
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", ctx.color);
    path.setAttribute("stroke-width", "5");
    path.setAttribute("fill", "none");

    if (ctx.connectorType === "undefined") {
      path.setAttribute("stroke-dasharray", "5,5");
      path.setAttribute("stroke-opacity", "0.5");
    } else {
      path.setAttribute("stroke-opacity", ctx.opacity.toString());
    }

    elements.push(path);

    return elements;
  },
};
