'use strict';

/* ── INTERSECTION OBSERVER — ENTRANCE ANIMATIONS ─────────── */
const enterObs = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      enterObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

function observeEnterElements() {
  document.querySelectorAll('[class*="enter-"]:not(.visible), .rule:not(.visible)').forEach(el => {
    enterObs.observe(el);
  });
}

/* Initial pass for any elements already in the DOM */
observeEnterElements();

/* Expose for re-init after dynamic content loads */
window.initAnimations = function () {
  observeEnterElements();

  if (typeof ScrambleText === 'undefined') return;
  bindHoverScramble('.section-eyebrow', 500);
  bindHoverScramble('.exp-company', 400);
  bindHoverScramble('.skill-group-label', 450);
  bindHoverScramble('.stat-label', 350);
};

/* ── HERO SCRAMBLE ON LOAD ───────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof ScrambleText === 'undefined') return;

  const heroTargets = [
    { sel: '.hero-system-label',   delay:  400, duration: 1200 },
    { sel: '.hero-name .first',    delay:  700, duration: 1000 },
    { sel: '.hero-name .last-inner', delay: 950, duration: 1000 },
    { sel: '.hero-descriptor',     delay: 1250, duration:  900 },
  ];
  heroTargets.forEach(({ sel, delay, duration }) => {
    const el = document.querySelector(sel);
    if (el) new ScrambleText(el, { delay, duration, fromEmpty: true }).run();
  });

  /* ── HOVER SCRAMBLE BINDINGS ─────────────────────────────── */
  bindHoverScramble('.nav-links a', 350);
  bindHoverScramble('.hdc-label', 300);
});

function bindHoverScramble(selector, duration) {
  document.querySelectorAll(selector).forEach(el => {
    if (el._scrambleBound) return;
    el._scrambleBound = true;
    el.addEventListener('mouseenter', () => {
      new ScrambleText(el, { duration }).run();
    });
  });
}
