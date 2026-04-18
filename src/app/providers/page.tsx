"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: "bg-green-500/20 text-green-400",
    degraded: "bg-yellow-500/20 text-yellow-400",
    rate_limited: "bg-red-500/20 text-red-400",
    error: "bg-red-500/20 text-red-500",
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${colors[status] || colors.error}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function Providers() {
  const [data, setData] = useState<ProviderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchProviders() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch("/api/providers", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (cancelled) return;
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProviders();
    const interval = setInterval(fetchProviders, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">Providers</h1>
        <p className="text-muted-foreground">Loading...</p>
        {error && <p className="text-sm text-red-400 mt-2">Error: {error}</p>}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Providers</h1>
        <p className="text-sm text-muted-foreground mt-1">Provider quotas and usage limits</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
          <div>Provider</div>
          <div className="text-right">Used</div>
          <div className="text-right">Limit</div>
          <div className="text-right">Remaining</div>
          <div className="text-right">Status</div>
        </div>
        <div className="divide-y divide-border">
          {data?.providers?.map((p: Provider, idx: number) => (
            <div key={idx} className="grid grid-cols-5 gap-4 px-4 py-3 items-center">
              <div className="text-sm font-medium">{providerLabels[p.id] || p.id}</div>
              <div className="text-sm text-right">
                {p.used !== undefined 
                  ? `$${p.used.toFixed(2)}` 
                  : <span className="text-muted-foreground">—</span>}
              </div>
              <div className="text-sm text-right">
                {p.limit !== undefined 
                  ? `$${p.limit.toFixed(2)}` 
                  : <span className="text-muted-foreground">—</span>}
              </div>
              <div className="text-sm text-right">
                {p.remaining !== undefined 
                  ? `$${p.remaining.toFixed(2)}` 
                  : <span className="text-muted-foreground">—</span>}
              </div>
              <div className="text-right"><StatusBadge status={p.status} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Overall Status</p>
          <p className={`text-2xl font-semibold ${
            data?.overall === "ok" ? "text-green-400" : "text-yellow-400"
          }`}>
            {data?.overall === "ok" ? "Operational" : "Degraded"}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Providers</p>
          <p className="text-2xl font-semibold">{data?.providers?.length || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Errors</p>
          <p className="text-2xl font-semibold text-red-400">
            {data?.providers?.filter(p => p.status === "error").length || 0}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Last updated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "N/A"}
      </p>
    </div>
  );
}