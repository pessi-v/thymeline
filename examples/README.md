# Timeline Examples

This directory contains example timeline data files demonstrating various use cases.

## Files

### `timeline-data.json`

A comprehensive example showcasing all supported time input formats and features:

#### Time Input Formats Demonstrated

1. **Geological Time (millions of years ago)**
   ```json
   { "value": 4543, "unit": "mya" }
   ```

2. **Years Ago**
   ```json
   { "value": 10000, "unit": "years-ago" }
   ```

3. **BCE/CE Notation**
   ```json
   { "year": 500, "era": "BCE" }
   { "year": 1492, "era": "CE" }
   ```

4. **ISO 8601 Date String (without time)**
   ```json
   "1945-09-02"
   ```

5. **ISO 8601 DateTime String (UTC)**
   ```json
   "1969-07-20T20:17:00Z"
   ```

6. **Local Time with Timezone**
   ```json
   {
     "localTime": "2018-02-06T15:45:00",
     "timezone": "America/New_York"
   }
   ```

#### Timeline Scales Covered

- **Cosmological**: Big Bang (~13.8 billion years ago)
- **Geological**: Earth formation, eons, eras
- **Prehistoric**: Stone Age, first tools
- **Historical**: Ancient civilizations, BCE/CE dates
- **Modern**: 19th-21st century with specific dates
- **Precise**: Events with exact timestamps

#### Entity Types

- **Events**: 15 point-in-time events spanning from Big Bang to modern day
- **Periods**: 18 time spans covering geological eras to ongoing periods
- **Connectors**: 10 relationships between periods
  - `"defined"`: Clear succession (e.g., WWI → Interwar Period)
  - `"undefined"`: Fuzzy or overlapping relationships (e.g., Middle Ages → Renaissance)

#### Metadata Examples

The example includes various metadata patterns:
- Category classification
- Descriptions
- Geographic locations
- Related data (astronauts, companies, etc.)
- Ongoing period flags

### `simple.ts`

A minimal TypeScript example showing basic usage with geological timescales.

## Usage

### In JavaScript/TypeScript

```typescript
import { TimelineRenderer } from 'thymeline';
import timelineData from './examples/timeline-data.json';

const renderer = new TimelineRenderer('#container');
renderer.render(timelineData);
```

### Loading in HTML

```html
<script type="module">
  import { TimelineRenderer } from './src/index.ts';

  fetch('./examples/timeline-data.json')
    .then(res => res.json())
    .then(data => {
      const renderer = new TimelineRenderer('#timeline');
      renderer.render(data);
    });
</script>
```

## Creating Your Own Timeline Data

### Basic Structure

```json
{
  "events": [...],
  "periods": [...],
  "connectors": [...],
  "config": { /* optional */ }
}
```

### Tips

1. **Choose appropriate time formats** for your scale:
   - Geological events → `{ "value": X, "unit": "mya" }`
   - Historical dates → `{ "year": X, "era": "BCE"|"CE" }`
   - Modern dates → ISO 8601 strings

2. **Use metadata** to store additional information that your application needs

3. **Connector types**:
   - `"defined"`: Clear, direct succession or causation
   - `"undefined"`: Loose relationships, influences, or overlapping periods

4. **IDs must be unique** across all events, periods, and connectors

5. **Periods can overlap** - the layout algorithm will automatically assign them to different lanes
