import { NextResponse } from "next/server";
import { getVastAccount, getVastInstances } from "@/lib/vast-api";
import { getCostSnapshot, calculateRunway } from "@/lib/vast-costs";
import { getRemoteTelemetry } from "@/lib/vast-ssh";

export const dynamic = "force-dynamic";

export async function GET() {
  const [account, instances, costs, remote] = await Promise.all([
    getVastAccount(),
    getVastInstances(),
    getCostSnapshot(),
    getRemoteTelemetry(),
  ]);
  
  const running = instances.filter((i: any) => i.status === "running");
  const runway = costs?.hourlyBurn 
    ? calculateRunway(costs?.usableCredits || costs?.balance || 0, costs?.hourlyBurn || 0)
    : null;
  
  return NextResponse.json({
    generatedAt: Date.now(),
    sourceStatus: account ? "direct" : "inferred",
    account: account ? {
      id: account.id,
      username: account.username || account.email || null,
      balance: account.balance ?? 0,
      credit: account.credit ?? account.usable_credits ?? account.balance ?? 0,
      usableCredits: account.usable_credits ?? account.credit ?? account.balance ?? 0,
      pendingCharges: account.pending_charges ?? 0,
      totalSpend: account.total_spend ?? 0,
      autobillAmount: account.autobill_amount ?? 0,
      autobillThreshold: account.autobill_threshold ?? 0,
      canPay: account.can_pay ?? false,
    } : null,
    costs: costs ? {
      hourlyBurn: costs.hourlyBurn,
      runtimeHours: costs.runtimeHours,
      runwayHours: runway,
    } : null,
    instances: running.map((inst: any) => ({
      id: inst.instance_id || inst.id,
      gpuName: inst.gpu_name,
      gpuCount: inst.gpu_count,
      cpuName: inst.cpu_name,
      cpuCores: inst.cpu_cores,
      cpuRamMb: inst.cpu_ram,
      diskSpaceGb: inst.disk_space,
      publicIp: inst.public_ipaddr,
      location: inst.geolocation,
      sshHost: inst.ssh_host,
      sshPort: inst.ssh_port,
      machineId: inst.machine_id,
      hostId: inst.host_id,
      durationHours: typeof inst.duration === "number" ? inst.duration / 3600 : null,
      hourlyCost: inst.runtime_hourly_cost || inst.dph_total || 0,
      status: inst.status,
      createdAt: inst.created_at,
    })),
    remote: remote ? {
      hostname: remote.hostname,
      cpuPercent: remote.cpu_percent,
      memoryUsedGb: remote.memory_used_gb,
      memoryTotalGb: remote.memory_total_gb,
      diskUsedGb: remote.disk_used_gb,
      diskTotalGb: remote.disk_total_gb,
      gpuUtilization: remote.gpu_utilization,
      gpuMemoryUsedMb: remote.gpu_memory_used_mb,
      gpuMemoryTotalMb: remote.gpu_memory_total_mb,
      gpuTemperature: remote.gpu_temp_c,
      updatedAt: remote.timestamp,
    } : null,
  });
}
