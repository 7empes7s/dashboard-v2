"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PipelineStory = {
  id: string;
  topic?: string;
  stage?: string;
  status: string;
  sourceVertical?: string;
  retries?: number;
  waitingApproval?: boolean;
  gateReason?: string;
  lastError?: string;
};

type PipelineResponse = {
  queue: PipelineStory[];
  current: { topic: string; stage: string; sourceVertical: string } | null;
  completed: PipelineStory[];
  stats: { queued: number; completed24h: number; failed: number };
  timestamp: string;
};

type MachineSnapshot = {
  id: string;
  label: string;
  kind: "local" | "remote";
  provider: "hetzner" | "vast";
  hostname: string | null;
  location?: string | null;
  uptime: string | null;
  kernel: string | null;
  cpu: {
    model: string | null;
    cores: number;
    usagePercent: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: { usedMb: number; totalMb: number; percent: number };
  disk: { usedGb: number; totalGb: number; percent: number };
  gpu?: {
    name: string;
    count: number;
    utilization: number[];
    memoryUsedMb: number[];
    memoryTotalMb: number[];
    temperatureC: number[];
  };
  network?: {
    publicIp: string | null;
    sshHost: string | null;
    sshPort: number | null;
  };
  billing?: { hourlyCost: number };
  updatedAt: string;
};

type InfraResponse = {
  services: Array<{
    name: string;
    status: "active" | "inactive";
    activeState: string;
    subState: string;
    result: string;
  }>;
  machines: {
    local: MachineSnapshot;
    remote: MachineSnapshot | null;
  };
  summary: {
    activeServices: number;
    degradedServices: number;
    machineCount: number;
  };
  timestamp: string;
};

type ModelRow = {
  logicalName: string;
  provider: string;
  available: boolean;
  latency?: number;
  capability?: string;
  resolvedModel?: string;
  params?: number;
};

type ModelsResponse = {
  models: ModelRow[];
  timestamp: string;
};

type BlocklistResponse = {
  blocked: string[];
  notes: Record<string, string>;
};

type VastResponse = {
  generatedAt: number;
  sourceStatus: "direct" | "inferred";
  account: {
    id: number;
    username: string | null;
    balance: number;
    credit: number;
    usableCredits: number;
    pendingCharges: number;
    totalSpend: number;
    autobillAmount: number;
    autobillThreshold: number;
    canPay: boolean;
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
    cpuName?: string;
    cpuCores?: number;
    cpuRamMb?: number;
    diskSpaceGb?: number;
    publicIp?: string;
    location?: string;
    sshHost?: string;
    sshPort?: number;
    machineId?: number;
    hostId?: number;
    durationHours?: number | null;
    hourlyCost: number;
    status: string;
    createdAt: string;
  }>;
};

type ProviderUsage = {
  id: string;
  used?: number;
  limit?: number;
  remaining?: number;
  status: "ok" | "degraded" | "rate_limited" | "error";
};

type ProvidersResponse = {
  providers: ProviderUsage[];
  overall: string;
};

type KeysResponse = {
  keys: Array<{
    key: string;
    name: string;
    provider: string;
    exists: boolean;
    prefix?: string;
    status: "ok" | "missing" | "exhausted" | "unknown";
    source?: "env" | "cli";
  }>;
  summary: {
    total: number;
    ok: number;
    missing: number;
    exhausted: number;
  };
  issues: Array<{
    severity: "critical" | "warning";
    key: string;
    message: string;
  }>;
};

type RateLimitsResponse = {
  incidents: Array<{ provider: string; count: number; lastSeen?: string }>;
  summary: {
    totalIncidents: number;
    byTool: Record<string, number>;
  };
};

type HistoryResponse = {
  incidents: Array<{
    id: string;
    topic?: string;
    stage?: string;
    error?: string;
    timestamp?: number;
  }>;
  totalRuns: number;
};

type AuditResponse = {
  logs: Array<{
    id: string;
    timestamp: number;
    action: string;
    target: string;
    result: "success" | "failure";
    details: Record<string, unknown>;
  }>;
};

type AgentsResponse = {
  paperclip: {
    running: boolean;
    containers: string[];
  };
  channels: {
    telegram: string;
  };
};

type DashboardData = {
  pipeline: PipelineResponse | null;
  infra: InfraResponse | null;
  models: ModelsResponse | null;
  blocklist: BlocklistResponse | null;
  vast: VastResponse | null;
  providers: ProvidersResponse | null;
  keys: KeysResponse | null;
  rateLimits: RateLimitsResponse | null;
  history: HistoryResponse | null;
  audit: AuditResponse | null;
  agents: AgentsResponse | null;
};

type HistorySeries = {
  localCpu: number[];
  localMemory: number[];
  remoteGpu: number[];
  queueDepth: number[];
  credits: number[];
};

type ToastState = {
  visible: boolean;
  tone: "success" | "error";
  message: string;
};

const POLL_MS = 15000;
const SECTION_LINKS = [
  ["overview", "Overview"],
  ["machines", "Machines"],
  ["pipeline", "Pipeline"],
  ["models", "Models"],
  ["providers", "Providers"],
  ["history", "History"],
] as const;

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function clampSeries(series: number[], value: number) {
  return [...series.slice(-11), value];
}

function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "0";
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLatency(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  return `${Math.round(value)}ms`;
}

function formatRelativeTime(timestamp?: number | string | null) {
  if (!timestamp) return "unknown";
  const value =
    typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return "unknown";
  const diffMs = Date.now() - value;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return response.json();
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active" || status === "ok" || status === "running" || status === "available"
      ? "text-[var(--success)]"
      : status === "stuck" || status === "failed" || status === "error"
        ? "text-[var(--destructive)]"
        : status === "degraded" || status === "warning" || status === "missing"
          ? "text-[var(--warning)]"
          : "text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.72rem] uppercase tracking-[0.16em]",
        tone
      )}
      style={{
        borderColor: "color-mix(in oklch, currentColor 24%, transparent)",
        background: "color-mix(in oklch, currentColor 8%, transparent)",
      }}
    >
      <span className="status-dot ring-operational" />
      {status}
    </span>
  );
}

function MiniGraph({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const safeValues = values.length > 1 ? values : [0, ...values];
  const max = Math.max(...safeValues, 1);
  const min = Math.min(...safeValues, 0);
  const range = Math.max(max - min, 1);
  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(safeValues.length - 1, 1)) * 100;
      const y = 32 - ((value - min) / range) * 28;
      return `${x},${y}`;
    })
    .join(" ");

  const area = `0,32 ${points} 100,32`;

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-20 w-full overflow-visible"
    >
      <path d={`M ${area} Z`} fill={color} opacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricMeter({
  label,
  value,
  hint,
  tone = "var(--primary)",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="subtle-label">{label}</p>
          <p className="text-lg font-semibold">{value}%</p>
        </div>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="metric-bar h-2.5">
        <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: tone }} />
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body,
  actions,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="section-title mt-4">{title}</h2>
        <p className="mt-3 max-w-[70ch] text-base leading-7 text-muted-foreground">
          {body}
        </p>
      </div>
      {actions}
    </div>
  );
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids.join(",")]);
  return active;
}

type NavSection = { id: string; label: string; num: string };

function ProgressRail({
  sections,
  active,
  onJump,
}: {
  sections: NavSection[];
  active: string;
  onJump: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Section progress"
      className="progress-rail"
    >
      {sections.map((s) => {
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            onClick={() => onJump(s.id)}
            aria-label={`Jump to ${s.label}`}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              padding: "0.15rem 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              color: "inherit",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: "0.65rem",
                color: isActive ? "var(--ink)" : "var(--ink-3)",
                opacity: isActive ? 1 : 0,
                transition: "opacity .2s, color .2s",
                width: "1.5rem",
                textAlign: "right",
                letterSpacing: "0.04em",
              }}
            >
              {s.num}
            </span>
            <span
              style={{
                display: "block",
                width: isActive ? "28px" : "16px",
                height: "1px",
                background: isActive ? "var(--ink)" : "var(--border)",
                transition: "all .25s ease",
              }}
            />
          </button>
        );
      })}
    </nav>
  );
}

function FloatingNav({
  sections,
  active,
  onJump,
  theme,
  onTheme,
  variant,
  onVariant,
  onRefresh,
}: {
  sections: NavSection[];
  active: string;
  onJump: (id: string) => void;
  theme: "light" | "dark";
  onTheme: () => void;
  variant: string;
  onVariant: (v: string) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activeSec = sections.find((s) => s.id === active) || sections[0];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div ref={ref} className="floating-nav-shell">
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            bottom: "calc(100% + 0.6rem)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(360px, calc(100vw - 2rem))",
            padding: "0.5rem",
            boxShadow: "0 16px 48px -12px rgba(0,0,0,0.25)",
            backdropFilter: "blur(12px)",
            background: "color-mix(in oklab, var(--surface) 96%, transparent)",
          }}
        >
          <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => { onJump(s.id); setOpen(false); }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "baseline",
                  gap: "0.75rem",
                  padding: "0.55rem 0.75rem",
                  border: "none",
                  background: s.id === active ? "var(--surface-2)" : "transparent",
                  cursor: "pointer",
                  color: "inherit",
                  textAlign: "left",
                  borderRadius: "3px",
                }}
              >
                <span className="mono" style={{ fontSize: "0.7rem", color: "var(--ink-3)", width: "1.5rem" }}>
                  {s.num}
                </span>
                <span style={{ flex: 1, fontSize: "0.92rem" }}>{s.label}</span>
              </button>
            ))}
          </div>
          <div
            style={{
              borderTop: "1px solid var(--hairline)",
              marginTop: "0.5rem",
              paddingTop: "0.5rem",
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              padding: "0.5rem",
            }}
          >
            <button onClick={onTheme} className="jump-chip">
              {theme === "dark" ? "☾ Dark" : "☀ Light"}
            </button>
            <button onClick={() => onVariant(variant === "A" ? "B" : variant === "B" ? "C" : "A")} className="jump-chip">
              Variant {variant}
            </button>
            <button onClick={() => { onRefresh(); setOpen(false); }} className="jump-chip">
              ↺ Refresh
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.55rem 0.9rem 0.55rem 0.75rem",
          cursor: "pointer",
          boxShadow: "0 8px 24px -8px rgba(0,0,0,0.2)",
          backdropFilter: "blur(12px)",
          background: "color-mix(in oklab, var(--surface) 92%, transparent)",
          minWidth: "220px",
          color: "inherit",
          border: "1px solid var(--border)",
          borderRadius: "999px",
        }}
      >
        <span className="mono" style={{ fontSize: "0.68rem", color: "var(--ink-3)", letterSpacing: "0.04em" }}>
          {activeSec.num}
        </span>
        <span style={{ flex: 1, fontSize: "0.9rem", textAlign: "left" }}>{activeSec.label}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--ink-3)", transition: "transform .2s", transform: open ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </button>
    </div>
  );
}

function Toast({ state, onClose }: { state: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!state.visible) return;
    const timeout = window.setTimeout(onClose, 2800);
    return () => window.clearTimeout(timeout);
  }, [state.visible, onClose]);

  if (!state.visible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-[1.25rem] border border-border bg-card px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-3">
        <span
          className="status-dot"
          style={{
            color:
              state.tone === "success" ? "var(--success)" : "var(--destructive)",
          }}
        />
        <p className="text-sm text-foreground">{state.message}</p>
      </div>
    </div>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="ghost-btn"
      aria-label="Toggle color theme"
      type="button"
    >
      <span className="font-mono text-xs uppercase tracking-[0.16em]">
        {theme === "dark" ? "Dark" : "Light"}
      </span>
    </button>
  );
}

function SummaryTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="surface-muted rise-hover rounded-[1.5rem] p-4">
      <p className="subtle-label">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{note}</p>
    </div>
  );
}

function MachinePanel({
  machine,
  graphValues,
  titleHint,
}: {
  machine: MachineSnapshot | null;
  graphValues: { primary: number[]; secondary: number[] };
  titleHint: string;
}) {
  if (!machine) {
    return (
      <div className="surface-panel rounded-[2rem] p-6">
        <p className="subtle-label">Remote Host</p>
        <h3 className="mt-2 text-2xl font-semibold">Unavailable</h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The GPU host did not answer with usable telemetry. This usually means the
          tunnel is up but the SSH collector is still recovering.
        </p>
      </div>
    );
  }

  const primaryColor =
    machine.kind === "local" ? "var(--primary)" : "var(--warning)";
  const secondaryColor =
    machine.kind === "local" ? "var(--success)" : "var(--destructive)";

  return (
    <div className="surface-panel rounded-[2rem] p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="subtle-label">{titleHint}</p>
            <h3 className="mt-2 text-2xl font-semibold">{machine.label}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {machine.hostname || "unknown host"}
              {machine.location ? ` • ${machine.location}` : ""}
            </p>
          </div>
          <StatusBadge status={machine.kind === "local" ? "active" : "running"} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="surface-plain rounded-[1.5rem] p-4">
            <p className="subtle-label">CPU + Memory Trend</p>
            <MiniGraph values={graphValues.primary} color={primaryColor} />
            <p className="mt-3 text-sm text-muted-foreground">
              {machine.cpu.model || "CPU"} • {machine.cpu.cores} cores
            </p>
          </div>
          <div className="surface-plain rounded-[1.5rem] p-4">
            <p className="subtle-label">
              {machine.kind === "remote" ? "GPU + Disk Trend" : "Disk + Queue Trend"}
            </p>
            <MiniGraph values={graphValues.secondary} color={secondaryColor} />
            <p className="mt-3 text-sm text-muted-foreground">
              Updated {formatRelativeTime(machine.updatedAt)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <MetricMeter
            label="CPU"
            value={machine.cpu.usagePercent}
            hint={`load ${machine.cpu.load1.toFixed(2)} / ${machine.cpu.load5.toFixed(2)}`}
            tone={primaryColor}
          />
          <MetricMeter
            label="Memory"
            value={machine.memory.percent}
            hint={`${Math.round(machine.memory.usedMb / 1024)} / ${Math.round(
              machine.memory.totalMb / 1024
            )} GB`}
            tone="var(--success)"
          />
          <MetricMeter
            label="Disk"
            value={machine.disk.percent}
            hint={`${machine.disk.usedGb} / ${machine.disk.totalGb} GB`}
            tone="var(--warning)"
          />
          {machine.gpu ? (
            <MetricMeter
              label="GPU"
              value={Math.max(...machine.gpu.utilization, 0)}
              hint={`${machine.gpu.name} ×${machine.gpu.count}`}
              tone="var(--destructive)"
            />
          ) : (
            <div className="surface-plain rounded-[1.5rem] p-4">
              <p className="subtle-label">Uptime</p>
              <p className="mt-2 text-lg font-semibold">{machine.uptime || "unknown"}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Kernel {machine.kernel || "n/a"}
              </p>
            </div>
          )}
        </div>

        {machine.gpu ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {machine.gpu.utilization.map((util, index) => (
              <div key={`${machine.id}-gpu-${index}`} className="surface-plain rounded-[1.25rem] p-4">
                <p className="subtle-label">GPU {index + 1}</p>
                <p className="mt-2 text-2xl font-semibold">{util}%</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {Math.round(
                    (machine.gpu?.memoryUsedMb[index] || 0) / 1024
                  )}{" "}
                  /{" "}
                  {Math.round(
                    (machine.gpu?.memoryTotalMb[index] || 0) / 1024
                  )}{" "}
                  GB VRAM
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [variant, setVariant] = useState<"A" | "B" | "C" | "old">("B");
  const [data, setData] = useState<DashboardData | null>(null);
  const [historySeries, setHistorySeries] = useState<HistorySeries>({
    localCpu: [],
    localMemory: [],
    remoteGpu: [],
    queueDepth: [],
    credits: [],
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    tone: "success",
    message: "",
  });
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});
  const [storyDraft, setStoryDraft] = useState({
    topic: "",
    vertical: "ai",
    priority: "2",
  });
  const [blockDraft, setBlockDraft] = useState({ model: "", note: "" });
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const loadDashboard = async () => {
    const settled = await Promise.allSettled([
      fetchJson<PipelineResponse>("/api/pipeline"),
      fetchJson<InfraResponse>("/api/infra"),
      fetchJson<ModelsResponse>("/api/models"),
      fetchJson<BlocklistResponse>("/api/models/blocklist"),
      fetchJson<VastResponse>("/api/vast"),
      fetchJson<ProvidersResponse>("/api/providers"),
      fetchJson<KeysResponse>("/api/keys"),
      fetchJson<RateLimitsResponse>("/api/rate-limits"),
      fetchJson<HistoryResponse>("/api/history"),
      fetchJson<AuditResponse>("/api/audit"),
      fetchJson<AgentsResponse>("/api/agents"),
    ]);

    const nextData: DashboardData = {
      pipeline:
        settled[0].status === "fulfilled" ? settled[0].value : null,
      infra: settled[1].status === "fulfilled" ? settled[1].value : null,
      models: settled[2].status === "fulfilled" ? settled[2].value : null,
      blocklist:
        settled[3].status === "fulfilled" ? settled[3].value : null,
      vast: settled[4].status === "fulfilled" ? settled[4].value : null,
      providers:
        settled[5].status === "fulfilled" ? settled[5].value : null,
      keys: settled[6].status === "fulfilled" ? settled[6].value : null,
      rateLimits:
        settled[7].status === "fulfilled" ? settled[7].value : null,
      history:
        settled[8].status === "fulfilled" ? settled[8].value : null,
      audit: settled[9].status === "fulfilled" ? settled[9].value : null,
      agents:
        settled[10].status === "fulfilled" ? settled[10].value : null,
    };

    setData(nextData);
    setLastUpdated(new Date().toISOString());
    setHistorySeries((current) => ({
      localCpu: clampSeries(
        current.localCpu,
        nextData.infra?.machines.local.cpu.usagePercent || 0
      ),
      localMemory: clampSeries(
        current.localMemory,
        nextData.infra?.machines.local.memory.percent || 0
      ),
      remoteGpu: clampSeries(
        current.remoteGpu,
        Math.max(
          ...(nextData.infra?.machines.remote?.gpu?.utilization || [0])
        )
      ),
      queueDepth: clampSeries(
        current.queueDepth,
        nextData.pipeline?.stats.queued || 0
      ),
      credits: clampSeries(
        current.credits,
        nextData.vast?.account?.usableCredits || 0
      ),
    }));
  };

  useEffect(() => {
    const currentTheme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(currentTheme);
  }, []);

  useEffect(() => {
    try {
      const savedVariant = window.localStorage.getItem("dash-variant");
      if (savedVariant && ["A", "B", "C", "old"].includes(savedVariant)) {
        setVariant(savedVariant as "A" | "B" | "C" | "old");
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        await loadDashboard();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void refresh();
    const interval = window.setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const showToast = (message: string, tone: "success" | "error") => {
    setToast({ visible: true, message, tone });
  };

  const setBusy = (key: string, value: boolean) => {
    setBusyMap((current) => ({ ...current, [key]: value }));
  };

  const logAudit = async (
    action: string,
    target: string,
    details: Record<string, unknown>,
    result: "success" | "failure"
  ) => {
    try {
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, target, details, result }),
      });
    } catch {
      // Ignore audit failures to keep operator controls responsive.
    }
  };

  const runAction = async (
    key: string,
    request: () => Promise<Response>,
    successMessage: string,
    auditAction: string,
    auditTarget: string,
    auditDetails: Record<string, unknown>
  ) => {
    setBusy(key, true);
    try {
      const response = await request();
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) {
        throw new Error(json.error || json.message || "Action failed");
      }
      showToast(successMessage, "success");
      await logAudit(auditAction, auditTarget, auditDetails, "success");
      await loadDashboard();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Action failed",
        "error"
      );
      await logAudit(auditAction, auditTarget, auditDetails, "failure");
    } finally {
      setBusy(key, false);
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("dashboard-theme", next);
    setTheme(next);
  };

  const toggleVariant = () => {
    const variants: Array<"A" | "B" | "C" | "old"> = ["A", "B", "C", "old"];
    const currentIndex = variants.indexOf(variant);
    const next = variants[(currentIndex + 1) % variants.length];
    window.localStorage.setItem("dash-variant", next);
    setVariant(next);
  };

  const availableModels = data?.models?.models || [];
  const blockedModels = new Set(data?.blocklist?.blocked || []);
  const degradedServices =
    data?.infra?.services.filter((service) => service.status !== "active") || [];
  const recentIncidents = data?.history?.incidents || [];
  const keys = data?.keys?.keys || [];

  const providerSummary = useMemo(() => {
    const grouped = new Map<
      string,
      { total: number; available: number; p50Latency: number[] }
    >();

    for (const model of availableModels) {
      const entry = grouped.get(model.provider) || {
        total: 0,
        available: 0,
        p50Latency: [],
      };
      entry.total += 1;
      if (model.available) entry.available += 1;
      if (typeof model.latency === "number") entry.p50Latency.push(model.latency);
      grouped.set(model.provider, entry);
    }

    return [...grouped.entries()].map(([provider, entry]) => ({
      provider,
      total: entry.total,
      available: entry.available,
      avgLatency:
        entry.p50Latency.length > 0
          ? Math.round(
              entry.p50Latency.reduce((sum, value) => sum + value, 0) /
                entry.p50Latency.length
            )
          : null,
      usage:
        data?.providers?.providers.find((item) => item.id === provider) || null,
    }));
  }, [availableModels, data?.providers?.providers]);

  const NAV_SECTIONS: NavSection[] = useMemo(
    () => SECTION_LINKS.map(([id, label], i) => ({ id, label, num: String(i + 1).padStart(2, "0") })),
    []
  );

  const activeSection = useActiveSection(NAV_SECTIONS.map((s) => s.id));

  const jumpTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
  }, []);

  if (loading) {
    return (
      <main className="page-shell py-10">
        <div className="surface-panel rounded-[2rem] p-8">
          <div className="stagger-in">
            <p className="eyebrow">Control Room</p>
            <h1 className="hero-title mt-6">Loading the stack.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              Pulling current infrastructure, pipeline, model, and billing state.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <Toast state={toast} onClose={() => setToast((current) => ({ ...current, visible: false }))} />

      <ProgressRail sections={NAV_SECTIONS} active={activeSection} onJump={jumpTo} />

      <FloatingNav
        sections={NAV_SECTIONS}
        active={activeSection}
        onJump={jumpTo}
        theme={theme}
        onTheme={toggleTheme}
        variant={variant}
        onVariant={(v) => setVariant(v as typeof variant)}
        onRefresh={() =>
          runAction(
            "refresh",
            async () => {
              await loadDashboard();
              return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            },
            "Dashboard refreshed",
            "refresh.dashboard",
            "dashboard",
            {}
          )
        }
      />

      <main className={`pb-32 var-${variant.toLowerCase()}`}>

        <section id="overview" className="section-shell">
          <div className="page-shell">
            <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="stagger-in">
                <div className="eyebrow">Single Surface Dashboard</div>
                <h2 className="hero-title mt-6">
                  Everything critical, one scroll away.
                </h2>
                <p className="mt-6 max-w-[60ch] text-lg leading-8 text-muted-foreground">
                  The dashboard now centers operational flow instead of pages:
                  machine health, queue state, model routing, credits, incidents,
                  and controls all live on the same surface.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() =>
                      runAction(
                        "pipeline-resume",
                        () =>
                          fetch("/api/pipeline/controls", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "resume" }),
                          }),
                        "Pipeline resumed",
                        "pipeline.resume",
                        "pipeline",
                        {}
                      )
                    }
                    disabled={busyMap["pipeline-resume"]}
                  >
                    Resume pipeline
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      runAction(
                        "pipeline-pause",
                        () =>
                          fetch("/api/pipeline/controls", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "pause" }),
                          }),
                        "Pipeline paused",
                        "pipeline.pause",
                        "pipeline",
                        {}
                      )
                    }
                    disabled={busyMap["pipeline-pause"]}
                  >
                    Pause pipeline
                  </button>
                  <a href="#pipeline" className="jump-chip">
                    Inject a story
                  </a>
                </div>
              </div>

              <div className="surface-panel grid-glow tiny-grid rounded-[2rem] p-6">
                <p className="subtle-label">Immediate attention</p>
                <div className="mt-6 space-y-5">
                  <div>
                    <p className="text-sm text-muted-foreground">Queue pressure</p>
                    <p className="mt-1 text-4xl font-semibold">
                      {data?.pipeline?.stats.queued || 0}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {data?.pipeline?.queue?.[0]?.gateReason ||
                        "No gating reason detected in the head of the queue."}
                    </p>
                  </div>
                  <MiniGraph values={historySeries.queueDepth} color="var(--primary)" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="surface-plain rounded-[1.25rem] p-4">
                      <p className="subtle-label">Failed in 24h</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {data?.pipeline?.stats.failed || 0}
                      </p>
                    </div>
                    <div className="surface-plain rounded-[1.25rem] p-4">
                      <p className="subtle-label">Credits runway</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {data?.vast?.costs?.runwayHours
                          ? `${Math.round(data.vast.costs.runwayHours)}h`
                          : "n/a"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryTile
                label="Machines"
                value={String(data?.infra?.summary.machineCount || 0)}
                note={`${data?.infra?.summary.activeServices || 0} active services across local and remote hosts.`}
              />
              <SummaryTile
                label="Models available"
                value={String(availableModels.filter((model) => model.available).length)}
                note={`${blockedModels.size} blocked, ${availableModels.length} total logical routes.`}
              />
              <SummaryTile
                label="Usable credits"
                value={formatMoney(data?.vast?.account?.usableCredits)}
                note={`Burning ${formatMoney(data?.vast?.costs?.hourlyBurn || 0)}/hr across running Vast capacity.`}
              />
              <SummaryTile
                label="Recent incidents"
                value={String(recentIncidents.length)}
                note={
                  recentIncidents[0]?.topic
                    ? `Latest: ${recentIncidents[0].topic}`
                    : "No recent failed runs surfaced from history."
                }
              />
            </div>
          </div>
        </section>

        <section id="machines" className="section-shell">
          <div className="page-shell">
            <SectionHeader
              eyebrow="Infrastructure"
              title="Two machines, one operational view."
              body="The local Hetzner host and the remote Vast GPU node now sit side by side, with live metric bars and rolling trend graphs instead of isolated one-off numbers."
            />

            <div className="grid gap-6 xl:grid-cols-2">
              <MachinePanel
                machine={data?.infra?.machines.local || null}
                graphValues={{
                  primary: historySeries.localCpu,
                  secondary: historySeries.localMemory,
                }}
                titleHint="Primary host"
              />
              <MachinePanel
                machine={data?.infra?.machines.remote || null}
                graphValues={{
                  primary: historySeries.remoteGpu,
                  secondary: historySeries.credits,
                }}
                titleHint="Remote compute"
              />
            </div>

            <div className="surface-panel mt-6 rounded-[2rem] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="subtle-label">Service controls</p>
                  <h3 className="mt-2 text-2xl font-semibold">Restart what matters from the row it lives in.</h3>
                </div>
                <div className="text-sm text-muted-foreground">
                  {degradedServices.length > 0
                    ? `${degradedServices.length} services need attention`
                    : "All tracked services are reporting healthy"}
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[44rem] border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <th className="pb-2">Service</th>
                      <th className="pb-2">State</th>
                      <th className="pb-2">Substate</th>
                      <th className="pb-2">Result</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.infra?.services.map((service) => (
                      <tr key={service.name} className="surface-plain rounded-[1.25rem]">
                        <td className="rounded-l-[1.25rem] px-4 py-4 font-mono text-sm">
                          {service.name}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={service.status} />
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {service.subState}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {service.result}
                        </td>
                        <td className="rounded-r-[1.25rem] px-4 py-4 text-right">
                          <button
                            type="button"
                            className="ghost-btn"
                            disabled={busyMap[`restart-${service.name}`]}
                            onClick={() =>
                              runAction(
                                `restart-${service.name}`,
                                () =>
                                  fetch("/api/services/controls", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      service: service.name,
                                      action: "restart",
                                    }),
                                  }),
                                `${service.name} restarted`,
                                "service.restart",
                                service.name,
                                {}
                              )
                            }
                          >
                            Restart
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="pipeline" className="section-shell">
          <div className="page-shell">
            <SectionHeader
              eyebrow="Pipeline"
              title="Operate the queue where you inspect it."
              body="Inject topics, resume or pause processing, and deal with stalled stories in place. The queue, current run, and recent failures stay in one section so the next action is always obvious."
            />

            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="surface-panel rounded-[2rem] p-6">
                <p className="subtle-label">Story injection</p>
                <h3 className="mt-2 text-2xl font-semibold">Push a story into the editorial stream.</h3>
                <div className="mt-6 grid gap-3">
                  <input
                    className="field-input"
                    placeholder="Topic or candidate headline"
                    value={storyDraft.topic}
                    onChange={(event) =>
                      setStoryDraft((current) => ({
                        ...current,
                        topic: event.target.value,
                      }))
                    }
                  />
                  <div className="grid gap-3 md:grid-cols-[1fr_0.45fr]">
                    <select
                      className="field-select"
                      value={storyDraft.vertical}
                      onChange={(event) =>
                        setStoryDraft((current) => ({
                          ...current,
                          vertical: event.target.value,
                        }))
                      }
                    >
                      {[
                        "ai",
                        "finance",
                        "global-politics",
                        "trends",
                        "science",
                        "wellness",
                        "culture",
                        "sports",
                        "crypto",
                        "energy",
                        "climate",
                      ].map((vertical) => (
                        <option key={vertical} value={vertical}>
                          {vertical}
                        </option>
                      ))}
                    </select>
                    <select
                      className="field-select"
                      value={storyDraft.priority}
                      onChange={(event) =>
                        setStoryDraft((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))
                      }
                    >
                      <option value="1">Priority 1</option>
                      <option value="2">Priority 2</option>
                      <option value="3">Priority 3</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="action-btn"
                    disabled={!storyDraft.topic.trim() || busyMap["inject-story"]}
                    onClick={() =>
                      runAction(
                        "inject-story",
                        () =>
                          fetch("/api/pipeline/inject", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              topic: storyDraft.topic,
                              vertical: storyDraft.vertical,
                              priority: Number.parseInt(storyDraft.priority, 10),
                            }),
                          }),
                        "Story injected",
                        "pipeline.inject",
                        storyDraft.topic,
                        { vertical: storyDraft.vertical }
                      ).then(() =>
                        setStoryDraft((current) => ({ ...current, topic: "" }))
                      )
                    }
                  >
                    Inject
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() =>
                      setStoryDraft({ topic: "", vertical: "ai", priority: "2" })
                    }
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                  <div className="surface-plain rounded-[1.25rem] p-4">
                    <p className="subtle-label">Current run</p>
                    <p className="mt-2 text-lg font-semibold">
                      {data?.pipeline?.current?.topic || "Idle"}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {data?.pipeline?.current
                        ? `${data.pipeline.current.stage} • ${data.pipeline.current.sourceVertical}`
                        : "No story is running right now."}
                    </p>
                  </div>
                  <div className="surface-plain rounded-[1.25rem] p-4">
                    <p className="subtle-label">Recent throughput</p>
                    <MiniGraph values={historySeries.queueDepth} color="var(--primary)" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      {data?.pipeline?.stats.completed24h || 0} stories completed in the current 24h window.
                    </p>
                  </div>
                </div>
              </div>

              <div className="surface-panel rounded-[2rem] p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="subtle-label">Queue + failures</p>
                    <h3 className="mt-2 text-2xl font-semibold">Retry, kill, or inspect from the row.</h3>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {data?.pipeline?.stats.queued || 0} queued •{" "}
                    {data?.pipeline?.stats.failed || 0} failed
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {(data?.pipeline?.queue || []).slice(0, 6).map((story) => (
                    <div key={story.id} className="surface-plain rounded-[1.25rem] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="font-mono text-sm text-foreground">
                            {story.topic || story.id}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {story.stage} • {story.sourceVertical || "unknown vertical"}
                          </p>
                          {story.gateReason ? (
                            <p className="mt-2 text-sm text-[var(--warning)]">
                              {story.gateReason}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={story.status || "queued"} />
                          <button
                            type="button"
                            className="ghost-btn"
                            disabled={busyMap[`retry-${story.id}`]}
                            onClick={() =>
                              runAction(
                                `retry-${story.id}`,
                                () =>
                                  fetch("/api/pipeline/controls", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "retry",
                                      storyId: story.id,
                                    }),
                                  }),
                                "Retry requested",
                                "pipeline.retry",
                                story.id,
                                {}
                              )
                            }
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            className="danger-btn"
                            disabled={busyMap[`kill-${story.id}`]}
                            onClick={() =>
                              runAction(
                                `kill-${story.id}`,
                                () =>
                                  fetch("/api/pipeline/controls", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "kill",
                                      storyId: story.id,
                                    }),
                                  }),
                                "Story killed",
                                "pipeline.kill",
                                story.id,
                                {}
                              )
                            }
                          >
                            Kill
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {(data?.pipeline?.completed || []).slice(0, 4).map((story) => (
                    <div key={`completed-${story.id}`} className="surface-muted rounded-[1.25rem] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <p className="font-mono text-sm">{story.topic || story.id}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {story.stage} • retries {story.retries || 0}
                          </p>
                          {story.lastError ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {story.lastError}
                            </p>
                          ) : null}
                        </div>
                        <StatusBadge status={story.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="models" className="section-shell">
          <div className="page-shell">
            <SectionHeader
              eyebrow="Routing"
              title="Model inventory and policy live on the same surface."
              body="Latency, provider, capability, and policy status sit in one matrix so you can spot weak routes and block or unblock them without leaving the page."
            />

            <div className="surface-panel rounded-[2rem] p-6">
              <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
                <div className="space-y-4">
                  <div className="surface-plain rounded-[1.5rem] p-4">
                    <p className="subtle-label">Block model</p>
                    <input
                      className="field-input mt-4"
                      value={blockDraft.model}
                      placeholder="logical model name"
                      onChange={(event) =>
                        setBlockDraft((current) => ({
                          ...current,
                          model: event.target.value,
                        }))
                      }
                    />
                    <textarea
                      className="field-textarea mt-3"
                      value={blockDraft.note}
                      placeholder="Why is this route blocked?"
                      onChange={(event) =>
                        setBlockDraft((current) => ({
                          ...current,
                          note: event.target.value,
                        }))
                      }
                    />
                    <div className="mt-4 flex gap-3">
                      <button
                        type="button"
                        className="action-btn"
                        disabled={!blockDraft.model.trim() || busyMap["block-model"]}
                        onClick={() =>
                          runAction(
                            "block-model",
                            () =>
                              fetch("/api/models/blocklist", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  model: blockDraft.model,
                                  action: "block",
                                  note: blockDraft.note,
                                }),
                              }),
                            `${blockDraft.model} blocked`,
                            "model.block",
                            blockDraft.model,
                            { note: blockDraft.note }
                          ).then(() =>
                            setBlockDraft({ model: "", note: "" })
                          )
                        }
                      >
                        Block
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => setBlockDraft({ model: "", note: "" })}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="surface-plain rounded-[1.5rem] p-4">
                    <p className="subtle-label">Current blocklist</p>
                    <div className="mt-4 space-y-2">
                      {(data?.blocklist?.blocked || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No blocked models right now.
                        </p>
                      ) : (
                        (data?.blocklist?.blocked || []).map((model) => (
                          <div key={model} className="flex items-center justify-between gap-3 rounded-[1rem] border border-border/70 px-3 py-3">
                            <div>
                              <p className="font-mono text-sm">{model}</p>
                              {data?.blocklist?.notes?.[model] ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {data.blocklist.notes[model]}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="ghost-btn"
                              disabled={busyMap[`unblock-${model}`]}
                              onClick={() =>
                                runAction(
                                  `unblock-${model}`,
                                  () =>
                                    fetch("/api/models/blocklist", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        model,
                                        action: "unblock",
                                      }),
                                    }),
                                  `${model} unblocked`,
                                  "model.unblock",
                                  model,
                                  {}
                                )
                              }
                            >
                              Unblock
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[52rem] border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <th className="pb-2">Model</th>
                        <th className="pb-2">Provider</th>
                        <th className="pb-2">Capability</th>
                        <th className="pb-2">Latency</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableModels.map((model) => {
                        const isBlocked = blockedModels.has(model.logicalName);
                        return (
                          <tr key={model.logicalName} className="surface-plain">
                            <td className="rounded-l-[1.25rem] px-4 py-4">
                              <p className="font-mono text-sm">{model.logicalName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {model.resolvedModel || "logical route"}
                              </p>
                            </td>
                            <td className="px-4 py-4 text-sm capitalize">
                              {model.provider}
                            </td>
                            <td className="px-4 py-4 text-sm capitalize text-muted-foreground">
                              {model.capability || "general"}
                            </td>
                            <td className="px-4 py-4 text-sm">
                              {formatLatency(model.latency)}
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge
                                status={
                                  isBlocked
                                    ? "blocked"
                                    : model.available
                                      ? "available"
                                      : "down"
                                }
                              />
                            </td>
                            <td className="rounded-r-[1.25rem] px-4 py-4 text-right">
                              {isBlocked ? (
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  disabled={busyMap[`unblock-inline-${model.logicalName}`]}
                                  onClick={() =>
                                    runAction(
                                      `unblock-inline-${model.logicalName}`,
                                      () =>
                                        fetch("/api/models/blocklist", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            model: model.logicalName,
                                            action: "unblock",
                                          }),
                                        }),
                                      `${model.logicalName} unblocked`,
                                      "model.unblock",
                                      model.logicalName,
                                      {}
                                    )
                                  }
                                >
                                  Unblock
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="ghost-btn"
                                  disabled={busyMap[`block-inline-${model.logicalName}`]}
                                  onClick={() =>
                                    setBlockDraft({
                                      model: model.logicalName,
                                      note: data?.blocklist?.notes?.[model.logicalName] || "",
                                    })
                                  }
                                >
                                  Stage block
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="providers" className="section-shell">
          <div className="page-shell">
            <SectionHeader
              eyebrow="Credits + access"
              title="Usage, keys, and remote account state finally have real substance."
              body="The Vast panel now uses the configured API key and remote SSH key, which means credits, burn, instance metadata, and GPU telemetry are no longer placeholders."
            />

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="surface-panel rounded-[2rem] p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="subtle-label">Vast account</p>
                      <h3 className="mt-2 text-2xl font-semibold">GPU billing and capacity</h3>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Source {data?.vast?.sourceStatus || "unknown"}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryTile
                      label="Credits"
                      value={formatMoney(data?.vast?.account?.usableCredits)}
                      note={`Autobill ${formatMoney(data?.vast?.account?.autobillAmount)} at threshold ${formatMoney(data?.vast?.account?.autobillThreshold)}.`}
                    />
                    <SummaryTile
                      label="Hourly burn"
                      value={formatMoney(data?.vast?.costs?.hourlyBurn)}
                      note={`${formatCount(data?.vast?.instances.length)} running instances reported by Vast.`}
                    />
                    <SummaryTile
                      label="Runtime"
                      value={`${Math.round(data?.vast?.costs?.runtimeHours || 0)}h`}
                      note={`Total spend ${formatMoney(Math.abs(data?.vast?.account?.totalSpend || 0))}.`}
                    />
                    <SummaryTile
                      label="Pending charges"
                      value={formatMoney(data?.vast?.account?.pendingCharges)}
                      note={
                        data?.vast?.account?.canPay
                          ? "Billing is enabled on the account."
                          : "Billing is not yet enabled."
                      }
                    />
                  </div>

                  <div className="mt-6 space-y-3">
                    {(data?.vast?.instances || []).map((instance) => (
                      <div key={instance.id} className="surface-plain rounded-[1.5rem] p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="font-mono text-sm">{instance.gpuName} ×{instance.gpuCount}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {instance.location || "unknown location"} •{" "}
                              {instance.publicIp || "no public IP"}
                            </p>
                          </div>
                          <div className="text-left lg:text-right">
                            <p className="text-lg font-semibold">
                              {formatMoney(instance.hourlyCost)}/hr
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {instance.durationHours
                                ? `${Math.round(instance.durationHours)}h active`
                                : "duration unavailable"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="surface-panel rounded-[2rem] p-6">
                  <p className="subtle-label">Provider health</p>
                  <div className="mt-6 space-y-4">
                    {providerSummary.map((provider) => (
                      <div key={provider.provider} className="surface-plain rounded-[1.25rem] p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <p className="text-lg font-semibold capitalize">
                              {provider.provider}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {provider.available}/{provider.total} routes available
                              {provider.avgLatency ? ` • avg ${provider.avgLatency}ms` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              status={provider.usage?.status || (provider.available > 0 ? "ok" : "error")}
                            />
                            {provider.usage?.limit ? (
                              <span className="text-sm text-muted-foreground">
                                {formatCount(provider.usage.used)} / {formatCount(provider.usage.limit)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {provider.usage?.limit ? (
                          <div className="metric-bar mt-4 h-2.5">
                            <span
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round(
                                    (((provider.usage.used || 0) /
                                      Math.max(provider.usage.limit || 1, 1)) *
                                      100)
                                  )
                                )}%`,
                              }}
                            />
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-muted-foreground">
                            No direct billing telemetry is available for this provider yet.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="surface-plain rounded-[1.25rem] p-4">
                      <p className="subtle-label">Agents</p>
                      <p className="mt-2 text-lg font-semibold">
                        {data?.agents?.paperclip.running ? "Paperclip running" : "Paperclip offline"}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Telegram channel is {data?.agents?.channels.telegram || "unknown"}.
                      </p>
                    </div>
                    <div className="surface-plain rounded-[1.25rem] p-4">
                      <p className="subtle-label">Rate limits</p>
                      <p className="mt-2 text-lg font-semibold">
                        {data?.rateLimits?.summary.totalIncidents || 0} incidents
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Current period shows {data?.rateLimits?.summary.byTool.groq || 0} Groq incidents and{" "}
                        {data?.rateLimits?.summary.byTool.github || 0} GitHub incidents.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="surface-panel rounded-[2rem] p-6">
                <p className="subtle-label">Key editor</p>
                <h3 className="mt-2 text-2xl font-semibold">Replace provider credentials without leaving the dashboard.</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Values are redacted in the table. Updates write back to `/etc/litellm/litellm.env`.
                </p>

                <div className="mt-6 space-y-3">
                  {keys.map((key) => {
                    const canEdit = key.source === "env";
                    return (
                    <div key={key.key} className="surface-plain rounded-[1.5rem] p-4">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-mono text-sm">{key.key}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {key.name} • {key.prefix || "not configured"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={key.status} />
                            {key.source ? (
                              <span className="text-sm text-muted-foreground">
                                via {key.source}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 md:flex-row">
                          <input
                            className="field-input"
                            type="password"
                            placeholder={
                              canEdit
                                ? editingKey === key.key
                                  ? "Enter new value"
                                  : "Hidden until edit"
                                : "CLI-authenticated key"
                            }
                            value={keyDrafts[key.key] || ""}
                            disabled={!canEdit}
                            onFocus={() => setEditingKey(key.key)}
                            onChange={(event) =>
                              setKeyDrafts((current) => ({
                                ...current,
                                [key.key]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            className="action-btn"
                            disabled={
                              !canEdit ||
                              !keyDrafts[key.key]?.trim() ||
                              busyMap[`key-${key.key}`]
                            }
                            onClick={() =>
                              runAction(
                                `key-${key.key}`,
                                () =>
                                  fetch("/api/keys", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "update",
                                      key: key.key,
                                      value: keyDrafts[key.key],
                                    }),
                                  }),
                                `${key.key} updated`,
                                "keys.update",
                                key.key,
                                {}
                              ).then(() =>
                                setKeyDrafts((current) => ({
                                  ...current,
                                  [key.key]: "",
                                }))
                              )
                            }
                          >
                            Save
                          </button>
                        </div>
                        {!canEdit ? (
                          <p className="text-sm text-muted-foreground">
                            This credential is managed by CLI authentication rather than the env file.
                          </p>
                        ) : null}
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div className="mt-6 surface-muted rounded-[1.5rem] p-4">
                  <p className="subtle-label">Outstanding issues</p>
                  <div className="mt-4 space-y-2">
                    {(data?.keys?.issues || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No API key issues detected.
                      </p>
                    ) : (
                      (data?.keys?.issues || []).map((issue) => (
                        <div key={`${issue.key}-${issue.message}`} className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{issue.key}</p>
                            <p className="text-sm text-muted-foreground">{issue.message}</p>
                          </div>
                          <StatusBadge status={issue.severity} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="history" className="section-shell">
          <div className="page-shell">
            <SectionHeader
              eyebrow="Audit + incidents"
              title="Operational history stays visible."
              body="Recent failures, rate-limit pressure, and dashboard actions are stacked together so you can trace cause and effect instead of scanning separate tools."
            />

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="surface-panel rounded-[2rem] p-6">
                <p className="subtle-label">Recent incidents</p>
                <div className="mt-6 space-y-3">
                  {recentIncidents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No failed stories are present in the recent history window.
                    </p>
                  ) : (
                    recentIncidents.slice(0, 8).map((incident) => (
                      <div key={incident.id} className="surface-plain rounded-[1.25rem] p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="font-mono text-sm">
                              {incident.topic || incident.id}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {incident.stage || "unknown stage"} •{" "}
                              {formatRelativeTime(incident.timestamp)}
                            </p>
                            {incident.error ? (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {incident.error}
                              </p>
                            ) : null}
                          </div>
                          <StatusBadge status="incident" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="surface-panel rounded-[2rem] p-6">
                <p className="subtle-label">Audit trail</p>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[42rem] border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        <th className="pb-2">When</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">Target</th>
                        <th className="pb-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.audit?.logs || []).slice(0, 14).map((entry) => (
                        <tr key={entry.id} className="surface-plain">
                          <td className="rounded-l-[1.25rem] px-4 py-4 text-sm text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-4 font-mono text-sm">{entry.action}</td>
                          <td className="px-4 py-4 text-sm">{entry.target}</td>
                          <td className="rounded-r-[1.25rem] px-4 py-4">
                            <StatusBadge status={entry.result} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
