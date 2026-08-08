import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Pressable,
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
  DitherRadarChart,
  type TooltipRenderInfo,
} from "react-native-dither-charts";
import { createTheme, type Theme } from "../theme";
import { fonts } from "../fonts";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { goBackOrHome } from "../navigation/goBackOrHome";
import { BackButton } from "../components/BackButton";

type Props = NativeStackScreenProps<RootStackParamList, "PlayerCompare">;

const PLAYER_A = {
  photo: require("../assets/images/lamine.jpg"),
  name: "Lamine Yamal",
  team: "FC Barcelona",
  color: "#0068C9",
};
const PLAYER_B = {
  photo: require("../assets/images/saka.png"),
  name: "Bukayo Saka",
  team: "Arsenal",
  color: "#EF0107",
};

// Same shape/values as the radar chart in the chart gallery demo, relabeled for a
// player comparison so the two graphs read as visually consistent.
const CATEGORIES = ["Pace", "Shooting", "Passing", "Dribbling", "Defending", "Physical", "Vision"];
const VALUES_A = [82, 94, 58, 76, 92, 64, 65];
const VALUES_B = [54, 60, 71, 52, 87, 48, 98];

type CategoryDatum = { label: string; values: number[] };

export function PlayerCompareScreen({ navigation }: Props) {
  const dark = useColorScheme() === "dark";
  const theme = useMemo(() => createTheme(dark), [dark]);
  const insets = useSafeAreaInsets();
  const chartSize = useMemo(() => 320, []);
  const [focusedSeries, setFocusedSeries] = useState<number | null>(null);

  const toggleFocus = useCallback((index: number) => {
    setFocusedSeries((current) => (current === index ? null : index));
  }, []);

  const renderTooltip = useMemo(
    () => (info: TooltipRenderInfo<CategoryDatum>) =>
      renderCompareTooltip(info, theme, focusedSeries),
    [theme, focusedSeries],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StatusBar
        hidden={false}
        barStyle={dark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />
      <ScrollView
        style={{ paddingTop: insets.top + 16 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.vsHeader}>
          <PlayerColumn
            player={PLAYER_A}
            theme={theme}
            active={focusedSeries === 0}
            dimmed={focusedSeries != null && focusedSeries !== 0}
            onPress={() => toggleFocus(0)}
          />
          <Text style={[styles.vsText, { color: theme.muted }]}>VS</Text>
          <PlayerColumn
            player={PLAYER_B}
            theme={theme}
            active={focusedSeries === 1}
            dimmed={focusedSeries != null && focusedSeries !== 1}
            onPress={() => toggleFocus(1)}
          />
        </View>

        <View style={styles.centeredChart}>
          <DitherRadarChart
            categories={CATEGORIES}
            series={[
              {
                label: PLAYER_A.name,
                values: VALUES_A,
                color: PLAYER_A.color,
                dither: {
                  variant: "gradient",
                  cellSize: 1.4,
                  startDensity: 0.25,
                  endDensity: 1,
                  solidFrom: 0.95,
                },
              },
              {
                label: PLAYER_B.name,
                values: VALUES_B,
                color: PLAYER_B.color,
                dither: {
                  variant: "hatched",
                  gap: 4.4,
                  strokeWidth: 0.9,
                  opacity: 0.85,
                },
              },
            ]}
            width={chartSize}
            height={chartSize}
            maxValue={100}
            gridColor={theme.divider}
            labelColor={theme.muted}
            fontFamily={fonts.medium}
            fontSize={10.5}
            // Focus is driven only by tapping a player's photo, not by tapping the
            // chart itself — focusOnPress disables the chart's own tap-to-toggle
            // while focusedSeries/onSeriesFocus stay fully controlled from outside.
            focusOnPress={false}
            focusedSeries={focusedSeries}
            onSeriesFocus={setFocusedSeries}
            dimOpacity={0}
            scrub={{
              lineColor: theme.faint,
              lineOpacity: 0.6,
              dotRadius: 4,
              haloRadius: 8,
            }}
            tooltip={{ render: renderTooltip }}
          />
        </View>

        <View style={{ height: insets.bottom + 32 }} />
      </ScrollView>
      <BackButton theme={theme} onPress={() => goBackOrHome(navigation)} />
    </View>
  );
}

function PlayerColumn({
  player,
  theme,
  active,
  dimmed,
  onPress,
}: {
  player: { photo: number; name: string; team: string; color: string };
  theme: Theme;
  active: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.playerColumn, { opacity: dimmed ? 0.5 : 1 }]}>
      <Pressable onPress={onPress}>
        <Image
          source={player.photo}
          style={[styles.avatar, { borderColor: active ? player.color : theme.faint }]}
        />
      </Pressable>
      <Text style={[styles.playerName, { color: theme.text }]} numberOfLines={1}>
        {player.name}
      </Text>
      <Text style={[styles.playerTeam, { color: theme.muted }]}>{player.team}</Text>
    </View>
  );
}

function renderCompareTooltip(
  info: TooltipRenderInfo<CategoryDatum>,
  theme: Theme,
  focusedSeries: number | null,
) {
  const bubbleWidth = 136;
  const left = Math.max(0, Math.min(info.x - bubbleWidth / 2, info.width - bubbleWidth));
  const top = Math.max(
    4,
    Math.min((info.y ?? 0) - 66, Math.max((info.height ?? 66) - 62, 4)),
  );

  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltip,
        { left, top, width: bubbleWidth, backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.tooltipLabel, { color: theme.muted }]}>{info.datum.label}</Text>
      {focusedSeries == null || focusedSeries === 0 ? (
        <TooltipRow color={PLAYER_A.color} name="Yamal" value={info.values?.[0] ?? 0} theme={theme} />
      ) : null}
      {focusedSeries == null || focusedSeries === 1 ? (
        <TooltipRow color={PLAYER_B.color} name="Saka" value={info.values?.[1] ?? 0} theme={theme} />
      ) : null}
    </View>
  );
}

function TooltipRow({
  color,
  name,
  value,
  theme,
}: {
  color: string;
  name: string;
  value: number;
  theme: Theme;
}) {
  return (
    <View style={styles.tooltipRow}>
      <View style={[styles.tooltipDot, { backgroundColor: color }]} />
      <Text style={[styles.tooltipName, { color: theme.muted }]}>{name}</Text>
      <Text style={[styles.tooltipValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  vsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  playerColumn: { alignItems: "center", flex: 1, gap: 6 },
  avatar: {
    borderRadius: 36,
    borderWidth: 2,
    height: 72,
    marginBottom: 6,
    width: 72,
  },
  playerName: { fontFamily: fonts.semibold, fontSize: 14, textAlign: "center" },
  playerTeam: { fontFamily: fonts.regular, fontSize: 11.5 },
  vsText: { fontFamily: fonts.semibold, fontSize: 13, marginHorizontal: 4 },
  centeredChart: { alignItems: "center" },
  tooltip: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  tooltipLabel: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tooltipRow: { alignItems: "center", flexDirection: "row", minHeight: 17 },
  tooltipDot: { borderRadius: 3, height: 7, marginRight: 6, width: 7 },
  tooltipName: { flex: 1, fontFamily: fonts.regular, fontSize: 12 },
  tooltipValue: { fontFamily: fonts.semibold, fontSize: 12.5 },
});
