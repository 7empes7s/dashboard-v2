import { NextResponse } from "next/server";
import fs from "fs/promises";

async function readJsonFile(filepath: string) {
  try {
    const content = await fs.readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch { return null; }
}

export async function GET() {
  const pipelineState = await readJsonFile("/var/lib/mimule/pipeline-state.json");
  
  const completed = pipelineState?.completed || [];
  
  const recentIncidents = completed
    .filter((s: { status: string }) => s.status === "stuck" || s.status === "failed")
    .slice(0, 10)
    .map((s: { id: string; topic?: string; stage: string; failedAt?: number; lastError?: string }) => ({
      id: s.id,
      topic: s.topic,
      stage: s.stage,
      error: s.lastError,
      timestamp: s.failedAt,
    }));

  return NextResponse.json({
    incidents: recentIncidents,
    totalRuns: completed.length,
    timestamp: new Date().toISOString(),
  });
}