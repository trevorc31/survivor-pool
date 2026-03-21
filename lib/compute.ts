export const BUY_IN = 15;
export const BB_COST = 5;
export const MAX_BB = 3;

export interface DayConfig {
  id: string;
  label: string;
  date: string;
  dayOfWeek: string;
  advPicks: number;
  bbPicks: number | null;
}

export interface HistoryEntry {
  dayId: string;
  picks: string[];
  buyBack: boolean;
}

export interface PlayerRaw {
  n: string;
  me: boolean;
  history: HistoryEntry[];
}

export interface PlayerComputed extends PlayerRaw {
  usedTeams: Set<string>;
  allPicks: { team: string; dayId: string }[];
  totalBB: number;
  dayResults: Record<string, string>;
  lastDayResult: string | null;
  isPermElim: boolean;
  dupes: string[];
  nextPicksNeeded: number;
  nextIsBuyBack: boolean;
  money: number;
  currentStatus: string;
}

export function computePlayer(
  p: PlayerRaw,
  teamResults: Record<string, Record<string, string>>,
  days: DayConfig[]
): PlayerComputed {
  const allPicks: { team: string; dayId: string }[] = [];
  const usedTeams = new Set<string>();
  let totalBB = 0;
  let lastDayResult: string | null = null;
  let isPermElim = false;
  const dayResults: Record<string, string> = {};

  for (const entry of p.history) {
    const results = teamResults[entry.dayId];
    if (!results) {
      dayResults[entry.dayId] = "pending";
      continue;
    }

    if (entry.buyBack) totalBB++;

    const pickResults = entry.picks.map((t) => results[t] || "pending");
    const hasLoss = pickResults.some((r) => r === "lost");
    const allWon = pickResults.every((r) => r === "won");

    if (hasLoss) dayResults[entry.dayId] = "eliminated";
    else if (allWon) dayResults[entry.dayId] = "survived";
    else dayResults[entry.dayId] = "pending";

    entry.picks.forEach((t) => {
      usedTeams.add(t);
      allPicks.push({ team: t, dayId: entry.dayId });
    });
    lastDayResult = dayResults[entry.dayId];
  }

  const lastEntry = p.history[p.history.length - 1];
  const lastDayIdx = days.findIndex((d) => d.id === lastEntry?.dayId);
  const nextDay = days[lastDayIdx + 1];

  if (lastDayResult === "eliminated") {
    const hasNext = p.history.some((e) => {
      const eIdx = days.findIndex((d) => d.id === e.dayId);
      return eIdx > lastDayIdx;
    });
    if (!hasNext && !nextDay) isPermElim = true;
  }

  if (p.history.length === 1 && dayResults.day1 === "eliminated") {
    const hasDay2 = p.history.some((e) => e.dayId === "day2");
    if (!hasDay2) isPermElim = true;
  }

  const seen = new Set<string>();
  const dupes: string[] = [];
  allPicks.forEach(({ team }) => {
    if (seen.has(team)) dupes.push(team);
    seen.add(team);
  });

  let nextPicksNeeded = 0;
  let nextIsBuyBack = false;
  if (
    !isPermElim &&
    lastDayResult === "eliminated" &&
    nextDay
  ) {
    if (totalBB < MAX_BB) {
      nextPicksNeeded = nextDay.bbPicks || 0;
      nextIsBuyBack = true;
    }
  } else if (
    !isPermElim &&
    (lastDayResult === "survived" || lastDayResult === "pending") &&
    nextDay
  ) {
    nextPicksNeeded = nextDay.advPicks;
  }

  return {
    ...p,
    usedTeams,
    allPicks,
    totalBB,
    dayResults,
    lastDayResult,
    isPermElim,
    dupes,
    nextPicksNeeded,
    nextIsBuyBack,
    money: BUY_IN + totalBB * BB_COST,
    currentStatus: isPermElim
      ? "out"
      : dayResults.day2 || dayResults.day1 || "pending",
  };
}

// Futures odds data
export const FUT: Record<string, { dr: number; t: number; o: string }> = {
  Duke: { dr: 0.95, t: 1, o: "+475" },
  Arizona: { dr: 0.96, t: 1, o: "+340" },
  Michigan: { dr: 0.94, t: 1, o: "+370" },
  Houston: { dr: 0.88, t: 1, o: "+950" },
  Florida: { dr: 0.92, t: 1, o: "+800" },
  "Iowa State": { dr: 0.85, t: 2, o: "+1200" },
  Illinois: { dr: 0.80, t: 2, o: "+1800" },
  Purdue: { dr: 0.78, t: 2, o: "+2500" },
  UConn: { dr: 0.75, t: 2, o: "+2500" },
  Alabama: { dr: 0.76, t: 2, o: "+2000" },
  Kansas: { dr: 0.74, t: 2, o: "+2000" },
  Tennessee: { dr: 0.72, t: 2, o: "+3000" },
  Virginia: { dr: 0.65, t: 3, o: "+4000" },
  "Michigan State": { dr: 0.60, t: 3, o: "+5000" },
  "St. John's": { dr: 0.58, t: 3, o: "+5000" },
  Gonzaga: { dr: 0.55, t: 3, o: "+5500" },
  UCLA: { dr: 0.50, t: 3, o: "+6000" },
  Kentucky: { dr: 0.55, t: 3, o: "+4000" },
  Arkansas: { dr: 0.52, t: 3, o: "+5000" },
  Nebraska: { dr: 0.35, t: 4, o: "+10000" },
  "Texas Tech": { dr: 0.40, t: 4, o: "+8000" },
  Vanderbilt: { dr: 0.25, t: 4, o: "+15000" },
  Louisville: { dr: 0.28, t: 4, o: "+12000" },
  Iowa: { dr: 0.32, t: 4, o: "+10000" },
  "Miami (FL)": { dr: 0.35, t: 4, o: "+8000" },
  "Utah State": { dr: 0.18, t: 4, o: "+25000" },
  "Saint Louis": { dr: 0.15, t: 4, o: "+35000" },
  TCU: { dr: 0.20, t: 4, o: "+20000" },
  VCU: { dr: 0.22, t: 4, o: "+20000" },
  "Texas A&M": { dr: 0.20, t: 4, o: "+15000" },
  "High Point": { dr: 0.05, t: 5, o: "+100000" },
  "Miami (OH)": { dr: 0.03, t: 5, o: "+200000" },
  "Santa Clara": { dr: 0.02, t: 5, o: "+100000" },
};

export const WP: Record<string, number> = {
  Kentucky: 1, "Texas Tech": 1, Virginia: 1, "Santa Clara": 0,
  "Iowa State": 0.99, Alabama: 0.92, "Utah State": 0.52,
  Tennessee: 0.88, "Miami (OH)": 0.12,
  Iowa: 0.58, "St. John's": 0.91, UCLA: 0.85, Purdue: 0.97,
  Florida: 0.98, Kansas: 0.97, UConn: 0.93, "Miami (FL)": 0.72,
  Michigan: 0.82, "Saint Louis": 0.18, "Michigan State": 0.68,
  Louisville: 0.32, Duke: 0.88, TCU: 0.12, Houston: 0.75,
  "Texas A&M": 0.25, Gonzaga: 0.70, Nebraska: 0.62,
  Vanderbilt: 0.38, Illinois: 0.72, VCU: 0.28, Arkansas: 0.78,
  "High Point": 0.22,
};

// Enhanced edge scoring with 5 components
export interface EdgeScoreInput {
  impliedWinProb: number | null;
  deepRunProb: number;
  uniqueness: number;
  sharpMoney: number | null;
  systems: number | null;
  spread: number | null;
}

export interface EdgeComponents {
  wp: number;
  futures: number;
  uniq: number;
  sharp: number;
  lineValue: number;
}

export function computeEdgeScore(
  team: string,
  opts: EdgeScoreInput
): { score: number; components: EdgeComponents } {
  // 25% — win probability (live implied or fallback)
  const wpVal = opts.impliedWinProb ?? WP[team] ?? 0.5;
  const wpComponent = wpVal * 0.25;

  // 20% — futures expendability (inverse of deep run prob)
  const futuresComponent = (1 - opts.deepRunProb) * 0.2;

  // 25% — uniqueness
  const uniqComponent = opts.uniqueness * 0.25;

  // 20% — sharp signals
  let sharpComponent: number;
  if (opts.sharpMoney !== null || opts.systems !== null) {
    const sharpNorm = opts.sharpMoney !== null ? opts.sharpMoney / 100 : 0.5;
    const sysNorm = opts.systems !== null ? Math.min(opts.systems, 5) / 5 : 0.5;
    sharpComponent = (sharpNorm * 0.7 + sysNorm * 0.3) * 0.2;
  } else {
    sharpComponent = 0.5 * 0.2; // neutral when no data
  }

  // 10% — line value (moderate favorites = highest value)
  let lineValueComponent: number;
  if (opts.spread !== null) {
    const absSpread = Math.abs(opts.spread);
    lineValueComponent =
      Math.min(Math.max((absSpread - 3) / 20, 0), 1) * 0.1;
  } else {
    lineValueComponent = 0.5 * 0.1; // neutral when no data
  }

  const score =
    wpComponent + futuresComponent + uniqComponent + sharpComponent + lineValueComponent;

  return {
    score,
    components: {
      wp: wpComponent,
      futures: futuresComponent,
      uniq: uniqComponent,
      sharp: sharpComponent,
      lineValue: lineValueComponent,
    },
  };
}
