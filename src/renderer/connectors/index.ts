/**
 * Connector renderer registry
 */

export type { ConnectorRenderer, ConnectorRenderContext } from "./types";
export { straightConnector } from "./straightConnector";
export { sigmoidConnector } from "./sigmoidConnector";
export { sigmoidHorizontalConnector } from "./sigmoidHorizontalConnector";
export { sigmoidHorizontalLimitedConnector } from "./sigmoidHorizontalLimitedConnector";
export { bezierConnector } from "./bezierConnector";

import type { ConnectorRenderer } from "./types";
import { straightConnector } from "./straightConnector";
import { sigmoidConnector } from "./sigmoidConnector";
import { sigmoidHorizontalConnector } from "./sigmoidHorizontalConnector";
import { sigmoidHorizontalLimitedConnector } from "./sigmoidHorizontalLimitedConnector";
import { bezierConnector } from "./bezierConnector";

export const CONNECTOR_RENDERERS: Record<string, ConnectorRenderer> = {
  sigmoid: sigmoidConnector,
  sigmoidHorizontal: sigmoidHorizontalConnector,
  sigmoidHorizontalLimited: sigmoidHorizontalLimitedConnector,
  straight: straightConnector,
  bezier: bezierConnector,
};

export const DEFAULT_CONNECTOR = "sigmoid";
