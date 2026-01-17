/**
 * Connector renderer registry
 */

export type { ConnectorRenderer, ConnectorRenderContext } from "./types";
export { sigmoidHorizontalLimitedConnector } from "./sigmoidHorizontalLimitedConnector";
export { connectorV4 } from "./connector-v4";

import type { ConnectorRenderer } from "./types";
import { sigmoidHorizontalLimitedConnector } from "./sigmoidHorizontalLimitedConnector";
import { connectorV4 } from "./connector-v4";

// Import debug connectors - tree-shaking will remove them when __DEBUG__ is false
import { bezierConnector } from "./bezierConnector";
import { straightConnector } from "./straightConnector";
import { sigmoidConnector } from "./sigmoidConnector";
import { sigmoidHorizontalConnector } from "./sigmoidHorizontalConnector";

// Registry of all available connector renderers
// When __DEBUG__ is false, tree-shaking will remove unused connectors
export const CONNECTOR_RENDERERS: Record<string, ConnectorRenderer> =
  /* @__PURE__ */ (() => {
    const connectors: Record<string, ConnectorRenderer> = {
      sigmoidHorizontalLimited: sigmoidHorizontalLimitedConnector,
      "connector-v4": connectorV4,
    };

    // In production builds (__DEBUG__ = false), debug connectors are removed by tree-shaking
    if (__DEBUG__) {
      connectors.bezier = bezierConnector;
      connectors.straight = straightConnector;
      connectors.sigmoid = sigmoidConnector;
      connectors.sigmoidHorizontal = sigmoidHorizontalConnector;
    }

    return connectors;
  })();

export const DEFAULT_CONNECTOR = "sigmoidHorizontalLimited";
