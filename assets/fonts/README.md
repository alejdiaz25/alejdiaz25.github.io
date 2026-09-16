# Self-hosted portfolio fonts

These are the unmodified, normal (roman), variable WOFF2 Latin subsets served by Google Fonts. They were retrieved on 2026-09-13. No external font request is needed at runtime.

| Family | Local file | Bytes | Variable axes | License |
| --- | --- | ---: | --- | --- |
| Instrument Sans | `instrument-sans/instrument-sans-latin-variable.woff2` | 57,332 | `wdth`: 75–100, default 100; `wght`: 400–700, default 400 | [SIL Open Font License 1.1](instrument-sans/OFL.txt) |
| Azeret Mono | `azeret-mono/azeret-mono-latin-variable.woff2` | 26,164 | `wght`: 100–900, default 100 | [SIL Open Font License 1.1](azeret-mono/OFL.txt) |

The combined font payload is 83,496 bytes (81.54 KiB). Instrument Sans retains both its width and weight axes. Azeret Mono's internal default weight is 100; the site's CSS should select the intended text weight explicitly. Neither file contains an italic axis.

## Sources

The files were selected from this [official Google Fonts CSS response](https://fonts.googleapis.com/css2?family=Instrument+Sans:wdth,wght@75..100,400..700&family=Azeret+Mono:wght@100..900&display=swap), requested with a modern Chrome user agent to obtain WOFF2 variable fonts.

### Instrument Sans

- [Original project](https://github.com/Instrument/instrument-sans)
- [Google Fonts source directory](https://github.com/google/fonts/tree/main/ofl/instrumentsans)
- Exact downloaded WOFF2 URL: <https://fonts.gstatic.com/s/instrumentsans/v4/pxicypc9vsFDm051Uf6KVwgkfoSbT2lB.woff2>
- Exact downloaded license URL: <https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/OFL.txt>
- Copyright 2022 The Instrument Sans Project Authors.
- SHA-256: `8b74e9bc6e415d564a5ffd32125c92ffd50b1635043e77543cb871e0a3cfcaf2`

### Azeret Mono

- [Original project](https://github.com/displaay/Azeret)
- [Google Fonts source directory](https://github.com/google/fonts/tree/main/ofl/azeretmono)
- Exact downloaded WOFF2 URL: <https://fonts.gstatic.com/s/azeretmono/v21/3XFuErsiyJsY9O_Gepph-HHhZfk.woff2>
- Exact downloaded license URL: <https://raw.githubusercontent.com/google/fonts/main/ofl/azeretmono/OFL.txt>
- Copyright 2021 The Azeret Project Authors.
- SHA-256: `d090ca8b9080094d42b06c43f2987bfa8b36fd5565611fd59db84db53c5f74bb`

## Character coverage and CSS descriptors

Google Fonts advertises the following Latin subset range for both files:

```css
unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC,
  U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F,
  U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
```

This subset covers the portfolio's English text, common Western European accents, and typographic punctuation. Other scripts require another subset or a system fallback. Use `font-style: normal`, `font-display: swap`, and the following ranges when declaring the local faces:

```css
/* Instrument Sans */
font-weight: 400 700;
font-stretch: 75% 100%;

/* Azeret Mono */
font-weight: 100 900;
```

## Verification

Both files were checked for the WOFF2 signature and declared file length, successfully Brotli-decompressed, and checked against their table-directory lengths. Their embedded `fvar` tables confirm the axes and ranges above. Instrument Sans contains 244 glyphs; Azeret Mono contains 276. The original license text is stored alongside each font.
