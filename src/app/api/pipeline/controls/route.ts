import { NextResponse } from "next/server";
import { pausePipeline, resumePipeline, killStory, retryStory } from "@/lib/actions/pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const { action, storyId } = body;
  
  let result: { success: boolean; message: string };
  
  switch (action) {
    case "pause":
      result = await pausePipeline();
      break;
    case "resume":
      result = await resumePipeline();
      break;
    case "kill":
      if (!storyId) {
        return NextResponse.json({ success: false, error: "storyId required" }, { status: 400 });
      }
      result = await killStory(storyId);
      break;
    case "retry":
      if (!storyId) {
        return NextResponse.json({ success: false, error: "storyId required" }, { status: 400 });
      }
      result = await retryStory(storyId);
      break;
    default:
      return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }
  
  return NextResponse.json(result);
}