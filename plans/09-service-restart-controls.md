# Feature 09: Service Restart Controls

**File**: `09-service-restart-controls.md`
**Priority**: P1
**Month**: 4 (August 2026)

---

## Overview

Add ability to restart services from dashboard.

---

## Implementation

### 1. Service Controls (`src/lib/actions/services.ts`)

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const CRITICAL_SERVICES = [
  "newsbites.service",
  "litellm.service",
  "newsbites-autopipeline.service",
  "dashboard-v2.service",
  "vast-tunnel.service",
  "cloudflared.service",
];

async function restartService(name: string): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync(`systemctl restart ${name}`);
    return { success: true, message: `Restarted ${name}` };
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

function getStatus(name: string): Promise<string> {
  return execAsync(`systemctl is-active ${name}`).then(r => r.stdout.trim()).catch(() => "unknown");
}

export { restartService, getStatus, CRITICAL_SERVICES };
```

### 2. Service Controls API + UI

Similar pattern to Feature 07. Add to `/app/infrastructure/page.tsx`.

---

## Exit Criteria

- [ ] Restart button per service
- [ ] Confirmation dialog
- [ ] Status refresh after restart