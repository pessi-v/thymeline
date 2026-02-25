# Timeline Renderer - Design Document

## Project Overview

A standalone TypeScript library that renders interactive, zoomable timelines spanning from geological to modern time scales. The renderer accepts structured JSON data and outputs an HTML element containing an SVG timeline.

## Core Specifications

### Technology Stack

- **Language**: TypeScript
- **Output Format**: HTML element containing SVG
- **Distribution**: NPM package
- **Build Tool**: TBD (Vite, Rollup, or similar)
- **Testing**: TBD (Jest, Vitest, or similar)

### Input Format

JSON structure containing three main entity types:

```typescript
interface TimelineData {
  events: TimelineEvent[];
  periods: TimelinePeriod[];
  connectors: TimelineConnector[];
  config?: TimelineConfig;
}

interface TimelineEvent {
  id: string;
  name: string;
  time: TimeInput;
  metadata?: Record<string, any>;
}

interface TimelinePeriod {
  id: string;
  name: string;
  startTime: TimeInput;
  endTime: TimeInput;
  metadata?: Record<string, any>;
}

interface TimelineConnector {
  id: string;
  fromId: string; // References period id
  toId: string; // References period id
  type: "defined" | "undefined"; // e.g., succession vs. lineage
  metadata?: Record<string, any>;
}

// Flexible time input formats
type TimeInput =
  | string // ISO 8601 date string
  | Date // JavaScript Date object
  | { year: number; era: "BCE" | "CE" }
  | { value: number; unit: "mya" | "years-ago" }
  | { localTime: string; timezone: string };
```

### Time Representation

**Reference Point**: 0 CE (Common Era year 0)

**Internal Normalization**: All times converted to "years from reference point" (fractional years for precision)

- Geological time: -4,543,000,000 (Earth formation)
- Historical BCE: negative values
- Historical CE/modern: positive values
- Future events: positive values beyond current year

**Time Zone Handling**:

- Store all times in UTC internally
- Accept timezone information in input where relevant
- Display times in UTC by default
- Precision appropriate to scale (geological events don't need time-of-day)

**Supported Time Scales**:

- Geological (billions/millions of years)
- Prehistoric (hundreds of thousands of years)
- Historical (thousands of years)
- Modern (years/months/days)
- Precise (with time-of-day)

### Layout Algorithm

**Lane Assignment**: Greedy algorithm

1. Sort periods by start time
2. For each period, find the first available lane where it fits without overlap
3. If no lane available, create a new lane
4. Assign lane number to period

**Collision Detection**:

- Periods overlap if: `period1.end > period2.start && period1.start < period2.end`
- Events treated as zero-duration periods for collision purposes

**Connector Routing**:

- Connect periods across lanes with lines/curves
- Route around other elements when possible
- Different visual styles for 'defined' vs 'undefined' relationships

### Rendering Strategy

**Dynamic Rendering**: No pre-calculated zoom levels

- Calculate layout (lanes) once on data load
- Recalculate pixel positions on every zoom/pan
- Cull off-screen elements for performance

**Zoom Behavior**:

- Zoom out: longer time span visible, elements shrink to minimum size
- Zoom in: shorter time span visible, elements grow to maximum size
- Non-linear scaling: time range changes independently from element sizes

**Element Size Constraints**:

```typescript
interface RenderConstraints {
  minEventWidth: number; // Minimum pixel width for events
  maxEventWidth: number; // Maximum pixel width for events
  minPeriodHeight: number; // Minimum pixel height for periods
  laneHeight: number; // Vertical spacing between lanes
  laneGap: number; // Gap between lanes
}
```

### Visual Design

**Style Philosophy**: Clean, minimalist, graphical

**Color Palette**:

- Primary: Black and white
- Grayscale for hierarchy and depth
- Optional: User-configurable accent colors via metadata

**Typography**:

- Sans-serif fonts
- Label visibility based on available space
- Truncation with ellipsis for long names
- Optional tooltips for full information

**Visual Elements**:

- **Events**: Vertical markers or small shapes
- **Periods**: Horizontal bars/rectangles
- **Connectors**: Lines (solid for defined, dashed for undefined relationships)
- **Time axis**: Minimal grid lines, adaptive labels based on zoom level

**Responsive Behavior**:

- Container-aware sizing
- Adaptive label density
- Mobile-friendly interactions (touch support)

## API Design

### Initialization

```typescript
import TimelineRenderer from '@yourname/timeline-renderer';

const renderer = new TimelineRenderer('#container', {
  width?: number;           // Default: container width
  height?: number;          // Default: container height
  initialStartTime?: TimeInput;
  initialEndTime?: TimeInput;
  minZoom?: number;
  maxZoom?: number;
  theme?: 'light' | 'dark' | 'custom';
  constraints?: RenderConstraints;
});
```

### Methods

```typescript
// Render timeline with data
renderer.render(timelineData: TimelineData): void;

// Zoom controls
renderer.zoomIn(): void;
renderer.zoomOut(): void;
renderer.zoomTo(startTime: TimeInput, endTime: TimeInput): void;
renderer.setZoomLevel(level: number): void;

// Pan controls
renderer.panTo(centerTime: TimeInput): void;
renderer.panBy(deltaPixels: number): void;

// Data manipulation
renderer.addEvent(event: TimelineEvent): void;
renderer.addPeriod(period: TimelinePeriod): void;
renderer.addConnector(connector: TimelineConnector): void;
renderer.removeItem(id: string): void;
renderer.updateItem(id: string, updates: Partial<TimelineEvent | TimelinePeriod>): void;

// Export
renderer.toSVG(): string;
renderer.toPNG(): Promise<Blob>;
renderer.destroy(): void;

// Events
renderer.on('zoom', callback: (zoomLevel: number) => void): void;
renderer.on('pan', callback: (centerTime: number) => void): void;
renderer.on('itemClick', callback: (item: TimelineEvent | TimelinePeriod) => void): void;
renderer.on('itemHover', callback: (item: TimelineEvent | TimelinePeriod | null) => void): void;
```

## Implementation Phases

### Phase 1: Core Foundation

- [ ] Project setup (TypeScript, build tooling, testing)
- [ ] Time normalization system
- [ ] Basic data structures and types
- [ ] Simple SVG rendering (no interactions)

### Phase 2: Layout Engine

- [ ] Greedy lane assignment algorithm
- [ ] Collision detection
- [ ] Basic connector routing
- [ ] Period and event positioning

### Phase 3: Rendering & Interaction

- [ ] Zoom implementation (recalculate positions)
- [ ] Pan implementation
- [ ] Element size constraints
- [ ] Label visibility logic
- [ ] Touch/mouse event handling

### Phase 4: Visual Polish

- [ ] Minimalist styling
- [ ] Responsive container sizing
- [ ] Tooltips
- [ ] Animations/transitions
- [ ] Theme support

### Phase 5: Advanced Features

- [ ] Export functionality (SVG, PNG)
- [ ] Performance optimization (virtualization for large datasets)
- [ ] Advanced connector routing
- [ ] Undo/redo for data manipulation
- [ ] Accessibility (ARIA labels, keyboard navigation)

### Phase 6: Documentation & Distribution

- [ ] API documentation
- [ ] Interactive examples
- [ ] NPM package publishing
- [ ] GitHub repository setup
- [ ] Demo website

## Technical Considerations

### Performance

- **Virtualization**: Render only visible elements when dealing with thousands of items
- **Debouncing**: Debounce zoom/pan recalculations
- **RAF**: Use requestAnimationFrame for smooth animations
- **Memoization**: Cache layout calculations when data hasn't changed

### Browser Support

- Target: Modern evergreen browsers (Chrome, Firefox, Safari, Edge)
- SVG support required
- ES2020+ features acceptable

### Accessibility

- ARIA labels for timeline elements
- Keyboard navigation support
- Screen reader announcements for interactions
- High contrast mode support

### Testing Strategy

- Unit tests for time normalization
- Unit tests for layout algorithms
- Integration tests for rendering
- Visual regression tests
- Performance benchmarks

## Open Questions / Future Considerations

1. **Calendar Systems**: Should we support Julian calendar for historical dates?
2. **Uncertainty Ranges**: How to represent "circa 500 BCE" or fuzzy dates?
3. **Multiple Timelines**: Support for multiple parallel timelines in one view?
4. **Custom Shapes**: Allow custom SVG shapes for events/periods?
5. **Animation**: Should zoom/pan be animated by default?
6. **Internationalization**: Date formatting for different locales?
7. **Server-Side Rendering**: Support for Node.js SSR of static SVGs?
8. **Plugins**: Architecture for extensibility (custom renderers, layouts)?

## Related Rails Gem

A companion Ruby on Rails gem (optional, separate package) will provide:

- ActiveRecord models for Timeline, Event, Period, Connector
- Serializers to output proper JSON format
- View helpers for easy integration
- Example controllers and routes

The Rails gem is a thin data layer - all rendering logic stays in the TypeScript package.

---

**Document Version**: 0.1  
**Last Updated**: 2024-11-13  
**Status**: Initial Design
