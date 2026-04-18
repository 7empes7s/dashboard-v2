"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";

interface Service {
  name: string;
  status: string;
  activeState?: string;
  subState?: string;
}

interface InfraData {
  cpu: string;
  memory: string;
  disk: string;
  uptime: string;
  services: Service[];
  timestamp: string;
}

interface GPUHealth {
  status: string;
  models: string[];
  probe_ms: number;
  checked_at: number;
}

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error";
}

interface ConfirmDialog {
  open: boolean;
  service: string | null;
}

interface LogEvent {
  id: string;
  timestamp: Date;
  type: "restart" | "alert" | "status" | "error";
  message: string;
  service?: string;
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${
      isActive 
        ? "bg-green-500/15 text-green-400 running-pulse-green" 
        : "bg-red-500/15 text-red-400"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-400" : "bg-red-400"}`} />
      {status}
    </span>
  );
}

function GPUSection({ data }: { data: GPUHealth | null }) {
  if (!data) return null;
  
  const isUp = data.status === "up";
  
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 running-pulse-green" />
          GPU Tunnel
        </h3>
        <span className={`text-xs font-mono ${isUp ? "text-green-400" : "text-red-400"}`}>
          {data.probe_ms}ms
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <p className={`text-lg font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
            {isUp ? "Online" : "Offline"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Models</p>
          <p className="text-sm font-mono">{data.models?.length || 0} loaded</p>
        </div>
      </div>
      {data.models && data.models.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Loaded Models</p>
          <div className="flex flex-wrap gap-1.5">
            {data.models.slice(0, 4).map((model) => (
              <span key={model} className="text-[10px] px-2 py-0.5 bg-secondary rounded font-mono">
                {model}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Toast({ show, message, type, onClose }: ToastState & { onClose: () => void }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);
  
  if (!show) return null;
  
  return (
    <div className={`toast ${type === "success" ? "toast-success" : "toast-error"} animate-fade-in-up`}>
      <span className="text-sm">{message}</span>
    </div>
  );
}

function ConfirmDialog({ open, service, onConfirm, onCancel }: ConfirmDialog & { onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    if (open) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") onConfirm();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onConfirm, onCancel]);
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 animate-fade-in-up" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 animate-scale-in shadow-xl">
        <h3 className="text-lg font-semibold mb-2">Restart Service?</h3>
        <p className="text-sm text-muted-foreground mb-6">
          This will restart <code className="bg-secondary px-1.5 py-0.5 rounded text-xs">{service}</code>. 
          The service will be temporarily unavailable.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            autoFocus
          >
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-secondary/50 animate-pulse rounded ${className}`} />;
}

function AnimatedNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  
  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const duration = 400;
    const startTime = performance.now();
    
    if (start === end) return;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplayValue(current);
      prevValue.current = current;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);
  
  const display = format ? format(displayValue) : displayValue.toFixed(value % 1 === 0 ? 0 : 1);
  
  return (
    <span className="tabular-nums">
      {display}
    </span>
  );
}

function EventStream({ events }: { events: LogEvent[] }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary running-pulse" />
        <h3 className="text-xs font-semibold uppercase tracking-wide">Live Events</h3>
      </div>
      <div className="h-20 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-card pointer-events-none z-10" />
        <div className="space-y-1">
          {events.slice(0, 5).map((event, i) => (
            <div 
              key={event.id} 
              className="flex items-center gap-2 text-xs animate-fade-in-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="text-muted-foreground font-mono text-[10px] w-16">
                {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${
                event.type === "restart" ? "bg-blue-400" :
                event.type === "alert" ? "bg-yellow-400" :
                event.type === "error" ? "bg-red-400" : "bg-green-400"
              }`} />
              <span className="text-muted-foreground truncate flex-1">{event.message}</span>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No recent events</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, trend, delay, animate }: { label: string; value: string; trend?: "up" | "down" | "neutral"; delay?: number; animate?: boolean }) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : null;
  const numValue = parseFloat(value);
  
  return (
    <div className={`bg-card border border-border rounded-lg p-3 animate-fade-in-up ${delay ? `stagger-${delay}` : ""}`}>
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold mt-0.5 font-mono flex items-center gap-1 metric-value">
        {animate && !isNaN(numValue) ? (
          <AnimatedNumber value={numValue} format={(n) => value.includes('%') ? `${Math.round(n)}%` : n.toFixed(2)} />
        ) : (
          value
        )}
        {trendIcon && (
          <span className={`text-xs ${trend === "up" ? "text-green-400" : "text-red-400"}`}>
            {trendIcon}
          </span>
        )}
      </p>
    </div>
  );
}

export default function Infrastructure() {
  const [data, setData] = useState<InfraData | null>(null);
  const [gpuData, setGpuData] = useState<GPUHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState<string | null>(null);
  const [services, setServices] = useState<Array<{name: string; status: string}>>([]);
  const [toast, setToast] = useState<ToastState>({ show: false, message: "", type: "success" });
  const [justRestarted, setJustRestarted] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>({ open: false, service: null });
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [events, setEvents] = useState<LogEvent[]>([]);

  const addEvent = useCallback((type: LogEvent["type"], message: string, service?: string) => {
    const event: LogEvent = {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date(),
      type,
      message,
      service,
    };
    setEvents(prev => [event, ...prev].slice(0, 20));
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
  }, []);

  const filteredServices = useMemo(() => {
    if (!data?.services) return [];
    return data.services.filter(svc => {
      const matchesText = !filter || svc.name.toLowerCase().includes(filter.toLowerCase());
      const matchesStatus = statusFilter === "all" || svc.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [data?.services, filter, statusFilter]);

  useEffect(() => {
    async function fetchInfra() {
      try {
        const res = await fetch("/api/infra");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to fetch infra:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInfra();
    const infraInterval = setInterval(fetchInfra, 15000);
    return () => clearInterval(infraInterval);
  }, []);

  useEffect(() => {
    async function fetchGPU() {
      try {
        const res = await fetch("/api/gpu-health");
        if (res.ok) {
          const json = await res.json();
          setGpuData(json);
        }
      } catch { /* silent */ }
    }
    fetchGPU();
    const gpuInterval = setInterval(fetchGPU, 20000);
    return () => clearInterval(gpuInterval);
  }, []);

  useEffect(() => {
    fetch("/api/services/controls")
      .then(r => r.json())
      .then(d => setServices(d.services || []))
      .catch(() => {});
  }, []);

  async function handleRestart(serviceName: string) {
    setConfirmDialog({ open: false, service: null });
    setRestarting(serviceName);
    addEvent("restart", `Restarting ${serviceName}`, serviceName);
    try {
      await fetch("/api/services/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceName, action: "restart" }),
      });
      const res = await fetch("/api/services/controls");
      const d = await res.json();
      setServices(d.services || []);
      setJustRestarted(serviceName);
      addEvent("status", `${serviceName} is now active`, serviceName);
      showToast(`${serviceName} restarted`, "success");
      setTimeout(() => setJustRestarted(null), 3000);
    } catch {
      addEvent("error", `Failed to restart ${serviceName}`, serviceName);
      showToast(`Failed to restart ${serviceName}`, "error");
    } finally {
      setRestarting(null);
    }
  }

  function openConfirm(serviceName: string) {
    setConfirmDialog({ open: true, service: serviceName });
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <Skeleton className="h-7 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card border border-border rounded-lg p-3">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-card border border-border rounded-lg p-4">
            <Skeleton className="h-5 w-32 mb-3" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between py-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <Skeleton className="h-5 w-24 mb-3" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const cpuNum = parseFloat(data?.cpu || "0");
  const memoryMatch = data?.memory?.match(/(\d+)\s*\/\s*(\d+)/);
  const memUsed = memoryMatch ? parseInt(memoryMatch[1]) : 0;
  const memTotal = memoryMatch ? parseInt(memoryMatch[2]) : 1;
  const memPercent = Math.round((memUsed / memTotal) * 100);

  return (
    <div className="p-6">
      <Toast {...toast} onClose={() => setToast(t => ({ ...t, show: false }))} />
      
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight animate-fade-in-up">Infrastructure</h1>
        <p className="text-sm text-muted-foreground mt-1 animate-fade-in-up stagger-1">Server health and service status</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <MetricCard label="CPU Load" value={data?.cpu || "0"} trend={cpuNum > 2 ? "up" :cpuNum > 1 ? "neutral" : "down"} delay={1} animate />
        <MetricCard label="Memory" value={`${memPercent}%`} trend={memPercent > 80 ? "up" : memPercent > 60 ? "neutral" : "down"} delay={2} animate />
        <MetricCard label="Disk" value={data?.disk || "N/A"} delay={3} />
        <MetricCard label="Uptime" value={data?.uptime || "N/A"} delay={4} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2">
          <div className="bg-card border border-border rounded-lg p-4 animate-fade-in-up stagger-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                System Services
              </h2>
              <span className="text-xs text-muted-foreground">{filteredServices.length} services</span>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Filter services..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                className="px-3 py-1.5 text-sm bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="space-y-1">
              {filteredServices.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No services match your filter</p>
              ) : (
                filteredServices.map((svc) => (
                  <div key={svc.name} className={"service-row flex items-center justify-between py-2 px-2 rounded hover:bg-secondary/50 " + (justRestarted === svc.name ? "bg-green-500/10" : "")}>
                    <span className="text-sm font-mono">{svc.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openConfirm(svc.name)}
                        disabled={restarting !== null}
                        className={"btn-restart text-[10px] px-2 py-1 bg-secondary text-muted-foreground rounded hover:bg-primary hover:text-primary-foreground disabled:opacity-50 " + (restarting === svc.name ? "spinning" : "")}
                      >
                        {restarting === svc.name ? "..." : "↻"}
                      </button>
                      <StatusBadge status={svc.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="animate-fade-in-up stagger-4">
          <GPUSection data={gpuData} />
        </div>
      </div>

      <EventStream events={events} />

      <ConfirmDialog
        open={confirmDialog.open}
        service={confirmDialog.service}
        onConfirm={() => confirmDialog.service && handleRestart(confirmDialog.service)}
        onCancel={() => setConfirmDialog({ open: false, service: null })}
      />

      <p className="text-xs text-muted-foreground mt-4 animate-fade-in-up stagger-5">
        Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "N/A"}
      </p>
    </div>
  );
}