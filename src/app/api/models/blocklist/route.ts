import { NextResponse } from "next/server";
import fs from "fs/promises";

const POLICY_PATH = "/etc/mimule/model-policy.json";

async function readPolicy() {
  try {
    const content = await fs.readFile(POLICY_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return { blocked: [], whitelisted: [], notes: {} };
  }
}

async function writePolicy(policy: any) {
  await fs.writeFile(POLICY_PATH, JSON.stringify(policy, null, 2));
}

export const dynamic = "force-dynamic";

export async function GET() {
  const policy = await readPolicy();
  return NextResponse.json(policy);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { model, action, note } = body;
  
  const policy = await readPolicy();
  
  if (action === "block") {
    if (!policy.blocked.includes(model)) {
      policy.blocked.push(model);
    }
    if (note) policy.notes[model] = note;
  } else if (action === "unblock") {
    policy.blocked = policy.blocked.filter((m: string) => m !== model);
    delete policy.notes[model];
  }
  
  await writePolicy(policy);
  return NextResponse.json({ success: true, policy: { blocked: policy.blocked.length } });
}