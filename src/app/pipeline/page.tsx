"use client";

import { useEffect, useState } from "react";

interface Story {
  id: string;
  topic?: string;
  stage?: string;
  status: string;
  sourceVertical?: string;
}

interface PipelineData {
  queue: Story[];
  current: { topic: string; stage: string; sourceVertical: string } | null;
  completed: Story[];
  stats: { queued: number; completed24h: number; failed: number };
  timestamp: string;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "bg-blue-500/20 text-blue-400",
    success: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    killed: "bg-yellow-500/20 text-yellow-400",
    stuck: "bg-orange-500/20 text-orange-400",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

export default function Pipeline() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [newVertical, setNewVertical] = useState("ai");

  useEffect(() => {
    async function fetchPipeline() {
      try {
        const res = await fetch("/api/pipeline");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to fetch pipeline:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPipeline();
    const interval = setInterval(fetchPipeline, 10000);
    return () => clearInterval(interval);
  }, []);

  async function addStory() {
    if (!newTopic.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: "add", topic: newTopic, vertical: newVertical }),
      });
      const result = await res.json();
      if (result.success) {
        setNewTopic("");
        const res = await fetch("/api/pipeline");
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to add story:", err);
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">Pipeline</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const stats = data?.stats || { queued: 0, completed24h: 0, failed: 0 };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground mt-1">Editorial operations control</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Queued</p>
          <p className="text-2xl font-semibold mt-1">{stats.queued}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completed (24h)</p>
          <p className="text-2xl font-semibold mt-1">{stats.completed24h}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Failed</p>
          <p className="text-2xl font-semibold mt-1 text-red-400">{stats.failed}</p>
        </div>
      </div>

      {data?.current && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Running</h2>
            <StatusBadge status="running" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Topic</span>
              <span className="font-mono text-xs truncate max-w-[300px]">{data.current.topic}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Stage</span>
              <span className="font-mono text-xs">{data.current.stage}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Vertical</span>
              <span className="font-mono text-xs">{data.current.sourceVertical}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold mb-3">Add Story</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Topic..."
            className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm font-mono"
            onKeyDown={(e) => e.key === "Enter" && addStory()}
          />
          <select
            value={newVertical}
            onChange={(e) => setNewVertical(e.target.value)}
            className="bg-background border border-border rounded px-3 py-2 text-sm"
          >
            <option value="ai">AI</option>
            <option value="finance">Finance</option>
            <option value="crypto">Crypto</option>
            <option value="science">Science</option>
            <option value="global-politics">Global Politics</option>
            <option value="trends">Trends</option>
          </select>
          <button
            onClick={addStory}
            disabled={adding || !newTopic.trim()}
            className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Queue ({data?.queue?.length || 0})</h2>
        {(data?.queue?.length || 0) > 0 ? (
          <div className="space-y-1">
            {data?.queue?.map((story: Story, idx: number) => (
              <div key={story.id || idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono truncate">{story.topic}</p>
                  <p className="text-xs text-muted-foreground">{story.stage} - {story.sourceVertical}</p>
                </div>
                <StatusBadge status={story.status || "pending"} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Queue empty</p>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "N/A"}
      </p>
    </div>
  );
}