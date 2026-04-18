import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const VAST_SSH_HOST = "root@70.69.192.6";
const VAST_SSH_PORT = 27503;
const VAST_SSH_KEY = "/root/.ssh/vast_gpu";

export interface RemoteTelemetry {
  hostname: string;
  cpu_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  disk_used_gb: number;
  disk_total_gb: number;
  gpu_utilization: number[];
  gpu_memory_used_mb: number[];
  gpu_memory_total_mb: number[];
  gpu_temp_c: number[];
  timestamp: number;
}

async function sshExec(cmd: string): Promise<string> {
  const escaped = cmd.replace(/'/g, `'\\''`);
  const fullCmd = `ssh -i ${VAST_SSH_KEY} -o StrictHostKeyChecking=no -p ${VAST_SSH_PORT} ${VAST_SSH_HOST} '${escaped}'`;
  try {
    const { stdout } = await execAsync(fullCmd, { timeout: 15000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function getRemoteTelemetry(): Promise<RemoteTelemetry | null> {
  try {
    const output = await sshExec(`
      HOSTNAME=$(hostname)
      CPU=$(top -bn1 | awk -F'[, ]+' '/Cpu\\(s\\)/ {for (i = 1; i <= NF; i++) if ($i == "id") {print 100 - $(i-1); exit}}')
      MEM=$(free -g | awk '/Mem:/ {print $3"/"$2}')
      DISK=$(df -BG / | awk 'NR==2 {gsub("G", "", $3); gsub("G", "", $2); print $3"/"$2}')
      GPU=$(nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits | tr "\\n" ";" | sed 's/;$//')
      echo "HOSTNAME:$HOSTNAME"
      echo "CPU:$CPU"
      echo "MEM:$MEM"
      echo "DISK:$DISK"
      echo "GPU:$GPU"
    `);

    const lines = output.split("\n").filter(Boolean);
    const parse = (key: string) =>
      lines.find((line) => line.startsWith(`${key}:`))?.slice(key.length + 1) ||
      "";

    const [memoryUsed = "0", memoryTotal = "0"] = parse("MEM").split("/");
    const [diskUsed = "0", diskTotal = "0"] = parse("DISK").split("/");

    const gpuRows = parse("GPU")
      .split(";")
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split(",").map((value) => value.trim()));

    return {
      hostname: parse("HOSTNAME") || "vast-gpu",
      cpu_percent: Math.round(Number.parseFloat(parse("CPU")) || 0),
      memory_used_gb: Number.parseInt(memoryUsed, 10) || 0,
      memory_total_gb: Number.parseInt(memoryTotal, 10) || 0,
      disk_used_gb: Number.parseInt(diskUsed, 10) || 0,
      disk_total_gb: Number.parseInt(diskTotal, 10) || 0,
      gpu_utilization: gpuRows.map((row) => Number.parseInt(row[1] || "0", 10) || 0),
      gpu_memory_used_mb: gpuRows.map((row) => Number.parseInt(row[2] || "0", 10) || 0),
      gpu_memory_total_mb: gpuRows.map((row) => Number.parseInt(row[3] || "0", 10) || 0),
      gpu_temp_c: gpuRows.map((row) => Number.parseInt(row[4] || "0", 10) || 0),
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}
