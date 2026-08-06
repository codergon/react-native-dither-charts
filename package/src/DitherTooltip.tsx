import React from "react";
import { Circle, Line, vec } from "@shopify/react-native-skia";
import { StyleSheet, Text, View } from "react-native";
import { ditherPalette } from "./palette";
import { clamp } from "./utils";
import type { ScrubGuideConfig, TooltipConfig, TooltipProp, TooltipRenderInfo } from "./types";

/** Vertical guide line + point marker, drawn inside the Skia canvas at the scrub position. */
export function ScrubGuide({
  x,
  height,
  color,
  dotY,
  dots,
  config
}: {
  x: number;
  height: number;
  color: string;
  dotY?: number;
  dots?: Array<{ y: number; color?: string }>;
  config?: ScrubGuideConfig;
}) {
  const resolvedDots = dots ?? (dotY == null ? [] : [{ y: dotY, color }]);
  const dotRadius = config?.dotRadius ?? 3.5;
  const haloRadius = config?.haloRadius ?? 6;

  return (
    <>
      {config?.showLine !== false ? (
        <Line
          p1={vec(x, 0)}
          p2={vec(x, height)}
          color={config?.lineColor ?? color}
          strokeWidth={config?.lineWidth ?? 1}
          opacity={config?.lineOpacity ?? 0.3}
        />
      ) : null}
      {config?.showDot !== false
        ? resolvedDots.map((dot, index) => {
            const dotColor = config?.dotColor ?? dot.color ?? color;
            return (
              <React.Fragment key={`scrub-dot-${index}`}>
                <Circle
                  cx={x}
                  cy={dot.y}
                  r={haloRadius}
                  color={dotColor}
                  opacity={config?.haloOpacity ?? 0.16}
                />
                <Circle cx={x} cy={dot.y} r={dotRadius} color={dotColor} />
              </React.Fragment>
            );
          })
        : null}
    </>
  );
}

export function TooltipLayer<T>({
  tooltip,
  info
}: {
  tooltip?: TooltipProp;
  info: TooltipRenderInfo<T>;
}) {
  if (!tooltip) return null;
  const renderer = typeof tooltip === "function" ? tooltip : typeof tooltip === "object" ? tooltip.render : undefined;
  if (renderer) return <>{renderer(info)}</>;
  const config = typeof tooltip === "object" ? tooltip : undefined;

  return (
    <TooltipBubble
      x={info.x}
      y={info.y}
      width={info.width}
      height={info.height}
      value={config?.formatValue ? config.formatValue(info.value, info.datum, info.index) : String(info.value)}
      label={config?.formatLabel ? config.formatLabel(info.datum, info.index) : (info.datum as any)?.label}
      config={config}
    />
  );
}

/** Floating value bubble rendered above the scrub position, outside the canvas. */
export function TooltipBubble({
  x,
  y,
  width,
  height,
  label,
  value,
  config
}: {
  x: number;
  y?: number;
  width: number;
  height?: number;
  label?: string;
  value: string;
  config?: TooltipConfig;
}) {
  const bubbleWidth = config?.width ?? 90;
  const left = clamp(x - bubbleWidth / 2, 0, Math.max(width - bubbleWidth, 0));
  const top = config?.position === "point"
    ? clamp((y ?? 0) - 58, 4, Math.max((height ?? 58) - 54, 4))
    : 6;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.bubble,
        {
          left,
          top,
          width: bubbleWidth,
          backgroundColor: config?.backgroundColor ?? ditherPalette.paper,
          borderColor: config?.borderColor ?? "#E1E2E6"
        }
      ]}
    >
      <Text style={[styles.value, { color: config?.textColor ?? ditherPalette.ink }]} numberOfLines={1}>
        {value}
      </Text>
      {label ? (
        <Text style={[styles.label, { color: config?.textColor ?? ditherPalette.ink }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "flex-start",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2
  },
  value: {
    fontSize: 13,
    fontWeight: "700"
  },
  label: {
    fontSize: 10,
    opacity: 0.72,
    marginTop: 1
  }
});
