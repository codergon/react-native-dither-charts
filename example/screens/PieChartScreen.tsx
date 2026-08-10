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
import { DitherDonutChart } from "react-native-dither-charts";
import { createTheme, type Theme } from "../theme";
import { fonts } from "../fonts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { goBackOrHome } from "../navigation/goBackOrHome";
import { BackButton } from "../components/BackButton";

type Props = NativeStackScreenProps<RootStackParamList, "PieChart">;

const screenWidth = Dimensions.get("window").width;
const HORIZONTAL_PADDING = 20;
const CHART_SIZE = screenWidth - HORIZONTAL_PADDING * 2;

const STREAMING_SHARE = [
  { label: "Netflix", value: 32, color: "#E50914" },
  { label: "Prime Video", value: 22, color: "#00A8E1" },
  { label: "Disney+", value: 18, color: "#113CCF" },
  { label: "Max", value: 12, color: "#7B2FF7" },
  { label: "Other", value: 16, color: "#8E8E93" },
];

export function PieChartScreen({ navigation }: Props) {
  const dark = useColorScheme() === "dark";
  const theme = useMemo(() => createTheme(dark), [dark]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar
        hidden={false}
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: theme.text }]}>Streaming Wars</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Global subscriber market share
        </Text>

        <View style={styles.legend}>
          {STREAMING_SHARE.map((entry) => (
            <LegendItem
              key={entry.label}
              color={entry.color}
              label={entry.label}
              value={entry.value}
              theme={theme}
            />
          ))}
        </View>

        <View style={styles.chartWrap}>
          <DitherDonutChart
            data={STREAMING_SHARE}
            width={CHART_SIZE}
            height={CHART_SIZE}
            tooltip={{
              position: "point",
              backgroundColor: theme.surface,
              borderColor: theme.border,
              textColor: theme.text,
            }}
          />
        </View>
      </View>
      <BackButton theme={theme} onPress={() => goBackOrHome(navigation)} />
    </View>
  );
}

function LegendItem({
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
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, { color: theme.muted }]}>
        {label} <Text style={{ color: theme.text }}>{value}%</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 12 },
  title: { fontFamily: fonts.semibold, fontSize: 24, marginBottom: 4 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, marginBottom: 20 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 24 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendLabel: { fontFamily: fonts.medium, fontSize: 12.5 },
  chartWrap: { alignItems: "center" },
});
