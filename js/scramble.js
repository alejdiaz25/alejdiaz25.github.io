class ScrambleText {
  constructor(el, options = {}) {
    this.el        = el;
    this.duration  = options.duration  || 800;
    this.delay     = options.delay     || 0;
    this.fromEmpty = options.fromEmpty || false;
    /* contained (default true): locks width + nowrap + overflow for inline/
       proportional elements to prevent sibling jitter. Set false for block-
       level mono elements in fixed-width containers — they don't need it and
       the BFC created by overflow:hidden can cause scroll geometry reflow. */
    this.contained = options.contained !== false;
    this.chars     = 'abcdefghijklmnoprstuvxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    this.frame     = null;
    this.running   = false;
    if (!el.dataset.scrambleOriginal) {
      el.dataset.scrambleOriginal = el.textContent.trim();
    }
    this.original = el.dataset.scrambleOriginal;
  }

  run() {
    if (this.running) return;
    this.running = true;
    cancelAnimationFrame(this.frame);

    const el        = this.el;
    const original  = this.original;
    const chars     = this.chars;
    const duration  = this.duration;
    const delay     = this.delay;
    const fromEmpty = this.fromEmpty;
    const contained = this.contained;

    const lockDims = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (contained) {
        /* Full box lock for inline/proportional elements — prevents width
           variance of random chars from shifting siblings */
        if (w > 0) el.style.width = w + 'px';
        el.style.whiteSpace = 'nowrap';
        el.style.overflow   = 'hidden';
      }
      /* minHeight always — prevents collapse when animated content is shorter */
      if (h > 0) el.style.minHeight = h + 'px';
    };

    const releaseDims = () => {
      if (contained) {
        el.style.width      = '';
        el.style.whiteSpace = '';
        el.style.overflow   = '';
      }
      el.style.minHeight = '';
    };

    if (fromEmpty) {
      lockDims();
      el.style.opacity = '0';
    }

    const startTime = performance.now() + delay;
    let locked = false;

    const tick = (now) => {
      if (now < startTime) { this.frame = requestAnimationFrame(tick); return; }

      if (!locked) {
        locked = true;
        el.style.opacity = '1';
        if (!fromEmpty) lockDims();
      }

      const elapsed   = now - startTime;
      const progress  = Math.min(elapsed / duration, 1);
      const cursorPos = Math.floor(progress * original.length);

      let display = '';
      for (let i = 0; i < original.length; i++) {
        const ch        = original[i];
        const isSpecial = ' \u2014\u2013\u00b7|./()[]'.includes(ch);

        if (i < cursorPos) {
          display += ch;
        } else if (i === cursorPos) {
          display += isSpecial ? ch : chars[Math.floor(Math.random() * chars.length)];
        } else {
          display += fromEmpty
            ? '\u00A0'
            : isSpecial ? ch : chars[Math.floor(Math.random() * chars.length)];
        }
      }
      el.textContent = display;

      if (progress < 1) {
        this.frame = requestAnimationFrame(tick);
      } else {
        el.textContent = original;
        releaseDims();
        this.running = false;
      }
    };

    this.frame = requestAnimationFrame(tick);
  }
}
