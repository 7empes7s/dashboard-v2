import fs from "fs/promises";

const AUDIT_LOG = "/var/lib/mimule/dashboard-audit.json";

export interface AuditEntry {
  id: string;
  timestamp: number;
  action: string;
  user: string;
  target: string;
  details: Record<string, any>;
  result: "success" | "failure";
}

async function logAction(entry: Omit<AuditEntry, "id" | "timestamp">): Promise<void> {
  const auditEntry: AuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  
  try {
    const existing = await fs.readFile(AUDIT_LOG, "utf-8").catch(() => "[]");
    const logs: AuditEntry[] = JSON.parse(existing);
    logs.push(auditEntry);
    const trimmed = logs.slice(-1000);
    await fs.writeFile(AUDIT_LOG, JSON.stringify(trimmed, null, 2));
  } catch {
    // Silently fail
  }
}

async function getAuditLog(limit = 100): Promise<AuditEntry[]> {
  try {
    const content = await fs.readFile(AUDIT_LOG, "utf-8");
    const logs: AuditEntry[] = JSON.parse(content);
    return logs.slice(-limit).reverse();
  } catch {
    return [];
  }
}

export { logAction, getAuditLog };