import React, { useCallback, useEffect, useMemo } from "react";
import { Canvas, Circle, Group, Path, Rect, Skia } from "@shopify/react-native-skia";
import { View } from "react-native";
import { ditherPalette } from "./palette";
import { clamp, generateYTicks, nearestIndexFromX } from "./utils";
import { DitherPattern } from "./DitherPattern";
import { ScrubGuide, TooltipLayer } from "./DitherTooltip";
import { XAxisLabels, YAxisLabels } from "./ChartAxis";
import { curveYAtX, offsetBand, tracePoints, tracePointsRange } from "./lineGeometry";
import { useScrub } from "./useScrub";
import type { LineChartProps } from "./types";

export function DitherLineChart({
  data,
  maxValue: maxValueProp,
  minValue: minValueProp,
  width,
  height,
  style,
  backgroundColor,
  color = ditherPalette.blue,
  strokeWidth = 3,
  fillColor = color,
  fillOpacity = 0.82,
  showArea = false,
  bandWidth,
  curve = "smooth",
  dither,
  xAxis,
  yAxis,
  tooltip,
  scrub,
  onScrub,
  futureColor
}: LineChartProps) {
  const yAxisConfig = yAxis?.visible ? yAxis : undefined;
  const xAxisConfig = xAxis?.visible ? xAxis : undefined;
  const yAxisWidth = yAxisConfig ? yAxisConfig.size ?? 34 : 0;
  const xAxisHeight = xAxisConfig ? xAxisConfig.size ?? 22 : 0;
  const plotWidth = Math.max(width - yAxisWidth, 0);
  const plotHeight = Math.max(height - xAxisHeight, 0);

  const scrubConfig = typeof scrub === "object" ? scrub : undefined;
  const scrubEnabled = Boolean(onScrub) || Boolean(tooltip) || Boolean(scrub);

  const maxValue = useMemo(
    () => maxValueProp ?? Math.max(...data.map((item) => item.value), 1),
    [data, maxValueProp]
  );
  const minValue = minValueProp ?? 0;
  const valueRange = useMemo(() => Math.max(maxValue - minValue, 0.0001), [maxValue, minValue]);
  const step = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth;

  const points = useMemo(
    () =>
      data.map((item, index) => ({
        x: index * step,
        y: plotHeight - clamp((item.value - minValue) / valueRange, 0, 1) * plotHeight
      })),
    [data, minValue, valueRange, plotHeight, step]
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

  // Without this, DitherPattern falls back to a plain top-to-bottom gradient over
  // the whole canvas — a flat horizontal density band that ignores the curve, so a
  // tall peak and a shallow dip end up looking identically dense at the same height.
  // Measuring progress from the curve down to the baseline at each x (like
  // DitherStackedAreaChart already does for its bands) makes the density hug the
  // curve's actual shape instead.
  const areaDensityProgress = useCallback(
    (x: number, y: number) => {
      const topY = curveYAtX(points, x, curve);
      return clamp((y - topY) / Math.max(plotHeight - topY, 0.001), 0, 1);
    },
    [curve, plotHeight, points]
  );

  // A dithered band around the line itself, the same technique DitherMultiLineChart
  // uses for its series — an alternative to `showArea`'s fill-to-baseline for a
  // single line, so one line doesn't need a second series just to get a band look.
  const band = useMemo(() => {
    if (!bandWidth || points.length === 0) return null;
    const { upper, lower } = offsetBand(points, bandWidth);
    const bandPath = Skia.Path.Make();
    const upperPath = Skia.Path.Make();
    const lowerPath = Skia.Path.Make();
    tracePoints(bandPath, upper, curve);
    tracePoints(upperPath, upper, curve);
    tracePoints(bandPath, lower.slice().reverse(), curve, false);
    tracePoints(lowerPath, lower, curve);
    bandPath.close();
    return {
      bandPath,
      upperPath,
      lowerPath,
      densityProgress: (x: number, y: number) => {
        const centerY = curveYAtX(points, x, curve);
        return clamp(Math.abs(y - centerY) / Math.max(bandWidth / 2, 0.001), 0, 1);
      }
    };
  }, [bandWidth, curve, points]);

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

  const splitPaths = useMemo(() => {
    if (!futureColor || scrubIndex == null || scrubIndex >= points.length - 1) return null;
    const past = Skia.Path.Make();
    tracePointsRange(past, points, curve, 0, scrubIndex);
    const future = Skia.Path.Make();
    tracePointsRange(future, points, curve, scrubIndex, points.length - 1);
    return { past, future };
  }, [curve, futureColor, points, scrubIndex]);

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
          {/*
            The dithered fill and a live scrub dot are split into separate Canvases
            on purpose. A Skia Canvas re-rasterizes its *entire* content whenever
            anything inside it changes — so with the dot in the same Canvas as a
            dense dither pattern, dragging forced the whole pattern (thousands of
            small shapes) to be redrawn on every touch-move frame, independent of
            React-level memoization. Keeping the static fill in its own Canvas means
            it's untouched by the scrub Canvas repainting on top of it every frame.
          */}
          <Canvas style={{ width: plotWidth, height: plotHeight }} pointerEvents="none">
            {backgroundColor ? (
              <Rect x={0} y={0} width={plotWidth} height={plotHeight} color={backgroundColor} />
            ) : null}
            {band ? (
              <Group clip={band.bandPath}>
                <DitherPattern
                  x={0}
                  y={0}
                  width={plotWidth}
                  height={plotHeight}
                  color={fillColor}
                  dither={dither}
                  clip={false}
                  opacity={fillOpacity}
                  densityProgress={band.densityProgress}
                />
              </Group>
            ) : showArea ? (
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
                  densityProgress={areaDensityProgress}
                />
              </Group>
            ) : null}
            {band ? (
              // A band replaces the center-line stroke entirely (like DitherMultiLineChart's
              // series bands) rather than drawing a redundant line down its middle.
              <>
                <Path path={band.upperPath} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
                <Path path={band.lowerPath} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
              </>
            ) : splitPaths ? null : (
              <Path path={linePath} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
            )}
          </Canvas>
          {activePoint ? (
            <Canvas
              style={{ position: "absolute", left: 0, top: 0, width: plotWidth, height: plotHeight }}
              pointerEvents="none"
            >
              {splitPaths ? (
                <>
                  <Path path={splitPaths.past} color={color} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
                  <Path path={splitPaths.future} color={futureColor} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
                  <Circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={strokeWidth} color={futureColor} />
                </>
              ) : null}
              <ScrubGuide
                x={activePoint.x}
                height={plotHeight}
                color={color}
                dotY={activePoint.y}
                config={scrubConfig}
              />
            </Canvas>
          ) : null}
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
