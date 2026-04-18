# Feature 10: API Key Status - Missing Key Detection

**File**: `10-api-key-status.md`
**Priority**: P0 (Critical)
**Month**: 1 (May 2026)

---

## Overview

Detect which API keys exist, which are missing/exhausted, and surface issues immediately.

---

## Implementation

### 1. Key Detector (`src/lib/api-keys/detector.ts`)

```typescript
import fs from "fs/promises";
import path from "path";

const LITELLM_ENV = "/etc/litellm/litellm.env";

interface KeyStatus {
  key: string;
  name: string;
  exists: boolean;
  value?: string;
  status: "ok" | "missing" | "exhausted" | "unknown";
}

const KEY_MAPPING = [
  { env: "GROQ_API_KEY", name: "Groq", provider: "groq" },
  { env: "OPENROUTER_API_KEY", name: "OpenRouter", provider: "openrouter" },
  { env: "GITHUB_TOKEN", name: "GitHub Models", provider: "github" },
  { env: "OPENCODE_ZEN_KEY", name: "OpenCode Zen", provider: "zen" },
  { env: "ANTHROPIC_API_KEY", name: "Anthropic Claude", provider: "anthropic" },
  { env: "OPENAI_API_KEY", name: "OpenAI", provider: "openai" },
  { env: "VAST_API_KEY", name: "Vast.ai", provider: "vast" },
];

async function detectKeys(): Promise<KeyStatus[]> {
  try {
    const content = await fs.readFile(LITELLM_ENV, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    const envMap = new Map<string, string>();
    
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        envMap.set(key, valueParts.join("=").trim());
      }
    }
    
    return KEY_MAPPING.map(({ env, name }) => {
      const value = envMap.get(env);
      const exists = !!value && value.length > 0;
      
      return {
        key: env,
        name,
        exists,
        value: exists ? value?.slice(0, 8) + "..." : undefined,
        status: exists ? "ok" : "missing",
      };
    });
  } catch {
    return KEY_MAPPING.map(({ env, name }) => ({
      key: env,
      name,
      exists: false,
      status: "missing" as const,
    }));
  }
}

// Check for exhausted keys from model health
async function getExhaustedKeys(): Promise<string[]> {
  try {
    const health = await fs.readFile("/var/lib/mimule/model-health.json", "utf-8");
    const parsed = JSON.parse(health);
    const exhausted: string[] = [];
    
    for (const model of parsed.models || []) {
      if (!model.available && model.error?.includes("exhausted")) {
        exhausted.push(model.logicalName);
      }
    }
    
    return exhausted;
  } catch {
    return [];
  }
}

export type { KeyStatus };
export { detectKeys, getExhaustedKeys };
```

### 2. API Keys Route (`src/app/api/keys/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { detectKeys, getExhaustedKeys } from "@/lib/api-keys/detector";

export const dynamic = "force-dynamic";

export async function GET() {
  const [keys, exhausted] = await Promise.all([
    detectKeys(),
    getExhaustedKeys(),
  ]);
  
  // Mark exhausted keys
  const withExhausted = keys.map(k => ({
    ...k,
    status: exhausted.includes(k.name.toLowerCase()) ? "exhausted" : k.status,
  }));
  
  const missing = withExhausted.filter(k => k.status === "missing");
  const exhaustedList = withExhausted.filter(k => k.status === "exhausted");
  
  return NextResponse.json({
    generatedAt: Date.now(),
    keys: withExhausted,
    summary: {
      total: withExhausted.length,
      ok: withExhausted.filter(k => k.status === "ok").length,
      missing: missing.length,
      exhausted: exhaustedList.length,
    },
    issues: [
      ...missing.map(k => ({ severity: "critical", key: k.name, message: "Missing API key" })),
      ...exhaustedList.map(k => ({ severity: "warning", key: k.name, message: "API key exhausted" })),
    ],
  });
}
```

### 3. API Keys Component (`src/app/keys/KeysStatus.tsx`)

```typescript
"use client";

import { useEffect, useState } from "react";

interface KeyStatus {
  key: string;
  name: string;
  status: "ok" | "missing" | "exhausted";
}

export function KeysStatus() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);
  
  if (loading) return <div className="animate-pulse">Checking keys...</div>;
  
  const statusColors: Record<string, string> = {
    ok: "text-green-400",
    missing: "text-red-400",
    exhausted: "text-yellow-400",
  };
  
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Key</th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.keys?.map((k: KeyStatus) => (
              <tr key={k.key} className="border-t border-border">
                <td className="px-4 py-3 text-sm font-medium">{k.name}</td>
                <td className={`px-4 py-3 text-sm font-medium ${statusColors[k.status]}`}>
                  {k.status === "ok" ? "✓" : k.status === "missing" ? "✗ Missing" : "⚠ Exhausted"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {data?.summary?.missing > 0 && (
        <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
          {data.summary.missing} API key(s) missing - pipeline may not work correctly
        </div>
      )}
    </div>
  );
}
```

---

## File List

| File | Purpose |
|------|----------|
| `src/lib/api-keys/detector.ts` | Key detection |
| `src/app/api/keys/route.ts` | API endpoint |
| `src/app/keys/page.tsx` | Keys page |

---

## Exit Criteria

- [ ] All API keys detected
- [ ] Missing keys highlighted
- [ ] Exhausted keys detected from model health