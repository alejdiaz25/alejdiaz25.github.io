'use strict';
(() => {
  const nav = document.getElementById('site-nav');
  const toggle = nav?.querySelector('.nav-toggle');
  const links = nav?.querySelector('.nav-links');
  if (!nav || !toggle || !links) return;
  const mobile = matchMedia('(max-width: 767px)');
  function setOpen(open, returnFocus = false) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.innerHTML = open ? 'Close <span aria-hidden="true">−</span>' : 'Menu <span aria-hidden="true">+</span>';
    nav.classList.toggle('menu-open', open);
    links.inert = mobile.matches && !open;
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false, true);
  });
  document.addEventListener('click', event => { if (!nav.contains(event.target)) setOpen(false); });
  nav.addEventListener('focusout', () => queueMicrotask(() => {
    if (!nav.contains(document.activeElement)) setOpen(false);
  }));
  mobile.addEventListener('change', () => setOpen(false));
  setOpen(false);
  /* Hover-scramble the nav links (shared across pages; ScrambleText loaded separately). */
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    links.querySelectorAll('a').forEach(link => {
      link.addEventListener('mouseenter', () => {
        if (typeof ScrambleText !== 'undefined') new ScrambleText(link, { duration: 350 }).run();
      });
    });
  }
  const sectionLinks = [...links.querySelectorAll('a[href^="#"], a[data-section]')]
    .map(link => ({ link, section: document.getElementById(link.dataset.section || link.hash.slice(1)) }))
    .filter(({ section }) => Boolean(section));
  if (!sectionLinks.length) return;
  let scrollFrame = 0;
  function syncActiveSection() {
    scrollFrame = 0;
    const threshold = window.innerHeight * .42;
    let activeSection = null;
    for (const item of sectionLinks) {
      const rect = item.section.getBoundingClientRect();
      if (rect.top <= threshold && rect.bottom > 0) activeSection = item.section;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      activeSection = sectionLinks.at(-1).section;
    }
    sectionLinks.forEach(({ link, section }) => {
      const active = section === activeSection;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function scheduleActiveSection() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(syncActiveSection);
  }
  window.addEventListener('scroll', scheduleActiveSection, { passive: true });
  window.addEventListener('resize', scheduleActiveSection);
  scheduleActiveSection();
})();
