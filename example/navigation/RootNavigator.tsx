import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { TickerScreen } from "../screens/TickerScreen";
import { ChartGalleryScreen } from "../screens/ChartGalleryScreen";
import { PlayerCompareScreen } from "../screens/PlayerCompareScreen";
import { AreaChartScreen } from "../screens/AreaChartScreen";
import { BarChartScreen } from "../screens/BarChartScreen";
import { MultiLineChartScreen } from "../screens/MultiLineChartScreen";
import { PieChartScreen } from "../screens/PieChartScreen";

export type RootStackParamList = {
  Home: undefined;
  Ticker: undefined;
  Gallery: undefined;
  PlayerCompare: undefined;
  AreaChart: undefined;
  BarChart: undefined;
  MultiLineChart: undefined;
  PieChart: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Ticker" component={TickerScreen} />
        <Stack.Screen name="Gallery" component={ChartGalleryScreen} />
        <Stack.Screen name="PlayerCompare" component={PlayerCompareScreen} />
        <Stack.Screen name="AreaChart" component={AreaChartScreen} />
        <Stack.Screen name="BarChart" component={BarChartScreen} />
        <Stack.Screen name="MultiLineChart" component={MultiLineChartScreen} />
        <Stack.Screen name="PieChart" component={PieChartScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
