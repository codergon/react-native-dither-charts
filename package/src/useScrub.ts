import { useCallback, useRef, useState } from "react";
import type { GestureResponderEvent } from "react-native";
import { clamp } from "./utils";

/**
 * Tracks a finger dragging across a chart's plot area and reports the local x
 * position in pixels. Callers translate that into a nearest-data-point index.
 */
export function useScrub(
  width: number,
  enabled: boolean,
  onTap?: (point: { x: number; y: number }) => void,
  snapPoint?: (point: { x: number; y: number }) => { x: number; y: number },
  tapOnGrant = false
) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  // Tracks the point last shown so a stationary tap on the same spot can dismiss it
  // instead of leaving it stuck until a drag happens (see release()/grant() below).
  const committedRef = useRef<{ x: number; y: number } | null>(null);
  const toggleOffOnRelease = useRef(false);

  const commitPoint = useCallback((next: { x: number; y: number }) => {
    committedRef.current = next;
    setPoint((current) =>
      current?.x === next.x && current.y === next.y ? current : next
    );
  }, []);

  const pointFromEvent = useCallback(
    (event: GestureResponderEvent) => ({
      x: clamp(event.nativeEvent.locationX, 0, width),
      y: event.nativeEvent.locationY
    }),
    [width]
  );

  const update = useCallback(
    (event: GestureResponderEvent) => {
      const next = pointFromEvent(event);
      const { x, y } = next;
      const deltaX = x - startPoint.current.x;
      const deltaY = y - startPoint.current.y;
      if (Math.hypot(deltaX, deltaY) > 5) {
        moved.current = true;
      }
      commitPoint(snapPoint ? snapPoint(next) : next);
    },
    [commitPoint, pointFromEvent, snapPoint]
  );

  const clear = useCallback(() => {
    committedRef.current = null;
    toggleOffOnRelease.current = false;
    setPoint(null);
    setIsScrubbing(false);
  }, []);

  const grant = useCallback(
    (event: GestureResponderEvent) => {
      const next = pointFromEvent(event);
      startPoint.current = next;
      moved.current = false;
      setIsScrubbing(true);
      const snapped = snapPoint ? snapPoint(next) : next;
      // A tap landing back on the currently shown point is a request to dismiss it,
      // but only commit to that if the gesture turns out to be a stationary tap
      // (see release()) rather than the start of a drag.
      toggleOffOnRelease.current =
        !tapOnGrant &&
        committedRef.current != null &&
        committedRef.current.x === snapped.x &&
        committedRef.current.y === snapped.y;
      commitPoint(snapped);
      if (tapOnGrant) onTap?.(next);
    },
    [commitPoint, onTap, pointFromEvent, snapPoint, tapOnGrant]
  );

  const release = useCallback(
    (event: GestureResponderEvent) => {
      const next = pointFromEvent(event);
      if (!moved.current && !tapOnGrant) {
        if (toggleOffOnRelease.current) {
          committedRef.current = null;
          setPoint(null);
        } else {
          commitPoint(snapPoint ? snapPoint(next) : next);
          onTap?.(next);
        }
      }
      setIsScrubbing(false);
      if (moved.current) clear();
    },
    [clear, commitPoint, onTap, pointFromEvent, snapPoint, tapOnGrant]
  );

  const handlers = enabled
    ? {
        onStartShouldSetResponderCapture: () => true,
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderGrant: grant,
        onResponderMove: update,
        onResponderRelease: release,
        onResponderTerminate: clear,
        onResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true
      }
    : undefined;

  return { scrubX: point?.x ?? null, scrubY: point?.y ?? null, isScrubbing, handlers };
}
