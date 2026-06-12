// @vitest-environment jsdom
/**
 * Tests for connector clickability and info popups
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { TimelineRenderer } from '../src/renderer/TimelineRenderer';
import type { TimelineData } from '../src/core/types';

beforeAll(() => {
  // jsdom does not implement getBBox; approximate text measurement
  (SVGElement.prototype as any).getBBox = function () {
    return { x: 0, y: 0, width: (this.textContent?.length ?? 0) * 6, height: 10 };
  };
});

const data: TimelineData = {
  periods: [
    { id: 'p1', name: 'Period A', startTime: '1900-01-01', endTime: '1950-01-01' },
    { id: 'p2', name: 'Period B', startTime: '1950-01-01', endTime: '2000-01-01' },
  ],
  events: [],
  connectors: [
    { id: 'c1', fromId: 'p1', toId: 'p2', type: 'defined', info: 'Succession details' },
  ],
};

describe('connector interaction', () => {
  let container: HTMLElement;
  let renderer: TimelineRenderer;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    renderer = new TimelineRenderer(container, {
      width: 800,
      height: 400,
      initialStartTime: '1890-01-01',
      initialEndTime: '2010-01-01',
    });
    renderer.render(data);
  });

  it('renders the connector as a clickable group with a widened hit area', () => {
    const group = container.querySelector('g#c1') as SVGGElement;
    expect(group).not.toBeNull();
    expect(group.style.cursor).toBe('pointer');

    const paths = Array.from(group.querySelectorAll('path'));
    expect(paths.length).toBeGreaterThanOrEqual(2);

    const hitArea = paths.find((p) => p.getAttribute('stroke') === 'transparent');
    expect(hitArea).toBeDefined();
    expect(hitArea!.getAttribute('stroke-width')).toBe('14');
    expect(hitArea!.style.pointerEvents).toBe('stroke');
  });

  it('shows an info popup with period names and info on click', () => {
    const group = container.querySelector('g#c1') as SVGGElement;
    group.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));

    const popup = document.querySelector('.info-popup-content');
    expect(popup).not.toBeNull();
    expect(popup!.textContent).toContain('Period A → Period B');
    expect(popup!.textContent).toContain('Succession details');
  });

  it('emits itemClick with the connector', () => {
    let clicked: unknown = null;
    renderer.on('itemClick', (item: unknown) => {
      clicked = item;
    });

    const group = container.querySelector('g#c1') as SVGGElement;
    group.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));

    expect(clicked).toMatchObject({ id: 'c1', fromId: 'p1', toId: 'p2' });
  });
});
