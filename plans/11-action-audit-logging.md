# Feature 11: Action Audit Logging

**File**: `11-action-audit-logging.md`
**Priority**: P1
**Month**: 3 (July 2026)

---

## Overview

Log all actions taken from dashboard for audit trail.

---

## Implementation

### 1. Audit Logger (`src/lib/audit/logger.ts`)

```typescript
import fs from "fs/promises";
import path from "path";

const AUDIT_LOG = "/var/lib/mimule/dashboard-audit.json";

interface AuditEntry {
  id: string;
  timestamp: number;
  action: string;
  user: string; // "operator" for now
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
    // Keep last 1000
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

export type { AuditEntry };
export { logAction, getAuditLog };
```

### 2. Audit Trail Page

Create `/app/audit/page.tsx` to display actions.

---

## Exit Criteria

- [ ] All actions logged with timestamp
- [ ] Viewable in audit page
- [ ] Persists across restarts