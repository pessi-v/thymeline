/**
 * Sigmoid curve connector renderer
 * Uses D3's sigmoid function for true S-curves
 */

import * as d3 from "d3";
import type { ConnectorRenderer, ConnectorRenderContext } from "./types";

export const sigmoidConnector: ConnectorRenderer = {
  name: "Sigmoid",
  description: "Smooth sigmoid curve using mathematical sigmoid function",

  render(ctx: ConnectorRenderContext): SVGElement[] {
    const elements: SVGElement[] = [];

    // Calculate dimensions
    const isReversed = ctx.toX < ctx.fromX;
    const isGoingDown = ctx.toY > ctx.fromY;

    // If the connector is very short, use a simple line
    // if (width < 10) {
    //   const path = document.createElementNS(
    //     "http://www.w3.org/2000/svg",
    //     "path"
    //   );
    //   path.setAttribute(
    //     "d",
    //     `M ${ctx.fromX},${ctx.fromY} L ${ctx.toX},${ctx.toY}`
    //   );
    //   path.setAttribute("stroke", ctx.color);
    //   path.setAttribute("stroke-width", "10");
    //   path.setAttribute("fill", "none");

    //   if (ctx.connectorType === "undefined") {
    //     path.setAttribute("stroke-dasharray", "5,5");
    //     path.setAttribute("stroke-opacity", "0.5");
    //   } else {
    //     path.setAttribute("stroke-opacity", ctx.opacity.toString());
    //   }

    //   elements.push(path);
    //   return elements;
    // }

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
    const scaleX = d3
      .scaleLinear()
      .domain([0, 1]) // Sigmoid output range
      .range(isReversed ? [ctx.fromX, ctx.toX] : [ctx.fromX, ctx.toX]);

    const scaleY = d3
      .scaleLinear()
      .domain([0, 1]) // Normalized height
      .range(isGoingDown ? [ctx.fromY, ctx.toY] : [ctx.toY, ctx.fromY]);

    // Create D3 line generator
    const lineGenerator = d3
      .line<[number, number]>()
      .x((d) => scaleX(d[0]))
      .y((d) => {
        // Map t value to 0-1 range for vertical positioning
        const normalizedT = (d[1] + limit) / (2 * limit);
        return scaleY(normalizedT);
      });

    // Generate the path data
    const pathData = lineGenerator(sigmoidData);

    if (!pathData) {
      // Fallback to simple line if path generation fails
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute(
        "d",
        `M ${ctx.fromX},${ctx.fromY} L ${ctx.toX},${ctx.toY}`
      );
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
