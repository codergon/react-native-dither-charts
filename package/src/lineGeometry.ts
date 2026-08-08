import { Skia } from "@shopify/react-native-skia";
import { clamp } from "./utils";

export type Point = { x: number; y: number };
export type Curve = "linear" | "smooth";

export function tracePoints(
  path: ReturnType<typeof Skia.Path.Make>,
  points: Point[],
  curve: Curve,
  moveToStart = true
) {
  tracePointsRange(path, points, curve, 0, points.length - 1, moveToStart);
}

// Traces only points[fromIndex..toIndex], but still reads the tangent-defining
// neighbors from the full `points` array — so a path split at some index joins its
// counterpart with no kink, unlike slicing the array first and re-deriving tangents
// from scratch at the cut edge.
export function tracePointsRange(
  path: ReturnType<typeof Skia.Path.Make>,
  points: Point[],
  curve: Curve,
  fromIndex: number,
  toIndex: number,
  moveToStart = true
) {
  if (points.length === 0 || fromIndex > toIndex) return;
  const start = points[fromIndex];
  if (moveToStart) path.moveTo(start.x, start.y);
  else path.lineTo(start.x, start.y);

  for (let index = fromIndex; index < toIndex; index += 1) {
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

export function curveYAtX(points: Point[], x: number, curve: Curve) {
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
  return inverse ** 3 * current.y + 3 * inverse ** 2 * t * control1 + 3 * inverse * t ** 2 * control2 + t ** 3 * next.y;
}

// Offsetting each point straight up/down by bandWidth/2 keeps the *vertical* gap
// constant, but the band visibly pinches on steep slopes because the perpendicular
// thickness the eye actually sees shrinks by cos(slope angle). Offsetting along each
// point's local normal (perpendicular to its tangent, approximated from its
// neighbors) keeps the band a constant width regardless of slope.
export function offsetBand(points: Point[], bandWidth: number) {
  const halfWidth = bandWidth / 2;
  const upper: Point[] = [];
  const lower: Point[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const next = points[index + 1] ?? points[index];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    const point = points[index];
    upper.push({ x: point.x - normalX * halfWidth, y: point.y - normalY * halfWidth });
    lower.push({ x: point.x + normalX * halfWidth, y: point.y + normalY * halfWidth });
  }

  return { upper, lower };
}
