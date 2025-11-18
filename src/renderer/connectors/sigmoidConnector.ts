/**
 * Sigmoid curve connector renderer
 * Uses smooth cubic Bezier curves that blend into the period bars
 */

import type { ConnectorRenderer, ConnectorRenderContext } from './types';

export const sigmoidConnector: ConnectorRenderer = {
  name: 'Sigmoid',
  description: 'Smooth sigmoid curve that blends into period bars',

  render(ctx: ConnectorRenderContext): SVGElement[] {
    const elements: SVGElement[] = [];

    const dx = ctx.toX - ctx.fromX;

    // Calculate control points for cubic Bezier curve
    // We want a smooth S-curve that exits horizontally from the period bar
    // and enters horizontally into the target period bar

    // Control point distance based on horizontal distance
    // Longer distances get more pronounced curves
    const controlPointDistance = Math.min(Math.abs(dx) * 0.5, 100);

    // First control point: extends horizontally from the start point
    const cp1x = ctx.fromX + controlPointDistance;
    const cp1y = ctx.fromY;

    // Second control point: extends horizontally to the end point
    const cp2x = ctx.toX - controlPointDistance;
    const cp2y = ctx.toY;

    // Create path with cubic Bezier curve
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const pathData = `M ${ctx.fromX},${ctx.fromY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ctx.toX},${ctx.toY}`;
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", ctx.color);
    path.setAttribute("stroke-width", "2");
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
