# Brand overhaul verification

Validated on the `codex/brand-overhaul` branch.

- `node scripts/verify-portfolio.js --screenshots`: passed both pages at 320, 390, 768, 1024, 1440 and 1920px. Verified actual font loading, no horizontal overflow, heading structure, mobile menu and Escape focus restoration, carousel keyboard controls, images, anchors and 112 local resources.
- `node scripts/verify-projects.cjs --models`: passed all 11 project deep links, complete descriptions/specifications, media selectors, image enlargement, keyboard navigation and browser history. Loaded both 2022 robot models and verified rotation, reset, switching and hiding the viewer.
- The model check needs access to the existing Three.js CDN. The first sandboxed run was denied network access; the network-enabled run passed.
- Original `content.json` is unchanged. All original `projects.json` project records are deeply equal to the baseline. Only additive homepage presentation configuration was introduced.
- Inspected desktop, laptop and phone screenshots for type scale, layout, image cropping and contrast. Enlarged the mobile hero assembly and eliminated its visible rectangular image background.
- Original image/model assets remain intact. The responsive manifest covers 50 source images with 131 WebP derivatives. The two official variable fonts total approximately 82 KiB, with original SIL OFL licenses.

The static site remains compatible with GitHub Pages and has no build step. Preview screenshots are in the ignored `.tmp/` directory.

## Carousel follow-up

Replaced the three full-length homepage features with a native horizontal carousel
of all 11 generated model thumbnails. Each card links to its project and shows its
title and opening description sentence. Desktop shows two large cards and part of
the next; phones show one prominent card with the next visible at the edge.
The project index is now a native details disclosure, collapsed initially.
Added checks for thumbnail/caption provenance, index default state and keyboard
toggling, carousel next/Home navigation, and retained the six-width homepage checks.

## Point-cloud hero update — 2026-09-14

Replaced the hero assembly image with an original canvas point terrain inspired by the supplied Lattice Mesh reference. Perspective, layered height waves, and eased pointer parallax create depth using a Nardo-grey palette on black. The hero name now uses the same Instrument Sans width, weight, spacing, and line-height treatment as the main titles. Both pages use larger, centered Instrument Sans navigation without section numbers; the phone menu retains its toggle and centers its links.

Motion runs at approximately 30 fps, uses fewer points on phones, stops offscreen or in a hidden tab, and includes a pause control. Reduced-motion preferences produce a static terrain. No additional dependencies or remote assets are required.

Validation: `node scripts/verify-portfolio.js --home-only --screenshots` passed at 1920, 1440, 1024, 768, 390, and 320px, including preserved content and 126 local resources. `node scripts/verify-hero.cjs` passed animation, pause/resume, offscreen suspension, reduced motion, image removal, and centered navigation checks on both pages. Desktop and mobile captures visually reviewed. Tailscale returned HTTP 200 for the new hero script.
