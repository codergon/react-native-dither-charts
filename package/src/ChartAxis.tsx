import React from "react";
import { Text, View, type ViewStyle } from "react-native";
import { ditherPalette } from "./palette";
import type { AxisConfig } from "./types";

export function YAxisLabels({
  ticks,
  width,
  height,
  config
}: {
  ticks: string[];
  width: number;
  height: number;
  config?: AxisConfig;
}) {
  return (
    <View style={{ width, height, justifyContent: "space-between", paddingRight: 6 }}>
      {ticks.map((tick, index) => (
        <Text
          key={`${tick}-${index}`}
          style={{
            color: config?.labelColor ?? ditherPalette.muted,
            fontSize: config?.fontSize ?? 9,
            fontFamily: config?.fontFamily
          }}
        >
          {tick}
        </Text>
      ))}
    </View>
  );
}

export function XAxisLabels({
  labels,
  width,
  config,
  style
}: {
  labels: string[];
  width: number;
  config?: AxisConfig;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ width, flexDirection: "row", justifyContent: "space-between", paddingTop: 8 }, style]}>
      {labels.map((label, index) => (
        <Text
          key={`${label}-${index}`}
          style={{
            color: config?.labelColor ?? ditherPalette.muted,
            fontSize: config?.fontSize ?? 9,
            fontFamily: config?.fontFamily
          }}
        >
          {label}
        </Text>
      ))}
    </View>
  );
}
