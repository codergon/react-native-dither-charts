import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Canvas, Group, LinearGradient, Path, Skia, rect, vec } from "@shopify/react-native-skia";
import { View } from "react-native";
import { Easing, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";
import { TooltipLayer } from "./DitherTooltip";
import { defaultSeriesColors } from "./palette";
import { clamp, resolveDither, sum } from "./utils";
import { useScrub } from "./useScrub";
import type { PieChartProps } from "./types";

const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21]
] as const;

const MAX_PIXEL_PATH_CACHE_ENTRIES = 48;
const pixelPathCache = new Map<
  string,
  {
    basePath: ReturnType<typeof Skia.Path.Make>;
    ditherPath: ReturnType<typeof Skia.Path.Make>;
  }
>();

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
  baseOpacity = 0.12,
  focusedIndex,
  activeScale = 1.025,
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
      return {
        item,
        color: item.color ?? colors[index % colors.length],
        start: sliceStart,
        end: sliceStart + sweep,
        middle: sliceStart + sweep / 2
      };
    });
  }, [colors, data, gapAngle, startAngle, total]);

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

  const defaultDither = useMemo(
    () =>
      dither ?? {
        variant: "gradient" as const,
        cellSize: 1.4,
        startDensity: 0.22,
        endDensity: 1,
        solidFrom: 0.93
      },
    [dither]
  );
  const resolvedDither = useMemo(() => resolveDither(defaultDither), [defaultDither]);
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
  const activeProtrusion = resolvedOuterRadius * (activeScale - 1);
  const sliceRenderOrder = useMemo(() => {
    const entries = slices.map((slice, index) => ({ slice, index }));
    if (
      resolvedFocusedIndex == null ||
      resolvedFocusedIndex < 0 ||
      resolvedFocusedIndex >= entries.length
    ) {
      return entries;
    }
    const focusedEntry = entries.splice(resolvedFocusedIndex, 1)[0];
    if (focusedEntry) entries.push(focusedEntry);
    return entries;
  }, [resolvedFocusedIndex, slices]);

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
        {sliceRenderOrder.map(({ slice, index }) => (
          <PieSliceFocusMorph
            key={`pie-slice-${index}`}
            active={resolvedFocusedIndex === index}
            duration={focusAnimationDuration}
            activeProtrusion={activeProtrusion}
            centerX={centerX}
            centerY={centerY}
            innerRadius={resolvedInnerRadius}
            outerRadius={resolvedOuterRadius}
            start={slice.start}
            end={slice.end}
            width={width}
            height={height}
            color={slice.color}
            baseOpacity={baseOpacity}
            dither={resolvedDither}
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

type PixelDonutSliceProps = {
  centerX: number;
  centerY: number;
  innerRadius: number;
  outerRadius: number;
  densityInnerRadius?: number;
  densityOuterRadius?: number;
  start: number;
  end: number;
  width: number;
  height: number;
  color: string;
  baseOpacity: number;
  dither: ReturnType<typeof resolveDither>;
};

type PieSliceFocusMorphProps = PixelDonutSliceProps & {
  active: boolean;
  activeProtrusion: number;
  duration: number;
};

function PieSliceFocusMorph({
  active,
  activeProtrusion,
  duration,
  start,
  end,
  centerX,
  centerY,
  ...sliceProps
}: PieSliceFocusMorphProps) {
  const progress = useSharedValue(active ? 1 : 0);
  const middle = (start + end) / 2;
  const angle = (middle * Math.PI) / 180;
  const translateX = Math.cos(angle) * activeProtrusion;
  const translateY = Math.sin(angle) * activeProtrusion;
  const transform = useDerivedValue(() => [
    { translateX: translateX * progress.value },
    { translateY: translateY * progress.value }
  ]);

  useLayoutEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration,
      easing: Easing.out(Easing.cubic)
    });
  }, [active, duration, progress]);

  if (activeProtrusion <= 0) {
    return (
      <PixelDonutSlice
        {...sliceProps}
        start={start}
        end={end}
        centerX={centerX}
        centerY={centerY}
      />
    );
  }

  return (
    <Group transform={transform}>
      <PixelDonutSlice
        {...sliceProps}
        start={start}
        end={end}
        centerX={centerX}
        centerY={centerY}
      />
    </Group>
  );
}

const PixelDonutSlice = React.memo(function PixelDonutSlice({
  centerX,
  centerY,
  innerRadius,
  outerRadius,
  densityInnerRadius = innerRadius,
  densityOuterRadius = outerRadius,
  start,
  end,
  width,
  height,
  color,
  baseOpacity,
  dither
}: PixelDonutSliceProps) {
  const { basePath, ditherPath } = useMemo(() => {
    const cacheKey = pixelPathCacheKey(
      centerX,
      centerY,
      innerRadius,
      outerRadius,
      densityInnerRadius,
      densityOuterRadius,
      start,
      end,
      width,
      height,
      dither
    );
    const cached = pixelPathCache.get(cacheKey);
    if (cached) return cached;

    const base = Skia.Path.Make();
    const marks = Skia.Path.Make();
    const cell = dither.cellSize;
    const bounds = donutSliceBounds(
      centerX,
      centerY,
      innerRadius,
      outerRadius,
      start,
      end,
      width,
      height,
      cell
    );
    const startColumn = Math.floor(bounds.left / cell);
    const endColumn = Math.ceil(bounds.right / cell);
    const startRow = Math.floor(bounds.top / cell);
    const endRow = Math.ceil(bounds.bottom / cell);

    for (let row = startRow; row < endRow; row += 1) {
      for (let column = startColumn; column < endColumn; column += 1) {
        const pixelX = column * cell;
        const pixelY = row * cell;
        const center = {
          x: pixelX + cell / 2,
          y: pixelY + cell / 2
        };
        if (!pointInDonutSlice(center.x, center.y, centerX, centerY, innerRadius, outerRadius, start, end)) {
          continue;
        }

        const cellRect = rect(
          pixelX,
          pixelY,
          Math.min(cell, width - pixelX),
          Math.min(cell, height - pixelY)
        );
        base.addRect(cellRect);

        const radialProgress = clamp(
          (Math.hypot(center.x - centerX, center.y - centerY) - densityInnerRadius) /
            Math.max(densityOuterRadius - densityInnerRadius, 0.001),
          0,
          1
        );
        const directedProgress =
          dither.direction === "bottom-to-top" ? 1 - radialProgress : radialProgress;
        const rampProgress = clamp(directedProgress / dither.solidFrom, 0, 1);
        const shapedProgress = rampProgress ** 1.35;
        const density = clamp(
          dither.startDensity + (dither.endDensity - dither.startDensity) * shapedProgress,
          0,
          1
        );
        const threshold = (BAYER_8[row % 8][column % 8] + 0.5) / 64;
        if (density >= threshold) {
          marks.addRect(cellRect);
        }
      }
    }

    const paths = {
      basePath: base,
      ditherPath: marks
    };
    if (pixelPathCache.size >= MAX_PIXEL_PATH_CACHE_ENTRIES) pixelPathCache.clear();
    pixelPathCache.set(cacheKey, paths);
    return paths;
  }, [
    centerX,
    centerY,
    densityInnerRadius,
    densityOuterRadius,
    dither,
    end,
    height,
    innerRadius,
    outerRadius,
    start,
    width
  ]);

  return (
    <>
      <Path path={basePath} color={dither.color ?? color} opacity={baseOpacity} />
      <Path path={ditherPath} color={dither.color ?? color} opacity={dither.opacity}>
        {dither.gradientColors ? (
          <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={dither.gradientColors} />
        ) : null}
      </Path>
    </>
  );
}, pixelDonutSlicePropsEqual);

function pixelDonutSlicePropsEqual(previous: PixelDonutSliceProps, next: PixelDonutSliceProps) {
  return (
    previous.centerX === next.centerX &&
    previous.centerY === next.centerY &&
    previous.innerRadius === next.innerRadius &&
    previous.outerRadius === next.outerRadius &&
    previous.densityInnerRadius === next.densityInnerRadius &&
    previous.densityOuterRadius === next.densityOuterRadius &&
    previous.start === next.start &&
    previous.end === next.end &&
    previous.width === next.width &&
    previous.height === next.height &&
    previous.color === next.color &&
    previous.baseOpacity === next.baseOpacity &&
    previous.dither === next.dither
  );
}

function pixelPathCacheKey(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  densityInnerRadius: number,
  densityOuterRadius: number,
  start: number,
  end: number,
  width: number,
  height: number,
  dither: ReturnType<typeof resolveDither>
) {
  return [
    centerX,
    centerY,
    innerRadius,
    outerRadius,
    densityInnerRadius,
    densityOuterRadius,
    start,
    end,
    width,
    height,
    dither.cellSize,
    dither.startDensity,
    dither.endDensity,
    dither.solidFrom,
    dither.direction
  ].join(":");
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

function pointInDonutSlice(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  start: number,
  end: number
) {
  const dx = x - centerX;
  const dy = y - centerY;
  const radius = Math.hypot(dx, dy);
  if (radius < innerRadius || radius > outerRadius) return false;
  const angle = normalizeAngle((Math.atan2(dy, dx) * 180) / Math.PI);
  return angleInRange(angle, start, end);
}

function donutSliceBounds(
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  start: number,
  end: number,
  width: number,
  height: number,
  cellSize: number
) {
  const points = [
    polarPoint(centerX, centerY, outerRadius, start),
    polarPoint(centerX, centerY, outerRadius, end),
    polarPoint(centerX, centerY, innerRadius, start),
    polarPoint(centerX, centerY, innerRadius, end)
  ];

  [0, 90, 180, 270].forEach((angle) => {
    if (angleInRange(angle, start, end)) {
      points.push(polarPoint(centerX, centerY, outerRadius, angle));
    }
  });

  return {
    left: clamp(Math.min(...points.map((point) => point.x)) - cellSize, 0, width),
    right: clamp(Math.max(...points.map((point) => point.x)) + cellSize, 0, width),
    top: clamp(Math.min(...points.map((point) => point.y)) - cellSize, 0, height),
    bottom: clamp(Math.max(...points.map((point) => point.y)) + cellSize, 0, height)
  };
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
