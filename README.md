# react-native-dither-charts

Dithered chart primitives for React Native Skia.

This is intentionally focused: it is not trying to replace every charting library. The goal is to give common mobile data views the dithered rendering, touch feedback, and composable controls that make them feel considered.

## Components

- `DitherBarChart`
- `DitherStackedBar`
- `DitherLineChart`
- `DitherMultiLineChart`
- `DitherAreaChart`
- `DitherStackedAreaChart`
- `DitherPieChart` / `DitherDonutChart`
- `DitherRadarChart`
- `DitherRangeFilter` — a "1D / 1W / 1M / 3M / 1Y / All" segmented timeframe picker

## Install

```sh
yarn add react-native-dither-charts @shopify/react-native-skia
```

In an Expo app, let Expo select compatible native versions:

```sh
npx expo install @shopify/react-native-skia react-native-reanimated react-native-worklets
```

## Example

```tsx
import { DitherBarChart, ditherPalette } from "react-native-dither-charts";

const data = [
  { label: "Mon", value: 24 },
  { label: "Tue", value: 44 },
  { label: "Wed", value: 32 }
];

export function Demo() {
  return (
    <DitherBarChart
      data={data}
      width={320}
      height={180}
      color={ditherPalette.blue}
      dither={{
        variant: "gradient",
        cellSize: 4,
        startDensity: 0.18,
        endDensity: 1
      }}
    />
  );
}
```

## Axes

Every chart can render its own axis labels — off by default, so existing usage is unaffected.

```tsx
<DitherBarChart
  data={data}
  width={320}
  height={180}
  xAxis={{ visible: true }}
  yAxis={{
    visible: true,
    ticks: 4,
    labelColor: "#73727E",
    formatLabel: (value) => `${Math.round(value)}k`
  }}
/>
```

`xAxis` and `yAxis` are configured independently. Set `visible: false` or omit one to hide it. Both accept
`size` (the label gutter's width/height), `formatLabel`, `labelColor`, `fontSize`, and `fontFamily`; the
y-axis also accepts `ticks`. Visible axes use space inside the `width`/`height` you pass, so the component's
outer footprint stays stable.

## Scrubbing & tooltips

Drag a finger across a Cartesian chart to read the nearest datum. Scrubbing, its guide, and the tooltip are
separate decisions: you can show both, either one, or neither and use only the callback.

```tsx
<DitherAreaChart
  data={data}
  width={320}
  height={180}
  scrub={{
    showLine: true,
    showDot: true,
    lineColor: "#777681",
    dotRadius: 3
  }}
  tooltip={{ formatValue: (value) => `$${value}` }}
  onScrub={(info) => {
    // `values` contains every series at this index on multi-series charts.
    setHeaderValues(info?.values ?? []);
  }}
/>
```

`scrub` can be `true` or an object with `showLine`, `showDot`, line styling, dot styling, and halo styling.
It works without a tooltip. `onScrub` receives `{ index, datum, value, values, x, y }` while active and
`null` on release.

`tooltip` can be `true`, a style/formatter object, or a render function for a fully custom component:

```tsx
<DitherMultiLineChart
  labels={months}
  series={series}
  width={320}
  height={180}
  scrub={{ showLine: true, showDot: false }}
  tooltip={({ x, datum, values }) => (
    <ChartTooltip x={x} label={datum.label} values={values ?? []} />
  )}
/>
```

Set `tooltip={false}` to keep the guide and use `onScrub` to render the active values elsewhere.

## Series focus

Multi-series area, bar, and radar charts can dim the other series when one is tapped. Scrubbing temporarily
restores every series so comparison remains legible.

```tsx
<DitherStackedAreaChart
  data={data}
  width={320}
  height={180}
  focusOnPress
  dimOpacity={0.2}
  focusedSeries={focusedSeries}
  onSeriesFocus={setFocusedSeries}
/>
```

Omit `focusedSeries` for internal state, or pass it for a controlled chart. Use `focusOnPress={false}` to
disable the behavior.

`DitherMultiLineChart` deliberately keeps every line visible: comparison is its primary job. Each series can
still provide its own `dither`, while omitted series styles inherit the chart-level ordered dither.

Pie and donut charts use a different selection model. Tapping a slice expands it without muting the rest:

```tsx
<DitherDonutChart
  data={browserShare}
  width={320}
  height={320}
  activeScale={1.055}
  baseOpacity={0.16}
  tooltip={{ position: "point" }}
  onSliceFocus={setActiveSlice}
/>
```

Radar charts also accept `scrub`, `tooltip`, and `onScrub`. Their guide follows the nearest category axis
and reports every series value at that vertex.

## Range filter

`DitherRangeFilter` is a plain, uncontrolled-free segmented control — you own the `value` and swap your
chart's data source in `onChange`:

```tsx
import { DitherRangeFilter, defaultDitherRanges } from "react-native-dither-charts";

const [range, setRange] = useState("1M"); // one of defaultDitherRanges' keys: 1D, 1W, 1M, 3M, 1Y, ALL

<DitherRangeFilter value={range} onChange={setRange} />
```

Pass a custom `ranges` array to use different keys/labels (e.g. just `["1W", "1M", "ALL"]`).

## Local Development

Use the Node version in `.nvmrc` first. The example targets Expo SDK 54 so it runs in the matching Expo Go
runtime on a physical iPhone.

```sh
nvm use
yarn install
yarn example
```

The example app uses Expo and resolves `react-native-dither-charts` directly from
`package/src` through the Yarn workspace, so renderer edits update without
reinstalling a copied package.
