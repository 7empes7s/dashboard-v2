"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

interface Model {
  logicalName: string;
  provider: string;
  available: boolean;
  latency?: number;
}

interface GpuHealth {
  status: string;
  models?: string[];
  gpu_max_util?: number;
}

interface ModelsData {
  models: Model[];
  providers: any[];
  gpu: GpuHealth;
  timestamp: string;
}

function StatusBadge({ available }: { available: boolean }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
      available ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
    }`}>
      {available ? "available" : "down"}
    </span>
  );
}

interface BlocklistState {
  blocked: string[];
  notes: Record<string, string>;
}

function BlocklistManager() {
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
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Blocked Models ({list?.blocked?.length || 0})
      </h3>
      
      {list?.blocked?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocked models</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {list?.blocked?.map(m => (
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
      
      <div className="flex gap-2">
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
  );
}

export default function Models() {
  const [data, setData] = useState<ModelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchModels() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch("/api/models", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (cancelled) return;
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch");
        console.error("Failed to fetch models:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchModels();
    const interval = setInterval(fetchModels, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">Models</h1>
        <p className="text-muted-foreground">Loading...</p>
        {error && <p className="text-sm text-red-400 mt-2">Error: {error}</p>}
      </div>
    );
  }

  const localModels = data?.models?.filter((m) => m.provider === "local") || [];
  const cloudModels = data?.models?.filter((m) => m.provider !== "local") || [];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Models</h1>
        <p className="text-sm text-muted-foreground mt-1">Model health and provider status</p>
      </div>

      <BlocklistManager />

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">GPU (Local)</h2>
        {data?.gpu?.status === "up" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-sm text-green-400">Connected</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Models</span>
              <span className="font-mono text-xs">{data.gpu.models?.join(", ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max Util</span>
              <span className="font-mono text-xs">{data.gpu.gpu_max_util}%</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-400">GPU disconnected</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Local Models ({localModels.length})</h2>
        {localModels.length > 0 ? (
          <div className="space-y-1">
            {localModels.map((model: Model, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-mono text-sm">{model.logicalName}</p>
                  <p className="text-xs text-muted-foreground">{model.latency}ms</p>
                </div>
                <StatusBadge available={model.available} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No local models</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Cloud Models ({cloudModels.length})</h2>
        {cloudModels.length > 0 ? (
          <div className="space-y-1">
            {cloudModels.map((model: Model, idx: number) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-mono text-sm">{model.logicalName}</p>
                  <p className="text-xs text-muted-foreground">{model.provider} - {model.latency}ms</p>
                </div>
                <StatusBadge available={model.available} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No cloud models</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "N/A"}
      </p>
    </div>
  );
}