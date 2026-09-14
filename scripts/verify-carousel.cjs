const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const { createServer } = require('./serve');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'networkidle0' });
    assert.ok(await page.$('#work-autoplay'), 'Automatic scrolling has a pause control');
    assert.equal(await page.$eval('#work-heading', el => el.textContent), 'Engineering Projects');
    assert.ok(await page.$$eval('.work-card, .work-card-media', nodes => nodes.every(el => getComputedStyle(el).backgroundColor === 'rgb(0, 0, 0)')), 'Project cards match the black background');
    const position = () => page.$eval('#work-track', el => el.scrollLeft);
    await new Promise(resolve => setTimeout(resolve, 7200));
    assert.equal(await position(), 0, 'No auto-advance before carousel enters viewport');
    await page.evaluate(() => document.querySelector('.work-carousel').scrollIntoView({ behavior: 'instant' }));
    await page.mouse.move(1, 1);
    await page.waitForFunction(() => document.getElementById('work-track').scrollLeft > 100, { timeout: 5500 });
    await page.click('#work-autoplay');
    await page.mouse.move(1, 1);
    await page.evaluate(() => document.activeElement.blur());
    await new Promise(resolve => setTimeout(resolve, 1000));
    const paused = await position();
    await new Promise(resolve => setTimeout(resolve, 7200));
    assert.equal(await position(), paused, 'Explicit pause stops auto-advance');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.waitForFunction(() => document.getElementById('work-autoplay').disabled);
    assert.equal(await page.$eval('#work-autoplay', el => el.disabled), true, 'Reduced motion disables auto-play');
    const packed = await page.$$eval('.skill-group ul', lists => lists.every(list => {
      const items = [...list.children];
      return items.some((item, i) => i && item.offsetTop === items[i - 1].offsetTop);
    }));
    assert.ok(packed, 'Every skills group packs multiple items on a row');
    console.log('PASS: viewport-gated auto-advance, explicit pause, reduced motion, and packed skills.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
