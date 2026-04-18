import { NextResponse } from "next/server";
import { getOpenRouterUser, getGroqUsage, getGitHubUsage } from "@/lib/providers/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const [or, groq, gh] = await Promise.all([
    getOpenRouterUser().catch(() => null),
    getGroqUsage().catch(() => null),
    getGitHubUsage().catch(() => null),
  ]);
  
  const providers: Array<{
    id: string;
    used?: number;
    limit?: number;
    remaining?: number;
    status: "ok" | "degraded" | "rate_limited" | "error";
  }> = [];
  
  // OpenRouter
  if (or) {
    providers.push({
      id: "openrouter",
      used: or.credits_used,
      limit: or.credits_total,
      remaining: or.credits_total - or.credits_used,
      status: or.credits_used / or.credits_total > 0.9 ? "degraded" : "ok",
    });
  } else {
    providers.push({ id: "openrouter", status: "error" });
  }
  
  // Groq
  if (groq) {
    providers.push({
      id: "groq",
      used: groq.used,
      limit: groq.limit,
      remaining: groq.limit - groq.used,
      status: groq.used / groq.limit > 0.9 ? "degraded" : "ok",
    });
  } else {
    providers.push({ id: "groq", status: "error" });
  }
  
  // GitHub
  if (gh) {
    providers.push({
      id: "github",
      used: gh.used,
      limit: gh.limit,
      remaining: Math.max(0, gh.limit - gh.used),
      status: "ok",
    });
  } else if (gh === null) {
    providers.push({ id: "github", status: "error" });
  }
  
  return NextResponse.json({
    generatedAt: Date.now(),
    providers,
    overall: providers.some(p => p.status === "error") ? "degraded" : "ok",
  });
}