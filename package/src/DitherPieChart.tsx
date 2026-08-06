import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas, Group, Path, Rect, Skia, rect } from "@shopify/react-native-skia";
import { View } from "react-native";
import { DitherPattern } from "./DitherPattern";
import { FocusCrossfade } from "./FocusCrossfade";
import { TooltipLayer } from "./DitherTooltip";
import { defaultSeriesColors } from "./palette";
import { clamp, resolveDither, sum } from "./utils";
import { useScrub } from "./useScrub";
import type { PieChartProps } from "./types";

export function DitherPieChart({
  data,
  width,
  height,
  style,
  innerRadius,
  outerRadius,
  startAngle = -90,
  gapAngle = 0,
  colors = defaultSeriesColors,
  dither,
  baseOpacity = 0.16,
  focusedIndex,
  activeScale = 1.025,
  activeSolidFrom = 0.9,
  focusAnimationDuration = 160,
  focusOnPress = true,
  tooltip,
  onSliceFocus,
  onScrub
}: PieChartProps) {
  const centerX = width / 2;
  const centerY = height / 2;
  const resolvedOuterRadius =
    outerRadius ?? Math.max((Math.min(width, height) / 2 - 4) / activeScale, 0);
  const resolvedInnerRadius = clamp(innerRadius ?? resolvedOuterRadius * 0.46, 0, resolvedOuterRadius - 1);
  const total = Math.max(sum(data.map((item) => Math.max(item.value, 0))), 1);

  const slices = useMemo(() => {
    let angle = startAngle;
    return data.map((item, index) => {
      const fullSweep = (Math.max(item.value, 0) / total) * 360;
      const sliceStart = angle + gapAngle / 2;
      const sweep = Math.max(fullSweep - gapAngle, 0.01);
      angle += fullSweep;
      const targetOuter = resolvedOuterRadius * activeScale;
      return {
        path: donutSlicePath(
          centerX,
          centerY,
          resolvedInnerRadius,
          resolvedOuterRadius,
          sliceStart,
          sweep
        ),
        item,
        color: item.color ?? colors[index % colors.length],
        activePath: donutSlicePath(
          centerX,
          centerY,
          resolvedInnerRadius,
          targetOuter,
          sliceStart,
          sweep
        ),
        start: sliceStart,
        end: sliceStart + sweep,
        middle: sliceStart + sweep / 2,
        activeDensityProgress: (x: number, y: number) => {
          return clamp(
            (Math.hypot(x - centerX, y - centerY) - resolvedInnerRadius) /
              Math.max(targetOuter - resolvedInnerRadius, 0.001),
            0,
            1
          );
        }
      };
    });
  }, [activeScale, activeSolidFrom, centerX, centerY, colors, data, gapAngle, resolvedInnerRadius, resolvedOuterRadius, startAngle, total]);

  const [internalFocusedIndex, setInternalFocusedIndex] = useState<number | null>(null);
  const resolvedFocusedIndex = focusedIndex === undefined ? internalFocusedIndex : focusedIndex;
  const setFocusedIndex = useCallback(
    (next: number | null) => {
      if (focusedIndex === undefined) setInternalFocusedIndex(next);
      onSliceFocus?.(next);
    },
    [focusedIndex, onSliceFocus]
  );

  const focusFromPoint = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      const hitIndex = hitSliceIndex(
        x,
        y,
        centerX,
        centerY,
        resolvedInnerRadius,
        resolvedOuterRadius,
        slices
      );
      if (hitIndex == null) {
        setFocusedIndex(null);
        return;
      }
      const next = hitIndex === resolvedFocusedIndex ? null : hitIndex;
      setFocusedIndex(next);
    },
    [centerX, centerY, resolvedFocusedIndex, resolvedInnerRadius, resolvedOuterRadius, setFocusedIndex, slices]
  );

  const defaultDither = dither ?? {
    variant: "gradient" as const,
    cellSize: 1.25,
    startDensity: 0.28,
    endDensity: 1,
    solidFrom: 0.97
  };
  const resolvedDither = resolveDither(defaultDither);
  const snapPoint = useCallback(
    (point: { x: number; y: number }) => {
      const index = hitSliceIndex(
        point.x,
        point.y,
        centerX,
        centerY,
        resolvedInnerRadius,
        resolvedOuterRadius,
        slices
      );
      if (index == null) return point;
      return polarPoint(
        centerX,
        centerY,
        resolvedInnerRadius + (resolvedOuterRadius - resolvedInnerRadius) * 0.62,
        slices[index].middle
      );
    },
    [centerX, centerY, resolvedInnerRadius, resolvedOuterRadius, slices]
  );
  const scrubEnabled = focusOnPress || Boolean(tooltip) || Boolean(onScrub);
  const { scrubX, scrubY, isScrubbing, handlers } = useScrub(
    width,
    scrubEnabled,
    focusOnPress ? focusFromPoint : undefined,
    snapPoint,
    focusOnPress
  );
  const scrubIndex =
    scrubX == null || scrubY == null
      ? null
      : hitSliceIndex(
          scrubX,
          scrubY,
          centerX,
          centerY,
          resolvedInnerRadius,
          resolvedOuterRadius,
          slices
        );
  const activeIndex = isScrubbing ? scrubIndex : resolvedFocusedIndex;
  const activeSlice = activeIndex == null ? null : slices[activeIndex];
  const activePoint = activeSlice
    ? polarPoint(
        centerX,
        centerY,
        resolvedInnerRadius + (resolvedOuterRadius - resolvedInnerRadius) * 0.74,
        activeSlice.middle
      )
    : null;
  const resolvedTooltip =
    tooltip === true ? { position: "point" as const } : tooltip;
  const densityProgress = useCallback(
    (x: number, y: number) =>
      clamp(
        (Math.hypot(x - centerX, y - centerY) - resolvedInnerRadius) /
          Math.max(resolvedOuterRadius - resolvedInnerRadius, 0.001),
        0,
        1
      ),
    [centerX, centerY, resolvedInnerRadius, resolvedOuterRadius]
  );

  useEffect(() => {
    if (!onScrub) return;
    if (activeIndex == null || !activeSlice) {
      onScrub(null);
      return;
    }
    onScrub({
      index: activeIndex,
      datum: activeSlice.item,
      value: activeSlice.item.value,
      x: activePoint?.x ?? centerX,
      y: activePoint?.y ?? centerY
    });
  }, [activeIndex, activePoint?.x, activePoint?.y, activeSlice, centerX, centerY, onScrub]);

  return (
    <View style={[{ width, height }, style]} {...(handlers ?? {})}>
      <Canvas style={{ width, height }} pointerEvents="none">
        {slices.map((slice, index) => (
          <FocusCrossfade
            key={`pie-slice-${index}`}
            active={index === resolvedFocusedIndex}
            duration={focusAnimationDuration}
            resting={
              <Group clip={slice.path}>
                <Rect
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  color={slice.color}
                  opacity={baseOpacity}
                />
                <DitherPattern
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  color={slice.color}
                  dither={defaultDither}
                  clip={false}
                  densityProgress={densityProgress}
                />
                <Path
                  path={slice.path}
                  color={slice.color}
                  opacity={0.22}
                  style="stroke"
                  strokeWidth={0.4}
                />
              </Group>
            }
            focused={
              <Group clip={slice.activePath}>
                  <Rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    color={slice.color}
                    opacity={baseOpacity}
                  />
                  <DitherPattern
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    color={slice.color}
                    dither={{
                      variant: "gradient",
                      cellSize: resolvedDither.cellSize,
                      startDensity: resolvedDither.startDensity,
                      endDensity: 1,
                      solidFrom: activeSolidFrom
                    }}
                    clip={false}
                    densityProgress={slice.activeDensityProgress}
                  />
                  <Path
                    path={slice.activePath}
                    color={slice.color}
                    opacity={0.22}
                    style="stroke"
                    strokeWidth={0.4}
                  />
              </Group>
            }
          />
        ))}
      </Canvas>
      {activeSlice && activePoint ? (
        <TooltipLayer
          tooltip={resolvedTooltip}
          info={{
            index: activeIndex as number,
            datum: activeSlice.item,
            value: activeSlice.item.value,
            x: activePoint.x,
            y: activePoint.y,
            width,
            height
          }}
        />
      ) : null}
    </View>
  );
}

export function DitherDonutChart(props: PieChartProps) {
  return <DitherPieChart {...props} />;
}

function donutSlicePath(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  start: number,
  sweep: number
) {
  const path = Skia.Path.Make();
  const outerStart = polarPoint(centerX, centerY, outerRadius, start);
  path.moveTo(outerStart.x, outerStart.y);
  path.arcToOval(
    rect(centerX - outerRadius, centerY - outerRadius, outerRadius * 2, outerRadius * 2),
    start,
    sweep,
    false
  );
  if (innerRadius > 0) {
    const innerEnd = polarPoint(centerX, centerY, innerRadius, start + sweep);
    path.lineTo(innerEnd.x, innerEnd.y);
    path.arcToOval(
      rect(centerX - innerRadius, centerY - innerRadius, innerRadius * 2, innerRadius * 2),
      start + sweep,
      -sweep,
      false
    );
  } else {
    path.lineTo(centerX, centerY);
  }
  path.close();
  return path;
}

function hitSliceIndex(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  slices: Array<{ start: number; end: number }>
) {
  const dx = x - centerX;
  const dy = y - centerY;
  const radius = Math.hypot(dx, dy);
  if (radius < innerRadius || radius > outerRadius) return null;
  const angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
  const index = slices.findIndex((slice) => angleInRange(angle, slice.start, slice.end));
  return index < 0 ? null : index;
}

function polarPoint(centerX: number, centerY: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: centerX + Math.cos(radians) * radius, y: centerY + Math.sin(radians) * radius };
}

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function angleInRange(angle: number, start: number, end: number) {
  const normalizedStart = normalizeAngle(start);
  const normalizedEnd = normalizeAngle(end);
  return normalizedStart <= normalizedEnd
    ? angle >= normalizedStart && angle <= normalizedEnd
    : angle >= normalizedStart || angle <= normalizedEnd;
}
