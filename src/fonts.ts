// Geist draws Latin and Noto Sans Bengali draws Bangla. Each file loads only when the page shows a
// character in its unicode-range, so an English page never downloads the 108 KB Bangla file. The
// taka sign has a file of its own, cut from the Bangla one, because English prices show it too.
const faces: [family: string, file: string, range: string][] = [
  [
    'Geist',
    'geist-latin-ext-wght-normal.woff2',
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  ],
  [
    'Geist',
    'geist-latin-wght-normal.woff2',
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  ],
  // Bangla text reads Geist under this name, which holds only Latin letters and digits: the Bangla
  // file has no comma, so Geist's full range would load a Geist file for a Bangla sentence's comma.
  // Both names point at the same URLs, so the browser fetches each file once.
  ['Geist Letters', 'geist-latin-ext-wght-normal.woff2', 'U+0100-024F,U+1E00-1E9F,U+1EF2-1EFF,U+2C60-2C7F,U+A720-A7FF'],
  [
    'Geist Letters',
    'geist-latin-wght-normal.woff2',
    'U+0030-0039,U+0041-005A,U+0061-007A,U+00C0-00D6,U+00D8-00F6,U+00F8-00FF',
  ],
  [
    'Noto Sans Bengali',
    'noto-sans-bengali-bangla.woff2',
    'U+0951-0952,U+0964-0965,U+0980-09F2,U+09F4-09FE,U+1CD0,U+1CD2,U+1CD5-1CD6,U+1CD8,U+1CE1,U+1CEA,U+1CED,U+1CF2,U+1CF5-1CF7,U+200C-200D,U+20B9,U+25CC,U+A8F1',
  ],
  ['Noto Sans Bengali', 'noto-sans-bengali-taka.woff2', 'U+09F3'],
]

// The fonts sit in fonts/ beside this module, in the source and next to the built v1.js. The URL
// is read from a variable so the bundler leaves the files on the CDN instead of inlining them.
const here = import.meta.url

export function installFonts(doc: Document = document): void {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(
    faces
      .map(
        ([family, file, range]) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(${new URL(`fonts/${file}`, here).href}) format('woff2');
  unicode-range: ${range};
}`,
      )
      .join('\n'),
  )
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet]
}
