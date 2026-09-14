# Brand overhaul implementation plan

**Goal:** Implement the supplied brand brief throughout the static portfolio.
**Architecture:** Existing JSON sources feed separate homepage and projects renderers; shared tokens/navigation, page-specific layout. Keep ModelViewer for 3D.
**Tech stack:** HTML, native CSS, vanilla JavaScript; existing Puppeteer and Sharp for verification and asset preparation.
**Spec:** ../specs/2026-09-13-brand-overhaul-design.md

## Tasks
- [x] Audit original source, data, routes and assets; create requested branch.
- [x] Install the two official variable WOFF2 families and OFL licenses; document provenance and verify axes.
- [x] Rewrite tokens.css and layout.css; implement semantic homepage in index.html and js/home.js; retain every content section and all project links. Add mobile navigation in js/nav.js and restrained reveals in js/animations.js.
- [x] Replace projects.html inline implementation with scrollable case studies in css/projects.css and js/projects.js; retain all data and ModelViewer interactions.
- [x] Generate image derivatives from original assets and use a manifest to preserve existing source paths and data architecture.
- [x] Run Puppeteer checks for content preservation, local links, fonts, navigation, history, gallery/model behavior, reduced motion and viewport overflow. Inspect screenshots and fix visual defects.
- [x] Review final diff, document local preview/test commands, and deliver the branch with a working preview.

## Decisions
The user explicitly requests a new branch and full implementation, so use the clean existing checkout on the requested branch. Original factual wording remains authoritative. Presentation sections use project titles, summaries and metadata from existing JSON. Keep original images/models intact and add optimized display variants.
