import React, { useCallback, useEffect, useMemo } from "react";
import { Canvas, Rect } from "@shopify/react-native-skia";
import { View } from "react-native";
import { ditherPalette } from "./palette";
import { clamp, generateYTicks, nearestIndexByCenters } from "./utils";
import { DitherPattern } from "./DitherPattern";
import { TooltipLayer } from "./DitherTooltip";
import { XAxisLabels, YAxisLabels } from "./ChartAxis";
import { useScrub } from "./useScrub";
import type { BarChartProps } from "./types";

export function DitherBarChart({
  data,
  width,
  height,
  style,
  backgroundColor,
  color = ditherPalette.ink,
  maxValue,
  spacing = 10,
  barRadius = 6,
  fillOpacity = 0.88,
  dither,
  xAxis,
  yAxis,
  tooltip,
  scrub,
  onScrub
}: BarChartProps) {
  const yAxisConfig = yAxis?.visible ? yAxis : undefined;
  const xAxisConfig = xAxis?.visible ? xAxis : undefined;
  const yAxisWidth = yAxisConfig ? yAxisConfig.size ?? 34 : 0;
  const xAxisHeight = xAxisConfig ? xAxisConfig.size ?? 22 : 0;
  const plotWidth = Math.max(width - yAxisWidth, 0);
  const plotHeight = Math.max(height - xAxisHeight, 0);

  const scrubEnabled = Boolean(onScrub) || Boolean(tooltip) || Boolean(scrub);

  const resolvedMax = maxValue ?? Math.max(...data.map((item) => item.value), 1);
  const barWidth = data.length > 0 ? (plotWidth - spacing * (data.length - 1)) / data.length : 0;
  const centers = useMemo(
    () => data.map((_, index) => index * (barWidth + spacing) + barWidth / 2),
    [data, barWidth, spacing]
  );

  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (centers.length === 0) return point;
      const index = nearestIndexByCenters(point.x, centers);
      return { x: centers[index], y: 0 };
    },
    [centers]
  );
  const { scrubX, handlers } = useScrub(plotWidth, scrubEnabled, undefined, snapPoint);
  const scrubIndex = scrubX == null || data.length === 0 ? null : nearestIndexByCenters(scrubX, centers);

  useEffect(() => {
    if (!onScrub) return;
    if (scrubIndex == null) {
      onScrub(null);
      return;
    }
    const datum = data[scrubIndex];
    const y = plotHeight - clamp(datum.value / resolvedMax, 0, 1) * plotHeight;
    onScrub({ index: scrubIndex, datum, value: datum.value, x: centers[scrubIndex], y });
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
            {data.map((item, index) => {
              const barHeight = clamp(item.value / resolvedMax, 0, 1) * plotHeight;
              const x = index * (barWidth + spacing);
              const y = plotHeight - barHeight;
              const itemColor = item.color ?? color;
              const isActive = scrubIndex === index;

              return (
                <React.Fragment key={`${item.label ?? "bar"}-${index}`}>
                  <DitherPattern
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    radius={barRadius}
                    color={itemColor}
                    opacity={isActive ? 1 : fillOpacity}
                    dither={dither}
                  />
                </React.Fragment>
              );
            })}
          </Canvas>
          {scrubIndex != null ? (
            <TooltipLayer
              tooltip={tooltip}
              info={{
                index: scrubIndex,
                datum: data[scrubIndex],
                value: data[scrubIndex].value,
                x: centers[scrubIndex],
                y: plotHeight - clamp(data[scrubIndex].value / resolvedMax, 0, 1) * plotHeight,
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
