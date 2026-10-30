# Sun or Shine: brand toolkit

Shared visual system for either UX concept. Tokens live in `site/css/tokens.css`. To review every asset, open `design/sketches/assets-preview.html` over a local server (for example `python3 -m http.server` from the repo root), because external sprite `<use>` refs do not load on `file://`.

## 1. Palette

These colours were sampled from `assets/` (invite canopy, card, maroon sweater and lettering, lanterns, the blue bird, the pink flowers). All are defined as `--c-*` on `:root`.

| Token | Hex | Role |
|---|---|---|
| `--c-canopy-gold` | `#f2c230` | Sunlit maple/gingko canopy, primary accent |
| `--c-canopy-amber` | `#e8a317` | Deeper canopy, falling leaves |
| `--c-honey` | `#c9841a` | Leaf shadow, outlines on gold (decor only) |
| `--c-honey-deep` | `#8f5a10` | Honey for text, dark-gold backgrounds |
| `--c-rust` | `#a4511f` | Forest-floor leaves, oak, mushroom |
| `--c-haze` | `#f9dd9c` | Backlit sky between the trees |
| `--c-lantern-glow` | `#ffd98a` | Lantern and fairy-light glow |
| `--c-lantern-core` | `#fff6d6` | Flame and bulb hot spot, highlights |
| `--c-bark` | `#5a3a1e` | Trunks, illustration outlines, muted text |
| `--c-bark-deep` | `#3b2412` | Dark sections, footer, heavy outlines |
| `--c-ink` | `#2a180c` | Body text |
| `--c-maroon` | `#6b1f2a` | Display headings, primary buttons (invite lettering, sweater) |
| `--c-maroon-soft` | `#7a2533` | Hover, borders |
| `--c-cream` | `#fbf5e6` | Page background (invite note card) |
| `--c-paper` | `#f3e9d2` | Inset panels, card shade |
| `--c-sun-blue` / `-deep` / `-soft` | `#6fa3d6` / `#2c5d8f` / `#d6e7f6` | Team Sun (boy) fill / text / tint |
| `--c-shine-pink` / `-deep` / `-soft` | `#ec8fb0` / `#a3365f` / `#fadbe5` | Team Shine (girl) fill / text / tint |

Semantic aliases include `--color-bg`, `--color-text`, `--color-heading`, `--color-sun`, `--color-shine` and `--color-focus`. Gradients include `--grad-canopy`, `--grad-dusk`, `--grad-sun`, `--grad-shine` and `--grad-lantern`.

### WCAG AA text pairs (computed, ratio : 1)

These pairs pass AA for normal text (4.5:1 or higher). AAA means 7:1 or higher.
- **On cream:** ink 15.6 (AAA), maroon 10.4 (AAA), maroon-soft 9.0 (AAA), bark 9.4 (AAA), sun-blue-deep 6.3, shine-pink-deep 5.9, honey-deep 5.3, rust 5.1
- **On paper:** maroon 9.4 (AAA), bark 8.5 (AAA)
- **On lantern-glow / haze:** maroon 8.4 / 8.6 (AAA), bark 7.6 (AAA), bark-deep on haze 11.0 (AAA)
- **On canopy-gold:** ink 10.2 (AAA), bark-deep 8.7 (AAA), maroon 6.8, bark 6.1
- **On canopy-amber:** ink 7.8 (AAA), bark-deep 6.7
- **On maroon:** cream 10.4 (AAA), lantern-glow 8.4 (AAA)
- **On bark / bark-deep:** cream 9.4 / 13.3 (AAA), lantern-glow 7.6 / 10.7 (AAA), canopy-gold on bark-deep 8.7 (AAA)
- **Team buttons:** white on sun-blue-deep 6.8, white on shine-pink-deep 6.5, cream on either is at least 5.9
- **On team tints:** sun-blue-deep on sun-blue-soft 5.4, shine-pink-deep on shine-pink-soft 5.0, ink on either at least 13.2, maroon on shine-pink-soft 8.8
- **Dark text on team fills:** bark-deep on sun-blue 5.5, bark-deep on shine-pink 6.3

These pairs **fail** as text, so use them for decoration only: honey on cream (2.8), sun-blue on cream (2.5), shine-pink on cream (2.1). Use the `-deep` variants for team-coloured words.

## 2. Type (Google Fonts only)

- **Display: Courgette.** A warm brush-lettered script that echoes the invite's maroon hand-lettering and stays legible at headline sizes. Use it in maroon for h1/h2, the hero "Sun or Shine?" and reveal text. It has one weight (400), so never apply a faux bold.
- **Hand: Caveat (500/700).** Handwriting for the wishes wall, sticky notes, polaroid captions and the name spinner. Use 22px or larger.
- **Body: Nunito (400/600/700/800, italic 400).** Rounded and very readable on phones. Use it for all UI, forms, details and buttons (700–800).

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Courgette&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
```

The scale is fluid with `clamp()`, giving 360px and desktop values:

| Token | 360px to desktop | Use |
|---|---|---|
| `--fs-display` | 46 to 84px | Hero title (Courgette) |
| `--fs-3xl` | 38 to 60px | h1 |
| `--fs-2xl` | 30 to 42px | h2 |
| `--fs-xl` | 24 to 30px | h3, Caveat wishes |
| `--fs-lg` | 20 to 22px | Lead, h4 |
| `--fs-base` | 17 to 18px | Body |
| `--fs-sm` | 15px | Labels, captions |
| `--fs-xs` | 13px | Fine print only |

Line heights are `--lh-tight` 1.1 for display, `--lh-snug` 1.3 and `--lh-body` 1.6. Keep the measure to `--measure` (38rem). Never set body copy in Courgette or Caveat.

## 3. Iconography and illustration (`site/img/svg/`)

- **Style:** flat storybook shapes with soft round joins and a thin bark outline (`#5a3a1e`, about 1.5–3% of the art size). Each shape has one tonal layer: a translucent bark shade on the shadow side and a lantern-core highlight on the lit side, at 12–55% opacity. Avoid hard black, gradients and drop shadows inside the art. Faces are tiny dark dots or closed-arc eyes, a soft smile and pink cheeks at 60% opacity.
- **Colour:** use palette hexes only. Leaves and the bird use `currentColor`, with the leaves defaulting to gold, amber or rust and the bird to Sun blue. Tint them with CSS `color`, for example `color: var(--c-shine-pink)` for a Team Shine bird.
- **Files:** `leaf-maple-1`, `leaf-maple-2`, `leaf-gingko`, `leaf-oak`, `sun`, `shine`, `lantern`, `string-lights`, `hedgehog`, `squirrel`, `bird`, `acorn`, `mushroom`, `frame-polaroid`, `frame-lantern`, `divider-vine`, `heart-leaf`, plus `sprite.svg`. Every file has a `viewBox`, no external refs, no internal `url(#)` refs, and a `<title>`. The vine is `aria-hidden`.
- **Animatable groups (inline the file to animate them):**
  - `sun.svg`: `<g id="rays" class="rays">`. Rotate it around `100px 100px` (`transform-box: view-box`).
  - `shine.svg`: `<g id="twinkles" class="twinkles">`. Scale or fade each child.
  - `lantern.svg`: `<g id="glow" class="glow">`. Pulse its opacity, and pivot the sway from the ring at `60px 12px`.
  - `string-lights.svg`: each bulb is a `g.bulb`, ready for a staggered twinkle.
  - `frame-lantern.svg`: its halo is `g.glow`.
- **Sprite:** `<svg><use href="img/svg/sprite.svg#sun"/></svg>`. The symbol IDs match the file names. Use it for static repeats such as decorations, list bullets and the logo. Page CSS cannot reach inside a `<use>`, so inline the file when you need animation. Rebuild the sprite with `node dev/build-sprite.mjs`.
- **Logo mark:** `heart-leaf.svg` shows hands making a heart around a gold maple leaf on a maroon heart, echoing the bump pose. Keep at least 24px of clear space around it and use a minimum size of 32px. On dark backgrounds, add `--filter-glow`.
- **Frames:** the photo windows are transparent, so place the photo underneath and the frame on top. Window positions as a percentage of the frame box:
  - `frame-polaroid` (300×360): left 6.67%, top 5.56%, width 85.33%, height 72.22%. The caption area is the bottom band, so use Caveat there.
  - `frame-lantern` (300×400): an arched window. Left 16.67%, top 22.5%, width 66.67%, height 62.5%, with `border-radius: 50% 50% 0 0 / 40% 40% 0 0` on the photo.
- **String lights:** the file is 200×48 and tiles horizontally, with hang points at x=0 and x=200. Use `background: url(string-lights.svg) repeat-x 0 0 / 200px 48px`.
- **Leaf particles (canvas):** draw from the four leaf SVGs, pre-rendered once to offscreen bitmaps at 24–56px. Mix them roughly 40% maple-1, 25% maple-2, 25% gingko and 10% oak, with colours drawn from gold, amber, honey and rust.

## 4. Texture

- **Paper grain:** apply grain to the cream surfaces only. Use an inline SVG `feTurbulence` data-URI (baseFrequency about 0.8, numOctaves 3), drawn as a `::before` overlay at 4–6% opacity with `mix-blend-mode: multiply`. Cards can add a 1px inset highlight (`--shadow-paper`).
- **Watercolour wash:** build soft blotches from 2–3 radial gradients of haze, lantern-glow and canopy-gold at 25–50% alpha, using irregular positions or `--radius-blob` shapes. Blur them 20–40px and keep them behind content. Section edges should be wavy or scalloped SVG paths, not straight lines; see the OG card's wave edge.
- **Bokeh:** draw lantern-glow and lantern-core circles at 10–35% alpha on canvas, slowly drifting. Keep them sparse on mobile (30 or fewer).
- **Photos:** always frame them (polaroid, lantern, or a `--radius-lg` card with `--shadow-paper`). Never place them full-bleed under text without a cream or dusk scrim.

## 5. Shadow and glow

- **Shadows are always warm** (bark-tinted rgba, never grey or black):
  - `--shadow-sm`: chips and inputs
  - `--shadow-md`: cards
  - `--shadow-lg`: modals and the reveal card
  - `--shadow-paper`: invite and polaroid cards
  - `--shadow-inset`: wells and swatches
- **Glows:**
  - `--glow-lantern`: a box-shadow halo for the RSVP button, a winner's name or a lit lantern.
  - `--glow-soft`: hover.
  - `--glow-sun` and `--glow-shine`: the selected team vote card, a ring plus a halo.
  - `--glow-text`: a text-shadow for Courgette headings on dark or dusk backgrounds.
  - `--filter-glow`: a `drop-shadow` stack for SVGs and PNGs.
- **Focus:** `--focus-ring` (a cream gap and a sun-blue-deep ring) is visible on every background.
- **Motion:**
  - Easings are `--ease-out`, `--ease-bounce` (for pops) and `--ease-float` (for drifting).
  - Durations are `--dur-fast`, `--dur-base`, `--dur-slow` and `--dur-drift`.
  - Under `prefers-reduced-motion` the duration tokens drop to 0. Stop the particle loops and show a static scatter of leaves instead.

## 6. Raster assets (`site/img/photos/`)

Each image has a JPEG and a WebP at the same base name. The `-N` suffix is the target width, but files are never upscaled beyond the source:
- `couple-real-800` / `-1600` (real photo, 3:2)
- `cartoon-600` / `-1200` (portrait; the 1200 is the native 896×1200)
- `cartoon-hero-800` / `-1600` (native 896×1200, with an empty bottom band for overlaid text)
- `illustrated-wide-1000` / `-1800` (landscape; the 1800 is the native 1264×842)
- `og-share.jpg` (1200×630, for `og:image` and `twitter:image`)

Regenerate them with `cd dev && npm install && npm run images`. For a one-off photo, run `node optimize-images.mjs <src> <name> 800,1600`. To add a photo permanently, add a `JOBS` entry. The OG card's fonts (OFL) are bundled in `dev/fonts/` and converted to paths, so the card renders identically on any machine.
