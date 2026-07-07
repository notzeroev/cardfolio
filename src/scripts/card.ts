import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);

const HEADER_NAMES = ['Nathan Isaiah', 'Zeroev'];
const HEADER_HOLD_S = 2;
const HEADER_SCRAMBLE_S = 1.1;

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

function scrollToSlot(slotIndex: number) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const target = reducedMotion
    ? document.querySelector<HTMLElement>(`[data-slot="${slotIndex}"]`)
    : document.getElementById(`slot-${slotIndex}`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateNavActive(currentSlot: number) {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-nav-target]');
  const targets = Array.from(buttons)
    .map((b) => parseInt(b.dataset.navTarget ?? '', 10))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  // Active = the largest nav target that's <= currentSlot. None if currentSlot is below the first target.
  let activeTarget: number | null = null;
  for (const t of targets) {
    if (t <= currentSlot) activeTarget = t;
  }

  buttons.forEach((btn) => {
    const target = parseInt(btn.dataset.navTarget ?? '', 10);
    btn.setAttribute('aria-current', target === activeTarget ? 'true' : 'false');
  });
}

export function initCard() {
  const card = document.getElementById('card');
  const frontFace = card?.querySelector<HTMLElement>('.card__face--front');
  const backFace = card?.querySelector<HTMLElement>('.card__face--back');
  if (!card || !frontFace || !backFace) return;

  const slots = card.querySelectorAll<HTMLElement>('[data-slot]');
  const totalSections = slots.length;
  if (totalSections < 2) return;
  const flips = totalSections - 1;

  // Clicking the header title returns to the first slot (the photo intro).
  const headerText = document.getElementById('header-text');
  if (headerText) {
    headerText.addEventListener('click', () => scrollToSlot(0));
  }

  // Nav click handlers (work regardless of motion preference)
  document.querySelectorAll<HTMLButtonElement>('[data-nav-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.navTarget ?? '', 10);
      if (Number.isNaN(target)) return;
      scrollToSlot(target);
    });
  });

  const mm = gsap.matchMedia();

  mm.add('(max-width: 900px)', () => {
    ScrollTrigger.normalizeScroll(true);
    return () => {
      ScrollTrigger.normalizeScroll(false);
    };
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    startHeaderScramble();
    let lastSlot = -1;

    const onUpdate = () => {
      const angle = gsap.getProperty(card, 'rotationY') as number;
      const facingFront = Math.cos((angle * Math.PI) / 180) >= 0;
      frontFace.setAttribute('aria-hidden', String(!facingFront));
      backFace.setAttribute('aria-hidden', String(facingFront));

      const currentSlot = Math.round(angle / 180);
      if (currentSlot !== lastSlot) {
        lastSlot = currentSlot;
        updateNavActive(currentSlot);
      }
    };

    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
        invalidateOnRefresh: true,
        fastScrollEnd: true,
        snap: {
          // Snap based on the rendered rotation, not scroll position.
          // Each flat face sits at a multiple of 180°; midpoints are at +90°.
          // Crossing 90° toward the next face commits; anything less reverts.
          // Reading the visual angle decouples the threshold from scrub lag.
          snapTo: () => {
            const angle = gsap.getProperty(card, 'rotationY') as number;
            const slot = Math.max(0, Math.min(flips, Math.round(angle / 180)));
            return slot / flips;
          },
          duration: { min: 0.25, max: 0.6 },
          delay: 0.15,
          ease: 'power2.inOut',
        },
      },
    });

    // Friction "gutters" at the very ends of the spin. The first and last
    // GUTTER_DEG of rotation use an exponential ease so the card resists
    // hard near the boundary — most of the rotation happens in the last 10%
    // of the gutter's scroll, giving a "stuck then release" feel. Middle is
    // linear, so slots 1–3 still land at progress 0.25/0.5/0.75.
    const GUTTER_DEG = 60;
    const totalDeg = flips * 180;
    const gutterTime = (GUTTER_DEG / totalDeg) * flips;
    const middleTime = flips - 2 * gutterTime;

    tl.to(card, { rotationY: GUTTER_DEG, duration: gutterTime, ease: 'expo.in', onUpdate });
    tl.to(card, { rotationY: totalDeg - GUTTER_DEG, duration: middleTime, ease: 'none', onUpdate });
    tl.to(card, { rotationY: totalDeg, duration: gutterTime, ease: 'expo.out', onUpdate });

    for (let u = 1; u <= totalSections - 2; u++) {
      const position = u + 0.5;
      const outSlot = u - 1;
      const inSlot = u + 1;
      tl.set(
        `[data-slot="${outSlot}"]`,
        { opacity: 0, attr: { 'aria-hidden': 'true' } },
        position,
      );
      tl.set(
        `[data-slot="${inSlot}"]`,
        { opacity: 1, attr: { 'aria-hidden': 'false' } },
        position,
      );
    }

    // Set initial nav state.
    updateNavActive(0);
  });
}
