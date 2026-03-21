// Maps the-odds-api team names to the app's internal team names.
// the-odds-api uses full team names (e.g., "Duke Blue Devils").

import { APP_TEAMS } from "./espn-mapping";

const ODDS_TO_APP: Record<string, string> = {
  "Virginia Commonwealth Rams": "VCU",
  "VCU Rams": "VCU",
  "UCF Knights": "UCF",
  "Central Florida Knights": "UCF",
  "Miami Hurricanes": "Miami (FL)",
  "Miami (FL) Hurricanes": "Miami (FL)",
  "Miami RedHawks": "Miami (OH)",
  "Miami (OH) RedHawks": "Miami (OH)",
  "Michigan State Spartans": "Michigan State",
  "Saint Louis Billikens": "St. Louis",
  "St. John's Red Storm": "St. John's",
  "UConn Huskies": "UConn",
  "Connecticut Huskies": "UConn",
  "BYU Cougars": "BYU",
  "Brigham Young Cougars": "BYU",
  "North Carolina Tar Heels": "North Carolina",
  "UNC Tar Heels": "North Carolina",
  "High Point Panthers": "High Point",
  "Texas A&M Aggies": "Texas A&M",
  "Ohio State Buckeyes": "Ohio State",
  "Penn State Nittany Lions": "Penn State",
  "Iowa State Cyclones": "Iowa State",
  "Utah State Aggies": "Utah State",
  "Texas Tech Red Raiders": "Texas Tech",
  "Saint Mary's Gaels": "Saint Mary's",
  "Iowa Hawkeyes": "Iowa",
  "Santa Clara Broncos": "Santa Clara",
};

export function mapOddsTeamName(oddsName: string): string | null {
  // Check direct mapping first
  if (ODDS_TO_APP[oddsName]) {
    return ODDS_TO_APP[oddsName];
  }

  // Check if the name already matches an app team name
  if (APP_TEAMS.has(oddsName)) {
    return oddsName;
  }

  // Try stripping suffixes (e.g., "Duke Blue Devils" -> "Duke")
  for (const appName of APP_TEAMS) {
    if (oddsName.startsWith(appName)) {
      return appName;
    }
  }

  return null;
}
