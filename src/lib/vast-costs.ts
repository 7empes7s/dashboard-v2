import { getVastAccount, getVastInstances, VastInstance } from "./vast-api";

export interface CostSnapshot {
  timestamp: number;
  balance: number;
  usableCredits: number;
  hourlyBurn: number;
  runtimeHours: number;
  instanceCosts: { [instanceId: string]: number };
}

async function getCostSnapshot(): Promise<CostSnapshot | null> {
  const [account, instances] = await Promise.all([
    getVastAccount(),
    getVastInstances()
  ]);
  
  if (!account) return null;
  
  const runningInstances = instances.filter((i: VastInstance) => i.status === "running");
  const hourlyBurn = runningInstances.reduce((sum, inst) => 
    sum + (inst.runtime_hourly_cost || inst.dph_total || 0), 0);

  const accountCredits =
    account.credit ??
    account.usable_credits ??
    account.balance ??
    0;

  const runtimeHours =
    account.gpu_hours_used ??
    runningInstances.reduce((sum, inst) => sum + ((inst.duration || 0) / 3600), 0);
  
  return {
    timestamp: Date.now(),
    balance: account.balance ?? accountCredits,
    usableCredits: accountCredits,
    hourlyBurn,
    runtimeHours,
    instanceCosts: Object.fromEntries(
      runningInstances.map(i => [i.instance_id || i.id, i.runtime_hourly_cost || i.dph_total || 0])
    )
  };
}

function calculateRunway(balance: number, hourlyRate: number): number {
  if (hourlyRate <= 0) return Infinity;
  return Math.floor((balance / hourlyRate) * 100) / 100;
}

export { getCostSnapshot, calculateRunway };
