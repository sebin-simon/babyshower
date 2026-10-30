// Rebuilds site/img/svg/sprite.svg from the individual SVGs in that folder.
// Usage (from dev/): node build-sprite.mjs
// Each file becomes <symbol id="<filename-without-.svg>">. Inner ids (rays, twinkles, glow) are
// dropped in favour of the classes already on those groups, so the sprite never duplicates ids.
// Note: <use> content lives in a closed shadow tree, so page CSS cannot animate parts of a symbol.
// Inline the individual file when you need to animate #rays / #twinkles / #glow.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../site/img/svg');
const files = readdirSync(DIR).filter(f => f.endsWith('.svg') && f !== 'sprite.svg').sort();

const symbols = files.map(f => {
  const src = readFileSync(join(DIR, f), 'utf8');
  const viewBox = src.match(/viewBox="([^"]+)"/)[1];
  const title = (src.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const inner = src
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/\s(id)="[^"]*"/g, '');
  const id = f.replace(/\.svg$/, '');
  return `<symbol id="${id}" viewBox="${viewBox}">${title ? `<title>${title}</title>` : ''}${inner}</symbol>`;
});

const out = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join('')}</svg>\n`;
writeFileSync(join(DIR, 'sprite.svg'), out);
console.log(`sprite.svg: ${symbols.length} symbols, ${(out.length / 1024).toFixed(1)} KB`);
