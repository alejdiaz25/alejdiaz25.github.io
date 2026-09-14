#!/usr/bin/env node
'use strict';

// Run with `node scripts/verify-portfolio.js`; add --screenshots for .tmp captures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { createServer } = require('./serve');

const ROOT = path.resolve(__dirname, '..');
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const projectData = JSON.parse(fs.readFileSync(path.join(ROOT, 'projects.json'), 'utf8'));
const widths = [1920, 1440, 1024, 768, 390, 320];
const screenshots = process.argv.includes('--screenshots');
const homepageOnly = process.argv.includes('--home-only');
const localPaths = new Set();
const pageIds = new Map();
const localAnchors = [];

function rememberPath(value, base) {
  if (typeof value !== 'string' || !value || /^(?:data:|blob:|mailto:|tel:|javascript:|#)/i.test(value)) return;
  let url;
  try { url = new URL(value, base); } catch { return; }
  if (url.origin === new URL(base).origin) localPaths.add(url.pathname);
}

function findDataAssets(value, base) {
  if (typeof value === 'string' && /^(?:images\/|assets\/|resume\.pdf|projects\.html|index\.html)/.test(value)) rememberPath(value, base);
  else if (Array.isArray(value)) value.forEach(item => findDataAssets(item, base));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => findDataAssets(item, base));
}

async function normalizedText(page, selector) {
  return page.$eval(selector, node => node.textContent.replace(/\s+/g, ' ').trim());
}

async function assertHomeContent(page) {
  const sectionIds = ['about', 'projects-preview', 'experience', 'coursework', 'skills', 'contact'];
  for (const id of sectionIds) assert.equal(await page.$$eval(`#${id}`, nodes => nodes.length), 1, `Homepage has one ${id} section`);

  const plain = values => page.evaluate(items => items.map(value => {
    const node = document.createElement('div');
    node.innerHTML = value;
    return node.textContent.replace(/\s+/g, ' ').trim();
  }), values);

  const experience = await normalizedText(page, '#experience');
  const roles = [...content.experience.items, ...content.experience.relevantItems];
  const expectedCounts = {
    '#experience .exp-item': roles.length,
    '#experience .exp-bullets li': roles.reduce((count, role) => count + role.bullets.length, 0),
    '#coursework .course-row': content.coursework.courses.length,
    '#coursework .cw-project': content.coursework.academicProjects.length,
    '#skills .skill-group': content.skills.groups.length,
    '#skills .skill-group li': content.skills.groups.reduce((count, group) => count + group.tags.length, 0),
    '#about .ac-slide': content.about.photos.length,
    '#projects-preview .project-index-link': projectData.projects.length,
    '#projects-preview .work-feature': projectData.preview.featured.length,
  };
  for (const [selector, count] of Object.entries(expectedCounts)) {
    assert.equal(await page.$$eval(selector, nodes => nodes.length), count, `Preserved content count: ${selector}`);
  }
  for (const expected of await plain(roles.flatMap(item => [item.company, item.role, item.period]))) {
    assert.ok(experience.includes(expected), `Experience preserves ${expected}`);
  }
  for (const expected of await plain(roles.flatMap(item => item.bullets))) assert.ok(experience.includes(expected), `Experience bullet preserved: ${expected.slice(0, 70)}`);
  const about = await normalizedText(page, '#about');
  for (const expected of await plain(content.about.paragraphs)) assert.ok(about.includes(expected), `About paragraph preserved: ${expected.slice(0, 70)}`);
  const coursework = await normalizedText(page, '#coursework');
  for (const course of content.coursework.courses) {
    assert.ok(coursework.includes(course.code) && coursework.includes(course.name), `Course preserved: ${course.code}`);
  }
  for (const project of content.coursework.academicProjects) assert.ok(coursework.includes(project.name), `Academic project preserved: ${project.name}`);
  const skills = await normalizedText(page, '#skills');
  for (const group of content.skills.groups) {
    assert.ok(skills.includes(group.label), `Skill group preserved: ${group.label}`);
    for (const tag of group.tags) assert.ok(skills.includes(tag), `Skill preserved: ${tag}`);
  }
  assert.ok(skills.includes(content.skills.subtitle), 'Language skill preserved');

  const contactHrefs = await page.$$eval('#contact a[href]', nodes => nodes.map(node => node.getAttribute('href')));
  for (const link of content.contact.links.filter(link => link.href)) assert.ok(contactHrefs.includes(link.href), `Contact link preserved: ${link.label}`);
  assert.ok(contactHrefs.includes(content.contact.resumeHref), 'Resume link preserved');
  const links = await page.$$eval('#projects-preview a[href]', nodes => nodes.map(node => node.getAttribute('href')));
  assert.ok(links.some(href => href.startsWith('projects.html')), 'Selected work links to project case studies');
  for (const project of projectData.projects) assert.ok(links.some(href => new URL(href, page.url()).searchParams.get('project') === project.id), `Homepage project deep link preserved: ${project.id}`);
  await page.click('.ac-next');
  assert.equal(await page.$eval('.ac-count', node => node.textContent.trim()), `02 / ${String(content.about.photos.length).padStart(2, '0')}`, 'About carousel advances');
  await page.focus('.about-carousel');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.$eval('.ac-count', node => node.textContent.trim()), `01 / ${String(content.about.photos.length).padStart(2, '0')}`, 'About carousel supports keyboard navigation');
  await page.evaluate(() => window.scrollTo(0, 0));
  return `${roles.length} roles, ${content.coursework.courses.length} courses, ${content.coursework.academicProjects.length} academic projects, ${content.skills.groups.length} skill groups`;
}

async function assertNavigation(page, label) {
  const toggle = await page.$('.nav-toggle');
  assert.ok(toggle, `${label}: navigation toggle exists`);
  const visible = await toggle.isVisible();
  if (!visible) return;
  await toggle.click();
  assert.equal(await toggle.evaluate(node => node.getAttribute('aria-expanded')), 'true', `${label}: menu opens`);
  const navId = await toggle.evaluate(node => node.getAttribute('aria-controls'));
  assert.ok(navId, `${label}: menu has an accessible relationship`);
  const visibleLinks = await page.$$eval(`#${navId} a`, nodes => nodes.filter(node => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
  }).length);
  assert.ok(visibleLinks >= 4, `${label}: navigation links are available`);
  await page.keyboard.press('Escape');
  assert.equal(await toggle.evaluate(node => node.getAttribute('aria-expanded')), 'false', `${label}: Escape closes menu`);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('nav-toggle')), true, `${label}: Escape restores toggle focus`);
}

async function main() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  const errors = [];
  let homeSummary;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(base)) {
        rememberPath(response.url(), base);
        if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) errors.push(`${response.status()} ${response.url()}`);
      }
    });
    if (screenshots) fs.mkdirSync(path.join(ROOT, '.tmp'), { recursive: true });
    for (const filename of homepageOnly ? ['index.html'] : ['index.html', 'projects.html']) {
      for (const width of widths) {
        const label = `${filename} at ${width}px`;
        await page.setViewport({ width, height: width < 768 ? 844 : 1000, deviceScaleFactor: 1 });
        await page.goto(new URL(filename, base).href, { waitUntil: 'networkidle0' });
        await page.waitForFunction(() => document.querySelector('#experience-content')?.textContent.trim() || document.querySelector('#project-title')?.textContent.trim());
        await page.evaluate(() => document.fonts.ready);
        const fontState = await page.evaluate(() => ({
          registered: [...document.fonts].map(font => ({ family: font.family.replaceAll('"', ''), status: font.status })),
          body: getComputedStyle(document.body).fontFamily,
        }));
        for (const family of ['Instrument Sans', 'Azeret Mono']) {
          assert.ok(fontState.registered.some(font => font.family === family && font.status === 'loaded'), `${label}: ${family} font is loaded`);
        }
        assert.ok(fontState.registered.every(font => ['Instrument Sans', 'Azeret Mono'].includes(font.family)), `${label}: only the two specified font families are registered`);
        assert.ok(fontState.body.includes('Instrument Sans'), `${label}: primary typography uses Instrument Sans`);
        const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        assert.ok(dimensions.document <= dimensions.width && dimensions.body <= dimensions.width, `${label}: no horizontal overflow (${JSON.stringify(dimensions)})`);
        assert.equal(await page.$$eval('h1', nodes => nodes.length), 1, `${label}: one primary heading`);
        await assertNavigation(page, label);
        if (filename === 'index.html' && width === 1440) homeSummary = await assertHomeContent(page);
        if (filename === 'projects.html' && width === 1440) {
          const ids = await page.$$eval('[data-project-id]', nodes => nodes.map(node => node.dataset.projectId));
          for (const project of projectData.projects) assert.ok(ids.includes(project.id), `Project index preserves ${project.id}`);
        }
        const urls = await page.$$eval('[src], [href], [poster], [srcset]', nodes => nodes.flatMap(node => [node.getAttribute('src'), node.getAttribute('href'), node.getAttribute('poster'), ...(node.getAttribute('srcset') || '').split(',').map(item => item.trim().split(/\s+/)[0])]).filter(Boolean));
        urls.forEach(url => rememberPath(url, new URL(filename, base)));
        if (width === 1440) {
          pageIds.set(`/${filename}`, await page.$$eval('[id]', nodes => nodes.map(node => node.id)));
          const hrefs = await page.$$eval('a[href]', nodes => nodes.map(node => node.getAttribute('href')));
          for (const href of hrefs) {
            const url = new URL(href, new URL(filename, base));
            if (url.origin === new URL(base).origin && url.hash.length > 1) localAnchors.push(url);
          }
        }
        const brokenImages = await page.$$eval('img', nodes => nodes.filter(node => node.getAttribute('src')?.trim() && node.complete && !node.naturalWidth).map(node => node.getAttribute('src')));
        assert.deepEqual(brokenImages, [], `${label}: loaded images are valid`);
        if (screenshots) {
          await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
          await page.screenshot({ path: path.join(ROOT, '.tmp', `${filename.replace('.html', '')}-${width}.png`) });
          if (width === 1440 || width === 390) {
            await page.evaluate(async () => {
              for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight) {
                window.scrollTo(0, top);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
              }
              await Promise.race([
                Promise.all([...document.images].filter(img => !img.closest('[hidden]')).map(img => img.decode().catch(() => {}))),
                new Promise(resolve => setTimeout(resolve, 2000)),
              ]);
              window.scrollTo(0, 0);
            });
            await page.screenshot({ path: path.join(ROOT, '.tmp', `${filename.replace('.html', '')}-${width}-full.png`), fullPage: true });
          }
        }
        console.log(`PASS ${label}: fonts, layout, heading, navigation, images`);
      }
    }
    findDataAssets(content, base);
    findDataAssets(projectData, base);
    for (const filename of fs.readdirSync(path.join(ROOT, 'css')).filter(filename => filename.endsWith('.css'))) {
      const css = fs.readFileSync(path.join(ROOT, 'css', filename), 'utf8');
      for (const match of css.matchAll(/url\(\s*['"]?([^\s'"()]+)['"]?\s*\)/g)) rememberPath(match[1], new URL(`css/${filename}`, base));
    }
    localPaths.delete('/favicon.ico');
    for (const url of localAnchors) {
      const ids = pageIds.get(url.pathname);
      if (ids) assert.ok(ids.includes(decodeURIComponent(url.hash.slice(1))), `Local anchor exists: ${url.pathname}${url.hash}`);
    }
    for (const pathname of localPaths) {
      const response = await fetch(new URL(pathname, base), { method: 'HEAD' });
      assert.ok(response.ok, `Local resource exists: ${pathname} (${response.status})`);
    }
    assert.deepEqual(errors, [], 'No JavaScript errors or failed local requests');
    console.log(`PASS content preservation: ${homeSummary}; ${projectData.projects.length} projects; ${localPaths.size} local resources.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
