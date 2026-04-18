"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

interface AuditEntry {
  id: string;
  timestamp: number;
  action: string;
  user: string;
  target: string;
  result: string;
}

export default function Audit() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchLogs() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch("/api/audit", { signal: controller.signal });
        clearTimeout(timeoutId);
        if (cancelled) return;
        const json = await res.json();
        setLogs(json.logs || []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">Audit Log</h1>
        <p className="text-muted-foreground">Loading...</p>
        {error && <p className="text-sm text-red-400 mt-2">Error: {error}</p>}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Action history and audit trail</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
          <div>Timestamp</div>
          <div>Action</div>
          <div>Target</div>
          <div>User</div>
          <div>Result</div>
        </div>
        <div className="divide-y divide-border">
          {logs.length > 0 ? (
            logs.map((entry: AuditEntry, idx: number) => (
              <div key={entry.id || idx} className="grid grid-cols-5 gap-4 px-4 py-3 items-center">
                <div className="text-sm text-muted-foreground">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "—"}
                </div>
                <div className="text-sm font-medium">{entry.action}</div>
                <div className="text-sm font-mono">{entry.target}</div>
                <div className="text-sm">{entry.user}</div>
                <div className="text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    entry.result === "success" 
                      ? "bg-green-500/20 text-green-400" 
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {entry.result}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-muted-foreground">
              No audit entries
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Showing {logs.length} entries
      </p>
    </div>
  );
}