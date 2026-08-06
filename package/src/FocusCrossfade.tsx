import React, { useEffect } from "react";
import { Group } from "@shopify/react-native-skia";
import { Easing, useDerivedValue, useSharedValue, withTiming } from "react-native-reanimated";

type FocusCrossfadeProps = {
  active: boolean;
  duration: number;
  resting: React.ReactNode;
  focused: React.ReactNode;
};

export const FocusCrossfade = React.memo(function FocusCrossfade({
  active,
  duration,
  resting,
  focused
}: FocusCrossfadeProps) {
  const progress = useSharedValue(active ? 1 : 0);
  const restingOpacity = useDerivedValue(() => 1 - progress.value);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration,
      easing: Easing.out(Easing.cubic)
    });
  }, [active, duration, progress]);

  return (
    <>
      <Group opacity={restingOpacity}>{resting}</Group>
      <Group opacity={progress}>{focused}</Group>
    </>
  );
});
