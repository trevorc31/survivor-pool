import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const PLAYERS_PATH = path.join(process.cwd(), "data", "players.json");

export async function GET() {
  const data = await fs.readFile(PLAYERS_PATH, "utf-8");
  return NextResponse.json(JSON.parse(data));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { playerName, dayId, picks, buyBack } = body;

  if (!playerName || !dayId || !picks || !Array.isArray(picks)) {
    return NextResponse.json(
      { error: "Missing required fields: playerName, dayId, picks" },
      { status: 400 }
    );
  }

  const data = JSON.parse(await fs.readFile(PLAYERS_PATH, "utf-8"));
  const player = data.find(
    (p: { n: string }) => p.n === playerName
  );

  if (!player) {
    return NextResponse.json(
      { error: `Player "${playerName}" not found` },
      { status: 404 }
    );
  }

  const existingEntry = player.history.findIndex(
    (h: { dayId: string }) => h.dayId === dayId
  );

  if (existingEntry >= 0) {
    player.history[existingEntry] = { dayId, picks, buyBack: !!buyBack };
  } else {
    player.history.push({ dayId, picks, buyBack: !!buyBack });
  }

  await fs.writeFile(PLAYERS_PATH, JSON.stringify(data, null, 2));

  return NextResponse.json({ success: true, player });
}
