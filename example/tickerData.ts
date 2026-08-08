export type RangeKey = "1H" | "1D" | "1W" | "1M" | "1Y";

export const RANGE_KEYS: RangeKey[] = ["1H", "1D", "1W", "1M", "1Y"];

export type TickerPoint = { label?: string; value: number };

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatClock(date: Date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = ((hours + 11) % 12) + 1;
  return `${displayHour}:${String(minutes).padStart(2, "0")}${period}`;
}

// Deterministic PRNG (mulberry32) so the "random" walk below is stable across
// renders/reloads instead of jumping around every time the component remounts.
function mulberry32(seed: number) {
  let state = seed;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type RangeConfig = {
  points: number;
  stepMs: number;
  volatility: number;
  drift: number;
  seed: number;
  formatLabel: (date: Date) => string;
};

const RANGE_CONFIG: Record<RangeKey, RangeConfig> = {
  "1H": {
    points: 31,
    stepMs: 2 * 60 * 1000,
    volatility: 1.1,
    drift: -0.02,
    seed: 1104,
    formatLabel: formatClock,
  },
  "1D": {
    points: 49,
    stepMs: 30 * 60 * 1000,
    volatility: 30,
    drift: -0.08,
    seed: 4271,
    formatLabel: formatClock,
  },
  "1W": {
    points: 43,
    stepMs: 4 * 60 * 60 * 1000,
    volatility: 6.5,
    drift: 0.05,
    seed: 733,
    formatLabel: (date) => `${WEEKDAYS[date.getDay()]} ${formatClock(date)}`,
  },
  "1M": {
    points: 31,
    stepMs: 24 * 60 * 60 * 1000,
    volatility: 10,
    drift: 0.15,
    seed: 209,
    formatLabel: (date) => `${MONTHS[date.getMonth()]} ${date.getDate()}`,
  },
  "1Y": {
    points: 53,
    stepMs: 7 * 24 * 60 * 60 * 1000,
    volatility: 16,
    drift: 0.12,
    seed: 58,
    formatLabel: (date) => `${MONTHS[date.getMonth()]} ${date.getDate()}`,
  },
};

const BASE_PRICE = 92;

export function buildRangeData(range: RangeKey, now: number): TickerPoint[] {
  const config = RANGE_CONFIG[range];
  const random = mulberry32(config.seed);
  const values: number[] = [BASE_PRICE];
  for (let index = 1; index < config.points; index += 1) {
    const noise = (random() - 0.5) * config.volatility;
    const next = Math.max(
      values[index - 1] + noise + config.drift,
      BASE_PRICE * 0.4,
    );
    values.push(next);
  }

  return values.map((value, index) => {
    const offsetSteps = config.points - 1 - index;
    const date = new Date(now - offsetSteps * config.stepMs);
    return {
      label: config.formatLabel(date),
      value: Math.round(value * 100) / 100,
    };
  });
}
