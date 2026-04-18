import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function run(cmd: string) {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return stdout.trim();
  } catch { return null; }
}

export async function GET() {
  const paperclipStatus = await run("docker ps --filter 'name=paperclip' --format '{{.Status}}'");
  const paperclipContainers = await run("docker ps --filter 'name=paperclip' --format '{{.Names}}: {{.Status}}'");
  
  const telegramLastMsg = await run("tail -1 /var/log/mimoun/telegram.log 2>/dev/null || echo 'No logs'");
  
  return NextResponse.json({
    paperclip: {
      running: paperclipStatus?.includes("Up") || false,
      containers: paperclipContainers?.split("\n").filter(Boolean) || [],
    },
    channels: {
      telegram: paperclipStatus?.includes("Up") ? "active" : "inactive",
    },
    lastUpdate: new Date().toISOString(),
  });
}