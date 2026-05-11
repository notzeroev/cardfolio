import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';
import { Draggable } from 'gsap/Draggable';

gsap.registerPlugin(Observer, Draggable);

type CardState = 'A' | 'B';
type CardEvent = 'swipe-aside' | 'summon-pull' | 'summon-top' | 'summon-bottom';

const transitions: Record<CardState, Partial<Record<CardEvent, CardState>>> = {
  A: { 'swipe-aside': 'B' },
  B: { 'summon-pull': 'A', 'summon-top': 'A', 'summon-bottom': 'A' },
};

function createState(initial: CardState = 'A') {
  let s = initial;
  const listeners = new Set<(next: CardState, prev: CardState) => void>();
  return {
    get: () => s,
    send(e: CardEvent) {
      const n = transitions[s]?.[e];
      if (!n || n === s) return false;
      const prev = s;
      s = n;
      listeners.forEach((l) => l(s, prev));
      return true;
    },
    on(l: (next: CardState, prev: CardState) => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

const SLIVER_PX = 60;
const SWIPE_THRESHOLD_RATIO = 0.25;
const SUMMON_ARM_DELAY_MS = 500;
const FLIP_DURATION = 0.6;
const SWIPE_DURATION = 0.4;

export function initCard() {
  const card = document.getElementById('card');
  const front = card?.querySelector<HTMLElement>('.card__face--front');
  const back = card?.querySelector<HTMLElement>('.card__face--back');
  if (!card || !front || !back) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = createState('A');

  let summonsArmed = false;
  let lastScrollY = 0;

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

  function animate(target: gsap.TweenTarget, vars: gsap.TweenVars) {
    if (reducedMotion) gsap.set(target, vars);
    else gsap.to(target, vars);
  }

  applyRotation();

  // Observer: scroll/touch input → card rotation in state A
  const observer = Observer.create({
    target: window,
    type: 'wheel,touch',
    preventDefault: !reducedMotion,
    wheelSpeed: 1,
    onChangeY: (self) => {
      if (state.get() !== 'A' || reducedMotion) return;
      rot.y += self.deltaY * 0.5;
      applyRotation();
    },
  });

  // Draggable: horizontal swipe-aside and sliver pull-back
  Draggable.create(card, {
    type: 'x',
    onDragStart() {
      observer.disable();
    },
    onDragEnd() {
      const x = this.x;
      const threshold = window.innerWidth * SWIPE_THRESHOLD_RATIO;
      const asideX = getAsideX();
      const cur = state.get();

      if (cur === 'A' && Math.abs(x) > threshold) {
        const target = x > 0 ? asideX : -asideX;
        animate(card, { x: target, duration: SWIPE_DURATION, ease: 'power2.out' });
        state.send('swipe-aside');
      } else if (cur === 'B' && Math.abs(x) < (asideX - threshold)) {
        animate(card, { x: 0, duration: SWIPE_DURATION, ease: 'power2.out' });
        state.send('summon-pull');
      } else {
        const restingX = cur === 'A' ? 0 : (x > 0 ? asideX : -asideX);
        animate(card, { x: restingX, duration: SWIPE_DURATION, ease: 'power2.out' });
        if (cur === 'A') observer.enable();
      }
    },
  });

  // Scroll-edge summon zones (state B only, armed after a short delay)
  window.addEventListener('scroll', () => {
    if (state.get() !== 'B' || !summonsArmed) {
      lastScrollY = window.scrollY;
      return;
    }
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (y <= 0 && lastScrollY > 0) state.send('summon-top');
    else if (y >= max - 1 && y > lastScrollY) state.send('summon-bottom');
    lastScrollY = y;
  }, { passive: true });

  // Summon buttons (keyboard / direct invocation)
  document.querySelectorAll<HTMLButtonElement>('[data-summon-trigger]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.get() !== 'B') return;
      const pos = btn.dataset.summonTrigger;
      state.send(pos === 'top' ? 'summon-top' : 'summon-bottom');
    });
  });

  // Flip button (keyboard alternative to scroll-flip)
  document.querySelectorAll<HTMLButtonElement>('[data-flip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.get() !== 'A') return;
      const target = rot.y + 180;
      if (reducedMotion) {
        rot.y = target;
        applyRotation();
        return;
      }
      gsap.to(rot, { y: target, duration: FLIP_DURATION, onUpdate: applyRotation });
    });
  });

  // Swipe-aside button (keyboard alternative to drag swipe)
  document.querySelectorAll<HTMLButtonElement>('[data-swipe-aside]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.get() !== 'A') return;
      const dir = btn.dataset.swipeAside === 'left' ? -1 : 1;
      animate(card, { x: getAsideX() * dir, duration: SWIPE_DURATION, ease: 'power2.out' });
      state.send('swipe-aside');
    });
  });

  // State change side effects: lock/unlock observer, animate card position
  state.on((next) => {
    card.dataset.state = next;
    if (next === 'A') {
      observer.enable();
      summonsArmed = false;
      animate(card, { x: 0, duration: SWIPE_DURATION, ease: 'power2.out' });
    } else {
      observer.disable();
      summonsArmed = false;
      setTimeout(() => {
        summonsArmed = true;
      }, SUMMON_ARM_DELAY_MS);
    }
  });

  observer.enable();
}
