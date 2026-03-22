"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  computePlayer,
  computeEdgeScore,
  predictPicks,
  FUT,
  WP,
  MAX_BB,
  BB_COST,
  BUY_IN,
  type PlayerRaw,
  type PlayerComputed,
  type DayConfig,
} from "@/lib/compute";
import type { OddsResponse } from "@/app/api/odds/route";
import playersData from "@/data/players.json";
import resultsData from "@/data/results.json";

const PERSONAL_PW = "trevorNOVA";

const PLAYERS: PlayerRaw[] = playersData as PlayerRaw[];
const INITIAL_TEAM_RESULTS: Record<string, Record<string, string>> =
  resultsData.teamResults;
const INITIAL_SCORES: Record<string, Record<string, string>> = resultsData.scores;
const DAYS: DayConfig[] = resultsData.days as DayConfig[];

// Schedule data — used by both Schedule tab and Edge Lab
const SCHEDULE_DAYS = [
  {
    dayId: "day3",
    label: "SAT 3/21 — Round of 32",
    sub: "Advancing: 1 pick · Buy-back: 4 picks",
    games: [
      { t: "12:10 PM", m: "(1) Michigan vs (9) St. Louis", teams: ["Michigan", "St. Louis"] },
      { t: "2:45 PM", m: "(3) Michigan State vs (6) Louisville", teams: ["Michigan State", "Louisville"] },
      { t: "5:15 PM", m: "(1) Duke vs (9) TCU", teams: ["Duke", "TCU"] },
      { t: "6:10 PM", m: "(2) Houston vs (10) Texas A&M", teams: ["Houston", "Texas A&M"] },
      { t: "7:10 PM", m: "(3) Gonzaga vs (11) Texas", teams: ["Gonzaga", "Texas"] },
      { t: "7:50 PM", m: "(3) Illinois vs (11) VCU", teams: ["Illinois", "VCU"] },
      { t: "8:45 PM", m: "(4) Nebraska vs (5) Vanderbilt", teams: ["Nebraska", "Vanderbilt"] },
      { t: "9:45 PM", m: "(4) Arkansas vs (12) High Point", teams: ["Arkansas", "High Point"] },
    ],
  },
  {
    dayId: "day4",
    label: "SUN 3/22 — Round of 32",
    sub: "Advancing: 1 pick · Buy-back: 4 picks · ⚠ LAST BUY-BACK DAY",
    games: [
      { t: "12:10 PM", m: "(2) Purdue vs (7) Miami (FL)", teams: ["Purdue", "Miami (FL)"] },
      { t: "2:45 PM", m: "(2) Iowa State vs (7) Kentucky", teams: ["Iowa State", "Kentucky"] },
      { t: "5:15 PM", m: "(4) Kansas vs (5) St. John's", teams: ["Kansas", "St. John's"] },
      { t: "6:10 PM", m: "(3) Virginia vs (6) Tennessee", teams: ["Virginia", "Tennessee"] },
      { t: "7:10 PM", m: "(1) Florida vs (9) Iowa", teams: ["Florida", "Iowa"] },
      { t: "7:50 PM", m: "(1) Arizona vs (9) Utah State", teams: ["Arizona", "Utah State"] },
      { t: "8:45 PM", m: "(2) UConn vs (7) UCLA", teams: ["UConn", "UCLA"] },
      { t: "9:45 PM", m: "(4) Alabama vs (5) Texas Tech", teams: ["Alabama", "Texas Tech"] },
    ],
  },
];

// ── UI Atoms ──

function Badge({ type }: { type: string }) {
  const m: Record<string, { bg: string; c: string; t: string }> = {
    survived: { bg: "#052e16", c: "#4ade80", t: "ALIVE" },
    out: { bg: "#2a0a0a", c: "#f87171", t: "OUT" },
    eliminated: { bg: "#2a0a0a", c: "#f87171", t: "ELIM TODAY" },
    pending: { bg: "#1a1a2e", c: "#94a3b8", t: "PENDING" },
    bb: { bg: "#3b2f08", c: "#fbbf24", t: "BUY-BACK" },
  };
  const s = m[type] || m.pending;
  return (
    <span
      style={{ background: s.bg, color: s.c }}
      className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide"
    >
      {s.t}
    </span>
  );
}

function Pill({
  team,
  result,
  dim,
}: {
  team: string;
  result?: string;
  dim?: boolean;
}) {
  const c: Record<string, { bg: string; c: string; b: string }> = {
    won: { bg: "#052e16", c: "#4ade80", b: "#166534" },
    lost: { bg: "#2a0a0a", c: "#f87171", b: "#7f1d1d" },
    in_progress: { bg: "#1a1a00", c: "#fbbf24", b: "#854d0e" },
    scheduled: { bg: "#0f172a", c: "#94a3b8", b: "#334155" },
    pending: { bg: "#0f172a", c: "#cbd5e1", b: "#334155" },
  };
  const s = c[result || "pending"] || c.pending;
  const icon =
    result === "won"
      ? "\u2713 "
      : result === "lost"
        ? "\u2717 "
        : result === "in_progress"
          ? "\u25c9 "
          : "";
  return (
    <span
      style={{
        background: s.bg,
        color: s.c,
        border: `1px solid ${s.b}`,
        opacity: dim ? 0.4 : 1,
        textDecoration: result === "lost" ? "line-through" : "none",
      }}
      className="inline-flex items-center px-2 py-0.5 rounded-2xl text-[11px] font-semibold whitespace-nowrap"
    >
      {icon}
      {team}
    </span>
  );
}

function TBadge({ tier }: { tier: number }) {
  const m: Record<number, { l: string; bg: string; c: string }> = {
    1: { l: "SAVE", bg: "#7c3aed", c: "#fff" },
    2: { l: "SAVE", bg: "#6d28d9", c: "#ddd6fe" },
    3: { l: "FLEX", bg: "#1e40af", c: "#93c5fd" },
    4: { l: "USE NOW", bg: "#166534", c: "#4ade80" },
    5: { l: "BURN", bg: "#065f46", c: "#34d399" },
  };
  const s = m[tier] || m[4];
  return (
    <span
      style={{ background: s.bg, color: s.c }}
      className="px-1.5 py-px rounded text-[9px] font-bold"
    >
      {s.l}
    </span>
  );
}

// ── Row style helper ──
function rowStyle(hl: boolean, dn: boolean, alive: boolean = false) {
  return {
    background: dn ? "#1a0808" : alive ? "#03160a" : hl ? "#140a24" : "#0a0f1a",
    border: `1px solid ${dn ? "#7f1d1d" : alive ? "#166534" : hl ? "#7c3aed" : "#1a2030"}`,
  };
}

const cardClass = "bg-[#0f1520] border border-[#1e293b] rounded-lg p-3.5 mb-3";

// ── MAIN APP ──

export default function App() {
  const [mode, setMode] = useState("shared");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState("Dashboard");

  // Live score state — initialized from static data for instant render
  const [teamResults, setTeamResults] = useState(INITIAL_TEAM_RESULTS);
  const [scores, setScores] = useState(INITIAL_SCORES);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [hasLiveGames, setHasLiveGames] = useState(true);

  // Odds state — manual refresh only
  const [oddsData, setOddsData] = useState<OddsResponse | null>(null);
  const [oddsLoading, setOddsLoading] = useState(false);

  const fetchOdds = useCallback(async () => {
    setOddsLoading(true);
    try {
      const res = await fetch("/api/odds");
      const data: OddsResponse = await res.json();
      setOddsData(data);
    } catch (e) {
      console.error("Odds fetch failed:", e);
    } finally {
      setOddsLoading(false);
    }
  }, []);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch("/api/live-scores");
      const data = await res.json();
      setTeamResults(data.teamResults);
      setScores(data.scores);
      setLastFetched(data.lastFetched);
      setHasLiveGames(data.hasLiveGames);
    } catch (e) {
      console.error("Score fetch failed:", e);
    }
  }, []);

  useEffect(() => {
    fetchScores(); // initial fetch
    const interval = setInterval(fetchScores, hasLiveGames ? 30000 : 300000);
    return () => clearInterval(interval);
  }, [fetchScores, hasLiveGames]);

  const isPersonal = mode === "personal";

  const handleModeToggle = () => {
    if (isPersonal) {
      setMode("shared");
      setTab("Dashboard");
    } else {
      setMode("pw_prompt");
    }
  };

  const handlePwSubmit = () => {
    if (pwInput === PERSONAL_PW) {
      setMode("personal");
      setTab("Dashboard");
      setPwError(false);
      setPwInput("");
    } else {
      setPwError(true);
    }
  };

  const TABS = isPersonal
    ? [
        "Dashboard",
        "Day 4 (Live)",
        "Used Teams",
        "Schedule",
        "Edge Lab",
        "Money",
        "Day 1",
        "Day 2",
        "Day 3",
      ]
    : [
        "Dashboard",
        "Day 4 (Live)",
        "Used Teams",
        "Schedule",
        "Money",
        "Day 1",
        "Day 2",
        "Day 3",
      ];

  const players = useMemo(
    () => PLAYERS.map((p) => computePlayer(p, teamResults, DAYS)),
    [teamResults]
  );
  const active = players.filter((p) => !p.isPermElim);
  const pot = players.reduce((s, p) => s + p.money, 0);
  const trevor = players.find((p) => p.me);

  const teamMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    active.forEach((p) => {
      p.usedTeams.forEach((t) => {
        if (!m[t]) m[t] = [];
        m[t].push(p.n);
      });
    });
    return m;
  }, [active]);

  const day2Freq = useMemo(() => {
    const f: Record<string, number> = {};
    active.forEach((p) => {
      const d2 = p.history.find((e) => e.dayId === "day2");
      d2?.picks.forEach((t) => {
        f[t] = (f[t] || 0) + 1;
      });
    });
    return Object.entries(f).sort((a, b) => b[1] - a[1]);
  }, [active]);

  const day3Freq = useMemo(() => {
    const f: Record<string, number> = {};
    active.forEach((p) => {
      const d3 = p.history.find((e) => e.dayId === "day3");
      d3?.picks.forEach((t) => {
        f[t] = (f[t] || 0) + 1;
      });
    });
    return Object.entries(f).sort((a, b) => b[1] - a[1]);
  }, [active]);

  const day4Freq = useMemo(() => {
    const f: Record<string, number> = {};
    active.forEach((p) => {
      const d4 = p.history.find((e) => e.dayId === "day4");
      d4?.picks.forEach((t) => {
        f[t] = (f[t] || 0) + 1;
      });
    });
    return Object.entries(f).sort((a, b) => b[1] - a[1]);
  }, [active]);

  const edge = useMemo(() => {
    if (!isPersonal || !trevor) return [];

    // Historical usage (for reference)
    const ou: Record<string, number> = {};
    const opponents = active.filter((p) => !p.me);
    opponents.forEach((p) => {
      p.usedTeams.forEach((t) => {
        ou[t] = (ou[t] || 0) + 1;
      });
    });

    // Predicted picks for each schedule day
    const allEstPicks: Record<string, number> = {};
    const allDayTeams = new Set<string>();
    for (const day of SCHEDULE_DAYS) {
      const dayTeams = day.games.flatMap((g) => g.teams);
      dayTeams.forEach((t) => allDayTeams.add(t));
      const ep = predictPicks(opponents, dayTeams, (p) => p.nextPicksNeeded || 1);
      for (const [t, v] of Object.entries(ep)) {
        allEstPicks[t] = v;
      }
    }

    const tot = opponents.length;
    return Object.keys(FUT)
      .filter((t) => !trevor.usedTeams.has(t))
      .map((t) => {
        const f = FUT[t] || { dr: 0.3, t: 4, o: "N/A" };
        const ep = allEstPicks[t] ?? 0;
        // Predicted uniqueness for teams playing today; historical for others
        const u = allDayTeams.has(t)
          ? 1 - Math.min(ep / tot, 1)
          : 1 - (ou[t] || 0) / tot;
        const oddsTeam = oddsData?.teams?.[t];

        const { score, components } = computeEdgeScore(t, {
          impliedWinProb: oddsTeam?.impliedWinProb ?? null,
          deepRunProb: f.dr,
          uniqueness: u,
          sharpMoney: oddsTeam?.sharp?.sharpMoney ?? null,
          systems: oddsTeam?.sharp?.systems ?? null,
          spread: oddsTeam?.spread ?? null,
        });

        // Determine signal: bull/bear/neutral
        const wp = oddsTeam?.impliedWinProb ?? WP[t] ?? 0.5;
        const sharp = oddsTeam?.sharp?.sharpMoney ?? null;
        let signal: "bull" | "bear" | "neutral" = "neutral";
        if (sharp !== null && sharp >= 65 && wp >= 0.7) signal = "bull";
        else if (sharp !== null && sharp < 40) signal = "bear";
        else if (wp < 0.4) signal = "bear";

        return {
          team: t,
          wp,
          dr: f.dr,
          on: ou[t] || 0,
          estPicks: ep,
          u,
          sc: score,
          tier: f.t || 4,
          odds: f.o || "N/A",
          moneyline: oddsTeam?.moneyline ?? null,
          spread: oddsTeam?.spread ?? null,
          opponent: oddsTeam?.opponent ?? null,
          sharpMoney: oddsTeam?.sharp?.sharpMoney ?? null,
          systems: oddsTeam?.sharp?.systems ?? null,
          signal,
          components,
          liveOdds: !!oddsTeam?.impliedWinProb,
        };
      })
      .sort((a, b) => b.sc - a.sc);
  }, [isPersonal, trevor, active, oddsData]);

  // Per-day edge: filter edge list to teams playing each schedule day
  const edgeByDay = useMemo(() => {
    const result: Record<string, typeof edge> = {};
    for (const day of SCHEDULE_DAYS) {
      const dayTeams = new Set(day.games.flatMap((g) => g.teams));
      result[day.dayId] = edge.filter((t) => dayTeams.has(t.team));
    }
    return result;
  }, [edge]);

  // Recommended picks per day
  const recommendedByDay = useMemo(() => {
    if (!trevor) return {} as Record<string, typeof edge>;
    const result: Record<string, typeof edge> = {};
    for (const day of SCHEDULE_DAYS) {
      const pool = edgeByDay[day.dayId] || [];
      if (pool.length === 0) continue;
      const isFirstDay = day === SCHEDULE_DAYS[0];
      const n = isFirstDay ? (trevor.nextPicksNeeded || 1) : 1;

      const useNow = pool.filter((t) => t.tier >= 4 && t.wp >= 0.5).sort((a, b) => b.sc - a.sc);
      const flex = pool.filter((t) => t.tier === 3 && t.wp >= 0.5).sort((a, b) => b.sc - a.sc);
      const save = pool.filter((t) => t.tier <= 2).sort((a, b) => b.sc - a.sc);

      const picks: typeof pool = [];
      for (const t of useNow) { if (picks.length >= n) break; picks.push(t); }
      for (const t of flex) { if (picks.length >= n) break; picks.push(t); }
      for (const t of save) { if (picks.length >= n) break; picks.push(t); }
      result[day.dayId] = picks;
    }
    return result;
  }, [trevor, edgeByDay]);

  // ── Password Prompt ──
  if (mode === "pw_prompt") {
    return (
      <div className="font-mono bg-[#080c14] text-slate-200 min-h-screen flex items-center justify-center">
        <div className={`${cardClass} max-w-[360px] text-center !p-8`}>
          <div className="text-4xl mb-3">&#128274;</div>
          <h2 className="text-base font-extrabold text-slate-50 mb-1">
            Personal Mode
          </h2>
          <p className="text-[11px] text-slate-500 mb-5">
            Enter password to access strategy tools
          </p>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => {
              setPwInput(e.target.value);
              setPwError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handlePwSubmit();
            }}
            placeholder="Password"
            className="w-full px-3.5 py-2.5 bg-[#0a0f1a] rounded-md text-slate-200 text-sm font-mono outline-none mb-2"
            style={{
              border: `1px solid ${pwError ? "#ef4444" : "#1e293b"}`,
            }}
          />
          {pwError && (
            <p className="text-[11px] text-red-500 mb-2">
              Incorrect password
            </p>
          )}
          <div className="flex gap-2 justify-center mt-2">
            <button
              onClick={() => {
                setMode("shared");
                setPwInput("");
                setPwError(false);
              }}
              className="px-4 py-2 bg-slate-800 text-slate-400 border-none rounded text-[11px] font-semibold cursor-pointer font-mono"
            >
              Cancel
            </button>
            <button
              onClick={handlePwSubmit}
              className="px-4 py-2 bg-violet-600 text-white border-none rounded text-[11px] font-semibold cursor-pointer font-mono"
            >
              Unlock
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getD2Result = (t: string) => teamResults.day2?.[t] || "pending";
  const getD3Result = (t: string) => teamResults.day3?.[t] || "pending";
  const getD4Result = (t: string) => teamResults.day4?.[t] || "pending";

  return (
    <div className="font-mono bg-[#080c14] text-slate-200 min-h-screen">
      {/* Header */}
      <div
        className="border-b border-slate-800 px-5 pt-4"
        style={{
          background: "linear-gradient(135deg, #0c1220, #140a24)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl">&#127936;</span>
            <h1 className="m-0 text-lg font-extrabold text-slate-50">
              SURVIVOR POOL 2026
            </h1>
          </div>
          <button
            onClick={handleModeToggle}
            className="border-none px-3 py-1 rounded text-[10px] font-bold cursor-pointer font-mono"
            style={{
              background: isPersonal ? "#7c3aed" : "#1e293b",
              color: isPersonal ? "#fff" : "#94a3b8",
            }}
          >
            {isPersonal ? "\ud83d\udd13 Personal" : "\ud83d\udd12 Admin"}
          </button>
        </div>
        <p className="mt-0.5 text-[11px] text-slate-600">
          {active.length} alive &middot;{" "}
          {players.filter((p) => p.isPermElim).length} out &middot; Day 4 Sun
          3/22 &middot; Pot: ${pot}
          {lastFetched && (
            <span className="ml-2">
              &middot;{" "}
              <span className={hasLiveGames ? "text-green-500" : "text-slate-600"}>
                {hasLiveGames ? "\u25c9 Live" : "Final"}{" "}
                {new Date(lastFetched).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </span>
          )}
        </p>
        <div className="flex gap-0 mt-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="border-none px-3 py-2 text-[11px] font-semibold cursor-pointer font-mono whitespace-nowrap"
              style={{
                background: tab === t ? "#1a2030" : "transparent",
                color: tab === t ? "#f8fafc" : "#475569",
                borderBottom:
                  tab === t
                    ? "2px solid #a78bfa"
                    : "2px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 max-w-[960px] mx-auto">
        {/* ═══ DASHBOARD ═══ */}
        {tab === "Dashboard" && (
          <div>
            {isPersonal && trevor && (
              <div
                className="rounded-lg p-3.5 mb-3"
                style={{
                  background:
                    "linear-gradient(135deg, #140a24, #0f1520)",
                  border: "1px solid #7c3aed",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-bold text-violet-400">
                    &#128100; TREVOR (YOU)
                  </span>
                  <Badge type={trevor.currentStatus} />
                  <span className="text-[10px] text-slate-500 ml-auto">
                    BB: {trevor.totalBB}/{MAX_BB} &middot; Paid: $
                    {trevor.money}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mb-1.5">
                  Day 1: BB#1 &middot; Day 2: BB#2 &middot; Day 3: Gonzaga &#10007; &rarr; Eliminated
                </div>
                {trevor.nextPicksNeeded > 0 ? (
                  <div className="text-[11px] text-amber-400 font-semibold">
                    {trevor.nextIsBuyBack
                      ? `Today: Buy back in (BB ${trevor.totalBB + 1}/${MAX_BB}, +$${BB_COST}) with ${trevor.nextPicksNeeded} picks — LAST BUY-BACK DAY`
                      : `Today: Need ${trevor.nextPicksNeeded} pick${trevor.nextPicksNeeded !== 1 ? "s" : ""}`}
                  </div>
                ) : trevor.isPermElim ? (
                  <div className="text-[11px] text-red-500 font-semibold">
                    Eliminated &mdash; no more buy-backs available.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {trevor.history
                      .find((e) => e.dayId === "day4")
                      ?.picks.map((t) => (
                        <Pill key={t} team={t} result={getD4Result(t)} />
                      ))}
                  </div>
                )}
              </div>
            )}

            {day4Freq.length > 0 && (
              <div className={cardClass}>
                <h3 className="m-0 mb-2 text-[11px] text-slate-500 tracking-wider">
                  DAY 4 TEAM POPULARITY
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {day4Freq.map(([t, c]) => {
                    const r = getD4Result(t);
                    return (
                      <div
                        key={t}
                        className="bg-[#0a0f1a] border border-[#1a2030] rounded px-2.5 py-1 flex items-center gap-1.5"
                      >
                        <span
                          className="text-[13px] font-extrabold"
                          style={{
                            color:
                              c >= 8
                                ? "#ef4444"
                                : c >= 4
                                  ? "#fbbf24"
                                  : "#4ade80",
                          }}
                        >
                          {c}
                        </span>
                        <span className="text-[11px] text-slate-300">
                          {t}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{
                            color:
                              r === "won"
                                ? "#4ade80"
                                : r === "lost"
                                  ? "#f87171"
                                  : r === "in_progress"
                                    ? "#fbbf24"
                                    : "#475569",
                          }}
                        >
                          {r === "won"
                            ? "\u2713"
                            : r === "lost"
                              ? "\u2717"
                              : r === "in_progress"
                                ? "\u25c9"
                                : "\u00b7"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={cardClass}>
              <h3 className="m-0 mb-2 text-[11px] text-slate-500 tracking-wider">
                ALL PARTICIPANTS &mdash; DAY 4
              </h3>
              <div className="flex flex-col gap-1">
                {players.map((p, i) => {
                  const d4 = p.history.find((e) => e.dayId === "day4");
                  const st = p.currentStatus;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-md flex-wrap"
                      style={rowStyle(
                        isPersonal && p.me,
                        st === "eliminated" || st === "out",
                        st === "survived"
                      )}
                    >
                      <span
                        className="text-xs font-bold min-w-[90px]"
                        style={{
                          color:
                            isPersonal && p.me
                              ? "#a78bfa"
                              : "#e2e8f0",
                        }}
                      >
                        {p.n}
                      </span>
                      <Badge type={st} />
                      {p.totalBB > 0 && (
                        <span className="text-[9px] text-amber-400 bg-[#3b2f08] px-1.5 py-px rounded">
                          BB&times;{p.totalBB}
                        </span>
                      )}
                      {p.dupes.length > 0 && (
                        <span className="text-[9px] text-red-500 font-bold">
                          &#9888; DUPE: {p.dupes.join(",")}
                        </span>
                      )}
                      {p.nextPicksNeeded > 0 && !d4 && (
                        <span className="text-[9px] text-blue-400 bg-[#1e2a4a] px-1.5 py-px rounded">
                          Need {p.nextPicksNeeded} pick{p.nextPicksNeeded !== 1 ? "s" : ""}
                          {p.nextIsBuyBack ? " (BB)" : ""}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1 ml-auto">
                        {d4?.picks.map((t) => (
                          <Pill
                            key={t}
                            team={t}
                            result={getD4Result(t)}
                          />
                        ))}
                        {!d4 && !p.isPermElim && (
                          <span className="text-[10px] text-slate-600">
                            No picks yet
                          </span>
                        )}
                        {p.isPermElim && (
                          <span className="text-[10px] text-slate-600">
                            Out
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ DAY 1 ═══ */}
        {tab === "Day 1" && (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-1">
              Day 1 &mdash; Thursday 3/19
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">
              Everyone picks 2. One loss = eliminated.
            </p>
            {players.map((p, i) => {
              const d1 = p.history.find((e) => e.dayId === "day1");
              const survived = p.dayResults.day1 === "survived";
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md flex-wrap mb-0.5"
                  style={rowStyle(isPersonal && p.me, !survived)}
                >
                  <span className="text-base">
                    {survived ? "\u2705" : "\u274c"}
                  </span>
                  <span
                    className="text-xs font-bold min-w-[100px]"
                    style={{
                      color:
                        isPersonal && p.me ? "#a78bfa" : "#e2e8f0",
                    }}
                  >
                    {p.n}
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {d1?.picks.map((t) => (
                      <Pill
                        key={t}
                        team={t}
                        result={
                          teamResults.day1[t] === "won"
                            ? "won"
                            : "lost"
                        }
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-600 ml-auto">
                    {!survived && !p.isPermElim
                      ? "\u2192 Bought back"
                      : p.isPermElim
                        ? "DONE"
                        : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ DAY 2 ═══ */}
        {tab === "Day 2" && (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-1">
              Day 2 &mdash; Friday 3/20
            </h2>
            <p className="text-[11px] text-slate-500 mb-2">
              Survivors: 2 picks &middot; Buy-backs: 4 picks &middot; ONE
              loss = eliminated
            </p>
            {players.filter((p) => p.history.some((e) => e.dayId === "day2")).map((p, i) => {
              const d2 = p.history.find((e) => e.dayId === "day2");
              const st = p.dayResults.day2 || "pending";
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md flex-wrap mb-0.5"
                  style={rowStyle(
                    isPersonal && p.me,
                    st === "eliminated"
                  )}
                >
                  <span className="text-base">
                    {st === "survived" ? "\u2705" : "\u274c"}
                  </span>
                  <span
                    className="text-xs font-bold min-w-[90px]"
                    style={{
                      color:
                        isPersonal && p.me ? "#a78bfa" : "#e2e8f0",
                    }}
                  >
                    {p.n}
                  </span>
                  {d2?.buyBack && (
                    <span className="text-[9px] text-amber-400 bg-[#3b2f08] px-1.5 py-px rounded">
                      BB
                    </span>
                  )}
                  <div className="flex gap-1 flex-wrap ml-auto">
                    {d2?.picks.map((t) => (
                      <Pill
                        key={t}
                        team={t}
                        result={getD2Result(t)}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-600">
                    {st === "eliminated" && !p.isPermElim
                      ? "\u2192 Buy-back"
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ DAY 3 LIVE ═══ */}
        {/* ═══ DAY 3 ═══ */}
        {tab === "Day 3" && (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-1">
              Day 3 &mdash; Saturday 3/21
            </h2>
            <p className="text-[11px] text-slate-500 mb-2">
              Survivors: 1 pick &middot; Buy-backs: 4 picks &middot; ONE
              loss = eliminated
            </p>
            {players.filter((p) => p.history.some((e) => e.dayId === "day3")).map((p, i) => {
              const d3 = p.history.find((e) => e.dayId === "day3");
              const st = p.dayResults.day3 || "pending";
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md flex-wrap mb-0.5"
                  style={rowStyle(
                    isPersonal && p.me,
                    st === "eliminated"
                  )}
                >
                  <span className="text-base">
                    {st === "survived" ? "\u2705" : "\u274c"}
                  </span>
                  <span
                    className="text-xs font-bold min-w-[90px]"
                    style={{
                      color:
                        isPersonal && p.me ? "#a78bfa" : "#e2e8f0",
                    }}
                  >
                    {p.n}
                  </span>
                  {d3?.buyBack && (
                    <span className="text-[9px] text-amber-400 bg-[#3b2f08] px-1.5 py-px rounded">
                      BB
                    </span>
                  )}
                  <div className="flex gap-1 flex-wrap ml-auto">
                    {d3?.picks.map((t) => (
                      <Pill
                        key={t}
                        team={t}
                        result={getD3Result(t)}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-600">
                    {st === "eliminated" && !p.isPermElim
                      ? "\u2192 Buy-back"
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ DAY 4 LIVE ═══ */}
        {tab === "Day 4 (Live)" && (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-1">
              Day 4 &mdash; Sunday 3/22 (TODAY)
            </h2>
            <p className="text-[11px] text-slate-500 mb-2">
              Survivors: 1 pick &middot; Buy-backs: 4 picks &middot; ONE
              loss = eliminated &middot; &#9888; LAST BUY-BACK DAY
            </p>
            <div className={`${cardClass} overflow-x-auto`}>
              <h3 className="m-0 mb-2 text-[10px] text-slate-600">
                GAME STATUS
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-1.5">
                {Object.entries(scores.day4 || {}).map(([t, s]) => {
                  const r = getD4Result(t);
                  return (
                    <div
                      key={t}
                      className="rounded px-2 py-1.5"
                      style={{
                        background:
                          r === "won"
                            ? "#041a0a"
                            : r === "lost"
                              ? "#1a0808"
                              : r === "in_progress"
                                ? "#1a1800"
                                : "#0a0f1a",
                        border: `1px solid ${r === "won" ? "#166534" : r === "lost" ? "#7f1d1d" : r === "in_progress" ? "#854d0e" : "#1a2030"}`,
                      }}
                    >
                      <div
                        className="text-[11px] font-bold"
                        style={{
                          color:
                            r === "won"
                              ? "#4ade80"
                              : r === "lost"
                                ? "#f87171"
                                : r === "in_progress"
                                  ? "#fbbf24"
                                  : "#94a3b8",
                        }}
                      >
                        {r === "in_progress" ? "\u25c9 " : ""}
                        {t}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {s}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(scores.day4 || {}).length === 0 && (
                  <p className="text-[10px] text-slate-600 col-span-full">
                    Games start at 12:10 PM ET. Live scores will appear here.
                  </p>
                )}
              </div>
            </div>
            {active.map((p, i) => {
              const d4 = p.history.find((e) => e.dayId === "day4");
              const st = d4 ? (p.dayResults.day4 || "pending") : "";
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md flex-wrap mb-0.5"
                  style={rowStyle(
                    isPersonal && p.me,
                    st === "eliminated"
                  )}
                >
                  <span
                    className="text-xs font-bold min-w-[90px]"
                    style={{
                      color:
                        isPersonal && p.me ? "#a78bfa" : "#e2e8f0",
                    }}
                  >
                    {p.n}
                  </span>
                  {d4?.buyBack && (
                    <span className="text-[9px] text-amber-400 bg-[#3b2f08] px-1.5 py-px rounded">
                      BB
                    </span>
                  )}
                  {d4 && <Badge type={st || "pending"} />}
                  <div className="flex gap-1 flex-wrap ml-auto">
                    {d4?.picks.map((t) => (
                      <Pill
                        key={t}
                        team={t}
                        result={getD4Result(t)}
                      />
                    ))}
                    {!d4 && !p.isPermElim && (
                      <span className="text-[9px] text-blue-400 bg-[#1e2a4a] px-1.5 py-px rounded">
                        Need {p.nextPicksNeeded || 1} pick{(p.nextPicksNeeded || 1) !== 1 ? "s" : ""}
                        {p.nextIsBuyBack ? " (BB)" : ""}
                      </span>
                    )}
                    {p.isPermElim && (
                      <span className="text-[10px] text-slate-600">Out</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ USED TEAMS ═══ */}
        {tab === "Used Teams" && (() => {
          // Teams eliminated from the tournament (lost in any round)
          const elimTeams = new Set<string>();
          Object.values(teamResults).forEach((dayR) => {
            if (dayR) Object.entries(dayR).forEach(([t, r]) => { if (r === "lost") elimTeams.add(t); });
          });
          return (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-1">
              Used Teams Tracker
            </h2>
            <p className="text-[11px] text-slate-500 mb-3.5">
              Cannot pick a team you&apos;ve already used.
              <span className="text-red-400 ml-1.5">Red = eliminated from tournament</span>
            </p>
            <div className={cardClass}>
              <h3 className="m-0 mb-2.5 text-[11px] text-slate-500 tracking-wider">
                BY PLAYER
              </h3>
              {players
                .filter((p) => !p.isPermElim)
                .map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2.5 py-1.5 mb-0.5 rounded flex-wrap"
                    style={{
                      background:
                        isPersonal && p.me
                          ? "#140a24"
                          : "#0a0f1a",
                      border: `1px solid ${isPersonal && p.me ? "#7c3aed" : "#1a2030"}`,
                    }}
                  >
                    <span
                      className="text-xs font-bold min-w-[95px]"
                      style={{
                        color:
                          isPersonal && p.me
                            ? "#a78bfa"
                            : "#e2e8f0",
                      }}
                    >
                      {p.n}
                    </span>
                    <span className="text-[10px] text-slate-600 min-w-[16px]">
                      {p.usedTeams.size}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {p.allPicks.map((pk, j) => {
                        const isElimFromTourney = elimTeams.has(pk.team);
                        return (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px]"
                          style={{
                            background: isElimFromTourney ? "#1a0808" : "#0f172a",
                            border: `1px solid ${isElimFromTourney ? "#7f1d1d" : "#1e293b"}`,
                            color: isElimFromTourney ? "#f87171" : "#cbd5e1",
                            textDecoration: isElimFromTourney ? "line-through" : "none",
                          }}
                        >
                          {pk.team}
                          <span className="text-[8px]" style={{ color: isElimFromTourney ? "#991b1b" : "#475569" }}>
                            {pk.dayId.replace("day", "D")}
                          </span>
                        </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              <div className="mt-2.5 pt-2.5 border-t border-slate-800">
                <span className="text-[10px] text-slate-600">
                  ELIMINATED:
                </span>
                {players
                  .filter((p) => p.isPermElim)
                  .map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-1.5 mt-0.5 rounded bg-[#0a0a0a] opacity-50"
                    >
                      <span className="text-[11px] font-semibold text-red-400 min-w-[95px]">
                        {p.n}
                      </span>
                      <div className="flex gap-1">
                        {[...p.usedTeams].map((t) => (
                          <span
                            key={t}
                            className="text-[10px] text-slate-500 bg-[#1a1a1a] px-1.5 py-0.5 rounded-lg"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className={cardClass}>
              <h3 className="m-0 mb-2.5 text-[11px] text-slate-500 tracking-wider">
                BY TEAM
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-1.5">
                {Object.entries(teamMap)
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([team, pls]) => {
                    const isElimFromTourney = elimTeams.has(team);
                    return (
                    <div
                      key={team}
                      className="rounded-md px-2.5 py-2"
                      style={{
                        background: isElimFromTourney ? "#0a0808" : "#0a0f1a",
                        border: `1px solid ${isElimFromTourney ? "#3b1111" : "#1a2030"}`,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="text-xs font-bold"
                          style={{
                            color: isElimFromTourney ? "#f87171" : "#e2e8f0",
                            textDecoration: isElimFromTourney ? "line-through" : "none",
                          }}
                        >
                          {team}
                        </span>
                        <span
                          className="text-[11px] font-extrabold"
                          style={{
                            color:
                              pls.length >= 8
                                ? "#ef4444"
                                : pls.length >= 4
                                  ? "#fbbf24"
                                  : "#4ade80",
                          }}
                        >
                          {pls.length}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-relaxed">
                        {pls.join(", ")}
                      </div>
                    </div>
                  );
                  })}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ═══ SCHEDULE ═══ */}
        {tab === "Schedule" && (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-3">
              Upcoming Games
            </h2>
            {[
              {
                label: "SUN 3/22 \u2014 Round of 32",
                sub: "Advancing: 1 pick \u00b7 Buy-back: 4 picks \u00b7 \u26a0 LAST BUY-BACK DAY",
                games: [
                  { t: "12:10 PM", m: "(2) Purdue vs (7) Miami (FL)" },
                  { t: "2:45 PM", m: "(2) Iowa State vs (7) Kentucky" },
                  { t: "5:15 PM", m: "(4) Kansas vs (5) St. John's" },
                  { t: "6:10 PM", m: "(3) Virginia vs (6) Tennessee" },
                  { t: "7:10 PM", m: "(1) Florida vs (9) Iowa" },
                  { t: "7:50 PM", m: "(1) Arizona vs (9) Utah State" },
                  { t: "8:45 PM", m: "(2) UConn vs (7) UCLA" },
                  { t: "9:45 PM", m: "(4) Alabama vs (5) Texas Tech" },
                ],
              },
            ].map((sec, si) => (
              <div key={si} className="mb-5">
                <h3 className="text-xs text-violet-400 mb-0.5">
                  {sec.label}
                </h3>
                <p className="text-[10px] text-slate-600 mb-2">
                  {sec.sub}
                </p>
                {sec.games.map((g, gi) => {
                  const teams = g.m
                    .replace(/\(\d+\)\s*/g, "")
                    .split(" vs ");
                  const t1 = teams[0]?.trim();
                  const t2 = teams[1]?.trim();
                  const u1 = teamMap[t1];
                  const u2 = teamMap[t2];
                  return (
                    <div
                      key={gi}
                      className="flex items-center gap-2.5 px-2.5 py-1.5 bg-[#0a0f1a] border border-[#1a2030] rounded mb-0.5 flex-wrap"
                    >
                      <span className="text-[10px] text-slate-600 min-w-[65px]">
                        {g.t}
                      </span>
                      <span className="text-[11px] text-slate-200 flex-1">
                        {g.m}
                      </span>
                      {(u1 || u2) && (
                        <div className="flex gap-1 flex-wrap">
                          {u1 && (
                            <span className="text-[9px] text-red-400 bg-[#1a0808] px-1.5 py-px rounded">
                              {t1}: {u1.length} used
                            </span>
                          )}
                          {u2 && (
                            <span className="text-[9px] text-red-400 bg-[#1a0808] px-1.5 py-px rounded">
                              {t2}: {u2.length} used
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ═══ EDGE LAB ═══ */}
        {tab === "Edge Lab" && isPersonal && trevor && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <h2 className="text-[15px] text-slate-50">
                Edge Lab
              </h2>
              <button
                onClick={fetchOdds}
                disabled={oddsLoading}
                className="text-[10px] px-2.5 py-1 rounded border border-violet-700 text-violet-400 hover:bg-violet-900/30 disabled:opacity-50"
              >
                {oddsLoading ? "Loading..." : "Refresh Odds"}
              </button>
            </div>
            {/* Status bar */}
            <div className="flex items-center gap-3 text-[9px] text-slate-600 mb-3">
              {oddsData && (
                <>
                  <span className="flex items-center gap-1">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        background: oddsData.fallback
                          ? "#f87171"
                          : "#4ade80",
                      }}
                    />
                    {oddsData.fallback
                      ? "Odds: fallback (no API)"
                      : `Odds: ${new Date(oddsData.lastOddsUpdate).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`}
                  </span>
                  {oddsData.creditsRemaining !== null && (
                    <span
                      style={{
                        color:
                          oddsData.creditsRemaining > 200
                            ? "#4ade80"
                            : oddsData.creditsRemaining > 50
                              ? "#fbbf24"
                              : "#f87171",
                      }}
                    >
                      Credits: {oddsData.creditsRemaining}
                    </span>
                  )}
                </>
              )}
              {!oddsData && (
                <span>Click &quot;Refresh Odds&quot; to load live data</span>
              )}
            </div>

            {/* ── Sunday Buy-Back Decision ── */}
            {(() => {
              const sundayDay = SCHEDULE_DAYS.find((d) => d.dayId === "day4");
              const dayEdge = edgeByDay[sundayDay?.dayId || ""] || [];
              const available = dayEdge.filter((t) => !trevor.usedTeams.has(t.team));
              const unavailable = dayEdge.filter((t) => trevor.usedTeams.has(t.team));
              const n = trevor.nextPicksNeeded || 4;

              // Build game matchup map: team → opponent (can't pick both sides)
              const gameOpponents: Record<string, string> = {};
              if (sundayDay) {
                for (const g of sundayDay.games) {
                  if (g.teams.length === 2) {
                    gameOpponents[g.teams[0]] = g.teams[1];
                    gameOpponents[g.teams[1]] = g.teams[0];
                  }
                }
              }

              // Helper: check if a pick set has game conflicts
              const hasConflict = (picks: typeof available) => {
                const teams = new Set(picks.map((p) => p.team));
                return picks.some((p) => {
                  const opp = gameOpponents[p.team];
                  return opp && teams.has(opp);
                });
              };

              // Greedy pick: take best by score, skipping game conflicts
              const greedyPick = (sorted: typeof available, count: number) => {
                const result: typeof available = [];
                const usedGames = new Set<string>();
                for (const t of sorted) {
                  if (result.length >= count) break;
                  const opp = gameOpponents[t.team];
                  const gameKey = [t.team, opp].sort().join("|");
                  if (usedGames.has(gameKey)) continue;
                  result.push(t);
                  if (opp) usedGames.add(gameKey);
                }
                return result;
              };

              // Build optimal combos of n picks from available teams
              const combos: { picks: typeof available; survProb: number; avgUniq: number; comboScore: number; savedDeep: typeof available }[] = [];
              const deepTeams = available.filter((t) => t.dr >= 0.7);
              const allAvail = available.filter((t) => t.wp > 0);

              if (allAvail.length >= n) {
                // Strategy 1: Max survival (pick highest WP, no game conflicts)
                const bySurvival = [...allAvail].sort((a, b) => b.wp - a.wp);
                const s1 = greedyPick(bySurvival, n);

                // Strategy 2: Burn expendable, save deep (prefer low depth teams)
                const byBurnFirst = [...allAvail]
                  .filter((t) => t.wp >= 0.4)
                  .sort((a, b) => {
                    const aScore = a.wp * (1 - a.dr * 0.5);
                    const bScore = b.wp * (1 - b.dr * 0.5);
                    return bScore - aScore;
                  });
                const s2 = greedyPick(byBurnFirst, n);

                // Strategy 3: Contrarian (maximize uniqueness while surviving)
                const byContrarian = [...allAvail]
                  .filter((t) => t.wp >= 0.35)
                  .sort((a, b) => {
                    const aScore = a.u * 0.5 + a.wp * 0.3 + (1 - a.dr) * 0.2;
                    const bScore = b.u * 0.5 + b.wp * 0.3 + (1 - b.dr) * 0.2;
                    return bScore - aScore;
                  });
                const s3 = greedyPick(byContrarian, n);

                [s1, s2, s3].forEach((picks) => {
                  if (picks.length < n) return;
                  if (hasConflict(picks)) return; // safety check
                  const survProb = picks.reduce((p, t) => p * t.wp, 1);
                  const avgUniq = picks.reduce((s, t) => s + t.u, 0) / picks.length;
                  const savedDeep = deepTeams.filter((dt) => !picks.some((p) => p.team === dt.team));
                  combos.push({
                    picks,
                    survProb,
                    avgUniq,
                    comboScore: survProb * (0.5 + avgUniq * 0.5),
                    savedDeep,
                  });
                });
              }

              // Deduplicate combos by team set
              const seen = new Set<string>();
              const uniqueCombos = combos.filter((c) => {
                const key = c.picks.map((p) => p.team).sort().join(",");
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              }).sort((a, b) => b.comboScore - a.comboScore);

              // Calculate: is buy-back worth it?
              const bestSurvival = uniqueCombos[0]?.survProb || 0;
              const remainingDays = 7; // approximate days left after Sunday
              const perDaySurvival = 0.85; // avg single-pick survival rate
              const overallWinProb = bestSurvival * Math.pow(perDaySurvival, remainingDays);
              const potSize = players.filter((p) => !p.isPermElim).length > 0
                ? players.reduce((s, p) => s + BUY_IN + p.totalBB * BB_COST, 0)
                : 0;
              const bbCost = BB_COST;
              const expectedValue = overallWinProb * potSize - bbCost;

              return (
                <>
              {/* Buy-back decision card */}
              <div
                className="rounded-lg p-3.5 mb-3"
                style={{ background: expectedValue > 0 ? "#0a1a0a" : "#1a0808", border: `1px solid ${expectedValue > 0 ? "#166534" : "#7f1d1d"}` }}
              >
                <h3 className="m-0 mb-2 text-[11px]" style={{ color: expectedValue > 0 ? "#4ade80" : "#f87171" }}>
                  SHOULD YOU BUY BACK? ({expectedValue > 0 ? "YES" : "MARGINAL"})
                </h3>
                <div className="text-[11px] text-slate-300 leading-6">
                  <p className="m-0 mb-1">
                    <span className="text-slate-500">Cost:</span> ${bbCost} (total invested: ${trevor.money + bbCost})
                    &middot; <span className="text-slate-500">Pot:</span> ${potSize}
                    &middot; <span className="text-slate-500">Field:</span> {active.length} players
                  </p>
                  <p className="m-0 mb-1">
                    <span className="text-slate-500">Best 4-pick survival today:</span>{" "}
                    <strong style={{ color: bestSurvival >= 0.6 ? "#4ade80" : bestSurvival >= 0.4 ? "#fbbf24" : "#f87171" }}>
                      {(bestSurvival * 100).toFixed(0)}%
                    </strong>
                    &middot; <span className="text-slate-500">Est. win pool:</span>{" "}
                    <strong className="text-slate-200">{(overallWinProb * 100).toFixed(1)}%</strong>
                  </p>
                  <p className="m-0 mb-1">
                    <span className="text-slate-500">Expected value:</span>{" "}
                    <strong style={{ color: expectedValue > 0 ? "#4ade80" : "#f87171" }}>
                      {expectedValue > 0 ? "+" : ""}{expectedValue.toFixed(0)} ({expectedValue > 0 ? "worth it" : "negative EV"})
                    </strong>
                  </p>
                  <p className="m-0 text-[10px] text-slate-600">
                    Key edge: You need 4 picks today but only 1/day after. The field mostly picks chalk &mdash;
                    your buy-back lets you burn expendable teams now and save deep-run teams for later when differentiation matters most.
                  </p>
                </div>
              </div>

              {/* Your situation */}
              <div
                className="rounded-lg p-3.5 mb-3"
                style={{ background: "#0a1420", border: "1px solid #1e3a5f" }}
              >
                <h3 className="m-0 mb-1.5 text-[11px] text-blue-400">
                  YOUR SITUATION &mdash; SUN 3/22 (LAST BUY-BACK DAY)
                </h3>
                <div className="text-[11px] text-slate-300 leading-6">
                  <p className="m-0 mb-1">
                    Need <strong className="text-amber-400">{n} picks</strong> to buy back
                    <span className="text-red-400"> (BB #{trevor.totalBB + 1}/{MAX_BB}, +${BB_COST})</span>
                    &middot; All {n} must win or you&apos;re out for good
                  </p>
                  <p className="m-0 mb-1">
                    <span className="text-slate-500">Can&apos;t pick ({unavailable.length}):</span>{" "}
                    <span className="text-red-400">{unavailable.map((t) => t.team).join(", ") || "none"}</span>
                  </p>
                  <p className="m-0 mb-1">
                    <span className="text-slate-500">Available ({available.length}):</span>{" "}
                    <span className="text-slate-400">{available.map((t) => t.team).join(", ")}</span>
                  </p>
                  <p className="m-0">
                    <span className="text-slate-500">Teams burned ({trevor.usedTeams.size}):</span>{" "}
                    <span className="text-slate-600">{[...trevor.usedTeams].join(", ")}</span>
                  </p>
                </div>
              </div>

              {/* Recommended combos */}
              {uniqueCombos.length > 0 && (
                <div
                  className="rounded-lg p-3.5 mb-3"
                  style={{ background: "#0a1a0a", border: "1px solid #166534" }}
                >
                  <h3 className="m-0 mb-2 text-[11px] text-green-400">
                    RECOMMENDED 4-PICK COMBOS
                  </h3>
                  <div className="flex flex-col gap-3">
                    {uniqueCombos.map((combo, ci) => (
                      <div key={ci} className="rounded p-2.5" style={{ background: ci === 0 ? "#0f2a0f" : "#0a0f0a", border: ci === 0 ? "1px solid #22c55e" : "1px solid #1a2030" }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-green-400 font-bold text-[12px]">
                            {ci === 0 ? "BEST" : ci === 1 ? "ALT 1" : "ALT 2"}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Survival: <strong style={{ color: combo.survProb >= 0.6 ? "#4ade80" : combo.survProb >= 0.4 ? "#fbbf24" : "#f87171" }}>
                              {(combo.survProb * 100).toFixed(0)}%
                            </strong>
                            &middot; Avg uniqueness: {(combo.avgUniq * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {combo.picks.map((t) => (
                            <span
                              key={t.team}
                              className="px-2 py-1 rounded text-[11px] font-semibold"
                              style={{
                                background: t.dr >= 0.7 ? "#1a0a08" : "#0a1a0a",
                                border: `1px solid ${t.dr >= 0.7 ? "#854d0e" : "#166534"}`,
                                color: t.dr >= 0.7 ? "#fbbf24" : "#4ade80",
                              }}
                            >
                              {t.team} ({(t.wp * 100).toFixed(0)}%)
                              <span className="text-[9px] ml-1" style={{ color: t.dr >= 0.7 ? "#92400e" : "#15803d" }}>
                                {t.dr >= 0.7 ? "DEEP" : t.dr >= 0.4 ? "MED" : "BURN"}
                              </span>
                            </span>
                          ))}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Saves for later: {combo.savedDeep.length > 0 ? combo.savedDeep.map((t) => t.team).join(", ") : "none"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Strategic insights */}
              {available.length > 0 && (
                <div
                  className="rounded-lg p-3.5 mb-3"
                  style={{ background: "#140a24", border: "1px solid #7c3aed" }}
                >
                  <h3 className="m-0 mb-1.5 text-[11px] text-violet-400">
                    STRATEGY INSIGHTS
                  </h3>
                  <div className="text-[11px] text-slate-300 leading-6">
                    {(() => {
                      const burnable = available.filter((t) => t.dr < 0.4 && t.wp >= 0.6);
                      const saveable = available.filter((t) => t.dr >= 0.7);
                      const contrarian = available.filter((t) => t.wp >= 0.55 && t.u >= 0.7).sort((a, b) => b.u - a.u);
                      const upsetBait = available.filter((t) => t.wp >= 0.7 && t.dr >= 0.7);
                      const chalky = available.filter((t) => t.estPicks >= 4).sort((a, b) => b.estPicks - a.estPicks);
                      return (
                        <>
                          {burnable.length > 0 && (
                            <p className="m-0 mb-1.5">
                              <span className="text-green-400">Burn now:</span>{" "}
                              {burnable.map((t) => `${t.team} (${(t.wp * 100).toFixed(0)}%, SHORT depth)`).join(", ")}.
                              {" "}These teams won&apos;t go deep &mdash; use them today while they&apos;re still alive.
                            </p>
                          )}
                          {saveable.length > 0 && (
                            <p className="m-0 mb-1.5">
                              <span className="text-amber-400">Save for later:</span>{" "}
                              {saveable.map((t) => `${t.team} (${t.odds})`).join(", ")}.
                              {" "}Deep-run contenders &mdash; save for days when you only need 1 pick and need differentiation.
                            </p>
                          )}
                          {upsetBait.length > 0 && (
                            <p className="m-0 mb-1.5">
                              <span className="text-cyan-400">Contrarian play (use deep teams NOW):</span>{" "}
                              {upsetBait.map((t) => `${t.team} (${(t.wp * 100).toFixed(0)}%)`).join(", ")}.
                              {" "}If a top seed loses in Sweet 16, everyone who saved them loses that option. You&apos;d already have banked the win.
                            </p>
                          )}
                          {contrarian.length > 0 && (
                            <p className="m-0 mb-1.5">
                              <span className="text-emerald-400">High-uniqueness picks:</span>{" "}
                              {contrarian.map((t) => `${t.team} (${(t.u * 100).toFixed(0)}% unique, ~${t.estPicks.toFixed(1)} est picks)`).join(", ")}.
                              {" "}Few opponents likely to pick these &mdash; differentiation edge.
                            </p>
                          )}
                          {chalky.length > 0 && (
                            <p className="m-0 mb-1.5">
                              <span className="text-amber-400">Chalk the field is on:</span>{" "}
                              {chalky.map((t) => `${t.team} (~${t.estPicks.toFixed(1)} est picks)`).join(", ")}.
                              {" "}If one loses, many opponents go down &mdash; but picking these doesn&apos;t differentiate you.
                            </p>
                          )}
                          <p className="m-0 mb-1.5">
                            <span className="text-blue-400">Your edge:</span>{" "}
                            You need 4 picks today but only 1/day after Sunday. Most opponents have 1 pick.
                            {" "}Burn expendable teams now, save elite teams for when the field thins and you need to separate.
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Full team rankings */}
              {available.length > 0 && (
                <div className={cardClass}>
                  <h3 className="m-0 mb-2 text-[10px] text-slate-600">
                    ALL AVAILABLE TEAMS ({available.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-[24px_1fr_44px_44px_44px_38px_44px_44px_30px] gap-1 px-1.5 py-1 text-[9px] text-slate-600 font-bold min-w-[480px]">
                      <span>#</span>
                      <span>TEAM</span>
                      <span>WIN%</span>
                      <span>SPRD</span>
                      <span>DEPTH</span>
                      <span>EST</span>
                      <span>UNIQ</span>
                      <span>SCORE</span>
                      <span></span>
                    </div>
                    {available.sort((a, b) => b.sc - a.sc).map((t, i) => {
                      const isRec = uniqueCombos[0]?.picks.some((p) => p.team === t.team);
                      return (
                      <div
                        key={t.team}
                        className="grid grid-cols-[24px_1fr_44px_44px_44px_38px_44px_44px_30px] gap-1 px-1.5 py-1.5 rounded text-[11px] items-center min-w-[480px]"
                        style={{
                          background: isRec ? "#0a1a0a" : "#0a0f1a",
                          border: isRec ? "1px solid #166534" : "1px solid transparent",
                        }}
                      >
                        <span className="font-bold" style={{ color: isRec ? "#4ade80" : "#475569" }}>
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-200">
                          <span className="flex items-center gap-1">
                            {t.team}
                            {t.liveOdds && <span className="inline-block w-1 h-1 rounded-full bg-green-500" title="Live odds" />}
                          </span>
                          {t.opponent && <span className="text-[9px] text-slate-600 font-normal block leading-tight">vs {t.opponent}</span>}
                        </span>
                        <span style={{ color: t.wp >= 0.8 ? "#4ade80" : t.wp >= 0.5 ? "#fbbf24" : "#f87171" }}>
                          {(t.wp * 100).toFixed(0)}%
                        </span>
                        <span className="text-[10px]" style={{ color: t.spread !== null ? (t.spread <= -10 ? "#4ade80" : t.spread <= -3 ? "#fbbf24" : "#f87171") : "#334155" }}>
                          {t.spread !== null ? (t.spread > 0 ? `+${t.spread}` : t.spread) : "-"}
                        </span>
                        <span className="text-[10px]" style={{ color: t.dr >= 0.7 ? "#f87171" : t.dr >= 0.4 ? "#fbbf24" : "#4ade80" }}>
                          {t.dr >= 0.7 ? "DEEP" : t.dr >= 0.4 ? "MED" : "BURN"}
                        </span>
                        <span style={{ color: t.estPicks >= 5 ? "#f87171" : t.estPicks >= 2 ? "#fbbf24" : "#4ade80" }}>
                          {t.estPicks.toFixed(1)}
                        </span>
                        <span style={{ color: t.u >= 0.8 ? "#4ade80" : t.u >= 0.5 ? "#fbbf24" : "#f87171" }}>
                          {(t.u * 100).toFixed(0)}%
                        </span>
                        <span className="font-extrabold" style={{ color: t.sc >= 0.7 ? "#4ade80" : t.sc >= 0.5 ? "#fbbf24" : "#94a3b8" }}>
                          {(t.sc * 100).toFixed(0)}
                        </span>
                        <span className="text-[12px] text-center" style={{ color: t.signal === "bull" ? "#4ade80" : t.signal === "bear" ? "#f87171" : "#475569" }}>
                          {t.signal === "bull" ? "\u25b2" : t.signal === "bear" ? "\u25bc" : "\u2013"}
                        </span>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </>
              );
            })()}
          </div>
        )}

        {/* ═══ MONEY ═══ */}
        {tab === "Money" && (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-1">
              Money Tracker
            </h2>
            <p className="text-[11px] text-slate-500 mb-3.5">
              $15 buy-in + $5 per buy-back (max 3)
            </p>
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[
                {
                  v: `$${pot}`,
                  l: "TOTAL POT",
                  c: "#4ade80",
                },
                {
                  v: `$${players.reduce((s, p) => s + p.totalBB * BB_COST, 0)}`,
                  l: "FROM BUY-BACKS",
                  c: "#fbbf24",
                },
                {
                  v: players.filter((p) => p.totalBB > 0).length,
                  l: "BOUGHT BACK",
                  c: "#a78bfa",
                },
              ].map((s, i) => (
                <div key={i} className={`${cardClass} text-center`}>
                  <div
                    className="text-2xl font-extrabold"
                    style={{ color: s.c }}
                  >
                    {s.v}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
            <div className={cardClass}>
              <div className="grid grid-cols-[1fr_60px_50px_60px_60px] gap-2 px-2 py-1 text-[9px] text-slate-600 font-bold">
                <span>PLAYER</span>
                <span>BB USED</span>
                <span>BB LEFT</span>
                <span>TOTAL $</span>
                <span>STATUS</span>
              </div>
              {[...players]
                .sort((a, b) => b.money - a.money)
                .map((p, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_60px_50px_60px_60px] gap-2 px-2 py-1.5 rounded text-xs items-center"
                    style={{
                      background:
                        isPersonal && p.me
                          ? "#140a24"
                          : i % 2 === 0
                            ? "#0a0f1a"
                            : "#080c14",
                    }}
                  >
                    <span
                      className="font-semibold"
                      style={{
                        color:
                          isPersonal && p.me
                            ? "#a78bfa"
                            : "#e2e8f0",
                      }}
                    >
                      {p.n}
                    </span>
                    <span
                      className="text-center"
                      style={{
                        color:
                          p.totalBB > 0 ? "#fbbf24" : "#475569",
                      }}
                    >
                      {p.totalBB > 0 ? p.totalBB : "\u2014"}
                    </span>
                    <span
                      className="text-center"
                      style={{
                        color: p.isPermElim
                          ? "#475569"
                          : MAX_BB - p.totalBB <= 1
                            ? "#ef4444"
                            : "#94a3b8",
                      }}
                    >
                      {p.isPermElim
                        ? "\u2014"
                        : MAX_BB - p.totalBB}
                    </span>
                    <span className="font-bold text-green-400 text-center">
                      ${p.money}
                    </span>
                    <Badge
                      type={p.isPermElim ? "out" : "survived"}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-center p-5 text-[10px] text-slate-700">
        Survivor Pool 2026 &middot;{" "}
        {isPersonal
          ? "\ud83d\udd13 Personal Mode"
          : "Shared Mode"}{" "}
        &middot; Ask Claude to refresh scores
      </div>
    </div>
  );
}
