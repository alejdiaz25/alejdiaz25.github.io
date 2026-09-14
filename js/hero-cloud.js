'use strict';

(() => {
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('hero-cloud');
  const ctx = canvas?.getContext('2d', { alpha: true });
  if (!ctx) return;
  const button = document.getElementById('hero-motion');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, frame = 0, last = 0, time = 0;
  let visible = false, paused = false;
  let targetX = 0, targetY = 0, pointerX = 0, pointerY = 0;

  // A regular X/Z grid becomes a flowing heightfield, projected through a
  // perspective camera. Near points spread out; distant rows form fine ridges.
  function draw() {
    ctx.clearRect(0, 0, width, height);
    const mobile = width < 768;
    const columns = mobile ? 92 : 160;
    const rows = mobile ? 66 : 96;
    const focal = width * (mobile ? 2.2 : .85);
    const pitch = .43 + pointerY * .045;
    const sin = Math.sin(pitch), cos = Math.cos(pitch);
    for (let row = rows; row >= 0; row--) {
      const z = row / rows * 22;
      for (let col = 0; col <= columns; col++) {
        const x = (col / columns - .5) * 34;
        const y = Math.sin(x * .30 + z * .25 + time * .22) * 1.45
          + Math.cos(z * .43 - x * .16 - time * .16) * 1.15
          + Math.sin(x * .55 + z * .15 + time * .12) * .32;
        const depth = z * cos + y * sin + 10;
        const scale = focal / depth;
        const sx = width * .54 + (x + pointerX * .75) * scale;
        const sy = height * .65 + ((2.2 - y) * cos - z * sin) * scale;
        if (sx < 0 || sx > width || sy < 0 || sy > height) continue;
        const edge = Math.min(1, sx / 90, (width - sx) / 90, sy / 70, (height - sy) / 100);
        const alpha = (.45 + (1 - row / rows) * .45) * edge;
        // Nardo grey, with a small lightness lift on the crests for depth.
        const shade = Math.round(76 + (y + 3) * 5);
        ctx.fillStyle = `rgba(${shade},${shade + 4},${shade + 7},${alpha})`;
        const radius = Math.max(.45, Math.min(1.55, scale * .018));
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (now - last < 32) return;
    const delta = last ? Math.min((now - last) / 1000, .06) : 0;
    last = now;
    time += delta;
    pointerX += (targetX - pointerX) * .045;
    pointerY += (targetY - pointerY) * .045;
    draw();
  }
  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    button.hidden = reduced.matches;
    button.textContent = paused ? 'Resume motion' : 'Pause motion';
    button.setAttribute('aria-label', paused ? 'Resume background motion' : 'Pause background motion');
    if (reduced.matches) { pointerX = pointerY = 0; draw(); }
    if (visible && !document.hidden && !paused && !reduced.matches) frame = requestAnimationFrame(tick);
  }
  new ResizeObserver(() => {
    width = hero.clientWidth;
    height = hero.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }).observe(hero);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(hero);
  hero.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = hero.getBoundingClientRect();
    targetX = (event.clientX - bounds.left) / width * 2 - 1;
    targetY = (event.clientY - bounds.top) / height * 2 - 1;
  });
  hero.addEventListener('pointerleave', () => { targetX = targetY = 0; });
  button.addEventListener('click', () => { paused = !paused; sync(); });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
})();
