import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

async function readJsonFile(filepath: string) {
  try {
    const content = await fs.readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch { return null; }
}

export async function GET() {
  const pipelineState = await readJsonFile("/var/lib/mimule/pipeline-state.json");
  
  const queue = pipelineState?.queue || [];
  const current = pipelineState?.current;
  const completed = pipelineState?.completed || [];
  
  return NextResponse.json({
    queue,
    current,
    completed: completed.slice(0, 20),
    stats: {
      queued: queue.length,
      completed24h: completed.length,
      failed: completed.filter((s: { status: string }) => s.status === "stuck" || s.status === "failed").length,
    },
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cmd, topic, vertical } = body;
    
    if (cmd === "add" && topic && vertical) {
      const response = await fetch("http://127.0.0.1:3200/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, topic, vertical }),
      });
      
      const result = await response.text();
      return NextResponse.json({ success: true, result });
    }
    
    if (cmd === "kill" && body.storyId) {
      const response = await fetch("http://127.0.0.1:3200/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "kill", id: body.storyId }),
      });
      
      const result = await response.text();
      return NextResponse.json({ success: true, result });
    }
    
    return NextResponse.json({ error: "Unknown command" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}