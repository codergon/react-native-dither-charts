import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions,
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
  ArrowDownIcon,
  ArrowUpIcon,
  DotsThreeIcon,
  SealCheckIcon,
  StarIcon,
  TextAlignCenterIcon,
} from "phosphor-react-native";
import {
  DitherLineChart,
  type ScrubInfo,
  type TooltipRenderInfo,
} from "react-native-dither-charts";
import { BLUE, BLUE_LIGHT, createTheme, type Theme } from "../theme";
import { fonts } from "../fonts";
import {
  RANGE_KEYS,
  buildRangeData,
  type RangeKey,
  type TickerPoint,
} from "../tickerData";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { goBackOrHome } from "../navigation/goBackOrHome";
import { BackButton } from "../components/BackButton";

const BASE_COLOR = "#4441ff";

const screenWidth = Dimensions.get("window").width;
const HORIZONTAL_PADDING = 20;
const CHART_HEIGHT = 260;

const DESCRIPTION =
  "Aave is a decentralized money market protocol where users can lend and borrow " +
  "cryptocurrency across 20 different assets as collateral.";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type Props = NativeStackScreenProps<RootStackParamList, "Ticker">;

export function TickerScreen({ navigation }: Props) {
  const dark = useColorScheme() === "dark";
  const theme = useMemo(() => createTheme(dark), [dark]);
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<RangeKey>("1D");
  const [scrubInfo, setScrubInfo] = useState<ScrubInfo<TickerPoint>>(null);

  // Stamped once on mount rather than recomputed every render, so the generated
  // walk doesn't visibly jump every time this screen re-renders.
  const [now] = useState(() => Date.now());
  const data = useMemo(() => buildRangeData(range, now), [range, now]);

  useEffect(() => {
    setScrubInfo(null);
  }, [range]);

  const baseValue = data[0]?.value ?? 0;
  const latestValue = data[data.length - 1]?.value ?? 0;
  const displayValue = scrubInfo ? scrubInfo.value : latestValue;
  const changePercent =
    baseValue !== 0 ? ((displayValue - baseValue) / baseValue) * 100 : 0;
  const changeUp = changePercent >= 0;

  const { minValue, maxValue } = useMemo(() => {
    const values = data.map((point) => point.value);
    const rawMax = Math.max(...values, 1);
    const rawMin = Math.min(...values, 0);
    const span = Math.max(rawMax - rawMin, 1);
    return { minValue: rawMin - span * 0.1, maxValue: rawMax + span * 0.32 };
  }, [data]);

  const handleScrub = useCallback(
    (info: ScrubInfo<TickerPoint>) => setScrubInfo(info),
    [],
  );

  const renderTooltip = useCallback(
    (info: TooltipRenderInfo<TickerPoint>) => renderTickerTooltip(info, theme),
    [theme],
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.iconRow}>
          <Image
            source={require("../assets/images/aave-logo.png")}
            style={styles.assetIcon}
          />
          <View style={styles.iconRowActions}>
            <StarIcon size={20} color="#ADADAD" weight="fill" />
            <DotsThreeIcon size={22} color={theme.muted} weight="bold" />
          </View>
        </View>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.text }]}>Aave</Text>
          <SealCheckIcon size={18} color={BLUE} weight="fill" />
        </View>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: theme.text }]}>
            ${displayValue.toFixed(2)}
          </Text>
          <View style={styles.changeRow}>
            {changeUp ? (
              <ArrowUpIcon size={13} color={theme.muted} weight="bold" />
            ) : (
              <ArrowDownIcon size={13} color={theme.muted} weight="bold" />
            )}
            <Text style={[styles.changeText, { color: theme.muted }]}>
              {Math.abs(changePercent).toFixed(2)}%
            </Text>
          </View>
        </View>

        <View style={styles.chartBleed}>
          <DitherLineChart
            data={data}
            width={screenWidth}
            height={CHART_HEIGHT}
            minValue={minValue}
            maxValue={maxValue}
            color={BASE_COLOR}
            futureColor={theme.faint}
            strokeWidth={2}
            curve="smooth"
            // bandWidth={16}
            showArea={!false}
            fillColor={BASE_COLOR}
            fillOpacity={1}
            dither={{
              variant: "gradient",
              cellSize: 2.6,
              startDensity: 0.1,
              endDensity: 0.8,
              solidFrom: 0.96,
              gradientColors: [BASE_COLOR, theme.background],
            }}
            scrub={{
              showLine: true,
              showDot: true,
              dotColor: BASE_COLOR,
              dotRadius: 5,
              haloRadius: 0,
              haloOpacity: 0,
            }}
            tooltip={{ render: renderTooltip }}
            onScrub={handleScrub}
          />
        </View>

        <View style={styles.rangeRow}>
          {RANGE_KEYS.map((key) => {
            const active = key === range;
            return (
              <Pressable
                key={key}
                onPress={() => setRange(key)}
                style={[
                  styles.rangeTab,
                  active && { backgroundColor: theme.surface },
                ]}
              >
                <Text
                  style={[
                    styles.rangeTabText,
                    { color: active ? theme.text : theme.muted },
                  ]}
                >
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.background }]} />

        <View style={styles.descriptionHeader}>
          <TextAlignCenterIcon size={16} color={theme.muted} />
          <Text style={[styles.descriptionTitle, { color: theme.text }]}>
            Description
          </Text>
        </View>
        <Text style={[styles.descriptionText, { color: theme.muted }]}>
          {DESCRIPTION}
        </Text>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>

      <BackButton theme={theme} onPress={() => goBackOrHome(navigation)} />
    </View>
  );
}

function renderTickerTooltip(
  info: TooltipRenderInfo<TickerPoint>,
  theme: Theme,
) {
  const bubbleWidth = 76;
  const left = clamp(
    Math.max(info.x - bubbleWidth / 2, 0),
    0,
    Math.max(info.width - bubbleWidth, 0),
  );

  return (
    <View
      pointerEvents="none"
      style={[
        styles.tooltipBubble,
        {
          left,
          width: bubbleWidth,
          paddingHorizontal: 4,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          {
            width: "100%",
            borderRadius: 14,
            borderWidth: 1.4,
            paddingVertical: 6,
            alignItems: "center",
            justifyContent: "center",
            borderColor: theme.border,
            backgroundColor: theme.background,
          },
        ]}
      >
        <Text
          style={[styles.tooltipText, { color: theme.muted }]}
          numberOfLines={1}
        >
          {info.datum.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 4,
  },
  iconRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  assetIcon: { borderRadius: 28, height: 56, width: 56 },
  iconRowActions: { alignItems: "center", flexDirection: "row", gap: 16 },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginBottom: 6,
  },
  name: { fontFamily: fonts.semibold, fontSize: 26 },
  priceRow: {
    marginBottom: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  price: { fontFamily: fonts.semibold, fontSize: 32 },
  changeRow: { alignItems: "center", flexDirection: "row", gap: 4 },
  changeText: { fontFamily: fonts.medium, fontSize: 18 },
  chartBleed: { marginHorizontal: -HORIZONTAL_PADDING },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  rangeTab: {
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  rangeTabText: { fontFamily: fonts.medium, fontSize: 13 },
  divider: { height: 1, marginVertical: 20 },
  descriptionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  descriptionTitle: { fontFamily: fonts.medium, fontSize: 15 },
  descriptionText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  tooltipBubble: {
    top: 0,
    alignItems: "center",
    position: "absolute",
  },
  tooltipText: { fontFamily: fonts.medium, fontSize: 11 },
});
