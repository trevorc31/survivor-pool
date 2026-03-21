import { NextResponse } from "next/server";
import { mapOddsTeamName } from "@/lib/odds-mapping";
import { APP_TEAMS } from "@/lib/espn-mapping";
import sharpDataRaw from "@/data/sharp-data.json";

const ODDS_API_BASE =
  "https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds";

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

interface OddsBookmaker {
  key: string;
  markets: OddsMarket[];
}

interface OddsEvent {
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

interface SharpTeamData {
  sharpMoney: number;
  systems: number;
  trends: string[];
  rating: number;
}

interface SharpData {
  lastUpdated: string | null;
  dayId: string | null;
  teams: Record<string, SharpTeamData>;
}

export interface OddsTeamData {
  team: string;
  opponent: string;
  moneyline: number | null;
  spread: number | null;
  impliedWinProb: number | null;
  sharp: SharpTeamData | null;
}

export interface OddsResponse {
  teams: Record<string, OddsTeamData>;
  lastOddsUpdate: string;
  creditsRemaining: number | null;
  fallback: boolean;
  sharpLastUpdated: string | null;
}

function americanToImplied(odds: number): number {
  if (odds < 0) return Math.abs(odds) / (Math.abs(odds) + 100);
  return 100 / (odds + 100);
}

function getConsensusOdds(
  bookmakers: OddsBookmaker[],
  marketKey: string,
  teamName: string
): { price: number; point?: number } | null {
  const prices: number[] = [];
  const points: number[] = [];

  for (const bk of bookmakers) {
    const market = bk.markets.find((m) => m.key === marketKey);
    if (!market) continue;
    const outcome = market.outcomes.find((o) => o.name === teamName);
    if (!outcome) continue;
    prices.push(outcome.price);
    if (outcome.point !== undefined) points.push(outcome.point);
  }

  if (prices.length === 0) return null;

  const avgPrice = Math.round(
    prices.reduce((a, b) => a + b, 0) / prices.length
  );
  const avgPoint =
    points.length > 0
      ? Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 2) / 2
      : undefined;

  return { price: avgPrice, point: avgPoint };
}

export async function GET() {
  const sharpData = sharpDataRaw as SharpData;
  const teams: Record<string, OddsTeamData> = {};
  let creditsRemaining: number | null = null;
  let fallback = false;

  const apiKey = process.env.ODDS_API_KEY;

  if (apiKey) {
    try {
      const url = `${ODDS_API_BASE}?apiKey=${apiKey}&regions=us&markets=h2h,spreads&oddsFormat=american`;
      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`Odds API returned ${res.status}`);
      }

      const remaining = res.headers.get("x-requests-remaining");
      if (remaining) creditsRemaining = parseInt(remaining, 10);

      const events: OddsEvent[] = await res.json();

      for (const event of events) {
        const homeApp = mapOddsTeamName(event.home_team);
        const awayApp = mapOddsTeamName(event.away_team);

        // Only include games where at least one team is in our pool
        if (!homeApp && !awayApp) continue;
        if (homeApp && !APP_TEAMS.has(homeApp) && awayApp && !APP_TEAMS.has(awayApp))
          continue;

        for (const [rawName, appName, oppRaw, oppApp] of [
          [event.home_team, homeApp, event.away_team, awayApp],
          [event.away_team, awayApp, event.home_team, homeApp],
        ] as [string, string | null, string, string | null][]) {
          if (!appName || !APP_TEAMS.has(appName)) continue;

          const h2h = getConsensusOdds(event.bookmakers, "h2h", rawName);
          const spread = getConsensusOdds(event.bookmakers, "spreads", rawName);

          // Strip mascot from non-app opponent names (e.g. "Clemson Tigers" -> "Clemson")
          const oppDisplay = oppApp || oppRaw.replace(/\s+[A-Z][a-z]+$/, "") || oppRaw;

          teams[appName] = {
            team: appName,
            opponent: oppDisplay,
            moneyline: h2h?.price ?? null,
            spread: spread?.point ?? null,
            impliedWinProb: h2h ? americanToImplied(h2h.price) : null,
            sharp: sharpData.teams[appName] || null,
          };
        }
      }
    } catch (e) {
      console.error("Odds API fetch failed:", e);
      fallback = true;
    }
  } else {
    fallback = true;
  }

  // If fallback, still populate with sharp data for any teams that have it
  if (fallback) {
    for (const [teamName, sharp] of Object.entries(sharpData.teams)) {
      if (!APP_TEAMS.has(teamName)) continue;
      if (!teams[teamName]) {
        teams[teamName] = {
          team: teamName,
          opponent: "",
          moneyline: null,
          spread: null,
          impliedWinProb: null,
          sharp,
        };
      }
    }
  }

  return NextResponse.json(
    {
      teams,
      lastOddsUpdate: new Date().toISOString(),
      creditsRemaining,
      fallback,
      sharpLastUpdated: sharpData.lastUpdated,
    } as OddsResponse,
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}
