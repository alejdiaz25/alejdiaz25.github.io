# Brand overhaul verification

Validated on the `codex/brand-overhaul` branch.

- `node scripts/verify-portfolio.js --screenshots`: passed both pages at 320, 390, 768, 1024, 1440 and 1920px. Verified actual font loading, no horizontal overflow, heading structure, mobile menu and Escape focus restoration, carousel keyboard controls, images, anchors and 112 local resources.
- `node scripts/verify-projects.cjs --models`: passed all 11 project deep links, complete descriptions/specifications, media selectors, image enlargement, keyboard navigation and browser history. Loaded both 2022 robot models and verified rotation, reset, switching and hiding the viewer.
- The model check needs access to the existing Three.js CDN. The first sandboxed run was denied network access; the network-enabled run passed.
- Original `content.json` is unchanged. All original `projects.json` project records are deeply equal to the baseline. Only additive homepage presentation configuration was introduced.
- Inspected desktop, laptop and phone screenshots for type scale, layout, image cropping and contrast. Enlarged the mobile hero assembly and eliminated its visible rectangular image background.
- Original image/model assets remain intact. The responsive manifest covers 50 source images with 131 WebP derivatives. The two official variable fonts total approximately 82 KiB, with original SIL OFL licenses.

The static site remains compatible with GitHub Pages and has no build step. Preview screenshots are in the ignored `.tmp/` directory.
