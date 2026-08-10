import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { goBackOrHome } from "../navigation/goBackOrHome";
import { BackButton } from "../components/BackButton";
import {
  DitherDonutChart,
  DitherMultiLineChart,
  DitherRadarChart,
  DitherStackedAreaChart,
  DitherStackedBar,
  type AxisConfig,
  type ChartDatum,
  type ScrubInfo,
  type StackedChartDatum,
  type TooltipRenderInfo,
} from "react-native-dither-charts";
import { BLUE, GRAY, GREEN, ORANGE, PURPLE, RED, createTheme, type Theme } from "../theme";

const HORIZONTAL_PADDING = 20;

const screenWidth = Dimensions.get("window").width;
const chartWidth = Math.min(screenWidth - 2 * HORIZONTAL_PADDING, 680);
const chartHeight = 246;

const BLUE_LIGHT = "#72D8FF";
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const currentYear = [142, 168, 205, 187, 231, 254, 238, 261];
const priorYear = [110, 128, 150, 70, 82, 61, 120, 148];

const areaData = months.map((label, index) => ({
  label,
  segments: [
    {
      value: currentYear[index],
      color: BLUE,
      dither: {
        variant: "gradient" as const,
        cellSize: 1.55,
        startDensity: 0.3,
        endDensity: 1,
        solidFrom: 0.94,
        gradientColors: [BLUE_LIGHT, BLUE] as [string, string],
      },
    },
    {
      value: priorYear[index],
      color: PURPLE,
      dither: {
        variant: "hatched" as const,
        cellSize: 2,
        gap: 8,
        strokeWidth: 4,
        pixelated: true,
        opacity: 0.92,
      },
    },
  ],
}));

const barData = months.map((label, index) => ({
  label,
  segments: [
    {
      value: currentYear[index],
      color: BLUE,
      dither: {
        variant: "gradient" as const,
        cellSize: 1.55,
        startDensity: 0.3,
        endDensity: 1,
        solidFrom: 0.94,
        gradientColors: [BLUE_LIGHT, BLUE] as [string, string],
      },
    },
    {
      value: priorYear[index],
      color: PURPLE,
      dither: {
        variant: "hatched" as const,
        cellSize: 2,
        gap: 8,
        strokeWidth: 4,
        pixelated: true,
        opacity: 0.92,
      },
    },
  ],
}));

const axis = {
  visible: true,
  fontSize: 8.75,
  labelColor: "#73727E",
  size: 20,
} as const;
const yAxis = { ...axis, ticks: 4, size: 30 } as const;
const scrub = {
  lineColor: "#777681",
  lineOpacity: 0.3,
  dotRadius: 3,
  haloRadius: 6,
} as const;

const lineSeries = [
  {
    label: "This year",
    values: currentYear,
    color: BLUE,
  },
  {
    label: "Last year",
    values: priorYear,
    color: PURPLE,
  },
];

const pieData = [
  { label: "Online", value: 34, color: BLUE },
  { label: "Retail", value: 27, color: GREEN },
  { label: "Wholesale", value: 18, color: ORANGE },
  { label: "Marketplace", value: 14, color: PURPLE },
  { label: "Partners", value: 7, color: GRAY },
];

const radarCategories = [
  "Design",
  "Performance",
  "Value",
  "Support",
  "Reliability",
  "Ease of use",
  "Durability",
];

const radarSeries = [
  {
    label: "This year",
    values: [82, 94, 58, 76, 92, 64, 65],
    color: BLUE,
    dither: {
      variant: "gradient" as const,
      cellSize: 1.5,
      startDensity: 0.3,
      endDensity: 1,
      solidFrom: 0.97,
    },
  },
  {
    label: "Last year",
    values: [54, 60, 71, 52, 87, 48, 98],
    color: RED,
    dither: {
      variant: "hatched" as const,
      cellSize: 2,
      gap: 8,
      strokeWidth: 4,
      pixelated: true,
      opacity: 0.8,
    },
  },
];

const comparisonLegend = [
  { color: BLUE, label: "This year" },
  { color: PURPLE, label: "Last year" },
];

// Radar readout defaults to the first category instead of a placeholder, and stays
// on whatever was last touched rather than resetting to nothing when you tap away.
const defaultRadarScrub: ScrubInfo<{ label: string; values: number[] }> = {
  index: 0,
  datum: {
    label: radarCategories[0],
    values: radarSeries.map((entry) => entry.values[0]),
  },
  value: radarSeries[0]?.values[0] ?? 0,
  values: radarSeries.map((entry) => entry.values[0]),
  x: 0,
};

const chartSections = [
  "area",
  "bar",
  "line",
  "pie-readout",
  "pie-tooltip",
  "radar-readout",
  "radar-tooltip",
] as const;

type ChartSectionKey = (typeof chartSections)[number];

type Props = NativeStackScreenProps<RootStackParamList, "Gallery">;

export function ChartGalleryScreen({ navigation }: Props) {
  const dark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const [chartsMounted, setChartsMounted] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const theme = useMemo(() => createTheme(dark), [dark]);
  const themedAxis = useMemo(
    () => ({ ...axis, labelColor: theme.muted }),
    [theme.muted],
  );
  const themedYAxis = useMemo(
    () => ({ ...yAxis, labelColor: theme.muted }),
    [theme.muted],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => setChartsMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const markChartsReady = useCallback(() => setChartsReady(true), []);

  // Every interactive section registers a reset for its own focus/tooltip state here,
  // so a tap that lands outside all of them (blank space, a header, another section)
  // can clear whatever's currently open instead of it being stuck until re-tapped.
  const dismissHandlers = useRef(new Set<() => void>()).current;
  const registerDismiss = useCallback(
    (handler: () => void) => {
      dismissHandlers.add(handler);
      return () => dismissHandlers.delete(handler);
    },
    [dismissHandlers],
  );
  const dismissAll = useCallback(() => {
    dismissHandlers.forEach((handler) => handler());
  }, [dismissHandlers]);

  const renderChartSection = useCallback(
    ({ item }: { item: ChartSectionKey }) => {
      switch (item) {
        case "area":
          return (
            <AreaSection
              theme={theme}
              themedAxis={themedAxis}
              themedYAxis={themedYAxis}
              onLayout={markChartsReady}
              registerDismiss={registerDismiss}
            />
          );
        case "bar":
          return (
            <BarSection
              theme={theme}
              themedAxis={themedAxis}
              themedYAxis={themedYAxis}
              registerDismiss={registerDismiss}
            />
          );
        case "line":
          return (
            <ChartSection
              title="line"
              legend={comparisonLegend}
              theme={theme}
              tooltipAbove
            >
              <DitherMultiLineChart
                labels={months}
                series={lineSeries}
                width={chartWidth}
                height={chartHeight}
                maxValue={280}
                bandWidth={16}
                curve="smooth"
                strokeWidth={0.45}
                xAxis={{ ...themedAxis, visible: true }}
                yAxis={{ ...themedYAxis, ticks: 5, visible: false }}
                scrub={scrub}
                tooltip={{
                  position: "top",
                  render: (info) => renderComparisonTooltip(info, theme),
                }}
              />
            </ChartSection>
          );
        case "pie-readout":
          return (
            <PieReadoutSection
              theme={theme}
              registerDismiss={registerDismiss}
            />
          );
        case "pie-tooltip":
          return (
            <PieTooltipSection
              theme={theme}
              registerDismiss={registerDismiss}
            />
          );
        case "radar-readout":
          return <RadarReadoutSection theme={theme} />;
        case "radar-tooltip":
          return <RadarTooltipSection theme={theme} />;
      }
    },
    [markChartsReady, registerDismiss, theme, themedAxis, themedYAxis],
  );

  return (
    <Pressable
      style={[styles.app, { backgroundColor: theme.background }]}
      onPress={dismissAll}
    >
      <StatusBar
        hidden={false}
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <FlatList
        style={{ backgroundColor: theme.background, paddingTop: insets.top + 16 }}
        data={chartsMounted ? chartSections : []}
        renderItem={renderChartSection}
        keyExtractor={(item) => item}
        ListHeaderComponent={
          <Text style={[styles.screenTitle, { color: theme.text }]}>Chart gallery</Text>
        }
        contentContainerStyle={styles.content}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        updateCellsBatchingPeriod={32}
        windowSize={2}
        removeClippedSubviews
      />
      {!chartsReady ? (
        <View
          pointerEvents="none"
          style={[
            styles.loadingStatus,
            { backgroundColor: theme.tooltip, borderColor: theme.border },
          ]}
        >
          <View style={[styles.loadingDot, { backgroundColor: BLUE }]} />
          <Text style={[styles.loadingText, { color: theme.muted }]}>
            Preparing charts
          </Text>
        </View>
      ) : null}
      <BackButton theme={theme} onPress={() => goBackOrHome(navigation)} />
    </Pressable>
  );
}

type DismissAware = { registerDismiss: (handler: () => void) => () => void };

const AreaSection = React.memo(function AreaSection({
  theme,
  themedAxis,
  themedYAxis,
  onLayout,
  registerDismiss,
}: DismissAware & {
  theme: Theme;
  themedAxis: AxisConfig;
  themedYAxis: AxisConfig;
  onLayout?: () => void;
}) {
  const [focusedSeries, setFocusedSeries] = useState<number | null>(null);
  useEffect(
    () => registerDismiss(() => setFocusedSeries(null)),
    [registerDismiss],
  );

  return (
    <ChartSection
      title="area"
      legend={comparisonLegend}
      theme={theme}
      onLayout={onLayout}
    >
      <DitherStackedAreaChart
        data={areaData}
        width={chartWidth}
        height={chartHeight}
        maxValue={600}
        fillOpacity={1}
        strokeWidth={0.85}
        xAxis={themedAxis}
        yAxis={themedYAxis}
        scrub={scrub}
        focusedSeries={focusedSeries}
        onSeriesFocus={setFocusedSeries}
        tooltip={{ render: (info) => renderStackedTooltip(info, theme) }}
      />
    </ChartSection>
  );
});

const BarSection = React.memo(function BarSection({
  theme,
  themedAxis,
  themedYAxis,
  registerDismiss,
}: DismissAware & {
  theme: Theme;
  themedAxis: AxisConfig;
  themedYAxis: AxisConfig;
}) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  useEffect(
    () => registerDismiss(() => setFocusedIndex(null)),
    [registerDismiss],
  );

  return (
    <ChartSection title="bar" legend={comparisonLegend} theme={theme}>
      <DitherStackedBar
        data={barData}
        width={chartWidth}
        height={chartHeight}
        maxValue={600}
        spacing={14}
        barRadius={0}
        fillOpacity={1}
        xAxis={themedAxis}
        yAxis={themedYAxis}
        scrub={scrub}
        focusedIndex={focusedIndex}
        onItemFocus={setFocusedIndex}
        tooltip={{ render: (info) => renderStackedTooltip(info, theme) }}
      />
    </ChartSection>
  );
});

const PieTooltipSection = React.memo(function PieTooltipSection({
  theme,
  registerDismiss,
}: DismissAware & { theme: Theme }) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  useEffect(
    () => registerDismiss(() => setFocusedIndex(null)),
    [registerDismiss],
  );

  return (
    <ChartSection
      title="pie · tooltip"
      legend={pieData.map((entry) => ({
        color: entry.color,
        label: entry.label,
      }))}
      stackedLegend
      theme={theme}
    >
      <View style={styles.centeredChart}>
        <DitherDonutChart
          data={pieData}
          width={chartWidth}
          height={chartWidth}
          focusedIndex={focusedIndex}
          onSliceFocus={setFocusedIndex}
          tooltip={{
            position: "point",
            backgroundColor: theme.tooltip,
            borderColor: theme.border,
            textColor: theme.text,
          }}
        />
      </View>
    </ChartSection>
  );
});

const RadarTooltipSection = React.memo(function RadarTooltipSection({
  theme,
}: {
  theme: Theme;
}) {
  // Unlike the other sections, radar intentionally never resets on an outside tap —
  // whatever axis you last touched stays highlighted instead of disappearing.
  const [focusedSeries, setFocusedSeries] = useState<number | null>(null);

  return (
    <ChartSection
      title="radar · tooltip"
      legend={comparisonLegend}
      theme={theme}
    >
      <DitherRadarChart
        categories={radarCategories}
        series={radarSeries}
        width={chartWidth}
        height={chartWidth}
        maxValue={100}
        gridColor={theme.grid}
        labelColor={theme.muted}
        fontFamily="Menlo"
        fontSize={8.5}
        scrub={scrub}
        focusedSeries={focusedSeries}
        onSeriesFocus={setFocusedSeries}
        tooltip={{ render: (info) => renderRadarTooltip(info, theme) }}
      />
    </ChartSection>
  );
});

const PieReadoutSection = React.memo(function PieReadoutSection({
  theme,
  registerDismiss,
}: DismissAware & { theme: Theme }) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [active, setActive] = useState<ScrubInfo<ChartDatum>>(null);
  const handleScrub = useCallback(
    (info: ScrubInfo<ChartDatum>) => setActive(info),
    [],
  );
  useEffect(
    () =>
      registerDismiss(() => {
        setFocusedIndex(null);
        setActive(null);
      }),
    [registerDismiss],
  );

  return (
    <ChartSection
      title="pie"
      legend={pieData.map((entry) => ({
        color: entry.color,
        label: entry.label,
      }))}
      stackedLegend
      theme={theme}
      activeLabel={active?.datum.label ?? "Touch a slice"}
      activePrimary={active ? String(active.value) : "—"}
      activeColor={active?.datum.color ?? BLUE}
    >
      <View style={styles.centeredChart}>
        <DitherDonutChart
          data={pieData}
          width={chartWidth}
          height={chartWidth}
          focusedIndex={focusedIndex}
          onSliceFocus={setFocusedIndex}
          onScrub={handleScrub}
        />
      </View>
    </ChartSection>
  );
});

const RadarReadoutSection = React.memo(function RadarReadoutSection({
  theme,
}: {
  theme: Theme;
}) {
  // Unlike the other sections, radar intentionally never resets on an outside tap —
  // it starts on the first category and stays on whatever was last touched.
  const [focusedSeries, setFocusedSeries] = useState<number | null>(null);
  const [active, setActive] =
    useState<ScrubInfo<{ label: string; values: number[] }>>(defaultRadarScrub);
  const handleScrub = useCallback(
    (info: ScrubInfo<{ label: string; values: number[] }>) =>
      setActive((current) => info ?? current),
    [],
  );

  return (
    <ChartSection
      title="radar"
      legend={comparisonLegend}
      theme={theme}
      activeLabel={active?.datum.label ?? "Touch an axis"}
      activePrimary={active ? `This year  ${active.values?.[0] ?? 0}` : "—"}
      activeSecondary={
        active ? `Last year  ${active.values?.[1] ?? 0}` : undefined
      }
    >
      <DitherRadarChart
        categories={radarCategories}
        series={radarSeries}
        width={chartWidth}
        height={chartWidth}
        maxValue={100}
        gridColor={theme.grid}
        labelColor={theme.muted}
        fontFamily="Menlo"
        fontSize={8.5}
        scrub={scrub}
        focusedSeries={focusedSeries}
        onSeriesFocus={setFocusedSeries}
        onScrub={handleScrub}
      />
    </ChartSection>
  );
});

function renderStackedTooltip(
  info: TooltipRenderInfo<StackedChartDatum>,
  theme: Theme,
) {
  const tooltipWidth = 116;
  const left = Math.max(
    0,
    Math.min(info.x - tooltipWidth / 2, info.width - tooltipWidth),
  );
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        {
          left,
          width: tooltipWidth,
          backgroundColor: theme.tooltip,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.tooltipLabel, { color: theme.muted }]}>
        {info.datum.label}
      </Text>
      <TooltipRow
        color={BLUE}
        label="This year"
        value={info.values?.[0] ?? 0}
        theme={theme}
      />
      <TooltipRow
        color={PURPLE}
        label="Last year"
        value={info.values?.[1] ?? 0}
        theme={theme}
      />
    </View>
  );
}

function renderComparisonTooltip(
  info: TooltipRenderInfo<{ label: string; values: number[] }>,
  theme: Theme,
) {
  return renderSeriesTooltip(
    info.x,
    info.width,
    info.datum.label,
    info.values ?? [],
    theme,
  );
}

function renderRadarTooltip(
  info: TooltipRenderInfo<{ label: string; values: number[] }>,
  theme: Theme,
) {
  const tooltipWidth = 116;
  const left = Math.max(
    0,
    Math.min(info.x - tooltipWidth / 2, info.width - tooltipWidth),
  );
  const top = Math.max(
    4,
    Math.min((info.y ?? 0) - 48, (info.height ?? 58) - 58),
  );
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        {
          left,
          top,
          width: tooltipWidth,
          backgroundColor: theme.tooltip,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.tooltipLabel, { color: theme.muted }]}>
        {info.datum.label}
      </Text>
      <TooltipRow
        color={BLUE}
        label="This year"
        value={info.values?.[0] ?? 0}
        theme={theme}
      />
      <TooltipRow
        color={PURPLE}
        label="Last year"
        value={info.values?.[1] ?? 0}
        theme={theme}
      />
    </View>
  );
}

function renderSeriesTooltip(
  x: number,
  width: number,
  label: string,
  values: number[],
  theme: Theme,
) {
  const tooltipWidth = 116;
  const left = Math.max(
    0,
    Math.min(x - tooltipWidth / 2, width - tooltipWidth),
  );
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        styles.tooltipAbove,
        {
          left,
          width: tooltipWidth,
          backgroundColor: theme.tooltip,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.tooltipLabel, { color: theme.muted }]}>{label}</Text>
      <TooltipRow
        color={BLUE}
        label="This year"
        value={values[0] ?? 0}
        theme={theme}
      />
      <TooltipRow
        color={PURPLE}
        label="Last year"
        value={values[1] ?? 0}
        theme={theme}
      />
    </View>
  );
}

function TooltipRow({
  color,
  label,
  value,
  theme,
}: {
  color: string;
  label: string;
  value: number;
  theme: Theme;
}) {
  return (
    <View style={styles.tooltipRow}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[styles.tooltipName, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.tooltipValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function ChartSection({
  title,
  legend,
  stackedLegend = false,
  activeLabel,
  activePrimary,
  activeSecondary,
  activeColor = BLUE,
  tooltipAbove = false,
  onLayout,
  theme,
  children,
}: {
  title: string;
  legend: Array<{ color: string; label: string }>;
  stackedLegend?: boolean;
  activeLabel?: string;
  activePrimary?: string;
  activeSecondary?: string;
  activeColor?: string;
  tooltipAbove?: boolean;
  onLayout?: () => void;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <View
      onLayout={onLayout}
      style={[styles.section, tooltipAbove && styles.sectionWithTopTooltip]}
    >
      <View
        style={[styles.sectionHeader, stackedLegend && styles.stackedHeader]}
      >
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {title}
          </Text>
        </View>
        <View style={[styles.legend, stackedLegend && styles.wideLegend]}>
          {legend.map((entry) => (
            <Legend key={entry.label} {...entry} theme={theme} />
          ))}
        </View>
      </View>
      {activeLabel ? (
        <View style={styles.readout}>
          <View style={styles.readoutLabelRow}>
            <View
              style={[styles.readoutDot, { backgroundColor: activeColor }]}
            />
            <Text style={[styles.readoutLabel, { color: theme.muted }]}>
              {activeLabel}
            </Text>
          </View>
          <View style={styles.readoutValues}>
            <Text style={[styles.readoutPrimary, { color: theme.text }]}>
              {activePrimary}
            </Text>
            {activeSecondary ? (
              <Text style={[styles.readoutSecondary, { color: theme.muted }]}>
                {activeSecondary}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

function Legend({
  color,
  label,
  theme,
}: {
  color: string;
  label: string;
  theme: Theme;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  screenTitle: {
    fontFamily: "Menlo",
    fontSize: 20,
    marginBottom: 24,
    marginTop: 4,
  },
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 84,
  },
  loadingStatus: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    position: "absolute",
    top: 54,
  },
  loadingDot: { borderRadius: 3, height: 6, width: 6 },
  loadingText: { fontFamily: "Menlo", fontSize: 9 },
  section: { gap: 19 },
  sectionWithTopTooltip: { gap: 58 },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: 2,
  },
  stackedHeader: { alignItems: "flex-start", flexDirection: "column", gap: 15 },
  sectionTitle: { color: "#111114", fontFamily: "Menlo", fontSize: 12.5 },
  sectionHeading: { flexShrink: 1, gap: 4 },
  readout: { gap: 6, paddingLeft: 2 },
  readoutLabelRow: { alignItems: "center", flexDirection: "row", gap: 7 },
  readoutDot: { borderRadius: 6, height: 10, width: 10 },
  readoutLabel: { fontFamily: "Menlo", fontSize: 10 },
  readoutValues: { alignItems: "baseline", flexDirection: "row", gap: 12 },
  readoutPrimary: { fontFamily: "Menlo", fontSize: 24, fontWeight: "600" },
  readoutSecondary: { fontFamily: "Menlo", fontSize: 10 },
  legend: { flexDirection: "row", gap: 14 },
  wideLegend: { width: "100%", justifyContent: "space-between", gap: 5 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  legendSwatch: { borderRadius: 1, height: 8, width: 8 },
  legendText: { color: "#74737E", fontFamily: "Menlo", fontSize: 9 },
  centeredChart: { alignItems: "center" },
  tooltip: {
    position: "absolute",
    top: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#E1E2E6",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
    paddingVertical: 7,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  tooltipAbove: { top: -52 },
  tooltipLabel: {
    color: "#73727E",
    fontFamily: "Menlo",
    fontSize: 8.5,
    marginBottom: 5,
  },
  tooltipRow: { alignItems: "center", flexDirection: "row", minHeight: 16 },
  tooltipName: {
    color: "#73727E",
    flex: 1,
    fontFamily: "Menlo",
    fontSize: 8.5,
    marginLeft: 5,
  },
  tooltipValue: { color: "#111114", fontFamily: "Menlo", fontSize: 9.5 },
});
