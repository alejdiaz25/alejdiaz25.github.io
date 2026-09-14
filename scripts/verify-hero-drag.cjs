const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve');

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    // Test-only snapshot of closure state, injected into the served script.
    // Production code exposes no test hooks.
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (!request.url().endsWith('/js/hero-cloud.js')) return request.continue();
      const source = fs.readFileSync(path.join(__dirname, '../js/hero-cloud.js'), 'utf8');
      return request.respond({ contentType: 'application/javascript', body: source.replace(/\}\)\(\);\s*$/, 'window.__cloudTest = () => ({ ripples: ripples.length, wake: wake.length, strengths: ripples.map(r => r.strength) });\n})();') });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    const dragging = () => page.$eval('#hero', el => el.classList.contains('cloud-dragging'));
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.mouse.click(850, 480);
    assert.equal(await page.evaluate(() => __cloudTest().ripples), 1, 'Single click creates exactly one ripple');
    assert.ok(await page.evaluate(() => __cloudTest().strengths.every(value => value <= .4)), 'Click disturbance is gentle');
    await page.mouse.move(850, 480);
    await page.mouse.down();
    await page.mouse.move(1000, 420, { steps: 15 });
    assert.equal(await dragging(), true, 'Desktop drag engages cloud pull');
    const active = await page.evaluate(() => __cloudTest());
    assert.ok(active.wake > 0, 'Movement produces a directional wake');
    assert.equal(active.ripples, 1, 'Dragging does not summon additional rings');
    await wait(500);
    assert.equal(await page.evaluate(() => __cloudTest().wake), active.wake, 'Holding still emits no wake samples');
    await page.mouse.up();
    assert.equal(await dragging(), false, 'Release clears drag state');
    assert.equal(await page.evaluate(() => __cloudTest().ripples), 1, 'Drag release creates no extra wave');
    await page.click('#hero-motion');
    await page.mouse.move(850, 480);
    await page.mouse.down();
    await page.mouse.move(1000, 420, { steps: 10 });
    assert.equal(await dragging(), false, 'Paused cloud ignores drag');
    await page.mouse.up();

    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(url, { waitUntil: 'networkidle0' });
    const client = await page.createCDPSession();
    async function touch(type, points) {
      await client.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
      await wait(25);
    }
    await touch('touchStart', [[100, 450]]);
    await touch('touchMove', [[104, 452]]);
    assert.equal(await dragging(), false, 'Small touch movement is ignored');
    for (let x = 120; x <= 260; x += 20) await touch('touchMove', [[x, 450]]);
    assert.equal(await dragging(), true, 'Horizontal touch engages pull');
    assert.equal(await page.evaluate(() => scrollY), 0, 'Horizontal pull does not scroll');
    await touch('touchEnd', []);
    assert.equal(await dragging(), false, 'Touch release clears drag');

    await touch('touchStart', [[190, 550]]);
    for (let y = 530; y >= 200; y -= 30) {
      await touch('touchMove', [[190, y]]);
      assert.equal(await dragging(), false, 'Vertical swipe never engages pull');
    }
    await touch('touchEnd', []);
    assert.ok(await page.evaluate(() => scrollY > 100), 'Vertical touch scrolls the page natively');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await wait(500);
    await touch('touchStart', [[100, 450]]);
    await touch('touchMove', [[150, 450]]);
    assert.equal(await dragging(), true);
    await touch('touchCancel', []);
    assert.equal(await dragging(), false, 'Touch cancellation releases the pull');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.waitForFunction(() => document.getElementById('hero-motion').hidden);
    await touch('touchStart', [[100, 450]]);
    await touch('touchMove', [[200, 450]]);
    assert.equal(await dragging(), false, 'Reduced motion ignores touch effects');
    await touch('touchEnd', []);
    assert.deepEqual(errors, []);
    console.log('PASS: desktop pull/release, paused state, touch intent threshold, horizontal pull, native vertical scrolling, cancellation, and reduced motion.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
