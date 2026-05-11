import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const SLIVER_PX = 60;
const INFINITE_SPIN_DEG = 18000;

export function initCard() {
  const card = document.getElementById('card');
  const front = card?.querySelector<HTMLElement>('.card__face--front');
  const back = card?.querySelector<HTMLElement>('.card__face--back');
  if (!card || !front || !back) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const rot = { y: 0 };
  const setRotation = gsap.quickSetter(card, 'rotationY', 'deg');

  function applyRotation() {
    setRotation(rot.y);
    const facingFront = Math.cos((rot.y * Math.PI) / 180) >= 0;
    front!.setAttribute('aria-hidden', String(!facingFront));
    back!.setAttribute('aria-hidden', String(facingFront));
  }

  function getAsideX(): number {
    return (window.innerWidth / 2) - SLIVER_PX + (card!.getBoundingClientRect().width / 2);
  }

  applyRotation();

  if (reducedMotion) return;

  // Phase 1 — at the top: one full spin (front → back → front)
  gsap.to(rot, {
    y: 360,
    ease: 'none',
    onUpdate: applyRotation,
    scrollTrigger: {
      trigger: '.scroll-spin',
      start: 'top top',
      end: 'bottom top',
      scrub: 0.5,
    },
  });

  // Phase 2 — slide card left until only a sliver remains
  gsap.fromTo(card,
    { x: 0 },
    {
      x: () => -getAsideX(),
      ease: 'power2.inOut',
      immediateRender: false,
      scrollTrigger: {
        trigger: '.scroll-slide-out',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
      },
    },
  );

  // Phase 4 — slide card back from the left to center
  gsap.fromTo(card,
    { x: () => -getAsideX() },
    {
      x: 0,
      ease: 'power2.inOut',
      immediateRender: false,
      scrollTrigger: {
        trigger: '.scroll-slide-in',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,
      },
    },
  );

  // Phase 5 — at the bottom: infinite spin (lots of rotation over a long scroll)
  gsap.to(rot, {
    y: `+=${INFINITE_SPIN_DEG}`,
    ease: 'none',
    onUpdate: applyRotation,
    scrollTrigger: {
      trigger: '.scroll-infinite',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
    },
  });
}
