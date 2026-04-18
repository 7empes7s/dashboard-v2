# Feature 05: Cost Tracking - Burn Estimates, Daily Spend

**File**: `05-cost-tracking.md`
**Priority**: P0 (Critical)
**Month**: 2 (June 2026)

---

## Overview

Track costs across all providers: Vast GPU, cloud models, daily burn estimates, and runrate forecasting.

---

## Data Sources

| Source | Path | Data |
|--------|------|------|
| Vast API | Vast.ai /api/v0 | GPU runtime costs |
| Provider usage | Feature 03 | Cloud spend |
| Model health | /var/lib/mimule/model-health.json | Free model counts |
| Pipeline logs | Run artifacts | Stories published |

---

## Implementation

### 1. Cost Aggregator (`src/lib/costs/aggregator.ts`)

```typescript
interface DailyCost {
  date: string;
  provider: string;
  amount: number;
  requests: number;
  tokens: number;
}

interface CostSnapshot {
  timestamp: number;
  period: "day" | "week" | "month";
  totalSpent: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  projected: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

const COST_DATA_PATH = "/var/lib/mimule/cost-history.json";

// Cost per request estimates (pinned from model-health.json + provider pricing)
const COST_ESTIMATES: Record<string, number> = {
  "gemma4:26b": 0.00, // Local GPU
  "gemma4:26b-instruct-q4_K_M": 0.00,
  "qwen3:8b": 0.00,
  "qwen2.5-coder:32b": 0.00,
  "groq/llama-3.3-70b-versatile": 0.40, // Per 1M tokens approx
  "groq/qwen/qwen3-32b": 0.40,
  "groq/openai/gpt-oss-120b": 0.80,
  "github/Meta-Llama-3.1-405B-Instruct": 3.50,
  "github/gpt-4o": 2.50,
  "openrouter/...": 0.10, // Free models mostly
};

function estimateCost(model: string, tokens: number): number {
  const perMillion = COST_ESTIMATES[model] || 0.50;
  return (tokens / 1_000_000) * perMillion;
}

async function getCostHistory(): Promise<DailyCost[]> {
  // Read from persisted history or compute fresh
  return []; // Placeholder
}

async function computeDailyCost(): Promise<CostSnapshot> {
  // This would aggregate:
  // 1. Vast GPU costs (from feature 01)
  // 2. Cloud provider usage (from feature 03)
  // 3. Request counts from model health
  
  return {
    timestamp: Date.now(),
    period: "day",
    totalSpent: 0,
    byProvider: {},
    byModel: {},
    projected: { daily: 0, weekly: 0, monthly: 0 },
  };
}
```

### 2. Cost API Route (`src/app/api/costs/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { computeDailyCost } from "@/lib/costs/aggregator";

export const dynamic = "force-dynamic";

export async function GET() {
  const costs = await computeDailyCost();
  return NextResponse.json(costs);
}
```

### 3. Cost Dashboard Component (`src/app/costs/CostDashboard.tsx`)

```typescript
"use client";

import { useEffect, useState } from "react";

interface CostSnapshot {
  timestamp: number;
  totalSpent: number;
  byProvider: Record<string, number>;
  projected: { daily: number; weekly: number; monthly: number };
}

export function CostDashboard() {
  const [data, setData] = useState<CostSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetch() {
      try {
        const res = await fetch("/api/costs");
        if (res.ok) setData(await res.json());
      } finally { setLoading(false); }
    }
    fetch();
    // Update every 5 min
    const i = setInterval(fetch, 300000);
    return () => clearInterval(i);
  }, []);
  
  if (loading) return <div className="animate-pulse">Loading costs...</div>;
  
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost Summary</h3>
        <div className="grid grid-cols-4 gap-4 mt-3">
          <div>
            <p className="text-xs text-muted-foreground">Today</p>
            <p className="text-2xl font-semibold">${data?.totalSpent.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Daily Avg</p>
            <p className="text-2xl font-semibold">${data?.projected.daily.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Weekly Proj</p>
            <p className="text-2xl font-semibold text-yellow-400">${data?.projected.weekly.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monthly Proj</p>
            <p className="text-2xl font-semibold text-orange-400">${data?.projected.monthly.toFixed(2)}</p>
          </div>
        </div>
      </div>
      
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Provider</h3>
        <div className="space-y-2 mt-3">
          {Object.entries(data?.byProvider || {}).map(([provider, amount]) => (
            <div key={provider} className="flex items-center justify-between">
              <span className="text-sm">{provider}</span>
              <span className="text-sm font-medium">${amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## File List

| File | Purpose |
|------|----------|
| `src/lib/costs/aggregator.ts` | Cost computation |
| `src/app/api/costs/route.ts` | API endpoint |
| `src/app/costs/page.tsx` | Cost page |
| `src/app/costs/CostDashboard.tsx` | UI component |

---

## Exit Criteria

- [ ] Daily spend visible
- [ ] Projected weekly/monthly
- [ ] Breakdown by provider