import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeftIcon } from "phosphor-react-native";
import type { Theme } from "../theme";

// Floats bottom-left over the content on every screen, matching the ticker screen's
// circular outlined back button, rather than sitting in a top header row.
export function BackButton({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 16 }]}>
      <Pressable
        hitSlop={12}
        onPress={onPress}
        style={[styles.button, { borderColor: theme.border }]}
      >
        <CaretLeftIcon size={20} color={theme.text} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "absolute", left: 20 },
  button: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
