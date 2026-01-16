# Thymeline

A standalone TypeScript library that renders interactive, zoomable timelines spanning from geological to modern time scales.

## Features

- **Flexible Time Scales**: From geological (billions of years) to precise (milliseconds)
- **Clean, Minimalist Design**: SVG-based rendering with customizable themes
- **Interactive Zoom & Pan**: Smooth navigation across time scales
- **Smart Layout**: Automatic lane assignment to prevent overlaps
- **Relationships**: Connect periods with visual connectors
- **Events & Periods**: Support for both point-in-time events and time spans
- **Zero Dependencies**: Lightweight and self-contained
- **Multiple Time Formats**: ISO 8601, BCE/CE, geological time, and more

## Installation

```bash
npm install thymeline
```

## Quick Start

```typescript
import { TimelineRenderer } from "thymeline";

// Create timeline data
const data = {
  events: [
    {
      id: "event1",
      name: "Moon Landing",
      time: "1969-07-20T20:17:00Z",
    },
  ],
  periods: [
    {
      id: "period1",
      name: "World War II",
      startTime: "1939-09-01",
      endTime: "1945-09-02",
    },
  ],
  connectors: [],
};

// Initialize renderer
const renderer = new TimelineRenderer("#timeline-container", {
  width: 800,
  height: 400,
});

// Render timeline
renderer.render(data);
```

## API

### Constructor

```typescript
const renderer = new TimelineRenderer(selector, options);
```

**Options:**

- `width?: number` - Width in pixels (default: container width)
- `height?: number` - Height in pixels (default: container height)
- `initialStartTime?: TimeInput` - Initial viewport start time
- `initialEndTime?: TimeInput` - Initial viewport end time
- `minZoom?: number` - Minimum zoom level (default: 0.1)
- `maxZoom?: number` - Maximum zoom level (default: 100)
- `theme?: 'light' | 'dark' | 'custom'` - Visual theme
- `constraints?: RenderConstraints` - Element sizing constraints

### Methods

#### Rendering

```typescript
renderer.render(timelineData: TimelineData): void
```

#### Zoom Controls

```typescript
renderer.zoomIn(): void
renderer.zoomOut(): void
renderer.zoomTo(startTime: TimeInput, endTime: TimeInput): void
renderer.setZoomLevel(level: number): void
```

#### Pan Controls

```typescript
renderer.panTo(centerTime: TimeInput): void
renderer.panBy(deltaPixels: number): void
```

#### Data Manipulation

```typescript
renderer.addEvent(event: TimelineEvent): void
renderer.addPeriod(period: TimelinePeriod): void
renderer.addConnector(connector: TimelineConnector): void
renderer.removeItem(id: string): void
renderer.updateItem(id: string, updates: Partial<TimelineEvent | TimelinePeriod>): void
```

#### Export

```typescript
renderer.toSVG(): string
renderer.toPNG(): Promise<Blob>
```

#### Cleanup

```typescript
renderer.destroy(): void
```

### Events

```typescript
renderer.on('zoom', (zoomLevel: number) => void)
renderer.on('pan', (centerTime: number) => void)
renderer.on('itemClick', (item: TimelineEvent | TimelinePeriod) => void)
renderer.on('itemHover', (item: TimelineEvent | TimelinePeriod | null) => void)
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build library
npm run build

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Project Structure

```
thymeline/
├── src/
│   ├── core/          # Core type definitions
│   ├── layout/        # Lane assignment algorithms
│   ├── renderer/      # Main renderer implementation
│   └── utils/         # Utility functions (time normalization, etc.)
├── tests/             # Test files
├── examples/          # Example implementations
└── dist/              # Built library (generated)
```

## Implementation Status

This is a work in progress. Current implementation includes:

- Core type definitions
- Time normalization system
- Basic lane assignment algorithm
- Renderer class structure
- SVG rendering
- Zoom and pan interactions
- Connector routing
- Visual polish and styling
- Export functionality

See [timeline-renderer-design.md](./timeline-renderer-design.md) for the initial design document.

## License

MIT
