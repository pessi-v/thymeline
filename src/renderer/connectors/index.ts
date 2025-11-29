/**
 * Connector renderer registry
 */

export type { ConnectorRenderer, ConnectorRenderContext } from "./types";
export { straightConnector } from "./straightConnector";
export { sigmoidConnector } from "./sigmoidConnector";
export { bezierConnector } from "./bezierConnector";

import type { ConnectorRenderer } from "./types";
import { straightConnector } from "./straightConnector";
import { sigmoidConnector } from "./sigmoidConnector";
import { bezierConnector } from "./bezierConnector";

export const CONNECTOR_RENDERERS: Record<string, ConnectorRenderer> = {
  sigmoid: sigmoidConnector,
  straight: straightConnector,
  bezier: bezierConnector,
};

export const DEFAULT_CONNECTOR = "sigmoid";
