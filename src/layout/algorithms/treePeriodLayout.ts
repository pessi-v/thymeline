/**
 * Tree-based lane assignment algorithm for periods
 * Groups connected periods into trees and layouts them hierarchically
 */

import type { TimelinePeriod, TimelineConnector, LaneAssignment, NormalizedTime } from '../../core/types';
import { normalizeTime } from '../../utils/timeNormalization';
import type { PeriodLayoutAlgorithm } from '../laneAssignment';

interface PeriodNode {
  id: string;
  name: string;
  startTime: NormalizedTime;
  endTime: NormalizedTime;
  children: PeriodNode[];
  connectorType?: 'defined' | 'undefined';
}

interface PeriodTree {
  root: PeriodNode;
  allNodeIds: Set<string>;
}

interface PlacedPeriod {
  id: string;
  lane: number;
  startTime: NormalizedTime;
  endTime: NormalizedTime;
}

/**
 * Build trees from periods and connectors
 * Each tree has the oldest (earliest start time) period as root
 * Only considers "defined" connectors for tree building
 * For DAG structures (nodes with multiple parents), assigns each node to the tree with the oldest root ancestor
 */
function buildTrees(
  periods: TimelinePeriod[],
  connectors: TimelineConnector[]
): {
  trees: PeriodTree[];
  unconnectedPeriods: Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>;
  periodMap: Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>;
} {
  // Create a map of periods
  const periodMap = new Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>();
  periods.forEach(period => {
    periodMap.set(period.id, {
      name: period.name,
      startTime: normalizeTime(period.startTime),
      endTime: normalizeTime(period.endTime),
    });
  });

  // Filter to only use "defined" connectors for tree building
  const definedConnectors = connectors.filter(c => c.type === 'defined');
  console.log(`🔗 Using ${definedConnectors.length} defined connectors out of ${connectors.length} total`);

  // Build adjacency maps
  const childrenMap = new Map<string, string[]>(); // parent -> children IDs
  const parentsMap = new Map<string, string[]>(); // child -> parent IDs

  definedConnectors.forEach(connector => {
    // Track children
    if (!childrenMap.has(connector.fromId)) {
      childrenMap.set(connector.fromId, []);
    }
    childrenMap.get(connector.fromId)!.push(connector.toId);

    // Track parents
    if (!parentsMap.has(connector.toId)) {
      parentsMap.set(connector.toId, []);
    }
    parentsMap.get(connector.toId)!.push(connector.fromId);
  });

  // Find roots (nodes with no parents)
  const roots: string[] = [];
  const allNodesInConnectors = new Set([
    ...definedConnectors.map(c => c.fromId),
    ...definedConnectors.map(c => c.toId)
  ]);

  allNodesInConnectors.forEach(nodeId => {
    if (!parentsMap.has(nodeId)) {
      roots.push(nodeId);
    }
  });

  const rootsWithNames = roots.map(id => `${id} (${periodMap.get(id)?.name})`);
  console.log(`🌳 Found ${roots.length} root nodes:`, rootsWithNames);

  // For each node, find the oldest root ancestor
  function findOldestRootAncestor(nodeId: string): { rootId: string; rootStartTime: NormalizedTime } | null {
    const visited = new Set<string>();
    let currentNodes = [nodeId];

    // Traverse up to find all roots
    while (currentNodes.length > 0) {
      const nextNodes: string[] = [];
      for (const node of currentNodes) {
        if (visited.has(node)) continue;
        visited.add(node);

        const parents = parentsMap.get(node) || [];
        if (parents.length === 0) {
          // This is a root
          const period = periodMap.get(node);
          if (period) {
            return { rootId: node, rootStartTime: period.startTime };
          }
        } else {
          nextNodes.push(...parents);
        }
      }
      currentNodes = nextNodes;
    }

    return null;
  }

  // For nodes with multiple parents, determine which tree they belong to
  const nodeToTreeRoot = new Map<string, string>();
  const nodesWithMultipleParents: string[] = [];

  parentsMap.forEach((parents, childId) => {
    if (parents.length > 1) {
      nodesWithMultipleParents.push(childId);
      const childName = periodMap.get(childId)?.name || childId;
      const parentsWithNames = parents.map(id => `${id} (${periodMap.get(id)?.name})`);
      console.log(`🔀 Node ${childId} (${childName}) has ${parents.length} parents:`, parentsWithNames);

      // Find oldest root among all possible ancestors
      let oldestRoot: { rootId: string; rootStartTime: NormalizedTime } | null = null;

      for (const parentId of parents) {
        const rootInfo = findOldestRootAncestor(parentId);
        if (rootInfo) {
          if (!oldestRoot || rootInfo.rootStartTime < oldestRoot.rootStartTime) {
            oldestRoot = rootInfo;
          }
        }
      }

      if (oldestRoot) {
        nodeToTreeRoot.set(childId, oldestRoot.rootId);
        const rootName = periodMap.get(oldestRoot.rootId)?.name || oldestRoot.rootId;
        console.log(`  ➜ Assigned ${childId} (${childName}) to tree with root ${oldestRoot.rootId} (${rootName}) (oldest ancestor)`);
      }
    }
  });

  // Track which nodes have been placed to avoid duplicates
  const placedNodes = new Set<string>();

  // Build trees recursively, respecting the node-to-tree assignments
  function buildNode(periodId: string, currentTreeRoot: string, connectorType?: 'defined' | 'undefined'): PeriodNode | null {
    const period = periodMap.get(periodId);
    if (!period) return null;

    // If this node has multiple parents and doesn't belong to this tree, skip it
    if (nodeToTreeRoot.has(periodId) && nodeToTreeRoot.get(periodId) !== currentTreeRoot) {
      const belongsToRoot = nodeToTreeRoot.get(periodId);
      const currentRootName = periodMap.get(currentTreeRoot)?.name || currentTreeRoot;
      const belongsToName = belongsToRoot ? periodMap.get(belongsToRoot)?.name : belongsToRoot;
      console.log(`⏭️  Skipping ${periodId} (${period.name}) in tree ${currentTreeRoot} (${currentRootName}) (belongs to tree ${belongsToRoot} (${belongsToName}))`);
      return null;
    }

    // If this node was already placed in this tree, skip it (prevents cycles)
    if (placedNodes.has(periodId)) {
      console.log(`🔄 Skipping ${periodId} (${period.name}) (already placed, avoiding duplicate)`);
      return null;
    }

    placedNodes.add(periodId);

    const node: PeriodNode = {
      id: periodId,
      name: period.name,
      startTime: period.startTime,
      endTime: period.endTime,
      children: [],
      connectorType,
    };

    const children = childrenMap.get(periodId) || [];
    for (const childId of children) {
      const childNode = buildNode(childId, currentTreeRoot, 'defined');
      if (childNode) {
        node.children.push(childNode);
      }
    }

    // Sort children by start time
    node.children.sort((a, b) => a.startTime - b.startTime);

    return node;
  }

  const trees: PeriodTree[] = [];
  const connectedPeriodIds = new Set<string>();

  function collectAllNodeIds(node: PeriodNode, ids: Set<string>) {
    ids.add(node.id);
    node.children.forEach(child => collectAllNodeIds(child, ids));
  }

  // Build each tree
  for (const rootId of roots) {
    placedNodes.clear(); // Reset for each tree
    const rootNode = buildNode(rootId, rootId);
    if (rootNode) {
      const allNodeIds = new Set<string>();
      collectAllNodeIds(rootNode, allNodeIds);
      trees.push({ root: rootNode, allNodeIds });
      allNodeIds.forEach(id => connectedPeriodIds.add(id));
    }
  }

  // Find unconnected periods
  const unconnectedPeriods = new Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>();
  periodMap.forEach((period, id) => {
    if (!connectedPeriodIds.has(id)) {
      unconnectedPeriods.set(id, period);
    }
  });

  return { trees, unconnectedPeriods, periodMap };
}

/**
 * Check if two periods overlap in time
 */
function periodsOverlap(
  start1: NormalizedTime,
  end1: NormalizedTime,
  start2: NormalizedTime,
  end2: NormalizedTime
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Check if a period collides with any placed periods
 */
function hasCollision(
  startTime: NormalizedTime,
  endTime: NormalizedTime,
  lane: number,
  placedPeriods: PlacedPeriod[]
): boolean {
  return placedPeriods.some(
    p => p.lane === lane && periodsOverlap(startTime, endTime, p.startTime, p.endTime)
  );
}

/**
 * Check if placing a node at a given lane would collide with a specific tree
 * Returns the ID of the colliding period, or null if no collision
 */
function collidesWithTree(
  startTime: NormalizedTime,
  endTime: NormalizedTime,
  lane: number,
  placedPeriods: PlacedPeriod[],
  treeNodeIds: Set<string>
): string | null {
  const collision = placedPeriods.find(
    p => treeNodeIds.has(p.id) && p.lane === lane && periodsOverlap(startTime, endTime, p.startTime, p.endTime)
  );
  return collision ? collision.id : null;
}

/**
 * Check if placing a node would collide with other trees
 */
function collidesWithOtherTrees(
  startTime: NormalizedTime,
  endTime: NormalizedTime,
  lane: number,
  placedPeriods: PlacedPeriod[],
  currentTreeNodeIds: Set<string>
): boolean {
  return placedPeriods.some(
    p => !currentTreeNodeIds.has(p.id) && p.lane === lane && periodsOverlap(startTime, endTime, p.startTime, p.endTime)
  );
}

/**
 * Layout a single tree starting at a given parent lane
 * Returns the placed periods for this tree and the min/max lanes used
 */
function layoutTree(
  tree: PeriodTree,
  startParentLane: number,
  existingPlacements: PlacedPeriod[],
  periodMap: Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>
): { placements: PlacedPeriod[]; minLane: number; maxLane: number } {
  const placements: PlacedPeriod[] = [];
  let parentLane = startParentLane;
  let attemptCount = 0;
  const maxAttempts = 100;

  while (attemptCount < maxAttempts) {
    placements.length = 0; // Clear previous attempt

    // Try to place root
    if (hasCollision(tree.root.startTime, tree.root.endTime, parentLane, existingPlacements)) {
      parentLane++;
      attemptCount++;
      continue;
    }

    // Place root
    placements.push({
      id: tree.root.id,
      lane: parentLane,
      startTime: tree.root.startTime,
      endTime: tree.root.endTime,
    });

    // Try to place children
    const success = placeChildren(
      tree.root.children,
      parentLane,
      [...existingPlacements, ...placements],
      placements,
      tree.allNodeIds,
      periodMap
    );

    if (success) {
      break;
    }

    // Failed - push tree down and try again
    parentLane++;
    attemptCount++;
  }

  // Calculate bounds
  const lanes = placements.map(p => p.lane);
  const minLane = Math.min(...lanes);
  const maxLane = Math.max(...lanes);

  return { placements, minLane, maxLane };
}

/**
 * Recursively place children of a node
 * Returns true if successful, false if we need to retry with tree pushed down
 */
function placeChildren(
  children: PeriodNode[],
  parentLane: number,
  allPlaced: PlacedPeriod[],
  currentTreePlacements: PlacedPeriod[],
  treeNodeIds: Set<string>,
  periodMap: Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>
): boolean {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const placed = tryPlaceChild(child, i, parentLane, allPlaced, currentTreePlacements, treeNodeIds, periodMap);

    if (!placed) {
      return false; // Need to push whole tree down
    }
  }
  return true;
}

/**
 * Try to place a child node using the alternating strategy
 */
function tryPlaceChild(
  child: PeriodNode,
  _childIndex: number,
  parentLane: number,
  allPlaced: PlacedPeriod[],
  currentTreePlacements: PlacedPeriod[],
  treeNodeIds: Set<string>,
  periodMap: Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>
): boolean {
  console.log(`    🔸 Placing child: ${child.id} (${child.name}) (parent lane: ${parentLane})`);

  // Generate lane attempts: same, +1, -1, +2, -2, +3, -3, etc.
  const laneAttempts = [parentLane];
  for (let offset = 1; offset <= 20; offset++) {
    laneAttempts.push(parentLane + offset);
    laneAttempts.push(parentLane - offset);
  }

  for (const lane of laneAttempts) {
    if (lane < 0) {
      console.log(`      🔽 Lane ${lane} is negative - need to push whole tree down`);
      return false; // Need to push whole tree down to make room above
    }

    console.log(`      Trying lane ${lane}...`);

    const allPlacedIncludingCurrent = [...allPlaced, ...currentTreePlacements];

    // Check collision with same tree
    const sameTreeCollision = collidesWithTree(child.startTime, child.endTime, lane, allPlacedIncludingCurrent, treeNodeIds);
    if (sameTreeCollision) {
      const collidingPeriod = periodMap.get(sameTreeCollision);
      const collidingName = collidingPeriod?.name || sameTreeCollision;
      console.log(`      ❌ Collision with same tree at lane ${lane}: ${sameTreeCollision} (${collidingName})`);
      continue; // Try next lane offset
    }

    // Check collision with other trees
    if (collidesWithOtherTrees(child.startTime, child.endTime, lane, allPlacedIncludingCurrent, treeNodeIds)) {
      console.log(`      ⛔ Collision with OTHER tree at lane ${lane} - need to push whole tree down`);
      return false; // Need to push whole tree down
    }

    // No collision - place it
    console.log(`      ✅ Placed ${child.id} (${child.name}) at lane ${lane}`);
    currentTreePlacements.push({
      id: child.id,
      lane,
      startTime: child.startTime,
      endTime: child.endTime,
    });

    // Recursively place this child's children
    if (child.children.length > 0) {
      console.log(`      📎 ${child.id} (${child.name}) has ${child.children.length} children, placing them...`);
      const success = placeChildren(child.children, lane, allPlaced, currentTreePlacements, treeNodeIds, periodMap);
      if (!success) {
        // Remove this child and return false
        console.log(`      ❌ Failed to place children of ${child.id} (${child.name}), removing it`);
        currentTreePlacements.pop();
        return false;
      }
    }

    return true;
  }

  console.log(`    ⚠️ Could not place ${child.id} (${child.name}) anywhere`);
  return false; // Could not place
}

/**
 * Greedily place individual periods in gaps
 */
function placeIndividualPeriods(
  unconnectedPeriods: Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>,
  existingPlacements: PlacedPeriod[]
): PlacedPeriod[] {
  const placements: PlacedPeriod[] = [];

  // Sort by start time
  const sorted = Array.from(unconnectedPeriods.entries()).sort((a, b) => a[1].startTime - b[1].startTime);

  for (const [id, period] of sorted) {
    // Find first available lane
    let lane = 0;
    const allPlaced = [...existingPlacements, ...placements];

    while (hasCollision(period.startTime, period.endTime, lane, allPlaced)) {
      lane++;
    }

    placements.push({
      id,
      lane,
      startTime: period.startTime,
      endTime: period.endTime,
    });
  }

  return placements;
}

/**
 * Tree-based period layout algorithm
 */
export const treePeriodLayout: PeriodLayoutAlgorithm = {
  name: 'Tree-based',
  description: 'Groups connected periods into trees and layouts hierarchically',

  layout(periods: TimelinePeriod[], connectors: TimelineConnector[] = []): LaneAssignment[] {
    if (periods.length === 0) {
      return [];
    }

    console.log('🌲 Tree Layout Algorithm Starting');
    console.log('📊 Input:', { periods: periods.length, connectors: connectors.length });

    // Build trees from connectors
    const { trees, unconnectedPeriods, periodMap } = buildTrees(periods, connectors);

    console.log('🌳 Trees built:', {
      treeCount: trees.length,
      unconnectedPeriods: unconnectedPeriods.size
    });

    trees.forEach((tree, idx) => {
      console.log(`  Tree ${idx}: root=${tree.root.id} (${tree.root.name}), nodes=${tree.allNodeIds.size}`);
    });

    // Layout trees
    const allPlacements: PlacedPeriod[] = [];
    let nextParentLane = 0;

    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i]!;
      console.log(`\n📐 Laying out Tree ${i} (root: ${tree.root.id} "${tree.root.name}") starting at lane ${nextParentLane}`);

      const { placements, maxLane } = layoutTree(tree, nextParentLane, allPlacements, periodMap);

      console.log(`  ✅ Tree ${i} placed:`, placements.map(p => `${p.id}:L${p.lane}`).join(', '));
      console.log(`  📏 Lanes used: ${Math.min(...placements.map(p => p.lane))} to ${maxLane}`);

      allPlacements.push(...placements);
      nextParentLane = maxLane + 1;
    }

    // Place individual periods
    console.log('\n🔹 Placing unconnected periods...');
    const individualPlacements = placeIndividualPeriods(unconnectedPeriods, allPlacements);

    if (individualPlacements.length > 0) {
      console.log('  ✅ Unconnected placed:', individualPlacements.map(p => `${p.id}:L${p.lane}`).join(', '));
    }

    allPlacements.push(...individualPlacements);

    // Convert to LaneAssignment format
    const result = allPlacements.map(p => ({
      itemId: p.id,
      lane: p.lane,
      startTime: p.startTime,
      endTime: p.endTime,
      type: 'period' as const,
    }));

    console.log('\n✨ Final lane assignments:');
    result.forEach(a => {
      console.log(`  ${a.itemId}: lane ${a.lane}`);
    });
    console.log('🌲 Tree Layout Complete\n');

    return result;
  },
};
