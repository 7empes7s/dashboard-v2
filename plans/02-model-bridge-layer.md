# Feature 02: Model Bridge Layer - Unified Data Architecture

**File**: `02-model-bridge-layer.md`
**Priority**: P0 (Critical)
**Month**: 1 (May 2026)

---

## Overview

Create a unified data bridge layer that normalizes all stack telemetry into consistent interfaces. This is the backbone that makes all other features possible — models, providers, infrastructure all feed through here.

---

## Data Sources (Read)

| Source | Path | Data |
|--------|------|------|
| Pipeline | `/var/lib/mimule/pipeline-state.json` | Queue, current, completed stories |
| GPU | `/var/lib/mimule/gpu-health.json` | Status, models, metrics |
| Models | `/var/lib/mimule/model-health.json` | Available models, fallbacks |
| LiteLLM Config | `/etc/litellm/config.yaml` | Model routing, keys |
| LiteLLM Env | `/etc/litellm/litellm.env` | API keys (detect missing) |

---

## Implementation

### 1. Unified Types (`src/lib/bridge/types.ts`)

```typescript
// Status types
type HealthStatus = "healthy" | "degraded" | "offline" | "unknown";
type ModelCapability = "heavy" | "medium" | "light";
type Provider = "local" | "groq" | "openrouter" | "github" | "zen" | "openai" | "anthropic";

interface SystemStatus {
  generatedAt: number;
  overall: HealthStatus;
  services: ServiceStatus[];
  issues: Issue[];
}

interface ServiceStatus {
  name: string;
  status: HealthStatus;
  uptime: number;
  lastCheck: number;
  lastError?: string;
}

interface Issue {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  source: string;
  firstSeen: number;
  lastSeen: number;
  action?: string;
}

// Pipeline types
interface PipelineQueue {
  id: string;
  topic: string;
  stage: string;
  priority: number;
  createdAt: number;
  startedAt?: number;
  status: "queued" | "running" | "completed" | "failed" | "stuck";
  retries: number;
  error?: string;
}

interface PipelineState {
  queue: PipelineQueue[];
  current: PipelineQueue | null;
  completed: PipelineQueue[];
  paused: boolean;
}

// Model types
interface ModelInfo {
  name: string;
  provider: Provider;
  capability: ModelCapability;
  params: number;
  available: boolean;
  latency: number;
  blocked: boolean;
  lastCheck: number;
  error?: string;
}

interface ModelState {
  models: ModelInfo[];
  bestFor: {
    heavy: string;
    medium: string;
    light: string;
  };
  blocked: string[];
  degraded: string[];
}

// Infrastructure types
interface HostMetrics {
  hostname: string;
  cpuPercent: number;
  memoryUsedGb: number;
  memoryTotalGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  uptime: number;
}

interface ServiceInfo {
  name: string;
  status: "active" | "inactive" | "failed";
  active: boolean;
  memoryMb: number;
  cpuSeconds: number;
  lastStateChange: number;
  mainPid: number;
}

interface InfrastructureState {
  hosts: HostMetrics[];
  services: ServiceInfo[];
}
```

### 2. Pipeline Bridge (`src/lib/bridge/pipeline.ts`)

```typescript
import fs from "fs/promises";
import path from "path";

const PIPELINE_STATE = "/var/lib/mimule/pipeline-state.json";

interface RawQueueStory {
  type: string;
  priority: number;
  stage: string;
  id: string;
  createdAt: number;
  startedAt: number | null;
  retries: number;
  running: boolean;
}

interface RawPipelineState {
  queue: RawQueueStory[];
  current: RawQueueStory | null;
  completed: RawQueueStory[];
  paused?: boolean;
}

async function readPipelineState(): Promise<PipelineState | null> {
  try {
    const content = await fs.readFile(PIPELINE_STATE, "utf-8");
    const raw: RawPipelineState = JSON.parse(content);
    
    return {
      queue: raw.queue || [],
      current: raw.current || null,
      completed: raw.completed || [],
      paused: raw.paused || false,
    };
  } catch {
    return null;
  }
}

async function getPipelineSummary(): Promise<{
  queueDepth: number;
  running: string | null;
  failed: number;
  success: number;
} | null> {
  const state = await readPipelineState();
  if (!state) return null;
  
  const current = state.current;
  const failed = state.completed.filter(s => s.status === "stuck").length;
  const success = state.completed.filter(s => s.status === "completed").length;
  
  return {
    queueDepth: state.queue.length,
    running: current?.id || null,
    failed,
    success,
  };
}

export type { PipelineState, PipelineQueue };
export { readPipelineState, getPipelineSummary };
```

### 3. Model Bridge (`src/lib/bridge/models.ts`)

```typescript
import fs from "fs/promises";
import yaml from "yaml"; // You'll need: npm i yaml @types/yaml

const MODEL_HEALTH = "/var/lib/mimule/model-health.json";
const MODEL_POLICY = "/etc/mimule/model-policy.json";

interface RawModelHealth {
  models: Array<{
    logicalName: string;
    provider: string;
    capability: string;
    params: number;
    available: boolean;
    latency: number;
    error?: string;
  }>;
  availableByCapability: {
    heavy: number;
    medium: number;
    light: number;
  };
  ranked: {
    heavy: string[];
    medium: string[];
    light: string[];
  };
}

interface ModelPolicy {
  blocked: string[];
  whitelisted: string[];
  notes: Record<string, string>;
}

async function readModelState(): Promise<ModelState | null> {
  try {
    const [healthRaw, policyRaw] = await Promise.all([
      fs.readFile(MODEL_HEALTH, "utf-8"),
      fs.readFile(MODEL_POLICY, "utf-8").catch(() => "{}"),
    ]);
    
    const health: RawModelHealth = JSON.parse(healthRaw);
    const policy: ModelPolicy = JSON.parse(policyRaw);
    
    const models: ModelInfo[] = health.models.map(m => ({
      name: m.logicalName,
      provider: m.provider as Provider,
      capability: m.capability as ModelCapability,
      params: m.params,
      available: m.available,
      latency: m.latency,
      blocked: policy.blocked?.includes(m.logicalName) || false,
      lastCheck: m.checkedAt || Date.now(),
      error: m.error,
    }));
    
    return {
      models,
      bestFor: {
        heavy: health.ranked?.heavy?.[0] || "editorial-heavy",
        medium: health.ranked?.medium?.[0] || "editorial-fast",
        light: health.ranked?.light?.[0] || "mimule-chat",
      },
      blocked: policy.blocked || [],
      degraded: [], // Derived from policy or errors
    };
  } catch {
    return null;
  }
}

async function getModelSummary(): Promise<{
  totalModels: number;
  available: number;
  blocked: number;
  byCapability: { heavy: number; medium: number; light: number };
} | null> {
  const state = await readModelState();
  if (!state) return null;
  
  const counts = state.models.reduce(
    (acc, m) => {
      acc.total++;
      if (m.available) acc.available++;
      if (m.blocked) acc.blocked++;
      acc.byCapability[m.capability]++;
      return acc;
    },
    { total: 0, available: 0, blocked: 0, byCapability: { heavy: 0, medium: 0, light: 0 } }
  );
  
  return counts;
}

export type { ModelState, ModelInfo };
export { readModelState, getModelSummary };
```

### 4. Infrastructure Bridge (`src/lib/bridge/infrastructure.ts`)

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const SYSTEMCTL_CMD = "systemctl list-units --type=service --state=running --no-pager --plain";

interface SystemdUnit {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

interface HostMetrics {
  uptime: number;
  cpuCount: number;
  cpuPercent: number;
  memoryTotal: number;
  memoryUsed: number;
  memoryFree: number;
  diskTotal: number;
  diskUsed: number;
}

async function getHostMetrics(): Promise<HostMetrics | null> {
  try {
    const [uptime, meminfo, df] = await Promise.all([
      execAsync("cat /proc/uptime | awk '{print $1}'"),
      execAsync("free -b | grep Mem"),
      execAsync("df -B1 / | tail -1"),
    ]);
    
    const uptimeSec = parseFloat(uptime.trim());
    const memParts = meminfo.trim().split(/\s+/);
    const dfParts = df.trim().split(/\s+/);
    
    return {
      uptime: uptimeSec,
      cpuCount: require("os").cpus().length,
      cpuPercent: 0, // Would need separate collection
      memoryTotal: parseInt(memParts[1]) || 0,
      memoryUsed: parseInt(memParts[2]) || 0,
      memoryFree: parseInt(memParts[3]) || 0,
      diskTotal: parseInt(dfParts[1]) || 0,
      diskUsed: parseInt(dfParts[2]) || 0,
    };
  } catch {
    return null;
  }
}

async function getServices(): Promise<ServiceInfo[]> {
  try {
    const { stdout } = await execAsync(SYSTEMCTL_CMD, { timeout: 10000 });
    const lines = stdout.trim().split("\n").slice(1); // Skip header
    
    const critical = [
      "newsbites.service",
      "litellm.service",
      "newsbites-autopipeline.service",
      "dashboard-v2.service",
      "vast-tunnel.service",
      "cloudflared.service",
    ];
    
    return lines
      .map(line => {
        const parts = line.trim().split(/\s{2,}/);
        const unit = parts[0];
        const active = parts[1] || "";
        const sub = parts[2] || "";
        const name = unit.replace(".service", "");
        
        return {
          name,
          status: active === "active" ? "active" : "inactive",
          active: active === "active",
          memoryMb: 0, // Would need ps to get memory
          cpuSeconds: 0,
          lastStateChange: 0,
          mainPid: 0,
        };
      })
      .filter(s => critical.includes(s.name));
  } catch {
    return [];
  }
}

export type { InfrastructureState, ServiceInfo };
export { getHostMetrics, getServices };
```

### 5. Health Aggregator (`src/lib/bridge/health.ts`)

```typescript
import { getPipelineSummary } from "./pipeline";
import { getModelSummary } from "./models";
import { getHostMetrics, getServices } from "./infrastructure";

async function computeHealth(): Promise<SystemStatus> {
  const [pipeline, models, hosts, services] = await Promise.all([
    getPipelineSummary(),
    getModelSummary(),
    getHostMetrics(),
    getServices(),
  ]);
  
  const issues: Issue[] = [];
  let overall: HealthStatus = "healthy";
  
  // Check pipeline
  if (!pipeline) {
    issues.push({
      id: "pipeline-down",
      severity: "critical",
      title: "Pipeline unavailable",
      description: "Could not read pipeline state",
      source: "pipeline",
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      action: "Check newsbites-autopipeline.service",
    });
    overall = "offline";
  } else if (pipeline.failed > 10) {
    issues.push({
      id: "pipeline-failing",
      severity: "warning",
      title: "Pipeline failing stories",
      description: `${pipeline.failed} stories stuck in past 24h`,
      source: "pipeline",
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    });
    if (overall !== "offline") overall = "degraded";
  }
  
  // Check models
  if (!models || models.blocked > 3) {
    issues.push({
      id: "models-blocked",
      severity: "warning",
      title: "Many models blocked",
      description: `${models?.blocked || 0} models in blocklist`,
      source: "models",
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    });
  }
  
  // Check hosts (CPU)
  if (hosts && hosts.memoryUsed / hosts.memoryTotal > 0.9) {
    issues.push({
      id: "host-memory",
      severity: "warning",
      title: "High memory usage",
      description: `${Math.round(hosts.memoryUsed / hosts.memoryTotal * 100)}% RAM used`,
      source: "host",
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    });
  }
  
  // Check services
  const failed = services?.filter(s => s.status === "failed") || [];
  if (failed.length > 0) {
    issues.push({
      id: "services-failed",
      severity: "critical",
      title: "Failed services",
      description: failed.map(s => s.name).join(", "),
      source: "services",
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      action: "Check systemctl status",
    });
    overall = "degraded";
  }
  
  return {
    generatedAt: Date.now(),
    overall,
    services: services?.map(s => ({
      name: s.name,
      status: s.status as HealthStatus,
      uptime: 0,
      lastCheck: Date.now(),
    })) || [],
    issues,
  };
}

export type { SystemStatus, HealthStatus, Issue };
export { computeHealth };
```

### 6. Bridge API Routes

| Route | Purpose |
|------|----------|
| `GET /api/bridge/health` | Unified health status |
| `GET /api/bridge/pipeline` | Pipeline state |
| `GET /api/bridge/models` | Model state |
| `GET /api/bridge/infrastructure` | Infrastructure state |

### 7. Example Health Route (`src/app/api/bridge/health/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { computeHealth } from "@/lib/bridge/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await computeHealth();
  return NextResponse.json(health);
}
```

---

## File List

| File | Purpose |
|------|----------|
| `src/lib/bridge/types.ts` | Unified type definitions |
| `src/lib/bridge/pipeline.ts` | Pipeline data reader |
| `src/lib/bridge/models.ts` | Model data reader |
| `src/lib/bridge/infrastructure.ts` | Infrastructure data reader |
| `src/lib/bridge/health.ts` | Health aggregator |
| `src/app/api/bridge/health/route.ts` | Health endpoint |
| `src/app/api/bridge/pipeline/route.ts` | Pipeline endpoint |
| `src/app/api/bridge/models/route.ts` | Models endpoint |
| `src/app/api/bridge/infrastructure/route.ts` | Infrastructure endpoint |

---

## Exit Criteria

- [ ] All data sources unified through bridge layer
- [ ] Single `/api/bridge/health` returns complete status
- [ ] Issues auto-detected and surfaced
- [ ] Type-safe across all components
- [ ] Graceful degradation per source