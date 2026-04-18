# Feature 01: Vast.ai Integration

**File**: `01-vast-ai-integration.md`
**Priority**: P0 (Critical)
**Month**: 1 (May 2026)

---

## Overview

Add complete Vast.ai visibility: account balance, credits, instance details, GPU health, costs, and hourly burn estimates.

---

## Data Sources

### Primary
- **Vast.ai API**: `https://console.vast.ai/api/v0/` with API token from `/root/.vast_api_token` or env
- **Vast CLI**: `vast ai instances -v` for instance list and status
- **Vast SSH**: Remote telemetry via SSH to `root@70.69.192.6 -p 27503`

### Existing Data
- `/var/lib/mimule/gpu-health.json` — partial GPU telemetry
- `/var/lib/mimule/model-health.json` — model discovery results

---

## Implementation

### 1. API Client (`src/lib/vast-api.ts`)

```typescript
import fs from "fs/promises";
import path from "path";

const VAST_API_BASE = "https://console.vast.ai/api/v0";
const VAST_TOKEN_PATH = process.env.VAST_API_TOKEN 
  || "/root/.vast_api_token"; // Check both env and file

interface VastInstance {
  id: number;
  instance_id: number;
  gpu_name: string;
  gpu_count: number;
  cpu_cores: number;
  cpu_ram: number;
  disk_space: number;
  machine_type: string;
  num_gpus: number;
  status: "running" | "stopped" | "created";
  num_bids: number;
  bid_id: number | null;
  rented: boolean;
  on_current_provider: boolean;
  created_at: string;
  runtime_hourly_cost: number;
  machine_uptime?: number;
}

interface VastAccount {
  id: number;
  email: string;
  account_type: string;
  balance: number;
  total_credits: number;
  usable_credits: number;
  pending_charges: number;
  gpu_hours_bought?: number;
  gpu_hours_used?: number;
}

async function getVastApiKey(): Promise<string | null> {
  // Try env first
  if (process.env.VAST_API_TOKEN) return process.env.VAST_API_TOKEN;
  // Try file
  try {
    const key = await fs.readFile("/root/.vast_api_token", "utf-8");
    return key.trim();
  } catch { return null; }
}

async function getVastAccount(): Promise<VastAccount | null> {
  const apiKey = await getVastApiKey();
  if (!apiKey) return null;
  
  const res = await fetch(`${VAST_API_BASE}/users/me`, {
    headers: { "Authorization": `Bearer ${apiKey}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

async function getVastInstances(): Promise<VastInstance[]> {
  const apiKey = await getVastApiKey();
  if (!apiKey) return [];
  
  const res = await fetch(`${VAST_API_BASE}/instances?owner__eq=${apiKey}`, {
    headers: { "Authorization": `Bearer ${apiKey}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.instances || [];
}

export type { VastInstance, VastAccount };
export { getVastAccount, getVastInstances, getVastApiKey };
```

---

### 2. Cost Tracking Service (`src/lib/vast-costs.ts`)

```typescript
import { VastAccount, VastInstance, getVastAccount, getVastInstances } from "./vast-api";

interface CostSnapshot {
  timestamp: number;
  balance: number;
  usableCredits: number;
  hourlyBurn: number; // Estimated from instance costs in last hour
  runtimeHours: number; // Total GPU hours used
  instanceCosts: { [instanceId: string]: number };
}

const COST_HISTORY_PATH = "/var/lib/mimule/vast-cost-history.json";

async function getCostSnapshot(): Promise<CostSnapshot | null> {
  const [account, instances] = await Promise.all([
    getVastAccount(),
    getVastInstances()
  ]);
  
  if (!account) return null;
  
  // Calculate hourly burn estimate from running instances
  const runningInstances = instances.filter(i => i.status === "running");
  const hourlyBurn = runningInstances.reduce((sum, inst) => 
    sum + (inst.runtime_hourly_cost || 0), 0);
  
  return {
    timestamp: Date.now(),
    balance: account.balance,
    usableCredits: account.usable_credits,
    hourlyBurn,
    runtimeHours: account.gpu_hours_used || 0,
    instanceCosts: Object.fromEntries(
      runningInstances.map(i => [i.instance_id, i.runtime_hourly_cost])
    )
  };
}

function calculateRunway(balance: number, hourlyRate: number): number {
  if (hourlyRate <= 0) return Infinity;
  return Math.floor((balance / hourlyRate) * 100) / 100; // Hours
}

export type { CostSnapshot };
export { getCostSnapshot, calculateRunway };
```

---

### 3. SSH Remote Telemetry (`src/lib/vast-ssh.ts`)

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const VAST_SSH_HOST = "root@70.69.192.6";
const VAST_SSH_PORT = 27503;

interface RemoteTelemetry {
  cpu_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  gpu_utilization: number[];
  gpu_memory_used_mb: number[];
  gpu_memory_total_mb: number[];
  gpu_temp_c: number[];
  timestamp: number;
}

async function sshExec(cmd: string): Promise<string> {
  const fullCmd = `ssh -o StrictHostKeyChecking=no -p ${VAST_SSH_PORT} ${VAST_SSH_HOST} "${cmd}"`;
  const { stdout } = await execAsync(fullCmd, { timeout: 15000 });
  return stdout.trim();
}

async function getRemoteTelemetry(): Promise<RemoteTelemetry | null> {
  try {
    const output = await sshExec(`
      echo "CPU:$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk '{print 100 - $1}')"
      echo "MEM:$(free -g | grep Mem | awk '{print $3\":\"$2}')"
      echo "DISK:$(df -BG / | tail -1 | awk '{print $3\":\"$2}' | sed 's/G//g')"
      echo "GPUUTIL:$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits)"
      echo "GPUMEM:$(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits)"
      echo "TEMP:$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader)"
    `);
    
    const lines = output.split("\n").filter(Boolean);
    const parse = (key: string) => lines.find(l => l.startsWith(key + ":"))?.split(":")[1] || "0";
    
    const memParts = parse("MEM").split(":");
    const diskParts = parse("DISK").split(":");
    const gpuUtil = parse("GPUUTIL").split(",").map(Number);
    const gpuMemParts = parse("GPUMEM").split(",").map(s => s.split("/").map(Number));
    const temps = parse("TEMP").split(",").map(Number);
    
    return {
      cpu_percent: parseFloat(parse("CPU")) || 0,
      memory_used_gb: parseInt(memParts[0]) || 0,
      memory_total_gb: parseInt(memParts[1]) || 0,
      disk_used_gb: parseInt(diskParts[0]) || 0,
      disk_total_gb: parseInt(diskParts[1]) || 0,
      gpu_utilization: gpuUtil,
      gpu_memory_used_mb: gpuMemParts.map(m => m[0]),
      gpu_memory_total_mb: gpuMemParts.map(m => m[1]),
      gpu_temp_c: temps,
      timestamp: Date.now()
    };
  } catch {
    return null;
  }
}

export type { RemoteTelemetry };
export { getRemoteTelemetry };
```

---

### 4. API Route (`src/app/api/vast/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { getVastAccount, getVastInstances } from "@/lib/vast-api";
import { getCostSnapshot, calculateRunway } from "@/lib/vast-costs";
import { getRemoteTelemetry } from "@/lib/vast-ssh";

export const dynamic = "force-dynamic";

export async function GET() {
  const [account, instances, costs, remote] = await Promise.all([
    getVastAccount(),
    getVastInstances(),
    getCostSnapshot(),
    getRemoteTelemetry(),
  ]);
  
  const running = instances.filter(i => i.status === "running");
  const runway = costs?.hourlyBurn 
    ? calculateRunway(costs?.balance || 0, costs?.hourlyBurn || 0)
    : null;
  
  return NextResponse.json({
    generatedAt: Date.now(),
    sourceStatus: account ? "direct" : "inferred",
    account: account ? {
      balance: account.balance,
      usableCredits: account.usable_credits,
      pendingCharges: account.pending_charges,
    } : null,
    costs: costs ? {
      hourlyBurn: costs.hourlyBurn,
      runtimeHours: costs.runtimeHours,
      runwayHours: runway,
    } : null,
    instances: running.map(inst => ({
      id: inst.instance_id,
      gpuName: inst.gpu_name,
      gpuCount: inst.gpu_count,
      hourlyCost: inst.runtime_hourly_cost,
      status: inst.status,
      createdAt: inst.created_at,
    })),
    remote: remote ? {
      cpuPercent: remote.cpu_percent,
      memoryUsedGb: remote.memory_used_gb,
      memoryTotalGb: remote.memory_total_gb,
      diskUsedGb: remote.disk_used_gb,
      diskTotalGb: remote.disk_total_gb,
      gpuUtilization: remote.gpu_utilization,
      gpuMemoryUsedMb: remote.gpu_memory_used_mb,
      gpuMemoryTotalMb: remote.gpu_memory_total_mb,
      gpuTemperature: remote.gpu_temp_c,
    } : null,
  });
}
```

---

### 5. Vast Panel Component (`src/app/vast/VastPanel.tsx`)

```typescript
"use client";

import { useEffect, useState } from "react";

interface VastData {
  generatedAt: number;
  sourceStatus: "direct" | "inferred";
  account: {
    balance: number;
    usableCredits: number;
    pendingCharges: number;
  } | null;
  costs: {
    hourlyBurn: number;
    runtimeHours: number;
    runwayHours: number | null;
  } | null;
  instances: Array<{
    id: number;
    gpuName: string;
    gpuCount: number;
    hourlyCost: number;
    status: string;
    createdAt: string;
  }>;
  remote: {
    cpuPercent: number;
    memoryUsedGb: number;
    memoryTotalGb: number;
    diskUsedGb: number;
    diskTotalGb: number;
    gpuUtilization: number[];
    gpuMemoryUsedMb: number[];
    gpuMemoryTotalMb: number[];
    gpuTemperature: number[];
  } | null;
}

export function VastPanel() {
  const [data, setData] = useState<VastData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetch() {
      try {
        const res = await fetch("/api/vast");
        if (res.ok) setData(await res.json());
      } finally { setLoading(false); }
    }
    fetch();
    const i = setInterval(fetch, 30000);
    return () => clearInterval(i);
  }, []);
  
  if (loading) return <div className="animate-pulse">Loading Vast.ai...</div>;
  if (!data?.account) return <div className="text-red-500">Vast API unavailable</div>;
  
  const { account, costs, instances, remote } = data;
  
  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vast.ai Account</h3>
        <div className="grid grid-cols-4 gap-4 mt-3">
          <div>
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="text-2xl font-semibold">${account.balance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Usable Credits</p>
            <p className="text-2xl font-semibold">${account.usableCredits.toFixed(2)}</p>
          </div>
          {costs?.hourlyBurn && (
            <div>
              <p className="text-xs text-muted-foreground">Hourly Burn</p>
              <p className="text-2xl font-semibold text-orange-400">${costs.hourlyBurn.toFixed(2)}/hr</p>
            </div>
          )}
          {costs?.runwayHours && (
            <div>
              <p className="text-xs text-muted-foreground">Runway</p>
              <p className="text-2xl font-semibold text-green-400">{costs.runwayHours.toFixed(1)}h</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Running Instance */}
      {instances.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Running Instances</h3>
          <div className="space-y-2 mt-3">
            {instances.map(inst => (
              <div key={inst.id} className="flex items-center justify-between bg-muted/50 rounded p-2">
                <div>
                  <p className="text-sm font-medium">{inst.gpuName} ×{inst.gpuCount}</p>
                  <p className="text-xs text-muted-foreground">ID: {inst.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">${inst.hourlyCost}/hr</p>
                  <p className="text-xs text-green-500">Running</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Remote Telemetry */}
      {remote && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">GPU Telemetry</h3>
          <div className="grid grid-cols-4 gap-4 mt-3">
            <div>
              <p className="text-xs text-muted-foreground">CPU</p>
              <p className="text-2xl font-semibold">{remote.cpuPercent}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RAM</p>
              <p className="text-2xl font-semibold">{remote.memoryUsedGb}/{remote.memoryTotalGb}GB</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">GPU Util</p>
              <p className="text-2xl font-semibold">{remote.gpuUtilization[0]}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">GPU Mem</p>
              <p className="text-2xl font-semibold">{remote.gpuMemoryUsedMb[0]}MB</p>
            </div>
          </div>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground text-right">
        Source: {data.sourceStatus} • Updated {new Date(data.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}
```

---

### 6. Add to Layout (`src/app/layout.tsx`)

Add link to sidebar:
```typescript
<a href="/vast" className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-sidebar-foreground hover:bg-secondary rounded-md transition-colors">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 21h14M3 21v-2m16 2v-2M3 7l9 6 9-6M3 7v10l9 6 9-6" />
  </svg>
  Vast.ai
</a>
```

---

## File List

| File | Purpose |
|------|----------|
| `src/lib/vast-api.ts` | Vast API client |
| `src/lib/vast-costs.ts` | Cost tracking |
| `src/lib/vast-ssh.ts` | Remote SSH telemetry |
| `src/app/api/vast/route.ts` | API endpoint |
| `src/app/vast/page.tsx` | Vast page |
| `src/app/vast/VastPanel.tsx` | UI component |

---

## Exit Criteria

- [ ] Vast account balance visible (direct from API)
- [ ] Hourly burn rate displayed
- [ ] Estimated runway shown
- [ ] Running instances list
- [ ] Remote GPU telemetry (CPU, RAM, GPU util)
- [ ] Data source labeled as "direct" or "inferred"
- [ ] Graceful degradation if API unavailable