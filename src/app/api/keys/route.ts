import { NextResponse } from "next/server";
import { detectKeys, getExhaustedKeys } from "@/lib/api-keys/detector";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

const ENV_FILE = "/etc/litellm/litellm.env";
const EDITABLE_KEYS = new Set([
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "GITHUB_TOKEN",
  "OPENCODE_ZEN_KEY",
  "OPENAI_API_KEY",
  "VAST_API_KEY",
]);

export async function GET() {
  const [keys, exhausted] = await Promise.all([
    detectKeys(),
    getExhaustedKeys(),
  ]);
  
  const withExhausted = keys.map(k => ({
    ...k,
    status: exhausted.includes(k.name.toLowerCase()) ? "exhausted" : k.status,
  }));
  
  const missing = withExhausted.filter(k => k.status === "missing");
  const exhaustedList = withExhausted.filter(k => k.status === "exhausted");
  
  return NextResponse.json({
    generatedAt: Date.now(),
    keys: withExhausted,
    summary: {
      total: withExhausted.length,
      ok: withExhausted.filter(k => k.status === "ok").length,
      missing: missing.length,
      exhausted: exhaustedList.length,
    },
    issues: [
      ...missing.map(k => ({ severity: "critical", key: k.name, message: "Missing API key" })),
      ...exhaustedList.map(k => ({ severity: "warning", key: k.name, message: "API key exhausted" })),
    ],
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, key, value } = body as {
    action?: string;
    key?: string;
    value?: string;
  };

  if (action !== "update") {
    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  }

  if (!key || !EDITABLE_KEYS.has(key)) {
    return NextResponse.json(
      { success: false, error: "Unsupported key" },
      { status: 400 }
    );
  }

  if (!value || typeof value !== "string" || value.includes("\n")) {
    return NextResponse.json(
      { success: false, error: "A single-line value is required" },
      { status: 400 }
    );
  }

  const content = await fs.readFile(ENV_FILE, "utf-8");
  const lines = content.split("\n");
  let replaced = false;

  const nextLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!replaced) {
    nextLines.push(`${key}=${value}`);
  }

  await fs.writeFile(ENV_FILE, nextLines.join("\n"));

  return NextResponse.json({
    success: true,
    key,
    replaced,
    prefix: `${value.slice(0, 8)}...`,
  });
}
