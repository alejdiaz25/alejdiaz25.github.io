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
  const localLinks = [...links.querySelectorAll('a[href^="#"]')];
  const sections = localLinks.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      localLinks.forEach(link => {
        const active = link.hash === '#' + entry.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-15% 0px -60% 0px' });
  sections.forEach(section => observer.observe(section));
})();
