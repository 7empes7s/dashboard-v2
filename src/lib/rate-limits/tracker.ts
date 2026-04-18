import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface RateLimitIncident {
  provider: string;
  model: string;
  errorType: "rate_limit" | "token_limit" | "hard_limit";
  error: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
}

export interface SessionStats {
  sessionId: string;
  tool: "claude" | "codex" | "opencode";
  messages: number;
  tokens: number;
  startedAt: number;
  lastActivity: number;
}

async function getRecentRateLimitErrors(): Promise<RateLimitIncident[]> {
  try {
    const { stdout } = await execAsync(
      `journalctl -u litellm.service -n 500 --no-pager 2>/dev/null | grep -i "rate limit" || true`,
      { timeout: 5000 }
    );
    
    const incidents: Map<string, RateLimitIncident> = new Map();
    const lines = stdout.split("\n").filter(Boolean);
    
    for (const line of lines) {
      const match = line.match(/HTTP\s+(\d+).*model[:\s]+([^\s]+)/);
      if (!match) continue;
      
      const code = parseInt(match[1]);
      const model = match[2];
      const key = model;
      
      if (incidents.has(key)) {
        const inc = incidents.get(key)!;
        inc.count++;
        inc.lastSeen = Date.now();
      } else {
        incidents.set(key, {
          provider: model.split("/")[0],
          model,
          errorType: code === 429 ? "rate_limit" : "hard_limit",
          error: line.slice(0, 200),
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          count: 1,
        });
      }
    }
    
    return Array.from(incidents.values());
  } catch {
    return [];
  }
}

async function getSessionStats(): Promise<SessionStats[]> {
  return [];
}

export { getRecentRateLimitErrors, getSessionStats };