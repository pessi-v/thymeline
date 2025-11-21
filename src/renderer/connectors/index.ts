/**
 * Connector renderer registry
 */

export type { ConnectorRenderer, ConnectorRenderContext } from "./types";
export { straightConnector } from "./straightConnector";
export { sigmoidConnector } from "./sigmoidConnector";

import type { ConnectorRenderer } from "./types";
import { straightConnector } from "./straightConnector";
import { sigmoidConnector } from "./sigmoidConnector";

export const CONNECTOR_RENDERERS: Record<string, ConnectorRenderer> = {
  sigmoid: sigmoidConnector,
  straight: straightConnector,
};

export const DEFAULT_CONNECTOR = "sigmoid";
