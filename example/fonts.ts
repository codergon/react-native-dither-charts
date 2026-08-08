import { useFonts } from "expo-font";

export const fonts = {
  regular: "GeneralSans-Regular",
  medium: "GeneralSans-Medium",
  semibold: "GeneralSans-Semibold",
  bold: "GeneralSans-Bold",
} as const;

export function useAppFonts() {
  return useFonts({
    "GeneralSans-Regular": require("./assets/fonts/GeneralSans-Regular.otf"),
    "GeneralSans-Medium": require("./assets/fonts/GeneralSans-Medium.otf"),
    "GeneralSans-Semibold": require("./assets/fonts/GeneralSans-Semibold.otf"),
    "GeneralSans-Bold": require("./assets/fonts/GeneralSans-Bold.otf"),
  });
}
