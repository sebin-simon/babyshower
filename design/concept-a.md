# Concept A: "The Little Light"

**UX Lead A, Story & Motion.** Sketch: `design/sketches/a.html` (open from disk; add `?g=priya` for a personal invite).

## Big idea

The baby is "our little light". A guest scrolls through **one day in the golden forest**, from dawn to lantern-lit night. A small glowing light goes with them the whole way. At the fork in the path the guest decides where the light goes: it turns into a **Sun** or a **Shine** and stays in that form for the rest of their visit. On reveal day the little light finally shows its true form.

The light is what tells the story. The sky, the leaves, the lanterns and the fireflies all change with it.

---

## Information architecture (guest page)

| # | Section | Sky | Purpose |
|---|---|---|---|
| 1 | **Hero**: "sunshine" splits into "sun · or · shine" | Dawn | Hook, personal greeting, date and place chips, one main CTA |
| 2 | **The invitation**: a letter that unfolds | Morning | The hosts' note, When/Where/Gifts, Google Calendar, .ics, Maps |
| 3 | **Our story**: storybook ⟷ real-life wipe + polaroids | Midday | The emotional photo moment; 3–6 story photos |
| 4 | **First look**: sonogram polaroid | Midday | Ultrasound slot ("coming soon") with a heartbeat |
| 5 | **Who will baby look like?** | Afternoon | Playful slider between the two parents' baby photos |
| 6 | **The big question**: the fork in the path | Golden hour | Sun vs. Shine vote (pre-fills the RSVP) |
| 7 | **Send us your light**: RSVP | Last light | Form; the submit becomes a rising lantern |
| — | **Sunset divider**: the treeline swallows the sun | Sunset | Story beat; lanterns switch on as you scroll |
| 8 | **Jars of light**: live tally | Dusk | Two firefly jars and a split bar, updating live |
| 9 | **The wishing line** | Night | Gift-tag wishes hanging under fairy lights |
| 10 | **See you under the canopy** | Night | Countdown, calendar, critters, sign-off |

Persistent elements: the **little light rail** (a progress orb on the right edge; tap it to jump to the vote) and a **sticky mobile CTA** ("Cast your guess & RSVP"). The CTA hides while the vote or RSVP is on screen, and for good once the guest has RSVPed.

Section eyebrows use **times of day, not clock times** ("Golden hour · The big question"), so guests never mistake them for the party schedule.

---

## The scroll narrative: what changes as you scroll

- **Sky colour**: a fixed gradient behind everything blends between section palettes: dawn cream → noon gold → honey → sunset rose → dusk maroon → night plum. The blend is driven by which section is at the viewport centre, with smoothstep easing.
- **The sun itself**: a soft glow crosses the sky from right to left along an arc as you scroll, then fades out at sunset.
- **Leaves**: the canvas leaves fall all the time, and your scroll speed adds a gust and parallax (leaves "lift" as you scroll down). At night they dim to 45%.
- **Bokeh → fireflies**: warm daytime bokeh fades out as darkness rises and fireflies fade in. The "darkness" value comes from the palette.
- **Lanterns wake up**: the sunset treeline's lanterns light one by one, scrubbed to the scroll. The wishing-line bulbs switch on in sequence when each line enters the view.
- **The canopy parts**: on load, the leafy branches in the top corners sweep in. On scroll they drift up and out, as if you are walking under them.
- **The little light rail** moves down the edge as you progress. After you vote it becomes a ☀ or a ✦.

---

## Signature interactions

### 1. The split (hero, on load)
The title first reads **"sunshine"** in maroon. After 1.9 s the two words slide apart, "or" pops in between them in hand script, "sun" warms to denim blue and "shine" to berry, and a tiny sun and a sparkle pop above them with a little particle burst. In 3 seconds it explains the whole theme without a single sentence.

### 2. Voting: "Which way will the little light go?"
- A dotted forest path **forks** into two big cards: a smiling sun (Team Sun · boy 💙) and a smiling four-point sparkle (Team Shine · girl 💖). The little light bobs where the path splits.
- Tap a side: the light **travels down that branch** (1.15 s, power2.inOut), and the trail lights up behind it in the team colour. Then it **becomes** the card's icon: an elastic pop, a particle burst (sun: blue-gold sparks and maple leaves; shine: pink glitter) and a short haptic tap.
- The chosen card gets a "My guess" badge and a glow. The other card dims. A blue or pink wash blooms on that side of the screen.
- The guess is synced into the RSVP field (and back the other way). Switching sides un-lights the old trail and sends the light down the new one.
- For accessibility these are `aria-pressed` buttons, the status text is in an `aria-live` region, and the RSVP has native radios.

### 3. RSVP submit: "Send my light"
- The submit button throws out a burst of sparks. A **paper lantern** appears at the button, tinted by the guest's team. The form card blurs, shrinks and fades away.
- The lantern **rises off the top of the screen** (3.6 s), swaying and leaving a trail of sparks. The thank-you card fades up in its place and scrolls into the centre: "Your light is on its way, Meera!", the guess pill, Add to calendar and Edit my RSVP.
- About 1.4 s later the guest's **firefly flies into their team's jar** and their **wish is pinned to the wishing line** with an elastic swing.
- The message changes with the answer: Yes ("See you under the golden canopy"), Maybe ("We'll keep a lantern lit") or No ("We'll miss you").

### 4. Live tally: "Jars of light"
- Two glass mason jars with cork lids. Every vote is a **firefly** floating inside (up to 44 drawn). A glowing **liquid light level** rises with the share of votes.
- Big count-up numbers, percentages, and a **split bar** with the little light sitting at the boundary.
- When a new vote arrives live: a toast ("✨ Anjali just joined Team Shine"), a glowing mote arcs into the jar, the level eases up and the number ticks. In the sketch this is simulated every 9 s while the section is on screen.

### 5. The wishing line
- Rows of fairy lights sag across the night sky. Each wish is a **cream gift tag** on twine with a wooden clothespin, a team-coloured band, handwritten text (Caveat) and a "First name · Team Sun ☀" footer.
- When a line scrolls into view its bulbs light from left to right and the tags **swing in** (elastic). They then sway slowly forever, each with its own phase.
- A row holds 2 tags on a phone, 3 on a tablet and 4 on a desktop. Phones show 6 wishes plus a "Show all wishes" button. The guest's own wish gets a gold glow.

---

## Photos and placeholders

| Asset | Where | Treatment |
|---|---|---|
| `Gemini_…buettk…jpeg` (lantern-lit cartoon, empty bottom) | Hero | **Arched window** with a cream double rim and two swinging lanterns outside the arch; slow zoom parallax |
| `DSC_4735.JPG` (real photo) + `Gemini_…r6tell…jpeg` (illustrated twin) | Our story | **Storybook ⟷ real life wipe**: the two images line up almost exactly. The wipe sweeps from storybook to real as you scroll in; the guest can drag the maple-leaf handle (pointer/touch; horizontal-only, so vertical scrolling still works) or use the arrow keys |
| `cartoon.jpeg` | Story polaroid "Our storybook" | One real image among the placeholder polaroids |
| 3–6 story photos (to come) | Polaroid row | Taped polaroids with a watercolour gold wash, a dashed inner frame, a doodle icon (camera, mountain, heart, leaf) and "photo coming soon ✨". Captions are suggestions: *How we met, First adventure, The day we found out, Bump & beanie season*. Mobile: horizontal snap carousel; desktop: one dealt row |
| Ultrasound (to come) | First look | A **live sonogram screen**: a dark screen with the scan fan, a sweeping scan line, a pulsing pink heart and an EKG trace drawing itself, plus "Ultrasound coming soon ✨". The real scan drops into the same frame |
| Ayana and Sebin baby photos (to come) | Who will baby look like? | Three circles: Baby Ayana · **"?" mix** · Baby Sebin. The slider **crossfades** the two photos in the middle circle (real morph-blend once the photos arrive). Placeholders use onesie doodles on peach and honey washes |

All images below the fold use `loading="lazy"`. **For the real build**, export DSC_4735 as WebP/AVIF at 1600 px and 900 px wide (about 150–250 KB) with a `srcset`. Do the same for the r6tell pair so the wipe stays sharp.

---

## Reveal day (host page)

The host taps **"It's a Sun!"** or **"It's a Shine!"** and the screen goes full-screen (dialog, focus trapped, Esc closes). It is built to be shown on a TV or projector, or AirPlayed from a phone.

**Shared lead-in (0–4.2 s)**
1. The lights go out to night (#120a0e). "Ayana & Sebin's little light is…" appears in gold script.
2. The **little light** appears and embers **converge** into it from the edges.
3. **Three heartbeats**, each bigger (1.3× → 1.5× → 1.75×): the drum roll.
4. The orb swells to fill the screen, then a **warm white flash**.

**Sun (boy)**: a **sunrise**. A huge sun with slowly turning rays rises from the bottom (2.4 s, power3.out) into a blue sky that runs from gold at the horizon to deep blue. Blue and gold confetti fountains up from the bottom centre, maple leaves cannon in from both bottom corners, then a gentle rain of leaves and confetti continues. "It's a / **Sun!**" (letters drop in, back.out) and "It's a baby boy 💙".

**Shine (girl)**: a **starburst**. The orb bursts into about 240 pink, gold and white sparkles that drift down. The sky turns into a rose-to-plum twilight, a twinkling star field fades in and glitter keeps drizzling. "It's a / **Shine!**" and "It's a baby girl 💖".

**The lantern draw (name spinner)**
- "Find our lucky guessers →" leads to **The lantern draw**. One big glowing lantern shows names in its glass panel.
- The host picks the number of winners (**5–7**, default 6). The pool contains **only guests who guessed correctly**, and the screen says how many ("Drawing from 22 guests who guessed Sun").
- Tap **Draw winner 1 of 6**: names flicker through the glass like a candle (each tick is 12% slower; about 3.3 s in all), land with a scale pop, the lantern **flares**, sparks burst, and the winner drops into a numbered chip row below. Each winner leaves the pool. The button counts up until "All 6 lucky guessers found 🎉".
- Build note: pick the winner with `crypto.getRandomValues` before the animation starts; the animation only presents the result. If the page reloads mid-draw, keep the results in the Sheet.

---

## Motion spec

| Element | Trigger | Duration | Easing | Reduced-motion fallback |
|---|---|---|---|---|
| Canopy sweep-in | Load | 1.8 s | power3.out | Static in place |
| Title letters rise | Load +0.4 s | 0.9 s, 55 ms stagger | back.out(1.7) | Static |
| **Sunshine → sun·or·shine split** | Load +1.9 s | 1.15 s (+0.8 s "or" pop) | expo.inOut / back.out(2.4) | Final split state shown |
| Hero art rise | Load +0.55 s | 1.4 s | power3.out | Static |
| Canopy / hero parallax | Scroll (scrub) | Linked to scroll | none | Off |
| Sky time-of-day blend | Scroll | Continuous | smoothstep | **Kept** (colour only, no movement) |
| Falling leaves, bokeh, fireflies (canvas) | Always | Continuous | Sine sway | Canvas hidden |
| Section reveals (`.rv`) | Enter at 88% | 1 s, 0.1 s stagger | power3.out | Visible immediately |
| Invitation unfold | Enter | 1.5 s | power3.out (rotateX −72°→0) | Static |
| Storybook→real wipe | Scroll (scrub 0.8) | Linked to scroll | none | Set to 50% |
| Polaroid deal | Enter | 1.1 s, 0.12 s stagger | back.out(1.3) | Static, with CSS tilt |
| Sonogram scan / heart / EKG | Always | 3.2 s / 1.1 s / 2.4 s loops | ease-in-out / linear | One frame, trace fully drawn |
| Fork path draw-in | Enter | 1.6 s | power2.out | Static |
| **Vote: light travels the fork** | Tap | 1.15 s | power2.inOut | Trail lit at once, no orb |
| Vote: icon pop + burst | End of travel | 1.1 s / ~1.2 s particles | elastic.out(1,.4) | No burst; state change only |
| RSVP form exit | Submit | 0.55 s | power2.in | Instant swap |
| **RSVP lantern rise** | Submit | 3.6 s rise, 0.6 s sway yoyo | power1.in / sine.inOut | No lantern; thank-you card shown |
| Firefly mote → jar | New vote | 1.1 s | sine.inOut (x) + back.in (y) | Count updates in place |
| Jar level / counts | Enter / vote | 1.8 s / 1.6 s | power3.out / power2.out | Final values |
| Lantern lamps at sunset | Scroll (scrub) | Linked to scroll | none | Static (dim) |
| Wishing tags swing-in | Line enters | 2.2 s, 0.14 s stagger | elastic.out(1,.32) | Static |
| Tag idle sway / bulb twinkle | Always | 6 s / 3.4 s loops | ease-in-out | Off |
| Reveal lead-in (dark, orb, 3 beats) | Host tap | 4.2 s | back.out(2) / power2.out | Skipped |
| Reveal flash | 4.1 s | 0.14 s in, 1.3 s out | power2.out | None |
| Sunrise / starburst | 4.24 s | 2.4 s / ~3 s particles | power3.out | Final sky and title shown at once |
| Reveal title letters | 4.45 s | 1.1 s, 70 ms stagger | back.out(2.2) | Static |
| Lantern-draw reel | Draw tap | ~3.3 s (×1.12 per tick) | Geometric slow-down | Name appears at once |
| Winner land / chip | Reel end | 0.7 s / 0.8 s | ease-out / back.out(2.4) | Static |

Haptics (`navigator.vibrate`, where supported): vote 18 ms; RSVP 12-40-18; reveal 30-60-30-60-120; each winner 20-40-60.

---

## Type and colour

**Google Fonts only**
- **Fraunces** (variable; `SOFT 100, WONK 1`) for display and headings. It is soft and storybook-like without being childish, and its lowercase "sun or shine" is the logo.
- **Nunito** (400–800) for body text and the UI. It is rounded, friendly and very readable at 16–18 px.
- **Caveat** (500/700) for handwriting: the greeting, signatures, wishes, captions and "or".

**Colour tokens**
- Canopy gold `#f2c230`, gold `#e8a317`, honey `#c9841a`, honey-ink `#8a4b12`
- Bark `#5a3a1e`, ink `#3a2414`, maroon `#6b1f2a` (headings and primary buttons), cream `#fbf5e6`, paper `#fffaf0`, lantern glow `#ffd98a`
- **Sun**: `#2f6fb5` (fills), `#24518a` (text), `#a9d2ff` / `#e3f0ff` (soft and wash)
- **Shine**: `#d2468a` (fills), `#9c2b5c` (text), `#ffb8d9` / `#ffe6f1` (soft and wash)
- Sky palettes: dawn `#fff8ea→#f8d898` · noon `#fff3c2→#f4c443` · golden `#ffe3a6→#eba24a` · sunset `#f7b27a→#8a2f4c` · dusk `#5b1d29→#24111a` · night `#24111a→#0f070b`
- Contrast: body text always sits on cream or paper cards, or on dark night skies. Maroon and ink on gold stay above 4.5:1. The team text colours (`#24518a`, `#9c2b5c`) pass AA on cream. The reveal titles are white and very large on mid-blue or rose (AA for large text).
- A paper-grain overlay (SVG turbulence at 22%, multiply) gives the watercolour-print feel with no image weight.

---

## Mobile-first notes

- It is designed at **390 px** first. The hero fits the first screen: greeting, title, arched art, chips and CTA. The 2-column hero starts at 960 px.
- **Thumb zone**: the sticky bottom CTA, controls at least 48 px tall (vote cards are about 170 px), RSVP steppers instead of number inputs, and large segmented radios for attending and team.
- `type="tel"` and `inputmode` on the phone field, `autocomplete` on the name and phone fields, and the wish textarea set in handwriting so it feels personal.
- The story polaroids are a horizontal **snap carousel** on phones, which avoids a long vertical stack. The wipe only takes horizontal drags, so it never traps scrolling.
- Canvas DPR is capped at 2. There are 14 leaves on a phone and 28 on a desktop. The ambient loop is one rAF, which pauses in background tabs. The particle loop stops when no particles are left.
- Personal links: `?g=token` → "Priya, you're invited", a pre-filled RSVP, their earlier guess already lit on the fork, and "Welcome back" on the form.
- `theme-color` follows the sky, so the phone's browser chrome changes from gold to night as you scroll (a small touch that people notice).
- Performance for the build: inline the critical CSS, preload the hero image at about 900 px wide as WebP, lazy-load everything else, and `defer` GSAP. The page must be readable without JS (the reveal animations only add on top).

---

## What we need from the hosts

1. **Ultrasound image**, both parents' **baby photos** (similar crops: face-centred and square-ish) and **3–6 story photos** with short captions.
2. **The end time** of the event (the calendar currently assumes 12–3 PM PT).
3. Whether to **show the live tally to guests** before reveal day, or hide it until then.
4. **Moderation** for the wishing line: auto-publish, or host approval first?
5. Prize count and naming for the lantern draw (5, 6 or 7), and whether names show with a last initial.
