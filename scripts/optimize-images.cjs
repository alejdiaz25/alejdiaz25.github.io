#!/usr/bin/env node
'use strict';

/**
 * Regenerate responsive portfolio images after changing source images or JSON:
 *   node scripts/optimize-images.cjs
 *
 * Requires the repository's existing `sharp` development dependency. Reads all
 * photo/CAD/wireframe image paths from content.json and projects.json, preserves
 * the originals, and writes WebP variants plus images/manifest.json. Small
 * images are never enlarged. Logos and vector assets are served as originals.
 */

const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'images', 'optimized');
const TARGET_WIDTHS = [640, 1280, 1920];
const HERO = 'images/wireframe-front-unsprung.webp';

function collectImages(value, paths) {
  if (typeof value === 'string') {
    if (/^images\/(?!logos\/).+\.(?:jpe?g|png|webp)$/i.test(value)) paths.add(value);
  } else if (Array.isArray(value)) {
    value.forEach(item => collectImages(item, paths));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectImages(item, paths));
  }
}

function normalizedStem(source) {
  return path.posix.parse(source).name.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
}

function sourcePath(source) {
  const absolute = path.resolve(ROOT, source);
  const relative = path.relative(ROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Image is outside the repository: ${source}`);
  }
  return absolute;
}

async function main() {
  const sources = new Set();
  for (const filename of ['content.json', 'projects.json']) {
    collectImages(JSON.parse(await fs.readFile(path.join(ROOT, filename), 'utf8')), sources);
  }
  const ordered = [...sources].sort((a, b) => {
    if (a === HERO) return -1;
    if (b === HERO) return 1;
    return a.localeCompare(b, 'en');
  });
  const stems = new Map();
  for (const source of ordered) {
    const stem = normalizedStem(source);
    stems.set(stem, (stems.get(stem) || 0) + 1);
  }

  await fs.mkdir(OUTPUT, { recursive: true });
  const manifest = {};
  const names = new Set();
  let originalBytes = 0;
  let derivativeBytes = 0;
  let defaultBytes = 0;
  let derivativeCount = 0;

  for (const source of ordered) {
    const input = sourcePath(source);
    const [metadata, stat] = await Promise.all([sharp(input).metadata(), fs.stat(input)]);
    const { width, height } = metadata.autoOrient;
    if (!width || !height) throw new Error(`Missing image dimensions: ${source}`);
    const stem = normalizedStem(source);
    const uniqueStem = stems.get(stem) > 1
      ? `${stem}-${createHash('sha256').update(source).digest('hex').slice(0, 8)}`
      : stem;
    const widths = [...new Set(TARGET_WIDTHS.map(target => Math.min(target, width)))];

    const variants = await Promise.all(widths.map(async target => {
      const filename = `${uniqueStem}-${target}.webp`;
      if (names.has(filename)) throw new Error(`Derivative name collision: ${filename}`);
      names.add(filename);
      const info = await sharp(input).autoOrient()
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: 83, effort: 5 })
        .toFile(path.join(OUTPUT, filename));
      if (info.width !== target || info.width > width || info.height > height) {
        throw new Error(`Unexpected derivative dimensions: ${filename}`);
      }
      return { src: `images/optimized/${filename}`, width: info.width, bytes: info.size };
    }));

    const fallback = variants.find(variant => variant.width === 1280) || variants.at(-1);
    manifest[source] = {
      src: fallback.src,
      srcset: variants.map(variant => `${variant.src} ${variant.width}w`).join(', '),
      width,
      height,
    };
    originalBytes += stat.size;
    derivativeBytes += variants.reduce((sum, variant) => sum + variant.bytes, 0);
    defaultBytes += fallback.bytes;
    derivativeCount += variants.length;
    if (source === HERO) {
      console.log(`Hero ready: ${fallback.src} (${fallback.bytes.toLocaleString('en')} bytes)`);
    }
  }

  const sortedManifest = Object.fromEntries(Object.entries(manifest)
    .sort(([a], [b]) => a.localeCompare(b, 'en')));
  await fs.writeFile(path.join(ROOT, 'images', 'manifest.json'),
    `${JSON.stringify(sortedManifest, null, 2)}\n`);
  console.log(JSON.stringify({
    originals: sources.size,
    derivatives: derivativeCount,
    originalBytes,
    derivativeBytes,
    defaultBytes,
    defaultReductionPercent: Number(((1 - defaultBytes / originalBytes) * 100).toFixed(1)),
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
