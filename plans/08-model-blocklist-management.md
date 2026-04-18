# Feature 08: Model Blocklist Management

**File**: `08-model-blocklist-management.md`
**Priority**: P1
**Month**: 4 (August 2026)

---

## Overview

Manage the model blocklist: view blocked models, block/unblock models, see quality incidents.

---

## Implementation

### 1. Blocklist Policy File

Location: `/etc/mimule/model-policy.json`
```json
{
  "blocked": ["model-name"],
  "whitelisted": [],
  "notes": {
    "model-name": "reason for block"
  }
}
```

### 2. Blocklist API (`src/app/api/models/blocklist/route.ts`)

```typescript
import { NextResponse } from "next/server";
import fs from "fs/promises";

const POLICY_PATH = "/etc/mimule/model-policy.json";

async function readPolicy() {
  try {
    const content = await fs.readFile(POLICY_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { blocked: [], whitelisted: [], notes: {} };
  }
}

async function writePolicy(policy: any) {
  await fs.writeFile(POLICY_PATH, JSON.stringify(policy, null, 2));
}

export async function GET() {
  const policy = await readPolicy();
  return NextResponse.json(policy);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { model, action, note } = body;
  
  const policy = await readPolicy();
  
  if (action === "block") {
    if (!policy.blocked.includes(model)) {
      policy.blocked.push(model);
    }
    if (note) policy.notes[model] = note;
  } else if (action === "unblock") {
    policy.blocked = policy.blocked.filter((m: string) => m !== model);
    delete policy.notes[model];
  }
  
  await writePolicy(policy);
  return NextResponse.json({ success: true, policy: { blocked: policy.blocked.length } });
}
```

### 3. Blocklist Component (`src/app/models/BlocklistManager.tsx`)

```typescript
"use client";

import { useState, useEffect } from "react";

interface BlocklistState {
  blocked: string[];
  notes: Record<string, string>;
}

export function BlocklistManager() {
  const [list, setList] = useState<BlocklistState | null>(null);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState("");
  const [note, setNote] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  
  useEffect(() => {
    fetch("/api/models/blocklist")
      .then(r => r.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, []);
  
  async function doAction(modelName: string, action: "block" | "unblock") {
    setActioning(modelName);
    try {
      await fetch("/api/models/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName, action, note }),
      });
      const res = await fetch("/api/models/blocklist");
      setList(await res.json());
    } finally {
      setActioning(null);
    }
  }
  
  if (loading) return <div className="animate-pulse">Loading...</div>;
  
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Blocked Models ({list?.blocked.length || 0})
        </h3>
        
        {list?.blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">No blocked models</p>
        ) : (
          <ul className="space-y-2 mt-2">
            {list?.blocked.map(m => (
              <li key={m} className="flex items-center justify-between bg-muted/50 rounded p-2">
                <div>
                  <p className="text-sm font-medium">{m}</p>
                  {list.notes[m] && (
                    <p className="text-xs text-muted-foreground">{list.notes[m]}</p>
                  )}
                </div>
                <button
                  onClick={() => doAction(m, "unblock")}
                  disabled={actioning !== null}
                  className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                >
                  {actioning === m ? "..." : "Unblock"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Block New Model
        </h3>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="model-name"
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
          />
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
          />
          <button
            onClick={() => doAction(model, "block")}
            disabled={!model || actioning !== null}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
          >
            Block
          </button>
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
| `src/app/api/models/blocklist/route.ts` | API endpoint |
| `src/app/models/BlocklistManager.tsx` | UI component |

---

## Exit Criteria

- [ ] View blocked models list
- [ ] Block new model with note
- [ ] Unblock model