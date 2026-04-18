# Feature 04: Rate Limit Tracking - Claude/Codex Session Quotas

**File**: `04-rate-limit-tracking.md`
**Priority**: P1 
**Month**: 2 (June 2026)

---

## Overview

Track Claude and Codex session and rate limits. Since direct API access isn't available, derive from logs and activity.

---

## Implementation Strategy

Since we cannot directly query Claude/Codex quota APIs:
1. Parse request logs for rate limit errors
2. Track session usage from OpenClaw/Mimule logs
3. Show confidence level (direct/derived/estimated)

---

## Data Sources

| Source | Path | Data |
|--------|------|------|
| OpenClaw logs | `docker logs openclaw_gateway` | Sessions, rate limits |
| LiteLLM logs | `journalctl -u litellm.service` | Model errors |
| Model health | `/var/lib/mimule/model-health.json` | Rate limit incidents |

---

## Implementation

### 1. Rate Limit Tracker (`src/lib/rate-limits/tracker.ts`)

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface RateLimitIncident {
  provider: string;
  model: string;
  errorType: "rate_limit" | "token_limit" | "hard_limit";
  error: string;
  firstSeen: number;
  lastSeen: number;
  count: number;
}

async function getRecentRateLimitErrors(): Promise<RateLimitIncident[]> {
  try {
    const { stdout } = await execAsync(
      `journalctl -u litellm.service -n 500 --no-pager | grep -i "rate limit" || true`,
      { timeout: 5000 }
    );
    
    const incidents: Map<string, RateLimitIncident> = new Map();
    const lines = stdout.split("\n").filter(Boolean);
    
    for (const line of lines) {
      // Parse rate limit errors from logs
      // Format: "2026-04-18T20:11:34 error: HTTP 429, model: groq/gpt-oss-120b"
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

interface SessionStats {
  sessionId: string;
  tool: "claude" | "codex" | "opencode";
  messages: number;
  tokens: number;
  startedAt: number;
  lastActivity: number;
}

async function getSessionStats(): Promise<SessionStats[]> {
  // Would need to parse OpenClaw session logs
  return []; // Placeholder
}

export type { RateLimitIncident, SessionStats };
export { getRecentRateLimitErrors, getSessionStats };
```

### 2. Rate Limit API Route (`src/app/api/rate-limits/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { getRecentRateLimitErrors } from "@/lib/rate-limits/tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  const incidents = await getRecentRateLimitErrors();
  
  const byTool = {
    claude: incidents.filter(i => i.provider === "anthropic").length,
    codex: incidents.filter(i => i.provider === "openai").length,
    opencode: incidents.filter(i => ["groq", "openrouter", "github"].includes(i.provider)).length,
  };
  
  return NextResponse.json({
    generatedAt: Date.now(),
    confidence: "derived", // We can't see quotas directly
    incidents,
    summary: {
      totalIncidents: incidents.reduce((sum, i) => sum + i.count, 0),
      byTool,
    },
  });
}
```

### 3. Rate Limit Status Component

Create `/app/rate-limits/RateLimitStatus.tsx` - similar pattern to ProviderStatus.

---

## File List

| File | Purpose |
|------|----------|
| `src/lib/rate-limits/tracker.ts` | Log parser |
| `src/app/api/rate-limits/route.ts` | API endpoint |
| `src/app/rate-limits/page.tsx` | Status page |

---

## Exit Criteria

- [ ] Recent rate limit errors surfaced
- [ ] Confidence labeled as "derived"
- [ ] Count per provider shown