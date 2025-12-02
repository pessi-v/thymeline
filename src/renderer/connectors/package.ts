/**
 * Minimal connector renderer registry for package distribution
 * Only includes sigmoidHorizontalLimited connector
 */

import type { ConnectorRenderer } from "./types";
import { sigmoidHorizontalLimitedConnector } from "./sigmoidHorizontalLimitedConnector";

export const CONNECTOR_RENDERERS: Record<string, ConnectorRenderer> = {
  sigmoidHorizontalLimited: sigmoidHorizontalLimitedConnector,
};

export const DEFAULT_CONNECTOR = "sigmoidHorizontalLimited";
