import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas, Rect } from "@shopify/react-native-skia";
import { View } from "react-native";
import { defaultSeriesColors } from "./palette";
import { clamp, generateYTicks, nearestIndexByCenters, sum } from "./utils";
import { DitherPattern } from "./DitherPattern";
import { TooltipLayer } from "./DitherTooltip";
import { XAxisLabels, YAxisLabels } from "./ChartAxis";
import { useScrub } from "./useScrub";
import type { StackedBarChartProps } from "./types";

export function DitherStackedBar({
  data,
  width,
  height,
  style,
  backgroundColor,
  maxValue,
  spacing = 10,
  barRadius = 6,
  colors = defaultSeriesColors,
  fillOpacity = 0.88,
  dither,
  xAxis,
  yAxis,
  tooltip,
  scrub,
  onScrub,
  focusOnPress = true,
  focusedIndex,
  dimOpacity = 0.24,
  onItemFocus
}: StackedBarChartProps) {
  const yAxisConfig = yAxis?.visible ? yAxis : undefined;
  const xAxisConfig = xAxis?.visible ? xAxis : undefined;
  const yAxisWidth = yAxisConfig ? yAxisConfig.size ?? 34 : 0;
  const xAxisHeight = xAxisConfig ? xAxisConfig.size ?? 22 : 0;
  const plotWidth = Math.max(width - yAxisWidth, 0);
  const plotHeight = Math.max(height - xAxisHeight, 0);

  const totals = data.map((item) => sum(item.segments.map((segment) => segment.value)));
  const resolvedMax = maxValue ?? Math.max(...totals, 1);
  const barWidth = data.length > 0 ? (plotWidth - spacing * (data.length - 1)) / data.length : 0;
  const centers = useMemo(
    () => data.map((_, index) => index * (barWidth + spacing) + barWidth / 2),
    [data, barWidth, spacing]
  );

  const [internalFocusedIndex, setInternalFocusedIndex] = useState<number | null>(null);
  const resolvedFocusedIndex = focusedIndex === undefined ? internalFocusedIndex : focusedIndex;
  const setFocusedIndex = useCallback(
    (next: number | null) => {
      if (focusedIndex === undefined) setInternalFocusedIndex(next);
      onItemFocus?.(next);
    },
    [focusedIndex, onItemFocus]
  );

  const focusFromPoint = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      if (data.length === 0) return;
      const itemIndex = nearestIndexByCenters(x, centers);
      const barTop = plotHeight - clamp(totals[itemIndex] / resolvedMax, 0, 1) * plotHeight;
      const hitIndex = y >= barTop && y <= plotHeight ? itemIndex : null;
      setFocusedIndex(hitIndex === resolvedFocusedIndex ? null : hitIndex);
    },
    [centers, data.length, plotHeight, resolvedFocusedIndex, resolvedMax, setFocusedIndex, totals]
  );

  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (centers.length === 0) return point;
      const index = nearestIndexByCenters(point.x, centers);
      return { x: centers[index], y: 0 };
    },
    [centers]
  );

  const scrubEnabled = Boolean(onScrub) || Boolean(tooltip) || Boolean(scrub) || focusOnPress;

  const { scrubX, isScrubbing, handlers } = useScrub(
    plotWidth,
    scrubEnabled,
    focusOnPress ? focusFromPoint : undefined,
    snapPoint,
    focusOnPress
  );
  const rawScrubIndex = scrubX == null || data.length === 0 ? null : nearestIndexByCenters(scrubX, centers);
  // While focusOnPress is on, a tap toggles resolvedFocusedIndex; once the finger
  // lifts, only trust the raw scrub position if something is still focused/dragging,
  // so a tap-to-dismiss (or a miss) actually hides the tooltip instead of it sticking.
  const scrubIndex = focusOnPress
    ? isScrubbing || resolvedFocusedIndex != null
      ? rawScrubIndex
      : null
    : rawScrubIndex;

  useEffect(() => {
    if (!onScrub) return;
    if (scrubIndex == null) {
      onScrub(null);
      return;
    }
    onScrub({
      index: scrubIndex,
      datum: data[scrubIndex],
      value: totals[scrubIndex],
      values: data[scrubIndex].segments.map((segment) => segment.value),
      x: centers[scrubIndex]
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
            {backgroundColor ? (
              <Rect x={0} y={0} width={plotWidth} height={plotHeight} color={backgroundColor} />
            ) : null}
            {data.map((item, itemIndex) => {
              const x = itemIndex * (barWidth + spacing);
              let cursorY = plotHeight;
              const isActive = scrubIndex === itemIndex;

              return item.segments.map((segment, segmentIndex) => {
                const segmentHeight = clamp(segment.value / resolvedMax, 0, 1) * plotHeight;
                cursorY -= segmentHeight;
                const segmentColor = segment.color ?? colors[segmentIndex % colors.length];
                const segmentDither = segment.dither ?? dither;
                const isDimmed =
                  resolvedFocusedIndex != null && resolvedFocusedIndex !== itemIndex;
                const segmentOpacity = (isActive ? 1 : fillOpacity) * (isDimmed ? dimOpacity : 1);

                return (
                  <React.Fragment key={`${item.label ?? "stack"}-${itemIndex}-${segmentIndex}`}>
                    <DitherPattern
                      x={x}
                      y={cursorY}
                      width={barWidth}
                      height={segmentHeight}
                      radius={segmentIndex === 0 ? barRadius : 0}
                      color={segmentColor}
                      opacity={segmentOpacity}
                      dither={segmentDither}
                    />
                  </React.Fragment>
                );
              });
            })}
          </Canvas>
          {scrubIndex != null ? (
            <TooltipLayer
              tooltip={tooltip}
              info={{
                index: scrubIndex,
                datum: data[scrubIndex],
                value: totals[scrubIndex],
                values: data[scrubIndex].segments.map((segment) => segment.value),
                x: centers[scrubIndex],
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
