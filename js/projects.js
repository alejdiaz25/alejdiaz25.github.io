/* JSON-driven case studies with an optional shared Three.js model viewer. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { projects: [], images: {}, project: null, media: [], mediaIndex: 0, modelSrc: null, modelLoading: false, loadSequence: 0, lightboxIndex: 0 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)');
  const number = value => String(value).padStart(2, '0');
  const projectUrl = id => `projects.html?project=${encodeURIComponent(id)}`;
  const imageMedia = () => state.media.filter(item => item.type === 'image');

  function setImage(image, src, alt) {
    const optimized = state.images[src];
    image.alt = alt;
    if (optimized) {
      image.srcset = optimized.srcset;
      image.sizes = '100vw';
      image.width = optimized.width;
      image.height = optimized.height;
    } else {
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
    }
    image.src = optimized ? optimized.src : src;
  }

  function projectLink(project, label) {
    const link = document.createElement('a');
    link.href = projectUrl(project.id);
    link.dataset.projectId = project.id;
    const num = document.createElement('span');
    num.className = 'index-number';
    num.textContent = number(label);
    const title = document.createElement('span');
    title.className = 'index-title';
    title.textContent = project.title;
    link.append(num, title);
    return link;
  }

  function renderIndex() {
    $('project-total').textContent = number(state.projects.length);
    state.projects.forEach((project, index) => {
      const item = document.createElement('li');
      item.append(projectLink(project, index + 1));
      $('project-list').append(item);
    });
  }

  function renderSpecifications(project) {
    $('project-specs').replaceChildren();
    project.specs.forEach(spec => {
      const row = document.createElement('div');
      const key = document.createElement('dt');
      const value = document.createElement('dd');
      key.textContent = spec.key;
      value.textContent = spec.val;
      row.append(key, value);
      $('project-specs').append(row);
    });
    $('project-software').textContent = project.software.join(' / ');
    $('project-tags').replaceChildren();
    project.tags.forEach(tag => {
      const item = document.createElement('li');
      item.textContent = tag;
      $('project-tags').append(item);
    });
    const role = project.specs.find(spec => spec.key.toLowerCase() === 'role');
    $('project-role').hidden = !role;
    $('project-role').replaceChildren();
    if (role) {
      const label = document.createElement('h3');
      label.textContent = 'Role';
      const text = document.createElement('p');
      text.textContent = role.val;
      $('project-role').append(label, text);
    }
  }

  function selectProject(id, { history = false, focus = false } = {}) {
    const project = state.projects.find(item => item.id === id) || state.projects[0];
    if (!project) return;
    unloadModel();
    state.project = project;
    const index = state.projects.indexOf(project);
    if (history) window.history.pushState({ project: project.id }, '', projectUrl(project.id));
    document.title = `${project.title} — Alejandro Diaz`;
    $('project-title').textContent = project.title;
    $('project-number').textContent = `Project ${number(index + 1)} / ${number(state.projects.length)}`;
    $('project-org').textContent = project.org;
    $('project-subtitle').textContent = project.subtitle;
    $('project-description').textContent = project.description;
    renderSpecifications(project);
    document.querySelectorAll('#project-list a').forEach(link => {
      if (link.dataset.projectId === project.id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    const previous = state.projects[(index - 1 + state.projects.length) % state.projects.length];
    const next = state.projects[(index + 1) % state.projects.length];
    [['previous-project', previous], ['next-project', next]].forEach(([elementId, item]) => {
      const link = $(elementId);
      link.href = projectUrl(item.id);
      link.dataset.projectId = item.id;
      link.querySelector('strong').textContent = item.title;
    });
    state.media = [];
    (project.models || []).forEach(model => state.media.push({ type: 'model', src: model.src, label: model.label, shortLabel: model.label }));
    if (project.preview) state.media.push({ type: 'image', src: project.preview, label: 'CAD / Assembly', shortLabel: 'Overview' });
    (project.gallery || []).forEach((src, i) => {
      if (src) state.media.push({ type: 'image', src, label: `Project image ${number(i + 1)}`, shortLabel: `Image ${number(i + 1)}` });
    });
    $('media-options').replaceChildren();
    state.media.forEach((item, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-option';
      button.textContent = item.shortLabel;
      button.addEventListener('click', () => selectMedia(i));
      $('media-options').append(button);
    });
    setImage($('model-preview'), project.wireframeThumbnail || project.preview, `${project.title} — assembly preview`);
    $('project-index').open = false;
    $('project-article').hidden = false;
    $('projects-status').hidden = true;
    selectMedia(0);
    if (focus) {
      $('case-heading').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
      $('project-title').focus({ preventScroll: true });
    }
  }

  function selectMedia(index) {
    const item = state.media[index];
    if (!item) return;
    if (state.modelLoading) unloadModel();
    state.mediaIndex = index;
    const isModel = item.type === 'model';
    const loaded = isModel && state.modelSrc === item.src && ModelViewer.isLoaded();
    $('project-image').hidden = isModel;
    $('model-stage').hidden = !isModel;
    $('enlarge-image').hidden = isModel;
    ModelViewer.setVisible(loaded);
    if (isModel) {
      $('model-prompt').hidden = loaded;
      $('model-preview').hidden = loaded;
      $('model-label').textContent = item.label;
      $('model-status').textContent = 'Drag to rotate. Scroll or pinch to zoom.';
      $('load-model').disabled = false;
      $('load-model').innerHTML = 'Load 3D model <span aria-hidden="true">↗</span>';
      if (loaded) ModelViewer.resize();
    } else {
      setImage($('project-image'), item.src, `${state.project.title} — ${item.label}`);
    }
    $('media-caption').textContent = item.label;
    $('media-count').textContent = `${number(index + 1)} / ${number(state.media.length)}`;
    $('media-prev').disabled = index === 0;
    $('media-next').disabled = index === state.media.length - 1;
    document.querySelectorAll('.media-option').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (isModel && !loaded && desktop.matches) loadModel();
  }

  async function loadModel() {
    const item = state.media[state.mediaIndex];
    if (!item || item.type !== 'model' || state.modelLoading) return;
    const sequence = ++state.loadSequence;
    state.modelLoading = true;
    state.modelSrc = null;
    $('load-model').disabled = true;
    $('load-model').textContent = 'Loading assembly…';
    $('model-status').textContent = 'Preparing interactive geometry.';
    try {
      await ModelViewer.init($('three-stage'));
      if (sequence !== state.loadSequence) return;
      await ModelViewer.load(item.src);
      if (sequence !== state.loadSequence) return;
      state.modelSrc = item.src;
      state.modelLoading = false;
      $('model-prompt').hidden = true;
      $('model-preview').hidden = true;
      ModelViewer.resize();
      ModelViewer.setVisible(true);
    } catch (error) {
      if (sequence !== state.loadSequence) return;
      state.modelSrc = null;
      state.modelLoading = false;
      $('load-model').disabled = false;
      $('load-model').textContent = 'Retry 3D model ↗';
      $('model-status').textContent = 'The model could not load. Try again, or browse the project images.';
      console.error('Model load failed:', error);
    }
  }

  function unloadModel() {
    state.loadSequence++;
    state.modelSrc = null;
    state.modelLoading = false;
    ModelViewer.setVisible(false);
    ModelViewer.unload();
  }

  function renderLightbox() {
    const images = imageMedia();
    const item = images[state.lightboxIndex];
    if (!item) return;
    $('lightbox-image').src = item.src;
    $('lightbox-image').alt = `${state.project.title} — ${item.label}`;
    $('lightbox-caption').textContent = `${state.project.title} / ${item.label}`;
    $('lightbox-count').textContent = `${number(state.lightboxIndex + 1)} / ${number(images.length)}`;
    $('lightbox-prev').disabled = state.lightboxIndex === 0;
    $('lightbox-next').disabled = state.lightboxIndex === images.length - 1;
  }

  function moveLightbox(direction) {
    state.lightboxIndex = Math.max(0, Math.min(state.lightboxIndex + direction, imageMedia().length - 1));
    renderLightbox();
  }

  $('enlarge-image').addEventListener('click', () => {
    state.lightboxIndex = imageMedia().indexOf(state.media[state.mediaIndex]);
    renderLightbox();
    $('image-lightbox').showModal();
    document.body.style.overflow = 'hidden';
  });
  $('close-lightbox').addEventListener('click', () => $('image-lightbox').close());
  $('image-lightbox').addEventListener('close', () => { document.body.style.overflow = ''; $('enlarge-image').focus(); });
  $('lightbox-prev').addEventListener('click', () => moveLightbox(-1));
  $('lightbox-next').addEventListener('click', () => moveLightbox(1));
  $('media-prev').addEventListener('click', () => selectMedia(state.mediaIndex - 1));
  $('media-next').addEventListener('click', () => selectMedia(state.mediaIndex + 1));
  $('load-model').addEventListener('click', loadModel);
  desktop.addEventListener('change', () => {
    if (desktop.matches && !state.modelLoading && state.modelSrc !== state.media[state.mediaIndex]?.src) loadModel();
  });

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-project-id]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    selectProject(link.dataset.projectId, { history: true, focus: true });
  });
  window.addEventListener('popstate', () => selectProject(new URLSearchParams(location.search).get('project')));
  window.addEventListener('resize', () => ModelViewer.resize());
  document.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target.matches('input, select, textarea')) return;
    if ($('image-lightbox').open) {
      event.preventDefault();
      moveLightbox(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.target.closest('.case-media')) {
      event.preventDefault();
      selectMedia(state.mediaIndex + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });

  function enableSwipe(element, move) {
    let start = null;
    element.addEventListener('touchstart', event => {
      if (event.touches.length !== 1 || event.target.closest('#three-stage')) { start = null; return; }
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true });
    element.addEventListener('touchend', event => {
      if (!start) return;
      const dx = event.changedTouches[0].clientX - start.x;
      const dy = event.changedTouches[0].clientY - start.y;
      start = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) move(dx < 0 ? 1 : -1);
    }, { passive: true });
    element.addEventListener('touchcancel', () => { start = null; }, { passive: true });
  }
  enableSwipe($('media-stage'), direction => selectMedia(state.mediaIndex + direction));
  enableSwipe($('lightbox-image'), moveLightbox);

  Promise.all([
    fetch('projects.json').then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); }),
    fetch('images/manifest.json').then(response => response.ok ? response.json() : {}).catch(() => ({})),
  ]).then(([data, images]) => {
    state.projects = data.projects;
    state.images = images;
    renderIndex();
    selectProject(new URLSearchParams(location.search).get('project'));
  }).catch(error => {
    $('projects-status').textContent = 'Projects could not load. Please refresh the page to try again.';
    console.error('Project data could not load:', error);
  });
})();
