import fs from "fs/promises";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const GITHUB_BASE = "https://models.inference.ai.azure.com";

async function getEnvKey(keyName: string): Promise<string | null> {
  try {
    const content = await fs.readFile("/etc/litellm/litellm.env", "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const [key, ...valueParts] = line.split("=");
      if (key === keyName && valueParts.length > 0) {
        return valueParts.join("=").trim();
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface OpenRouterUser {
  id: string;
  email: string;
  credits_total: number;
  credits_used: number;
  limit_type: string;
}

export interface GroqUsage {
  used: number;
  limit: number;
  total: number;
}

export interface GitHubUsage {
  used: number;
  limit: number;
}

export async function getOpenRouterUser(): Promise<OpenRouterUser | null> {
  const apiKey = await getEnvKey("OPENROUTER_API_KEY");
  if (!apiKey) return null;
  
  try {
    const res = await fetch(`${OPENROUTER_BASE}/user/info`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getGroqUsage(): Promise<GroqUsage | null> {
  const apiKey = await getEnvKey("GROQ_API_KEY");
  if (!apiKey) return null;
  
  try {
    const res = await fetch(`${GROQ_BASE}/usage`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function getGitHubUsage(): Promise<GitHubUsage | null> {
  const apiKey = await getEnvKey("GITHUB_TOKEN");
  if (!apiKey) return null;
  
  try {
    const res = await fetch(`${GITHUB_BASE}/token_usage`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}