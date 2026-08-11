import React, { useEffect, useMemo } from "react";
import { Canvas, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { View } from "react-native";
import { XAxisLabels, YAxisLabels } from "./ChartAxis";
import { DitherPattern } from "./DitherPattern";
import { ScrubGuide, TooltipLayer } from "./DitherTooltip";
import { curveYAtX, offsetBand, tracePoints } from "./lineGeometry";
import { defaultSeriesColors } from "./palette";
import { clamp, generateYTicks, nearestIndexFromX } from "./utils";
import { useScrub } from "./useScrub";
import type { MultiLineChartProps } from "./types";

type MultiLinePathEntry = {
  points: Array<{ x: number; y: number }>;
  bandPath: ReturnType<typeof Skia.Path.Make>;
  upperPath: ReturnType<typeof Skia.Path.Make>;
  lowerPath: ReturnType<typeof Skia.Path.Make>;
  densityProgress: (x: number, y: number) => number;
};

export function DitherMultiLineChart({
  labels,
  series,
  width,
  height,
  style,
  backgroundColor,
  maxValue,
  bandWidth = 24,
  strokeWidth = 0.8,
  curve = "smooth",
  colors = defaultSeriesColors,
  fillOpacity = 1,
  dither,
  xAxis,
  yAxis,
  tooltip,
  scrub,
  onScrub
}: MultiLineChartProps) {
  const yAxisConfig = yAxis?.visible ? yAxis : undefined;
  const xAxisConfig = xAxis?.visible ? xAxis : undefined;
  const yAxisWidth = yAxisConfig ? yAxisConfig.size ?? 30 : 0;
  const xAxisHeight = xAxisConfig ? xAxisConfig.size ?? 20 : 0;
  const plotWidth = Math.max(width - yAxisWidth, 0);
  const plotHeight = Math.max(height - xAxisHeight, 0);
  const resolvedMax = useMemo(
    () => maxValue ?? Math.max(...series.flatMap((entry) => entry.values), 1),
    [maxValue, series]
  );
  const pointCount = useMemo(
    () => Math.max(labels.length, ...series.map((entry) => entry.values.length), 0),
    [labels.length, series]
  );
  const step = pointCount > 1 ? plotWidth / (pointCount - 1) : plotWidth;
  const defaultDither = useMemo(
    () =>
      dither ?? {
        variant: "gradient" as const,
        cellSize: 1.25,
        startDensity: 0.18,
        endDensity: 1,
        solidFrom: 0.94
      },
    [dither]
  );

  const paths = useMemo(
    () =>
      series.map((entry) => {
        const points = entry.values.map((value, index) => ({
          x: index * step,
          y: plotHeight - clamp(value / resolvedMax, 0, 1) * plotHeight
        }));
        const { upper, lower } = offsetBand(points, bandWidth);
        const bandBuilder = Skia.Path.Make();
        const upperBuilder = Skia.Path.Make();
        const lowerBuilder = Skia.Path.Make();

        tracePoints(bandBuilder, upper, curve);
        tracePoints(upperBuilder, upper, curve);
        tracePoints(bandBuilder, lower.slice().reverse(), curve, false);
        tracePoints(lowerBuilder, lower, curve);
        bandBuilder.close();

        return {
          points,
          bandPath: bandBuilder,
          upperPath: upperBuilder,
          lowerPath: lowerBuilder,
          densityProgress: (x: number, y: number) => {
            const centerY = curveYAtX(points, x, curve);
            return clamp(Math.abs(y - centerY) / Math.max(bandWidth / 2, 0.001), 0, 1);
          }
        };
      }),
    [bandWidth, curve, plotHeight, resolvedMax, series, step]
  );

  const scrubConfig = typeof scrub === "object" ? scrub : undefined;
  const scrubEnabled = Boolean(onScrub) || Boolean(tooltip) || Boolean(scrub);

  const yTicks = yAxisConfig ? generateYTicks(resolvedMax, yAxisConfig.ticks ?? 4, yAxisConfig.formatLabel) : [];
  const xLabels = xAxisConfig
    ? labels.map((label, index) => (xAxisConfig.formatLabel ? xAxisConfig.formatLabel(label, index) : label))
    : [];

  return (
    <View style={[{ width, height }, style]}>
      <View style={{ flexDirection: "row" }}>
        {yAxisConfig ? (
          <YAxisLabels ticks={yTicks} width={yAxisWidth} height={plotHeight} config={yAxisConfig} />
        ) : null}
        <View style={{ width: plotWidth, height: plotHeight }}>
          {/*
            The dithered bands and a live scrub dot are split into separate Canvases
            on purpose. A Skia Canvas re-rasterizes its *entire* content whenever
            anything inside it changes — so with the dot in the same Canvas as the
            dense dither patterns, dragging forced every band (thousands of small
            shapes each) to be redrawn on every touch-move frame, independent of
            React-level memoization. The bands don't depend on scrubIndex at all, so
            keeping them in their own Canvas means they're untouched by the scrub
            Canvas repainting on top of them every frame.
          */}
          <Canvas style={{ width: plotWidth, height: plotHeight }} pointerEvents="none">
            {backgroundColor ? (
              <Rect x={0} y={0} width={plotWidth} height={plotHeight} color={backgroundColor} />
            ) : null}
            {paths.map((entry, seriesIndex) => {
              const source = series[seriesIndex];
              const color = source.color ?? colors[seriesIndex % colors.length];
              const opacity = fillOpacity;

              return (
                <React.Fragment key={`line-series-${source.label}-${seriesIndex}`}>
                  <Group clip={entry.bandPath}>
                    <DitherPattern
                      x={0}
                      y={0}
                      width={plotWidth}
                      height={plotHeight}
                      color={color}
                      dither={source.dither ?? defaultDither}
                      clip={false}
                      opacity={opacity}
                      densityProgress={entry.densityProgress}
                    />
                  </Group>
                  <Path path={entry.upperPath} color={color} style="stroke" strokeWidth={strokeWidth} />
                  <Path path={entry.lowerPath} color={color} style="stroke" strokeWidth={strokeWidth} />
                </React.Fragment>
              );
            })}
          </Canvas>
          <MultiLineScrubOverlay
            enabled={scrubEnabled}
            width={plotWidth}
            height={plotHeight}
            paths={paths}
            labels={labels}
            series={series}
            step={step}
            pointCount={pointCount}
            colors={colors}
            curve={curve}
            scrubConfig={scrubConfig}
            tooltip={tooltip}
            onScrub={onScrub}
          />
        </View>
      </View>
      {xAxisConfig ? (
        <XAxisLabels labels={xLabels} width={plotWidth} config={xAxisConfig} style={{ marginLeft: yAxisWidth }} />
      ) : null}
    </View>
  );
}

const MultiLineScrubOverlay = React.memo(function MultiLineScrubOverlay({
  enabled,
  width,
  height,
  paths,
  labels,
  series,
  step,
  pointCount,
  colors,
  curve,
  scrubConfig,
  tooltip,
  onScrub
}: {
  enabled: boolean;
  width: number;
  height: number;
  paths: MultiLinePathEntry[];
  labels: string[];
  series: MultiLineChartProps["series"];
  step: number;
  pointCount: number;
  colors: string[];
  curve: "linear" | "smooth";
  scrubConfig: Exclude<MultiLineChartProps["scrub"], boolean> | undefined;
  tooltip: MultiLineChartProps["tooltip"];
  onScrub: MultiLineChartProps["onScrub"];
}) {
  // No snapPoint here on purpose: snapping the guide itself to the nearest data index
  // made it visibly lag behind the finger between two widely-spaced points. The guide
  // tracks raw touch x; the tooltip/onScrub value still snaps to an actual datum.
  const { scrubX, handlers } = useScrub(width, enabled, undefined, undefined);
  const scrubIndex = scrubX == null || pointCount === 0 ? null : nearestIndexFromX(scrubX, step, pointCount);

  useEffect(() => {
    if (!onScrub) return;
    if (scrubIndex == null) {
      onScrub(null);
      return;
    }
    const values = series.map((entry) => entry.values[scrubIndex] ?? 0);
    onScrub({
      index: scrubIndex,
      datum: { label: labels[scrubIndex] ?? String(scrubIndex), values },
      value: values[0] ?? 0,
      values,
      x: scrubIndex * step
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubIndex]);

  return (
    <View
      pointerEvents={enabled ? "auto" : "none"}
      style={{ position: "absolute", left: 0, top: 0, width, height }}
      {...(handlers ?? {})}
    >
      {scrubX != null ? (
        <Canvas style={{ width, height }} pointerEvents="none">
          <ScrubGuide
            x={scrubX}
            height={height}
            color={colors[0]}
            dots={paths.map((entry, seriesIndex) => ({
              y: curveYAtX(entry.points, scrubX, curve),
              color: series[seriesIndex].color ?? colors[seriesIndex % colors.length]
            }))}
            config={scrubConfig}
          />
        </Canvas>
      ) : null}
      {scrubIndex != null && scrubX != null ? (
        <TooltipLayer
          tooltip={tooltip}
          info={{
            index: scrubIndex,
            datum: {
              label: labels[scrubIndex] ?? String(scrubIndex),
              values: series.map((entry) => entry.values[scrubIndex] ?? 0)
            },
            value: series[0]?.values[scrubIndex] ?? 0,
            values: series.map((entry) => entry.values[scrubIndex] ?? 0),
            x: scrubX,
            y: curveYAtX(paths[0]?.points ?? [], scrubX, curve),
            width,
            height
          }}
        />
      ) : null}
    </View>
  );
});
