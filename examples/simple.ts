/**
 * Simple example demonstrating basic timeline usage
 */

import { TimelineRenderer } from '../src/index';
import type { TimelineData } from '../src/index';

// Create timeline data
const timelineData: TimelineData = {
  events: [
    {
      id: 'event1',
      name: 'Big Bang',
      time: { value: 13800, unit: 'mya' },
    },
    {
      id: 'event2',
      name: 'Earth Formation',
      time: { value: 4543, unit: 'mya' },
    },
    {
      id: 'event3',
      name: 'First Life',
      time: { value: 3800, unit: 'mya' },
    },
  ],
  periods: [
    {
      id: 'period1',
      name: 'Mesozoic Era',
      startTime: { value: 252, unit: 'mya' },
      endTime: { value: 66, unit: 'mya' },
    },
    {
      id: 'period2',
      name: 'Cenozoic Era',
      startTime: { value: 66, unit: 'mya' },
      endTime: new Date().toISOString(),
    },
  ],
  connectors: [
    {
      id: 'conn1',
      fromId: 'period1',
      toId: 'period2',
      type: 'defined',
    },
  ],
};

// Initialize and render
const renderer = new TimelineRenderer('#timeline', {
  width: 800,
  height: 400,
});

renderer.render(timelineData);
