/**
 * Succession-based lane assignment algorithm for periods
 * Builds trees where children succeed parents on the same row
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
 * Build trees from periods and connectors (only defined connectors)
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
  if (__DEBUG__) console.log(`🔗 Using ${definedConnectors.length} defined connectors out of ${connectors.length} total`);

  // Build adjacency maps
  const childrenMap = new Map<string, string[]>();
  const parentsMap = new Map<string, string[]>();

  definedConnectors.forEach(connector => {
    if (!childrenMap.has(connector.fromId)) {
      childrenMap.set(connector.fromId, []);
    }
    childrenMap.get(connector.fromId)!.push(connector.toId);

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

  if (__DEBUG__) console.log(`🌳 Found ${roots.length} root nodes:`, roots.map(id => `${id} (${periodMap.get(id)?.name})`));

  // Handle DAG: assign multi-parent nodes to oldest root
  const nodeToTreeRoot = new Map<string, string>();

  function findOldestRootAncestor(nodeId: string): { rootId: string; rootStartTime: NormalizedTime } | null {
    const visited = new Set<string>();
    let currentNodes = [nodeId];

    while (currentNodes.length > 0) {
      const nextNodes: string[] = [];
      for (const node of currentNodes) {
        if (visited.has(node)) continue;
        visited.add(node);

        const parents = parentsMap.get(node) || [];
        if (parents.length === 0) {
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

  parentsMap.forEach((parents, childId) => {
    if (parents.length > 1) {
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
      }
    }
  });

  // Build trees
  const placedNodes = new Set<string>();

  function buildNode(periodId: string, currentTreeRoot: string): PeriodNode | null {
    const period = periodMap.get(periodId);
    if (!period) return null;

    if (nodeToTreeRoot.has(periodId) && nodeToTreeRoot.get(periodId) !== currentTreeRoot) {
      return null;
    }

    if (placedNodes.has(periodId)) {
      return null;
    }

    placedNodes.add(periodId);

    const node: PeriodNode = {
      id: periodId,
      name: period.name,
      startTime: period.startTime,
      endTime: period.endTime,
      children: [],
    };

    const children = childrenMap.get(periodId) || [];
    for (const childId of children) {
      const childNode = buildNode(childId, currentTreeRoot);
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
    placedNodes.clear();
    const rootNode = buildNode(rootId, rootId);
    if (rootNode) {
      const allNodeIds = new Set<string>();
      collectAllNodeIds(rootNode, allNodeIds);
      trees.push({ root: rootNode, allNodeIds });
      allNodeIds.forEach(id => connectedPeriodIds.add(id));
    }
  }

  // Sort trees by root start time (oldest first)
  trees.sort((a, b) => a.root.startTime - b.root.startTime);

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
 * Find the longest lineage (latest ending date) in descendants
 */
function findLatestDescendantEnd(node: PeriodNode): NormalizedTime {
  let latest = node.endTime;
  for (const child of node.children) {
    const childLatest = findLatestDescendantEnd(child);
    if (childLatest > latest) {
      latest = childLatest;
    }
  }
  return latest;
}

/**
 * Build the trunk (succession line) recursively
 * Returns array of nodes that form the trunk
 */
function buildTrunk(node: PeriodNode): PeriodNode[] {
  const trunk: PeriodNode[] = [node];

  // Find children that start after this node ends (no overlap)
  const successionChildren = node.children.filter(child => child.startTime >= node.endTime);

  if (successionChildren.length === 0) {
    return trunk;
  }

  // Pick the trunk child:
  // 1. Earliest start time
  // 2. If tied, longest future lineage (latest descendant end)
  let trunkChild = successionChildren[0]!;
  let earliestStart = trunkChild.startTime;
  let longestLineage = findLatestDescendantEnd(trunkChild);

  for (let i = 1; i < successionChildren.length; i++) {
    const child = successionChildren[i]!;
    const childLineage = findLatestDescendantEnd(child);

    if (child.startTime < earliestStart) {
      trunkChild = child;
      earliestStart = child.startTime;
      longestLineage = childLineage;
    } else if (child.startTime === earliestStart && childLineage > longestLineage) {
      trunkChild = child;
      longestLineage = childLineage;
    }
  }

  if (__DEBUG__) console.log(`    🌿 Trunk succession: ${node.id} (${node.name}) → ${trunkChild.id} (${trunkChild.name})`);

  // Recursively build trunk from trunk child
  const childTrunk = buildTrunk(trunkChild);
  trunk.push(...childTrunk);

  return trunk;
}

/**
 * Get branches (children not in trunk) for all nodes in trunk
 */
function getBranches(trunkNodes: PeriodNode[]): PeriodNode[][] {
  const trunkIds = new Set(trunkNodes.map(n => n.id));
  const branches: PeriodNode[][] = [];

  for (const trunkNode of trunkNodes) {
    for (const child of trunkNode.children) {
      if (!trunkIds.has(child.id)) {
        // This is a branch - build its trunk
        const branchTrunk = buildTrunk(child);
        branches.push(branchTrunk);
      }
    }
  }

  return branches;
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
 * Check if placing a period would collide with already placed periods
 */
function hasCollision(
  startTime: NormalizedTime,
  endTime: NormalizedTime,
  lane: number,
  placedPeriods: PlacedPeriod[]
): string | null {
  const collision = placedPeriods.find(
    p => p.lane === lane && periodsOverlap(startTime, endTime, p.startTime, p.endTime)
  );
  return collision ? collision.id : null;
}

/**
 * Check if a trunk can fit on a given lane
 */
function canPlaceTrunk(
  trunk: PeriodNode[],
  lane: number,
  allPlaced: PlacedPeriod[],
  periodMap: Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>
): boolean {
  // Check if entire trunk can fit on this lane
  for (const node of trunk) {
    const collision = hasCollision(node.startTime, node.endTime, lane, allPlaced);
    if (collision) {
      const collidingPeriod = periodMap.get(collision);
      if (__DEBUG__) console.log(`    ❌ Collision with ${collision} (${collidingPeriod?.name})`);
      return false;
    }
  }
  return true;
}

/**
 * Place a trunk on a given lane (assumes no collision)
 */
function placeTrunkOnLane(
  trunk: PeriodNode[],
  lane: number,
  placements: PlacedPeriod[]
): void {
  if (__DEBUG__) console.log(`  📍 Placing trunk on lane ${lane}:`, trunk.map(n => `${n.id} (${n.name})`).join(' → '));

  for (const node of trunk) {
    placements.push({
      id: node.id,
      lane,
      startTime: node.startTime,
      endTime: node.endTime,
    });
  }

  if (__DEBUG__) console.log(`    ✅ Placed trunk on lane ${lane}`);
}

/**
 * Layout a single tree using succession-based algorithm
 */
function layoutTree(
  tree: PeriodTree,
  startLane: number,
  existingPlacements: PlacedPeriod[],
  periodMap: Map<string, { name: string; startTime: NormalizedTime; endTime: NormalizedTime }>
): { placements: PlacedPeriod[]; minLane: number; maxLane: number } {
  const placements: PlacedPeriod[] = [];

  if (__DEBUG__) console.log(`\n🌲 Building trunk for tree: ${tree.root.id} (${tree.root.name})`);

  // Build main trunk
  const mainTrunk = buildTrunk(tree.root);
  if (__DEBUG__) console.log(`  🎯 Main trunk has ${mainTrunk.length} periods`);

  // Find a lane where the trunk fits, starting from startLane
  let trunkLane = startLane;
  const maxAttempts = 100;
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (trunkLane < 0) {
      if (__DEBUG__) console.log(`  🔽 Need negative lane (${trunkLane}), pushing tree down`);
      trunkLane = 0;
      attempts++;
      continue;
    }

    const allPlaced = [...existingPlacements, ...placements];
    if (canPlaceTrunk(mainTrunk, trunkLane, allPlaced, periodMap)) {
      placeTrunkOnLane(mainTrunk, trunkLane, placements);
      break;
    }

    trunkLane++;
    attempts++;
  }

  // Track trunk lanes and their placement direction
  interface TrunkInfo {
    trunk: PeriodNode[];
    parentLane: number;
    isAboveParent: boolean | null; // null for main trunk
  }

  const trunkQueue: TrunkInfo[] = [{ trunk: mainTrunk, parentLane: trunkLane, isAboveParent: null }];
  const trunkLanes = new Map<string, number>(); // Map trunk root ID to its lane
  trunkLanes.set(mainTrunk[0]!.id, trunkLane);

  let queueIndex = 0;
  while (queueIndex < trunkQueue.length) {
    const { trunk, parentLane, isAboveParent } = trunkQueue[queueIndex]!;
    const isMainTrunk = isAboveParent === null;

    // Find branches of this trunk
    const currentBranches = getBranches(trunk);

    if (currentBranches.length > 0) {
      if (__DEBUG__) console.log(`  🌿 Found ${currentBranches.length} branches for trunk: ${trunk[0]!.name}`);
    }

    // Determine placement strategy based on parent direction
    let aboveOffset = 1;
    let belowOffset = 1;
    let placeAbove = isMainTrunk ? true : isAboveParent!; // Continue in parent's direction

    for (let i = 0; i < currentBranches.length; i++) {
      const branch = currentBranches[i]!;
      const branchRootId = branch[0]!.id;
      if (__DEBUG__) console.log(`\n  🔸 Placing branch ${i + 1}/${currentBranches.length}: ${branch.map(n => n.name).join(' → ')}`);

      let branchLane: number;
      let placed = false;
      attempts = 0;

      while (!placed && attempts < maxAttempts) {
        if (placeAbove) {
          branchLane = parentLane + aboveOffset;
        } else {
          branchLane = parentLane - belowOffset;
        }

        if (branchLane < 0) {
          if (__DEBUG__) console.log(`    🔽 Need negative lane (${branchLane}), pushing whole tree down`);
          // Push entire tree down and restart
          trunkLane++;
          placements.length = 0;
          placeTrunkOnLane(mainTrunk, trunkLane, placements);

          // Reset everything
          trunkQueue.length = 1;
          trunkQueue[0] = { trunk: mainTrunk, parentLane: trunkLane, isAboveParent: null };
          trunkLanes.clear();
          trunkLanes.set(mainTrunk[0]!.id, trunkLane);
          queueIndex = -1; // Will be incremented to 0
          break;
        }

        const allPlaced = [...existingPlacements, ...placements];
        if (canPlaceTrunk(branch, branchLane, allPlaced, periodMap)) {
          placeTrunkOnLane(branch, branchLane, placements);
          placed = true;

          // Track this branch's lane
          trunkLanes.set(branchRootId, branchLane);

          // Add to queue for processing its sub-branches
          const branchIsAbove = branchLane > parentLane;
          trunkQueue.push({ trunk: branch, parentLane: branchLane, isAboveParent: branchIsAbove });

          // Advance offset for next branch
          if (placeAbove) {
            aboveOffset++;
          } else {
            belowOffset++;
          }

          // Only alternate for main trunk; sub-branches continue in same direction
          if (isMainTrunk) {
            placeAbove = !placeAbove;
          }
        } else {
          // Try moving away from parent
          if (placeAbove) {
            aboveOffset++;
          } else {
            belowOffset++;
          }
        }

        attempts++;
      }
    }

    queueIndex++;
  }

  // Calculate bounds
  const lanes = placements.map(p => p.lane);
  const minLane = lanes.length > 0 ? Math.min(...lanes) : trunkLane;
  const maxLane = lanes.length > 0 ? Math.max(...lanes) : trunkLane;

  return { placements, minLane, maxLane };
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
 * Succession-based period layout algorithm
 */
export const successionPeriodLayout: PeriodLayoutAlgorithm = {
  name: 'Succession-based',
  description: 'Periods that succeed each other are placed on the same row',

  layout(periods: TimelinePeriod[], connectors: TimelineConnector[] = []): LaneAssignment[] {
    if (periods.length === 0) {
      return [];
    }

    if (__DEBUG__) console.log('👑 Succession Layout Algorithm Starting');
    if (__DEBUG__) console.log('📊 Input:', { periods: periods.length, connectors: connectors.length });

    // Build trees from connectors
    const { trees, unconnectedPeriods, periodMap } = buildTrees(periods, connectors);

    if (__DEBUG__) console.log('🌳 Trees built:', {
      treeCount: trees.length,
      unconnectedPeriods: unconnectedPeriods.size
    });

    trees.forEach((tree, idx) => {
      if (__DEBUG__) console.log(`  Tree ${idx}: root=${tree.root.id} (${tree.root.name}), nodes=${tree.allNodeIds.size}`);
    });

    // Layout trees (already sorted by age)
    const allPlacements: PlacedPeriod[] = [];
    let nextStartLane = 0;

    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i]!;
      if (__DEBUG__) console.log(`\n📐 Laying out Tree ${i} (root: ${tree.root.id} "${tree.root.name}") starting at lane ${nextStartLane}`);

      const { placements, maxLane } = layoutTree(tree, nextStartLane, allPlacements, periodMap);

      if (__DEBUG__) console.log(`  ✅ Tree ${i} placed:`, placements.map(p => `${p.id}:L${p.lane}`).join(', '));
      if (__DEBUG__) console.log(`  📏 Lanes used: ${Math.min(...placements.map(p => p.lane))} to ${maxLane}`);

      allPlacements.push(...placements);
      nextStartLane = maxLane + 1;
    }

    // Place individual periods
    if (__DEBUG__) console.log('\n🔹 Placing unconnected periods...');
    const individualPlacements = placeIndividualPeriods(unconnectedPeriods, allPlacements);

    if (individualPlacements.length > 0) {
      if (__DEBUG__) console.log('  ✅ Unconnected placed:', individualPlacements.map(p => `${p.id}:L${p.lane}`).join(', '));
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

    if (__DEBUG__) console.log('\n✨ Final lane assignments:');
    result.forEach(a => {
      if (__DEBUG__) console.log(`  ${a.itemId}: lane ${a.lane}`);
    });
    if (__DEBUG__) console.log('👑 Succession Layout Complete\n');

    return result;
  },
};
