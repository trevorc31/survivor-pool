import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const RESULTS_PATH = path.join(process.cwd(), "data", "results.json");

export async function GET() {
  const data = await fs.readFile(RESULTS_PATH, "utf-8");
  return NextResponse.json(JSON.parse(data));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { dayId, teamResults, scores } = body;

  if (!dayId) {
    return NextResponse.json(
      { error: "Missing required field: dayId" },
      { status: 400 }
    );
  }

  const data = JSON.parse(await fs.readFile(RESULTS_PATH, "utf-8"));

  if (teamResults) {
    data.teamResults[dayId] = {
      ...(data.teamResults[dayId] || {}),
      ...teamResults,
    };
  }

  if (scores) {
    data.scores[dayId] = {
      ...(data.scores[dayId] || {}),
      ...scores,
    };
  }

  await fs.writeFile(RESULTS_PATH, JSON.stringify(data, null, 2));

  return NextResponse.json({ success: true, data });
}
