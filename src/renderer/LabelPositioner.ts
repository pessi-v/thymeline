/**
 * Label positioning algorithm for events
 * Determines optimal label placement (left/right/hidden) to avoid overlaps
 * with other labels, event circles, and connectors
 */

import type { TimelineEvent, LaneAssignment } from "../core/types";

/**
 * Bounds for an event's circle and potential label positions
 */
export interface EventBounds {
  id: string;
  circleX: number;
  circleY: number;
  circleRadius: number;
  labelY: number;
  labelHeight: number;
  labelWidth: number;
  rightLabelX: number;
  leftLabelX: number;
  subLane: number;
  row: number;
  isRelatedEvent: boolean;
  labelPosition?: LabelPosition;
}

/**
 * Bounding box for collision detection
 */
export interface CollisionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Label position result
 */
export type LabelPosition = "right" | "left" | "hidden";

/**
 * Final placement decision for an event
 */
export interface EventPlacement {
  eventId: string;
  subLane: number;
  labelPosition: LabelPosition;
}

/**
 * Data needed for positioning an event
 */
export interface EventPositionData {
  event: TimelineEvent;
  assignment: LaneAssignment;
  row: number;
  isRelatedEvent: boolean;
}

/**
 * Configuration for label positioning
 */
export interface LabelPositionerConfig {
  eventHeight: number;
  circleRadius: number;
  labelGap: number;
  fontSize: number;
  charWidth: number;
}

const DEFAULT_CONFIG: LabelPositionerConfig = {
  eventHeight: 20,
  circleRadius: 4,
  labelGap: 8,
  fontSize: 10,
  charWidth: 6,
};

/**
 * Coordinate conversion functions passed from renderer
 */
export interface CoordinateConverters {
  timeToX: (time: number) => number;
  eventToY: (row: number, subLane: number, isRelatedEvent: boolean) => number;
}

/**
 * Viewport info needed for time calculations
 */
export interface ViewportInfo {
  width: number;
  startTime: number;
  endTime: number;
}

export class LabelPositioner {
  private config: LabelPositionerConfig;

  constructor(config: Partial<LabelPositionerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate label placements for all events
   */
  calculatePlacements(
    events: EventPositionData[],
    connectorBoxes: CollisionBox[],
    converters: CoordinateConverters,
    viewport: ViewportInfo,
  ): EventPlacement[] {
    const { eventHeight, circleRadius, labelGap, charWidth } = this.config;
    const labelHeight = this.config.fontSize + 4;

    // Sort events by time (left to right)
    const sortedEvents = [...events].sort(
      (a, b) => a.assignment.startTime - b.assignment.startTime,
    );

    // Track placed bounds and sub-lane end times
    const placedBounds: EventBounds[] = [];
    const subLaneEndTimes = new Map<string, number>();
    const placements: EventPlacement[] = [];

    const subLanePreference = [0, 1, -1];

    for (const { event, assignment, row, isRelatedEvent } of sortedEvents) {
      const x = converters.timeToX(assignment.startTime);
      const originalSubLane = assignment.subLane ?? 0;
      const labelWidth = event.name.length * charWidth;

      // Helper to calculate bounds for a given sub-lane
      const calcBounds = (subLane: number): EventBounds => {
        const y = converters.eventToY(row, subLane, isRelatedEvent);
        const circleY = y + eventHeight / 2;
        return {
          id: event.id,
          circleX: x,
          circleY,
          circleRadius,
          labelY: circleY - labelHeight / 2,
          labelHeight,
          labelWidth,
          rightLabelX: x + labelGap,
          leftLabelX: x - labelGap - labelWidth,
          subLane,
          row,
          isRelatedEvent,
        };
      };

      // Helper to check if a sub-lane has time overlap
      const hasTimeOverlap = (subLane: number): boolean => {
        const key = `${row}:${subLane}`;
        const endTime = subLaneEndTimes.get(key);
        return endTime !== undefined && assignment.startTime < endTime;
      };

      // Helper to try a position
      const tryPosition = (
        subLane: number,
        labelPos: "right" | "left",
      ): boolean => {
        if (hasTimeOverlap(subLane)) {
          return false;
        }
        const bounds = calcBounds(subLane);
        return !this.checkOverlap(bounds, labelPos, placedBounds, connectorBoxes);
      };

      let chosenSubLane = originalSubLane;
      let chosenLabelPosition: LabelPosition = "right";
      let foundPosition = false;

      if (isRelatedEvent) {
        // Step 1: Try original sub-lane + right label
        if (tryPosition(originalSubLane, "right")) {
          chosenSubLane = originalSubLane;
          chosenLabelPosition = "right";
          foundPosition = true;
        }

        // Step 2: Try alternative sub-lanes
        if (!foundPosition) {
          for (const subLane of subLanePreference) {
            if (subLane === originalSubLane) continue;

            if (tryPosition(subLane, "right")) {
              chosenSubLane = subLane;
              chosenLabelPosition = "right";
              foundPosition = true;
              break;
            }

            if (tryPosition(subLane, "left")) {
              chosenSubLane = subLane;
              chosenLabelPosition = "left";
              foundPosition = true;
              break;
            }
          }
        }

        // Step 3: Try original sub-lane + left label
        if (!foundPosition && tryPosition(originalSubLane, "left")) {
          chosenSubLane = originalSubLane;
          chosenLabelPosition = "left";
          foundPosition = true;
        }

        // Step 4: Hide label
        if (!foundPosition) {
          chosenSubLane = originalSubLane;
          chosenLabelPosition = "hidden";
        }
      } else {
        // Unrelated events: simpler logic
        const bounds = calcBounds(originalSubLane);
        const rightOverlaps = this.checkOverlap(
          bounds,
          "right",
          placedBounds,
          connectorBoxes,
        );

        if (!rightOverlaps) {
          chosenLabelPosition = "right";
        } else {
          const leftOverlaps = this.checkOverlap(
            bounds,
            "left",
            placedBounds,
            connectorBoxes,
          );
          chosenLabelPosition = leftOverlaps ? "hidden" : "left";
        }
        chosenSubLane = originalSubLane;
      }

      // Record placement
      placements.push({
        eventId: event.id,
        subLane: chosenSubLane,
        labelPosition: chosenLabelPosition,
      });

      // Update tracking
      const finalBounds = calcBounds(chosenSubLane);
      finalBounds.labelPosition = chosenLabelPosition;
      placedBounds.push(finalBounds);

      const key = `${row}:${chosenSubLane}`;
      const currentEndTime = subLaneEndTimes.get(key) ?? -Infinity;
      const eventEndTime =
        assignment.startTime +
        ((labelWidth + labelGap + circleRadius * 2) / viewport.width) *
          (viewport.endTime - viewport.startTime);
      subLaneEndTimes.set(key, Math.max(currentEndTime, eventEndTime));
    }

    return placements;
  }

  /**
   * Check if a label at the given position would overlap
   */
  private checkOverlap(
    bounds: EventBounds,
    position: "right" | "left",
    placedBounds: EventBounds[],
    connectorBoxes: CollisionBox[],
  ): boolean {
    const labelX =
      position === "right" ? bounds.rightLabelX : bounds.leftLabelX;
    const labelRight = labelX + bounds.labelWidth;
    const labelTop = bounds.labelY;
    const labelBottom = bounds.labelY + bounds.labelHeight;

    const circleLeft = bounds.circleX - bounds.circleRadius;
    const circleRight = bounds.circleX + bounds.circleRadius;
    const circleTop = bounds.circleY - bounds.circleRadius;
    const circleBottom = bounds.circleY + bounds.circleRadius;

    // Check overlap with placed events
    for (const other of placedBounds) {
      if (other.id === bounds.id) continue;

      const otherCircleLeft = other.circleX - other.circleRadius;
      const otherCircleRight = other.circleX + other.circleRadius;
      const otherCircleTop = other.circleY - other.circleRadius;
      const otherCircleBottom = other.circleY + other.circleRadius;

      // Circle-circle overlap
      if (
        circleLeft < otherCircleRight &&
        circleRight > otherCircleLeft &&
        circleTop < otherCircleBottom &&
        circleBottom > otherCircleTop
      ) {
        return true;
      }

      // Label-circle overlap
      if (
        labelX < otherCircleRight &&
        labelRight > otherCircleLeft &&
        labelTop < otherCircleBottom &&
        labelBottom > otherCircleTop
      ) {
        return true;
      }

      // Label-label overlap
      if (other.labelPosition && other.labelPosition !== "hidden") {
        const otherLabelX =
          other.labelPosition === "right"
            ? other.rightLabelX
            : other.leftLabelX;
        const otherLabelRight = otherLabelX + other.labelWidth;
        const otherLabelTop = other.labelY;
        const otherLabelBottom = other.labelY + other.labelHeight;

        if (
          labelX < otherLabelRight &&
          labelRight > otherLabelX &&
          labelTop < otherLabelBottom &&
          labelBottom > otherLabelTop
        ) {
          return true;
        }
      }
    }

    // Check overlap with connectors
    for (const box of connectorBoxes) {
      const boxRight = box.x + box.width;
      const boxBottom = box.y + box.height;

      if (
        labelX < boxRight &&
        labelRight > box.x &&
        labelTop < boxBottom &&
        labelBottom > box.y
      ) {
        return true;
      }

      if (
        circleLeft < boxRight &&
        circleRight > box.x &&
        circleTop < boxBottom &&
        circleBottom > box.y
      ) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Calculate bounding boxes for connector paths
 * Used for label collision detection
 */
export function sampleConnectorPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  strokeWidth: number = 5,
): CollisionBox[] {
  const boxes: CollisionBox[] = [];
  const horizontalDistance = Math.abs(toX - fromX);
  const maxCurveDistance = 50;
  const padding = strokeWidth / 2 + 2;

  const sigmoid = (t: number) => 1 / (1 + Math.exp(-2 * t));

  const samplePoints: { x: number; y: number }[] = [];
  const limit = 3;
  const numSamples = 20;

  if (horizontalDistance <= maxCurveDistance) {
    for (let i = 0; i <= numSamples; i++) {
      const t = -limit + (i / numSamples) * (2 * limit);
      const normalizedT = (t + limit) / (2 * limit);
      const sigmoidValue = sigmoid(t);
      samplePoints.push({
        x: fromX + normalizedT * (toX - fromX),
        y: fromY + sigmoidValue * (toY - fromY),
      });
    }
  } else {
    const isGoingRight = toX > fromX;
    const curveEndX = isGoingRight
      ? fromX + maxCurveDistance
      : fromX - maxCurveDistance;

    for (let i = 0; i <= numSamples; i++) {
      const t = -limit + (i / numSamples) * (2 * limit);
      const normalizedT = (t + limit) / (2 * limit);
      const sigmoidValue = sigmoid(t);
      samplePoints.push({
        x: fromX + normalizedT * (curveEndX - fromX),
        y: fromY + sigmoidValue * (toY - fromY),
      });
    }

    samplePoints.push({ x: toX, y: toY });
  }

  for (let i = 0; i < samplePoints.length - 1; i++) {
    const p1 = samplePoints[i]!;
    const p2 = samplePoints[i + 1]!;

    const minX = Math.min(p1.x, p2.x) - padding;
    const maxX = Math.max(p1.x, p2.x) + padding;
    const minY = Math.min(p1.y, p2.y) - padding;
    const maxY = Math.max(p1.y, p2.y) + padding;

    boxes.push({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
  }

  return boxes;
}
