import { NextResponse } from "next/server";
import { injectStory } from "@/lib/actions/inject";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const { topic, vertical, priority } = body;
  
  if (!topic || !vertical) {
    return NextResponse.json(
      { success: false, error: "topic and vertical required" },
      { status: 400 }
    );
  }
  
  const result = await injectStory({ topic, vertical, priority });
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({
    verticals: [
      "ai", "finance", "global-politics", "trends", "science",
      "wellness", "culture", "sports", "crypto", "energy", "climate"
    ],
  });
}