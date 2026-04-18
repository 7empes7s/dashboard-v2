import fs from "fs/promises";

const VAST_API_BASE = "https://console.vast.ai/api/v0";
const VAST_TOKEN_PATHS = [
  "/root/.config/vastai/vast_api_key",
  "/root/.vast_api_token",
];
const LITELLM_ENV_PATH = "/etc/litellm/litellm.env";

export interface VastInstance {
  id: number;
  instance_id: number;
  gpu_name: string;
  gpu_count: number;
  cpu_name?: string;
  cpu_cores: number;
  cpu_ram: number;
  disk_space: number;
  machine_type: string;
  num_gpus: number;
  public_ipaddr?: string;
  geolocation?: string;
  machine_id?: number;
  host_id?: number;
  ssh_host?: string;
  ssh_port?: number;
  duration?: number;
  cpu_util?: number;
  disk_usage?: number;
  gpu_util?: number;
  dph_total?: number;
  status: "running" | "stopped" | "created";
  num_bids: number;
  bid_id: number | null;
  rented: boolean;
  on_current_provider: boolean;
  created_at: string;
  runtime_hourly_cost: number;
  machine_uptime?: number;
}

export interface VastAccount {
  id: number;
  username?: string;
  email?: string;
  account_type?: string;
  balance?: number;
  credit?: number;
  total_credits?: number;
  usable_credits?: number;
  pending_charges?: number;
  total_spend?: number;
  autobill_amount?: number;
  autobill_threshold?: number;
  can_pay?: boolean;
  gpu_hours_bought?: number;
  gpu_hours_used?: number;
}

async function readEnvKey(keyName: string): Promise<string | null> {
  try {
    const content = await fs.readFile(LITELLM_ENV_PATH, "utf-8");
    const line = content
      .split("\n")
      .find((entry) => entry.startsWith(`${keyName}=`));

    if (!line) return null;
    const [, ...valueParts] = line.split("=");
    return valueParts.join("=").trim() || null;
  } catch {
    return null;
  }
}

async function getVastApiKey(): Promise<string | null> {
  if (process.env.VAST_API_KEY) return process.env.VAST_API_KEY;
  if (process.env.VAST_API_TOKEN) return process.env.VAST_API_TOKEN;

  for (const tokenPath of VAST_TOKEN_PATHS) {
    try {
      const key = await fs.readFile(tokenPath, "utf-8");
      if (key.trim()) return key.trim();
    } catch {
      continue;
    }
  }

  return (
    (await readEnvKey("VAST_API_KEY")) ||
    (await readEnvKey("VAST_API_TOKEN")) ||
    null
  );
}

async function getVastAccount(): Promise<VastAccount | null> {
  const apiKey = await getVastApiKey();
  if (!apiKey) return null;
  
  try {
    const res = await fetch(`${VAST_API_BASE}/users/current/`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getVastInstances(): Promise<VastInstance[]> {
  const apiKey = await getVastApiKey();
  if (!apiKey) return [];
  
  try {
    const res = await fetch(`${VAST_API_BASE}/instances/`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.instances || []).map((instance: VastInstance & Record<string, unknown>) => ({
      ...instance,
      status:
        String(
          instance.status ||
            instance.actual_status ||
            instance.cur_state ||
            instance.intended_status ||
            "unknown"
        ) as VastInstance["status"],
      instance_id: instance.instance_id || instance.id,
      gpu_count: instance.gpu_count || instance.num_gpus || 1,
      runtime_hourly_cost:
        instance.runtime_hourly_cost ||
        instance.dph_total ||
        Number(
          (instance.instance as { totalHour?: number } | undefined)?.totalHour || 0
        ),
    }));
  } catch { return []; }
}

export { getVastAccount, getVastInstances, getVastApiKey };
