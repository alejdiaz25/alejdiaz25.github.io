/* ──────────────────────────────────────────────────────────
   hero-bg.js — Optimized dot terrain with stamped circles,
   baked Perlin noise, alpha-bucketed rendering, sine LUT,
   and idle burst animations. No connection lines.
────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── CONFIG ────────────────────────────────────────────── */
  var WAVE1_AMP = 55;
  var WAVE1_FREQ = 0.006;
  var WAVE1_SPEED = 0.00035;
  var WAVE2_AMP = 28;
  var WAVE2_FREQ = 0.012;
  var WAVE2_SPEED = 0.0006;
  var WAVE2_PHASE = 1.2;

  /* 3D Camera — low, far back, shallow angle with yaw rotation */
  var CAM_FOV = 58;
  var CAM_PX = -200, CAM_PY = 220,  CAM_PZ = 420;
  var CAM_TX = 180,  CAM_TY = -40,  CAM_TZ = -600;
  var REF_DEPTH = 900;

  /* Grid on XZ ground plane (Y = 0 at rest, wave displaces Y) */
  var GRID_COLS = 55, GRID_ROWS = 65;
  var GRID_Z_MIN = -3000, GRID_Z_MAX = 350;

  /* Particles */
  var DOT_PEAK = 3.0;
  var DOT_VALLEY = 1.2;

  /* Alpha buckets — 4 levels */
  var ALPHA_BUCKETS = [0.12, 0.28, 0.55, 0.85];

  /* Ripple */
  var RIPPLE_AMP = 16;
  var RIPPLE_RADIUS = 160;
  var RIPPLE_SPEED = 3;
  var RIPPLE_DECAY = 1.2;
  var RIPPLE_THROTTLE = 60;
  var RIPPLE_MAX = 5;

  /* Idle burst */
  var IDLE_MIN = 8000;
  var IDLE_MAX = 12000;
  var BURST_RADIUS = 200;
  var BURST_AMP = 55;
  var BURST_DECAY = 4.5;
  var BURST_SPEED = 1.0;

  /* ── STATE ─────────────────────────────────────────────── */
  var canvas, ctx;
  var W, H, dpr;
  var dotCount = 0;

  /* 3D camera basis vectors (set by setupCamera) */
  var camRX, camRY, camRZ;   // right
  var camUX, camUY, camUZ;   // up
  var camFX, camFY, camFZ;   // forward (into screen)
  var fovScaleV;              // H / (2 * tan(halfFOV))

  /* Flat typed arrays — world coords, rest-screen coords, noise */
  var baseBX, baseBZ;         // world X, Z on ground plane
  var baseSX, baseSY;         // rest screen position (y=0) for ripple/burst distance
  var baseScale;              // REF_DEPTH / restCameraZ — perspective dot scaling
  var noiseOff;               // baked simplex noise

  /* Per-frame projected data */
  var projSX, projSY, projH, projSize;

  /* Bucket draw lists — 5 color tiers × 4 alpha levels = 20 buckets */
  var bucketLists = [];
  (function () { for (var i = 0; i < 20; i++) bucketLists.push([]); })();

  var ripples = [];
  var lastRippleTime = 0;
  var animId = null;
  var isVisible = true;

  /* Mouse smoothing — eliminates jitter at slow move speeds */
  var smoothMouseX = -9999, smoothMouseY = -9999;
  var lastRippleX = -9999, lastRippleY = -9999;
  var MOUSE_SMOOTH = 0.15;     // EMA factor (lower = smoother, 0.15 = ~6 frame lag)
  var RIPPLE_MIN_DIST_SQ = 36 * 36;  // min 36px between ripple spawns

  /* Idle burst state */
  var lastInteraction = 0;
  var nextBurstTime = 0;
  var activeBurst = null;

  /* Stamped circle sprites — 5 color tiers × 8 sizes */
  var NUM_COLOR_TIERS = 5;
  var TIER_COLORS = [
    [55,  52, 48],    // deep valley — cool ash
    [95,  88, 72],    // valley — muted khaki
    [148, 128, 82],   // mid — desaturated bronze
    [185, 158, 95],   // mid-peak — warm sand
    [210, 182, 120]   // peak — pale gold
  ];
  var colorSprites = [];    // flat: [tier * SPRITE_STEPS + sizeIdx]
  var SPRITE_STEPS = 8;
  var SPRITE_BASE = 0.4;
  var SPRITE_INC = 0.35;
  var NUM_BUCKETS = NUM_COLOR_TIERS * 4;  // 5 colors × 4 alphas = 20

  /* Sine LUT */
  var SIN_LUT_SIZE = 1024;
  var SIN_LUT = new Float32Array(SIN_LUT_SIZE);
  var SIN_SCALE = SIN_LUT_SIZE / (Math.PI * 2);

  /* ── HELPERS ───────────────────────────────────────────── */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

  function fastSin(x) {
    /* Wrap x into [0, 2PI) range then LUT lookup with linear interp */
    x = x % 6.2831853;
    if (x < 0) x += 6.2831853;
    var fi = x * SIN_SCALE;
    var i = fi | 0;
    var frac = fi - i;
    var a = SIN_LUT[i];
    var b = SIN_LUT[(i + 1) & (SIN_LUT_SIZE - 1)];
    return a + (b - a) * frac;
  }

  /* ── SIMPLEX 2D NOISE ─────────────────────────────────── */
  var _grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  var _perm = new Uint8Array(512);

  function initNoise() {
    var p = new Uint8Array(256);
    for (var i = 0; i < 256; i++) p[i] = i;
    /* Fisher-Yates with seeded random (simple LCG, seed=42) */
    var seed = 42;
    for (var i = 255; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
      var j = ((seed >>> 0) % (i + 1));
      var tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (var i = 0; i < 512; i++) _perm[i] = p[i & 255];
  }

  var F2 = 0.5 * (Math.sqrt(3) - 1);
  var G2 = (3 - Math.sqrt(3)) / 6;

  function simplex2(x, y) {
    var s = (x + y) * F2;
    var i = Math.floor(x + s);
    var j = Math.floor(y + s);
    var t = (i + j) * G2;
    var X0 = i - t, Y0 = j - t;
    var x0 = x - X0, y0 = y - Y0;
    var i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    var ii = i & 255, jj = j & 255;
    var n0 = 0, n1 = 0, n2 = 0;
    var t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      var gi = _perm[ii + _perm[jj]] & 7;
      n0 = t0 * t0 * (_grad2[gi][0] * x0 + _grad2[gi][1] * y0);
    }
    var t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      var gi = _perm[ii + i1 + _perm[jj + j1]] & 7;
      n1 = t1 * t1 * (_grad2[gi][0] * x1 + _grad2[gi][1] * y1);
    }
    var t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      var gi = _perm[ii + 1 + _perm[jj + 1]] & 7;
      n2 = t2 * t2 * (_grad2[gi][0] * x2 + _grad2[gi][1] * y2);
    }
    return 70 * (n0 + n1 + n2); // range ~[-1, 1]
  }

  /* ── INIT SINE LUT ─────────────────────────────────────── */
  function initSinLUT() {
    for (var i = 0; i < SIN_LUT_SIZE; i++) {
      SIN_LUT[i] = Math.sin((i / SIN_LUT_SIZE) * Math.PI * 2);
    }
  }

  /* ── CIRCLE SPRITES ────────────────────────────────────── */
  function buildSprites() {
    colorSprites.length = 0;
    for (var tier = 0; tier < NUM_COLOR_TIERS; tier++) {
      var col = TIER_COLORS[tier];
      var cs = col[0] + ',' + col[1] + ',' + col[2];
      for (var si = 0; si < SPRITE_STEPS; si++) {
        var r = SPRITE_BASE + si * SPRITE_INC;
        var size = Math.ceil((r + 1) * 2);
        var c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        var cx = c.getContext('2d');
        var center = size / 2;
        var grad = cx.createRadialGradient(center, center, 0, center, center, r * 0.7);
        grad.addColorStop(0, 'rgba(' + cs + ',1)');
        grad.addColorStop(0.7, 'rgba(' + cs + ',0.9)');
        grad.addColorStop(1, 'rgba(' + cs + ',0)');
        cx.fillStyle = grad;
        cx.fillRect(0, 0, size, size);
        colorSprites.push({ canvas: c, half: size / 2 });
      }
    }
  }

  function spriteIndex(size) {
    var idx = Math.round((size - SPRITE_BASE) / SPRITE_INC);
    if (idx < 0) idx = 0;
    if (idx >= SPRITE_STEPS) idx = SPRITE_STEPS - 1;
    return idx;
  }

  /* ── 3D CAMERA SETUP ───────────────────────────────────── */
  function setupCamera() {
    /* Forward = normalize(target − position) */
    var dx = CAM_TX - CAM_PX, dy = CAM_TY - CAM_PY, dz = CAM_TZ - CAM_PZ;
    var dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    camFX = dx / dl; camFY = dy / dl; camFZ = dz / dl;

    /* Right = normalize(cross(forward, worldUp(0,1,0))) = normalize(−Fz, 0, Fx) */
    var rl = Math.sqrt(camFZ * camFZ + camFX * camFX);
    camRX = -camFZ / rl; camRY = 0; camRZ = camFX / rl;

    /* Up = cross(right, forward) */
    camUX = camRY * camFZ - camRZ * camFY;
    camUY = camRZ * camFX - camRX * camFZ;
    camUZ = camRX * camFY - camRY * camFX;


    /* Vertical FOV projection scale */
    fovScaleV = H / (2 * Math.tan(CAM_FOV * 0.5 * Math.PI / 180));
  }

  /* Project a world point to screen. Returns cz (camera-space depth). */
  function project(wx, wy, wz, out) {
    var dx = wx - CAM_PX, dy = wy - CAM_PY, dz = wz - CAM_PZ;
    var cz = camFX * dx + camFY * dy + camFZ * dz;
    if (cz < 1) { out[0] = -9999; out[1] = -9999; return cz; }
    var invZ = 1 / cz;
    out[0] = W * 0.5 + (camRX * dx + camRY * dy + camRZ * dz) * fovScaleV * invZ;
    out[1] = H * 0.5 - (camUX * dx + camUY * dy + camUZ * dz) * fovScaleV * invZ;
    return cz;
  }

  /* ── BUILD GRID ────────────────────────────────────────── */
  function buildGrid() {
    setupCamera();

    var zStep = (GRID_Z_MAX - GRID_Z_MIN) / (GRID_ROWS - 1);
    var halfFovH = CAM_FOV * 0.5 * Math.PI / 180;
    var aspectW = W / H;
    var tmp = [0, 0]; // reusable projection output

    /* Generate grid — frustum-centered columns for yawed camera */
    var pts = []; // flat: [worldX, worldZ, ...]
    for (var row = 0; row < GRID_ROWS; row++) {
      var z = GRID_Z_MIN + row * zStep;

      /* Camera-space Z for a point at (0, 0, z) on ground plane */
      var dxC = -CAM_PX, dzC = z - CAM_PZ;
      var czRest = camFX * dxC + camFY * (-CAM_PY) + camFZ * dzC;
      if (czRest < 5) continue;

      /* Frustum center X: project camera right vector to find where the
         optical axis intersects this row's Z plane in world X */
      var centerX = CAM_PX + (camFX / camFZ) * (z - CAM_PZ);

      /* Visible half-width in world X at this depth */
      var halfX = Math.tan(halfFovH) * czRest * aspectW * 2.0;

      var xStep = 2 * halfX / GRID_COLS;
      var xStart = centerX - halfX + ((row & 1) ? xStep * 0.5 : 0);

      for (var col = 0; col < GRID_COLS; col++) {
        pts.push(xStart + col * xStep, z);
      }
    }

    dotCount = Math.min(pts.length / 2, 3500);

    /* Allocate typed arrays */
    baseBX    = new Float32Array(dotCount);
    baseBZ    = new Float32Array(dotCount);
    baseSX    = new Float32Array(dotCount);
    baseSY    = new Float32Array(dotCount);
    baseScale = new Float32Array(dotCount);
    noiseOff  = new Float32Array(dotCount);

    projSX    = new Float32Array(dotCount);
    projSY    = new Float32Array(dotCount);
    projH     = new Float32Array(dotCount);
    projSize  = new Float32Array(dotCount);

    for (var i = 0; i < dotCount; i++) {
      var wx = pts[i * 2];
      var wz = pts[i * 2 + 1];
      baseBX[i] = wx;
      baseBZ[i] = wz;

      /* Project rest position (y=0) for ripple/burst screen-space distance */
      var cz = project(wx, 0, wz, tmp);
      baseSX[i] = tmp[0];
      baseSY[i] = tmp[1];
      baseScale[i] = (cz > 1) ? REF_DEPTH / cz : 0.01;

      noiseOff[i] = simplex2(wx * 0.003, wz * 0.003) * 15;
    }
  }

  /* ── WAVE HEIGHT (world XZ coords) — asymmetric crest + spatial envelope ── */
  function waveHeight(x, z, time, noise) {
    var raw = fastSin(x * WAVE1_FREQ + time * WAVE1_SPEED)
            + fastSin(z * WAVE2_FREQ + time * WAVE2_SPEED + WAVE2_PHASE) * 0.5;
    /* Asymmetric shaping — sharper crests, softer valleys */
    var shaped = raw > 0 ? (0.6 * raw + 0.4 * raw * raw) : raw * 0.5;
    var h = shaped * WAVE1_AMP;
    /* Spatial envelope: gently attenuate near far edges of grid */
    var envZ = clamp01(1 - Math.abs(z - (GRID_Z_MIN + GRID_Z_MAX) * 0.5) / ((GRID_Z_MAX - GRID_Z_MIN) * 0.52));
    h *= 0.35 + 0.65 * envZ;
    h += fastSin((x + z) * 0.005 + time * 0.0003) * 8;
    h += noise;
    return h;
  }

  /* ── IDLE BURST ────────────────────────────────────────── */
  function maybeSpawnBurst(time) {
    if (activeBurst !== null) {
      /* Check if current burst has expired */
      if ((time - activeBurst.birth) / 1000 > BURST_DECAY) {
        activeBurst = null;
      } else {
        return;
      }
    }
    if (time < nextBurstTime) return;
    /* Spawn burst at random screen position */
    activeBurst = {
      x: Math.random() * W,
      y: Math.random() * H,
      birth: time
    };
    nextBurstTime = time + IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
  }

  function burstContribution(i, time) {
    if (activeBurst === null) return 0;
    var age = (time - activeBurst.birth) / 1000;
    if (age > BURST_DECAY) return 0;
    var dx = baseSX[i] - activeBurst.x;
    var dy = baseSY[i] - activeBurst.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var wavefront = age * BURST_SPEED * 60;
    var delta = Math.abs(dist - wavefront);
    if (delta > BURST_RADIUS * 0.5) return 0;
    var envelope = 1 - (age / BURST_DECAY);
    envelope *= envelope;
    var spatial = 1 - delta / (BURST_RADIUS * 0.5);
    spatial *= spatial;
    return fastSin(dist * 0.018 - age * 3.5) * BURST_AMP * envelope * spatial;
  }

  /* ── UPDATE ────────────────────────────────────────────── */
  function updateProjected(time) {
    var hMin = 1e9, hMax = -1e9;
    var idleTime = time - lastInteraction;
    var doBurst = idleTime > IDLE_MIN;

    if (doBurst) maybeSpawnBurst(time);

    /* Temp array for project() output */
    var _p = [0, 0];

    /* First pass: wave height + ripple + burst → 3D project to screen */
    for (var i = 0; i < dotCount; i++) {
      var h = waveHeight(baseBX[i], baseBZ[i], time, noiseOff[i]);

      /* Ripple contributions (screen-space distance from rest position) */
      for (var r = 0; r < ripples.length; r++) {
        var rp = ripples[r];
        var age = (time - rp.birth) / 1000;
        if (age > RIPPLE_DECAY) continue;
        var dx = baseSX[i] - rp.x;
        var dy = baseSY[i] - rp.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var wavefront = age * RIPPLE_SPEED * 60;
        var delta = Math.abs(dist - wavefront);
        if (delta < RIPPLE_RADIUS * 0.5) {
          var envelope = 1 - (age / RIPPLE_DECAY);
          envelope *= envelope;
          var spatial = 1 - delta / (RIPPLE_RADIUS * 0.5);
          spatial *= spatial;
          h += fastSin(dist * 0.02 - age * 6) * RIPPLE_AMP * envelope * spatial;
        }
      }

      /* Burst contribution */
      if (doBurst) h += burstContribution(i, time);

      /* Project world position (worldX, waveHeight, worldZ) through 3D camera */
      project(baseBX[i], h, baseBZ[i], _p);
      projSX[i] = _p[0];
      projSY[i] = _p[1];
      projH[i] = h;
      if (h < hMin) hMin = h;
      if (h > hMax) hMax = h;
    }

    /* Prune dead ripples */
    for (var r = ripples.length - 1; r >= 0; r--) {
      if ((time - ripples[r].birth) / 1000 > RIPPLE_DECAY) ripples.splice(r, 1);
    }

    /* Second pass: size + alpha + bucket assignment */
    var range = hMax - hMin || 1;
    var invRange = 1 / range;

    /* Clear bucket lists */
    for (var b = 0; b < NUM_BUCKETS; b++) bucketLists[b].length = 0;

    for (var i = 0; i < dotCount; i++) {
      /* Skip off-screen */
      if (projSX[i] < -5 || projSX[i] > W + 5 || projSY[i] < -5 || projSY[i] > H + 5) continue;

      var normH = clamp01((projH[i] - hMin) * invRange);

      /* Size */
      projSize[i] = lerp(DOT_VALLEY, DOT_PEAK, normH) * baseScale[i];

      /* Alpha from height — 3-segment curve: valleys visible, flats present, peaks bright */
      var a;
      if (normH < 0.25) {
        a = lerp(0.26, 0.18, normH / 0.25);
      } else if (normH < 0.55) {
        a = 0.18;
      } else {
        var t = (normH - 0.55) / 0.45;
        a = lerp(0.16, 0.85, t * t);
      }
      if (a < 0.01) continue;

      /* Color tier from wave height (0–4) */
      var colorTier = (normH * NUM_COLOR_TIERS) | 0;
      if (colorTier >= NUM_COLOR_TIERS) colorTier = NUM_COLOR_TIERS - 1;

      /* Shimmer: boost alpha + color tier near ripple wavefronts */
      var shimmer = 0;
      for (var r = 0; r < ripples.length; r++) {
        var rp = ripples[r];
        var age = (time - rp.birth) / 1000;
        if (age > RIPPLE_DECAY) continue;
        var dx = baseSX[i] - rp.x;
        var dy = baseSY[i] - rp.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var wavefront = age * RIPPLE_SPEED * 60;
        var delta = Math.abs(dist - wavefront);
        if (delta < RIPPLE_RADIUS * 0.4) {
          var envelope = 1 - (age / RIPPLE_DECAY);
          var spatial = 1 - delta / (RIPPLE_RADIUS * 0.4);
          var s = envelope * envelope * spatial * spatial;
          if (s > shimmer) shimmer = s;
        }
      }
      if (shimmer > 0) {
        a = a + (1 - a) * shimmer * 0.88;
        colorTier = Math.min(colorTier + ((shimmer * 4.5) | 0), NUM_COLOR_TIERS - 1);
      }

      /* Alpha bucket (quantize to nearest of 4 levels) */
      var alphaBucket = 0;
      var bestDist = Math.abs(a - ALPHA_BUCKETS[0]);
      for (var b = 1; b < 4; b++) {
        var d = Math.abs(a - ALPHA_BUCKETS[b]);
        if (d < bestDist) { bestDist = d; alphaBucket = b; }
      }

      bucketLists[colorTier * 4 + alphaBucket].push(i);
    }
  }

  /* ── DRAW ──────────────────────────────────────────────── */
  function draw() {
    ctx.clearRect(0, 0, W, H);

    /* Draw by color+alpha bucket — 20 buckets, minimizes state changes */
    for (var bucket = 0; bucket < NUM_BUCKETS; bucket++) {
      var list = bucketLists[bucket];
      if (list.length === 0) continue;
      var tier = (bucket / 4) | 0;
      var alphaIdx = bucket % 4;
      ctx.globalAlpha = ALPHA_BUCKETS[alphaIdx];
      var spriteBase = tier * SPRITE_STEPS;

      for (var k = 0; k < list.length; k++) {
        var i = list[k];
        var si = spriteIndex(projSize[i]);
        var sp = colorSprites[spriteBase + si];
        ctx.drawImage(sp.canvas, projSX[i] - sp.half, projSY[i] - sp.half);
      }
    }

    ctx.globalAlpha = 1;
  }

  /* ── ANIMATION LOOP ────────────────────────────────────── */
  function animate(time) {
    if (!isVisible) { animId = null; return; }
    animId = requestAnimationFrame(animate);

    updateProjected(time);
    draw();
  }

  /* ── EVENTS ────────────────────────────────────────────── */
  function resize() {
    dpr = Math.min(window.devicePixelRatio, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    smoothMouseX = -9999;
    smoothMouseY = -9999;
    lastRippleX = -9999;
    lastRippleY = -9999;
    buildGrid();  /* buildGrid calls setupCamera internally */
  }

  function spawnRipple(cx, cy) {
    var now = performance.now();
    if (now - lastRippleTime < RIPPLE_THROTTLE) return;
    if (ripples.length >= RIPPLE_MAX) ripples.shift();
    lastRippleTime = now;
    ripples.push({ x: cx, y: cy, birth: now });
  }

  function resetIdle() {
    lastInteraction = performance.now();
  }

  function onMouseMove(e) {
    resetIdle();
    var rect = canvas.getBoundingClientRect();
    var rawX = e.clientX - rect.left;
    var rawY = e.clientY - rect.top;

    /* EMA smoothing — damps high-frequency jitter on slow movements */
    if (smoothMouseX < -9000) {
      smoothMouseX = rawX;
      smoothMouseY = rawY;
    } else {
      smoothMouseX += (rawX - smoothMouseX) * MOUSE_SMOOTH;
      smoothMouseY += (rawY - smoothMouseY) * MOUSE_SMOOTH;
    }

    if (smoothMouseY >= 0 && smoothMouseY <= H) {
      /* Distance gate: only spawn ripple if mouse has traveled enough */
      var dx = smoothMouseX - lastRippleX;
      var dy = smoothMouseY - lastRippleY;
      if (dx * dx + dy * dy > RIPPLE_MIN_DIST_SQ) {
        spawnRipple(smoothMouseX, smoothMouseY);
        lastRippleX = smoothMouseX;
        lastRippleY = smoothMouseY;
      }
    }
  }

  function onTouchMove(e) {
    resetIdle();
    if (e.touches.length > 0) {
      var rect = canvas.getBoundingClientRect();
      var tx = e.touches[0].clientX - rect.left;
      var ty = e.touches[0].clientY - rect.top;
      spawnRipple(tx, ty);
    }
  }

  function onVisibility() {
    isVisible = !document.hidden;
    if (isVisible && !animId) animate(performance.now());
  }

  /* ── INIT ──────────────────────────────────────────────── */
  function init() {
    canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    initSinLUT();
    initNoise();
    buildSprites();

    lastInteraction = performance.now();
    nextBurstTime = lastInteraction + IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);

    resize();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    animate(performance.now());
  }

  window.initHeroBg = init;
})();
