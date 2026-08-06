import React, { useCallback, useEffect, useMemo } from "react";
import { Canvas, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { View } from "react-native";
import { XAxisLabels, YAxisLabels } from "./ChartAxis";
import { DitherPattern } from "./DitherPattern";
import { ScrubGuide, TooltipLayer } from "./DitherTooltip";
import { defaultSeriesColors } from "./palette";
import { clamp, generateYTicks, nearestIndexFromX } from "./utils";
import { useScrub } from "./useScrub";
import type { MultiLineChartProps } from "./types";

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
  const resolvedMax = maxValue ?? Math.max(...series.flatMap((entry) => entry.values), 1);
  const pointCount = Math.max(labels.length, ...series.map((entry) => entry.values.length), 0);
  const step = pointCount > 1 ? plotWidth / (pointCount - 1) : plotWidth;
  const defaultDither = dither ?? {
    variant: "gradient" as const,
    cellSize: 1.25,
    startDensity: 0.18,
    endDensity: 1,
    solidFrom: 0.94
  };

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
  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (pointCount === 0) return point;
      const index = nearestIndexFromX(point.x, step, pointCount);
      return { x: index * step, y: 0 };
    },
    [pointCount, step]
  );
  const { scrubX, handlers } = useScrub(plotWidth, scrubEnabled, undefined, snapPoint);
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
        <View style={{ width: plotWidth, height: plotHeight }} {...(handlers ?? {})}>
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
            {scrubIndex != null ? (
              <ScrubGuide
                x={scrubIndex * step}
                height={plotHeight}
                color={colors[0]}
                dots={paths.map((entry, seriesIndex) => ({
                  y: entry.points[scrubIndex]?.y ?? 0,
                  color: series[seriesIndex].color ?? colors[seriesIndex % colors.length]
                }))}
                config={scrubConfig}
              />
            ) : null}
          </Canvas>
          {scrubIndex != null ? (
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
                x: scrubIndex * step,
                y: paths[0]?.points[scrubIndex]?.y,
                width: plotWidth,
                height: plotHeight
              }}
            />
          ) : null}
        </View>
      </View>
      {xAxisConfig ? (
        <XAxisLabels labels={xLabels} width={plotWidth} config={xAxisConfig} style={{ marginLeft: yAxisWidth }} />
      ) : null}
    </View>
  );
}

type Point = { x: number; y: number };

// Offsetting each point straight up/down by bandWidth/2 keeps the *vertical* gap
// constant, but the band visibly pinches on steep slopes because the perpendicular
// thickness the eye actually sees shrinks by cos(slope angle). Offsetting along each
// point's local normal (perpendicular to its tangent, approximated from its
// neighbors) keeps the band a constant width regardless of slope.
function offsetBand(points: Point[], bandWidth: number) {
  const halfWidth = bandWidth / 2;
  const upper: Point[] = [];
  const lower: Point[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const next = points[index + 1] ?? points[index];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    const point = points[index];
    upper.push({ x: point.x - normalX * halfWidth, y: point.y - normalY * halfWidth });
    lower.push({ x: point.x + normalX * halfWidth, y: point.y + normalY * halfWidth });
  }

  return { upper, lower };
}

function tracePoints(
  path: ReturnType<typeof Skia.Path.Make>,
  points: Point[],
  curve: "linear" | "smooth",
  moveToStart = true
) {
  if (points.length === 0) return;
  if (moveToStart) path.moveTo(points[0].x, points[0].y);
  else path.lineTo(points[0].x, points[0].y);

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (curve === "linear") {
      path.lineTo(next.x, next.y);
      continue;
    }
    const previous = points[index - 1] ?? current;
    const afterNext = points[index + 2] ?? next;
    path.cubicTo(
      current.x + (next.x - previous.x) / 6,
      current.y + (next.y - previous.y) / 6,
      next.x - (afterNext.x - current.x) / 6,
      next.y - (afterNext.y - current.y) / 6,
      next.x,
      next.y
    );
  }
}

function curveYAtX(points: Point[], x: number, curve: "linear" | "smooth") {
  if (points.length === 0) return 0;
  if (points.length === 1 || x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;
  const step = points[1].x - points[0].x;
  const index = Math.min(Math.floor((x - points[0].x) / step), points.length - 2);
  const current = points[index];
  const next = points[index + 1];
  const t = clamp((x - current.x) / Math.max(next.x - current.x, 0.001), 0, 1);
  if (curve === "linear") return current.y + (next.y - current.y) * t;
  const previous = points[index - 1] ?? current;
  const afterNext = points[index + 2] ?? next;
  const control1 = current.y + (next.y - previous.y) / 6;
  const control2 = next.y - (afterNext.y - current.y) / 6;
  const inverse = 1 - t;
  return inverse ** 3 * current.y + 3 * inverse ** 2 * t * control1 + 3 * inverse * t ** 2 * control2 + t ** 3 * next.y;
}
