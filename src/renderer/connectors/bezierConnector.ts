/**
 * Bezier curve connector renderer
 * Uses cubic Bézier curves similar to Canvas API bezierCurveTo()
 */

import type { ConnectorRenderer, ConnectorRenderContext } from "./types";

export const bezierConnector: ConnectorRenderer = {
  name: "Bezier",
  description: "Smooth cubic Bézier curve connector",

  render(ctx: ConnectorRenderContext): SVGElement[] {
    const elements: SVGElement[] = [];

    // Adjust connection points:
    // - Start 10px to the left of the "from" period
    // - End 5px to the right of the "to" period
    const startX = ctx.fromX - 10;
    const startY = ctx.fromY;
    const endX = ctx.toX + 5;
    const endY = ctx.toY;

    // Calculate control points for cubic Bézier curve
    // Similar to canvas bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY)
    const horizontalDistance = endX - startX;
    const verticalDistance = endY - startY;

    // Control point 1: extend horizontally from start point
    // This creates the smooth departure from the start
    const cp1x = startX + horizontalDistance * 0.5;
    const cp1y = startY + verticalDistance * 0.1;

    // Control point 2: approach horizontally to end point
    // This creates the smooth arrival at the end
    const cp2x = startX + horizontalDistance * 0.5;
    const cp2y = endY - verticalDistance * 0.1;

    // Create SVG path with cubic Bézier curve
    // SVG path command: C cp1x,cp1y cp2x,cp2y endX,endY
    const pathData = `M ${startX},${startY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${endX},${endY}`;

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
