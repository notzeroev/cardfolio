---
title: Portfolio Card Site — Design
date: 2026-05-11
status: approved
---

# Portfolio Card Site — Design

## Summary

A single-page static portfolio centered on one interactive card. The card flips on scroll input (front: name + basic info, back: contact info + links), can be swiped horizontally aside to reveal short descriptions and project overviews underneath, and is summoned back via three paths. Built on Astro for zero-JS-by-default static output with future extensibility for per-project deep-dive pages. Visual inspiration: friend's `rawnak-cardfolio.dev`. Performance target: match the lightness of `t3.gg` at FCP.

## Goals

- Ultra-light: HTML + critical CSS for the card front paints before any framework or animation JS runs.
- "Engineering delight": small footprint, sharp tooling, clean separation of structure / style / behavior.
- The card-feel aesthetic with GSAP-driven flip and swipe interactions.
- Extensible: future per-project deep-dive pages via Astro content collections — no refactor required when the time comes.

## Non-goals

- Blog. Substack handles that; we link out.
- Dynamic data (CMS, GitHub API, etc.).
- Backend features (contact form, view counter, comments).
- Building the project deep-dive pages now — only the scaffolding so they can be added later.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Site framework | **Astro** | Zero JS by default, file-based routing for future project pages, content collections for project Markdown, TS + scoped styles. |
| Animation | **GSAP** (core + Observer + Draggable + ScrollTrigger) | Required by user; handles the flip, swipe, and summon-zone triggers cleanly. |
| Styling | Plain CSS (scoped via Astro). Critical CSS inlined into `<head>`. | No CSS framework needed for one page; keeps payload minimal. |
| Fonts | One subsetted local woff2 OR system stack. *(Open: pick during visual pass.)* | Avoid network round-trip for fonts. |
| Hosting | TBD — Cloudflare Pages / Vercel / Netlify. Static output, any works. | Static output. |

Rejected alternatives:

- Hand-rolled HTML + Vite: viable, but reinvents file-based routing for project pages.
- SvelteKit static: adds ~30KB runtime that buys nothing here — GSAP drives all the motion.

## Interaction model

### State machine

```
                                    ┌── top summon zone ──┐
                                    │                     │
   horizontal swipe                 v                     │
   (leaves a sliver) ─────►  [ State B ]                  │
   [ State A ] ◄────── grab the sliver / pull it back     │
                       OR scroll past top/bottom summon ──┘
                                    ^                     │
                                    │                     │
                                    └─ bottom summon zone ┘
```

- **State A — Card present.** Card is a `position: fixed` overlay. Native scroll is locked. Wheel/touch/key input is captured by `GSAP Observer` and translated to card rotation. The flip feels "infinite" — input perpetually rotates the card.
- **State B — Card aside.** Card has slid horizontally off-screen with a small sliver remaining visible at the edge. Native body scroll is restored. Content underneath becomes interactive.

### Transitions

- **A → B (swipe aside).** GSAP Draggable on the card, x-axis. Past a velocity/distance threshold, the card snaps to the aside position (sliver visible). Keyboard/button alternative provided for accessibility.
- **B → A (summon).** Three paths:
  1. **Sliver pull-back.** Drag the visible sliver back onto the screen (Draggable handles this).
  2. **Top summon zone.** A region at the top of the content with both behaviors: scrolling past it fires a ScrollTrigger that summons the card, AND it contains a focusable button users can activate directly.
  3. **Bottom summon zone.** Same as above, mirrored at the bottom of content.

### Notes

- "Infinite scroll" in state A is implemented as **input hijacking via Observer** (chosen option A2 from brainstorm), not as a tall document. Native scroll is locked while in A.
- Both ends of state B summon the card — you can never "fall off" the page.

## Architecture

```
portfolio/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── public/
│   ├── fonts/                       # subsetted local fonts (if used)
│   └── favicon.svg
├── src/
│   ├── layouts/
│   │   └── Base.astro               # <head>, fonts, meta, shell
│   ├── components/
│   │   ├── Card.astro               # front + back faces
│   │   ├── SummonZone.astro         # top/bottom invisible triggers (state B)
│   │   └── ContentSection.astro     # the stuff underneath the card
│   ├── pages/
│   │   ├── index.astro              # home page
│   │   └── projects/
│   │       └── [slug].astro         # FUTURE — renders content/projects/*.md
│   ├── content/
│   │   ├── config.ts                # Astro content collection schema
│   │   └── projects/                # FUTURE — one .md per project
│   ├── scripts/
│   │   └── card.ts                  # GSAP setup, loaded as an island
│   └── styles/
│       ├── global.css
│       └── critical.css             # inlined into <head>
└── docs/
    └── superpowers/specs/           # this doc lives here
```

### Extensibility — project deep-dive pages

Set up the scaffolding now, even though we won't write project content yet:

- `src/content/config.ts` declares a `projects` content collection with a schema (title, summary, date, tags, etc.).
- `src/pages/projects/[slug].astro` renders one project from the collection.
- Adding a project later = `touch src/content/projects/foo.md` with frontmatter. No code change.

The `Card` component is designed to be reusable on project pages as a "back to home" affordance if desired later.

## Interaction implementation

| Concern | GSAP tool | Active in |
|---|---|---|
| Input → card rotation | `Observer` (wheel/touch/keys) | State A only |
| Horizontal swipe + sliver pull-back | `Draggable` (x-axis with bounds + snap) | Both states |
| Top/bottom summon zones | `ScrollTrigger` | State B only |

A small state controller (`src/scripts/card.ts`) owns the current state and toggles which observers/triggers are bound:

- **Enter A:** enable Observer; disable ScrollTriggers; lock body scroll (`overflow: hidden` on `<html>`); animate card to centered overlay position.
- **Enter B:** disable Observer; enable ScrollTriggers; unlock scroll; animate card to peek-sliver position. Draggable bounds permit pull-back.

Loaded as a single Astro client island on `index.astro`. Project pages do not load it.

## Performance plan

Target: t3.gg-tier FCP. Match the feel of an HTML-only page despite shipping ~75KB of GSAP.

| Bucket | Strategy | Target size |
|---|---|---|
| HTML | Pre-rendered by Astro. Card front markup baked in. | ~3KB gzipped |
| Critical CSS | Inlined in `<head>` — card layout, typography, A/B positions. | ~2KB |
| Rest of CSS | External, non-blocking link. | ~3KB |
| Fonts | One subsetted local woff2 with `font-display: swap`, OR system stack. | ~15KB or 0 |
| GSAP bundle | Loaded via `client:idle` island — runs *after* FCP. | ~75KB |
| Images | None above the fold. Project pages later use Astro `<Image>` (AVIF + lazy). | 0 above fold |

**Expected outcome:** FCP ≈ HTML round-trip. Card visually appears before GSAP resolves. Interactivity "wakes up" 100–300ms later, imperceptible on broadband.

## Accessibility

- **`prefers-reduced-motion`:** Observer doesn't bind, so scroll input doesn't auto-rotate the card. The card shows its front face by default; users can flip it via a button affordance, and move it aside via the same button alternative used for swipe. All transitions become discrete (no scrub/inertia tweens) — instant or near-instant.
- **Keyboard:** Arrow keys drive rotation via Observer's built-in key support. Summon zones include focusable buttons. Swipe-aside has a button alternative (visible, focusable).
- **Screen readers:** Front and back faces are real DOM, in semantic order. The face that is currently hidden mid-flip is `aria-hidden`. Content underneath is in the normal document flow.

## Open questions

These do not block implementation but should be resolved during the visual pass:

- Visual aesthetic of the card: typography, color, materiality (matte/gloss/etc.). The reference site is brutalist/monospace — open whether to match or diverge.
- Font choice: one subsetted local woff2 vs system stack.
- Swipe direction: left, right, or symmetric.
- Final hosting target.
- Specific copy for the front and back of the card.

## Out of scope (future work)

- Writing the actual project deep-dive Markdown.
- Any analytics, A/B testing, or telemetry.
- View-transitions API polish between pages (can be added later via Astro's built-in support).
- Sound / haptics on flip or swipe.
