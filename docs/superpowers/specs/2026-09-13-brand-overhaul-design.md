# Brand overhaul

## Brief and scope
Implement the supplied full visual redesign on `codex/brand-overhaul`. Preserve static HTML/CSS/JS, every JSON fact, project ID, image/model asset, resume and contact destination. No framework or runtime animation dependency.

## Audit
The homepage renders content.json and projects.json into a fixed-width layout with a small automatic project carousel. Geist/Geist Mono, gold borders, scrambled text and a dot-terrain canvas define its old identity. projects.html contains a fixed-height three-pane selector, specs panel and image/model carousel, with inline styling and scripting. The reusable ModelViewer engine supplies orbit, zoom, reset and multiple model support. There are 11 projects, 20 courses, 3 academic projects, 4 work roles and 2 relevant roles. Preserve content and deep links, while improving keyboard access and reduced motion.

## Visual system
Native CSS, dark editorial hardware identity. Design variance 8, motion intensity 3, density 3. Instrument Sans roman variable weight 400–700 and width 75–100; Azeret Mono roman variable 100–900 reserved for interface and metadata. Nearly black #10110f, graphite #1b1d19, soft white #f0f0e9, gray #aaada3, restrained accent #b6a47c. Sharp corners, 1px rules, 12-column alignment and responsive gutters instead of one centered max-width container.

## Composition
Homepage: oversized two-line name with a real CAD assembly as a brand opening; selected work follows. Three large features use distinct compositions, followed by the complete project index. Preserve experience and relevant experience as readable records, about as a typographic statement with photos and all paragraphs, academic content as paired course/project columns, skills as three plain text groups, contact as a large invitation. Project detail becomes a scrollable case study with numbered index, title, media, context, role/specifications, software and disciplines. All media remains accessible with 3D loading on demand.

## Interaction and resilience
Mobile menu uses expanded state, Escape and focus restore. Photo browsing has explicit controls and keyboard/swipe support. Motion consists of small reveals and hover feedback; reduced motion disables transitions and automatic rotation. Visible focus, semantic headings, alt text, loading/error states and native links are required. JSON remains authoritative, with additive editorial configuration only. Existing assets stay intact; optimized derivatives and a manifest provide efficient rendering.

## Verification
Capture baseline and final visual states, inspect desktop/laptop/tablet/phone typography and crops, check document overflow at 320–1920px, verify data preservation, local paths and font loading, exercise all 11 deep links, navigation history, photos and interactive models. Check console errors and failed network requests. No publishing requested.
