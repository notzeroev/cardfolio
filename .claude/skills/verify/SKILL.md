---
name: verify
description: Build, serve, and drive this portfolio site in a headless browser to verify the card-deck interaction.
---

# Verifying this site

Static Astro site, no backend. Interaction lives in `src/scripts/card.ts`
(deck-shuffle: wheel/touch/keys advance one card per gesture).

## Build + serve

```bash
bun run build          # outputs dist/
bun run preview &      # check the log — port varies (4321+, picks next free)
```

## Drive it

Playwright is not a project dep. Install it in a temp dir and run a script
from there (imports resolve against that dir's node_modules):

```bash
mkdir -p /tmp/deck-verify && cd /tmp/deck-verify
bun add playwright && bunx playwright install chromium
node your-script.mjs
```

Useful probes:
- Front card: `[data-slot][aria-hidden="false"]` — its `data-slot` is the
  current section index.
- One wheel notch: `page.mouse.wheel(0, 120)`, wait ~1s, front should
  advance exactly one. A burst of ramping/decaying deltas (trackpad flick)
  must also advance exactly one — the momentum filter absorbs the tail.
- `window.scrollY` must stay 0 and the document must not be scrollable.
- Nav buttons `[data-nav-target]` jump to that slot; `aria-current="true"`
  marks the active one. `#header-text` click returns to slot 0.
- Screenshot mid-animation (~350ms after wheel) to see the slide-out frame.

## Gotchas

- Screenshots taken mid-scramble show the header as random glyphs — the
  GSAP ScrambleText header cycles names; not a bug.
- Wheel steps have a ~300ms post-animation cooldown, so leave ≥1s between
  scripted gestures you expect to register.
