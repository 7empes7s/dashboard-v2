import { NextResponse } from "next/server";
import { getRecentRateLimitErrors } from "@/lib/rate-limits/tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  const incidents = await getRecentRateLimitErrors();
  
  const byTool = {
    claude: incidents.filter(i => i.provider === "anthropic").length,
    codex: incidents.filter(i => i.provider === "openai").length,
    groq: incidents.filter(i => i.provider === "groq").length,
    openrouter: incidents.filter(i => i.provider === "openrouter").length,
    github: incidents.filter(i => i.provider === "github").length,
  };
  
  return NextResponse.json({
    generatedAt: Date.now(),
    confidence: "derived",
    incidents,
    summary: {
      totalIncidents: incidents.reduce((sum, i) => sum + i.count, 0),
      byTool,
    },
  });
}