import { NextResponse } from "next/server";
import { getVastInstances } from "@/lib/vast-api";
import { getRemoteTelemetry } from "@/lib/vast-ssh";
import {
  getLocalMachineSnapshot,
  getServiceStatuses,
  runCommand,
} from "@/lib/system";

const ALL_SERVICES = [
  "newsbites.service",
  "control-surface.service",
  "dashboard-v2.service",
  "newsbites-autopipeline.service",
  "litellm.service",
  "opencode-server.service",
  "vast-tunnel.service",
  "model-health-check.service",
];

export async function GET() {
  const [localMachine, serviceStatuses, rawServices, instances, remoteTelemetry] =
    await Promise.all([
      getLocalMachineSnapshot(),
      getServiceStatuses(ALL_SERVICES),
      runCommand(
        "systemctl list-units --type=service --state=running --no-pager --no-legend | awk '{print $1}' | head -20"
      ),
      getVastInstances(),
      getRemoteTelemetry(),
    ]);

  const runningInstance =
    instances.find((instance) => instance.status === "running") || null;

  const remoteMachine =
    remoteTelemetry && runningInstance
      ? {
          id: "vast-gpu",
          label: "Vast GPU Host",
          kind: "remote" as const,
          provider: "vast" as const,
          hostname: remoteTelemetry.hostname,
          location: runningInstance.geolocation || null,
          kernel: null,
          uptime:
            typeof runningInstance.duration === "number"
              ? `${Math.round(runningInstance.duration / 3600)}h active`
              : null,
          cpu: {
            model: runningInstance.cpu_name || null,
            cores: runningInstance.cpu_cores || 0,
            usagePercent: remoteTelemetry.cpu_percent,
            load1: 0,
            load5: 0,
            load15: 0,
          },
          memory: {
            usedMb: remoteTelemetry.memory_used_gb * 1024,
            totalMb: remoteTelemetry.memory_total_gb * 1024,
            percent:
              remoteTelemetry.memory_total_gb > 0
                ? Math.round(
                    (remoteTelemetry.memory_used_gb /
                      remoteTelemetry.memory_total_gb) *
                      100
                  )
                : 0,
          },
          disk: {
            usedGb: remoteTelemetry.disk_used_gb,
            totalGb: remoteTelemetry.disk_total_gb,
            percent:
              remoteTelemetry.disk_total_gb > 0
                ? Math.round(
                    (remoteTelemetry.disk_used_gb /
                      remoteTelemetry.disk_total_gb) *
                      100
                  )
                : 0,
          },
          gpu: {
            name: runningInstance.gpu_name,
            count: runningInstance.gpu_count || runningInstance.num_gpus || 1,
            utilization: remoteTelemetry.gpu_utilization,
            memoryUsedMb: remoteTelemetry.gpu_memory_used_mb,
            memoryTotalMb: remoteTelemetry.gpu_memory_total_mb,
            temperatureC: remoteTelemetry.gpu_temp_c,
          },
          network: {
            publicIp: runningInstance.public_ipaddr || null,
            sshHost: runningInstance.ssh_host || null,
            sshPort: runningInstance.ssh_port || null,
          },
          billing: {
            hourlyCost:
              runningInstance.runtime_hourly_cost ||
              runningInstance.dph_total ||
              0,
          },
          updatedAt: new Date(remoteTelemetry.timestamp).toISOString(),
        }
      : null;

  return NextResponse.json({
    cpu: String(localMachine.cpu.load1.toFixed(2)),
    memory: `${localMachine.memory.usedMb} / ${localMachine.memory.totalMb}`,
    disk:
      localMachine.disk.totalGb > 0
        ? `${localMachine.disk.usedGb} / ${localMachine.disk.totalGb} (${localMachine.disk.percent}%)`
        : null,
    uptime: localMachine.uptime,
    services: serviceStatuses,
    rawServices: rawServices?.split("\n").filter(Boolean) || [],
    machines: {
      local: localMachine,
      remote: remoteMachine,
    },
    summary: {
      activeServices: serviceStatuses.filter((service) => service.status === "active")
        .length,
      degradedServices: serviceStatuses.filter(
        (service) => service.status !== "active"
      ).length,
      machineCount: remoteMachine ? 2 : 1,
    },
    timestamp: new Date().toISOString(),
  });
}
