# Dashboard V2 Ultra Plan - Iron Man Control Room

**Plan Version**: 2.0 (Iron Man)
**Created**: 2026-04-18
**Plan Location**: `/opt/dashboard-v2/plans/`
**Current Status**: v1 deployed, v2 planning

---

## Purpose

Transform Dashboard V2 from basic visibility (v1) into the Iron Man control room — a single operations surface that gives complete, actionable insight into the entire MIMULE / TechInsiderBytes stack.

---

## The Vision

**Before (v1)**: Read-only snapshots of pipeline, GPU, model health
**After (v2 Iron Man)**: Full operations control with real-time integrations, actionable insights, and one-click interventions

---

## Feature Files

| # | File | Scope | Priority |
|---|------|-------|----------|
| 01 | `01-vast-ai-integration.md` | GPU costs, credits, instance details | P0 |
| 02 | `02-model-bridge-layer.md` | Unified data layer architecture | P0 |
| 03 | `03-provider-integrations.md` | OpenRouter, Groq, GitHub quotas | P0 |
| 04 | `04-rate-limit-tracking.md` | Claude/Codex session quotas | P1 |
| 05 | `05-cost-tracking.md` | Cost tracking, burn estimates | P0 |
| 06 | `06-story-injection-controls.md` | Manual story injection | P0 |
| 07 | `07-pipeline-controls.md` | Pause, resume, kill, retry | P0 |
| 08 | `08-model-blocklist-management.md` | Block/unblock models | P1 |
| 09 | `09-service-restart-controls.md` | Service restart controls | P1 |
| 10 | `10-api-key-status.md` | Missing key detection | P0 |
| 11 | `11-action-audit-logging.md` | Audit trail for all actions | P1 |
| 12 | `12-ui-polish.md` | Garage Wall polish | P2 |

---

## Execution Timeline

### Month 1 (May 2026): Foundation Layer
- Feature 01: Vast.ai integration (full)
- Feature 02: Model bridge layer
- Feature 10: API key status dashboard

### Month 2 (June 2026): Provider Visibility
- Feature 03: Provider integrations
- Feature 05: Cost tracking
- Feature 04: Rate limit tracking

### Month 3 (July 2026): Action Layer
- Feature 06: Story injection
- Feature 07: Pipeline controls
- Feature 11: Audit logging

### Month 4 (August 2026): Management
- Feature 08: Model blocklist management
- Feature 09: Service restart controls
- Feature 12: UI polish initial

### Month 5-6 (Sept-Oct 2026): Polish & Ship
- Full integration testing
- UI refinements
- Beta testing

---

## Dependencies

### External APIs Required
- Vast.ai API token (existing: already configured)
- OpenRouter API (existing: in `/etc/litellm/litellm.env`)
- Groq API (existing)
- GitHub token (existing: for Azure AI inference)
- OpenCode Zen (existing)

### Local Data Sources
- `/var/lib/mimule/pipeline-state.json`
- `/var/lib/mimule/gpu-health.json`
- `/var/lib/mimule/model-health.json`
- `/etc/litellm/config.yaml`
- `/etc/litellm/litellm.env`
- `/opt/newsbites/content/articles/`

---

## Success Criteria

Dashboard V2 Iron Man succeeds when:
1. Stack health visible in <10 seconds
2. Any model/provider failure diagnosed from UI
3. Stories injectable without shell
4. Pipeline controllable without ssh
5. Vast costs visible and tracking
6. API key issues surfaced immediately

---

## Design Direction

**Style**: Linear-style (current) with "Garage Wall" enhancements
- Dark mode default
- Glowing accent colors for status
- Dense, command-center feel
- Real-time updates via polling (10s) or SSE

---

## Reference

- Plan: `/opt/plans/v2-P-dashboard-control-room.md`
- Style: `/opt/DESIGN.md`
- Current v1: `/opt/dashboard-v2/` (deployed)
- Service: `dashboard-v2.service`