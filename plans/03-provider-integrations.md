# Feature 03: Provider Integrations - OpenRouter, Groq, GitHub

**File**: `03-provider-integrations.md`
**Priority**: P0 (Critical)
**Month**: 2 (June 2026)

---

## Overview

Add visibility into provider-level quotas and limits: OpenRouter, Groq, GitHub Models. Show daily usage vs limits, rate limits, and cooldown states.

---

## Data Sources

| Provider | Source | Data Needed |
|----------|---------|------------|
| OpenRouter | API `/user/info` + `/models` |
| Groq | API `/v1/usage` via API key |
| GitHub | Azure AI inference API |

---

## Implementation

### 1. Provider Client (`src/lib/providers/client.ts`)

```typescript
import fs from "fs/promises";

// --- OpenRouter ---
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

interface OpenRouterUser {
  id: string;
  email: string;
  credits_total: number;
  credits_used: number;
  limit_type: string;
}

async function getOpenRouterUser(): Promise<OpenRouterUser | null> {
  if (!OPENROUTER_KEY) return null;
  const res = await fetch(`${OPENROUTER_BASE}/user/info`, {
    headers: { "Authorization": `Bearer ${OPENROUTER_KEY}` }
  });
  if (!res.ok) return null;
  return res.json();
}

// --- Groq ---
const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_KEY = process.env.GROQ_API_KEY;

interface GroqUsage {
  used: number;
  limit: number;
  total: number;
}

async function getGroqUsage(): Promise<GroqUsage | null> {
  if (!GROQ_KEY) return null;
  const res = await fetch(`${GROQ_BASE}/usage`, {
    headers: { "Authorization": `Bearer ${GROQ_KEY}` }
  });
  if (!res.ok) return null;
  return res.json();
}

// --- GitHub ---
const GITHUB_BASE = "https://models.inference.ai.azure.com";
const GITHUB_KEY = process.env.GITHUB_TOKEN;

async function getGitHubUsage(): Promise<{ used: number; limit: number } | null> {
  if (!GITHUB_KEY) return null;
  // GitHub doesn't have direct usage API, derive from logs or estimate
  return { used: 0, limit: 0 }; // Placeholder - would need local tracking
}

export { getOpenRouterUser, getGroqUsage, getGitHubUsage };
```

### 2. Provider State Types (`src/lib/providers/types.ts`)

```typescript
type ProviderId = "openrouter" | "groq" | "github" | "zen" | "anthropic" | "openai";

interface ProviderQuota {
  provider: ProviderId;
  used?: number;
  limit?: number;
  remaining?: number;
  resetAt?: number;
  status: "ok" | "degraded" | "rate_limited" | "error";
  lastCheck: number;
  error?: string;
}

interface ProviderQuotaHistory {
  provider: ProviderId;
  history: Array<{
    timestamp: number;
    used: number;
  }>;
}

interface ProviderState {
  providers: ProviderQuota[];
  overall: "ok" | "degraded" | "critical";
}
```

### 3. Provider API Route (`src/app/api/providers/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { getOpenRouterUser, getGroqUsage, getGitHubUsage } from "@/lib/providers/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const [or, groq, gh] = await Promise.all([
    getOpenRouterUser().catch(() => null),
    getGroqUsage().catch(() => null),
    getGitHubUsage().catch(() => null),
  ]);
  
  const providers: Array<{
    id: string;
    used?: number;
    limit?: number;
    remaining?: number;
    status: "ok" | "degraded" | "rate_limited" | "error";
  }> = [];
  
  // OpenRouter
  if (or) {
    providers.push({
      id: "openrouter",
      used: or.credits_used,
      limit: or.credits_total,
      remaining: or.credits_total - or.credits_used,
      status: or.credits_used / or.credits_total > 0.9 ? "degraded" : "ok",
    });
  } else {
    providers.push({ id: "openrouter", status: "error" });
  }
  
  // Groq
  if (groq) {
    providers.push({
      id: "groq",
      used: groq.used,
      limit: groq.limit,
      remaining: groq.limit - groq.used,
      status: groq.used / groq.limit > 0.9 ? "degraded" : "ok",
    });
  } else {
    providers.push({ id: "groq", status: "error" });
  }
  
  // GitHub
  if (gh && gh.limit > 0) {
    providers.push({
      id: "github",
      used: gh.used,
      limit: gh.limit,
      remaining: Math.max(0, gh.limit - gh.used),
      status: "ok",
    });
  }
  
  return NextResponse.json({
    generatedAt: Date.now(),
    providers,
    overall: providers.some(p => p.status === "error") ? "degraded" : "ok",
  });
}
```

### 4. Provider Status Component (`src/app/providers/ProvidersStatus.tsx`)

```typescript
"use client";

import { useEffect, useState } from "react";

interface Provider {
  id: string;
  used?: number;
  limit?: number;
  remaining?: number;
  status: "ok" | "degraded" | "rate_limited" | "error";
}

interface ProviderState {
  generatedAt: number;
  providers: Provider[];
  overall: string;
}

const providerLabels: Record<string, string> = {
  openrouter: "OpenRouter",
  groq: "Groq",
  github: "GitHub Models",
  zen: "OpenCode Zen",
};

const statusColors: Record<string, string> = {
  ok: "text-green-400",
  degraded: "text-yellow-400",
  rate_limited: "text-red-400",
  error: "text-red-500",
};

export function ProvidersStatus() {
  const [data, setData] = useState<ProviderState | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetch() {
      try {
        const res = await fetch("/api/providers");
        if (res.ok) setData(await res.json());
      } finally { setLoading(false); }
    }
    fetch();
    const i = setInterval(fetch, 30000);
    return () => clearInterval(i);
  }, []);
  
  if (loading) return <div className="animate-pulse">Loading providers...</div>;
  if (!data) return <div className="text-red-500">Provider API unavailable</div>;
  
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Provider</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Used</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Limit</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Remaining</th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.providers.map(p => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 text-sm font-medium">{providerLabels[p.id] || p.id}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {p.used !== undefined 
                    ? `$${p.used.toFixed(2)}` 
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {p.limit !== undefined 
                    ? `$${p.limit.toFixed(2)}` 
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  {p.remaining !== undefined 
                    ? `$${p.remaining.toFixed(2)}` 
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-medium ${statusColors[p.status]}`}>
                  {p.status.replace("_", " ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <p className="text-xs text-muted-foreground text-right">
        Updated {new Date(data.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
```

### 5. Add to Providers Page

Create `/app/providers/page.tsx` or add section to `/app/models/page.tsx`.

---

## File List

| File | Purpose |
|------|----------|
| `src/lib/providers/client.ts` | Provider API clients |
| `src/lib/providers/types.ts` | Type definitions |
| `src/app/api/providers/route.ts` | API endpoint |
| `src/app/providers/page.tsx` | Provider status page |
| `src/app/providers/ProvidersStatus.tsx` | Status component |

---

## Exit Criteria

- [ ] OpenRouter credits visible
- [ ] Groq usage limits visible
- [ ] Status per provider (ok/degraded/error)
- [ ] Graceful degradation if API unavailable