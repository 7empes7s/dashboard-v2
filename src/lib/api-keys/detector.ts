import fs from "fs/promises";
import path from "path";

const LITELLM_ENV = "/etc/litellm/litellm.env";

export interface KeyStatus {
  key: string;
  name: string;
  provider: string;
  exists: boolean;
  prefix?: string;
  status: "ok" | "missing" | "exhausted" | "unknown";
  source?: "env" | "cli";
}

const KEY_MAPPING = [
  { env: "GROQ_API_KEY", name: "Groq", provider: "groq" },
  { env: "OPENROUTER_API_KEY", name: "OpenRouter", provider: "openrouter" },
  { env: "GITHUB_TOKEN", name: "GitHub Models", provider: "github" },
  { env: "OPENCODE_ZEN_KEY", name: "OpenCode Zen", provider: "zen" },
  { env: "ANTHROPIC_API_KEY", name: "Claude (Subscription)", provider: "anthropic", source: "cli" },
  { env: "OPENAI_API_KEY", name: "OpenAI", provider: "openai" },
  { env: "VAST_API_KEY", name: "Vast.ai", provider: "vast" },
  { env: "CODECLIENT_KEY", name: "Codex (Subscription)", provider: "codex", source: "cli" },
];

async function checkCliAuth(provider: string): Promise<boolean> {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    if (provider === "anthropic") {
      const { stdout } = await execAsync("claude auth status 2>&1 || echo 'NOT_AUTHENTICATED'", { timeout: 10000 });
      return !stdout.includes("NOT_AUTHENTICATED") && (stdout.includes("authenticated") || stdout.includes("Claude Code"));
    }
    if (provider === "codex") {
      const { stdout } = await execAsync("codex auth status 2>&1 || echo 'NOT_AUTHENTICATED'", { timeout: 10000 });
      return !stdout.includes("NOT_AUTHENTICATED");
    }
    return false;
  } catch {
    return false;
  }
}

async function detectKeys(): Promise<KeyStatus[]> {
  try {
    const content = await fs.readFile(LITELLM_ENV, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    const envMap = new Map<string, string>();
    
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        envMap.set(key, valueParts.join("=").trim());
      }
    }
    
    const results: KeyStatus[] = [];
    
    for (const mapping of KEY_MAPPING) {
      const { env, name, provider, source } = mapping;
      
      if (source === "cli") {
        const cliAuthenticated = await checkCliAuth(provider);
        results.push({
          key: env,
          name,
          provider,
          exists: cliAuthenticated,
          prefix: cliAuthenticated ? "via CLI" : undefined,
          status: cliAuthenticated ? "ok" : "missing",
          source: "cli",
        });
      } else {
        const value = envMap.get(env);
        const exists = !!value && value.length > 0;
        results.push({
          key: env,
          name,
          provider,
          exists,
          prefix: exists ? value?.slice(0, 8) + "..." : undefined,
          status: exists ? "ok" : "missing",
          source: "env",
        });
      }
    }
    
    return results;
  } catch {
    return KEY_MAPPING.map(({ env, name, provider }) => ({
      key: env,
      name,
      provider,
      exists: false,
      status: "missing" as const,
    }));
  }
}

async function getExhaustedKeys(): Promise<string[]> {
  try {
    const health = await fs.readFile("/var/lib/mimule/model-health.json", "utf-8");
    const parsed = JSON.parse(health);
    const exhausted: string[] = [];
    
    for (const model of parsed.models || []) {
      if (!model.available && (model as any).error?.includes("exhausted")) {
        exhausted.push(model.logicalName);
      }
    }
    
    return exhausted;
  } catch {
    return [];
  }
}

export { detectKeys, getExhaustedKeys };