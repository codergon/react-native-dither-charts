import React, { useState } from "react";
import { Canvas } from "@shopify/react-native-skia";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { ditherPalette } from "./palette";
import { DitherPattern } from "./DitherPattern";
import type { DitherOptions, DitherRange } from "./types";

export const defaultDitherRanges: DitherRange[] = [
  { key: "1D", label: "1D" },
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "1Y", label: "1Y" },
  { key: "ALL", label: "All" }
];

type DitherRangeFilterProps = {
  ranges?: DitherRange[];
  value: string;
  onChange: (key: string) => void;
  color?: string;
  activeTextColor?: string;
  inactiveTextColor?: string;
  dither?: DitherOptions;
  pillHeight?: number;
  style?: ViewStyle;
};

/** A segmented "1D / 1W / 1M / 3M / 1Y / All" style filter, similar to timeframe pickers in crypto/stock apps. */
export function DitherRangeFilter({
  ranges = defaultDitherRanges,
  value,
  onChange,
  color = ditherPalette.ink,
  activeTextColor = ditherPalette.paper,
  inactiveTextColor = ditherPalette.muted,
  dither,
  pillHeight = 30,
  style
}: DitherRangeFilterProps) {
  const [widths, setWidths] = useState<Record<string, number>>({});

  return (
    <View style={[styles.row, style]}>
      {ranges.map((range) => {
        const active = range.key === value;
        const pillWidth = widths[range.key];

        return (
          <Pressable
            key={range.key}
            onPress={() => onChange(range.key)}
            onLayout={(event) => {
              const measured = event.nativeEvent.layout.width;
              setWidths((current) =>
                current[range.key] === measured ? current : { ...current, [range.key]: measured }
              );
            }}
            style={[styles.pill, { height: pillHeight }]}
            hitSlop={6}
          >
            {active && pillWidth ? (
              <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                <DitherPattern
                  x={0}
                  y={0}
                  width={pillWidth}
                  height={pillHeight}
                  radius={pillHeight / 2}
                  color={color}
                  dither={dither ?? { variant: "solid" }}
                />
              </Canvas>
            ) : null}
            <Text style={[styles.label, { color: active ? activeTextColor : inactiveTextColor }]}>
              {range.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6
  },
  pill: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  label: {
    fontSize: 13,
    fontWeight: "600"
  }
});
