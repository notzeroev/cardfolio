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
  const slots = document.querySelectorAll<HTMLElement>('[data-slot]');
  if (slotIndex < 0 || slotIndex >= slots.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    slots[slotIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const flips = slots.length - 1;
  if (flips <= 0) return;

  const scrollRange = document.documentElement.scrollHeight - window.innerHeight;

  // Bail if we're already at (or snapping to) this slot. Without this guard,
  // re-clicking the active section re-fires smooth-scroll, which fights
  // ScrollTrigger snap and produces oscillation.
  const currentSlot = Math.round((window.scrollY / scrollRange) * flips);
  if (currentSlot === slotIndex) return;

  const target = (slotIndex / flips) * scrollRange;
  window.scrollTo({ top: target, behavior: 'smooth' });
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
          snapTo: 1 / flips,
          duration: { min: 0.25, max: 0.6 },
          delay: 0.15,
          ease: 'power2.inOut',
        },
      },
    });

    tl.to(card, {
      rotationY: flips * 180,
      duration: flips,
      onUpdate,
    });

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
