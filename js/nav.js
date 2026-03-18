'use strict';

/* ── NAV ACTIVE STATE ────────────────────────────────────── */
(function initNavObserver() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');
  if (!sections.length || !navLinks.length) return;

  const navObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const href = entry.target.id === 'projects-preview'
          ? 'projects.html'
          : '#' + entry.target.id;

        navLinks.forEach(a => {
          const wasActive = a.classList.contains('active');
          const isActive = a.getAttribute('href') === href;
          a.classList.toggle('active', isActive);

          /* Scramble the newly activated link */
          if (isActive && !wasActive && typeof ScrambleText !== 'undefined') {
            new ScrambleText(a, { duration: 300 }).run();
          }
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => navObs.observe(s));
})();
