const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { createServer } = require('./serve');

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 900 });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base, { waitUntil: 'networkidle0' });
    const pixels = async () => require('node:crypto').createHash('sha256').update(await page.$eval('#hero-cloud', canvas => canvas.toDataURL())).digest('hex');
    const wait = () => new Promise(resolve => setTimeout(resolve, 200));
    const first = await pixels();
    await wait();
    assert.notEqual(await pixels(), first, 'Visible terrain animates');
    await page.click('#hero-motion');
    const paused = await pixels();
    await wait();
    assert.equal(await pixels(), paused, 'Pause freezes the terrain');
    await page.click('#hero-motion');
    await page.evaluate(() => document.getElementById('skills').scrollIntoView({ behavior: 'instant' }));
    await wait();
    const offscreen = await pixels();
    await wait();
    assert.equal(await pixels(), offscreen, 'Offscreen terrain stops rendering');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await wait();
    const reduced = await pixels();
    await wait();
    assert.equal(await pixels(), reduced, 'Reduced motion is static');
    assert.equal(await page.$eval('#hero-motion', el => el.hidden), true);
    assert.equal(await page.$$eval('#hero img', nodes => nodes.length), 0);
    for (const route of ['/', '/projects.html']) {
      await page.goto(base + route, { waitUntil: 'networkidle0' });
      for (const width of [1920, 1440, 1024, 768]) {
        await page.setViewport({ width, height: 900 });
        const nav = await page.$eval('.nav-links', el => {
          const box = el.getBoundingClientRect();
          const logo = document.querySelector('.nav-logo').getBoundingClientRect();
          return { center: box.x + box.width / 2, viewport: document.documentElement.clientWidth / 2, overlap: box.left < logo.right, numbered: !!el.querySelector('.nav-number') };
        });
        assert.ok(Math.abs(nav.center - nav.viewport) < 1, 'Desktop navigation is centered');
        assert.equal(nav.overlap, false, 'Navigation clears the logo');
        assert.equal(nav.numbered, false, 'Navigation numbers removed');
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: animated terrain, pause/resume, offscreen suspension, reduced motion, image removal, and centered navigation on both pages.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

