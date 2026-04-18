import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function runCommand(
  cmd: string,
  timeout = 5000
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(cmd, { timeout });
    return stdout.trim();
  } catch {
    return null;
  }
}

export type UnitInfo = {
  activeState: string;
  subState: string;
  result: string;
};

export async function getUnitInfo(name: string): Promise<UnitInfo> {
  const raw = await runCommand(
    `systemctl show ${name} --property=ActiveState --property=SubState --property=Result --no-pager 2>/dev/null`
  );

  const info: UnitInfo = {
    activeState: "unknown",
    subState: "unknown",
    result: "unknown",
  };

  for (const line of raw?.split("\n") || []) {
    const [key, ...rest] = line.split("=");
    const value = rest.join("=").trim();
    if (key === "ActiveState") info.activeState = value || "unknown";
    if (key === "SubState") info.subState = value || "unknown";
    if (key === "Result") info.result = value || "unknown";
  }

  return info;
}

function parseCpuLoad(loadAvg: string | null) {
  const [load1 = "0", load5 = "0", load15 = "0"] = (loadAvg || "0 0 0")
    .split(/\s+/)
    .slice(0, 3);

  return {
    load1: Number.parseFloat(load1) || 0,
    load5: Number.parseFloat(load5) || 0,
    load15: Number.parseFloat(load15) || 0,
  };
}

function parseMemory(memory: string | null) {
  const [used = "0", total = "0"] = (memory || "0 0").split(/\s+/);
  const usedMb = Number.parseInt(used, 10) || 0;
  const totalMb = Number.parseInt(total, 10) || 0;
  return {
    usedMb,
    totalMb,
    percent: totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0,
  };
}

function parseDisk(disk: string | null) {
  const [used = "0", total = "0", percent = "0"] = (disk || "0 0 0").split(
    /\s+/
  );
  const usedGb = Number.parseInt(used, 10) || 0;
  const totalGb = Number.parseInt(total, 10) || 0;
  const percentValue = Number.parseInt(percent, 10);
  return {
    usedGb,
    totalGb,
    percent:
      Number.isFinite(percentValue) && !Number.isNaN(percentValue)
        ? percentValue
        : totalGb > 0
          ? Math.round((usedGb / totalGb) * 100)
          : 0,
  };
}

export interface ServiceStatus {
  name: string;
  status: "active" | "inactive";
  activeState: string;
  subState: string;
  result: string;
}

export interface MachineSnapshot {
  id: string;
  label: string;
  kind: "local" | "remote";
  provider: "hetzner" | "vast";
  hostname: string | null;
  location?: string | null;
  kernel: string | null;
  uptime: string | null;
  cpu: {
    model: string | null;
    cores: number;
    usagePercent: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    usedMb: number;
    totalMb: number;
    percent: number;
  };
  disk: {
    usedGb: number;
    totalGb: number;
    percent: number;
  };
  updatedAt: string;
}

export async function getLocalMachineSnapshot(): Promise<MachineSnapshot> {
  const [
    hostname,
    kernel,
    uptime,
    loadAvg,
    cpuUsage,
    cpuModel,
    cpuCores,
    memoryRaw,
    diskRaw,
  ] = await Promise.all([
    runCommand("hostname"),
    runCommand("uname -r"),
    runCommand("uptime -p 2>/dev/null || uptime | sed 's/.*up/up/'"),
    runCommand("cat /proc/loadavg"),
    runCommand(
      "top -bn1 | awk -F'[, ]+' '/Cpu\\(s\\)/ {for (i = 1; i <= NF; i++) if ($i == \"id\") {print 100 - $(i-1); exit}}'"
    ),
    runCommand("lscpu | awk -F: '/Model name/ {gsub(/^ +/, \"\", $2); print $2; exit}'"),
    runCommand("nproc"),
    runCommand("free -m | awk '/Mem:/ {print $3\" \"$2}'"),
    runCommand("df -BG / | awk 'NR==2 {gsub(\"G\", \"\", $3); gsub(\"G\", \"\", $2); gsub(\"%\", \"\", $5); print $3\" \"$2\" \"$5}'"),
  ]);

  return {
    id: "local-host",
    label: "Hetzner Host",
    kind: "local",
    provider: "hetzner",
    hostname,
    kernel,
    uptime,
    cpu: {
      model: cpuModel,
      cores: Number.parseInt(cpuCores || "0", 10) || 0,
      usagePercent: Math.max(
        0,
        Math.round(Number.parseFloat(cpuUsage || "0") || 0)
      ),
      ...parseCpuLoad(loadAvg),
    },
    memory: parseMemory(memoryRaw),
    disk: parseDisk(diskRaw),
    updatedAt: new Date().toISOString(),
  };
}

export async function getServiceStatuses(
  serviceNames: string[]
): Promise<ServiceStatus[]> {
  return Promise.all(
    serviceNames.map(async (name) => {
      const info = await getUnitInfo(name);

      let status: "active" | "inactive" =
        info.activeState === "active" ? "active" : "inactive";

      if (
        name === "model-health-check.service" &&
        info.result === "success" &&
        info.activeState === "inactive"
      ) {
        const timer = await getUnitInfo("model-health-check.timer");
        if (timer.activeState === "active") {
          status = "active";
        }
      }

      return {
        name,
        status,
        activeState: info.activeState,
        subState: info.subState,
        result: info.result,
      };
    })
  );
}
