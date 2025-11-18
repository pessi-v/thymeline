/**
 * Straight line connector renderer
 */

import type { ConnectorRenderer, ConnectorRenderContext } from './types';

export const straightConnector: ConnectorRenderer = {
  name: 'Straight',
  description: 'Simple straight line connector with arrow',

  render(ctx: ConnectorRenderContext): SVGElement[] {
    const elements: SVGElement[] = [];

    // Line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", ctx.fromX.toString());
    line.setAttribute("y1", ctx.fromY.toString());
    line.setAttribute("x2", ctx.toX.toString());
    line.setAttribute("y2", ctx.toY.toString());
    line.setAttribute("stroke", ctx.color);
    line.setAttribute("stroke-width", "2");

    if (ctx.connectorType === "undefined") {
      line.setAttribute("stroke-dasharray", "5,5");
      line.setAttribute("stroke-opacity", "0.5");
    } else {
      line.setAttribute("stroke-opacity", ctx.opacity.toString());
    }

    elements.push(line);

    // Arrow head
    const arrowSize = 6;
    const angle = Math.atan2(ctx.toY - ctx.fromY, ctx.toX - ctx.fromX);
    const arrowX1 = ctx.toX - arrowSize * Math.cos(angle - Math.PI / 6);
    const arrowY1 = ctx.toY - arrowSize * Math.sin(angle - Math.PI / 6);
    const arrowX2 = ctx.toX - arrowSize * Math.cos(angle + Math.PI / 6);
    const arrowY2 = ctx.toY - arrowSize * Math.sin(angle + Math.PI / 6);

    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    arrow.setAttribute(
      "points",
      `${ctx.toX},${ctx.toY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`
    );
    arrow.setAttribute("fill", ctx.color);
    arrow.setAttribute(
      "opacity",
      ctx.connectorType === "undefined" ? "0.5" : ctx.opacity.toString()
    );

    elements.push(arrow);

    return elements;
  },
};
