"use client";

import { useEffect, useState } from "react";

interface AgentsData {
  paperclip: {
    running: boolean;
    containers: string[];
  };
  channels: {
    telegram: string;
  };
  lastUpdate: string;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
      status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
    }`}>
      {status}
    </span>
  );
}

export default function Agents() {
  const [data, setData] = useState<AgentsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">Agents</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">Paperclip and channel status</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Paperclip</h2>
        <div className="flex items-center gap-2 mb-3">
          <StatusBadge status={data?.paperclip?.running ? "active" : "inactive"} />
          <span className="text-sm">{data?.paperclip?.running ? "Running" : "Stopped"}</span>
        </div>
        {data?.paperclip?.containers?.length ? (
          <div className="space-y-1">
            {data.paperclip.containers.map((container: string, idx: number) => (
              <p key={idx} className="text-xs font-mono text-muted-foreground">{container}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No containers running</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Channels</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Telegram</span>
            <StatusBadge status={data?.channels?.telegram || "inactive"} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">WebSocket (Mimule)</span>
            <StatusBadge status={data?.paperclip?.running ? "active" : "inactive"} />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Last updated: {data?.lastUpdate ? new Date(data.lastUpdate).toLocaleTimeString() : "N/A"}
      </p>
    </div>
  );
}