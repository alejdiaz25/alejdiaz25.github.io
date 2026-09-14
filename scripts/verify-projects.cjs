const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createServer } = require('./serve');

const root = path.resolve(__dirname, '..');
const projects = JSON.parse(fs.readFileSync(path.join(root, 'projects.json'), 'utf8')).projects;
const server = createServer();

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${base}/projects.html?project=rcs-3dof`, { waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('h1', el => el.textContent.trim()), projects[0].title, 'The deep link should produce a meaningful project heading');
    for (const project of projects) {
      await page.goto(`${base}/projects.html?project=${project.id}`, { waitUntil: 'networkidle0' });
      assert.equal(await page.$eval('h1', el => el.textContent.trim()), project.title);
      const text = await page.$eval('main', el => el.textContent);
      assert.ok(text.includes(project.description), `Complete description: ${project.id}`);
      for (const spec of project.specs) assert.ok(text.includes(spec.val), `Specification ${spec.key}: ${project.id}`);
      assert.equal(await page.$$eval('.media-option', els => els.length), project.models.length + project.gallery.length + 1, `All model/image selectors: ${project.id}`);
    }
    await page.goto(`${base}/projects.html?project=frc-2022-robot`, { waitUntil: 'networkidle0' });
    await page.click('#enlarge-image');
    assert.equal(await page.$eval('#image-lightbox', el => el.open), true);
    const firstSrc = await page.$eval('#lightbox-image', el => el.src);
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await page.$eval('#lightbox-image', el => el.src), firstSrc, 'Lightbox keyboard navigation changes image');
    await page.keyboard.press('Escape');
    assert.equal(await page.$eval('#image-lightbox', el => el.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'enlarge-image', 'Lightbox restores focus');
    await page.click('#project-index > summary');
    await page.focus('[data-project-id="rc-car"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('h1').textContent === 'RC Race Car');
    assert.ok(page.url().includes('project=rc-car'));
    await page.goBack();
    await page.waitForFunction(() => document.querySelector('h1').textContent === '2022 Robot + Shooter');
    for (const width of [320, 375, 768, 1024, 1920]) {
      await page.setViewport({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No horizontal overflow at ${width}px`);
    }
    assert.deepEqual(errors, [], 'No browser JavaScript errors');
    console.log(`PASS: ${projects.length} project deep links, complete data, media selectors, keyboard selection, lightbox, history, and responsive overflow.`);
    if (process.argv.includes('--models')) {
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(`${base}/projects.html?project=frc-2022-robot`, { waitUntil: 'networkidle0' });
      for (const [index, src] of [[1, 'assets/models/val2022.glb'], [2, 'assets/models/val2022-Shooter.glb']]) {
        await page.click(`.media-option:nth-child(${index + 1})`);
        await page.click('#load-model');
        await page.waitForFunction(source => ModelViewer.isLoaded() && ModelViewer.currentSrc() === source, { timeout: 90000 }, src);
        assert.equal(await page.$eval('#model-prompt', el => el.hidden), true);
        assert.equal(await page.$eval('#three-stage', el => getComputedStyle(el).visibility), 'visible');
        const canvas = await page.$('#three-stage');
        const bounds = await canvas.boundingBox();
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2 + 30, { steps: 10 });
        await page.mouse.up();
        await page.waitForSelector('.viewer-reset-btn.visible');
        await page.click('.viewer-reset-btn');
        await page.click('.media-option:first-child');
        assert.equal(await page.$eval('#three-stage', el => getComputedStyle(el).visibility), 'hidden');
      }
      assert.deepEqual(errors, [], 'No errors while loading or interacting with models');
      console.log('PASS: both 2022 robot models load, rotate, reset, switch, and hide on image selection.');
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
