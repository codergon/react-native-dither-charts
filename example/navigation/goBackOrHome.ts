import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "./RootNavigator";

// Dev-only Fast Refresh can leave a screen as the sole entry in the stack (no Home
// beneath it), which makes a plain goBack() throw "GO_BACK was not handled by any
// navigator." Falling back to Home keeps the back button working either way.
export function goBackOrHome(navigation: NavigationProp<RootStackParamList>) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    navigation.navigate("Home");
  }
}
