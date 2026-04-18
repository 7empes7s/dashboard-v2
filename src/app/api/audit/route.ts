import { NextResponse } from "next/server";
import { getAuditLog, logAction } from "@/lib/audit/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs = await getAuditLog(100);
  return NextResponse.json({
    generatedAt: Date.now(),
    logs,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, user, target, details, result } = body;
  
  await logAction({
    action,
    user: user || "operator",
    target,
    details: details || {},
    result: result || "success",
  });
  
  return NextResponse.json({ success: true });
}