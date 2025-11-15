# Thymeline - Project Overview

## Description

Thymeline is an interactive timeline visualization library built with TypeScript. It supports rendering events and periods across vast timescales, from geological time (billions of years ago) to precise modern dates, with interactive zoom and pan capabilities.

## Key Features

### 1. Flexible Time Input
- ISO 8601 date strings
- JavaScript Date objects
- BCE/CE notation: `{ year: 2500, era: 'BCE' }`
- Geological time: `{ value: 4500, unit: 'mya' }` (millions of years ago)
- Years ago: `{ value: 10000, unit: 'years-ago' }`
- Timezone-aware times: `{ localTime: '2024-01-01T12:00:00', timezone: 'America/New_York' }`

### 2. Interactive Controls
- **Zoom**: Mouse wheel, zoom buttons, or double-click to zoom to point
- **Pan**: Click and drag, or programmatic pan controls
- **Viewport Management**: Automatic bounds clamping to data range
- **Maximum Zoom Out**: Automatically shows all data with 5% padding
- **Zoom-to-Point**: Double-click centers zoom on clicked position

### 3. Visual Elements
- **Periods**: Rendered as black pill-shaped rectangles (fully rounded ends)
- **Events**: Hollow black circles with labels
- **Connectors**: Arrows showing relationships between periods
  - Solid lines for "defined" relationships
  - Dashed lines for "undefined" relationships
- **Time Axis**: Dynamic tick marks with formatted labels (10 ticks)
- **Big Bang Boundary**: Visual limit at -13.8 billion years with static noise effect

### 4. Lane-Based Layout
- Repeating block pattern: 1 period row + 3 event rows
- Automatic lane assignment using greedy algorithm
- Prevents overlapping items within lanes
- Separate lane groups for periods and events

### 5. Validation System
- Duplicate ID detection
- Invalid time format checking
- Temporal logic validation (periods with start > end)
- Big Bang time limit enforcement (-13.8 billion years)
- Connector reference validation
- Warning system for temporal anomalies

### 6. Big Bang Visualization
- Hard limit at -13.8 billion years ago
- Static noise effect using SVG feTurbulence filter
- Dashed boundary line
- No time labels before Big Bang
- Enhanced noise with high frequency (2.5) and octaves (5)

## Project Structure

```
thymeline/
├── src/
│   ├── core/
│   │   └── types.ts              # TypeScript type definitions
│   ├── layout/
│   │   └── laneAssignment.ts     # Lane assignment algorithm
│   ├── renderer/
│   │   └── TimelineRenderer.ts   # Main renderer class
│   ├── utils/
│   │   ├── timeNormalization.ts  # Time format conversion
│   │   └── validation.ts         # Data validation utilities
│   └── index.ts                  # Public API exports
├── examples/
│   ├── timeline-data.json        # Comprehensive example (Big Bang to future)
│   ├── modern-future.json        # Modern timeline (2000-2050)
│   └── ...                       # Other example timelines
├── index.html                    # Demo page
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
└── vitest.config.ts              # Vitest test configuration

## File Descriptions

### Core Files

#### `src/core/types.ts`
Defines all TypeScript interfaces and types:
- `TimeInput`: Union type for all supported time formats
- `TimelineEvent`: Point-in-time events
- `TimelinePeriod`: Time spans with start and end
- `TimelineConnector`: Relationships between periods
- `TimelineConfig`: Configuration options
- `TimelineData`: Complete data structure
- `LaneAssignment`: Layout information with lane and type
- `ViewportState`: Current zoom/pan state
- Callback types for events

#### `src/index.ts`
Public API exports:
- TimelineRenderer class (default export)
- All type definitions
- Utility functions (normalizeTime, formatTime, assignLanes, etc.)
- Validation utilities

### Layout System

#### `src/layout/laneAssignment.ts`
Implements lane assignment algorithm:
- `assignLanes()`: Greedy algorithm for non-overlapping layout
- Separates periods and events into different lane groups
- Returns `LaneAssignment[]` with lane numbers and types
- `getLaneCount()`: Calculates total lanes needed
- `overlaps()`: Helper for overlap detection

**Algorithm**:
1. Sort items by start time
2. For each item, find first available lane without overlap
3. If no lane available, create new lane
4. Events limited to 3 lanes (uses earliest end time if full)

### Rendering System

#### `src/renderer/TimelineRenderer.ts`
Main rendering class (845 lines):

**Key Methods**:
- `render(data)`: Load and render timeline data
- `zoomIn()`, `zoomOut()`, `zoomTo()`: Zoom controls
- `setZoomLevel(level, centerTime?)`: Zoom with optional center point
- `panTo()`, `panBy()`: Pan controls
- `addEvent()`, `addPeriod()`, `addConnector()`: Dynamic data manipulation
- `toSVG()`: Export as SVG string
- `on()`: Event listener registration

**Private Rendering Methods**:
- `renderTimeline()`: Main render loop
- `renderTimeAxis()`: Time axis with ticks and labels
- `renderPeriod()`: Black pill-shaped rectangles
- `renderEvent()`: Hollow circles with labels
- `renderConnector()`: Arrows between periods
- `renderBigBangBoundary()`: Static noise effect before Big Bang

**Layout Calculations**:
- `laneToY()`: Converts lane number to Y position
  - Block-based layout: 1 period + 3 events per block
  - Period height: 20px
  - Event height: 20px per row
  - Gaps: 10px after period, 5px between events, 15px between blocks
- `timeToX()`: Converts normalized time to pixel position
- `xToTime()`: Converts pixel position to normalized time

**Interaction Handling**:
- `setupDragToPan()`: Mouse drag, double-click, wheel zoom
- `handleDoubleClick()`: Zoom in centered on click position
- Double-click detection: 300ms threshold

**Viewport Management**:
- `calculateDataTimeRange()`: Finds min/max times in data
- `recalculateViewportBounds()`: Updates start/end from center
- Automatic clamping to data range with padding
- Maximum zoom out shows all data

### Utilities

#### `src/utils/timeNormalization.ts`
Converts all time formats to normalized years from 0 CE:
- `normalizeTime(input)`: Main conversion function
- `formatTime(time)`: Convert normalized time back to string
- `determineTimeScale()`: Auto-detect appropriate time scale
- Handles BCE (negative years), geological time (millions of years)
- Timezone conversion support

**Examples**:
- `2024-01-01` → `2024`
- `{ year: 500, era: 'BCE' }` → `-500`
- `{ value: 4500, unit: 'mya' }` → `-4,500,000,000`

#### `src/utils/validation.ts`
Data validation system:
- `validateTimelineData()`: Main validation function
- `formatValidationResult()`: Human-readable output
- `BIG_BANG_TIME`: Constant (-13,800,000,000 years)

**Validation Checks**:
- Duplicate IDs across all items
- Invalid time formats
- Periods with start > end
- Events/periods before Big Bang
- Connector references to non-existent periods
- Temporal warnings for connectors (when periods don't overlap)

**Return Type**: `ValidationResult`
- `valid`: boolean
- `errors`: Array of error objects
- `warnings`: Array of warning objects

### Examples

#### `examples/timeline-data.json`
Comprehensive example with 15 events, 18 periods, 10 connectors:
- Geological events (Big Bang, Earth formation)
- Ancient history (Pyramids, Roman Empire)
- Modern events (Moon landing, AI milestones)
- Future projections (Mars colony, climate goals)
- Demonstrates all time input formats

#### `examples/modern-future.json`
Focused timeline 2000-2050:
- 19 events (tech milestones, global events)
- 10 periods (tech eras, conflicts, pandemics)
- Good for testing modern time scales

### Configuration Files

#### `package.json`
Latest dependencies (as of project creation):
- TypeScript 5.9.3
- Vite 7.0.5
- Vitest 4.0.0
- vite-plugin-dts 4.5.4 (type declaration generation)

**Scripts**:
- `dev`: Start dev server
- `build`: Build library for distribution
- `test`: Run tests with Vitest

#### `tsconfig.json`
Strict TypeScript configuration:
- ES2020 target
- Strict mode enabled
- Declaration files generated
- Source maps enabled

#### `vite.config.ts`
Library build configuration:
- Entry: `src/index.ts`
- Output: UMD and ES modules
- External: No external dependencies in bundle
- Type declarations via vite-plugin-dts

### Demo Page

#### `index.html`
Interactive demo with:
- Timeline selector dropdown (switch between JSON files)
- Zoom in/out buttons
- Debug info display (zoom level, viewport times)
- Validation result display
- Dynamic width calculation (98% viewport width)
- Resize handler with debouncing

## Technical Implementation Details

### Time Normalization
All times internally represented as `NormalizedTime` (number of years from 0 CE):
- Positive values: CE/AD years
- Negative values: BCE years
- Large negative values: Geological time

### SVG Rendering
All rendering done with SVG:
- `document.createElementNS()` for element creation
- Dynamic attribute setting
- SVG filters for noise effect (feTurbulence)
- No external SVG libraries

### Viewport Calculation
```typescript
viewport = {
  startTime: centerTime - range/2,
  endTime: centerTime + range/2,
  zoomLevel: number,
  centerTime: number
}
```

Zoom changes range inversely:
- Higher zoom = smaller range (more detail)
- Lower zoom = larger range (more overview)

### Big Bang Noise Effect
SVG filter implementation:
```xml
<filter id="noise-filter">
  <feTurbulence type="fractalNoise" baseFrequency="2.5" numOctaves="5"/>
  <feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1 0"/>
</filter>
```
Applied to rectangle with 0.95 opacity

### Connector Logic
Prevents backwards-in-time connections:
```typescript
const connectionTime = Math.min(fromEndTime, toStartTime)
```
Connects at overlap point if periods overlap, or at start of "to" period if they don't.

## Usage Example

```typescript
import TimelineRenderer from 'thymeline';

// Create renderer
const renderer = new TimelineRenderer('#timeline-container', {
  width: 1200,
  height: 600,
  theme: 'light'
});

// Load data
const data = {
  events: [
    { id: 'e1', name: 'Moon Landing', time: '1969-07-20' }
  ],
  periods: [
    {
      id: 'p1',
      name: 'Space Age',
      startTime: '1957-10-04',
      endTime: '1975-07-17'
    }
  ],
  connectors: []
};

// Validate and render
const validation = validateTimelineData(data);
if (validation.valid) {
  renderer.render(data);
} else {
  console.error(formatValidationResult(validation));
}

// Add interactivity
renderer.on('zoom', (level) => console.log('Zoom:', level));
renderer.on('pan', (center) => console.log('Center:', center));
```

## Development Notes

### Build Process
1. TypeScript compilation with strict mode
2. Vite bundles for UMD and ES modules
3. Type declarations generated automatically
4. No external runtime dependencies

### Testing Strategy
- Vitest for unit tests
- jsdom for DOM testing
- Happy DOM as lightweight alternative

### Design Decisions

1. **Monochrome Theme**: Black periods and events for professional look
2. **Block Layout**: Repeating pattern ensures visual consistency
3. **Big Bang Limit**: Prevents nonsensical dates before universe
4. **Greedy Algorithm**: Simple, fast lane assignment
5. **SVG Rendering**: Scalable, programmatic, no image assets
6. **Zoom Centering**: Double-click zooms to point for intuitive navigation
7. **Viewport Clamping**: Prevents panning/zooming beyond data
8. **Static Noise**: Visual metaphor for unknowable pre-Big Bang era

## Future Considerations

- PNG export implementation (`toPNG()` method stubbed)
- Additional themes (dark mode already supported in types)
- Custom event/period styling via metadata
- Animation support for transitions
- Touch/mobile gesture support
- Minimap/overview navigator
- Search/filter functionality
- Clustering for dense timelines
