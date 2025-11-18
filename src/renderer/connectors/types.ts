/**
 * Connector rendering types and interfaces
 */

export interface ConnectorRenderContext {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  connectorType: 'defined' | 'undefined';
  color: string;
  opacity: number;
}

export interface ConnectorRenderer {
  name: string;
  description: string;
  render(ctx: ConnectorRenderContext): SVGElement[];
}
