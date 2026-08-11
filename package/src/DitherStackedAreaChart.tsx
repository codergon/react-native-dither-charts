import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { View } from "react-native";
import { XAxisLabels, YAxisLabels } from "./ChartAxis";
import { DitherPattern } from "./DitherPattern";
import { FocusCrossfade } from "./FocusCrossfade";
import { ScrubGuide, TooltipLayer } from "./DitherTooltip";
import { defaultSeriesColors } from "./palette";
import { clamp, generateYTicks, nearestIndexFromX, resolveDither, sum } from "./utils";
import { useScrub } from "./useScrub";
import type { StackedAreaChartProps } from "./types";

export function DitherStackedAreaChart({
  data,
  width,
  height,
  style,
  backgroundColor,
  maxValue,
  colors = defaultSeriesColors,
  fillOpacity = 1,
  strokeWidth = 1,
  showSeriesLines = true,
  curve = "smooth",
  dither,
  xAxis,
  yAxis,
  tooltip,
  scrub,
  onScrub,
  focusOnPress = true,
  focusedSeries,
  dimOpacity = 0.24,
  onSeriesFocus,
  activeSolidFrom = 0.9,
  focusAnimationDuration = 180
}: StackedAreaChartProps) {
  const yAxisConfig = yAxis?.visible ? yAxis : undefined;
  const xAxisConfig = xAxis?.visible ? xAxis : undefined;
  const yAxisWidth = yAxisConfig ? yAxisConfig.size ?? 30 : 0;
  const xAxisHeight = xAxisConfig ? xAxisConfig.size ?? 20 : 0;
  const plotWidth = Math.max(width - yAxisWidth, 0);
  const plotHeight = Math.max(height - xAxisHeight, 0);
  const totals = useMemo(
    () => data.map((item) => sum(item.segments.map((segment) => segment.value))),
    [data]
  );
  const resolvedMax = useMemo(
    () => maxValue ?? Math.max(...totals, 1),
    [maxValue, totals]
  );
  const step = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;
  const seriesCount = useMemo(
    () => Math.max(...data.map((item) => item.segments.length), 0),
    [data]
  );
  const defaultFocusedDither = useMemo(
    () => ({
      ...resolveDither(dither),
      solidFrom: activeSolidFrom
    }),
    [
      activeSolidFrom,
      dither?.cellSize,
      dither?.color,
      dither?.direction,
      dither?.dotSize,
      dither?.endDensity,
      dither?.gap,
      dither?.gradientColors,
      dither?.jitter,
      dither?.opacity,
      dither?.pattern,
      dither?.pixelated,
      dither?.solidFrom,
      dither?.startDensity,
      dither?.strokeWidth,
      dither?.variant
    ]
  );

  const series = useMemo(() => {
    const cumulative = data.map(() => 0);

    return Array.from({ length: seriesCount }, (_, seriesIndex) => {
      const lower = cumulative.slice();
      const upper = data.map((item, index) => {
        cumulative[index] += item.segments[seriesIndex]?.value ?? 0;
        return cumulative[index];
      });
      const bandBuilder = Skia.Path.Make();
      const topBuilder = Skia.Path.Make();

      const upperPoints = upper.map((value, index) => ({
        x: index * step,
        y: plotHeight - clamp(value / resolvedMax, 0, 1) * plotHeight
      }));
      const lowerPoints = lower.map((value, index) => ({
        x: index * step,
        y: plotHeight - clamp(value / resolvedMax, 0, 1) * plotHeight
      }));

      tracePoints(bandBuilder, upperPoints, curve);
      tracePoints(topBuilder, upperPoints, curve);
      tracePoints(bandBuilder, lowerPoints.slice().reverse(), curve, false);
      bandBuilder.close();

      return {
        bandPath: bandBuilder,
        topPath: topBuilder,
        upperPoints,
        lowerPoints,
        densityProgress: (x: number, y: number) => {
          const upperY = curveYAtX(upperPoints, x, curve);
          const lowerY = curveYAtX(lowerPoints, x, curve);
          return clamp((y - upperY) / Math.max(lowerY - upperY, 0.001), 0, 1);
        }
      };
    });
  }, [curve, data, plotHeight, resolvedMax, seriesCount, step]);

  const [internalFocusedSeries, setInternalFocusedSeries] = useState<number | null>(null);
  const resolvedFocusedSeries = focusedSeries === undefined ? internalFocusedSeries : focusedSeries;
  const setFocusedSeries = useCallback(
    (next: number | null) => {
      if (focusedSeries === undefined) setInternalFocusedSeries(next);
      onSeriesFocus?.(next);
    },
    [focusedSeries, onSeriesFocus]
  );

  const focusFromPoint = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      let hitSeries: number | null = null;
      series.forEach((entry, seriesIndex) => {
        const upperY = curveYAtX(entry.upperPoints, x, curve);
        const lowerY = curveYAtX(entry.lowerPoints, x, curve);
        if (y >= upperY && y <= lowerY) hitSeries = seriesIndex;
      });
      setFocusedSeries(hitSeries === resolvedFocusedSeries ? null : hitSeries);
    },
    [curve, resolvedFocusedSeries, series, setFocusedSeries]
  );

  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (data.length === 0) return point;
      const index = nearestIndexFromX(point.x, step, data.length);
      return { x: index * step, y: 0 };
    },
    [data.length, step]
  );

  const scrubConfig = typeof scrub === "object" ? scrub : undefined;
  const scrubEnabled = Boolean(onScrub) || Boolean(tooltip) || Boolean(scrub) || focusOnPress;
  const { scrubX, isScrubbing, handlers } = useScrub(
    plotWidth,
    scrubEnabled,
    focusOnPress ? focusFromPoint : undefined,
    snapPoint,
    focusOnPress
  );
  const rawScrubIndex = scrubX == null || data.length === 0 ? null : nearestIndexFromX(scrubX, step, data.length);
  // A tap toggles resolvedFocusedSeries; once the finger lifts, only trust the raw
  // scrub position if a series is still focused/dragging, so tap-to-dismiss (or a
  // miss above the stack) actually hides the tooltip instead of it sticking forever.
  const scrubIndex = focusOnPress
    ? isScrubbing || resolvedFocusedSeries != null
      ? rawScrubIndex
      : null
    : rawScrubIndex;

  useEffect(() => {
    if (!onScrub) return;
    if (scrubIndex == null) {
      onScrub(null);
      return;
    }
    const datum = data[scrubIndex];
    onScrub({
      index: scrubIndex,
      datum,
      value: totals[scrubIndex],
      values: datum.segments.map((segment) => segment.value),
      x: scrubIndex * step
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubIndex]);

  const yTicks = yAxisConfig ? generateYTicks(resolvedMax, yAxisConfig.ticks ?? 4, yAxisConfig.formatLabel) : [];
  const xLabels = xAxisConfig
    ? data.map((item, index) =>
        xAxisConfig.formatLabel ? xAxisConfig.formatLabel(item, index) : item.label ?? String(index)
      )
    : [];

  return (
    <View style={[{ width, height }, style]}>
      <View style={{ flexDirection: "row" }}>
        {yAxisConfig ? (
          <YAxisLabels ticks={yTicks} width={yAxisWidth} height={plotHeight} config={yAxisConfig} />
        ) : null}
        <View style={{ width: plotWidth, height: plotHeight }} {...(handlers ?? {})}>
          <Canvas style={{ width: plotWidth, height: plotHeight }} pointerEvents="none">
            {backgroundColor ? <Rect x={0} y={0} width={plotWidth} height={plotHeight} color={backgroundColor} /> : null}
            {series.map(({ bandPath, topPath, densityProgress }, seriesIndex) => {
              const segment = data[0]?.segments[seriesIndex];
              const seriesColor = segment?.color ?? colors[seriesIndex % colors.length];
              const seriesDither = segment?.dither ?? dither;
              const isDimmed =
                resolvedFocusedSeries != null && resolvedFocusedSeries !== seriesIndex;
              const seriesOpacity = fillOpacity * (isDimmed ? dimOpacity : 1);
              const focusedDither = segment?.dither
                ? {
                    ...resolveDither(segment.dither),
                    solidFrom: activeSolidFrom
                  }
                : defaultFocusedDither;
              return (
                <React.Fragment key={`area-series-${seriesIndex}`}>
                  <FocusCrossfade
                    active={seriesIndex === resolvedFocusedSeries}
                    duration={focusAnimationDuration}
                    resting={
                      <Group clip={bandPath}>
                        <DitherPattern
                          x={0}
                          y={0}
                          width={plotWidth}
                          height={plotHeight}
                          color={seriesColor}
                          dither={seriesDither}
                          clip={false}
                          opacity={seriesOpacity}
                          densityProgress={densityProgress}
                        />
                      </Group>
                    }
                    focused={
                      <Group clip={bandPath}>
                      <DitherPattern
                        x={0}
                        y={0}
                        width={plotWidth}
                        height={plotHeight}
                        color={seriesColor}
                        dither={focusedDither}
                        clip={false}
                        opacity={seriesOpacity}
                        densityProgress={densityProgress}
                      />
                      </Group>
                    }
                  />
                  {showSeriesLines ? (
                    <Path
                      path={topPath}
                      color={seriesColor}
                      opacity={isDimmed ? dimOpacity : 1}
                      style="stroke"
                      strokeWidth={strokeWidth}
                      strokeJoin="round"
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
            {scrubIndex != null ? (
              <ScrubGuide
                x={scrubIndex * step}
                height={plotHeight}
                color={colors[0]}
                dots={series.map((entry, seriesIndex) => ({
                  y: entry.upperPoints[scrubIndex].y,
                  color: data[scrubIndex].segments[seriesIndex]?.color ?? colors[seriesIndex % colors.length]
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
                datum: data[scrubIndex],
                value: totals[scrubIndex],
                values: data[scrubIndex].segments.map((segment) => segment.value),
                x: scrubIndex * step,
                width: plotWidth
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

  return (
    inverse ** 3 * current.y +
    3 * inverse ** 2 * t * control1 +
    3 * inverse * t ** 2 * control2 +
    t ** 3 * next.y
  );
}

type Point = { x: number; y: number };

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
