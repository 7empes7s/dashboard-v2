# Feature 07: Pipeline Controls - Pause, Resume, Kill, Retry

**File**: `07-pipeline-controls.md`
**Priority**: P0 (Critical)
**Month**: 3 (July 2026)

---

## Overview

Add pipeline control actions: pause, resume, kill story, retry failed stage.

---

## Pipeline API Endpoints

The autopipeline exposes:
```
POST http://127.0.0.1:3200/command
{"cmd": "pause"}
{"cmd": "resume"}
{"cmd": "kill", "storyId": "..."}
{"cmd": "retry", "storyId": "..."}
```

---

## Implementation

### 1. Pipeline Controls (`src/lib/actions/pipeline.ts`)

```typescript
const PIPELINE_API = "http://127.0.0.1:3200";

interface ControlResult {
  success: boolean;
  message: string;
}

async function pausePipeline(): Promise<ControlResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "pause" }),
    });
    const json = await res.json();
    return { success: res.ok, message: json.message || "Paused" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function resumePipeline(): Promise<ControlResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "resume" }),
    });
    const json = await res.json();
    return { success: res.ok, message: json.message || "Resumed" };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function killStory(storyId: string): Promise<ControlResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "kill", storyId }),
    });
    const json = await res.json();
    return { success: res.ok, message: json.message || `Killed ${storyId}` };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function retryStory(storyId: string): Promise<ControlResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cmd: "retry", storyId }),
    });
    const json = await res.json();
    return { success: res.ok, message: json.message || `Retrying ${storyId}` };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

export { pausePipeline, resumePipeline, killStory, retryStory };
```

### 2. Pipeline Controls API (`src/app/api/pipeline/controls/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { pausePipeline, resumePipeline, killStory, retryStory } from "@/lib/actions/pipeline";

export async function POST(request: Request) {
  const body = await request.json();
  const { action, storyId } = body;
  
  let result;
  switch (action) {
    case "pause":
      result = await pausePipeline();
      break;
    case "resume":
      result = await resumePipeline();
      break;
    case "kill":
      if (!storyId) {
        return NextResponse.json({ success: false, error: "storyId required" }, { status: 400 });
      }
      result = await killStory(storyId);
      break;
    case "retry":
      if (!storyId) {
        return NextResponse.json({ success: false, error: "storyId required" }, { status: 400 });
      }
      result = await retryStory(storyId);
      break;
    default:
      return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }
  
  return NextResponse.json(result);
}
```

### 3. Pipeline Controls Component (`src/app/pipeline/PipelineControls.tsx`)

```typescript
"use client";

import { useState, useEffect } from "react";

interface PipelineState {
  queue: any[];
  current: any | null;
  paused: boolean;
}

export function PipelineControls() {
  const [state, setState] = useState<PipelineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  
  useEffect(() => {
    fetch("/api/pipeline").then(r => r.json()).then(setState).finally(() => setLoading(false));
  }, []);
  
  async function doAction(act: string, storyId?: string) {
    setAction(act);
    try {
      const res = await fetch("/api/pipeline/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act, storyId }),
      });
      const json = await res.json();
      if (json.success) {
        // Refresh state
        const r = await fetch("/api/pipeline");
        setState(await r.json());
      }
    } finally {
      setAction(null);
    }
  }
  
  if (loading) return <div className="animate-pulse">Loading...</div>;
  
  return (
    <div className="flex items-center gap-2 p-2 bg-card border border-border rounded-lg">
      <span className="text-xs text-muted-foreground">Controls:</span>
      
      {state?.paused ? (
        <button
          onClick={() => doAction("resume")}
          disabled={action !== null}
          className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium disabled:opacity-50"
        >
          {action === "resume" ? "..." : "Resume"}
        </button>
      ) : (
        <button
          onClick={() => doAction("pause")}
          disabled={action !== null}
          className="px-3 py-1 bg-yellow-600 text-white rounded text-xs font-medium disabled:opacity-50"
        >
          {action === "pause" ? "..." : "Pause"}
        </button>
      )}
      
      <span className="text-xs text-muted-foreground ml-2">
        Queue: {state?.queue.length || 0}
      </span>
    </div>
  );
}
```

### 4. Add Kill/Retry to Story Rows

Add action buttons to each story row in `/app/pipeline/page.tsx`.

---

## File List

| File | Purpose |
|------|----------|
| `src/lib/actions/pipeline.ts` | Control handlers |
| `src/app/api/pipeline/controls/route.ts` | API endpoint |
| `src/app/pipeline/PipelineControls.tsx` | UI component |

---

## Exit Criteria

- [ ] Pause button works
- [ ] Resume button works
- [ ] Kill story with confirmation
- [ ] Retry failed story