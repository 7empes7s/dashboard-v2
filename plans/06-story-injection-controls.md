# Feature 06: Story Injection Controls

**File**: `06-story-injection-controls.md`
**Priority**: P0 (Critical)
**Month**: 3 (July 2026)

---

## Overview

Add the ability to manually inject stories into the pipeline from the dashboard. This is the first action capability.

---

## Pipeline API

The autopipeline already exposes an injection endpoint:
```
POST http://127.0.0.1:3200/command
{"cmd":"add","topic":"...","vertical":"..."}
```

---

## Implementation

### 1. Injection Handler (`src/lib/actions/inject.ts`)

```typescript
const PIPELINE_API = "http://127.0.0.1:3200";

interface InjectRequest {
  topic: string;
  vertical: string;
  priority?: number;
}

interface InjectResult {
  success: boolean;
  storyId?: string;
  error?: string;
}

async function injectStory(req: InjectRequest): Promise<InjectResult> {
  try {
    const res = await fetch(`${PIPELINE_API}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cmd: "add",
        topic: req.topic,
        vertical: req.vertical,
        priority: req.priority || 2,
      }),
    });
    
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }
    
    const json = await res.json();
    return { success: true, storyId: json.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function getQueueStatus(): Promise<{
  queueDepth: number;
  running: string | null;
}> {
  try {
    const res = await fetch(`${PIPELINE_API}/queue`);
    const json = await res.json();
    return {
      queueDepth: json.queue?.length || 0,
      running: json.current?.id || null,
    };
  } catch {
    return { queueDepth: 0, running: null };
  }
}

export type { InjectRequest, InjectResult };
export { injectStory, getQueueStatus };
```

### 2. Injection API Route (`src/app/api/pipeline/inject/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { injectStory } from "@/lib/actions/inject";

export async function POST(request: Request) {
  const body = await request.json();
  const { topic, vertical, priority } = body;
  
  if (!topic || !vertical) {
    return NextResponse.json(
      { success: false, error: "topic and vertical required" },
      { status: 400 }
    );
  }
  
  const result = await injectStory({ topic, vertical, priority });
  return NextResponse.json(result);
}

export async function GET() {
  // Return available verticals
  return NextResponse.json({
    verticals: [
      "ai", "finance", "global-politics", "trends", "science",
      "wellness", "culture", "sports", "crypto", "energy", "climate"
    ],
  });
}
```

### 3. Injection UI Component (`src/app/pipeline/StoryInjector.tsx`)

```typescript
"use client";

import { useState } from "react";

interface Vertical {
  id: string;
  label: string;
  color: string;
}

const VERTICALS: Vertical[] = [
  { id: "ai", label: "AI", color: "bg-purple-500" },
  { id: "finance", label: "Finance", color: "bg-green-500" },
  { id: "global-politics", label: "Global Politics", color: "bg-blue-500" },
  { id: "trends", label: "Trends", color: "bg-pink-500" },
  { id: "science", label: "Science", color: "bg-yellow-500" },
  { id: "wellness", label: "Wellness", color: "bg-emerald-500" },
  { id: "culture", label: "Culture", color: "bg-rose-500" },
  { id: "sports", label: "Sports", color: "bg-orange-500" },
  { id: "crypto", label: "Crypto", color: "bg-indigo-500" },
  { id: "energy", label: "Energy", color: "bg-cyan-500" },
  { id: "climate", label: "Climate", color: "bg-teal-500" },
];

export function StoryInjector() {
  const [topic, setTopic] = useState("");
  const [vertical, setVertical] = useState("");
  const [priority, setPriority] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !vertical) return;
    
    setSubmitting(true);
    setResult(null);
    
    try {
      const res = await fetch("/api/pipeline/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), vertical, priority }),
      });
      
      const json = await res.json();
      setResult({
        success: json.success,
        message: json.success 
          ? `Story injected: ${json.storyId}`
          : json.error || "Failed to inject",
      });
      
      if (json.success) {
        setTopic("");
        // Refresh pipeline data
      }
    } catch (err) {
      setResult({ success: false, message: String(err) });
    } finally {
      setSubmitting(false);
    }
  }
  
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
        Inject Story
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-muted-foreground">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="UK inflation March 2026"
            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
            disabled={submitting}
          />
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground">Vertical</label>
          <select
            value={vertical}
            onChange={e => setVertical(e.target.value)}
            className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
            disabled={submitting}
          >
            <option value="">Select vertical...</option>
            {VERTICALS.map(v => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-muted-foreground">Priority</label>
          <div className="flex gap-2 mt-1">
            {[1, 2, 3].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                  priority === p 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                disabled={submitting}
              >
                {p === 1 ? "Rush" : p === 2 ? "Normal" : "Low"}
              </button>
            ))}
          </div>
        </div>
        
        <button
          type="submit"
          disabled={submitting || !topic.trim() || !vertical}
          className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Injecting..." : "Inject Story"}
        </button>
        
        {result && (
          <div className={`text-sm ${result.success ? "text-green-400" : "text-red-400"}`}>
            {result.message}
          </div>
        )}
      </form>
    </div>
  );
}
```

### 4. Add to Pipeline Page

Add `StoryInjector` component to `/app/pipeline/page.tsx`.

---

## File List

| File | Purpose |
|------|----------|
| `src/lib/actions/inject.ts` | Injection handler |
| `src/app/api/pipeline/inject/route.ts` | API endpoint |
| `src/app/pipeline/StoryInjector.tsx` | UI component |

---

## Exit Criteria

- [ ] Topic input field
- [ ] Vertical dropdown
- [ ] Priority selection
- [ ] Story injected successfully
- [ ] Error handling on failure