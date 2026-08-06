import type { DitherOptions } from "./types";

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const sum = (values: number[]) => {
  return values.reduce((total, value) => total + value, 0);
};

const legacyVariant = (pattern?: DitherOptions["pattern"]): NonNullable<DitherOptions["variant"]> | undefined => {
  if (pattern === "dots") return "dotted";
  if (pattern === "diagonal") return "hatched";
  if (pattern === "crosshatch") return "crosshatch";
  return undefined;
};

export const resolveDither = (dither?: DitherOptions) => ({
  variant: dither?.variant ?? legacyVariant(dither?.pattern) ?? "gradient",
  cellSize: Math.max(dither?.cellSize ?? 2, 0.75),
  startDensity: dither?.startDensity ?? 0.28,
  endDensity: dither?.endDensity ?? 1,
  solidFrom: clamp(dither?.solidFrom ?? 0.94, 0.05, 1),
  gradientColors: dither?.gradientColors,
  direction: dither?.direction ?? "top-to-bottom",
  dotSize: dither?.dotSize ?? 2,
  gap: dither?.gap ?? 5,
  opacity: dither?.opacity ?? 1,
  jitter: dither?.jitter ?? 0,
  strokeWidth: dither?.strokeWidth ?? 2,
  color: dither?.color
});

/** Evenly spaced tick labels from `maxValue` down to 0, formatted for the y-axis. */
export const generateYTicks = (
  maxValue: number,
  count: number,
  formatLabel?: (value: any, index: number) => string
) => {
  const resolvedCount = Math.max(count, 1);
  const ticks: string[] = [];
  const intervals = Math.max(resolvedCount - 1, 1);
  const roughStep = maxValue / intervals;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(roughStep, 1)));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  const step = niceNormalized * magnitude;
  const topTick = Math.floor(maxValue / step) * step;

  for (let index = 0; index < resolvedCount; index += 1) {
    const value = Math.max(topTick - index * step, 0);
    ticks.push(formatLabel ? formatLabel(value, index) : String(Math.round(value)));
  }

  return ticks;
};

/** Nearest data index for an evenly-spaced series (line/area charts). */
export const nearestIndexFromX = (x: number, step: number, length: number) => {
  if (length === 0) return 0;
  if (step <= 0) return 0;
  return clamp(Math.round(x / step), 0, length - 1);
};

/** Nearest data index by proximity to a list of item centers (bar charts). */
export const nearestIndexByCenters = (x: number, centers: number[]) => {
  let bestIndex = 0;
  let bestDistance = Infinity;

  centers.forEach((center, index) => {
    const distance = Math.abs(x - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
};
