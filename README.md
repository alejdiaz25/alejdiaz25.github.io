# alejdiaz25.github.io

Personal engineering portfolio — static site, no build step, no framework. Built with
semantic HTML5, vanilla CSS/JS, and Three.js (via CDN) for interactive 3D model viewing.

Live at [alejdiaz25.github.io](https://alejdiaz25.github.io).

## License

Code (HTML, CSS, JS, build scripts) is [MIT licensed](LICENSE) — reuse, fork, and adapt
freely.

**Not covered by the license:** the 3D model files in `assets/models/**/*.glb`, CAD-derived
renders/thumbnails, resume content, and project write-ups. Those represent real engineering
work (some done for employers or student teams) and remain all rights reserved. If you fork
this repo, swap those out for your own assets.

## Tech stack

| Layer | Tool |
|---|---|
| Markup | Semantic HTML5, no framework |
| Styles | CSS3 — variables, Grid, Flexbox |
| Scripting | Vanilla JS (ES2020+) |
| 3D viewer | [Three.js](https://threejs.org) (CDN, `GLTFLoader` + `DRACOLoader`) |
| Typography | Self-hosted Instrument Sans + Azeret Mono variable WOFF2 |
| Animation | Native CSS + IntersectionObserver, with reduced-motion support |
| Thumbnail generation | Node script — Puppeteer (headless render) + Sharp (WebP encode) |

No bundler, no npm build step for the site itself. `package.json` only holds devDependencies
for the thumbnail-generation script.

## Running locally

Start the local preview:

```bash
node scripts/serve.js
```

Then open `http://localhost:8000`.

The homepage uses `content.json` and `projects.json`. The project experience preserves
`projects.html?project=<id>` links and loads interactive 3D only when requested.
`projects.json`'s `preview.thumbs` determines homepage carousel order. Each card uses
the project's generated wireframe thumbnail, title and opening description sentence.
The complete project index starts collapsed; original project records remain the
source of all engineering facts.

Run the browser checks with `node scripts/verify-portfolio.js` and
`node scripts/verify-projects.cjs --models`. The latter needs network access for the
existing Three.js CDN. Add `--screenshots` to the portfolio check to capture visual
review images in the ignored `.tmp/` directory.

Regenerate responsive WebP derivatives with `node scripts/optimize-images.cjs` after
adding source images. Originals are preserved; `images/manifest.json` maps them to
responsive assets. Font provenance and SIL OFL licenses are in `assets/fonts/`.

## Contributing

This is a personal portfolio, so large content changes (new projects, resume edits) won't be
merged — but bug fixes, accessibility improvements, and viewer/performance improvements to the
underlying code are welcome via PR.

---

## 3D asset pipeline: CAD → web-ready `.glb`

Every model in `assets/models/` started as a CAD assembly and went through the same pipeline
to become a compressed, web-safe glTF binary. If you're adapting this repo for your own CAD
work, here's the full path.

**Target budget:** each `.glb` under 3MB, poly count under ~50K faces, preview WebP under
200KB. Keeping to this budget is what keeps the site's interactive viewer fast on mobile and
over weak connections.

### 1. Export from CAD as STEP

From SOLIDWORKS, CATIA, Fusion360, or similar: export the assembly as `.STEP` (`.stp`) or
`.OBJ`. STEP is preferred — it preserves the assembly's actual solid geometry and precision
instead of a pre-tessellated mesh, which gives Blender's decimation step something clean to
work from.

```
File → Save As → STEP AP242 (*.step)
```

### 2. Import into Blender

Blender doesn't read STEP natively — you need an importer add-on:

- **Blender 4.0+:** the built-in STEP importer (enable it under
  `Edit → Preferences → Add-ons → Import-Export: STEP`), or
- **CAD Sketcher** / the free **STEPper** add-on for older Blender versions.

```
File → Import → STEP (.step/.stp)
```

For `.OBJ` exports, use Blender's built-in `File → Import → Wavefront (.obj)` instead — no
add-on needed, but you lose STEP's exact-geometry precision in favor of whatever tessellation
the CAD tool baked in at export time.

### 3. Decimate

CAD-exported meshes are almost always far denser than a web viewer needs. Reduce poly count
before doing anything else:

```
Select the mesh → Modifier Properties → Add Modifier → Decimate
  Mode: Planar
  Angle Limit: ~5°
  Target: < 50,000 faces total
```

**Planar mode** (not Collapse/Un-Subdivide) works best for mechanical parts — it merges
coplanar faces without rounding off edges, which matters for anything with flat machined
surfaces, fillets, or fastener bosses. Check the result against the original in wireframe
view; if edges start looking chunky or holes disappear, back off the angle limit.

### 4. Clean up materials

Before export, simplify the material graph:

- Merge duplicate materials (`Select All → Material → Merge Base Colors`, or manually
  consolidate in the Shader Editor / Outliner).
- Use the **Principled BSDF** shader with metallic + roughness maps only — no displacement,
  subsurface scattering, or other expensive channels that don't render in a lightweight
  `<canvas>`-based viewer.
- Bake textures down if the source CAD material was procedural.

### 5. Export as glTF + Draco-compress

Export via Blender's built-in glTF 2.0 exporter with Draco compression enabled:

```
File → Export → glTF 2.0 (.glb/.gltf)
  Format: glTF Binary (.glb)
  Geometry → Compression: Draco  (enable, keep default quantization)
```

Or, if you already have a `.gltf` from another tool, compress it after the fact with
[`gltfpack`](https://github.com/zeux/meshoptimizer):

```bash
gltfpack -i model.gltf -o model.glb -cc   # Draco compression + mesh optimization
```

Draco compression is what lets a several-MB source mesh ship as a `.glb` well under 3MB — the
viewer (`js/viewer.js`) already has a `DRACOLoader` wired up via CDN to decode it client-side.

### 6. Render a static preview

Every model also gets a static preview image shown before the interactive viewer loads
(the "Slide 1" placeholder in the projects UI):

```
Blender: set up a beauty-shot camera angle → Render → 1200×900px → export WebP, quality 85
```

The repo's `scripts/generate-thumbnails.js` automates a version of this step — it spins up a
local static server, headless-renders the same wireframe view the live viewer uses (via
Puppeteer), and encodes the screenshot to WebP (via Sharp), then writes the path into
`projects.json` automatically:

```bash
npm install                                   # installs puppeteer + sharp
node scripts/generate-thumbnails.js --all               # regenerate all thumbnails
node scripts/generate-thumbnails.js --project rc-car     # single project
```

### 7. Validate against budget

Before committing:

```bash
ls -lh assets/models/your-model.glb     # must be < 3MB
ls -lh images/your-preview.webp          # must be < 200KB
```

If the `.glb` is still too large, go back to step 3 and decimate harder, or check that Draco
compression actually ran (an uncompressed glTF export can be 5–10x larger than the same mesh
with Draco enabled).

### 8. Wire it into `projects.json`

Add the model and preview paths to the relevant project entry under `projects.json`'s
`projects` array. Relevant fields per project:

```json
{
  "id": "your-project-id",
  "preview": "images/your-preview.png",
  "models": [
    { "src": "assets/models/your-model.glb", "label": "Interactive 3D" }
  ],
  "gallery": ["images/your-photo-1.jpg", "images/your-photo-2.jpg"],
  "wireframeThumbnail": "images/wireframe-your-project-id.webp"
}
```

`wireframeThumbnail` is what `scripts/generate-thumbnails.js` writes to automatically — see
step 6. The project viewer picks up new entries from this file directly; no JS changes needed
for a standard model addition.
