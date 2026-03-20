#!/usr/bin/env node
'use strict';

/*
 * generate-thumbnails.js
 * Renders GLB models using the same Three.js wireframe logic as viewer.js,
 * screenshots via Puppeteer, converts to WebP via sharp, and updates projects.json.
 *
 * Usage:
 *   node scripts/generate-thumbnails.js              # dry run: rcs-3dof only
 *   node scripts/generate-thumbnails.js --all        # all projects with models
 *   node scripts/generate-thumbnails.js --project rc-car   # single project
 *
 * Dependencies: npm install --save-dev puppeteer sharp
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

/* ── Config ──────────────────────────────────────────────── */
const ROOT = path.resolve(__dirname, '..');
const PROJECTS_JSON = path.join(ROOT, 'projects.json');
const IMAGES_DIR = path.join(ROOT, 'images');
const WIDTH = 1200;
const HEIGHT = 800;
const SERVER_PORT = 9473;
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.163.0';
const DRACO_PATH = CDN + '/examples/jsm/libs/draco/';

/* ── Local file server ──────────────────────────────────── */
function startServer() {
  return new Promise((resolve) => {
    const MIME = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.glb': 'model/gltf-binary',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.webp': 'image/webp',
    };

    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(ROOT, url);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': mime,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(SERVER_PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

/* ── Preset detection — verbatim from viewer.js ──────────── */
const PRESETS = {
  edges: { baseColor: 0x111111, edgeAngle: 20, edgeOpacity: 0.55, wireOpacity: 0 },
  dual:  { baseColor: 0x1a1a1a, edgeAngle: 12, edgeOpacity: 0.55, wireOpacity: 0.15 },
};

const DUAL_PATTERNS = [
  'lhr2023 rear upright',
  'lhr2024 front upright',
  'rg3 000a',
  'sfp0000a',
  'cvr shield',
];

/* Per-project Y-axis rotation overrides (radians) */
const ROTATION_OVERRIDES = {
  'frc-2022-robot': Math.PI / 2,  // 90° about vertical axis
};

function getPreset(modelSrc) {
  for (const pat of DUAL_PATTERNS) {
    if (modelSrc.indexOf(pat) !== -1) return { name: 'dual', ...PRESETS.dual };
  }
  return { name: 'edges', ...PRESETS.edges };
}

/* ── CLI parsing ─────────────────────────────────────────── */
const args = process.argv.slice(2);
let mode = 'dry-run';
let targetId = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--all') {
    mode = 'all';
  } else if (args[i] === '--project' && args[i + 1]) {
    mode = 'single';
    targetId = args[++i];
  }
}

/* ── Load projects ───────────────────────────────────────── */
const projectsData = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf-8'));
const allProjects = projectsData.projects;

function getTargetProjects() {
  const withModels = allProjects.filter(p => p.models && p.models.length > 0);
  if (mode === 'all') return withModels;
  if (mode === 'single') {
    const found = withModels.filter(p => p.id === targetId);
    if (found.length === 0) {
      console.error(`Project "${targetId}" not found or has no models.`);
      process.exit(1);
    }
    return found;
  }
  return withModels.filter(p => p.id === 'rcs-3dof');
}

/* ── Build the in-page HTML that renders a single GLB ────── */
function buildPageHTML(glbUrl, preset, rotationY) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #080808; }
  canvas { display: block; width: ${WIDTH}px; height: ${HEIGHT}px; }
</style>
<script type="importmap">
{ "imports": {
    "three": "${CDN}/build/three.module.js",
    "three/addons/": "${CDN}/examples/jsm/"
}}
</script>
</head><body>
<canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setClearColor(0x080808);
renderer.setPixelRatio(1);
renderer.setSize(${WIDTH}, ${HEIGHT}, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, ${WIDTH}/${HEIGHT}, 0.01, 100);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(2, 3, 4);
scene.add(dir);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('${DRACO_PATH}');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

const PRESET = {
  baseColor: ${preset.baseColor},
  edgeAngle: ${preset.edgeAngle},
  edgeOpacity: ${preset.edgeOpacity},
  wireOpacity: ${preset.wireOpacity},
};

loader.load('${glbUrl}', function(gltf) {
  const group = new THREE.Group();
  const root = gltf.scene;

  /* Strip loose/outlier geometry — verbatim from viewer.js */
  const allMeshes = [];
  root.traverse(function(child) {
    if (child.isMesh) allMeshes.push(child);
  });

  if (allMeshes.length > 1) {
    const modelBox = new THREE.Box3().setFromObject(root);
    const modelCenter = modelBox.getCenter(new THREE.Vector3());
    const modelSize = modelBox.getSize(new THREE.Vector3());
    const maxExtent = Math.max(modelSize.x, modelSize.y, modelSize.z);

    allMeshes.forEach(function(mesh) {
      mesh.geometry.computeBoundingSphere();
      const bs = mesh.geometry.boundingSphere;
      const isTiny = bs.radius < maxExtent * 0.001;
      const worldCenter = bs.center.clone();
      mesh.localToWorld(worldCenter);
      const distFromCenter = worldCenter.distanceTo(modelCenter);
      const isFar = distFromCenter > maxExtent * 0.6;

      if (isTiny || (isFar && bs.radius < maxExtent * 0.02)) {
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.geometry.dispose();
      }
    });
  }

  /* Apply preset materials — verbatim from viewer.js */
  const modelBaseMat = new THREE.MeshStandardMaterial({
    color: PRESET.baseColor,
    metalness: 0.4,
    roughness: 0.6,
  });
  const modelEdgeMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    opacity: PRESET.edgeOpacity,
    transparent: true,
  });

  root.traverse(function(child) {
    if (child.isMesh) {
      child.material = modelBaseMat;
      const edges = new THREE.EdgesGeometry(child.geometry, PRESET.edgeAngle);
      child.add(new THREE.LineSegments(edges, modelEdgeMat));
      if (PRESET.wireOpacity > 0) {
        const wireMat = new THREE.LineBasicMaterial({
          color: 0xffffff,
          opacity: PRESET.wireOpacity,
          transparent: true,
        });
        child.add(new THREE.LineSegments(new THREE.WireframeGeometry(child.geometry), wireMat));
      }
    }
  });

  group.add(root);

  /* Auto-center and scale to fit — verbatim from viewer.js */
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 0.8 / maxDim;
  group.scale.setScalar(scale);
  group.position.sub(center.multiplyScalar(scale));
  group.rotation.y = ${rotationY || 0};

  scene.add(group);

  /* 3/4 isometric camera */
  camera.position.set(0.6, 0.4, 1.0);
  camera.lookAt(0, 0, 0);

  /* Render 5 frames then signal done */
  let frameCount = 0;
  function renderLoop() {
    renderer.render(scene, camera);
    frameCount++;
    if (frameCount < 5) {
      requestAnimationFrame(renderLoop);
    } else {
      window.__RENDER_DONE = true;
    }
  }
  requestAnimationFrame(renderLoop);

}, undefined, function(err) {
  console.error('GLB load error:', err);
  window.__RENDER_ERROR = err.message || 'unknown';
});
</script>
</body></html>`;
}

/* ── Main ────────────────────────────────────────────────── */
async function main() {
  const targets = getTargetProjects();

  if (targets.length === 0) {
    console.log('No projects to process.');
    return;
  }

  console.log(`\nProcessing ${targets.length} project(s)...\n`);

  /* Start local file server so Puppeteer can load GLBs via HTTP */
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${SERVER_PORT}`;
  console.log(`Local server running at ${baseUrl}\n`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--enable-gpu',
      '--use-gl=angle',
      '--use-angle=metal',
      '--ignore-gpu-blocklist',
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--disable-vulkan-fallback-to-gl-for-testing',
    ],
  });

  const results = [];

  for (const project of targets) {
    const modelSrc = project.models[0].src;
    const preset = getPreset(modelSrc);
    const glbAbsPath = path.join(ROOT, modelSrc);
    /* URL-encode the model path for HTTP serving */
    const glbHttpUrl = baseUrl + '/' + modelSrc.split('/').map(encodeURIComponent).join('/');
    const pngPath = path.join(IMAGES_DIR, `wireframe-${project.id}.png`);
    const webpPath = path.join(IMAGES_DIR, `wireframe-${project.id}.webp`);
    const webpRelative = `images/wireframe-${project.id}.webp`;

    let status = 'OK';
    let fileSizeKB = 0;

    process.stdout.write(`  ${project.id} ... `);

    try {
      if (!fs.existsSync(glbAbsPath)) {
        throw new Error(`GLB not found: ${glbAbsPath}`);
      }

      const page = await browser.newPage();
      await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

      /* Log browser console errors for debugging */
      page.on('console', msg => {
        if (msg.type() === 'error') {
          process.stderr.write(`  [browser] ${msg.text()}\n`);
        }
      });
      page.on('pageerror', err => {
        process.stderr.write(`  [page error] ${err.message}\n`);
      });

      const rotY = ROTATION_OVERRIDES[project.id] || 0;
      const html = buildPageHTML(glbHttpUrl, preset, rotY);
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

      /* Wait for render to complete */
      await page.waitForFunction(
        '(window.__RENDER_DONE === true || window.__RENDER_ERROR)',
        { timeout: 60000 }
      );

      const renderError = await page.evaluate(() => window.__RENDER_ERROR);
      if (renderError) throw new Error(`Render error: ${renderError}`);

      /* Screenshot */
      await page.screenshot({
        path: pngPath,
        type: 'png',
        clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      });

      await page.close();

      /* Convert to WebP */
      await sharp(pngPath)
        .webp({ quality: 85 })
        .toFile(webpPath);

      /* Delete intermediate PNG */
      fs.unlinkSync(pngPath);

      /* Get file size */
      const stat = fs.statSync(webpPath);
      fileSizeKB = (stat.size / 1024).toFixed(1);

      /* Update project entry */
      const idx = allProjects.findIndex(p => p.id === project.id);
      if (idx !== -1) {
        allProjects[idx].wireframeThumbnail = webpRelative;
      }

      /* Update preview thumbs */
      const thumbIdx = projectsData.preview.thumbs.findIndex(t => t.id === project.id);
      if (thumbIdx !== -1) {
        projectsData.preview.thumbs[thumbIdx].img = webpRelative;
        projectsData.preview.thumbs[thumbIdx].width = WIDTH;
        projectsData.preview.thumbs[thumbIdx].height = HEIGHT;
      }

      process.stdout.write(`OK (${fileSizeKB} KB)\n`);
    } catch (err) {
      status = `FAIL: ${err.message}`;
      process.stdout.write(`FAIL\n`);
      process.stderr.write(`    ${err.message}\n`);
      if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
    }

    results.push({
      id: project.id,
      src: modelSrc,
      preset: preset.name,
      output: webpRelative,
      sizeKB: fileSizeKB,
      status,
    });
  }

  await browser.close();
  server.close();

  /* Write updated projects.json */
  const successCount = results.filter(r => r.status === 'OK').length;
  if (successCount > 0) {
    fs.writeFileSync(PROJECTS_JSON, JSON.stringify(projectsData, null, 2) + '\n');
    console.log(`\nUpdated projects.json (${successCount} project(s))\n`);
  }

  /* Summary table */
  const colId = 20, colSrc = 42, colPreset = 8, colOut = 38, colSize = 10;
  const header = [
    'Project ID'.padEnd(colId),
    'Model Src'.padEnd(colSrc),
    'Preset'.padEnd(colPreset),
    'Output WebP'.padEnd(colOut),
    'Size KB'.padEnd(colSize),
    'Status',
  ].join(' | ');
  const sep = '-'.repeat(header.length);

  console.log(sep);
  console.log(header);
  console.log(sep);
  for (const r of results) {
    console.log([
      r.id.padEnd(colId),
      r.src.padEnd(colSrc),
      r.preset.padEnd(colPreset),
      r.output.padEnd(colOut),
      String(r.sizeKB).padEnd(colSize),
      r.status,
    ].join(' | '));
  }
  console.log(sep);
  console.log(`\nDone: ${successCount}/${results.length} succeeded.\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
