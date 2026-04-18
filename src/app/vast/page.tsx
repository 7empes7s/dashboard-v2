"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

interface VastData {
  generatedAt: number;
  sourceStatus: "direct" | "inferred";
  account: {
    balance: number;
    usableCredits: number;
    pendingCharges: number;
  } | null;
  costs: {
    hourlyBurn: number;
    runtimeHours: number;
    runwayHours: number | null;
  } | null;
  instances: Array<{
    id: number;
    gpuName: string;
    gpuCount: number;
    hourlyCost: number;
    status: string;
    createdAt: string;
  }>;
  remote: {
    cpuPercent: number;
    memoryUsedGb: number;
    memoryTotalGb: number;
    diskUsedGb: number;
    diskTotalGb: number;
    gpuUtilization: number[];
    gpuMemoryUsedMb: number[];
    gpuMemoryTotalMb: number[];
    gpuTemperature: number[];
  } | null;
}

export default function Vast() {
  const [data, setData] = useState<VastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchVast() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch("/api/vast", { signal: controller.signal });
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
    fetchVast();
    const interval = setInterval(fetchVast, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold tracking-tight mb-4">Vast.ai</h1>
        <p className="text-muted-foreground">Loading...</p>
        {error && <p className="text-sm text-red-400 mt-2">Error: {error}</p>}
      </div>
    );
  }

  const { account, costs, instances, remote } = data || {};

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Vast.ai</h1>
        <p className="text-sm text-muted-foreground mt-1">GPU instance and account management</p>
      </div>

      {!account && !data?.sourceStatus ? (
        <div className="bg-card border border-red-800 rounded-lg p-4 text-red-400">
          Vast API unavailable. Check API key configuration.
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold mb-3">Account</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-2xl font-semibold">${account?.balance?.toFixed(2) || "0.00"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Usable Credits</p>
                <p className="text-2xl font-semibold">${account?.usableCredits?.toFixed(2) || "0.00"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Hourly Burn</p>
                <p className="text-2xl font-semibold text-orange-400">
                  ${costs?.hourlyBurn?.toFixed(2) || "0.00"}/hr
                </p>
              </div>
              {costs?.runwayHours && (
                <div>
                  <p className="text-xs text-muted-foreground">Runway</p>
                  <p className="text-2xl font-semibold text-green-400">
                    {costs.runwayHours < 24 
                      ? `${costs.runwayHours.toFixed(1)}h` 
                      : `${(costs.runwayHours / 24).toFixed(1)}d`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {instances && instances.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">Running Instances</h2>
              <div className="space-y-2">
                {instances.map((inst) => (
                  <div key={inst.id} className="flex items-center justify-between bg-muted/50 rounded p-3">
                    <div>
                      <p className="font-medium">{inst.gpuName} ×{inst.gpuCount}</p>
                      <p className="text-xs text-muted-foreground">ID: {inst.id}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${inst.hourlyCost}/hr</p>
                      <p className="text-xs text-green-500">Running</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {remote && (
            <div className="bg-card border border-border rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold mb-3">GPU Telemetry</h2>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">CPU</p>
                  <p className="text-2xl font-semibold">{remote.cpuPercent}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">RAM</p>
                  <p className="text-2xl font-semibold">{remote.memoryUsedGb}/{remote.memoryTotalGb}GB</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GPU Util</p>
                  <p className="text-2xl font-semibold">{remote.gpuUtilization[0]}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GPU Mem</p>
                  <p className="text-2xl font-semibold">
                    {remote.gpuMemoryUsedMb[0]}MB
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Source: {data?.sourceStatus || "unknown"} • Last updated:{" "}
            {data?.generatedAt ? new Date(data.generatedAt).toLocaleTimeString() : "N/A"}
          </p>
        </>
      )}
    </div>
  );
}