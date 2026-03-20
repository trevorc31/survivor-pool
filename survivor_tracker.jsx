import { useState, useMemo } from "react";

// ══════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════
const PERSONAL_PW = "trevorNOVA"; // Change this to whatever you want
const BUY_IN = 15;
const BB_COST = 5;
const MAX_BB = 3;

// ══════════════════════════════════════════════
// MULTI-DAY PICK STRUCTURE
// Each day entry: { picks: [...], result: "survived"|"eliminated"|"pending", buyBack: bool }
// Buy-back is auto-detected: if a player lost previous day and picks this day, it's a buy-back.
// Number of picks also signals: 4 picks on Fri/Sat/Sun = buy-back, 2 on Fri or 1 on Sat/Sun = advancing.
// ══════════════════════════════════════════════

const DAYS = [
  { id: "day1", label: "Day 1", date: "Thu 3/19", dayOfWeek: "thursday", advPicks: 2, bbPicks: null },
  { id: "day2", label: "Day 2", date: "Fri 3/20", dayOfWeek: "friday", advPicks: 2, bbPicks: 4 },
  { id: "day3", label: "Day 3", date: "Sat 3/21", dayOfWeek: "saturday", advPicks: 1, bbPicks: 4 },
  { id: "day4", label: "Day 4", date: "Sun 3/22", dayOfWeek: "sunday", advPicks: 1, bbPicks: 4 },
  // Post-Sunday: advPicks: 1, bbPicks: null (no more buy-backs)
];

// Day results by team
const TEAM_RESULTS = {
  day1: {
    Vanderbilt:"won","Michigan St":"won","St. Louis":"won",Nebraska:"won",Illinois:"won",
    Arkansas:"won",Louisville:"won",Gonzaga:"won",Duke:"won",Houston:"won","Texas A&M":"won",
    VCU:"won","Michigan State":"won",Wisconsin:"lost","North Carolina":"lost",BYU:"lost",
    "Ohio State":"lost","Saint Mary's":"lost",Georgia:"lost",
  },
  day2: {
    "Santa Clara":"lost",Kentucky:"won","Texas Tech":"won",Virginia:"won",
    "Iowa State":"in_progress",Alabama:"in_progress","Utah State":"in_progress",
    Tennessee:"in_progress","Miami (OH)":"in_progress",
    Iowa:"scheduled","St. John's":"scheduled",UCLA:"scheduled",Purdue:"scheduled",
    Florida:"scheduled",Kansas:"scheduled",UConn:"scheduled","Miami (FL)":"scheduled",
  },
};

const SCORES = {
  day2: {
    "Santa Clara":"84-89 vs Kentucky (OT)",Kentucky:"89-84 vs Santa Clara (OT)",
    "Texas Tech":"91-71 vs Akron",Virginia:"82-73 vs Wright State",
    "Iowa State":"79-43 vs Tenn. St (2H)",Alabama:"49-39 vs Hofstra (2H)",
    "Utah State":"26-20 vs Villanova (1H)",Tennessee:"10-13 vs Miami OH (1H)",
    "Miami (OH)":"13-10 vs Tennessee (1H)",
    Iowa:"6:50 PM vs Clemson","St. John's":"7:10 PM vs N. Iowa",
    UCLA:"7:25 PM vs UCF",Purdue:"7:35 PM vs Queens",
    Florida:"9:25 PM vs Prairie View",Kansas:"9:45 PM vs Cal Baptist",
    UConn:"10:00 PM vs Furman","Miami (FL)":"10:10 PM vs Missouri",
  },
};

// ══════════════════════════════════════════════
// PARTICIPANT DATA — extensible per-day structure
// history: array of { dayId, picks[], buyBack: bool }
// The system auto-computes: result per day, total buy-backs, elimination status
// ══════════════════════════════════════════════

const PLAYERS = [
  { n:"Jason C",   me:false, history:[
    { dayId:"day1", picks:["Vanderbilt","Michigan St"], buyBack:false },
    { dayId:"day2", picks:["Alabama","Kansas"], buyBack:false },
  ]},
  { n:"Rob",       me:false, history:[
    { dayId:"day1", picks:["Nebraska","Illinois"], buyBack:false },
    { dayId:"day2", picks:["St. John's","Virginia"], buyBack:false },
  ]},
  { n:"Zach",      me:false, history:[
    { dayId:"day1", picks:["Nebraska","Michigan St"], buyBack:false },
    { dayId:"day2", picks:["Kentucky","Kansas"], buyBack:false },
  ]},
  { n:"Ben",       me:false, history:[
    { dayId:"day1", picks:["Gonzaga","Arkansas"], buyBack:false },
    { dayId:"day2", picks:["Kansas","Virginia"], buyBack:false },
  ]},
  { n:"Sara",      me:false, history:[
    { dayId:"day1", picks:["Nebraska","Vanderbilt"], buyBack:false },
    { dayId:"day2", picks:["Texas Tech","Tennessee"], buyBack:false },
  ]},
  { n:"Kyle",      me:false, history:[
    { dayId:"day1", picks:["Nebraska","Vanderbilt"], buyBack:false },
    { dayId:"day2", picks:["Alabama","St. John's"], buyBack:false },
  ]},
  { n:"Teddy",     me:false, history:[
    { dayId:"day1", picks:["Michigan St","Nebraska"], buyBack:false },
    { dayId:"day2", picks:["Kansas","Purdue"], buyBack:false },
  ]},
  { n:"Tyler",     me:false, history:[
    { dayId:"day1", picks:["Nebraska","Arkansas"], buyBack:false },
    { dayId:"day2", picks:["Kentucky","Alabama"], buyBack:false },
  ]},
  { n:"Jason F",   me:false, history:[
    { dayId:"day1", picks:["Nebraska","Arkansas"], buyBack:false },
    { dayId:"day2", picks:["Alabama","Kansas"], buyBack:false },
  ]},
  { n:"Norton",    me:false, history:[
    { dayId:"day1", picks:["Michigan State","Arkansas"], buyBack:false },
    { dayId:"day2", picks:["Kansas","UConn"], buyBack:false },
  ]},
  { n:"Reese",     me:false, history:[
    { dayId:"day1", picks:["Nebraska","VCU"], buyBack:false },
    { dayId:"day2", picks:["Kentucky","Iowa State"], buyBack:false },
  ]},
  { n:"Dan",       me:false, history:[
    { dayId:"day1", picks:["Houston","Gonzaga"], buyBack:false },
    { dayId:"day2", picks:["Miami (FL)","Iowa"], buyBack:false },
  ]},
  { n:"Mike",      me:false, history:[
    { dayId:"day1", picks:["Duke","Texas A&M"], buyBack:false },
    { dayId:"day2", picks:["St. John's","UConn"], buyBack:false },
  ]},
  { n:"Nick",      me:false, history:[
    { dayId:"day1", picks:["Arkansas","Nebraska"], buyBack:false },
    { dayId:"day2", picks:["Kansas","UConn"], buyBack:false },
  ]},
  { n:"Mark",      me:false, history:[
    { dayId:"day1", picks:["Gonzaga","Nebraska"], buyBack:false },
    { dayId:"day2", picks:["UCLA","Kentucky"], buyBack:false },
  ]},
  { n:"Trevor",    me:true, history:[
    { dayId:"day1", picks:["St. Louis","Wisconsin"], buyBack:false },
    { dayId:"day2", picks:["Santa Clara","Texas Tech","Iowa","UCLA"], buyBack:true },
  ]},
  { n:"Jack",      me:false, history:[
    { dayId:"day1", picks:["Illinois","North Carolina"], buyBack:false },
    { dayId:"day2", picks:["Iowa State","Kansas","Purdue","UCLA"], buyBack:true },
  ]},
  { n:"Matt M",    me:false, history:[
    { dayId:"day1", picks:["Wisconsin","Arkansas"], buyBack:false },
    { dayId:"day2", picks:["Virginia","Utah State","Iowa","UCLA"], buyBack:true },
  ]},
  { n:"Matt C",    me:false, history:[
    { dayId:"day1", picks:["Wisconsin","Vanderbilt"], buyBack:false },
    { dayId:"day2", picks:["Virginia","Tennessee","UCLA","Kansas"], buyBack:true },
  ]},
  { n:"Tom",       me:false, history:[
    { dayId:"day1", picks:["Ohio State","Wisconsin"], buyBack:false },
    { dayId:"day2", picks:["Utah State","Kentucky","UCLA","Tennessee"], buyBack:true },
  ]},
  { n:"Karen",     me:false, history:[
    { dayId:"day1", picks:["Louisville","Georgia"], buyBack:false },
    { dayId:"day2", picks:["St. John's","UCLA","Kentucky","Tennessee"], buyBack:true },
  ]},
  { n:"Barley",    me:false, history:[
    { dayId:"day1", picks:["Nebraska","BYU"], buyBack:false },
    { dayId:"day2", picks:["Alabama","UCLA","Kansas","UConn"], buyBack:true },
  ]},
  { n:"Josh",      me:false, history:[
    { dayId:"day1", picks:["Saint Mary's","Wisconsin"], buyBack:false },
    { dayId:"day2", picks:["St. John's","UCLA","Iowa","Virginia"], buyBack:true },
  ]},
  { n:"Artrel",    me:false, history:[
    { dayId:"day1", picks:["Wisconsin","Gonzaga"], buyBack:false },
    { dayId:"day2", picks:["Kentucky","Texas Tech","Kansas","Alabama"], buyBack:true },
  ]},
  { n:"Cade",      me:false, history:[
    { dayId:"day1", picks:["Illinois","Wisconsin"], buyBack:false },
    { dayId:"day2", picks:["Kansas","Tennessee","St. John's","Alabama"], buyBack:true },
  ]},
  { n:"Brandon",   me:false, history:[
    { dayId:"day1", picks:["Ohio State","Nebraska"], buyBack:false },
    { dayId:"day2", picks:["Kansas","Utah State","Virginia","Iowa"], buyBack:true },
  ]},
  { n:"Sean",      me:false, history:[
    { dayId:"day1", picks:["Georgia","Saint Mary's"], buyBack:false },
    { dayId:"day2", picks:["UConn","St. John's","Purdue","Miami (OH)"], buyBack:true },
  ]},
  { n:"Terrapin Tim", me:false, history:[
    { dayId:"day1", picks:["BYU","Arkansas"], buyBack:false },
    // No day2 entry = chose not to buy back → permanently eliminated
  ]},
  { n:"Danny",     me:false, history:[
    { dayId:"day1", picks:["Louisville","Saint Mary's"], buyBack:false },
  ]},
];

// Futures tiers
const FUT = {
  Duke:{dr:.95,t:1,o:"+475"},Arizona:{dr:.96,t:1,o:"+340"},Michigan:{dr:.94,t:1,o:"+370"},
  Houston:{dr:.88,t:1,o:"+950"},Florida:{dr:.92,t:1,o:"+800"},
  "Iowa State":{dr:.85,t:2,o:"+1200"},Illinois:{dr:.80,t:2,o:"+1800"},
  Purdue:{dr:.78,t:2,o:"+2500"},UConn:{dr:.75,t:2,o:"+2500"},
  Alabama:{dr:.76,t:2,o:"+2000"},Kansas:{dr:.74,t:2,o:"+2000"},
  Tennessee:{dr:.72,t:2,o:"+3000"},
  Virginia:{dr:.65,t:3,o:"+4000"},"Michigan State":{dr:.60,t:3,o:"+5000"},
  "St. John's":{dr:.58,t:3,o:"+5000"},Gonzaga:{dr:.55,t:3,o:"+5500"},
  UCLA:{dr:.50,t:3,o:"+6000"},Kentucky:{dr:.55,t:3,o:"+4000"},
  Arkansas:{dr:.52,t:3,o:"+5000"},
  Nebraska:{dr:.35,t:4,o:"+10000"},"Texas Tech":{dr:.40,t:4,o:"+8000"},
  Vanderbilt:{dr:.25,t:4,o:"+15000"},Louisville:{dr:.28,t:4,o:"+12000"},
  Iowa:{dr:.32,t:4,o:"+10000"},"Miami (FL)":{dr:.35,t:4,o:"+8000"},
  "Utah State":{dr:.18,t:4,o:"+25000"},"Saint Louis":{dr:.15,t:4,o:"+35000"},
  TCU:{dr:.20,t:4,o:"+20000"},VCU:{dr:.22,t:4,o:"+20000"},
  "Texas A&M":{dr:.20,t:4,o:"+15000"},
  "High Point":{dr:.05,t:5,o:"+100000"},"Miami (OH)":{dr:.03,t:5,o:"+200000"},
  "Santa Clara":{dr:.02,t:5,o:"+100000"},
};
const WP = {
  Kentucky:1,"Texas Tech":1,Virginia:1,"Santa Clara":0,
  "Iowa State":.99,Alabama:.92,"Utah State":.52,Tennessee:.88,"Miami (OH)":.12,
  Iowa:.58,"St. John's":.91,UCLA:.85,Purdue:.97,Florida:.98,Kansas:.97,UConn:.93,"Miami (FL)":.72,
  Michigan:.82,"Saint Louis":.18,"Michigan State":.68,Louisville:.32,
  Duke:.88,TCU:.12,Houston:.75,"Texas A&M":.25,
  Gonzaga:.70,Nebraska:.62,Vanderbilt:.38,Illinois:.72,VCU:.28,Arkansas:.78,"High Point":.22,
};

// ══════════════════════════════════════════════
// COMPUTED PLAYER STATE (auto-derives everything from history)
// ══════════════════════════════════════════════
function computePlayer(p) {
  const allPicks = [];
  const usedTeams = new Set();
  let totalBB = 0;
  let lastDayResult = null;
  let isPermElim = false;
  const dayResults = {};

  for (const entry of p.history) {
    const results = TEAM_RESULTS[entry.dayId];
    if (!results) { dayResults[entry.dayId] = "pending"; continue; }

    if (entry.buyBack) totalBB++;

    const pickResults = entry.picks.map(t => results[t] || "pending");
    const hasLoss = pickResults.some(r => r === "lost");
    const allWon = pickResults.every(r => r === "won");
    const hasPending = pickResults.some(r => r === "pending" || r === "in_progress" || r === "scheduled");

    if (hasLoss) dayResults[entry.dayId] = "eliminated";
    else if (allWon) dayResults[entry.dayId] = "survived";
    else dayResults[entry.dayId] = "pending";

    entry.picks.forEach(t => { usedTeams.add(t); allPicks.push({ team: t, dayId: entry.dayId }); });
    lastDayResult = dayResults[entry.dayId];
  }

  // Check if permanently eliminated:
  // Lost their last played day AND either: no history entry for the next day (didn't buy back),
  // OR they've used all 3 buy-backs, OR we're past Sunday
  const lastEntry = p.history[p.history.length - 1];
  const lastDayIdx = DAYS.findIndex(d => d.id === lastEntry?.dayId);
  const nextDay = DAYS[lastDayIdx + 1];

  if (lastDayResult === "eliminated") {
    // Check if there's a next day entry (meaning they bought back)
    const hasNext = p.history.some(e => {
      const eIdx = DAYS.findIndex(d => d.id === e.dayId);
      return eIdx > lastDayIdx;
    });
    if (!hasNext && !nextDay) isPermElim = true; // No more days
    // If no next entry exists yet and next day hasn't happened, they MIGHT buy back
  }

  // Terrapin Tim / Danny: lost day1, no day2 entry = permanently eliminated
  if (p.history.length === 1 && dayResults.day1 === "eliminated") {
    const hasDay2 = p.history.some(e => e.dayId === "day2");
    if (!hasDay2) isPermElim = true;
  }

  // Duplicate check
  const seen = new Set();
  const dupes = [];
  allPicks.forEach(({ team }) => { if (seen.has(team)) dupes.push(team); seen.add(team); });

  // What picks do they need next?
  let nextPicksNeeded = 0;
  let nextIsBuyBack = false;
  if (!isPermElim && lastDayResult === "eliminated" && nextDay) {
    if (totalBB < MAX_BB) { nextPicksNeeded = nextDay.bbPicks || 0; nextIsBuyBack = true; }
  } else if (!isPermElim && (lastDayResult === "survived" || lastDayResult === "pending") && nextDay) {
    nextPicksNeeded = nextDay.advPicks;
  }

  return {
    ...p, usedTeams, allPicks, totalBB, dayResults, lastDayResult,
    isPermElim, dupes, nextPicksNeeded, nextIsBuyBack,
    money: BUY_IN + totalBB * BB_COST,
    currentStatus: isPermElim ? "out" : (dayResults.day2 || dayResults.day1 || "pending"),
  };
}

// ══════════════════════════════════════════════
// UI ATOMS
// ══════════════════════════════════════════════
const Badge = ({type}) => {
  const m = {
    survived:{bg:"#052e16",c:"#4ade80",t:"ALIVE"},
    out:{bg:"#2a0a0a",c:"#f87171",t:"OUT"},
    eliminated:{bg:"#2a0a0a",c:"#f87171",t:"ELIM TODAY"},
    pending:{bg:"#1a1a2e",c:"#94a3b8",t:"PENDING"},
    bb:{bg:"#3b2f08",c:"#fbbf24",t:"BUY-BACK"},
  };
  const s = m[type]||m.pending;
  return <span style={{background:s.bg,color:s.c,padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:".04em"}}>{s.t}</span>;
};

const Pill = ({team,result,dim}) => {
  const c = {
    won:{bg:"#052e16",c:"#4ade80",b:"#166534"},lost:{bg:"#2a0a0a",c:"#f87171",b:"#7f1d1d"},
    in_progress:{bg:"#1a1a00",c:"#fbbf24",b:"#854d0e"},scheduled:{bg:"#0f172a",c:"#94a3b8",b:"#334155"},
    pending:{bg:"#0f172a",c:"#cbd5e1",b:"#334155"},
  };
  const s = c[result]||c.pending;
  const i = result==="won"?"✓ ":result==="lost"?"✗ ":result==="in_progress"?"◉ ":"";
  return <span style={{display:"inline-flex",alignItems:"center",background:s.bg,color:s.c,
    border:`1px solid ${s.b}`,padding:"3px 9px",borderRadius:16,fontSize:11,fontWeight:600,
    whiteSpace:"nowrap",opacity:dim?.4:1,textDecoration:result==="lost"?"line-through":"none"}}>{i}{team}</span>;
};

const TBadge = ({tier}) => {
  const m = {1:{l:"SAVE",bg:"#7c3aed",c:"#fff"},2:{l:"SAVE",bg:"#6d28d9",c:"#ddd6fe"},
    3:{l:"FLEX",bg:"#1e40af",c:"#93c5fd"},4:{l:"USE NOW",bg:"#166534",c:"#4ade80"},5:{l:"BURN",bg:"#065f46",c:"#34d399"}};
  const s = m[tier]||m[4];
  return <span style={{background:s.bg,color:s.c,padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700}}>{s.l}</span>;
};

// ══════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════
export default function App() {
  const [mode, setMode] = useState("shared");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState("Dashboard");

  const isPersonal = mode === "personal";

  const handleModeToggle = () => {
    if (isPersonal) { setMode("shared"); setTab("Dashboard"); }
    else { /* show pw prompt — handled in render */ setMode("pw_prompt"); }
  };

  const handlePwSubmit = () => {
    if (pwInput === PERSONAL_PW) { setMode("personal"); setTab("Dashboard"); setPwError(false); setPwInput(""); }
    else { setPwError(true); }
  };

  const TABS = isPersonal
    ? ["Dashboard","Day 1","Day 2 (Live)","Used Teams","Schedule","Edge Lab","Money"]
    : ["Dashboard","Day 1","Day 2 (Live)","Used Teams","Schedule","Money"];

  const players = useMemo(() => PLAYERS.map(computePlayer), []);
  const active = players.filter(p => !p.isPermElim);
  const pot = players.reduce((s,p) => s + p.money, 0);
  const trevor = players.find(p => p.me);

  const teamMap = useMemo(() => {
    const m = {};
    active.forEach(p => { p.usedTeams.forEach(t => { if(!m[t]) m[t]=[]; m[t].push(p.n); }); });
    return m;
  }, []);

  const day2Freq = useMemo(() => {
    const f = {};
    active.forEach(p => {
      const d2 = p.history.find(e => e.dayId === "day2");
      d2?.picks.forEach(t => { f[t]=(f[t]||0)+1; });
    });
    return Object.entries(f).sort((a,b) => b[1]-a[1]);
  }, []);

  const edge = useMemo(() => {
    if (!isPersonal) return [];
    const ou = {};
    active.forEach(p => { if(p.me) return; p.usedTeams.forEach(t => { ou[t]=(ou[t]||0)+1; }); });
    const tot = active.length - 1;
    return Object.keys(FUT).filter(t => !trevor.usedTeams.has(t)).map(t => {
      const f=FUT[t]||{};const wp=WP[t]??0.5;const dr=f.dr||0.3;
      const u=1-(ou[t]||0)/tot; const sc=wp*0.35+(1-dr)*0.30+u*0.35;
      return {team:t,wp,dr,on:ou[t]||0,u,sc,tier:f.t||4,odds:f.o||"N/A"};
    }).sort((a,b) => b.sc-a.sc);
  }, [isPersonal]);

  const cs = {
    pg:{fontFamily:"'SF Mono','Fira Code','JetBrains Mono',monospace",background:"#080c14",color:"#e2e8f0",minHeight:"100vh"},
    hd:{background:"linear-gradient(135deg,#0c1220,#140a24)",borderBottom:"1px solid #1e293b",padding:"16px 20px 0"},
    cd:{background:"#0f1520",border:"1px solid #1e293b",borderRadius:8,padding:14,marginBottom:12},
    rw:(hl,dn)=>({display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:6,
      background:dn?"#1a0808":hl?"#140a24":"#0a0f1a",
      border:`1px solid ${dn?"#7f1d1d":hl?"#7c3aed":"#1a2030"}`,flexWrap:"wrap"}),
  };

  // ── PASSWORD PROMPT ──
  if (mode === "pw_prompt") {
    return (
      <div style={{...cs.pg,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{...cs.cd,maxWidth:360,textAlign:"center",padding:32}}>
          <div style={{fontSize:40,marginBottom:12}}>🔒</div>
          <h2 style={{fontSize:16,color:"#f8fafc",margin:"0 0 4px"}}>Personal Mode</h2>
          <p style={{fontSize:11,color:"#64748b",margin:"0 0 20px"}}>Enter password to access strategy tools</p>
          <input type="password" value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}}
            onKeyDown={e=>{if(e.key==="Enter")handlePwSubmit();}}
            placeholder="Password"
            style={{width:"100%",padding:"10px 14px",background:"#0a0f1a",border:`1px solid ${pwError?"#ef4444":"#1e293b"}`,
              borderRadius:6,color:"#e2e8f0",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:8}} />
          {pwError && <p style={{fontSize:11,color:"#ef4444",margin:"0 0 8px"}}>Incorrect password</p>}
          <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:8}}>
            <button onClick={()=>{setMode("shared");setPwInput("");setPwError(false);}}
              style={{padding:"8px 16px",background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Cancel</button>
            <button onClick={handlePwSubmit}
              style={{padding:"8px 16px",background:"#7c3aed",color:"#fff",border:"none",borderRadius:5,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Unlock</button>
          </div>
        </div>
      </div>
    );
  }

  const getD2Result = (t) => TEAM_RESULTS.day2?.[t] || "pending";

  return (
    <div style={cs.pg}>
      <div style={cs.hd}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <span style={{fontSize:24}}>🏀</span>
            <h1 style={{margin:0,fontSize:18,fontWeight:800,color:"#f8fafc"}}>SURVIVOR POOL 2026</h1>
          </div>
          <button onClick={handleModeToggle}
            style={{background:isPersonal?"#7c3aed":"#1e293b",color:isPersonal?"#fff":"#94a3b8",border:"none",
              padding:"5px 12px",borderRadius:5,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {isPersonal?"🔓 Personal":"🔒 Admin"}
          </button>
        </div>
        <p style={{margin:"2px 0 0",fontSize:11,color:"#475569"}}>
          {active.length} alive · {players.filter(p=>p.isPermElim).length} out · Day 2 Fri 3/20 · Pot: ${pot}
        </p>
        <div style={{display:"flex",gap:0,marginTop:12,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              background:tab===t?"#1a2030":"transparent",color:tab===t?"#f8fafc":"#475569",
              border:"none",borderBottom:tab===t?"2px solid #a78bfa":"2px solid transparent",
              padding:"8px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 20px",maxWidth:960,margin:"0 auto"}}>

        {/* ═══ DASHBOARD ═══ */}
        {tab==="Dashboard" && (<div>
          {isPersonal && trevor && (
            <div style={{...cs.cd,background:"linear-gradient(135deg,#140a24,#0f1520)",border:"1px solid #7c3aed"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:700,color:"#a78bfa"}}>👤 TREVOR (YOU)</span>
                <Badge type={trevor.currentStatus}/>
                <span style={{fontSize:10,color:"#64748b",marginLeft:"auto"}}>
                  BB: {trevor.totalBB}/{MAX_BB} · Paid: ${trevor.money}
                </span>
              </div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:6}}>Day 1: St. Louis ✓, Wisconsin ✗ → Bought back in Day 2</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                {trevor.history.find(e=>e.dayId==="day2")?.picks.map(t=><Pill key={t} team={t} result={getD2Result(t)}/>)}
              </div>
              <div style={{fontSize:11,color:"#ef4444",fontWeight:600,marginBottom:4}}>⚠ Santa Clara LOST → Eliminated for Day 2.</div>
              <div style={{fontSize:11,color:"#fbbf24"}}>Saturday: Buy back in (BB 2/{MAX_BB}, +$5) with 4 picks, or done for good.</div>
            </div>
          )}

          <div style={cs.cd}>
            <h3 style={{margin:"0 0 8px",fontSize:11,color:"#64748b",letterSpacing:".06em"}}>DAY 2 TEAM POPULARITY</h3>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {day2Freq.map(([t,c])=>{const r=getD2Result(t);return(
                <div key={t} style={{background:"#0a0f1a",border:"1px solid #1a2030",borderRadius:5,padding:"4px 10px",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:13,fontWeight:800,color:c>=8?"#ef4444":c>=4?"#fbbf24":"#4ade80"}}>{c}</span>
                  <span style={{fontSize:11,color:"#cbd5e1"}}>{t}</span>
                  <span style={{fontSize:10,color:r==="won"?"#4ade80":r==="lost"?"#f87171":r==="in_progress"?"#fbbf24":"#475569"}}>
                    {r==="won"?"✓":r==="lost"?"✗":r==="in_progress"?"◉":"·"}</span>
                </div>);})}
            </div>
          </div>

          <div style={cs.cd}>
            <h3 style={{margin:"0 0 8px",fontSize:11,color:"#64748b",letterSpacing:".06em"}}>ALL PARTICIPANTS — DAY 2</h3>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {players.map((p,i)=>{
                const d2 = p.history.find(e=>e.dayId==="day2");
                const st = p.currentStatus;
                return(
                <div key={i} style={cs.rw(isPersonal&&p.me,st==="eliminated"||st==="out")}>
                  <span style={{fontSize:12,fontWeight:700,color:isPersonal&&p.me?"#a78bfa":"#e2e8f0",minWidth:90}}>{p.n}</span>
                  <Badge type={st}/>
                  {d2?.buyBack&&<Badge type="bb"/>}
                  {p.totalBB>1&&<span style={{fontSize:9,color:"#fbbf24",background:"#3b2f08",padding:"1px 5px",borderRadius:3}}>BB×{p.totalBB}</span>}
                  {p.dupes.length>0&&<span style={{fontSize:9,color:"#ef4444",fontWeight:700}}>⚠ DUPE: {p.dupes.join(",")}</span>}
                  {p.nextPicksNeeded>0&&<span style={{fontSize:9,color:"#60a5fa",background:"#1e2a4a",padding:"1px 5px",borderRadius:3}}>
                    Need {p.nextPicksNeeded} Sat{p.nextIsBuyBack?" (BB)":""}
                  </span>}
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginLeft:"auto"}}>
                    {d2?.picks.map(t=><Pill key={t} team={t} result={getD2Result(t)}/>)}
                    {!d2&&<span style={{fontSize:10,color:"#475569"}}>No picks</span>}
                  </div>
                </div>);})}
            </div>
          </div>
        </div>)}

        {/* ═══ DAY 1 ═══ */}
        {tab==="Day 1" && (<div>
          <h2 style={{fontSize:15,color:"#f8fafc",margin:"0 0 4px"}}>Day 1 — Thursday 3/19</h2>
          <p style={{fontSize:11,color:"#64748b",margin:"0 0 12px"}}>Everyone picks 2. One loss = eliminated.</p>
          {players.map((p,i)=>{
            const d1 = p.history.find(e=>e.dayId==="day1");
            const survived = p.dayResults.day1==="survived";
            return(<div key={i} style={{...cs.rw(isPersonal&&p.me,!survived),marginBottom:3}}>
              <span style={{fontSize:16}}>{survived?"✅":"❌"}</span>
              <span style={{fontSize:12,fontWeight:700,color:isPersonal&&p.me?"#a78bfa":"#e2e8f0",minWidth:100}}>{p.n}</span>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {d1?.picks.map(t=><Pill key={t} team={t} result={TEAM_RESULTS.day1[t]==="won"?"won":"lost"}/>)}
              </div>
              <span style={{fontSize:10,color:"#475569",marginLeft:"auto"}}>
                {!survived&&!p.isPermElim?"→ Bought back":p.isPermElim?"DONE":""}</span>
            </div>);
          })}
        </div>)}

        {/* ═══ DAY 2 LIVE ═══ */}
        {tab==="Day 2 (Live)" && (<div>
          <h2 style={{fontSize:15,color:"#f8fafc",margin:"0 0 4px"}}>Day 2 — Friday 3/20 (TODAY)</h2>
          <p style={{fontSize:11,color:"#64748b",margin:"0 0 8px"}}>Survivors: 2 picks · Buy-backs: 4 picks · ONE loss = eliminated</p>
          <div style={{...cs.cd,overflowX:"auto"}}>
            <h3 style={{margin:"0 0 8px",fontSize:10,color:"#475569"}}>GAME STATUS</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:6}}>
              {Object.entries(SCORES.day2||{}).map(([t,s])=>{const r=getD2Result(t);return(
                <div key={t} style={{background:r==="won"?"#041a0a":r==="lost"?"#1a0808":r==="in_progress"?"#1a1800":"#0a0f1a",
                  border:`1px solid ${r==="won"?"#166534":r==="lost"?"#7f1d1d":r==="in_progress"?"#854d0e":"#1a2030"}`,borderRadius:5,padding:"5px 8px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:r==="won"?"#4ade80":r==="lost"?"#f87171":r==="in_progress"?"#fbbf24":"#94a3b8"}}>
                    {r==="in_progress"?"◉ ":""}{t}</div>
                  <div style={{fontSize:10,color:"#475569"}}>{s}</div>
                </div>);})}
            </div>
          </div>
          {active.map((p,i)=>{
            const d2=p.history.find(e=>e.dayId==="day2"); const st=p.dayResults.day2||"pending";
            return(<div key={i} style={{...cs.rw(isPersonal&&p.me,st==="eliminated"),marginBottom:3}}>
              <span style={{fontSize:12,fontWeight:700,color:isPersonal&&p.me?"#a78bfa":"#e2e8f0",minWidth:90}}>{p.n}</span>
              {d2?.buyBack&&<span style={{fontSize:9,color:"#fbbf24",background:"#3b2f08",padding:"1px 5px",borderRadius:3}}>BB{p.totalBB>1?`×${p.totalBB}`:""}</span>}
              <Badge type={st}/>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",marginLeft:"auto"}}>
                {d2?.picks.map(t=><Pill key={t} team={t} result={getD2Result(t)}/>)}
              </div>
            </div>);})}
        </div>)}

        {/* ═══ USED TEAMS ═══ */}
        {tab==="Used Teams" && (<div>
          <h2 style={{fontSize:15,color:"#f8fafc",margin:"0 0 4px"}}>Used Teams Tracker</h2>
          <p style={{fontSize:11,color:"#64748b",margin:"0 0 14px"}}>Cannot pick a team you've already used. Verified against source images.</p>
          <div style={cs.cd}>
            <h3 style={{margin:"0 0 10px",fontSize:11,color:"#64748b",letterSpacing:".06em"}}>BY PLAYER</h3>
            {players.filter(p=>!p.isPermElim).map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",marginBottom:3,borderRadius:5,
                background:isPersonal&&p.me?"#140a24":"#0a0f1a",border:`1px solid ${isPersonal&&p.me?"#7c3aed":"#1a2030"}`,flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:700,color:isPersonal&&p.me?"#a78bfa":"#e2e8f0",minWidth:95}}>{p.n}</span>
                <span style={{fontSize:10,color:"#475569",minWidth:16}}>{p.usedTeams.size}</span>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {p.allPicks.map((pk,j)=>(
                    <span key={j} style={{display:"inline-flex",alignItems:"center",gap:3,
                      background:"#0f172a",border:"1px solid #1e293b",padding:"2px 8px",borderRadius:12,fontSize:10,color:"#cbd5e1"}}>
                      {pk.team}<span style={{fontSize:8,color:"#475569"}}>{pk.dayId==="day1"?"D1":"D2"}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1e293b"}}>
              <span style={{fontSize:10,color:"#475569"}}>ELIMINATED:</span>
              {players.filter(p=>p.isPermElim).map((p,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",marginTop:3,borderRadius:5,background:"#0a0a0a",opacity:.5}}>
                  <span style={{fontSize:11,fontWeight:600,color:"#f87171",minWidth:95}}>{p.n}</span>
                  <div style={{display:"flex",gap:4}}>
                    {[...p.usedTeams].map(t=><span key={t} style={{fontSize:10,color:"#64748b",background:"#1a1a1a",padding:"2px 6px",borderRadius:8}}>{t}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={cs.cd}>
            <h3 style={{margin:"0 0 10px",fontSize:11,color:"#64748b",letterSpacing:".06em"}}>BY TEAM</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:6}}>
              {Object.entries(teamMap).sort((a,b)=>b[1].length-a[1].length).map(([team,pls])=>(
                <div key={team} style={{background:"#0a0f1a",border:"1px solid #1a2030",borderRadius:6,padding:"8px 10px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:700,color:"#e2e8f0"}}>{team}</span>
                    <span style={{fontSize:11,fontWeight:800,color:pls.length>=8?"#ef4444":pls.length>=4?"#fbbf24":"#4ade80"}}>{pls.length}</span>
                  </div>
                  <div style={{fontSize:10,color:"#94a3b8",lineHeight:1.6}}>{pls.join(", ")}</div>
                </div>
              ))}
            </div>
          </div>
        </div>)}

        {/* ═══ SCHEDULE ═══ */}
        {tab==="Schedule" && (<div>
          <h2 style={{fontSize:15,color:"#f8fafc",margin:"0 0 12px"}}>Upcoming Games</h2>
          {[
            {label:"TONIGHT (Fri 3/20)",sub:"Remaining first round",games:[
              {t:"6:50 PM",m:"(8) Clemson vs (9) Iowa"},{t:"7:10 PM",m:"(5) St. John's vs (12) N. Iowa"},
              {t:"7:25 PM",m:"(7) UCLA vs (10) UCF"},{t:"7:35 PM",m:"(2) Purdue vs (15) Queens"},
              {t:"9:25 PM",m:"(1) Florida vs (16) Prairie View"},{t:"9:45 PM",m:"(4) Kansas vs (13) Cal Baptist"},
              {t:"10:00 PM",m:"(2) UConn vs (15) Furman"},{t:"10:10 PM",m:"(7) Miami FL vs (10) Missouri"},
            ]},
            {label:"SAT 3/21 — Round of 32",sub:"Advancing: 1 pick · Buy-back: 4 picks",games:[
              {t:"12:10 PM",m:"(1) Michigan vs (9) Saint Louis"},{t:"2:45 PM",m:"(4) Michigan State vs (5) Louisville"},
              {t:"5:15 PM",m:"(1) Duke vs (8) TCU"},{t:"6:10 PM",m:"(1) Houston vs (5) Texas A&M"},
              {t:"7:00 PM",m:"UNC Wilmington vs Dayton"},{t:"7:10 PM",m:"(3) Gonzaga vs (6) Texas"},
              {t:"7:50 PM",m:"(3) Illinois vs (6) VCU"},{t:"8:45 PM",m:"(4) Nebraska vs (5) Vanderbilt"},
              {t:"9:00 PM",m:"Nevada vs Liberty"},{t:"9:45 PM",m:"(3) Arkansas vs (14) High Point"},
            ]},
            {label:"SUN 3/22 — Round of 32",sub:"Advancing: 1 pick · Buy-back: 4 picks · ⚠ LAST BUY-BACK DAY",games:[
              {t:"TBD",m:"Fri evening winners — R2 matchups"},
              {t:"4:30 PM",m:"Wake Forest vs Illinois State"},{t:"6:30 PM",m:"(1) Auburn vs Seattle"},
              {t:"7:00 PM",m:"Tulsa vs UNLV"},{t:"8:00 PM",m:"New Mexico vs George Washington"},
              {t:"8:30 PM",m:"Oklahoma State vs Wichita State"},{t:"9:00 PM",m:"California vs Saint Joseph's"},
            ]},
          ].map((sec,si)=>(
            <div key={si} style={{marginBottom:20}}>
              <h3 style={{fontSize:12,color:"#a78bfa",margin:"0 0 2px"}}>{sec.label}</h3>
              <p style={{fontSize:10,color:"#475569",margin:"0 0 8px"}}>{sec.sub}</p>
              {sec.games.map((g,gi)=>{
                const teams=g.m.replace(/\(\d+\)\s*/g,"").split(" vs ");
                const t1=teams[0]?.trim();const t2=teams[1]?.trim();
                const u1=teamMap[t1];const u2=teamMap[t2];
                return(<div key={gi} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",
                  background:"#0a0f1a",border:"1px solid #1a2030",borderRadius:5,marginBottom:3,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:"#475569",minWidth:65}}>{g.t}</span>
                  <span style={{fontSize:11,color:"#e2e8f0",flex:1}}>{g.m}</span>
                  {(u1||u2)&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {u1&&<span style={{fontSize:9,color:"#f87171",background:"#1a0808",padding:"1px 5px",borderRadius:3}}>{t1}: {u1.length} used</span>}
                    {u2&&<span style={{fontSize:9,color:"#f87171",background:"#1a0808",padding:"1px 5px",borderRadius:3}}>{t2}: {u2.length} used</span>}
                  </div>}
                </div>);
              })}
            </div>
          ))}
        </div>)}

        {/* ═══ EDGE LAB ═══ */}
        {tab==="Edge Lab"&&isPersonal&&(<div>
          <h2 style={{fontSize:15,color:"#f8fafc",margin:"0 0 2px"}}>Edge Lab — Trevor's Strategy</h2>
          <p style={{fontSize:11,color:"#64748b",margin:"0 0 14px"}}>Win prob × expendability × uniqueness. DEPTH = projected tournament run (futures odds). RED = save for later.</p>
          <div style={cs.cd}>
            <h3 style={{margin:"0 0 6px",fontSize:10,color:"#475569"}}>TEAMS ALREADY BURNED ({trevor.usedTeams.size})</h3>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{[...trevor.usedTeams].map(t=><Pill key={t} team={t} dim/>)}</div>
          </div>
          <div style={{...cs.cd,background:"#140a24",border:"1px solid #7c3aed"}}>
            <h3 style={{margin:"0 0 6px",fontSize:11,color:"#a78bfa"}}>SATURDAY STRATEGY (BUY-BACK #{trevor.totalBB+1})</h3>
            <div style={{fontSize:11,color:"#cbd5e1",lineHeight:1.7}}>
              <p style={{margin:"0 0 6px"}}>You need <strong style={{color:"#fbbf24"}}>4 picks Saturday</strong>.</p>
              <p style={{margin:"0 0 4px"}}><span style={{color:"#4ade80"}}>🟢 USE NOW:</span> Nebraska, High Point, Vanderbilt, TCU, VCU — short runs, burn them now.</p>
              <p style={{margin:"0 0 4px"}}><span style={{color:"#ef4444"}}>🔴 SAVE:</span> Florida, Duke, Arizona, Houston, Michigan, Illinois, Iowa State, Purdue — need these Sweet 16+.</p>
              <p style={{margin:"0 0 4px"}}><span style={{color:"#60a5fa"}}>🔵 FLEX:</span> Virginia, Michigan State, St. John's, Gonzaga, Kentucky, Arkansas.</p>
              <p style={{margin:"0 0 4px"}}><span style={{color:"#fbbf24"}}>⚡ UNIQUENESS:</span> Kansas picked by 9+ people. Shared paths reduce your edge to win the pool.</p>
              <p style={{margin:0,color:"#94a3b8",fontSize:10}}>After Sunday: no buy-backs. 1 pick/day. Deep-run teams are essential.</p>
            </div>
          </div>
          <div style={cs.cd}>
            <h3 style={{margin:"0 0 8px",fontSize:10,color:"#475569"}}>AVAILABLE TEAMS RANKED</h3>
            <div style={{fontSize:9,color:"#475569",marginBottom:8}}>Score = 35% win prob + 30% expendability + 35% uniqueness</div>
            <div style={{overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"28px 1fr 50px 55px 55px 55px 55px 50px",gap:4,padding:"4px 6px",fontSize:9,color:"#475569",fontWeight:700,minWidth:500}}>
                <span>#</span><span>TEAM</span><span>WIN%</span><span>DEPTH</span><span>UNIQ</span><span>SCORE</span><span>TIER</span><span>ODDS</span>
              </div>
              {edge.map((t,i)=>(
                <div key={t.team} style={{display:"grid",gridTemplateColumns:"28px 1fr 50px 55px 55px 55px 55px 50px",
                  gap:4,padding:"5px 6px",borderRadius:4,fontSize:11,alignItems:"center",
                  background:i<3?"#0a1a0a":i<8?"#0a0f1a":"#080c14",
                  border:i<3?"1px solid #166534":"1px solid transparent",minWidth:500}}>
                  <span style={{color:i<3?"#4ade80":"#475569",fontWeight:700}}>{i+1}</span>
                  <span style={{fontWeight:600,color:"#e2e8f0"}}>{t.team}</span>
                  <span style={{color:t.wp>=.8?"#4ade80":t.wp>=.5?"#fbbf24":"#f87171"}}>{(t.wp*100).toFixed(0)}%</span>
                  <span style={{color:t.dr>=.7?"#f87171":t.dr>=.4?"#fbbf24":"#4ade80",fontSize:10}}>
                    {t.dr>=.7?"DEEP":t.dr>=.4?"MED":"SHORT"}</span>
                  <span style={{color:t.u>=.8?"#4ade80":t.u>=.5?"#fbbf24":"#f87171"}}>{(t.u*100).toFixed(0)}%</span>
                  <span style={{fontWeight:800,color:t.sc>=.7?"#4ade80":t.sc>=.5?"#fbbf24":"#94a3b8"}}>{(t.sc*100).toFixed(0)}</span>
                  <TBadge tier={t.tier}/>
                  <span style={{fontSize:9,color:"#475569"}}>{t.odds}</span>
                </div>
              ))}
            </div>
          </div>
        </div>)}

        {/* ═══ MONEY ═══ */}
        {tab==="Money" && (<div>
          <h2 style={{fontSize:15,color:"#f8fafc",margin:"0 0 4px"}}>Money Tracker</h2>
          <p style={{fontSize:11,color:"#64748b",margin:"0 0 14px"}}>$15 buy-in + $5 per buy-back (max 3)</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            {[{v:`$${pot}`,l:"TOTAL POT",c:"#4ade80"},
              {v:`$${players.reduce((s,p)=>s+p.totalBB*BB_COST,0)}`,l:"FROM BUY-BACKS",c:"#fbbf24"},
              {v:players.filter(p=>p.totalBB>0).length,l:"BOUGHT BACK",c:"#a78bfa"}
            ].map((s,i)=>(
              <div key={i} style={{...cs.cd,textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:800,color:s.c}}>{s.v}</div>
                <div style={{fontSize:10,color:"#475569"}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={cs.cd}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 60px 50px 60px 60px",gap:8,padding:"4px 8px",fontSize:9,color:"#475569",fontWeight:700}}>
              <span>PLAYER</span><span>BB USED</span><span>BB LEFT</span><span>TOTAL $</span><span>STATUS</span>
            </div>
            {[...players].sort((a,b)=>b.money-a.money).map((p,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 60px 50px 60px 60px",gap:8,
                padding:"6px 8px",borderRadius:4,fontSize:12,alignItems:"center",
                background:isPersonal&&p.me?"#140a24":i%2===0?"#0a0f1a":"#080c14"}}>
                <span style={{fontWeight:600,color:isPersonal&&p.me?"#a78bfa":"#e2e8f0"}}>{p.n}</span>
                <span style={{color:p.totalBB>0?"#fbbf24":"#475569",textAlign:"center"}}>{p.totalBB>0?p.totalBB:"—"}</span>
                <span style={{color:p.isPermElim?"#475569":MAX_BB-p.totalBB<=1?"#ef4444":"#94a3b8",textAlign:"center"}}>
                  {p.isPermElim?"—":MAX_BB-p.totalBB}
                </span>
                <span style={{fontWeight:700,color:"#4ade80",textAlign:"center"}}>${p.money}</span>
                <Badge type={p.isPermElim?"out":"survived"}/>
              </div>
            ))}
          </div>
        </div>)}
      </div>

      <div style={{textAlign:"center",padding:20,fontSize:10,color:"#334155"}}>
        Survivor Pool 2026 · {isPersonal?"🔓 Personal Mode":"Shared Mode"} · Ask Claude to refresh scores
      </div>
    </div>
  );
}
