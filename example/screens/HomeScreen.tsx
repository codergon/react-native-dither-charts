import React, { useMemo } from "react";
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
  CaretRightIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  ChartPieIcon,
  GridFourIcon,
  MusicNotesIcon,
} from "phosphor-react-native";
import { BLUE, GREEN, ORANGE, PURPLE, createTheme, type Theme } from "../theme";
import { fonts } from "../fonts";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

type ExampleEntry = {
  route: keyof RootStackParamList;
  title: string;
  icon: (theme: Theme) => React.ReactNode;
};

const EXAMPLES: ExampleEntry[] = [
  {
    route: "Ticker",
    title: "Line Chart",
    icon: () => (
      <Image
        source={require("../assets/images/aave-logo.png")}
        style={styles.icon}
      />
    ),
  },
  {
    route: "PlayerCompare",
    title: "Radar Chart",
    icon: () => <OverlappedAvatars />,
  },
  {
    route: "MultiLineChart",
    title: "Multi Line Chart",
    icon: () => (
      <View style={[styles.icon, styles.iconTile, { backgroundColor: PURPLE }]}>
        <ChartLineUpIcon size={16} color="#FFFFFF" weight="fill" />
      </View>
    ),
  },
  {
    route: "AreaChart",
    title: "Area Chart",
    icon: (theme) => (
      <View
        style={[styles.icon, styles.iconTile, { backgroundColor: theme.text }]}
      >
        <MusicNotesIcon size={16} color={theme.background} weight="fill" />
      </View>
    ),
  },
  {
    route: "BarChart",
    title: "Bar Chart",
    icon: () => (
      <View style={[styles.icon, styles.iconTile, { backgroundColor: GREEN }]}>
        <ChartBarIcon size={16} color="#FFFFFF" weight="fill" />
      </View>
    ),
  },
  {
    route: "PieChart",
    title: "Pie Chart",
    icon: () => (
      <View style={[styles.icon, styles.iconTile, { backgroundColor: ORANGE }]}>
        <ChartPieIcon size={16} color="#FFFFFF" weight="fill" />
      </View>
    ),
  },
  {
    route: "Gallery",
    title: "Chart Gallery",
    icon: (theme) => (
      <View style={[styles.icon, styles.iconTile, { backgroundColor: BLUE }]}>
        <GridFourIcon size={16} color="#FFFFFF" weight="fill" />
      </View>
    ),
  },
];

export function HomeScreen({ navigation }: Props) {
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
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={[styles.title, { color: theme.text }]}>
          react-native-dither-charts
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {EXAMPLES.map((example, index) => (
          <Pressable
            key={example.route}
            onPress={() => navigation.navigate(example.route)}
            style={[
              styles.row,
              index < EXAMPLES.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.divider,
              },
            ]}
          >
            {example.icon(theme)}
            <Text style={[styles.rowTitle, { color: theme.text }]}>
              {example.title}
            </Text>
            <CaretRightIcon size={16} color={theme.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// Matches the player colors used on the radar chart screen itself (PlayerCompareScreen).
const YAMAL_COLOR = "#0068C9";
const SAKA_COLOR = "#EF0107";

function OverlappedAvatars() {
  return (
    <View style={styles.stack}>
      <View
        style={[
          styles.stackAvatarFrame,
          styles.stackAvatarLeft,
          { borderColor: YAMAL_COLOR },
        ]}
      >
        <Image
          source={require("../assets/images/lamine.jpg")}
          resizeMode="cover"
          style={styles.stackAvatarImage}
        />
      </View>
      <View
        style={[
          styles.stackAvatarFrame,
          styles.stackAvatarRight,
          { borderColor: SAKA_COLOR },
        ]}
      >
        <Image
          source={require("../assets/images/saka.png")}
          resizeMode="cover"
          style={styles.stackAvatarImage}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontFamily: fonts.semibold, fontSize: 24, marginBottom: 4 },
  subtitle: { fontFamily: fonts.regular, fontSize: 13 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingVertical: 14,
  },
  rowTitle: { flex: 1, fontFamily: fonts.medium, fontSize: 16 },
  icon: { borderRadius: 16, height: 32, width: 32 },
  iconTile: { alignItems: "center", justifyContent: "center" },
  stack: { height: 32, width: 32 },
  stackAvatarFrame: {
    backgroundColor: "#F2F2F5",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    overflow: "hidden",
    position: "absolute",
    top: 6,
    width: 20,
  },
  stackAvatarImage: {
    height: "100%",
    width: "100%",
  },
  stackAvatarLeft: { left: 0 },
  stackAvatarRight: { left: 12 },
});
