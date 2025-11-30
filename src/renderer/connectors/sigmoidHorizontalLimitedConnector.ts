/**
 * Horizontal sigmoid curve connector with limited curve distance
 * Curves for a maximum distance, then continues as a straight line
 */

import * as d3 from "d3";
import type { ConnectorRenderer, ConnectorRenderContext } from "./types";

export const sigmoidHorizontalLimitedConnector: ConnectorRenderer = {
  name: "Sigmoid Horizontal Limited",
  description: "Smooth sigmoid curve that travels horizontally first, with limited curve distance",

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
    const horizontalDistance = Math.abs(toX - fromX);
    const maxCurveDistance = 50; // Maximum horizontal distance for the curve

    // If the total distance is less than the limit, use full sigmoid curve
    if (horizontalDistance <= maxCurveDistance) {
      return renderFullSigmoid(fromX, fromY, toX, toY, ctx);
    }

    // Otherwise, curve to a midpoint and then continue as a straight line
    const isGoingRight = toX > fromX;
    const curveEndX = isGoingRight ? fromX + maxCurveDistance : fromX - maxCurveDistance;

    // Create sigmoid curve from start to curve end point
    const sigmoidPath = createSigmoidPath(fromX, fromY, curveEndX, toY);

    if (!sigmoidPath) {
      // Fallback to simple line
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", `M ${fromX},${fromY} L ${toX},${toY}`);
      path.setAttribute("stroke", ctx.color);
      path.setAttribute("stroke-width", "5");
      path.setAttribute("fill", "none");
      elements.push(path);
      return elements;
    }

    // Combine sigmoid curve with straight line continuation into single path
    const combinedPath = `${sigmoidPath} L ${toX},${toY}`;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", combinedPath);
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

/**
 * Render a full sigmoid curve (for short distances)
 */
function renderFullSigmoid(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  ctx: ConnectorRenderContext
): SVGElement[] {
  const elements: SVGElement[] = [];
  const pathData = createSigmoidPath(fromX, fromY, toX, toY);

  if (!pathData) {
    // Fallback to simple line if path generation fails
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${fromX},${fromY} L ${toX},${toY}`);
    path.setAttribute("stroke", ctx.color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    elements.push(path);
    return elements;
  }

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
}

/**
 * Create a sigmoid path from (fromX, fromY) to (toX, toY)
 */
function createSigmoidPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): string | null {
  // Sigmoid function: 1 / (1 + e^(-2*t))
  const sigmoid = (t: number) => 1 / (1 + Math.exp(-2 * t));

  // Generate sigmoid data points
  const limit = 3;
  const step = 0.1;
  const sigmoidData: [number, number][] = [];

  for (let t = -limit; t <= limit; t += step) {
    const sigmoidValue = sigmoid(t);
    sigmoidData.push([sigmoidValue, t]);
  }

  // Create scales to map sigmoid values to our connector coordinates
  const scaleX = d3
    .scaleLinear()
    .domain([0, 1]) // Normalized horizontal progress
    .range([fromX, toX]);

  const scaleY = d3
    .scaleLinear()
    .domain([0, 1]) // Sigmoid output range
    .range([fromY, toY]);

  // Create D3 line generator
  const lineGenerator = d3
    .line<[number, number]>()
    .x((d) => {
      // Map t value to 0-1 range for horizontal positioning
      const normalizedT = (d[1] + limit) / (2 * limit);
      return scaleX(normalizedT);
    })
    .y((d) => scaleY(d[0])); // Sigmoid controls vertical position

  return lineGenerator(sigmoidData);
}
