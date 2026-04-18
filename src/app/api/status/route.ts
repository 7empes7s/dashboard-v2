import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

async function readJsonFile(filepath: string) {
  try {
    const content = await fs.readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function GET() {
  const basePath = "/var/lib/mimule";
  
  const [pipelineState, modelHealth, gpuHealth] = await Promise.all([
    readJsonFile(path.join(basePath, "pipeline-state.json")),
    readJsonFile(path.join(basePath, "model-health.json")),
    readJsonFile(path.join(basePath, "gpu-health.json")),
  ]);

  return NextResponse.json({
    pipeline: pipelineState,
    modelHealth,
    gpuHealth,
    timestamp: new Date().toISOString(),
  });
}