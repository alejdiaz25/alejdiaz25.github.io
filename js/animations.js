'use strict';
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }), { threshold: .06 });
  window.initAnimations = () => {
    document.querySelectorAll('[data-reveal]').forEach(element => {
      if (reduced.matches || element.getBoundingClientRect().top < innerHeight) element.classList.add('visible');
      else { element.classList.add('reveal-ready'); observer.observe(element); }
    });
  };
  reduced.addEventListener('change', () => {
    if (reduced.matches) document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('visible'));
  });
  window.initAnimations();
})();
