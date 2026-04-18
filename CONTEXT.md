# Dashboard V2 - Project Context

## Objective
Build Dashboard V2 - an ops control room for MIMULE/TechInsiderBytes stack, published to dashboard.techinsiderbytes.com

## Stack Context
- **VPS**: Hetzner CX32, Ubuntu 24.04
- **Existing apps**: NewsBites (:3001), Paperclip (:3100), Control Surface (:3000)
- **LiteLLM**: :4000 with local GPU via Vast.ai
- **Autopipeline**: :3200
- **Model routing**: editorial-heavy → gemma4:26b, editorial-fast, routing-cheap (local GPU)

## This Project
- **Name**: Dashboard V2
- **Port**: 3004 (free)
- **URL**: dashboard.techinsiderbytes.com (via Cloudflare)
- **Style**: Linear-style from `/opt/DESIGN.md` (light + dark modes)
- **Plan**: `/opt/plans/v2-P-dashboard-control-room.md`

## Build Phases
1. Command Center (status overview)
2. Infrastructure (services, CPU/memory/disk)
3. Pipeline (editorial operations)
4. Models/Providers/Limits
5. Paperclip/Channels/Sessions
6. History/Incidents/Polish

## References
- Existing control surface: `/opt/opencode-control-surface`
- Old ops dashboard: `/opt/mimoun/projects/baba-mimoun-ops-dashboard`
- Model health: `/var/lib/mimule/model-health.json`
- Pipeline state: `/var/lib/mimule/pipeline-state.json`
- GPU health: `/var/lib/mimule/gpu-health.json`

## External
- Linear-style guide: `/opt/DESIGN.md`
- Impeccable UI lib: https://github.com/pbakaus/impeccable (for future)