"use client";

import { useEffect, useState } from "react";

interface Incident {
  id: string;
  topic?: string;
  stage?: string;
  error?: string;
  timestamp?: number;
}

interface HistoryData {
  incidents: Incident[];
  totalRuns: number;
  timestamp: string;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
      status === "stuck" ? "bg-orange-500/20 text-orange-400" : "bg-red-500/20 text-red-400"
    }`}>
      {status}
    </span>
  );
}

export default function History() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/history");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">History</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground mt-1">Recent incidents and runs</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Total Runs</h2>
          <span className="text-2xl font-semibold">{data?.totalRuns || 0}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Recent Incidents</h2>
        {data?.incidents?.length ? (
          <div className="space-y-3">
            {data.incidents.map((incident: Incident, idx: number) => (
              <div key={idx} className="py-3 border-b border-border last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{incident.topic || incident.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {incident.stage} - {incident.timestamp ? new Date(incident.timestamp).toLocaleString() : "Unknown"}
                    </p>
                    {incident.error && (
                      <p className="text-xs text-red-400 mt-1 truncate">{incident.error}</p>
                    )}
                  </div>
                  <StatusBadge status="failed" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recent incidents</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "N/A"}
      </p>
    </div>
  );
}