import { NextResponse } from "next/server";
import fs from "fs/promises";

async function readJsonFile(filepath: string) {
  try {
    const content = await fs.readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch { return null; }
}

export async function GET() {
  const modelHealth = await readJsonFile("/var/lib/mimule/model-health.json");
  const gpuHealth = await readJsonFile("/var/lib/mimule/gpu-health.json");
  
  return NextResponse.json({
    models: modelHealth?.models || [],
    providers: modelHealth?.providers || [],
    gpu: gpuHealth,
    timestamp: new Date().toISOString(),
  });
}