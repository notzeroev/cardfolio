import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrambleTextPlugin);

const HEADER_NAMES = ['Nathan Isaiah', 'Zeroev'];
const HEADER_HOLD_S = 2;
const HEADER_SCRAMBLE_S = 1.1;

// Deck geometry — how the resting stack reads. Cards behind the front one
// are slightly smaller, so they're fully hidden at rest but read as a deck
// while a shuffle is in flight.
const PEEK_Y = 0;
const DEPTH_SCALE = 0.02;
const STEP_S = 0.38;
// The mover fully clears the deck at its apex — no overlap while it swaps
// depth, so it reads as a real card pulled off the stack.
const APEX_X = 1.05;

function startHeaderScramble() {
  const el = document.getElementById('header-text');
  if (!el) return;
  const tl = gsap.timeline({ repeat: -1 });
  HEADER_NAMES.forEach((_, i) => {
    const next = HEADER_NAMES[(i + 1) % HEADER_NAMES.length];
    tl.to({}, { duration: HEADER_HOLD_S });
    tl.to(el, {
      duration: HEADER_SCRAMBLE_S,
      scrambleText: { text: next, chars: 'upperAndLowerCase', speed: 0.5 },
      ease: 'none',
    });
  });
}

function updateNavActive(currentSlot: number) {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-nav-target]');
  buttons.forEach((btn) => {
    const target = parseInt(btn.dataset.navTarget ?? '', 10);
    btn.setAttribute('aria-current', target === currentSlot ? 'true' : 'false');
  });
}

export function initCard() {
  const deck = document.getElementById('deck');
  if (!deck) return;
  const cards = Array.from(deck.querySelectorAll<HTMLElement>('[data-slot]'));
  const total = cards.length;
  if (total < 2) return;

  const slotOf = (card: HTMLElement) => parseInt(card.dataset.slot ?? '', 10);
  const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Filled in by the motion block below; no-op under reduced motion.
  let goTo: (slot: number) => void = () => {};

  const jumpTo = (slot: number) => {
    if (reducedMotion()) {
      cards
        .find((c) => slotOf(c) === slot)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      goTo(slot);
    }
  };

  // Clicking the header title returns to the first card (the photo intro).
  document
    .getElementById('header-text')
    ?.addEventListener('click', () => jumpTo(slotOf(cards[0])));

  document.querySelectorAll<HTMLButtonElement>('[data-nav-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.navTarget ?? '', 10);
      if (!Number.isNaN(target)) jumpTo(target);
    });
  });

  const mm = gsap.matchMedia();

  // Reduced motion lays every card out in flow, so none of them may stay
  // inert from the server-rendered deck state.
  mm.add('(prefers-reduced-motion: reduce)', () => {
    cards.forEach((c) => {
      c.inert = false;
    });
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    startHeaderScramble();

    // order[depth] = index into cards[]; order[0] is the front card.
    let order = cards.map((_, i) => i);
    let animating = false;

    const stackProps = (depth: number) => ({
      x: 0,
      y: -depth * PEEK_Y,
      scale: 1 - depth * DEPTH_SCALE,
      zIndex: total - depth,
    });

    const layout = () => {
      order.forEach((ci, depth) => gsap.set(cards[ci], stackProps(depth)));
    };

    const settle = () => {
      // `inert` hides the back cards from assistive tech AND removes their
      // links from the tab order (aria-hidden alone leaves them focusable).
      cards.forEach((c, i) => {
        c.inert = i !== order[0];
      });
      updateNavActive(slotOf(cards[order[0]]));
    };

    // One shuffle. Forward: the front card arcs out to the right and tucks
    // in at the back while everyone behind promotes a step. Backward is the
    // mirror image: the back card arcs out and lands on top.
    //
    // The arc is one continuous motion — x decelerates to its apex and
    // accelerates back in (sine out/in), while y/scale glide to the
    // destination over the whole duration. The z swap happens at the apex,
    // where the card is clear of the deck.
    const step = (dir: 1 | -1, speed = 1) => {
      const dur = STEP_S / speed;
      const tl = gsap.timeline();

      const mover = dir === 1 ? order.shift()! : order.pop()!;
      dir === 1 ? order.push(mover) : order.unshift(mover);
      const el = cards[mover];
      const dest = stackProps(dir === 1 ? total - 1 : 0);

      // Everyone else shifts one position in the stack.
      order.forEach((ci, depth) => {
        if (ci === mover) return;
        const props = stackProps(depth);
        tl.set(cards[ci], { zIndex: props.zIndex }, 0);
        tl.to(
          cards[ci],
          { x: props.x, y: props.y, scale: props.scale, duration: dur, ease: 'power4.out' },
          0,
        );
      });

      // Z choreography: all sets land by the midpoint — overlapping riffle
      // steps start at 75%, so anything scheduled later would fire into the
      // next step and stomp a card it already re-stacked.
      if (dir === 1) {
        // Forward: ride above the deck while exiting, take the back z at
        // the apex.
        tl.set(el, { zIndex: total + 1 }, 0);
        tl.set(el, { zIndex: dest.zIndex }, dur * 0.5);
      } else {
        // Backward: take the front z at the apex — the old front card was
        // demoted at t0, so the top slot is free by then.
        tl.set(el, { zIndex: dest.zIndex }, dur * 0.5);
      }

      tl.to(el, { x: () => el.offsetWidth * APEX_X, duration: dur * 0.5, ease: 'power2.out' }, 0);
      tl.to(el, { x: dest.x, duration: dur * 0.5, ease: 'power2.in' }, dur * 0.5);
      tl.to(el, { y: dest.y, scale: dest.scale, duration: dur, ease: 'power2.inOut' }, 0);

      return tl;
    };

    const tryStep = (dir: 1 | -1) => {
      if (animating) return;
      animating = true;
      step(dir).then(() => {
        animating = false;
        settle();
      });
    };

    goTo = (slot: number) => {
      if (animating) return;
      const target = cards.findIndex((c) => slotOf(c) === slot);
      if (target < 0) return;
      const depth = order.indexOf(target);
      if (depth === 0) return;

      // Direction follows slot order: later slots shuffle forward, earlier
      // slots shuffle backward — never the wraparound shortcut. Longer
      // jumps take proportionally longer, but each extra card adds a 10%
      // speed-up so multi-card hops feel a touch brisker.
      const currentSlot = slotOf(cards[order[0]]);
      const dir: 1 | -1 = slot > currentSlot ? 1 : -1;
      const steps = dir === 1 ? depth : total - depth;
      const speed = 1 + (steps - 1) * 0.1;

      animating = true;
      (async () => {
        // Overlap the steps: the next card starts pulling out while the
        // previous one is still settling, so the jump reads as one fluid
        // riffle instead of separate shuffles. The last step runs to
        // completion before input unlocks.
        for (let s = 0; s < steps; s++) {
          const tl = step(dir, speed);
          const isLast = s === steps - 1;
          await new Promise<void>((resolve) => {
            if (isLast) tl.then(() => resolve());
            else gsap.delayedCall(tl.duration() * 0.75, resolve);
          });
        }
        animating = false;
        settle();
      })();
    };

    // --- Input: absorb scroll into discrete one-card steps. -------------
    // Wheel events during a shuffle (and its cooldown) are swallowed, and a
    // decaying trackpad momentum tail never counts — only a "fresh" gesture
    // (quiet gap, or a delta at least as big as the last one) accumulates.
    const WHEEL_STEP = 40;
    let acc = 0;
    let lastDelta = 0;
    let lastEventT = 0;
    let cooldownUntil = 0;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = performance.now();
      const gap = now - lastEventT;
      const fresh =
        gap > 150 ||
        (Math.abs(e.deltaY) >= Math.abs(lastDelta) && Math.abs(e.deltaY) > 25);
      lastEventT = now;
      lastDelta = e.deltaY;

      if (animating || now < cooldownUntil) {
        acc = 0;
        return;
      }
      if (!fresh) return;
      if (gap > 150) acc = 0;
      acc += e.deltaY;
      if (Math.abs(acc) < WHEEL_STEP) return;
      const dir = acc > 0 ? 1 : -1;
      acc = 0;
      cooldownUntil = now + 300;
      tryStep(dir);
    };

    let touchStartY = 0;
    let touchConsumed = true;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchConsumed = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (touchConsumed || animating) return;
      const dy = touchStartY - e.touches[0].clientY;
      if (Math.abs(dy) > 60) {
        touchConsumed = true;
        tryStep(dy > 0 ? 1 : -1);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t?.closest('input, textarea, select')) return;
      // Space on a focused button/link should activate it, not shuffle.
      if (e.key === ' ' && t?.closest('button, a')) return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        tryStep(1);
      } else if (['ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        tryStep(-1);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);

    layout();
    settle();

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      goTo = () => {};
      gsap.set(cards, { clearProps: 'all' });
    };
  });
}
