"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  computePlayer,
  FUT,
  WP,
  MAX_BB,
  BB_COST,
  BUY_IN,
  type PlayerRaw,
  type PlayerComputed,
  type DayConfig,
} from "@/lib/compute";
import playersData from "@/data/players.json";
import resultsData from "@/data/results.json";

const PERSONAL_PW = "trevorNOVA";

const PLAYERS: PlayerRaw[] = playersData as PlayerRaw[];
const INITIAL_TEAM_RESULTS: Record<string, Record<string, string>> =
  resultsData.teamResults;
const INITIAL_SCORES: Record<string, Record<string, string>> = resultsData.scores;
const DAYS: DayConfig[] = resultsData.days as DayConfig[];

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
function rowStyle(hl: boolean, dn: boolean) {
  return {
    background: dn ? "#1a0808" : hl ? "#140a24" : "#0a0f1a",
    border: `1px solid ${dn ? "#7f1d1d" : hl ? "#7c3aed" : "#1a2030"}`,
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
        "Day 1",
        "Day 2 (Live)",
        "Used Teams",
        "Schedule",
        "Edge Lab",
        "Money",
      ]
    : [
        "Dashboard",
        "Day 1",
        "Day 2 (Live)",
        "Used Teams",
        "Schedule",
        "Money",
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

  const edge = useMemo(() => {
    if (!isPersonal || !trevor) return [];
    const ou: Record<string, number> = {};
    active.forEach((p) => {
      if (p.me) return;
      p.usedTeams.forEach((t) => {
        ou[t] = (ou[t] || 0) + 1;
      });
    });
    const tot = active.length - 1;
    return Object.keys(FUT)
      .filter((t) => !trevor.usedTeams.has(t))
      .map((t) => {
        const f = FUT[t] || { dr: 0.3, t: 4, o: "N/A" };
        const wp = WP[t] ?? 0.5;
        const dr = f.dr;
        const u = 1 - (ou[t] || 0) / tot;
        const sc = wp * 0.35 + (1 - dr) * 0.3 + u * 0.35;
        return {
          team: t,
          wp,
          dr,
          on: ou[t] || 0,
          u,
          sc,
          tier: f.t || 4,
          odds: f.o || "N/A",
        };
      })
      .sort((a, b) => b.sc - a.sc);
  }, [isPersonal, trevor, active]);

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
          {players.filter((p) => p.isPermElim).length} out &middot; Day 2 Fri
          3/20 &middot; Pot: ${pot}
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
                  Day 1: St. Louis &#10003;, Wisconsin &#10007; &rarr;
                  Bought back in Day 2
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {trevor.history
                    .find((e) => e.dayId === "day2")
                    ?.picks.map((t) => (
                      <Pill key={t} team={t} result={getD2Result(t)} />
                    ))}
                </div>
                <div className="text-[11px] text-red-500 font-semibold mb-1">
                  &#9888; Santa Clara LOST &rarr; Eliminated for Day 2.
                </div>
                <div className="text-[11px] text-amber-400">
                  Saturday: Buy back in (BB 2/{MAX_BB}, +$5) with 4
                  picks, or done for good.
                </div>
              </div>
            )}

            <div className={cardClass}>
              <h3 className="m-0 mb-2 text-[11px] text-slate-500 tracking-wider">
                DAY 2 TEAM POPULARITY
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {day2Freq.map(([t, c]) => {
                  const r = getD2Result(t);
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

            <div className={cardClass}>
              <h3 className="m-0 mb-2 text-[11px] text-slate-500 tracking-wider">
                ALL PARTICIPANTS &mdash; DAY 2
              </h3>
              <div className="flex flex-col gap-1">
                {players.map((p, i) => {
                  const d2 = p.history.find((e) => e.dayId === "day2");
                  const st = p.currentStatus;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-md flex-wrap"
                      style={rowStyle(
                        isPersonal && p.me,
                        st === "eliminated" || st === "out"
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
                      {d2?.buyBack && <Badge type="bb" />}
                      {p.totalBB > 1 && (
                        <span className="text-[9px] text-amber-400 bg-[#3b2f08] px-1.5 py-px rounded">
                          BB&times;{p.totalBB}
                        </span>
                      )}
                      {p.dupes.length > 0 && (
                        <span className="text-[9px] text-red-500 font-bold">
                          &#9888; DUPE: {p.dupes.join(",")}
                        </span>
                      )}
                      {p.nextPicksNeeded > 0 && (
                        <span className="text-[9px] text-blue-400 bg-[#1e2a4a] px-1.5 py-px rounded">
                          Need {p.nextPicksNeeded} Sat
                          {p.nextIsBuyBack ? " (BB)" : ""}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1 ml-auto">
                        {d2?.picks.map((t) => (
                          <Pill
                            key={t}
                            team={t}
                            result={getD2Result(t)}
                          />
                        ))}
                        {!d2 && (
                          <span className="text-[10px] text-slate-600">
                            No picks
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

        {/* ═══ DAY 2 LIVE ═══ */}
        {tab === "Day 2 (Live)" && (
          <div>
            <h2 className="text-[15px] text-slate-50 mb-1">
              Day 2 &mdash; Friday 3/20 (TODAY)
            </h2>
            <p className="text-[11px] text-slate-500 mb-2">
              Survivors: 2 picks &middot; Buy-backs: 4 picks &middot; ONE
              loss = eliminated
            </p>
            <div className={`${cardClass} overflow-x-auto`}>
              <h3 className="m-0 mb-2 text-[10px] text-slate-600">
                GAME STATUS
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-1.5">
                {Object.entries(scores.day2 || {}).map(([t, s]) => {
                  const r = getD2Result(t);
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
              </div>
            </div>
            {active.map((p, i) => {
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
                      BB{p.totalBB > 1 ? `\u00d7${p.totalBB}` : ""}
                    </span>
                  )}
                  <Badge type={st} />
                  <div className="flex gap-1 flex-wrap ml-auto">
                    {d2?.picks.map((t) => (
                      <Pill
                        key={t}
                        team={t}
                        result={getD2Result(t)}
                      />
                    ))}
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
                label: "TONIGHT (Fri 3/20)",
                sub: "Remaining first round",
                games: [
                  { t: "6:50 PM", m: "(8) Clemson vs (9) Iowa" },
                  {
                    t: "7:10 PM",
                    m: "(5) St. John's vs (12) N. Iowa",
                  },
                  { t: "7:25 PM", m: "(7) UCLA vs (10) UCF" },
                  { t: "7:35 PM", m: "(2) Purdue vs (15) Queens" },
                  {
                    t: "9:25 PM",
                    m: "(1) Florida vs (16) Prairie View",
                  },
                  {
                    t: "9:45 PM",
                    m: "(4) Kansas vs (13) Cal Baptist",
                  },
                  { t: "10:00 PM", m: "(2) UConn vs (15) Furman" },
                  {
                    t: "10:10 PM",
                    m: "(7) Miami FL vs (10) Missouri",
                  },
                ],
              },
              {
                label: "SAT 3/21 \u2014 Round of 32",
                sub: "Advancing: 1 pick \u00b7 Buy-back: 4 picks",
                games: [
                  {
                    t: "12:10 PM",
                    m: "(1) Michigan vs (9) Saint Louis",
                  },
                  {
                    t: "2:45 PM",
                    m: "(4) Michigan State vs (5) Louisville",
                  },
                  { t: "5:15 PM", m: "(1) Duke vs (8) TCU" },
                  {
                    t: "6:10 PM",
                    m: "(1) Houston vs (5) Texas A&M",
                  },
                  {
                    t: "7:10 PM",
                    m: "(3) Gonzaga vs (6) Texas",
                  },
                  { t: "7:50 PM", m: "(3) Illinois vs (6) VCU" },
                  {
                    t: "8:45 PM",
                    m: "(4) Nebraska vs (5) Vanderbilt",
                  },
                  {
                    t: "9:45 PM",
                    m: "(3) Arkansas vs (14) High Point",
                  },
                ],
              },
              {
                label: "SUN 3/22 \u2014 Round of 32",
                sub: "Advancing: 1 pick \u00b7 Buy-back: 4 picks \u00b7 \u26a0 LAST BUY-BACK DAY",
                games: [
                  {
                    t: "TBD",
                    m: "Fri evening winners \u2014 R2 matchups",
                  },
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
            <h2 className="text-[15px] text-slate-50 mb-0.5">
              Edge Lab &mdash; Trevor&apos;s Strategy
            </h2>
            <p className="text-[11px] text-slate-500 mb-3.5">
              Win prob &times; expendability &times; uniqueness. DEPTH =
              projected tournament run (futures odds). RED = save for
              later.
            </p>
            <div className={cardClass}>
              <h3 className="m-0 mb-1.5 text-[10px] text-slate-600">
                TEAMS ALREADY BURNED ({trevor.usedTeams.size})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {[...trevor.usedTeams].map((t) => (
                  <Pill key={t} team={t} dim />
                ))}
              </div>
            </div>
            <div
              className="rounded-lg p-3.5 mb-3"
              style={{
                background: "#140a24",
                border: "1px solid #7c3aed",
              }}
            >
              <h3 className="m-0 mb-1.5 text-[11px] text-violet-400">
                SATURDAY STRATEGY (BUY-BACK #{trevor.totalBB + 1})
              </h3>
              <div className="text-[11px] text-slate-300 leading-7">
                <p className="m-0 mb-1.5">
                  You need{" "}
                  <strong className="text-amber-400">
                    4 picks Saturday
                  </strong>
                  .
                </p>
                <p className="m-0 mb-1">
                  <span className="text-green-400">
                    &#x1f7e2; USE NOW:
                  </span>{" "}
                  Nebraska, High Point, Vanderbilt, TCU, VCU &mdash;
                  short runs, burn them now.
                </p>
                <p className="m-0 mb-1">
                  <span className="text-red-500">
                    &#x1f534; SAVE:
                  </span>{" "}
                  Florida, Duke, Arizona, Houston, Michigan, Illinois,
                  Iowa State, Purdue &mdash; need these Sweet 16+.
                </p>
                <p className="m-0 mb-1">
                  <span className="text-blue-400">
                    &#x1f535; FLEX:
                  </span>{" "}
                  Virginia, Michigan State, St. John&apos;s, Gonzaga,
                  Kentucky, Arkansas.
                </p>
                <p className="m-0 mb-1">
                  <span className="text-amber-400">
                    &#x26a1; UNIQUENESS:
                  </span>{" "}
                  Kansas picked by 9+ people. Shared paths reduce your
                  edge to win the pool.
                </p>
                <p className="m-0 text-slate-400 text-[10px]">
                  After Sunday: no buy-backs. 1 pick/day. Deep-run
                  teams are essential.
                </p>
              </div>
            </div>
            <div className={cardClass}>
              <h3 className="m-0 mb-2 text-[10px] text-slate-600">
                AVAILABLE TEAMS RANKED
              </h3>
              <div className="text-[9px] text-slate-600 mb-2">
                Score = 35% win prob + 30% expendability + 35%
                uniqueness
              </div>
              <div className="overflow-x-auto">
                <div className="grid grid-cols-[28px_1fr_50px_55px_55px_55px_55px_50px] gap-1 px-1.5 py-1 text-[9px] text-slate-600 font-bold min-w-[500px]">
                  <span>#</span>
                  <span>TEAM</span>
                  <span>WIN%</span>
                  <span>DEPTH</span>
                  <span>UNIQ</span>
                  <span>SCORE</span>
                  <span>TIER</span>
                  <span>ODDS</span>
                </div>
                {edge.map((t, i) => (
                  <div
                    key={t.team}
                    className="grid grid-cols-[28px_1fr_50px_55px_55px_55px_55px_50px] gap-1 px-1.5 py-1.5 rounded text-[11px] items-center min-w-[500px]"
                    style={{
                      background:
                        i < 3
                          ? "#0a1a0a"
                          : i < 8
                            ? "#0a0f1a"
                            : "#080c14",
                      border:
                        i < 3
                          ? "1px solid #166534"
                          : "1px solid transparent",
                    }}
                  >
                    <span
                      className="font-bold"
                      style={{
                        color: i < 3 ? "#4ade80" : "#475569",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="font-semibold text-slate-200">
                      {t.team}
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
                  </div>
                ))}
              </div>
            </div>
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
