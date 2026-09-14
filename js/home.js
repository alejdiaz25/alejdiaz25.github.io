'use strict';

(() => {
  let imageManifest = {};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const arrow = '<span aria-hidden="true">↗</span>';
  const number = value => String(value).padStart(2, '0');
  const projectURL = id => 'projects.html?project=' + encodeURIComponent(id);
  async function readJSON(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error('Could not load ' + path);
    return response.json();
  }
  function photo(src, alt, sizes = '100vw', eager = false) {
    const asset = imageManifest[src];
    const sizeAttrs = asset ? `width="${asset.width}" height="${asset.height}" srcset="${esc(asset.srcset)}" sizes="${sizes}"` : '';
    return `<img src="${esc(asset?.src || src)}" alt="${esc(alt)}" ${sizeAttrs} loading="${eager ? 'eager' : 'lazy'}" ${eager ? 'fetchpriority="high"' : 'decoding="async"'}>`;
  }
  function sectionHead(id, label, title) {
    return `<div class="section-heading" data-reveal><p class="meta section-label">${esc(label)}</p><h2 class="section-title" id="${id}">${title}</h2></div>`;
  }
  function renderWork(data) {
    const cards = data.preview.thumbs.map(thumb => {
      const project = data.projects.find(project => project.id === thumb.id);
      if (!project) return '';
      const projectNumber = number(data.projects.indexOf(project) + 1);
      const intro = project.description.match(/^.*?[.!?](?:\s|$)/)?.[0] || project.description;
      return `<li class="work-card"><a href="${projectURL(project.id)}">
        <figure class="work-card-media">${photo(project.wireframeThumbnail || thumb.img, thumb.alt, '(max-width: 767px) 85vw, 44vw')}</figure>
        <div class="work-card-body"><p class="meta work-card-meta">${projectNumber} / ${esc(project.org)}</p>
          <div class="work-card-heading"><h3>${esc(project.title)}</h3>${arrow}</div>
          <p class="work-card-caption">${esc(intro.trim())}</p>
        </div></a></li>`;
    }).join('');
    const index = data.projects.map((project, i) => `<li><a class="project-index-link" href="${projectURL(project.id)}"><span class="meta">${number(i + 1)}</span><span class="index-title">${esc(project.title)}</span><span class="index-org meta">${esc(project.org)}</span>${arrow}</a></li>`).join('');
    document.getElementById('projects-preview-content').innerHTML = `${sectionHead('work-heading', data.preview.eyebrow, 'Engineering<br>in practice.')}
      <div class="work-carousel" role="region" aria-label="Engineering projects carousel">
        <ul class="work-track" id="work-track" tabindex="0" aria-label="Browse projects. Use left and right arrow keys.">${cards}</ul>
        <div class="work-carousel-controls"><a class="text-link" href="${esc(data.preview.link.href)}">Explore all ${data.projects.length} projects ${arrow}</a><div class="work-arrows"><span class="meta" id="work-position" aria-live="polite"></span><button class="control-button" id="work-prev" type="button" aria-label="Previous projects">←</button><button class="control-button" id="work-next" type="button" aria-label="Next projects">→</button></div></div>
      </div>
      <details class="work-index"><summary class="index-heading"><h3>Project index</h3><span class="meta">${number(data.projects.length)} projects <span class="index-toggle" aria-hidden="true">+</span></span></summary><ol>${index}</ol></details>`;
    initWorkCarousel();
  }
  function initWorkCarousel() {
    const track = document.getElementById('work-track');
    const cards = [...track.children];
    const prev = document.getElementById('work-prev');
    const next = document.getElementById('work-next');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const carousel = track.closest('.work-carousel');
    const autoplay = document.createElement('button');
    autoplay.id = 'work-autoplay';
    autoplay.className = 'autoplay-control';
    autoplay.type = 'button';
    document.querySelector('.work-arrows').prepend(autoplay);
    let timer;
    let inView = false;
    let hovered = false;
    let paused = false;
    const delay = 7000;
    function schedule() {
      clearTimeout(timer);
      autoplay.disabled = reduced.matches;
      autoplay.textContent = reduced.matches ? 'Auto-play off' : paused ? 'Resume' : 'Pause';
      autoplay.setAttribute('aria-label', paused ? 'Resume automatic project scrolling' : 'Pause automatic project scrolling');
      document.getElementById('work-position').setAttribute('aria-live', paused || reduced.matches ? 'polite' : 'off');
      if (!inView || hovered || paused || reduced.matches || document.hidden || carousel.contains(document.activeElement)) return;
      timer = setTimeout(() => {
        const max = track.scrollWidth - track.clientWidth;
        moveTo(track.scrollLeft >= max - 2 ? 0 : track.scrollLeft + step());
        schedule();
      }, delay);
    }
    const step = () => cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : track.clientWidth;
    const moveTo = left => track.scrollTo({ left, behavior: reduced.matches ? 'instant' : 'smooth' });
    function update() {
      const max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft < 2;
      next.disabled = track.scrollLeft >= max - 2;
      const first = Math.round(track.scrollLeft / step()) + 1;
      document.getElementById('work-position').textContent = number(first) + ' / ' + number(cards.length);
    }
    prev.addEventListener('click', () => moveTo(track.scrollLeft - step()));
    next.addEventListener('click', () => moveTo(track.scrollLeft + step()));
    track.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') moveTo(0);
      else if (event.key === 'End') moveTo(track.scrollWidth);
      else moveTo(track.scrollLeft + (event.key === 'ArrowLeft' ? -step() : step()));
    });
    autoplay.addEventListener('click', () => { paused = !paused; schedule(); });
    carousel.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovered = true; schedule(); } });
    carousel.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    carousel.addEventListener('focusin', schedule);
    carousel.addEventListener('focusout', () => queueMicrotask(schedule));
    carousel.addEventListener('touchstart', () => { hovered = true; schedule(); }, { passive: true });
    carousel.addEventListener('touchend', () => { hovered = false; schedule(); }, { passive: true });
    carousel.addEventListener('touchcancel', () => { hovered = false; schedule(); }, { passive: true });
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', schedule);
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting && entries[0].intersectionRatio >= .35;
      schedule();
    }, { threshold: [0, .35] }).observe(track);
    track.addEventListener('scroll', () => { update(); schedule(); }, { passive: true });
    new ResizeObserver(update).observe(track);
    update();
    schedule();
  }
  function renderExperience(data) {
    function records(items) {
      return items.map(item => `<article class="exp-item" data-reveal><div class="exp-identity"><p class="meta exp-period">${esc(item.period)}</p><h3 class="exp-company">${esc(item.company)}</h3>${item.logo ? `<img class="exp-logo" src="${esc(item.logo)}" alt="${esc(item.company)} logo" width="160" height="64" loading="lazy">` : ''}</div><div class="exp-details"><h4 class="exp-role">${item.role}</h4><ul class="exp-bullets">${item.bullets.map(bullet => `<li>${bullet}</li>`).join('')}</ul></div></article>`).join('');
    }
    document.getElementById('experience-content').innerHTML = `${sectionHead('experience-heading', data.eyebrow, data.title)}<div class="exp-list">${records(data.items)}</div><h2 class="subsection-title" data-reveal>${esc(data.relevantTitle)}</h2><div class="exp-list">${records(data.relevantItems || [])}</div>`;
  }
  function renderAbout(data) {
    const photos = data.photos || (data.headshot ? [data.headshot] : []);
    document.getElementById('about-content').innerHTML = `${sectionHead('about-heading', data.eyebrow, data.title)}<div class="about-grid"><div class="about-media" data-reveal>${photos.length ? `<div class="about-carousel" role="region" aria-label="About Alejandro photos" tabindex="0"><div class="ac-stage">${photos.map((item, i) => `<figure class="ac-slide" ${i ? 'hidden' : ''}>${photo(item.src, item.alt, '(max-width: 767px) 100vw, 40vw')}</figure>`).join('')}</div><div class="ac-controls"><span class="meta ac-count" aria-live="polite">01 / ${number(photos.length)}</span><div><button class="ac-prev control-button" type="button" aria-label="Previous photo">←</button><button class="ac-next control-button" type="button" aria-label="Next photo">→</button></div></div></div>` : ''}${data.stats?.length ? `<dl class="stat-grid">${data.stats.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.num)}</dd></div>`).join('')}</dl>` : ''}</div><div class="about-body" data-reveal>${data.paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}<a class="text-link" href="#contact">Get in touch ${arrow}</a></div></div>`;
    const carousel = document.querySelector('.about-carousel');
    if (!carousel) return;
    let current = 0;
    const slides = [...carousel.querySelectorAll('.ac-slide')];
    function move(direction) {
      current = (current + direction + slides.length) % slides.length;
      slides.forEach((slide, index) => { slide.hidden = index !== current; });
      carousel.querySelector('.ac-count').textContent = number(current + 1) + ' / ' + number(slides.length);
    }
    carousel.querySelector('.ac-prev').addEventListener('click', () => move(-1));
    carousel.querySelector('.ac-next').addEventListener('click', () => move(1));
    carousel.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
    });
    let touchStart;
    carousel.addEventListener('touchstart', event => { touchStart = event.touches[0]; }, { passive: true });
    carousel.addEventListener('touchend', event => {
      if (!touchStart) return;
      const dx = event.changedTouches[0].clientX - touchStart.clientX;
      const dy = event.changedTouches[0].clientY - touchStart.clientY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  function renderCoursework(data) {
    document.getElementById('coursework-content').innerHTML = `${sectionHead('coursework-heading', data.eyebrow, data.title)}<div class="cw-grid"><div class="course-list"><h3 class="meta">Relevant courses</h3><dl class="courses-table">${data.courses.map(course => `<div class="course-row"><dt class="course-code meta">${esc(course.code)}</dt><dd class="course-name">${esc(course.name)}</dd></div>`).join('')}</dl></div><div class="cw-projects"><h3 class="meta">Academic projects</h3>${data.academicProjects.map(project => `<article class="cw-project" data-reveal><p class="meta">${esc(project.label)}</p><h4>${esc(project.name)}</h4><p class="cw-desc">${esc(project.desc)}</p><ul class="inline-tags">${(project.tags || []).map(tag => `<li>${esc(tag)}</li>`).join('')}</ul>${project.wip ? '<p class="meta">In progress</p>' : ''}</article>`).join('')}</div></div>`;
  }
  function renderSkills(data) {
    document.getElementById('skills-content').innerHTML = `${sectionHead('skills-heading', data.eyebrow, data.title)}<div class="skills-grid">${data.groups.map(group => `<div class="skill-group" data-reveal><h3 class="meta">${esc(group.label)}</h3><ul>${group.tags.map(tag => `<li>${esc(tag)}</li>`).join('')}</ul></div>`).join('')}</div><p class="skills-subtitle meta">${esc(data.subtitle || '')}</p>`;
  }
  function renderContact(data) {
    document.getElementById('contact-content').innerHTML = `<p class="meta section-label">${esc(data.eyebrow)}</p><h2 class="contact-heading" id="contact-heading" data-reveal>${data.heading}</h2><div class="contact-grid"><div><p class="contact-sub">${esc(data.sub)}</p><a class="text-link" href="${esc(data.resumeHref)}" target="_blank" rel="noopener noreferrer">View resume ${arrow}</a></div><div class="contact-links">${data.links.map(link => link.static ? `<div class="contact-link"><span class="meta">${esc(link.label)}</span><span>${esc(link.value)}</span></div>` : `<a class="contact-link" href="${esc(link.href)}" ${link.external ? 'target="_blank" rel="noopener noreferrer"' : ''}><span class="meta">${esc(link.label)}</span><span>${esc(link.value)}</span>${arrow}</a>`).join('')}</div></div>`;
  }
  Promise.all([readJSON('content.json'), readJSON('projects.json'), readJSON('images/manifest.json').catch(() => ({}))])
    .then(([content, projects, manifest]) => {
      imageManifest = manifest;
      renderWork(projects);
      renderExperience(content.experience);
      renderAbout(content.about);
      renderCoursework(content.coursework);
      renderSkills(content.skills);
      renderContact(content.contact);
      document.getElementById('footer-content').innerHTML = `<span>${esc(content.footer.copyright)}</span><div><a href="#coursework">Coursework</a><a href="#skills">Skills</a><a href="#hero">Back to top ↑</a></div>`;
      document.body.dataset.contentLoaded = 'true';
      window.initAnimations?.();
      if (location.hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
    })
    .catch(error => {
      console.error('Portfolio content failed to load:', error);
      document.getElementById('projects-preview-content').innerHTML = '<p class="load-error" role="alert">The portfolio content could not load. Please reload the page, or <a href="resume.pdf">view the resume</a>.</p>';
    });
})();
