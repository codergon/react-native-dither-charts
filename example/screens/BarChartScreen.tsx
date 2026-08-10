import { useCallback, useMemo, useState } from "react";
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
  DitherStackedBar,
  type ScrubInfo,
  type StackedChartDatum,
} from "react-native-dither-charts";
import { BLUE, BLUE_LIGHT, PURPLE, createTheme, type Theme } from "../theme";
import { fonts } from "../fonts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { goBackOrHome } from "../navigation/goBackOrHome";
import { BackButton } from "../components/BackButton";

type Props = NativeStackScreenProps<RootStackParamList, "BarChart">;

const screenWidth = Dimensions.get("window").width;
const HORIZONTAL_PADDING = 20;
const CHART_WIDTH = screenWidth - HORIZONTAL_PADDING * 2;
const CHART_HEIGHT = 260;

// Same dataset and coloring as the bar section in the chart gallery demo.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const CURRENT_YEAR = [142, 168, 205, 187, 231, 254, 238, 261];
const PRIOR_YEAR = [110, 128, 150, 70, 82, 61, 120, 148];

const THIS_YEAR = { label: "This year", color: BLUE };
const LAST_YEAR = { label: "Last year", color: PURPLE };

const chartData: StackedChartDatum[] = MONTHS.map((label, index) => ({
  label,
  segments: [
    {
      value: CURRENT_YEAR[index],
      color: THIS_YEAR.color,
      dither: {
        variant: "gradient",
        cellSize: 1.55,
        startDensity: 0.3,
        endDensity: 1,
        solidFrom: 0.94,
        gradientColors: [BLUE_LIGHT, BLUE],
      },
    },
    {
      value: PRIOR_YEAR[index],
      color: LAST_YEAR.color,
      dither: {
        variant: "hatched",
        cellSize: 2,
        gap: 8,
        strokeWidth: 4,
        pixelated: true,
        opacity: 0.92,
      },
    },
  ],
}));

const axis = { visible: true, fontSize: 9, size: 20 } as const;
const yAxis = { ...axis, ticks: 4, size: 32 } as const;

export function BarChartScreen({ navigation }: Props) {
  const dark = useColorScheme() === "dark";
  const theme = useMemo(() => createTheme(dark), [dark]);
  const insets = useSafeAreaInsets();
  const [scrubInfo, setScrubInfo] =
    useState<ScrubInfo<StackedChartDatum>>(null);

  const themedAxis = useMemo(
    () => ({ ...axis, labelColor: theme.muted }),
    [theme.muted],
  );
  const themedYAxis = useMemo(
    () => ({ ...yAxis, labelColor: theme.muted }),
    [theme.muted],
  );

  const handleScrub = useCallback(
    (info: ScrubInfo<StackedChartDatum>) => setScrubInfo(info),
    [],
  );

  const activeIndex = scrubInfo?.index ?? MONTHS.length - 1;
  const activeValues = scrubInfo?.values ?? [
    CURRENT_YEAR[activeIndex],
    PRIOR_YEAR[activeIndex],
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar
        hidden={false}
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.month, { color: theme.text }]}>
          {MONTHS[activeIndex]}
        </Text>
        <View style={styles.readoutRow}>
          <ReadoutValue
            color={THIS_YEAR.color}
            label={THIS_YEAR.label}
            value={activeValues[0]}
            theme={theme}
          />
          <ReadoutValue
            color={LAST_YEAR.color}
            label={LAST_YEAR.label}
            value={activeValues[1]}
            theme={theme}
          />
        </View>

        <View style={styles.chartWrap}>
          <DitherStackedBar
            data={chartData}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            maxValue={600}
            spacing={14}
            barRadius={0}
            fillOpacity={1}
            xAxis={themedAxis}
            yAxis={themedYAxis}
            focusOnPress={false}
            scrub={{
              lineColor: theme.faint,
              lineOpacity: 0.4,
              dotRadius: 3,
              haloRadius: 6,
            }}
            onScrub={handleScrub}
          />
        </View>
      </View>
      <BackButton theme={theme} onPress={() => goBackOrHome(navigation)} />
    </View>
  );
}

function ReadoutValue({
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
    <View style={styles.readoutValue}>
      <View style={styles.readoutLabelRow}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <Text style={[styles.readoutLabel, { color: theme.muted }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.readoutNumber, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12 },
  title: { fontFamily: fonts.semibold, fontSize: 24, marginBottom: 4 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, marginBottom: 20 },
  month: { fontFamily: fonts.semibold, fontSize: 32, marginBottom: 10 },
  readoutRow: { flexDirection: "row", gap: 28, marginBottom: 28 },
  readoutValue: { gap: 6 },
  readoutLabelRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  readoutLabel: { fontFamily: fonts.medium, fontSize: 12.5 },
  readoutNumber: { fontFamily: fonts.semibold, fontSize: 20 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  chartWrap: { alignItems: "center" },
});
