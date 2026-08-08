import { useMemo } from "react";
import {
  Dimensions,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  DitherMultiLineChart,
  type TooltipRenderInfo,
} from "react-native-dither-charts";
import { createTheme, type Theme } from "../theme";
import { fonts } from "../fonts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { goBackOrHome } from "../navigation/goBackOrHome";
import { BackButton } from "../components/BackButton";

type Props = NativeStackScreenProps<RootStackParamList, "MultiLineChart">;

const screenWidth = Dimensions.get("window").width;
const HORIZONTAL_PADDING = 20;
const CHART_HEIGHT = 260;

// Same dataset as the multi-line section in the chart gallery demo, relabeled.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const CHATGPT_VALUES = [142, 168, 205, 187, 231, 254, 238, 261];
const CLAUDE_VALUES = [110, 128, 150, 70, 82, 61, 120, 148];

const CHATGPT = { label: "ChatGPT", color: "#74AA9C" };
const CLAUDE = { label: "Claude", color: "#D97757" };

const lineSeries = [
  { label: CHATGPT.label, values: CHATGPT_VALUES, color: CHATGPT.color },
  { label: CLAUDE.label, values: CLAUDE_VALUES, color: CLAUDE.color },
];

const axis = { visible: true, fontSize: 9, size: 20 } as const;
const yAxis = { ...axis, ticks: 5, size: 32, visible: false } as const;

export function MultiLineChartScreen({ navigation }: Props) {
  const dark = useColorScheme() === "dark";
  const theme = useMemo(() => createTheme(dark), [dark]);
  const insets = useSafeAreaInsets();

  const themedAxis = useMemo(
    () => ({ ...axis, labelColor: theme.muted, labelInset: HORIZONTAL_PADDING }),
    [theme.muted],
  );
  const themedYAxis = useMemo(() => ({ ...yAxis, labelColor: theme.muted }), [theme.muted]);

  const renderTooltip = useMemo(
    () => (info: TooltipRenderInfo<{ label: string; values: number[] }>) =>
      renderPinnedTooltip(info, theme),
    [theme],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar
        hidden={false}
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: theme.text }]}>ChatGPT vs Claude</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Monthly active users, millions
        </Text>

        <View style={styles.legend}>
          <LegendItem color={CHATGPT.color} label={CHATGPT.label} theme={theme} />
          <LegendItem color={CLAUDE.color} label={CLAUDE.label} theme={theme} />
        </View>

        <View style={styles.chartBleed}>
          <DitherMultiLineChart
            labels={MONTHS}
            series={lineSeries}
            width={screenWidth}
            height={CHART_HEIGHT}
            maxValue={350}
            bandWidth={16}
            curve="smooth"
            strokeWidth={0.45}
            xAxis={themedAxis}
            yAxis={themedYAxis}
            scrub={{ lineColor: theme.faint, lineOpacity: 0.4, dotRadius: 3, haloRadius: 6 }}
            tooltip={{ render: renderTooltip }}
          />
        </View>
      </View>
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

function renderPinnedTooltip(
  info: TooltipRenderInfo<{ label: string; values: number[] }>,
  theme: Theme,
) {
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
      <TooltipRow color={CHATGPT.color} label={CHATGPT.label} value={info.values?.[0] ?? 0} theme={theme} />
      <TooltipRow color={CLAUDE.color} label={CLAUDE.label} value={info.values?.[1] ?? 0} theme={theme} />
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
  content: { flex: 1, paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12 },
  title: { fontFamily: fonts.semibold, fontSize: 24, marginBottom: 4 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, marginBottom: 20 },
  legend: { flexDirection: "row", gap: 16, marginBottom: 28 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendLabel: { fontFamily: fonts.medium, fontSize: 12.5 },
  chartWrap: { alignItems: "center" },
  chartBleed: { marginHorizontal: -HORIZONTAL_PADDING },
  tooltip: {
    position: "absolute",
    top: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tooltipLabel: { fontFamily: fonts.medium, fontSize: 10.5, marginBottom: 5 },
  tooltipRow: { alignItems: "center", flexDirection: "row", minHeight: 16 },
  tooltipName: { flex: 1, fontFamily: fonts.regular, fontSize: 11.5, marginLeft: 5 },
  tooltipValue: { fontFamily: fonts.semibold, fontSize: 12 },
});
