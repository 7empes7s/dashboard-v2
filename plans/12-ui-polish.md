# Feature 12: UI Polish - The Garage Wall

**File**: `12-ui-polish.md`
**Priority**: P2
**Month**: 4-6 (Aug-Oct 2026)

---

## Overview

Polish the UI to give the "Iron Man control room" feel: dense, dark, high-contrast, with glowing accents and real-time feel.

---

## Enhancement Areas

### 1. Command Center Redesign
- Real-time status strip (always visible)
- Glowing status indicators
- Animated state transitions
- Keyboard shortcuts

### 2. Visual Polish
- Add scan-line effect (optional, subtle)
- Glowing borders on active elements
- Pulse animation on running items
- Toast notifications for actions

### 3. Density Improvements
- Compact rows
- Expandable details
- Keyboard navigation (j/k)

### 4. Mobile Refinements
- Responsive sidebar
- Swipe gestures

---

## Example CSS Additions

```css
/* Glowing status */
.status-glow {
  box-shadow: 0 0 8px currentColor;
}

/* Running pulse */
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 4px currentColor; }
  50% { box-shadow: 0 0 12px currentColor; }
}

.running-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

/* Scan line (subtle) */
.scanline::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(94, 106, 210, 0.3), transparent);
  animation: scan 4s linear infinite;
}

@keyframes scan {
  0% { top: 0; }
  100% { top: 100%; }
}
```

---

## Exit Criteria

- [ ] Command center feels like mission control
- [ ] Status indicators glow
- [ ] Running items pulse
- [ ] Action feedback is instant
- [ ] Works on mobile