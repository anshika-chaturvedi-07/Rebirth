/**
 * Chart colours. The app's pastel tints are for UI surfaces; data marks use these deeper steps of the same hues,
 * validated (dataviz validate_palette.js, light mode, card surface #FFFDF8): lightness band, chroma floor,
 * colour-blind separation, normal-vision floor and 3:1 contrast all PASS.
 */
export const CHART = {
  supply: "#1F8FC4", // deep sky
  demand: "#E8603C", // deep coral
  stage: { free: "#4E9F2E", marketplace: "#1F8FC4", recycle: "#7B5BE0" } as const, // deep lime / sky / lavender
  single: "#7B5BE0", // one-series charts
  impact: "#4E9F2E",
  grid: "#EFE6D8", // one step off the card surface
  axis: "#6E5D8C", // plum-soft text token
  ink: "#3D2C5A",
  surface: "#FFFDF8",
};

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Full under 10,000, compact above (12.9K, 4.2L style follows the en-IN locale). */
export function num(n: number) {
  return Math.abs(n) < 10_000 ? full.format(n) : compact.format(n);
}

export function kg(n: number) {
  return n >= 1000 ? `${num(n / 1000)} t` : `${full.format(n)} kg`;
}

export const axisTick = { fill: CHART.axis, fontSize: 12, fontFamily: "Nunito, sans-serif", fontWeight: 600 };
