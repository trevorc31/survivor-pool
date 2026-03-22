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
        {tab === "Used Teams" && (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-1">
              Used Teams Tracker
            </h2>
            <p className="text-[11px] text-slate-500 mb-3.5">
              Cannot pick a team you&apos;ve already used.
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
                      {p.allPicks.map((pk, j) => (
                        <span
                          key={j}
                          className="inline-flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-xl text-[10px] text-slate-300"
                        >
                          {pk.team}
                          <span className="text-[8px] text-slate-600">
                            {pk.dayId === "day1" ? "D1" : "D2"}
                          </span>
                        </span>
                      ))}
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
                  .map(([team, pls]) => (
                    <div
                      key={team}
                      className="bg-[#0a0f1a] border border-[#1a2030] rounded-md px-2.5 py-2"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-bold text-slate-200">
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
                  ))}
              </div>
            </div>
          </div>
        )}

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

            {/* Your situation */}
            <div
              className="rounded-lg p-3.5 mb-3"
              style={{ background: "#0a1420", border: "1px solid #1e3a5f" }}
            >
              <h3 className="m-0 mb-1.5 text-[11px] text-blue-400">
                YOUR SITUATION
              </h3>
              <div className="text-[11px] text-slate-300 leading-6">
                <p className="m-0 mb-1">
                  You need{" "}
                  <strong className="text-amber-400">
                    {trevor.nextPicksNeeded} pick{trevor.nextPicksNeeded !== 1 ? "s" : ""}
                  </strong>{" "}
                  for {SCHEDULE_DAYS[0]?.label?.split(" — ")[0] || "next day"}
                  {trevor.nextIsBuyBack && (
                    <span className="text-red-400"> (buy-back #{trevor.totalBB + 1}/{MAX_BB}, +${BB_COST})</span>
                  )}
                </p>
                <p className="m-0 mb-1">
                  Teams burned ({trevor.usedTeams.size}): {" "}
                  <span className="text-slate-500">{[...trevor.usedTeams].join(", ")}</span>
                </p>
              </div>
            </div>

            {/* ── Per-day sections ── */}
            {SCHEDULE_DAYS.map((day) => {
              const dayEdge = edgeByDay[day.dayId] || [];
              const dayRecs = recommendedByDay[day.dayId] || [];
              const isFirstDay = day === SCHEDULE_DAYS[0];
              if (dayEdge.length === 0 && day.games.length === 0) return null;

              return (
                <div key={day.dayId} className="mb-6">
                  {/* Day header */}
                  <div
                    className="rounded-lg p-3 mb-3"
                    style={{ background: "#0c1222", border: "1px solid #334155" }}
                  >
                    <h3 className="m-0 text-[13px] text-slate-100 font-bold">{day.label}</h3>
                    <p className="m-0 text-[10px] text-slate-500 mt-0.5">{day.sub}</p>
                    {day.games.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                        {day.games.map((g, gi) => (
                          <span key={gi}>{g.t} &mdash; {g.m}</span>
                        ))}
                      </div>
                    )}
                    {day.games.length === 0 && (
                      <p className="m-0 mt-1 text-[10px] text-slate-600">Games TBD</p>
                    )}
                  </div>

                  {/* Recommended picks for this day */}
                  {dayRecs.length > 0 && (
                    <div
                      className="rounded-lg p-3.5 mb-3"
                      style={{ background: "#0a1a0a", border: "1px solid #166534" }}
                    >
                      <h3 className="m-0 mb-2 text-[11px] text-green-400">
                        RECOMMENDED PICKS {isFirstDay && trevor.nextPicksNeeded > 1 ? `(${trevor.nextPicksNeeded} needed)` : ""}
                      </h3>
                      <div className="flex flex-col gap-2.5">
                        {dayRecs.map((t, i) => (
                          <div key={t.team}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-green-400 font-bold text-[13px]">{i + 1}.</span>
                              <span className="text-slate-100 font-bold text-[13px]">{t.team}</span>
                              {t.opponent && (
                                <span className="text-slate-500 text-[11px]">vs {t.opponent}</span>
                              )}
                              <span
                                className="text-[10px] ml-auto font-bold"
                                style={{ color: t.wp >= 0.8 ? "#4ade80" : t.wp >= 0.5 ? "#fbbf24" : "#f87171" }}
                              >
                                {(t.wp * 100).toFixed(0)}% WP
                              </span>
                              {t.spread !== null && (
                                <span className="text-[10px] text-slate-400">({t.spread > 0 ? `+${t.spread}` : t.spread})</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 pl-5 leading-5">
                              {t.tier >= 4 && (
                                <span className="text-green-500">Expendable (short tournament run). </span>
                              )}
                              {t.tier <= 2 && (
                                <span className="text-red-400">Warning: deep-run team, burning early. </span>
                              )}
                              {t.tier === 3 && (
                                <span className="text-blue-400">Flex pick (moderate depth). </span>
                              )}
                              {t.u >= 0.85 && (
                                <span className="text-emerald-400">Unique pick ({t.on === 0 ? "no one" : `only ${t.on}`} used). </span>
                              )}
                              {t.u < 0.5 && (
                                <span className="text-amber-400">Heavily used by pool ({t.on} others). </span>
                              )}
                              {t.signal === "bull" && (
                                <span className="text-emerald-400">Sharp money agrees. </span>
                              )}
                              {t.signal === "bear" && (
                                <span className="text-red-400">Sharp money fading this pick. </span>
                              )}
                              Score: {(t.sc * 100).toFixed(0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Insights for this day */}
                  {dayEdge.length > 0 && (
                    <div
                      className="rounded-lg p-3.5 mb-3"
                      style={{ background: "#140a24", border: "1px solid #7c3aed" }}
                    >
                      <h3 className="m-0 mb-1.5 text-[11px] text-violet-400">
                        INSIGHTS
                      </h3>
                      <div className="text-[11px] text-slate-300 leading-6">
                        {(() => {
                          const pool = dayEdge;
                          const burnable = pool.filter((t) => t.tier >= 4 && t.wp >= 0.6);
                          const risky = pool.filter((t) => t.wp < 0.5 && t.wp > 0);
                          const contrarian = pool.filter((t) => t.wp >= 0.6 && t.estPicks < 2).sort((a, b) => a.estPicks - b.estPicks);
                          const chalky = pool.filter((t) => t.estPicks >= 4).sort((a, b) => b.estPicks - a.estPicks);
                          return (
                            <>
                              {burnable.length > 0 && (
                                <p className="m-0 mb-1.5">
                                  <span className="text-green-400">Burn candidates:</span>{" "}
                                  {burnable.map((t) => `${t.team} (${(t.wp * 100).toFixed(0)}%)`).join(", ")}.
                                  Short futures, safe to use now.
                                </p>
                              )}
                              {contrarian.length > 0 && (
                                <p className="m-0 mb-1.5">
                                  <span className="text-emerald-400">Contrarian plays:</span>{" "}
                                  {contrarian.map((t) => `${t.team} (~${t.estPicks.toFixed(1)} est picks)`).join(", ")}.
                                  Strong teams few others are expected to pick — high differentiation value.
                                </p>
                              )}
                              {chalky.length > 0 && (
                                <p className="m-0 mb-1.5">
                                  <span className="text-amber-400">Chalk alert:</span>{" "}
                                  {chalky.map((t) => `${t.team} (~${t.estPicks.toFixed(1)} est picks)`).join(", ")}.
                                  Heavily picked — a loss here eliminates many opponents.
                                </p>
                              )}
                              {risky.length > 0 && (
                                <p className="m-0 mb-1.5">
                                  <span className="text-red-400">Upset risks:</span>{" "}
                                  {risky.map((t) => `${t.team} (${(t.wp * 100).toFixed(0)}%)`).join(", ")}.
                                  Win probability under 50%.
                                </p>
                              )}
                              {isFirstDay && trevor.nextIsBuyBack && trevor.nextPicksNeeded >= 4 && (
                                <p className="m-0 mb-1.5">
                                  <span className="text-amber-400">Buy-back strategy:</span>{" "}
                                  With {trevor.nextPicksNeeded} picks needed, prioritize expendable teams.
                                  Save deep-run teams for later rounds when you only need 1 pick/day.
                                </p>
                              )}
                              <p className="m-0 text-slate-500 text-[10px]">
                                Score = 25% win prob + 20% futures + 25% uniqueness + 20% sharp + 10% line value
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Ranked teams table for this day */}
                  {dayEdge.length > 0 && (
                    <div className={cardClass}>
                      <h3 className="m-0 mb-2 text-[10px] text-slate-600">
                        RANKED TEAMS ({dayEdge.length})
                      </h3>
                      <div className="overflow-x-auto">
                        <div className="grid grid-cols-[24px_1fr_44px_44px_44px_38px_44px_44px_30px_44px_48px_44px_30px] gap-1 px-1.5 py-1 text-[9px] text-slate-600 font-bold min-w-[600px]">
                          <span>#</span>
                          <span>TEAM</span>
                          <span>WIN%</span>
                          <span>SPRD</span>
                          <span>DEPTH</span>
                          <span>EST</span>
                          <span>UNIQ</span>
                          <span>SHRP%</span>
                          <span>SYS</span>
                          <span>SCORE</span>
                          <span>TIER</span>
                          <span>ODDS</span>
                          <span></span>
                        </div>
                        {dayEdge.map((t, i) => (
                          <div
                            key={t.team}
                            className="grid grid-cols-[24px_1fr_44px_44px_44px_38px_44px_44px_30px_44px_48px_44px_30px] gap-1 px-1.5 py-1.5 rounded text-[11px] items-center min-w-[600px]"
                            style={{
                              background:
                                dayRecs.some((r) => r.team === t.team)
                                  ? "#0a1a0a"
                                  : i < 8
                                    ? "#0a0f1a"
                                    : "#080c14",
                              border:
                                dayRecs.some((r) => r.team === t.team)
                                  ? "1px solid #166534"
                                  : "1px solid transparent",
                            }}
                          >
                            <span
                              className="font-bold"
                              style={{
                                color: dayRecs.some((r) => r.team === t.team) ? "#4ade80" : "#475569",
                              }}
                            >
                              {i + 1}
                            </span>
                            <span className="font-semibold text-slate-200">
                              <span className="flex items-center gap-1">
                                {t.team}
                                {t.liveOdds && (
                                  <span className="inline-block w-1 h-1 rounded-full bg-green-500" title="Live odds" />
                                )}
                              </span>
                              {t.opponent && (
                                <span className="text-[9px] text-slate-600 font-normal block leading-tight">vs {t.opponent}</span>
                              )}
                            </span>
                            <span
                              style={{
                                color:
                                  t.wp >= 0.8
                                    ? "#4ade80"
                                    : t.wp >= 0.5
                                      ? "#fbbf24"
                                      : "#f87171",
                              }}
                            >
                              {(t.wp * 100).toFixed(0)}%
                            </span>
                            <span
                              className="text-[10px]"
                              style={{
                                color: t.spread !== null
                                  ? (t.spread <= -10 ? "#4ade80" : t.spread <= -3 ? "#fbbf24" : "#f87171")
                                  : "#334155",
                              }}
                            >
                              {t.spread !== null ? (t.spread > 0 ? `+${t.spread}` : t.spread) : "-"}
                            </span>
                            <span
                              className="text-[10px]"
                              style={{
                                color:
                                  t.dr >= 0.7
                                    ? "#f87171"
                                    : t.dr >= 0.4
                                      ? "#fbbf24"
                                      : "#4ade80",
                              }}
                            >
                              {t.dr >= 0.7
                                ? "DEEP"
                                : t.dr >= 0.4
                                  ? "MED"
                                  : "SHORT"}
                            </span>
                            <span
                              style={{
                                color:
                                  t.estPicks >= 5
                                    ? "#f87171"
                                    : t.estPicks >= 2
                                      ? "#fbbf24"
                                      : "#4ade80",
                              }}
                            >
                              {t.estPicks.toFixed(1)}
                            </span>
                            <span
                              style={{
                                color:
                                  t.u >= 0.8
                                    ? "#4ade80"
                                    : t.u >= 0.5
                                      ? "#fbbf24"
                                      : "#f87171",
                              }}
                            >
                              {(t.u * 100).toFixed(0)}%
                            </span>
                            <span
                              style={{
                                color: t.sharpMoney !== null
                                  ? (t.sharpMoney >= 65 ? "#4ade80" : t.sharpMoney >= 50 ? "#fbbf24" : "#f87171")
                                  : "#334155",
                              }}
                            >
                              {t.sharpMoney !== null ? `${t.sharpMoney}%` : "-"}
                            </span>
                            <span
                              style={{
                                color: t.systems !== null
                                  ? (t.systems >= 3 ? "#4ade80" : t.systems >= 1 ? "#fbbf24" : "#f87171")
                                  : "#334155",
                              }}
                            >
                              {t.systems !== null ? t.systems : "-"}
                            </span>
                            <span
                              className="font-extrabold"
                              style={{
                                color:
                                  t.sc >= 0.7
                                    ? "#4ade80"
                                    : t.sc >= 0.5
                                      ? "#fbbf24"
                                      : "#94a3b8",
                              }}
                            >
                              {(t.sc * 100).toFixed(0)}
                            </span>
                            <TBadge tier={t.tier} />
                            <span className="text-[9px] text-slate-600">
                              {t.odds}
                            </span>
                            <span
                              className="text-[12px] text-center"
                              style={{
                                color: t.signal === "bull" ? "#4ade80" : t.signal === "bear" ? "#f87171" : "#475569",
                              }}
                              title={t.signal === "bull" ? "Sharp + high WP" : t.signal === "bear" ? "Fade signal" : "Neutral"}
                            >
                              {t.signal === "bull" ? "\u25b2" : t.signal === "bear" ? "\u25bc" : "\u2013"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
