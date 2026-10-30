// Sun or Shine: image optimiser.
// Regenerates every production raster in site/img/photos/ from the originals in assets/.
// The originals are only ever read, never written.
//
//   cd dev && npm install          # once (installs sharp)
//   npm run images                 # rebuild everything
//   node optimize-images.mjs ../assets/new-photo.jpg story-1 800,1600   # add a one-off photo
//
// To add a photo permanently, append an entry to JOBS below and re-run.
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { default: sharp } = await import('sharp');
const { default: opentype } = await import('opentype.js');
const ASSETS = join(ROOT, 'assets');
const OUT = join(ROOT, 'site/img/photos');
const SVG = join(ROOT, 'site/img/svg');
const FONTS = join(ROOT, 'dev/fonts');

// "-<N>" in the output name is the target width. Sources are never upscaled: if the original is
// narrower than N, the file is written at the original width (the name stays stable for srcset).
// budgetKB: optional per-width JPEG ceiling; quality steps down from `quality` until it fits.
const JOBS = [
  { src: 'DSC_4735.JPG', name: 'couple-real', widths: [800, 1600], budgetKB: { 800: 150, 1600: 400 } },
  { src: 'cartoon.jpeg', name: 'cartoon', widths: [600, 1200] },
  { src: 'Gemini_Generated_Image_buettkbuettkbuet.jpeg', name: 'cartoon-hero', widths: [800, 1600] },
  { src: 'Gemini_Generated_Image_r6tellr6tellr6te.jpeg', name: 'illustrated-wide', widths: [1000, 1800] },
];
const JPEG_Q = 80;
const WEBP_Q = 78;

const kb = f => (statSync(f).size / 1024).toFixed(0);
const report = [];

async function writeVariants(input, name, widths, budgetKB = {}) {
  const meta = await sharp(input).rotate().metadata(); // rotate() applies EXIF orientation
  for (const w of widths) {
    const base = () => sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).toColourspace('srgb');
    const jpgPath = join(OUT, `${name}-${w}.jpg`);
    const webpPath = join(OUT, `${name}-${w}.webp`);
    let q = JPEG_Q;
    let info;
    for (;;) {
      info = await base().jpeg({ quality: q, mozjpeg: true, progressive: true }).toFile(jpgPath);
      const limit = budgetKB[w];
      if (!limit || info.size / 1024 <= limit || q <= 60) break;
      q -= 4;
    }
    await base().webp({ quality: Math.min(WEBP_Q, q), effort: 6 }).toFile(webpPath);
    report.push([`${name}-${w}`, `${info.width}x${info.height}`, `q${q}`, `${kb(jpgPath)} KB`, `${kb(webpPath)} KB webp`]);
  }
  return meta;
}

// Text is converted to vector paths with opentype.js and rasterised by sharp, so the OG card
// renders identically on any machine without installing fonts (Pango on macOS ignores font files).
const FONT = {
  display: opentype.loadSync(join(FONTS, 'Courgette-Regular.ttf')),
  bold: opentype.loadSync(join(FONTS, 'Nunito-700.ttf')),
  heavy: opentype.loadSync(join(FONTS, 'Nunito-800.ttf')),
};
// runs: [[text, fontKey, colour], ...] laid out on one line. Returns a PNG buffer cropped to the line.
async function textLayer(runs, size) {
  const f0 = FONT[runs[0][1]];
  const asc = (f0.ascender / f0.unitsPerEm) * size, desc = (-f0.descender / f0.unitsPerEm) * size;
  const pad = Math.ceil(size * 0.15);
  let x = pad, paths = '';
  for (const [text, key, fill] of runs) {
    const font = FONT[key];
    paths += `<path fill="${fill}" d="${font.getPath(text, x, pad + asc, size, { kerning: true }).toPathData(2)}"/>`;
    x += font.getAdvanceWidth(text, size, { kerning: true });
  }
  const w = Math.ceil(x + pad), h = Math.ceil(asc + desc + pad * 2);
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${paths}</svg>`)).png().toBuffer();
}
const svgFile = (f, w) => sharp(readFileSync(join(SVG, f)), { density: 300 }).resize({ width: w }).png().toBuffer();

async function buildOg() {
  const W = 1200, H = 630, PANEL = 540;
  // Left: the storybook couple, cropped to faces + heart-hands.
  const photo = await sharp(join(ASSETS, 'cartoon.jpeg'))
    .extract({ left: 96, top: 228, width: 704, height: 821 })
    .resize(PANEL + 40, H)
    .toBuffer();

  // Right: cream card with a scalloped-wave left edge, canopy haze and a soft gold border.
  const card = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="h" cx="70%" cy="0%" r="90%"><stop offset="0" stop-color="#fff1c4"/><stop offset=".55" stop-color="#fbf5e6"/><stop offset="1" stop-color="#f3e9d2"/></radialGradient>
    </defs>
    <path d="M${PANEL} 0 Q${PANEL - 26} 52 ${PANEL} 105 T${PANEL} 210 T${PANEL} 315 T${PANEL} 420 T${PANEL} 525 T${PANEL} 630 H${W} V0Z" fill="#c9841a" opacity=".35" transform="translate(-8 0)"/>
    <path d="M${PANEL} 0 Q${PANEL - 26} 52 ${PANEL} 105 T${PANEL} 210 T${PANEL} 315 T${PANEL} 420 T${PANEL} 525 T${PANEL} 630 H${W} V0Z" fill="url(#h)"/>
    <rect x="${PANEL + 26}" y="22" width="${W - PANEL - 48}" height="${H - 44}" rx="18" fill="none" stroke="#c9841a" stroke-opacity=".45" stroke-width="2"/>
    <rect x="${PANEL + 34}" y="30" width="${W - PANEL - 64}" height="${H - 60}" rx="14" fill="none" stroke="#c9841a" stroke-opacity=".25" stroke-width="1"/>
  </svg>`);

  const cx = PANEL + 20, tw = W - PANEL - 40; // text column
  const title = await textLayer([['Sun or Shine?', 'display', '#6b1f2a']], 96);
  const sub = await textLayer([['Ayana & Sebin\u2019s Baby Shower', 'heavy', '#3b2412']], 40);
  const sub2 = await textLayer([['& Gender Reveal', 'heavy', '#3b2412']], 40);
  const date = await textLayer([['Saturday \u00b7 Nov 7 \u00b7 Redmond, WA', 'bold', '#8f5a10']], 30);
  const team = await textLayer([['Team Sun', 'heavy', '#2c5d8f'], ['  vs  ', 'bold', '#5a3a1e'], ['Team Shine', 'heavy', '#a3365f']], 31);

  const center = async (buf, top) => {
    const m = await sharp(buf).metadata();
    return { input: buf, top: Math.round(top), left: Math.round(cx + (tw - m.width) / 2) };
  };
  const lights = await svgFile('string-lights.svg', 340);
  const layers = [
    { input: photo, left: -20, top: 0 },
    { input: card, left: 0, top: 0 },
    { input: lights, left: PANEL + 36, top: 30 }, { input: lights, left: PANEL + 36 + 340, top: 30 },
    { input: await svgFile('sun.svg', 92), left: PANEL + 62, top: 92 },
    { input: await svgFile('shine.svg', 92), left: W - 150, top: 92 },
    await center(title, 154),
    await center(await svgFile('divider-vine.svg', 420), 290),
    await center(sub, 318),
    await center(sub2, 370),
    await center(date, 440),
    await center(team, 500),
    { input: await svgFile('leaf-maple-1.svg', 64), left: W - 96, top: H - 108 },
    { input: await svgFile('leaf-gingko.svg', 48), left: PANEL + 46, top: H - 96 },
  ];
  const out = join(OUT, 'og-share.jpg');
  await sharp({ create: { width: W, height: H, channels: 3, background: '#fbf5e6' } })
    .composite(layers).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
  await sharp(out).webp({ quality: 82 }).toFile(join(OUT, 'og-share.webp'));
  report.push(['og-share', `${W}x${H}`, 'q84', `${kb(out)} KB`, `${kb(join(OUT, 'og-share.webp'))} KB webp`]);
}

mkdirSync(OUT, { recursive: true });
const [, , cliSrc, cliName, cliWidths] = process.argv;
if (cliSrc) {
  if (!cliName) throw new Error('usage: node optimize-images.mjs <src> <name> [w1,w2]');
  await writeVariants(resolve(cliSrc), cliName, (cliWidths || '800,1600').split(',').map(Number));
} else {
  for (const j of JOBS) await writeVariants(join(ASSETS, j.src), j.name, j.widths, j.budgetKB);
  await buildOg();
}
console.table(report.map(([file, size, q, jpg, webp]) => ({ file, size, q, jpg, webp })));
