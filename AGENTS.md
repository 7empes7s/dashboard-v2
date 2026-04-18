# Dashboard V2 - Agent Instructions

## Project Context

**Location**: `/opt/dashboard-v2/`
**Port**: 3004
**URL**: https://dashboard.techinsiderbytes.com
**Style**: Linear dark mode (`/opt/DESIGN.md`)
**Skill**: `/root/.claude/skills/dashboard-v2/SKILL.md`

## Quick Reference

- **Progress log**: `/opt/dashboard-v2/PROGRESS_LOG.md`
- **Pipeline API**: `curl http://127.0.0.1:3200/queue`
- **Services**: `systemctl list-units --type=service --state=running`

## Development Commands

```bash
# Build
cd /opt/dashboard-v2 && npm run build

# Restart service
systemctl restart dashboard-v2.service

# Check logs
journalctl -u dashboard-v2.service -n 20
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Command Center |
| `/infrastructure` | CPU, memory, services |
| `/pipeline` | Editorial queue |
| `/models` | Model health |
| `/agents` | Paperclip status |
| `/history` | Incidents |

## State Files

- Pipeline: `/var/lib/mimule/pipeline-state.json`
- GPU: `/var/lib/mimule/gpu-health.json`
- Model: `/var/lib/mimule/model-health.json`

## Development Rules

1. Always build before declaring done: `npm run build`
2. Follow Linear-style from `/opt/DESIGN.md`
3. Log progress to `/opt/dashboard-v2/PROGRESS_LOG.md`
4. Restart service after changes