import { NextResponse } from "next/server";
import { restartService, getStatus, CRITICAL_SERVICES } from "@/lib/actions/services";

export const dynamic = "force-dynamic";

export async function GET() {
  const statuses = await Promise.all(
    CRITICAL_SERVICES.map(async (name) => ({
      name,
      status: await getStatus(name),
    }))
  );
  
  return NextResponse.json({
    generatedAt: Date.now(),
    services: statuses,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { service, action } = body;
  
  if (!service) {
    return NextResponse.json({ success: false, error: "service required" }, { status: 400 });
  }
  
  if (action === "restart") {
    const result = await restartService(service);
    return NextResponse.json(result);
  }
  
  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}