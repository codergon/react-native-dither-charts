import type { ViewStyle } from "react-native";
import type { ReactNode } from "react";

export type ChartDatum = {
  label?: string;
  value: number;
  color?: string;
};

export type StackedChartDatum = {
  label?: string;
  segments: Array<{
    value: number;
    color?: string;
    dither?: DitherOptions;
  }>;
};

export type LineChartDatum = {
  label?: string;
  value: number;
};

export type LineSeries = {
  label: string;
  values: number[];
  color?: string;
  dither?: DitherOptions;
};

export type RadarSeries = {
  label: string;
  values: number[];
  color?: string;
  dither?: DitherOptions;
};

export type DitherOptions = {
  variant?: "gradient" | "dotted" | "hatched" | "crosshatch" | "solid";
  /** @deprecated Use variant instead. */
  pattern?: "dots" | "diagonal" | "crosshatch";
  cellSize?: number;
  startDensity?: number;
  endDensity?: number;
  /** Progress through the fill where the dither resolves to fully solid color. Defaults to 0.94. */
  solidFrom?: number;
  /** Optional top-to-bottom color ramp for gradient dithering. */
  gradientColors?: [string, string];
  direction?: "top-to-bottom" | "bottom-to-top";
  dotSize?: number;
  gap?: number;
  opacity?: number;
  jitter?: number;
  strokeWidth?: number;
  color?: string;
};

/**
 * Controls a single axis rendered alongside a chart.
 *
 * `formatLabel` receives different arguments depending on which axis it is
 * attached to: the y-axis passes the numeric tick value, the x-axis passes
 * the datum for that position (plus its index either way).
 */
export type AxisConfig = {
  visible?: boolean;
  /** Number of tick labels for the y-axis. Ignored on the x-axis. Defaults to 4. */
  ticks?: number;
  /** Width (y-axis) or height (x-axis) reserved for the label gutter. */
  size?: number;
  /**
   * Horizontal breathing room (in px) for the first/last x-axis label, so they don't
   * sit flush against the edges when the chart itself is rendered full-bleed. Ignored
   * on the y-axis.
   */
  labelInset?: number;
  formatLabel?: (value: any, index: number) => string;
  labelColor?: string;
  fontSize?: number;
  fontFamily?: string;
};

export type ScrubGuideConfig = {
  showLine?: boolean;
  showDot?: boolean;
  lineColor?: string;
  lineWidth?: number;
  lineOpacity?: number;
  dotColor?: string;
  dotRadius?: number;
  haloRadius?: number;
  haloOpacity?: number;
};

export type TooltipRenderInfo<T = any> = {
  index: number;
  datum: T;
  value: number;
  values?: number[];
  x: number;
  y?: number;
  width: number;
  height?: number;
};

export type TooltipRenderer<T = any> = (info: TooltipRenderInfo<T>) => ReactNode;

export type TooltipConfig = {
  formatValue?: (value: number, datum: any, index: number) => string;
  formatLabel?: (datum: any, index: number) => string;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  width?: number;
  /** Keep Cartesian tooltips above the chart, or anchor them near the active point. */
  position?: "top" | "point";
  render?: TooltipRenderer;
};

export type TooltipProp = boolean | TooltipConfig | TooltipRenderer;

/** Emitted while the user scrubs across a chart; `null` once they lift their finger. */
export type ScrubInfo<T> =
  | {
      index: number;
      datum: T;
      value: number;
      values?: number[];
      x: number;
      y?: number;
      seriesIndex?: number;
    }
  | null;

export type ChartBaseProps = {
  width: number;
  height: number;
  style?: ViewStyle;
  backgroundColor?: string;
  dither?: DitherOptions;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  /** Pass `true` for a default-styled tooltip, or an object to customize it. */
  tooltip?: TooltipProp;
  /** Enables scrubbing without requiring a tooltip and configures its guide marks. */
  scrub?: boolean | ScrubGuideConfig;
};

export type SeriesFocusProps = {
  /** Tap a series to focus it. Tap the focused series again to clear. Defaults to true. */
  focusOnPress?: boolean;
  /** Controlled focused series index. Omit to let the chart manage focus internally. */
  focusedSeries?: number | null;
  /** Opacity multiplier applied to unfocused series. Defaults to 0.24. */
  dimOpacity?: number;
  onSeriesFocus?: (seriesIndex: number | null) => void;
};

export type ItemFocusProps = {
  /** Tap an item to focus it. Tap it again to clear. Defaults to true. */
  focusOnPress?: boolean;
  /** Controlled focused item index. Omit to let the chart manage focus internally. */
  focusedIndex?: number | null;
  /** Opacity multiplier applied to unfocused items. Defaults to 0.24. */
  dimOpacity?: number;
  /** Dither progress where the focused item begins its denser active transition. Defaults to 0.9. */
  activeSolidFrom?: number;
  /** Focus transition duration in milliseconds. Defaults to 180. */
  focusAnimationDuration?: number;
  onItemFocus?: (itemIndex: number | null) => void;
};

export type BarChartProps = ChartBaseProps & ItemFocusProps & {
  data: ChartDatum[];
  barRadius?: number;
  maxValue?: number;
  color?: string;
  fillOpacity?: number;
  spacing?: number;
  onScrub?: (info: ScrubInfo<ChartDatum>) => void;
};

export type StackedBarChartProps = ChartBaseProps & ItemFocusProps & {
  data: StackedChartDatum[];
  barRadius?: number;
  maxValue?: number;
  spacing?: number;
  colors?: string[];
  fillOpacity?: number;
  onScrub?: (info: ScrubInfo<StackedChartDatum>) => void;
};

export type StackedAreaChartProps = ChartBaseProps & SeriesFocusProps & {
  data: StackedChartDatum[];
  maxValue?: number;
  colors?: string[];
  fillOpacity?: number;
  strokeWidth?: number;
  showSeriesLines?: boolean;
  curve?: "linear" | "smooth";
  /** Dither progress where the focused series begins its denser active transition. Defaults to 0.9. */
  activeSolidFrom?: number;
  /** Focus transition duration in milliseconds. Defaults to 180. */
  focusAnimationDuration?: number;
  onScrub?: (info: ScrubInfo<StackedChartDatum>) => void;
};

export type LineChartProps = ChartBaseProps & {
  data: LineChartDatum[];
  /** Overrides the value the top of the chart represents. Defaults to the data's own max — pass a larger value to reserve empty headroom above the curve (e.g. for a pinned tooltip). */
  maxValue?: number;
  /** Overrides the value the bottom of the chart represents. Defaults to 0 — set this near the data's own min for a windowed "price chart" look instead of always anchoring to zero. */
  minValue?: number;
  color?: string;
  strokeWidth?: number;
  fillColor?: string;
  fillOpacity?: number;
  showArea?: boolean;
  /**
   * Renders the line as a dithered band of this width around itself — the same
   * technique DitherMultiLineChart uses per series — instead of a plain stroke.
   * Takes priority over `showArea` and replaces the center-line stroke entirely
   * (so `futureColor` has no effect while a band is active).
   */
  bandWidth?: number;
  curve?: "linear" | "smooth";
  onScrub?: (info: ScrubInfo<LineChartDatum>) => void;
  /**
   * While scrubbing, renders the portion of the line after the touched point in this
   * color instead of `color` — e.g. a ticker chart fading out everything past "now"
   * relative to a historical point you're inspecting. No effect while not scrubbing.
   */
  futureColor?: string;
};

export type MultiLineChartProps = ChartBaseProps & {
  labels: string[];
  series: LineSeries[];
  maxValue?: number;
  bandWidth?: number;
  strokeWidth?: number;
  curve?: "linear" | "smooth";
  colors?: string[];
  fillOpacity?: number;
  onScrub?: (info: ScrubInfo<{ label: string; values: number[] }>) => void;
};

export type PieChartProps = {
  data: ChartDatum[];
  width: number;
  height: number;
  style?: ViewStyle;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  gapAngle?: number;
  colors?: string[];
  dither?: DitherOptions;
  /** Pale color beneath the dither keeps the inner edge readable. Defaults to 0.16. */
  baseOpacity?: number;
  focusedIndex?: number | null;
  /** Outer-radius expansion applied to a selected slice. Defaults to 1.025. */
  activeScale?: number;
  /** Dither progress where the focused slice begins its denser active transition. Defaults to 0.9. */
  activeSolidFrom?: number;
  /** Focus transition duration in milliseconds. Defaults to 180. */
  focusAnimationDuration?: number;
  focusOnPress?: boolean;
  tooltip?: TooltipProp;
  onSliceFocus?: (index: number | null) => void;
  onScrub?: (info: ScrubInfo<ChartDatum>) => void;
};

export type RadarChartProps = SeriesFocusProps & {
  categories: string[];
  series: RadarSeries[];
  width: number;
  height: number;
  style?: ViewStyle;
  maxValue?: number;
  levels?: number;
  colors?: string[];
  gridColor?: string;
  labelColor?: string;
  fontSize?: number;
  fontFamily?: string;
  fillOpacity?: number;
  tooltip?: TooltipProp;
  scrub?: boolean | ScrubGuideConfig;
  onScrub?: (info: ScrubInfo<{ label: string; values: number[] }>) => void;
};

export type DitherRange = {
  key: string;
  label: string;
};
