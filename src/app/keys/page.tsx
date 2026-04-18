"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

interface KeyStatus {
  key: string;
  name: string;
  provider: string;
  status: "ok" | "missing" | "exhausted";
  prefix?: string;
  source?: "env" | "cli";
}

interface KeysData {
  generatedAt: number;
  keys: KeyStatus[];
  summary: {
    total: number;
    ok: number;
    missing: number;
    exhausted: number;
  };
  issues: Array<{
    severity: string;
    key: string;
    message: string;
  }>;
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; icon: string }> = {
    ok: { bg: "bg-green-500/20", text: "text-green-400", icon: "✓" },
    missing: { bg: "bg-red-500/20", text: "text-red-400", icon: "✗" },
    exhausted: { bg: "bg-yellow-500/20", text: "text-yellow-400", icon: "⚠" },
  };
  const config = statusConfig[status] || statusConfig.missing;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      <span className="capitalize">{status}</span>
    </span>
  );
}

export default function Keys() {
  const [data, setData] = useState<KeysData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchKeys() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch("/api/keys", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (cancelled) return;
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch");
        console.error("Failed to fetch keys:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchKeys();
    const interval = setInterval(fetchKeys, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">API Keys</h1>
        <p className="text-muted-foreground">Loading...</p>
        {error && <p className="text-sm text-red-400 mt-2">Error: {error}</p>}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">API key status and health</p>
      </div>

      {data?.issues && data.issues.length > 0 && (
        <div className="space-y-2 mb-6">
          {data.issues.map((issue, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border text-sm ${
                issue.severity === "critical"
                  ? "bg-red-950/30 border-red-800 text-red-400"
                  : "bg-yellow-950/30 border-yellow-800 text-yellow-400"
              }`}
            >
              <span className="font-medium">{issue.key}:</span> {issue.message}
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
          <div>Provider</div>
          <div>Key Name</div>
          <div>Source</div>
          <div>Prefix</div>
          <div>Status</div>
        </div>
        <div className="divide-y divide-border">
          {data?.keys?.map((key: KeyStatus, idx: number) => (
            <div key={idx} className="grid grid-cols-5 gap-4 px-4 py-3 items-center">
              <div className="text-sm font-medium">{key.provider}</div>
              <div className="text-sm font-mono">{key.key}</div>
              <div className="text-sm text-muted-foreground">{key.source === "cli" ? "CLI (Subscription)" : "ENV"}</div>
              <div className="text-sm text-muted-foreground">{key.prefix || "—"}</div>
              <div><StatusBadge status={key.status} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Keys</p>
          <p className="text-2xl font-semibold">{data?.summary?.total || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">OK</p>
          <p className="text-2xl font-semibold text-green-400">{data?.summary?.ok || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Issues</p>
          <p className="text-2xl font-semibold text-red-400">{((data?.summary?.missing || 0) + (data?.summary?.exhausted || 0))}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Last updated: {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "N/A"}
      </p>
    </div>
  );
}