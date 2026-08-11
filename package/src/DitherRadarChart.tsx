import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas, Circle, Group, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { StyleSheet, Text, View } from "react-native";
import { DitherPattern } from "./DitherPattern";
import { TooltipLayer } from "./DitherTooltip";
import { defaultSeriesColors, ditherPalette } from "./palette";
import { clamp } from "./utils";
import { useScrub } from "./useScrub";
import type { RadarChartProps } from "./types";

export function DitherRadarChart({
  categories,
  series,
  width,
  height,
  style,
  maxValue,
  levels = 5,
  colors = defaultSeriesColors,
  gridColor = "#DDE2EB",
  labelColor = ditherPalette.muted,
  fontSize = 9,
  fontFamily,
  fillOpacity = 0.9,
  tooltip,
  scrub,
  onScrub,
  focusOnPress = true,
  focusedSeries,
  dimOpacity = 0.24,
  onSeriesFocus
}: RadarChartProps) {
  const centerX = width / 2;
  const centerY = height / 2;
  const categoryCount = categories.length;
  const seriesValueKey = series.map((entry) => entry.values.join(",")).join("|");
  const radius = Math.max(Math.min(width, height) / 2 - 34, 0);
  const resolvedMax = useMemo(
    () => maxValue ?? Math.max(...series.flatMap((entry) => entry.values), 1),
    [maxValue, seriesValueKey]
  );
  const angleStep = categoryCount > 0 ? (Math.PI * 2) / categoryCount : 0;
  const startAngle = -Math.PI / 2;

  const gridPaths = useMemo(
    () =>
      Array.from({ length: Math.max(levels, 1) }, (_, levelIndex) => {
        const levelRadius = (radius * (levelIndex + 1)) / Math.max(levels, 1);
        return polygonPath(
          Array.from({ length: categoryCount }, (_, index) =>
            polarPoint(centerX, centerY, levelRadius, startAngle + angleStep * index)
          )
        );
      }),
    [angleStep, categoryCount, centerX, centerY, levels, radius]
  );

  const axisPath = useMemo(() => {
    const builder = Skia.Path.Make();
    Array.from({ length: categoryCount }, (_, index) => {
      const point = polarPoint(centerX, centerY, radius, startAngle + angleStep * index);
      builder.moveTo(centerX, centerY);
      builder.lineTo(point.x, point.y);
    });
    return builder;
  }, [angleStep, categoryCount, centerX, centerY, radius]);

  const seriesPaths = useMemo(
    () =>
      series.map((entry) => {
        const radii = Array.from({ length: categoryCount }, (_, index) =>
          clamp((entry.values[index] ?? 0) / resolvedMax, 0, 1) * radius
        );
        const points = radii.map((entryRadius, index) =>
          polarPoint(centerX, centerY, entryRadius, startAngle + angleStep * index)
        );
        return {
          path: polygonPath(points),
          radii,
          points,
          densityProgress: (x: number, y: number) => {
            const dx = x - centerX;
            const dy = y - centerY;
            const pointRadius = Math.hypot(dx, dy);
            const boundary = radialLimit(radii, Math.atan2(dy, dx), startAngle, angleStep);
            return clamp(pointRadius / Math.max(boundary, 0.001), 0, 1);
          }
        };
      }),
    [angleStep, categoryCount, centerX, centerY, radius, resolvedMax, seriesValueKey]
  );

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
      const dx = x - centerX;
      const dy = y - centerY;
      const pointRadius = Math.hypot(dx, dy);
      const pointAngle = Math.atan2(dy, dx);
      let nearest: number | null = null;
      let distance = Infinity;
      seriesPaths.forEach((entry, index) => {
        const boundary = radialLimit(entry.radii, pointAngle, startAngle, angleStep);
        const nextDistance = Math.abs(boundary - pointRadius);
        if (pointRadius <= boundary + 12 && nextDistance < distance) {
          distance = nextDistance;
          nearest = index;
        }
      });
      setFocusedSeries(nearest === resolvedFocusedSeries ? null : nearest);
    },
    [angleStep, centerX, centerY, resolvedFocusedSeries, seriesPaths, setFocusedSeries, startAngle]
  );

  const scrubConfig = typeof scrub === "object" ? scrub : undefined;
  const scrubEnabled = Boolean(scrub) || Boolean(tooltip) || Boolean(onScrub) || focusOnPress;
  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      if (categoryCount === 0) return point;
      const index = nearestCategoryIndex(
        Math.atan2(point.y - centerY, point.x - centerX),
        startAngle,
        angleStep,
        categoryCount
      );
      return polarPoint(centerX, centerY, radius, startAngle + angleStep * index);
    },
    [angleStep, categoryCount, centerX, centerY, radius, startAngle]
  );
  const { scrubX, scrubY, handlers } = useScrub(
    width,
    scrubEnabled,
    focusOnPress ? focusFromPoint : undefined,
    snapPoint,
    focusOnPress
  );

  const rawScrubIndex =
    scrubX == null || scrubY == null || categoryCount === 0
      ? null
      : nearestCategoryIndex(
          Math.atan2(scrubY - centerY, scrubX - centerX),
          startAngle,
          angleStep,
          categoryCount
        );
  // The active axis always shows something: it defaults to the first category and
  // then sticks to whichever one was last touched, instead of disappearing when the
  // finger lifts or a tap misses.
  const [activeIndex, setActiveIndex] = useState(categoryCount > 0 ? 0 : null);
  useEffect(() => {
    if (rawScrubIndex != null) setActiveIndex(rawScrubIndex);
  }, [rawScrubIndex]);
  useEffect(() => {
    setActiveIndex((current) => {
      if (categoryCount === 0) return null;
      if (current != null && current < categoryCount) return current;
      return 0;
    });
  }, [categoryCount]);
  const scrubIndex = activeIndex;
  const scrubPoint =
    scrubIndex == null
      ? null
      : polarPoint(centerX, centerY, radius, startAngle + angleStep * scrubIndex);

  useEffect(() => {
    if (!onScrub) return;
    if (scrubIndex == null) {
      onScrub(null);
      return;
    }
    const values = series.map((entry) => entry.values[scrubIndex] ?? 0);
    onScrub({
      index: scrubIndex,
      datum: { label: categories[scrubIndex], values },
      value: values[0] ?? 0,
      values,
      x: scrubPoint?.x ?? centerX,
      y: scrubPoint?.y ?? centerY
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubIndex]);
  const labels = categories.map((category, index) => {
    const point = polarPoint(centerX, centerY, radius + 19, startAngle + angleStep * index);
    return { category, left: point.x - 40, top: point.y - fontSize * 0.65 };
  });

  return (
    <View style={[{ width, height }, style]} {...(handlers ?? {})}>
      <Canvas style={{ width, height }} pointerEvents="none">
        {gridPaths.map((path, index) => (
          <Path key={`radar-grid-${index}`} path={path} color={gridColor} style="stroke" strokeWidth={0.75} />
        ))}
        <Path path={axisPath} color={gridColor} style="stroke" strokeWidth={0.75} />
        {seriesPaths.map((entry, index) => {
          const source = series[index];
          const color = source.color ?? colors[index % colors.length];
          const isDimmed = resolvedFocusedSeries != null && resolvedFocusedSeries !== index;
          return (
            <React.Fragment key={`radar-series-${source.label}-${index}`}>
              <Group clip={entry.path}>
                <DitherPattern
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  color={color}
                  dither={
                    source.dither ?? {
                      variant: "gradient",
                      cellSize: 1.55,
                      startDensity: 0.18,
                      endDensity: 1,
                      solidFrom: 0.97
                    }
                  }
                  clip={false}
                  opacity={fillOpacity * (isDimmed ? dimOpacity : 1)}
                  densityProgress={entry.densityProgress}
                />
              </Group>
              <Path
                path={entry.path}
                color={color}
                opacity={isDimmed ? dimOpacity : 1}
                style="stroke"
                strokeWidth={0.45}
              />
            </React.Fragment>
          );
        })}
        {scrubIndex != null && scrubPoint && scrubConfig?.showLine !== false ? (
          <Line
            p1={vec(centerX, centerY)}
            p2={vec(scrubPoint.x, scrubPoint.y)}
            color={scrubConfig?.lineColor ?? "#17171A"}
            strokeWidth={scrubConfig?.lineWidth ?? 1}
            opacity={scrubConfig?.lineOpacity ?? 0.7}
          />
        ) : null}
        {scrubIndex != null && scrubConfig?.showDot !== false
          ? seriesPaths.map((entry, seriesIndex) => {
              const point = entry.points[scrubIndex];
              const color = series[seriesIndex].color ?? colors[seriesIndex % colors.length];
              const dotColor = scrubConfig?.dotColor ?? color;
              return (
                <React.Fragment key={`radar-scrub-${seriesIndex}`}>
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={scrubConfig?.haloRadius ?? 5.5}
                    color={dotColor}
                    opacity={scrubConfig?.haloOpacity ?? 0.16}
                  />
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={scrubConfig?.dotRadius ?? 3}
                    color={dotColor}
                  />
                </React.Fragment>
              );
            })
          : null}
      </Canvas>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {labels.map((label, index) => (
          <Text
            key={`${label.category}-${index}`}
            numberOfLines={1}
            style={{
              position: "absolute",
              left: label.left,
              top: label.top,
              width: 80,
              textAlign: "center",
              color: labelColor,
              fontSize,
              fontFamily
            }}
          >
            {label.category}
          </Text>
        ))}
      </View>
      {scrubIndex != null && scrubPoint ? (
        <TooltipLayer
          tooltip={tooltip}
          info={{
            index: scrubIndex,
            datum: {
              label: categories[scrubIndex],
              values: series.map((entry) => entry.values[scrubIndex] ?? 0)
            },
            value: series[0]?.values[scrubIndex] ?? 0,
            values: series.map((entry) => entry.values[scrubIndex] ?? 0),
            x: scrubPoint.x,
            y: scrubPoint.y,
            width,
            height
          }}
        />
      ) : null}
    </View>
  );
}

function polygonPath(points: Array<{ x: number; y: number }>) {
  const builder = Skia.Path.Make();
  if (points.length === 0) return builder;
  builder.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => builder.lineTo(point.x, point.y));
  builder.close();
  return builder;
}

function polarPoint(centerX: number, centerY: number, radius: number, angle: number) {
  return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
}

function radialLimit(radii: number[], angle: number, startAngle: number, angleStep: number) {
  if (radii.length === 0 || angleStep === 0) return 0;
  const normalized = ((angle - startAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const position = normalized / angleStep;
  const index = Math.floor(position) % radii.length;
  const nextIndex = (index + 1) % radii.length;
  const progress = position - Math.floor(position);
  return radii[index] + (radii[nextIndex] - radii[index]) * progress;
}

function nearestCategoryIndex(angle: number, startAngle: number, angleStep: number, count: number) {
  if (count === 0 || angleStep === 0) return 0;
  const normalized = ((angle - startAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return Math.round(normalized / angleStep) % count;
}
