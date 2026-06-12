/**
 * Tests for the succession period layout algorithm,
 * focused on collision-freeness and whitespace minimization
 */

import { describe, it, expect } from 'vitest';
import { successionPeriodLayout } from '../src/layout/algorithms/successionPeriodLayout';
import type { TimelinePeriod, TimelineConnector, LaneAssignment } from '../src/core/types';

import twoTrees from '../examples/two-trees.json';
import twoComplexTrees from '../examples/two-complex-trees.json';
import oneComplexTree from '../examples/one-complex-tree.json';

function layout(periods: TimelinePeriod[], connectors: TimelineConnector[]): LaneAssignment[] {
  return successionPeriodLayout.layout(periods, connectors);
}

function assertNoCollisions(assignments: LaneAssignment[]) {
  for (const a of assignments) {
    for (const b of assignments) {
      if (a.itemId === b.itemId || a.lane !== b.lane) continue;
      const overlap = a.startTime < b.endTime && b.startTime < a.endTime;
      expect(overlap, `${a.itemId} and ${b.itemId} overlap on lane ${a.lane}`).toBe(false);
    }
  }
}

function laneCount(assignments: LaneAssignment[]): number {
  return new Set(assignments.map(a => a.lane)).size;
}

function period(id: string, start: string, end: string): TimelinePeriod {
  return { id, name: id, startTime: start, endTime: end };
}

function connector(fromId: string, toId: string): TimelineConnector {
  return { id: `${fromId}-${toId}`, fromId, toId, type: 'defined' };
}

describe('successionPeriodLayout', () => {
  describe('example timelines', () => {
    const examples = [
      ['two-trees', twoTrees],
      ['two-complex-trees', twoComplexTrees],
      ['one-complex-tree', oneComplexTree],
    ] as const;

    for (const [name, data] of examples) {
      it(`produces a collision-free layout for ${name}`, () => {
        const assignments = layout(
          data.periods as TimelinePeriod[],
          data.connectors as TimelineConnector[]
        );
        expect(assignments).toHaveLength(data.periods.length);
        assertNoCollisions(assignments);
      });
    }
  });

  it('keeps a succession chain on a single lane', () => {
    const periods = [
      period('a', '1000-01-01', '1100-01-01'),
      period('b', '1100-01-01', '1200-01-01'),
      period('c', '1200-01-01', '1300-01-01'),
    ];
    const connectors = [connector('a', 'b'), connector('b', 'c')];

    const assignments = layout(periods, connectors);
    const lanes = new Set(assignments.map(a => a.lane));
    expect(lanes.size).toBe(1);
  });

  it('lets time-disjoint trees share lanes instead of stacking', () => {
    // Tree 1: ancient succession with an overlapping branch (uses 2 lanes)
    const periods = [
      period('t1a', '1000-01-01', '1100-01-01'),
      period('t1b', '1100-01-01', '1200-01-01'),
      period('t1branch', '1050-01-01', '1150-01-01'),
      // Tree 2: modern succession, entirely disjoint in time from tree 1
      period('t2a', '1900-01-01', '1950-01-01'),
      period('t2b', '1950-01-01', '2000-01-01'),
    ];
    const connectors = [
      connector('t1a', 't1b'),
      connector('t1a', 't1branch'),
      connector('t2a', 't2b'),
    ];

    const assignments = layout(periods, connectors);
    assertNoCollisions(assignments);

    // Tree 2 fits next to tree 1's trunk, so 2 lanes total — not 3 (stacked)
    expect(laneCount(assignments)).toBe(2);
  });

  it('produces consecutive lane numbers (no empty lanes)', () => {
    const data = twoComplexTrees;
    const assignments = layout(
      data.periods as TimelinePeriod[],
      data.connectors as TimelineConnector[]
    );

    const lanes = [...new Set(assignments.map(a => a.lane))].sort((x, y) => x - y);
    expect(lanes[0]).toBe(0);
    expect(lanes[lanes.length - 1]).toBe(lanes.length - 1);
  });

  it('places unconnected periods into gaps left by trees', () => {
    const periods = [
      period('a', '1000-01-01', '1100-01-01'),
      period('b', '1100-01-01', '1200-01-01'),
      // Unconnected, disjoint in time from the chain
      period('solo', '1300-01-01', '1400-01-01'),
    ];
    const connectors = [connector('a', 'b')];

    const assignments = layout(periods, connectors);
    assertNoCollisions(assignments);
    expect(laneCount(assignments)).toBe(1);
  });

  it('handles ongoing periods (no endTime) without collisions', () => {
    const periods: TimelinePeriod[] = [
      period('a', '1900-01-01', '1950-01-01'),
      { id: 'ongoing', name: 'ongoing', startTime: '1950-01-01' },
      period('late', '1990-01-01', '2000-01-01'),
    ];
    const connectors = [connector('a', 'ongoing')];

    const assignments = layout(periods, connectors);
    assertNoCollisions(assignments);

    // 'late' overlaps the ongoing period, so it needs its own lane
    const ongoingLane = assignments.find(a => a.itemId === 'ongoing')!.lane;
    const lateLane = assignments.find(a => a.itemId === 'late')!.lane;
    expect(lateLane).not.toBe(ongoingLane);
  });
});
