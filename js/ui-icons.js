'use strict';

(() => {
  const icon = (name, path) => `<svg class="ui-icon ui-icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`;

  window.SiteIcons = Object.freeze({
    upRight: () => icon('up-right', 'M7 17L17 7M9 7h8v8'),
    down: () => icon('down', 'M12 5v14M6 13l6 6 6-6'),
    up: () => icon('up', 'M12 19V5M6 11l6-6 6 6'),
    left: () => icon('left', 'M19 12H5M11 18l-6-6 6-6'),
    right: () => icon('right', 'M5 12h14M13 6l6 6-6 6'),
  });
})();
