export type Theme = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  faint: string;
  grid: string;
  tooltip: string;
  border: string;
  divider: string;
};

export const BLUE = "#2D9CF4";
export const BLUE_LIGHT = "#72D8FF";
export const PURPLE = "#9B70FF";
export const GREEN = "#22D878";
export const ORANGE = "#FF982E";
export const GRAY = "#65656F";
export const RED = "#FF3B30";

export function createTheme(dark: boolean): Theme {
  return {
    background: dark ? "#131313" : "#FFFFFF",
    surface: dark ? "#1C1C1F" : "#F7F7F8",
    text: dark ? "#F5F5F4" : "#111114",
    muted: dark ? "#A5A4AD" : "#73727E",
    faint: dark ? "#5C5C64" : "#B7B6BE",
    grid: dark ? "#34343A" : "#DDE2EB",
    tooltip: dark ? "#202024" : "#FFFFFF",
    border: dark ? "#3B3B42" : "#E1E2E6",
    divider: dark ? "#2A2A2E" : "#ECECEE",
  };
}
