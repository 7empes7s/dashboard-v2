import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const healthPath = "/var/lib/mimule/gpu-health.json";
  
  if (!existsSync(healthPath)) {
    return NextResponse.json(
      { status: "unknown", error: "Health file not found" },
      { status: 404 }
    );
  }
  
  try {
    const content = await readFile(healthPath, "utf-8");
    const health = JSON.parse(content);
    
    return NextResponse.json({
      status: health.status,
      models: health.models || [],
      probe_ms: health.probe_ms,
      checked_at: health.checked_at,
      since: health.since,
      reason: health.reason,
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: String(err) },
      { status: 500 }
    );
  }
}