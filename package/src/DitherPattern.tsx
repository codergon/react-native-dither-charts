import React, { useEffect, useMemo, useState } from "react";
import { Group, LinearGradient, Path, Skia, rrect, rect, vec } from "@shopify/react-native-skia";
import { clamp, resolveDither } from "./utils";
import type { DitherOptions } from "./types";

type DitherPatternProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  radius?: number;
  dither?: DitherOptions;
  clip?: boolean;
  opacity?: number;
  densityProgress?: (x: number, y: number) => number;
};

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

function DitherPatternComponent({
  x,
  y,
  width,
  height,
  color,
  radius = 0,
  dither,
  clip = true,
  opacity = 1,
  densityProgress
}: DitherPatternProps) {
  // Building the dither cells below walks every pixel cell in the shape (width/height
  // divided by cellSize), which is expensive enough on first mount to block the JS
  // thread long enough for touch responders to feel dead. Skip it on the very first
  // frame so the chart mounts (and becomes touchable) cheaply, then fill it in a
  // frame later once the initial commit is already on screen.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const options = useMemo(
    () => resolveDither(dither),
    [
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
      dither?.solidFrom,
      dither?.startDensity,
      dither?.strokeWidth,
      dither?.variant
    ]
  );

  const paths = useMemo(() => {
    const primary = Skia.Path.Make();
    const secondary = Skia.Path.Make();

    if (width <= 0 || height <= 0) {
      return { primary, secondary };
    }

    if (options.variant === "solid") {
      primary.addRect(rect(x, y, width, height));
      return { primary, secondary };
    }

    if (!hydrated) {
      return { primary, secondary };
    }

    if (options.variant === "gradient") {
      const cell = options.cellSize;
      const columns = Math.ceil(width / cell);
      const rows = Math.ceil(height / cell);

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const progress = densityProgress
            ? densityProgress(x + (column + 0.5) * cell, y + (row + 0.5) * cell)
            : rows <= 1
              ? 1
              : row / (rows - 1);
          const directedProgress = options.direction === "bottom-to-top" ? 1 - progress : progress;
          const rampProgress = clamp(directedProgress / options.solidFrom, 0, 1);
          const shapedProgress = rampProgress ** 1.35;
          const density = clamp(
            options.startDensity + (options.endDensity - options.startDensity) * shapedProgress,
            0,
            1
          );
          const threshold = (BAYER_8[row % 8][column % 8] + 0.5) / 64;
          if (density < threshold) continue;

          const pixelX = x + column * cell;
          const pixelY = y + row * cell;
          primary.addRect(
            rect(
              pixelX,
              pixelY,
              Math.min(cell, x + width - pixelX),
              Math.min(cell, y + height - pixelY)
            )
          );
        }
      }

      return { primary, secondary };
    }

    if (options.variant === "dotted") {
      for (let dotY = y + options.gap / 2; dotY < y + height; dotY += options.gap) {
        for (let dotX = x + options.gap / 2; dotX < x + width; dotX += options.gap) {
          const offset = options.jitter
            ? Math.sin(dotX * 12.9898 + dotY * 78.233) * options.jitter
            : 0;
          primary.addCircle(dotX + offset, dotY - offset, options.dotSize / 2);
        }
      }

      return { primary, secondary };
    }

    for (let lineX = x - height; lineX < x + width; lineX += options.gap) {
      primary.moveTo(lineX, y + height);
      primary.lineTo(lineX + height, y);
    }

    if (options.variant === "crosshatch") {
      for (let lineX = x; lineX < x + width + height; lineX += options.gap) {
        secondary.moveTo(lineX, y);
        secondary.lineTo(lineX - height, y + height);
      }
    }

    return { primary, secondary };
  }, [densityProgress, height, hydrated, options, width, x, y]);

  const marks = (
    <>
      <Path
        path={paths.primary}
        color={options.color ?? color}
        opacity={options.opacity * opacity}
        style={options.variant === "hatched" || options.variant === "crosshatch" ? "stroke" : "fill"}
        strokeWidth={options.strokeWidth}
        strokeCap="butt"
        strokeJoin="miter"
        antiAlias
      >
        {options.variant === "gradient" && options.gradientColors ? (
          <LinearGradient
            start={vec(x, y)}
            end={vec(x, y + height)}
            colors={options.gradientColors}
          />
        ) : null}
      </Path>
      {options.variant === "crosshatch" ? (
        <Path
          path={paths.secondary}
          color={options.color ?? color}
          opacity={options.opacity * opacity * 0.72}
          style="stroke"
          strokeWidth={options.strokeWidth}
          strokeCap="butt"
          strokeJoin="miter"
          antiAlias
        />
      ) : null}
    </>
  );

  if (!clip) return <Group>{marks}</Group>;

  const clipShape = radius > 0
    ? rrect(rect(x, y, width, height), radius, radius)
    : rect(x, y, width, height);

  return <Group clip={clipShape}>{marks}</Group>;
}

export const DitherPattern = React.memo(
  DitherPatternComponent,
  (previous, next) =>
    previous.x === next.x &&
    previous.y === next.y &&
    previous.width === next.width &&
    previous.height === next.height &&
    previous.color === next.color &&
    previous.radius === next.radius &&
    previous.clip === next.clip &&
    previous.opacity === next.opacity &&
    previous.densityProgress === next.densityProgress &&
    ditherOptionsEqual(previous.dither, next.dither)
);

function ditherOptionsEqual(
  previous: DitherOptions | undefined,
  next: DitherOptions | undefined
) {
  if (previous === next) return true;
  return (
    previous?.cellSize === next?.cellSize &&
    previous?.color === next?.color &&
    previous?.direction === next?.direction &&
    previous?.dotSize === next?.dotSize &&
    previous?.endDensity === next?.endDensity &&
    previous?.gap === next?.gap &&
    previous?.gradientColors === next?.gradientColors &&
    previous?.jitter === next?.jitter &&
    previous?.opacity === next?.opacity &&
    previous?.pattern === next?.pattern &&
    previous?.solidFrom === next?.solidFrom &&
    previous?.startDensity === next?.startDensity &&
    previous?.strokeWidth === next?.strokeWidth &&
    previous?.variant === next?.variant
  );
}
