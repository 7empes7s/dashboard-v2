"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

interface RateLimitIncident {
  provider: string;
  model: string;
  errorType: string;
  error: string;
  count: number;
}

interface RateLimitData {
  generatedAt: number;
  confidence: string;
  incidents: RateLimitIncident[];
  summary: {
    totalIncidents: number;
    byTool: Record<string, number>;
  };
}

export default function RateLimits() {
  const [data, setData] = useState<RateLimitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchRateLimits() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch("/api/rate-limits", { signal: controller.signal });
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
    fetchRateLimits();
    const interval = setInterval(fetchRateLimits, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">Rate Limits</h1>
        <p className="text-muted-foreground">Loading...</p>
        {error && <p className="text-sm text-red-400 mt-2">Error: {error}</p>}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Rate Limits</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rate limit incidents (confidence: {data?.confidence || "unknown"})
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Summary</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total Incidents</p>
            <p className="text-2xl font-semibold">{data?.summary?.totalIncidents || 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Groq</p>
            <p className="text-2xl font-semibold">{data?.summary?.byTool?.groq || 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">OpenRouter</p>
            <p className="text-2xl font-semibold">{data?.summary?.byTool?.openrouter || 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
          <div>Provider</div>
          <div>Model</div>
          <div>Type</div>
          <div>Count</div>
        </div>
        <div className="divide-y divide-border">
          {data?.incidents?.length ? (
            data.incidents.map((inc: RateLimitIncident, idx: number) => (
              <div key={idx} className="grid grid-cols-4 gap-4 px-4 py-3 items-center">
                <div className="text-sm font-medium">{inc.provider}</div>
                <div className="text-sm font-mono">{inc.model}</div>
                <div className="text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    inc.errorType === "rate_limit" 
                      ? "bg-yellow-500/20 text-yellow-400" 
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {inc.errorType}
                  </span>
                </div>
                <div className="text-sm">{inc.count}</div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-muted-foreground">
              No rate limit incidents detected
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Last updated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "N/A"}
      </p>
    </div>
  );
}