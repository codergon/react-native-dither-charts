import React from "react";
import { DitherLineChart } from "./DitherLineChart";
import type { LineChartProps } from "./types";

export function DitherAreaChart(props: LineChartProps) {
  return <DitherLineChart {...props} showArea />;
}
