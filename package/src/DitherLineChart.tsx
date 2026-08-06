import React, { useCallback, useEffect, useMemo } from "react";
import { Canvas, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { View } from "react-native";
import { ditherPalette } from "./palette";
import { clamp, generateYTicks, nearestIndexFromX } from "./utils";
import { DitherPattern } from "./DitherPattern";
import { ScrubGuide, TooltipLayer } from "./DitherTooltip";
import { XAxisLabels, YAxisLabels } from "./ChartAxis";
import { useScrub } from "./useScrub";
import type { LineChartProps } from "./types";

export function DitherLineChart({
  data,
  width,
  height,
  style,
  backgroundColor,
  color = ditherPalette.blue,
  strokeWidth = 3,
  fillColor = color,
  fillOpacity = 0.82,
  showArea = false,
  curve = "smooth",
  dither,
  xAxis,
  yAxis,
  tooltip,
  scrub,
  onScrub
}: LineChartProps) {
  const yAxisConfig = yAxis?.visible ? yAxis : undefined;
  const xAxisConfig = xAxis?.visible ? xAxis : undefined;
  const yAxisWidth = yAxisConfig ? yAxisConfig.size ?? 34 : 0;
  const xAxisHeight = xAxisConfig ? xAxisConfig.size ?? 22 : 0;
  const plotWidth = Math.max(width - yAxisWidth, 0);
  const plotHeight = Math.max(height - xAxisHeight, 0);

  const scrubConfig = typeof scrub === "object" ? scrub : undefined;
  const scrubEnabled = Boolean(onScrub) || Boolean(tooltip) || Boolean(scrub);

  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const step = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;

  const points = useMemo(
    () =>
      data.map((item, index) => ({
        x: index * step,
        y: plotHeight - clamp(item.value / maxValue, 0, 1) * plotHeight
      })),
    [data, maxValue, plotHeight, step]
  );

  const linePath = useMemo(() => {
    const builder = Skia.Path.Make();
    tracePoints(builder, points, curve);
    return builder;
  }, [curve, points]);

  const areaPath = useMemo(() => {
    const builder = Skia.Path.Make();
    if (points.length === 0) return builder;
    builder.moveTo(points[0].x, plotHeight);
    tracePoints(builder, points, curve, false);
    builder.lineTo(points[points.length - 1].x, plotHeight);
    builder.close();
    return builder;
  }, [curve, points, plotHeight]);

  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (data.length === 0) return point;
      const index = nearestIndexFromX(point.x, step, data.length);
      return { x: index * step, y: 0 };
    },
    [data.length, step]
  );
  const { scrubX, handlers } = useScrub(plotWidth, scrubEnabled, undefined, snapPoint);
  const scrubIndex = scrubX == null || data.length === 0 ? null : nearestIndexFromX(scrubX, step, data.length);

  useEffect(() => {
    if (!onScrub) return;
    if (scrubIndex == null) {
      onScrub(null);
      return;
    }
    const datum = data[scrubIndex];
    onScrub({ index: scrubIndex, datum, value: datum.value, x: points[scrubIndex].x, y: points[scrubIndex].y });
    // Only the resolved index should re-trigger this; `data`/`points` changing mid-scrub is rare
    // and would otherwise cause redundant calls while dragging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubIndex]);

  const activePoint = scrubIndex != null ? points[scrubIndex] : null;
  const yTicks = yAxisConfig ? generateYTicks(maxValue, yAxisConfig.ticks ?? 4, yAxisConfig.formatLabel) : [];
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
            {showArea ? (
              <Group clip={areaPath}>
                <DitherPattern
                  x={0}
                  y={0}
                  width={plotWidth}
                  height={plotHeight}
                  color={fillColor}
                  dither={dither}
                  clip={false}
                  opacity={fillOpacity}
                />
              </Group>
            ) : null}
            <Path path={linePath} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
            {activePoint ? (
              <ScrubGuide
                x={activePoint.x}
                height={plotHeight}
                color={color}
                dotY={activePoint.y}
                config={scrubConfig}
              />
            ) : null}
          </Canvas>
          {activePoint && scrubIndex != null ? (
            <TooltipLayer
              tooltip={tooltip}
              info={{
                index: scrubIndex,
                datum: data[scrubIndex],
                value: data[scrubIndex].value,
                x: activePoint.x,
                y: activePoint.y,
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
