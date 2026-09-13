A single vital reading with optional delta vs previous and a critical (out-of-range) flag — color + icon + position, never color alone.

```jsx
<VitalStat label="Blood pressure" value="128/84" unit="mmHg" delta="+6" deltaDir="up" icon="heart-pulse" />
<VitalStat label="Temperature" value="38.9" unit="°C" critical compact />
```

`deltaDir`: up|down|flat. `critical` flags out-of-range values (coral tint + alert glyph). `compact` for dense grids.
