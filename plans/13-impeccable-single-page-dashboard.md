## Dashboard V2 Refresh Plan

Date: 2026-04-18

### Goals

- Replace the current multi-page-first experience with a single scrollable command center.
- Rework the visual language toward the `impeccable.style` feel: sharper hierarchy, stronger atmosphere, fewer generic cards, more motion, more intentional composition.
- Make the dashboard genuinely mobile-friendly instead of desktop-shrunk.
- Surface controls beside the data they affect so the UI is operational, not read-only.
- Add the missing Vast account, usage, credit, burn, and remote machine metrics.
- Present both machines clearly: local Hetzner host and remote Vast GPU host.

### Constraints And Direction

- Keep dark mode as the default theme, but add a first-class light/dark toggle.
- Preserve the dashboard's operational tone: dense, crisp, technical, fast to scan.
- Avoid the current sidebar-heavy navigation; replace it with sticky jump navigation tied to page sections.
- Do not remove existing routes yet. The new `/` page becomes the primary experience.

### Backend Work

1. Create a consolidated control-room data layer for the home page.
2. Fix Vast account retrieval:
   - read the configured key from `/etc/litellm/litellm.env` (`VAST_API_KEY`) and `/root/.config/vastai/vast_api_key`
   - use the working Vast endpoints (`/users/current/`, `/instances/`)
3. Fix remote Vast telemetry:
   - use the deployed SSH key at `/root/.ssh/vast_gpu`
   - improve command parsing so CPU, RAM, disk, GPU util, VRAM, and temperature populate reliably
4. Expand infrastructure data so both machines are represented in one payload:
   - local host metrics
   - remote Vast host metrics
   - service status
5. Keep the existing action endpoints and wire them into the new UI:
   - service restart
   - pipeline pause/resume
   - story kill/retry
   - story injection
   - model block/unblock

### Frontend Work

1. Replace the current shell layout with a cleaner full-width canvas.
2. Build a single-page command center with anchored sections:
   - overview
   - machines
   - pipeline
   - models
   - providers and keys
   - audit and incidents
3. Add a sticky jump bar and responsive mobile navigation behavior.
4. Add theme persistence and light/dark toggle.
5. Add purposeful motion:
   - staged page-load reveal
   - live status pulses only where they clarify state
   - hover and action feedback
   - reduced-motion support
6. Add small SVG graphs for live metrics and usage bars without introducing a heavy chart dependency.
7. Add inline controls next to the surfaced entities instead of isolating actions on separate pages.

### Verification

1. Build the app with `npm run build`.
2. Restart `dashboard-v2.service`.
3. Check the live service logs for regressions.
4. Update `PROGRESS_LOG.md` with the completed work and any follow-up gaps.
