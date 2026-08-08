import { useMemo } from "react";
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  DitherStackedAreaChart,
  type StackedChartDatum,
  type TooltipRenderInfo,
} from "react-native-dither-charts";
import { createTheme, type Theme } from "../theme";
import { fonts } from "../fonts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { goBackOrHome } from "../navigation/goBackOrHome";
import { BackButton } from "../components/BackButton";

type Props = NativeStackScreenProps<RootStackParamList, "AreaChart">;

const screenWidth = Dimensions.get("window").width;
const HORIZONTAL_PADDING = 20;
const CHART_WIDTH = screenWidth - HORIZONTAL_PADDING * 2;
const CHART_HEIGHT = 260;

const DRAKE = { label: "Drake", color: "#3B82F6" };
const KENDRICK = { label: "Kendrick", color: "#F97316" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const DRAKE_STREAMS = [45, 42, 38, 35, 30, 34, 38, 41, 43, 45];
const KENDRICK_STREAMS = [22, 24, 28, 65, 98, 72, 58, 50, 47, 45];

const chartData: StackedChartDatum[] = MONTHS.map((label, index) => ({
  label,
  segments: [
    {
      value: DRAKE_STREAMS[index],
      color: DRAKE.color,
      dither: {
        variant: "gradient",
        cellSize: 1.5,
        startDensity: 0.25,
        endDensity: 1,
        solidFrom: 0.95,
      },
    },
    {
      value: KENDRICK_STREAMS[index],
      color: KENDRICK.color,
      dither: {
        variant: "hatched",
        gap: 4.2,
        strokeWidth: 1,
        opacity: 0.9,
      },
    },
  ],
}));

const axis = { visible: true, fontSize: 9, size: 20 } as const;
const yAxis = { ...axis, ticks: 4, size: 32 } as const;

export function AreaChartScreen({ navigation }: Props) {
  const dark = useColorScheme() === "dark";
  const theme = useMemo(() => createTheme(dark), [dark]);
  const insets = useSafeAreaInsets();

  const themedAxis = useMemo(() => ({ ...axis, labelColor: theme.muted }), [theme.muted]);
  const themedYAxis = useMemo(() => ({ ...yAxis, labelColor: theme.muted }), [theme.muted]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar
        hidden={false}
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <ScrollView
        style={{ paddingTop: insets.top + 16 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Drake vs Kendrick</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Monthly streams, millions
        </Text>

        <View style={styles.legend}>
          <LegendItem color={DRAKE.color} label={DRAKE.label} theme={theme} />
          <LegendItem color={KENDRICK.color} label={KENDRICK.label} theme={theme} />
        </View>

        <View style={styles.chartWrap}>
          <DitherStackedAreaChart
            data={chartData}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            maxValue={170}
            fillOpacity={1}
            strokeWidth={0.85}
            xAxis={themedAxis}
            yAxis={themedYAxis}
            // A stacked area's default tap-to-focus behavior fires on finger-down,
            // before a drag can even begin — which meant starting a scrub always
            // flashed one series into focus first. Turning it off makes this a pure
            // continuous scrub, like the line chart, and makes dismiss reliable
            // (based on the touched column, not a fuzzy vertical hit-test).
            focusOnPress={false}
            scrub={{ lineColor: theme.faint, lineOpacity: 0.4, dotRadius: 3, haloRadius: 6 }}
            tooltip={{ render: (info) => renderTooltip(info, theme) }}
          />
        </View>

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
      <BackButton theme={theme} onPress={() => goBackOrHome(navigation)} />
    </View>
  );
}

function LegendItem({ color, label, theme }: { color: string; label: string; theme: Theme }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function renderTooltip(info: TooltipRenderInfo<StackedChartDatum>, theme: Theme) {
  const tooltipWidth = 128;
  const left = Math.max(0, Math.min(info.x - tooltipWidth / 2, info.width - tooltipWidth));
  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        { left, width: tooltipWidth, backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.tooltipLabel, { color: theme.muted }]}>{info.datum.label}</Text>
      <TooltipRow color={DRAKE.color} label={DRAKE.label} value={info.values?.[0] ?? 0} theme={theme} />
      <TooltipRow color={KENDRICK.color} label={KENDRICK.label} value={info.values?.[1] ?? 0} theme={theme} />
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
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.tooltipName, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.tooltipValue, { color: theme.text }]}>{value}M</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12 },
  title: { fontFamily: fonts.semibold, fontSize: 24, marginBottom: 4 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, marginBottom: 20 },
  legend: { flexDirection: "row", gap: 16, marginBottom: 28 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendLabel: { fontFamily: fonts.medium, fontSize: 12.5 },
  chartWrap: { alignItems: "center" },
  tooltip: {
    position: "absolute",
    top: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tooltipLabel: { fontFamily: fonts.medium, fontSize: 10.5, marginBottom: 5 },
  tooltipRow: { alignItems: "center", flexDirection: "row", minHeight: 16 },
  tooltipName: { flex: 1, fontFamily: fonts.regular, fontSize: 11.5, marginLeft: 5 },
  tooltipValue: { fontFamily: fonts.semibold, fontSize: 12 },
});
