// Maps ESPN team displayName/shortDisplayName to the app's internal team names.
// Only teams relevant to the NCAA Men's Basketball Tournament are included.

const ESPN_TO_APP: Record<string, string> = {
  // Exact matches that ESPN may use different names for
  "Virginia Commonwealth": "VCU",
  "Central Florida": "UCF",
  "Miami": "Miami (FL)",
  "Miami Hurricanes": "Miami (FL)",
  "Miami (FL) Hurricanes": "Miami (FL)",
  "Miami Ohio": "Miami (OH)",
  "Miami (OH) RedHawks": "Miami (OH)",
  "Michigan St": "Michigan State",
  "Michigan St.": "Michigan State",
  "Saint Louis": "St. Louis",
  "Saint Louis Billikens": "St. Louis",
  "St. John's (NY)": "St. John's",
  "St. John's Red Storm": "St. John's",
  "Connecticut": "UConn",
  "Brigham Young": "BYU",
  "North Carolina": "North Carolina",
  "UNC": "North Carolina",
  "High Point Panthers": "High Point",
  "Prairie View A&M": "Prairie View",
  "Cal Baptist": "Cal Baptist",
  "Northern Iowa": "N. Iowa",
  "Texas A&M Aggies": "Texas A&M",
  "Ohio St": "Ohio State",
  "Ohio St.": "Ohio State",
  "Penn St": "Penn State",
  "Penn St.": "Penn State",
};

// All teams that appear in the app (from players.json picks + results.json)
export const APP_TEAMS = new Set([
  "Vanderbilt", "Michigan State", "St. Louis", "Nebraska",
  "Illinois", "Arkansas", "Louisville", "Gonzaga", "Duke", "Houston",
  "Texas A&M", "VCU", "Wisconsin", "North Carolina", "BYU", "Ohio State",
  "Saint Mary's", "Georgia", "Santa Clara", "Kentucky", "Texas Tech",
  "Virginia", "Iowa State", "Alabama", "Utah State", "Tennessee",
  "Miami (OH)", "Iowa", "St. John's", "UCLA", "Purdue", "Florida",
  "Kansas", "UConn", "Miami (FL)", "High Point", "TCU",
  "Michigan", "Texas", "Arizona",
]);

export function mapEspnTeamName(espnName: string): string | null {
  // Check direct mapping first
  if (ESPN_TO_APP[espnName]) {
    return ESPN_TO_APP[espnName];
  }

  // Check if the ESPN name already matches an app team name
  if (APP_TEAMS.has(espnName)) {
    return espnName;
  }

  // Try stripping common suffixes ESPN adds (e.g., "Duke Blue Devils" -> "Duke")
  for (const appName of APP_TEAMS) {
    if (espnName.startsWith(appName)) {
      return appName;
    }
  }

  return null;
}
