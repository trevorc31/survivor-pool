import { NextResponse } from "next/server";
import { mapEspnTeamName, APP_TEAMS } from "@/lib/espn-mapping";
import resultsData from "@/data/results.json";

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";

// Map calendar dates to tournament days
const DAY_DATES: Record<string, string> = {
  "2026-03-19": "day1",
  "2026-03-20": "day2",
  "2026-03-21": "day3",
  "2026-03-22": "day4",
  // Add more days as tournament progresses
  "2026-03-23": "day5",
  "2026-03-24": "day6",
  "2026-03-25": "day7",
  "2026-03-26": "day8",
  "2026-03-27": "day9",
  "2026-03-28": "day10",
  "2026-03-29": "day11",
  "2026-03-30": "day12",
};

// Teams playing each day (only show these in game status)
const DAY_TEAMS: Record<string, Set<string>> = {
  day3: new Set(["Michigan", "St. Louis", "Michigan State", "Louisville", "Duke", "TCU", "Houston", "Texas A&M", "Gonzaga", "Texas", "Illinois", "VCU", "Nebraska", "Vanderbilt", "Arkansas", "High Point"]),
  day4: new Set(["Purdue", "Miami (FL)", "Iowa State", "Kentucky", "Kansas", "St. John's", "Virginia", "Tennessee", "Florida", "Iowa", "Arizona", "Utah State", "UConn", "UCLA", "Alabama", "Texas Tech"]),
};

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function toEspnDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

interface EspnCompetitor {
  team: {
    displayName: string;
    shortDisplayName: string;
    abbreviation: string;
  };
  score: string;
  homeAway: string;
  winner?: boolean;
}

interface EspnEvent {
  competitions: {
    competitors: EspnCompetitor[];
  }[];
  status: {
    type: {
      name: string;
      shortDetail: string;
      completed: boolean;
    };
    displayClock: string;
    period: number;
  };
}

function mapEspnStatus(
  statusName: string
): "won" | "lost" | "in_progress" | "scheduled" {
  switch (statusName) {
    case "STATUS_FINAL":
      return "won"; // placeholder — caller determines won/lost per team
    case "STATUS_IN_PROGRESS":
    case "STATUS_HALFTIME":
    case "STATUS_END_PERIOD":
      return "in_progress";
    default:
      return "scheduled";
  }
}

function buildScoreString(
  team: EspnCompetitor,
  opponent: EspnCompetitor,
  status: EspnEvent["status"],
  statusName: string
): string {
  const oppName =
    mapEspnTeamName(opponent.team.shortDisplayName) ||
    mapEspnTeamName(opponent.team.displayName) ||
    opponent.team.shortDisplayName;

  if (statusName === "STATUS_FINAL") {
    const detail = status.type.shortDetail;
    const otSuffix = detail.includes("OT") ? ` (${detail.replace("Final/", "")})` : "";
    return `${team.score}-${opponent.score} vs ${oppName}${otSuffix}`;
  }

  if (
    statusName === "STATUS_IN_PROGRESS" ||
    statusName === "STATUS_HALFTIME" ||
    statusName === "STATUS_END_PERIOD"
  ) {
    const period = status.period;
    const clock = status.displayClock;
    let periodLabel = "";
    if (statusName === "STATUS_HALFTIME") {
      periodLabel = "HT";
    } else if (period === 1) {
      periodLabel = `1H ${clock}`;
    } else if (period === 2) {
      periodLabel = `2H ${clock}`;
    } else {
      periodLabel = `OT ${clock}`;
    }
    return `${team.score}-${opponent.score} vs ${oppName} (${periodLabel})`;
  }

  // Scheduled
  const time = status.type.shortDetail;
  return `${time} vs ${oppName}`;
}

export async function GET() {
  const todayET = getTodayET();
  const activeDayId = DAY_DATES[todayET] || null;

  // Start with static baseline data
  const teamResults: Record<string, Record<string, string>> = JSON.parse(
    JSON.stringify(resultsData.teamResults)
  );
  const scores: Record<string, Record<string, string>> = JSON.parse(
    JSON.stringify(resultsData.scores)
  );

  let hasLiveGames = false;
  let espnFetchFailed = false;

  // Only fetch from ESPN if today is a tournament day
  if (activeDayId) {
    try {
      const espnUrl = `${ESPN_BASE}?dates=${toEspnDate(todayET)}&groups=50&limit=500`;
      const res = await fetch(espnUrl, { next: { revalidate: 30 } });

      if (!res.ok) {
        throw new Error(`ESPN API returned ${res.status}`);
      }

      const data = await res.json();
      const events: EspnEvent[] = data.events || [];

      if (!teamResults[activeDayId]) teamResults[activeDayId] = {};
      if (!scores[activeDayId]) scores[activeDayId] = {};

      for (const event of events) {
        const comp = event.competitions[0];
        if (!comp || comp.competitors.length < 2) continue;

        const [teamA, teamB] = comp.competitors;
        const nameA =
          mapEspnTeamName(teamA.team.shortDisplayName) ||
          mapEspnTeamName(teamA.team.displayName);
        const nameB =
          mapEspnTeamName(teamB.team.shortDisplayName) ||
          mapEspnTeamName(teamB.team.displayName);

        // Filter: only include games where at least one team is scheduled for today
        if (!nameA && !nameB) continue;
        const todayTeams = DAY_TEAMS[activeDayId];
        if (todayTeams) {
          const aInDay = nameA && todayTeams.has(nameA);
          const bInDay = nameB && todayTeams.has(nameB);
          if (!aInDay && !bInDay) continue;
        } else {
          // Fallback to APP_TEAMS for days without explicit team list
          if (nameA && !APP_TEAMS.has(nameA) && nameB && !APP_TEAMS.has(nameB))
            continue;
        }

        const statusName = event.status.type.name;

        // Process each team in the game
        for (const [team, opponent] of [
          [teamA, teamB],
          [teamB, teamA],
        ] as [EspnCompetitor, EspnCompetitor][]) {
          const appName =
            mapEspnTeamName(team.team.shortDisplayName) ||
            mapEspnTeamName(team.team.displayName);
          if (!appName || !APP_TEAMS.has(appName)) continue;

          // Determine result
          let result: string;
          if (statusName === "STATUS_FINAL") {
            const teamScore = parseInt(team.score, 10);
            const oppScore = parseInt(opponent.score, 10);
            result = teamScore > oppScore ? "won" : "lost";
          } else {
            result = mapEspnStatus(statusName);
          }

          teamResults[activeDayId][appName] = result;
          scores[activeDayId][appName] = buildScoreString(
            team,
            opponent,
            event.status,
            statusName
          );
        }

        // Track if any games are still live
        if (
          statusName !== "STATUS_FINAL" &&
          statusName !== "STATUS_POSTPONED" &&
          statusName !== "STATUS_CANCELED"
        ) {
          hasLiveGames = true;
        }
      }
    } catch (e) {
      console.error("ESPN fetch failed:", e);
      espnFetchFailed = true;
    }
  }

  return NextResponse.json(
    {
      teamResults,
      scores,
      days: resultsData.days,
      activeDayId,
      lastFetched: new Date().toISOString(),
      hasLiveGames,
      espnFetchFailed,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
