/**
 * Choreography (GSAP + ScrollTrigger). Only runs when MOTION is true; otherwise the
 * page is already in its final state (reduced motion or no GSAP).
 *  - Hero intro: canopy sweeps in, letters rise, then the signature split:
 *    "sunshine" → "sun · or · shine" (words slide apart, "or" pops in, sun warms to blue,
 *    shine to berry, a tiny sun and sparkle pop with a burst).
 *  - Scroll story: canopy parallax, section reveals, the invitation unfolds like a letter,
 *    the storybook→real wipe follows the scroll, polaroids are dealt, the sonogram develops,
 *    the fork path draws itself, lanterns wake one by one at sunset.
 */
import { $, $$, MOTION, gsap, ST, rand, centerOf } from './util.js';
import { burst, COL } from './leaves.js';
import { setWipe, wipeTouched } from './photos.js';

function intro() {
  const sun = $('.title .w-sun'), shine = $('.title .w-shine'), or = $('.title .w-or'), q = $('.title .w-q');
  // Close the gap so the two words read as one: "sunshine".
  const gap = shine.getBoundingClientRect().left - sun.getBoundingClientRect().right;
  gsap.set(sun, { x: gap / 2 });
  gsap.set([shine, q], { x: -gap / 2 });
  gsap.set(or, { opacity: 0, scale: 0.3 });
  gsap.set('.title .ch', { color: '#6b1f2a', opacity: 1 });
  gsap.set('.title .t-ico', { scale: 0, opacity: 0 });
  gsap.set(q, { opacity: 0 });

  const tl = gsap.timeline({ delay: 0.15 });
  tl.fromTo('#canopyL', { opacity: 1, xPercent: -45, yPercent: -40, rotation: -14 }, { xPercent: 0, yPercent: 0, rotation: 0, duration: 1.8, ease: 'power3.out' }, 0)
    .fromTo('#canopyR', { opacity: 1, xPercent: 45, yPercent: -40, rotation: 14 }, { xPercent: 0, yPercent: 0, rotation: 0, duration: 1.8, ease: 'power3.out' }, 0)
    .to('#heroLights', { opacity: 1, duration: 1.4, ease: 'power1.out' }, 0.5)
    .fromTo('.h-eyebrow > *', { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.8, ease: 'power2.out' }, 0.25)
    .fromTo('.title .ch', { yPercent: 105, opacity: 0, rotation: 8 }, { yPercent: 0, opacity: 1, rotation: 0, stagger: 0.055, duration: 0.9, ease: 'back.out(1.7)' }, 0.4)
    .fromTo('.hero-art', { y: 50, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 1.4, ease: 'power3.out' }, 0.55)
    .fromTo('.hero .h-sub, .hero .h-meta, .hero .h-cta, .hero .cue', { y: 18, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.8, ease: 'power2.out' }, 1)
    // the signature split
    .to(sun, { x: 0, duration: 1.15, ease: 'expo.inOut' }, 1.9)
    .to([shine, q], { x: 0, duration: 1.15, ease: 'expo.inOut' }, 1.9)
    .to('.w-sun .ch', { color: '#2c5d8f', duration: 1, ease: 'none' }, 2.2)
    .to('.w-shine .ch', { color: '#a3365f', duration: 1, ease: 'none' }, 2.2)
    .to(or, { opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(2.4)' }, 2.45)
    .to(q, { opacity: 1, duration: 0.6, ease: 'power2.out' }, 2.7)
    .to('.title .t-ico', { scale: 1, opacity: 1, duration: 0.9, stagger: 0.15, ease: 'back.out(2.6)' }, 2.6)
    .call(() => {
      const a = centerOf($('.ico-sun')), b = centerOf($('.ico-shine'));
      burst(a[0], a[1], { n: 14, colors: COL.sun, speed: 4, gravity: 0.02, life: 50, size: [2, 5] });
      burst(b[0], b[1], { n: 18, colors: COL.shine, speed: 4, gravity: 0.02, life: 55, size: [2, 5] });
    }, null, 2.75)
    .call(() => gsap.set('.title .ch', { clearProps: 'color' }), null, 3.4);
}

function scrollStory() {
  const hero = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.to('.canopy-l', { yPercent: -60, xPercent: -18, rotation: -8, ease: 'none', scrollTrigger: hero });
  gsap.to('.canopy-r', { yPercent: -60, xPercent: 18, rotation: 8, ease: 'none', scrollTrigger: { ...hero } });
  gsap.fromTo('.arch img', { scale: 1.02 }, { scale: 1.12, yPercent: 3, ease: 'none', scrollTrigger: { ...hero } });

  ST.batch('.rv', { start: 'top 88%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: 'power3.out', overwrite: true }) });

  // The invitation unfolds like a letter.
  gsap.from('#inviteCard', { rotationX: -72, transformOrigin: '50% 0%', transformPerspective: 1100, opacity: 0, y: 40, duration: 1.5, ease: 'power3.out', scrollTrigger: { trigger: '#inviteCard', start: 'top 86%', once: true } });
  gsap.from('#inviteCard .detail, #inviteCard .actions', { opacity: 0, x: -16, stagger: 0.12, duration: 0.7, ease: 'power2.out', scrollTrigger: { trigger: '#inviteCard .details', start: 'top 88%', once: true } });

  // Storybook → real: follows the scroll until the guest grabs the leaf.
  const ws = { x: 100 };
  gsap.to(ws, { x: 42, ease: 'none', onUpdate: () => { if (!wipeTouched()) setWipe(ws.x); }, scrollTrigger: { trigger: '#wipe', start: 'top 80%', end: 'center 40%', scrub: 0.8 } });

  // Polaroids are dealt onto the table.
  const pols = $$('#chapters .polaroid');
  if (pols.length) {
    pols.forEach((p) => gsap.set(p, { rotation: parseFloat(p.style.getPropertyValue('--r')) || 0 }));
    gsap.from(pols, { y: 90, opacity: 0, rotation: () => rand(-28, 28), x: () => rand(-40, 40), duration: 1.1, stagger: 0.12, ease: 'back.out(1.3)', scrollTrigger: { trigger: '#chapters', start: 'top 88%', once: true } });
  }

  // Sonogram develops like an instant photo.
  gsap.set('#sono', { rotation: 2.5 });
  gsap.from('#sono', { y: 60, opacity: 0, rotation: -10, duration: 1.2, ease: 'back.out(1.4)', scrollTrigger: { trigger: '#sono', start: 'top 86%', once: true } });
  gsap.from('#sonoPic > *', { opacity: 0, filter: 'brightness(2.2) blur(6px)', duration: 1.8, ease: 'power1.out', scrollTrigger: { trigger: '#sono', start: 'top 72%', once: true } });

  gsap.from('.bb .bb-pic', { scale: 0.5, opacity: 0, duration: 1, stagger: 0.12, ease: 'back.out(2)', scrollTrigger: { trigger: '#llRow', start: 'top 86%', once: true } });

  // The fork: the dotted path draws itself in, then the two doors rise.
  for (const p of $$('.fork .trail')) {
    const L = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: `${L} ${L}`, strokeDashoffset: L }, {
      strokeDashoffset: 0, duration: 1.6, ease: 'power2.out',
      onComplete: () => gsap.set(p, { strokeDasharray: '1 9', strokeDashoffset: 0 }),
      scrollTrigger: { trigger: '#fork', start: 'top 86%', once: true },
    });
  }
  gsap.fromTo('.sides .side', { y: 50, opacity: 0, transition: 'none' }, { y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: 'back.out(1.6)', clearProps: 'transform,opacity,transition', scrollTrigger: { trigger: '.sides', start: 'top 92%', once: true } });

  gsap.from('#rsvpStage', { y: 60, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: '#rsvpStage', start: 'top 90%', once: true } });

  // Sunset: lanterns wake up one by one, scrubbed to the scroll.
  gsap.to('#treeline .lamp', { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '#dusk', start: 'top 85%', end: 'bottom 55%', scrub: true } });
  gsap.from('.dusk-line', { opacity: 0, y: 30, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '#dusk', start: 'top 60%', once: true } });

  gsap.from('.countdown .cd', { y: 30, opacity: 0, stagger: 0.1, duration: 0.9, ease: 'back.out(1.8)', scrollTrigger: { trigger: '#countdown', start: 'top 90%', once: true } });
  gsap.from('.critters svg', { y: 30, opacity: 0, stagger: 0.08, duration: 0.9, ease: 'back.out(2)', scrollTrigger: { trigger: '.critters', start: 'top 95%', once: true } });
}

export function initMotion() {
  if (!MOTION) return;
  intro();
  scrollStory();
}
