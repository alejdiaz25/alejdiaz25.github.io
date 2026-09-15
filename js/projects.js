/* Interactive 3-pane project viewer.
   Left: project list · Center: specifications (slide-in) · Right: 3D / gallery stage.
   Delegates all WebGL work to window.ModelViewer (js/viewer.js). No anime.js —
   reveals are CSS transitions; the project title keeps a subtle scramble. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
  const pad = n => String(n).padStart(2, '0');
  const projectUrl = id => `projects.html?project=${encodeURIComponent(id)}`;

  let PROJECTS = [];
  let IMAGES = {};

  const state = {
    activeId: null,
    slideIndex: 0,
    modelLoaded: false,
    modelSrc: null,
    loadSeq: 0,
    isMobile: window.innerWidth < 768,
    mobileView: 'list',
    imageList: [],      // { src, label } for lightbox (preview + gallery)
    lightboxIndex: 0,
    autoloadTimer: null, // deferred model auto-load (keeps the text animation smooth)
  };

  /* ── DOM refs ─────────────────────────────────────────── */
  const $viewer = $('project-viewer');
  const $list = $('project-list');
  const $centerContent = $('center-content');
  const $closeSpecs = $('close-specs');
  const $idleMsg = $('idle-message');
  const $prevImg = $('preview-img');
  const $placeholder = $('preview-placeholder');
  const $load3dOverlay = $('load-3d-overlay');
  const $load3dBtn = $('load-3d-btn');
  const $load3dBtnLabel = $('load-3d-btn-label');
  const $threeStage = $('three-stage');
  const $modelSpinner = $('model-spinner');
  const $carouselWrap = $('carousel-wrap');
  const $dots = $('carousel-dots');
  const $slideLabel = $('carousel-slide-label');
  const $stageName = $('stage-project-name');
  const $stageCounter = $('stage-slide-counter');
  const $projectCount = $('project-count');
  const $sidePrev = $('carousel-side-prev');
  const $sideNext = $('carousel-side-next');
  const $rightPane = $('right-pane');
  const $carouselControls = document.querySelector('.carousel-controls');

  const $mobileDetail = $('mobile-detail');
  const $mobileBackBtn = $('mobile-back-btn');
  const $mobileTitle = $('mobile-detail-title');
  const $mobileCounter = $('mobile-detail-counter');
  const $mobileCarousel = $('mobile-carousel-zone');
  const $mobileSpecs = $('mobile-specs-zone');

  const $lightbox = $('image-lightbox');
  const $lightboxImg = $('lightbox-image');
  const $lightboxCaption = $('lightbox-caption');
  const $lightboxCount = $('lightbox-count');
  const $lightboxPrev = $('lightbox-prev');
  const $lightboxNext = $('lightbox-next');
  const $closeLightbox = $('close-lightbox');

  /* ── Image helper (responsive srcset from manifest) ────── */
  function applyImg(img, src, alt) {
    const opt = IMAGES[src];
    img.alt = alt || '';
    if (opt) {
      img.srcset = opt.srcset;
      img.sizes = '100vw';
      img.src = opt.src;
    } else {
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
      img.src = src;
    }
  }

  /* ── Staggered reveal (replaces anime.js) ─────────────── */
  function revealSpecs(root) {
    const items = root.querySelectorAll('.spec-fade-item');
    items.forEach((el, i) => {
      el.style.transitionDelay = `${i * 45}ms`;
      el.classList.remove('in');
    });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      items.forEach(el => el.classList.add('in'));
    }));
  }

  function scrambleTitle(root, project) {
    const titleEl = root.querySelector('.spec-project-title');
    if (!titleEl) return;
    titleEl.textContent = project.title;
    if (reducedMotion.matches || typeof ScrambleText === 'undefined') return;
    titleEl.dataset.scrambleOriginal = project.title;
    new ScrambleText(titleEl, { duration: 620, delay: 0 }).run();
  }

  /* ── LEFT PANE ────────────────────────────────────────── */
  function renderList() {
    $projectCount.textContent = `${PROJECTS.length} projects`;
    PROJECTS.forEach(p => {
      const li = document.createElement('li');
      li.className = 'project-item';
      li.dataset.id = p.id;
      li.innerHTML = `
        <div class="item-indicator"></div>
        <div class="item-text">
          <div class="item-org">${p.org}</div>
          <div class="item-title">${p.title}</div>
          <div class="item-sub">${p.subtitle}</div>
        </div>
        <span class="item-arrow"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>`;
      li.addEventListener('click', () => selectProject(p.id, { history: true }));
      $list.appendChild(li);
    });
  }

  /* ── SPECS ────────────────────────────────────────────── */
  function descToBullets(text) {
    return text.replace(/\.\s+(?=[A-Z0-9])/g, '.|').split('|').map(s => s.trim()).filter(s => s.length > 3);
  }

  function renderSpecs(project) {
    const softwareStr = project.software.join(' · ');
    const tagsHtml = project.tags.map(t => `<li class="spec-tag">${t}</li>`).join('');
    const bulletsHtml = descToBullets(project.description).map(s => `<li>${s}</li>`).join('');

    $centerContent.innerHTML = `
      <div class="spec-project-title">${project.title}</div>
      <div class="spec-project-org spec-fade-item">${project.org} — ${project.subtitle}</div>
      <ul class="spec-project-desc spec-fade-item">${bulletsHtml}</ul>

      <span class="spec-section-label spec-fade-item">Technical Data</span>
      ${project.specs.map(s => `
        <div class="spec-row spec-fade-item">
          <span class="spec-key">${s.key}</span>
          <span class="spec-val">${s.val}</span>
        </div>`).join('')}

      <span class="spec-section-label spec-fade-item">Software</span>
      <div class="spec-row spec-fade-item">
        <span class="spec-key">Tools</span>
        <span class="spec-val gold">${softwareStr}</span>
      </div>

      <ul class="spec-tags spec-fade-item">${tagsHtml}</ul>`;

    $mobileSpecs.innerHTML = $centerContent.innerHTML;
  }

  /* ── SELECT PROJECT (desktop) ─────────────────────────── */
  function selectProject(id, { history = false } = {}) {
    const project = PROJECTS.find(p => p.id === id) || PROJECTS[0];
    if (!project) return;

    if (state.isMobile) { openMobileDetail(project.id, { history }); return; }

    const isReselect = state.activeId === project.id;
    state.activeId = project.id;
    if (!isReselect) unloadModel();

    if (history) window.history.pushState({ project: project.id }, '', projectUrl(project.id));
    document.title = `${project.title} — Alejandro Diaz`;

    document.querySelectorAll('.project-item').forEach(el => el.classList.toggle('active', el.dataset.id === project.id));

    renderSpecs(project);
    $viewer.classList.add('specs-open');
    scrambleTitle($centerContent, project);
    revealSpecs($centerContent);

    showProjectStage(project);
    /* Defer the model auto-load until the title scramble + specs reveal finish,
       so the heavy Three.js init/parse doesn't stutter the text animation. */
    goToSlide(0, project, { deferLoad: true });
  }

  /* ── STAGE ────────────────────────────────────────────── */
  function showProjectStage(project) {
    $idleMsg.style.display = 'none';
    $rightPane.classList.add('has-project');
    $stageName.textContent = project.title;
    $prevImg.style.display = 'none';

    /* Build the lightbox image list: preview + gallery */
    state.imageList = [];
    if (project.preview) state.imageList.push({ src: project.preview, label: 'Render' });
    (project.gallery || []).forEach((src, i) => { if (src) state.imageList.push({ src, label: `Photo ${i + 1}` }); });

    buildCarousel(project);
  }

  function clearGallerySlides() {
    $carouselWrap.querySelectorAll('.carousel-slide:not(#slide-0)').forEach(el => el.remove());
  }

  function buildCarousel(project) {
    clearGallerySlides();
    const models = project.models || [];
    const modelCount = Math.max(models.length, 1);

    state.imageList.forEach((img, i) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      slide.id = `slide-${modelCount + i}`;
      const image = document.createElement('img');
      image.className = 'gallery-img';
      image.loading = 'lazy';
      applyImg(image, img.src, `${project.title} — ${img.label}`);
      image.addEventListener('click', () => openLightbox(i));
      const enlarge = document.createElement('button');
      enlarge.type = 'button';
      enlarge.className = 'enlarge-image';
      enlarge.innerHTML = 'View image <span aria-hidden="true">↗</span>';
      enlarge.addEventListener('click', () => openLightbox(i));
      slide.append(image, enlarge);
      $carouselWrap.appendChild(slide);
    });

    /* Dots */
    $dots.innerHTML = '';
    const modelLabels = models.length ? models.map(m => m.label) : ['3D Model — Coming Soon'];
    const labels = [...modelLabels, ...state.imageList.map(s => s.label)];
    labels.forEach((label, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.title = label;
      dot.setAttribute('aria-label', label);
      dot.addEventListener('click', () => goToSlide(i, project));
      $dots.appendChild(dot);
    });
    /* Initial slide is set by the caller's goToSlide (which controls deferred loading). */
  }

  function slideMeta(project) {
    const models = project.models || [];
    const modelCount = Math.max(models.length, 1);
    const total = modelCount + state.imageList.length;
    return { models, modelCount, total };
  }

  function goToSlide(index, project, opts = {}) {
    const proj = project || PROJECTS.find(p => p.id === state.activeId);
    if (!proj) return;
    clearTimeout(state.autoloadTimer);
    const { models, modelCount, total } = slideMeta(proj);

    index = Math.max(0, Math.min(index, total - 1));
    state.slideIndex = index;
    const isOn3d = index < modelCount;

    $carouselWrap.querySelectorAll('.carousel-slide').forEach(s => s.classList.remove('active'));
    if (isOn3d) $('slide-0').classList.add('active');
    else { const el = $(`slide-${index}`); if (el) el.classList.add('active'); }

    ModelViewer.setVisible(isOn3d && state.modelLoaded && state.modelSrc === (models[index] && models[index].src));
    $viewer.classList.toggle('wide-specs', !isOn3d);

    if (isOn3d) {
      if (models.length) {
        $load3dBtnLabel.textContent = models.length > 1 ? models[index].label : 'Load Interactive 3D';
        const targetSrc = models[index].src;
        if (state.modelLoaded && state.modelSrc === targetSrc) {
          $load3dOverlay.classList.remove('visible');
          ModelViewer.setVisible(true);
        } else {
          ModelViewer.setVisible(false);
          if (desktop.matches) {
            $load3dOverlay.classList.remove('visible');
            const run = () => loadModel().catch(e => console.error('Auto-load failed:', e));
            if (opts.deferLoad && !reducedMotion.matches) {
              $modelSpinner.classList.add('visible'); /* immediate feedback while text animates */
              state.autoloadTimer = setTimeout(run, 720);
            } else {
              run();
            }
          } else {
            $load3dOverlay.classList.add('visible');
          }
        }
        $placeholder.style.display = 'none';
      } else {
        $load3dOverlay.classList.remove('visible');
        $placeholder.style.display = 'flex';
        $placeholder.querySelector('.preview-placeholder-label').textContent = '3D Model — Coming Soon';
      }
    } else {
      $load3dOverlay.classList.remove('visible');
    }

    $dots.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === index));

    const modelLabels = models.length ? models.map(m => m.label) : ['3D Model — Coming Soon'];
    const labels = [...modelLabels, ...state.imageList.map(s => s.label)];
    updateControls(index, total, labels);
  }

  function updateControls(index, total, labels) {
    $slideLabel.textContent = labels[index] || '—';
    const counter = total > 1 ? `${pad(index + 1)} / ${pad(total)}` : '—';
    $stageCounter.textContent = counter;
    $mobileCounter.textContent = counter;
    const multi = total > 1;
    $sidePrev.classList.toggle('visible', multi && index > 0);
    $sideNext.classList.toggle('visible', multi && index < total - 1);
  }

  /* ── 3D MODEL ─────────────────────────────────────────── */
  async function loadModel() {
    const project = PROJECTS.find(p => p.id === state.activeId);
    if (!project) return;
    const { models, modelCount } = slideMeta(project);
    if (!models.length || state.slideIndex >= modelCount) return;

    const target = models[state.slideIndex];
    if (state.modelLoaded && state.modelSrc === target.src) return;

    const seq = ++state.loadSeq;
    $modelSpinner.classList.add('visible');
    $load3dOverlay.classList.remove('visible');
    $load3dBtn.disabled = true;

    try {
      await ModelViewer.init($threeStage);
      if (seq !== state.loadSeq) return;
      await ModelViewer.load(target.src);
      if (seq !== state.loadSeq) return;
      state.modelLoaded = true;
      state.modelSrc = target.src;
      $modelSpinner.classList.remove('visible');
      $load3dBtn.disabled = false;
      if (state.slideIndex < modelCount) { ModelViewer.resize(); ModelViewer.setVisible(true); }
    } catch (e) {
      if (seq !== state.loadSeq) return;
      console.error('Model load failed:', e);
      state.modelLoaded = false;
      state.modelSrc = null;
      $modelSpinner.classList.remove('visible');
      $load3dBtn.disabled = false;
      $load3dBtnLabel.textContent = 'Retry 3D model';
      $load3dOverlay.classList.add('visible');
    }
  }

  function unloadModel() {
    state.loadSeq++;
    clearTimeout(state.autoloadTimer);
    ModelViewer.setVisible(false);
    ModelViewer.unload();
    state.modelLoaded = false;
    state.modelSrc = null;
    $modelSpinner.classList.remove('visible');
    $load3dBtn.disabled = false;
  }

  /* ── LIGHTBOX ─────────────────────────────────────────── */
  function renderLightbox() {
    const item = state.imageList[state.lightboxIndex];
    if (!item) return;
    const project = PROJECTS.find(p => p.id === state.activeId);
    applyImg($lightboxImg, item.src, `${project.title} — ${item.label}`);
    $lightboxCaption.textContent = `${project.title} / ${item.label}`;
    $lightboxCount.textContent = `${pad(state.lightboxIndex + 1)} / ${pad(state.imageList.length)}`;
    $lightboxPrev.disabled = state.lightboxIndex === 0;
    $lightboxNext.disabled = state.lightboxIndex === state.imageList.length - 1;
  }

  function openLightbox(imageIndex) {
    if (!state.imageList.length) return;
    state.lightboxIndex = Math.max(0, Math.min(imageIndex, state.imageList.length - 1));
    renderLightbox();
    $lightbox.showModal();
  }

  function moveLightbox(dir) {
    state.lightboxIndex = Math.max(0, Math.min(state.lightboxIndex + dir, state.imageList.length - 1));
    renderLightbox();
  }

  $closeLightbox.addEventListener('click', () => $lightbox.close());
  $lightboxPrev.addEventListener('click', () => moveLightbox(-1));
  $lightboxNext.addEventListener('click', () => moveLightbox(1));

  /* ── MOBILE DETAIL ────────────────────────────────────── */
  function openMobileDetail(id, { history = false } = {}) {
    const project = PROJECTS.find(p => p.id === id);
    if (!project) return;
    state.mobileView = 'detail';
    state.activeId = id;
    unloadModel();

    if (history) window.history.pushState({ project: id }, '', projectUrl(id));
    document.querySelectorAll('.project-item').forEach(el => el.classList.toggle('active', el.dataset.id === id));

    renderSpecs(project);
    showProjectStage(project);

    $mobileCarousel.appendChild($carouselWrap);
    if ($carouselControls) $mobileDetail.insertBefore($carouselControls, $mobileSpecs);
    $mobileTitle.textContent = project.title;

    goToSlide(0, project);

    $mobileDetail.setAttribute('aria-hidden', 'false');
    void $mobileDetail.offsetHeight;
    $mobileDetail.classList.add('open');
    $mobileDetail.scrollTop = 0;
    requestAnimationFrame(() => ModelViewer.resize());

    scrambleTitle($mobileSpecs, project);
    revealSpecs($mobileSpecs);
  }

  function closeMobileDetail() {
    state.mobileView = 'list';
    $mobileDetail.classList.remove('open');
    $mobileDetail.setAttribute('aria-hidden', 'true');
    if (history.state && history.state.project) window.history.pushState({}, '', 'projects.html');
    setTimeout(() => {
      if ($carouselControls) $rightPane.appendChild($carouselControls);
      $rightPane.insertBefore($carouselWrap, $carouselControls);
      unloadModel();
      document.querySelectorAll('.project-item').forEach(el => el.classList.remove('active'));
      state.activeId = null;
      $mobileSpecs.innerHTML = '';
      $mobileTitle.textContent = '';
      $mobileCounter.textContent = '—';
    }, 400);
  }

  $mobileBackBtn.addEventListener('click', closeMobileDetail);

  /* ── CONTROLS / EVENTS ────────────────────────────────── */
  $load3dBtn.addEventListener('click', () => loadModel().catch(e => console.error('loadModel failed:', e)));
  $sidePrev.addEventListener('click', () => goToSlide(state.slideIndex - 1));
  $sideNext.addEventListener('click', () => goToSlide(state.slideIndex + 1));
  $closeSpecs.addEventListener('click', closeSpecs);

  function closeSpecs() {
    $viewer.classList.remove('specs-open');
    if (history.state && history.state.project) window.history.pushState({}, '', 'projects.html');
  }

  window.addEventListener('resize', () => ModelViewer.resize());
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('project');
    if (id) { state.isMobile ? openMobileDetail(id) : selectProject(id); }
    else if (state.isMobile && state.mobileView === 'detail') closeMobileDetail();
    else closeSpecs();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($lightbox.open) return; /* dialog closes itself */
      if (state.isMobile && state.mobileView === 'detail') closeMobileDetail();
      else closeSpecs();
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.target.matches('input, select, textarea')) return;
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    if ($lightbox.open) { e.preventDefault(); moveLightbox(dir); return; }
    if (!state.activeId) return;
    e.preventDefault();
    goToSlide(state.slideIndex + dir);
  });

  /* Restore desktop layout when crossing 768px */
  window.addEventListener('resize', () => {
    const wasMobile = state.isMobile;
    state.isMobile = window.innerWidth < 768;
    if (wasMobile && !state.isMobile && state.mobileView === 'detail') {
      $mobileDetail.classList.remove('open');
      $mobileDetail.setAttribute('aria-hidden', 'true');
      if ($carouselControls) $rightPane.appendChild($carouselControls);
      $rightPane.insertBefore($carouselWrap, $carouselControls);
      state.mobileView = 'list';
      if (state.activeId) selectProject(state.activeId);
      ModelViewer.resize();
    }
  });

  /* Lock page scroll while dragging the 3D model (mobile) */
  $threeStage.addEventListener('touchmove', e => { if (state.isMobile && state.modelLoaded) e.preventDefault(); }, { passive: false });

  /* Carousel swipe */
  (() => {
    let startX = 0, startY = 0, tracking = false;
    $carouselWrap.addEventListener('touchstart', e => {
      const { modelCount } = state.activeId ? slideMeta(PROJECTS.find(p => p.id === state.activeId)) : { modelCount: 1 };
      if (state.modelLoaded && state.slideIndex < modelCount && e.target.closest('#three-stage')) return;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    $carouselWrap.addEventListener('touchmove', e => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx)) { tracking = false; return; }
      e.preventDefault();
    }, { passive: false });
    $carouselWrap.addEventListener('touchend', e => {
      if (!tracking) return; tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) < 40 || !state.activeId) return;
      goToSlide(state.slideIndex + (dx < 0 ? 1 : -1));
    }, { passive: true });
  })();

  /* Swipe-down to dismiss mobile detail */
  (() => {
    let startY = 0, startScroll = 0, pulling = false, onCanvas = false;
    $mobileDetail.addEventListener('touchstart', e => {
      onCanvas = state.modelLoaded && !!e.target.closest('#three-stage');
      startY = e.touches[0].clientY; startScroll = $mobileDetail.scrollTop; pulling = false;
    }, { passive: true });
    $mobileDetail.addEventListener('touchmove', e => {
      if (onCanvas || startScroll > 0) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) { pulling = true; $mobileDetail.style.transition = 'none'; $mobileDetail.style.transform = `translateY(${dy * 0.4}px)`; e.preventDefault(); }
    }, { passive: false });
    $mobileDetail.addEventListener('touchend', e => {
      if (!pulling) return;
      const dy = e.changedTouches[0].clientY - startY;
      $mobileDetail.style.transition = ''; $mobileDetail.style.transform = '';
      if (dy > 80) closeMobileDetail(); else $mobileDetail.classList.add('open');
      pulling = false;
    }, { passive: true });
  })();

  /* ── INIT ─────────────────────────────────────────────── */
  function init() {
    renderList();
    const id = new URLSearchParams(location.search).get('project');
    if (id) { state.isMobile ? openMobileDetail(id) : selectProject(id); }

    /* Nav-link hover scramble is wired in nav.js (shared). Here: the left-pane org labels. */
    if (!reducedMotion.matches && typeof ScrambleText !== 'undefined') {
      document.querySelectorAll('.item-org').forEach(el => {
        el.addEventListener('mouseenter', () => new ScrambleText(el, { duration: 400, contained: false }).run());
      });
    }
  }

  Promise.all([
    fetch('projects.json').then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    fetch('images/manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({})),
  ]).then(([data, images]) => {
    PROJECTS = data.projects;
    IMAGES = images || {};
    init();
  }).catch(e => {
    const status = $('projects-status');
    if (status) { status.hidden = false; status.textContent = 'Projects could not load. Please refresh to try again.'; }
    console.error('Failed to load projects.json:', e);
  });
})();
