import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const CRITICAL_SERVICES = [
  "newsbites.service",
  "litellm.service",
  "newsbites-autopipeline.service",
  "dashboard-v2.service",
  "vast-tunnel.service",
  "cloudflared.service",
];

async function restartService(name: string): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync(`systemctl restart ${name}`);
    return { success: true, message: `Restarted ${name}` };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

async function getStatus(name: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`systemctl is-active ${name}`);
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

export { restartService, getStatus };