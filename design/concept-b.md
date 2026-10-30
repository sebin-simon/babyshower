# Concept B: "Light a Lantern"
*UX Lead B, Guest & Host Experience. Sketch: `design/sketches/b.html` (use the Guest/Host toggle and the "States" menu)*

## Big idea
**Every guest is a light.** The golden forest from the invite has a string of fairy lights running through it. When you RSVP, you light your own lantern on that string, and your guess tints it Sun-blue or Shine-pink. The tally *is* the string. On reveal day the forest goes dark, one half of the word **SUN·SHINE** flickers out like a spent bulb, and the other half blazes. Then a lantern-window name reel picks the lucky guessers.

The metaphor also sets the UX rules: **lighting a lantern takes 3 taps, never a form**, and the host gets a dimmer switch (the host page) for the whole forest.

---

## 1. Guest flow (from the SMS link)
| Step | Personal link `?g=pr7k` | Generic link (QR code, forwarded text) |
|---|---|---|
| Land | Greeting chip *"Hi Priya! This invite is just for you"* above the title. A shimmer skeleton shows for up to 1s while the token resolves; the page never blocks on it. | *"You're invited! Bring your best guess"* |
| Hero CTA | **RSVP & vote** (60px, above the fold at 390×664). Microcopy: "about 30 seconds, 3 taps" | same |
| Q1 | Can you make it? **Yes / Maybe / Can't**, shown as 3 big tiles | same |
| Q2 | Adults/kids steppers, **prefilled from the host's invite** (e.g. 2 + 1) | defaults to 1 adult, 0 kids |
| Q3 | Sun or Shine lantern tiles | same |
| Q4 | *skipped*: the name and phone shown on the card come from the token ("Priya Raman · (425) •••-0142 · **Not you?**") | Name + mobile. **Typing comes last**, so the keyboard never covers the fun part |
| Submit | **Light my lantern** | same |
| Confirm | Lantern drops in and glows in the team colour. Summary chips, Add to Calendar, Edit | + "Copy your personal link" (the backend returns a token, which is also stored in localStorage) |

**Timing for a personal link:** tap Yes, tap Shine, tap Light (the counts are prefilled). That's 3 taps and about 10 seconds.

**If they choose "Can't":** the steppers collapse, Q3 becomes *"Still want to guess?"* and the button changes to **"Send my love & guess"**. People who decline can still vote and leave a wish.

**Coming back later:** opening the same link greets them with *"Welcome back, Priya! You're Team Sun ☀️"* and lands on the confirmation card, with the hero CTA changed to **Edit my RSVP**. Edit reopens the form with everything prefilled, and the button reads **Update my lantern**. On a generic link, a matching phone number updates the existing row instead of creating a duplicate.

**After RSVP (mobile):** a sticky dock shows **"You're Team Shine ✨ · Edit"**. Before RSVP it shows **RSVP & vote · 30 sec**. The dock hides whenever the hero CTA or the RSVP card is on screen, so there are never two CTAs.

### States
- **Loading:** a shimmer on the greeting chip and the tally numbers. The submit button flickers a flame and reads "Lighting your lantern…" (`aria-busy`). The rest of the page stays interactive.
- **Validation:** checked on submit only, never while typing. The page scrolls to and focuses the first problem. Each error is an icon plus text (never colour alone), linked with `aria-describedby`:
  - "Pick one: Yes, Maybe or Can't."
  - "Take a guess! Tap Sun or Shine."
  - "Add your name so we know whose lantern this is."
  - "That number looks short. Please use 10 digits." The phone field auto-formats to `(425) 555-0123` and strips a leading +1.
- **Network error:** *"We couldn't reach the forest just now. Your answers are safe on this phone."* with a **Try again** button. Answers are queued in localStorage and retried automatically on `online`.
- **Unknown or expired token:** a friendly alert ("you're still very welcome"), then the generic flow. It is never a dead end.
- **Empty wishes wall:** an unlit-lantern illustration, "No wishes yet. Be the first…", and a CTA.
- **Tally failed to load:** the string shows unlit bulbs and "Counting lanterns…". It never shows 0 vs 0.

## 2. Information architecture (guest page, in order)
1. **Hero:** the cartoon (`buettk…`, whose empty bottom fades into cream), greeting chip, *Sun or Shine?*, date and place chips, CTA. On desktop the cartoon sits in an arched frame on the right.
2. *Light-string divider*
3. **RSVP card + live tally.** These stack on mobile; on desktop they sit side by side, with the tally sticky. **The RSVP is the second thing on the page, not the last.**
4. **Details:** the hosts' note on a cream card (the invitation's look), a When card (Google Calendar + .ics), and a Where card (Google + Apple Maps). "No wrapped gifts" lives inside the note.
5. *Light-string divider*
6. **Photo moments:** the real photo, the ultrasound, "Who will baby look like?" and the story strip.
7. **Wishes wall:** show 6, then "Show all".
8. **Footer:** "With love, Ayana & Sebin" and a contact number for questions.

## 3. RSVP form design
- **Field order:** attending, then counts, then guess, then (generic links only) name and phone. Taps build momentum before any typing, and the name and phone are the only fields that need a keyboard.
- **Steppers:** 48px round − and + buttons with a large Fraunces numeral, `role="group"` and an `aria-live` output. Adults run 1–10 ("including you") and kids 0–10 ("under 12"). Buttons disable at the limits. The two steppers sit side by side at 480px and up.
- **The Sun/Shine control:** two radio tiles, each with an *unlit* SVG lantern. When you tap one, the lantern lights (the glass fills with blue or pink and gets a soft glow), swings on an elastic ease, and throws a small burst of sparks. A ✓ badge appears and the tile shows its live count ("17 lanterns lit"). It's a native radio, so arrow keys, screen readers and the focus ring all work for free.
- **Optional fun goes *after* the commit, in a "Bonus round ⭐ optional" section on the confirmation card.** The RSVP is already saved, so these extras can never block it:
  - *A wish for baby*: a textarea in the Caveat handwriting font, with tap-to-start prompts ("I hope you always…", "First adventure…", "Never forget…"). **Hang my wish** saves it, then shows "On the wall" and the wish appears on the wall, highlighted.
  - *Got a name in mind?*: two small inputs, **If Sun** and **If Shine**. These are sent to the hosts only and never shown publicly.

## 4. Photo usage
| Asset | Where | Treatment |
|---|---|---|
| Cartoon `Gemini_…buettk…` | Hero, and the link-preview image (`og:image`) | Bottom fades to cream on mobile; arched frame on desktop. Export WebP at 900w and 1400w, under 180 KB |
| Real photo `DSC_4735.JPG` | Lead image in Photo moments | Taped polaroid, tilted −1.2°, caption in Caveat. **Must be exported** at 1600w and 800w WebP (~150–250 KB) and lazy-loaded. The 12 MB original never ships |
| `cartoon.jpeg` | Fallback OG image and the host's SMS preview | — |
| **Ultrasound** (placeholder) | Next to the photo | A dark sonogram card drawn in SVG (scan fan, arcs, a "bean" curl, a tiny pink heart), titled *"Hello, little bean."* The real scan drops into the same frame |
| **Baby Ayana / Baby Sebin** (placeholders) | "Who will baby look like?" | Two gilded oval portrait frames with a "?" medallion between them. Each holds a doodled baby face and a "photo soon" pill. *Stretch:* a 3-chip mini poll (Mom's twin / Perfect mix / Dad's twin) |
| **3–6 story photos** (placeholders) | Horizontal polaroid strip, scroll-snapped on mobile, 5 across on desktop | Each placeholder has a warm watercolour gradient, a line icon and a caption ("How we met", "The big yes", "Our first home", "We found out!", "Bump, week 20"). Swap in real photos 1:1 at a 4:5 ratio |

## 5. Host page (hidden, e.g. `/host.html`, `noindex`, not linked)
**Gate:** a dark forest screen with a glowing lantern and a 4-digit PIN pad (68px keys; a hardware keyboard also works). A wrong code shakes the dots and adds a back-off. The session lasts 12h in sessionStorage. The PIN is checked server-side by Apps Script, never in client JS.

**Navigation:** a bottom tab bar on the phone and a top bar on desktop. Tabs are **Overview · RSVPs · Invites · Reveal**, with ARIA tabs and arrow-key support.

### Overview (head-count dashboard)
- **Hero KPI, "Expected guests"** = Yes adults + kids, with a split line ("44 adults · 15 kids") and a second line "+ up to 7 from maybes (6 adults, 1 kid)". This is what the caterer needs.
- Yes / Maybe / No tiles, counted in households.
- **Responses** stacked bar, plus "9 invites not answered".
- **Sun vs Shine** stacked bar with counts and percentages.
- **Latest RSVPs:** the 5 newest, each with status, head count, guess and time.

### RSVPs table
Search, filter chips (All · Yes · Maybe · No · ☀️ · ✨) and **Export CSV**. Columns: name, status, adults, kids, guess, wish / name idea, updated. Under 760px each row becomes a card: name and status on top, then counts, guess and wish.

### Invite manager
- **Add people:** paste one person per line (`Name, phone`, with tabs from a spreadsheet also accepted). A live parse line reads, for example, "2 people ready · 1 already on your list · 1 line needs a number: 'Uncle Joe'". **Add to list** gives each person a personal token.
- **Progress:** "7 of 12 texted" bar, plus a big **Text next (5 left)** button that works through the queue one tap at a time.
- **Each row:** avatar, name, number, status badge, **Text invite** (primary when not yet texted, ghost "Text again" after), a WhatsApp button and Copy link. The list is sorted so the not-yet-texted rows come first.
  - `sms:` link format. iOS: `sms:+14255550142&body=…`; Android: `sms:+14255550142?body=…` (detect by user agent).
  - WhatsApp: `https://wa.me/14255550142?text=…`
  - Tapping Text **optimistically marks the row Texted**, and a toast offers *Undo* in case they backed out of Messages.
- **Status badges** use a word plus an icon, never colour alone:
  - `Not texted` (dashed outline)
  - `Texted` (honey)
  - `Opened` (slate): set by the backend when that `?g=` token first loads
  - `RSVP'd` (green ✓)
- **Template switcher:** Warm or Short, with a live iMessage-style bubble preview addressed to the next contact, the link-preview card (`og:image`) and a character count.

### SMS templates
**Option 1, Warm**
> Hi Priya! 🍂 Ayana & Sebin here. We're celebrating our little one with a Baby Shower & Gender Reveal on Sat, Nov 7 at 12 PM in Redmond, and it wouldn't be the same without you.
>
> Will baby be a Sun ☀️ or a Shine ✨? RSVP and cast your guess (30 sec):
> https://…/?g=pr7k

**Option 2, Short**
> Priya, you're invited! ☀️✨ Baby Shower & Gender Reveal, Sat Nov 7, 12 PM, Redmond. RSVP + guess Sun or Shine: https://…/?g=pr7k – Ayana & Sebin

Notes on the templates:
- Couples ("Rahul & Asha") and family titles ("Sunita Aunty") are kept whole in the greeting.
- Put the link on its own line so iMessage renders the preview card.
- The OG title and image are generic, because a static site can't personalize them.

## 6. Reveal day
**Setup:** a laptop on the TV, with the host page open on the **Reveal** tab and **Present full screen** (Fullscreen API). A **Practice run** toggle is on by default: nothing is saved and guests don't see the result. The host turns it off on the day. *Stretch:* the phone acts as a remote while the TV opens `/reveal`, synced by polling the Sheet every 2s.

**Trigger:** two huge buttons, **It's a Sun!** (blue) and **It's a Shine!** (pink). **Press and hold for 1.5s**; a fill sweeps across the button so a pocket tap can't spoil the surprise. Keyboard users press Enter twice within 3s.

### Reveal sequence (about 7s, full screen, 16:9 safe)
1. The screen fades to night, and the fairy-light string across the top lights up from the centre out.
2. *"Ayana & Sebin's little one is…"*
3. **SUN SHINE** appears in huge soft Fraunces, and both halves flicker together like old bulbs.
4. The lights go out from the edges in. The losing half stutters, then falls off-screen and its width collapses.
5. The winning half **blazes** with a neon glow in the team colour and an elastic scale-up. A canvas bursts with about 190 sparkles, ginkgo leaves and dots in the team palette, and the light string relights in that colour.
6. *"It's a girl! 💖"* · "15 of 33 guests guessed right" · **Draw the lucky lanterns →**

### Spinner: "The lucky lanterns"
- **Pool:** only correct guessers who are Yes or Maybe. That's **one entry per RSVP household**, and anyone who answered No is excluded.
- **Layout:** a wooden lantern-window reel showing 3 rows, with the centre row lit by a glowing band. Next to it is the **gift winners** list: N unlit bulbs that light up one by one.
- **Number of gifts:** a stepper from 5 to 7 (it can't go below the number already drawn).
- **Spin:** the winner is picked **before** the animation, using `crypto.getRandomValues`. The reel then decelerates onto that name over 4.6s, a spark burst fires, and `aria-live` announces "Kavya Nair wins a gift!". Space or Enter also spins.
- **Not here? Re-spin:** the last winner moves to a "Not here (tap to put back)" chip row and the reel spins again automatically. Absent people are never drawn twice, and the host can undo.

**If there are fewer correct guessers than N** (say 3 for 6 gifts):
- Before the first spin: *"Only 3 guessed right, so they all win! Spin to reveal them one by one."* The drama is kept.
- When the correct pool runs out: *"Every correct guesser has a gift! 3 gifts left."* with two choices:
  - **Bonus round:** draw from everyone else who's here. Those winners get a `BONUS` tag.
  - **Keep them for later.**
- **If nobody guessed right:** *"Nobody guessed Sun! What a surprise 🙈"* and the host goes straight to the bonus-round offer.
- When everyone has been drawn: "Everyone's been drawn. Thanks for playing!"

## 7. Accessibility
- **Contrast** (checked; text on cream `#fbf5e6`):
  - maroon `#6b1f2a`: 10.4:1
  - ink `#3b2516`: 13.2:1
  - muted `#6b4f3a`: 6.9:1
  - Sun `#245a96`: 6.5:1
  - Shine `#a82860`: 6.2:1
  - honey text `#8a5a12`: 5.4:1
  - On the reveal night background, glow `#ffd98a` is 13.8:1 and pink/blue glows are 9.8:1
  - Honey `#c9841a` and gold are **decorative only**, never used for text.
- **Focus:** a 3px maroon outline with a 3px offset (a lantern-gold outline on dark screens), using `:focus-visible` only.
  - The reveal overlay is a modal dialog with a focus trap; Escape closes it.
  - The confirmation card takes focus after submit, so screen readers hear "See you there, Priya!".
- **Tap targets:** at least 44px everywhere. Primary actions, steppers and tabs are 48–60px, and PIN keys are 68px. Every control is a native radio, button or link.
- **Reduced motion** (`prefers-reduced-motion`):
  - No hero particles (one static frame of bokeh) and no lantern swing or spark bursts.
  - The reveal crossfades straight to the answer, with no flicker, fall or confetti.
  - The reel takes 0.6s with an ease instead of 4.6s.
  - Smooth scrolling is off.
- **Never colour alone:** team chips always say "Team Sun/Shine", status badges carry a word, and charts include text and an `aria-label`.
- **Other:** `lang="en"`, real `<fieldset>`/`<legend>` for each question, `autocomplete="name"` and `"tel"`, `inputmode="tel"`, and `enterkeyhint`.

## 8. Motion list
| Moment | Motion | Duration and easing |
|---|---|---|
| Hero | Fireflies (sprite bokeh) and 7–12 ginkgo/maple leaves on canvas, paused when off-screen or the tab is hidden. Copy rises with a stagger; the image settles from 1.08× | 0.6s, `power3.out` |
| Dividers | Light-string bulbs twinkle out of phase | 3.2s loop |
| Attend tile | Pop on select | `back.out(3)`, 0.5s |
| Vote tile | Lantern lights, swings on an elastic ease, sparks burst | `elastic.out`, 1.2s |
| Stepper | Number slides in from the direction of change | 0.25s |
| Submit | Flame flickers while busy | 0.5s alternate |
| Confirm | Lantern drops in with a bounce, then sways gently forever; your tally number pulses | `bounce.out`, 1s |
| Wish | Your note drops onto the wall with a slight tilt | `back.out(2)` |
| Reveal | The 6-beat timeline in §6, with a canvas burst | about 7s |
| Spinner | Reel deceleration, winner glow, a bulb lights in the list | 4.6s, `cubic-bezier(.12,.72,.18,1)` |

## 9. Type and colour (Google Fonts only)
- **Fraunces** (variable, `SOFT 100`, high optical size): headlines and numbers. Its soft, storybook serif echoes the invite's maroon script without being illegible script.
- **Nunito** 400–800: body text and UI. It's rounded, friendly and very legible at 15–17px.
- **Caveat** 500/700: handwritten touches only (wishes, polaroid captions, signatures, wish prompts).
- **Palette:**
  - Cream `#fbf5e6` (page) and paper `#fffaf0` (cards)
  - Maroon `#6b1f2a` (primary buttons, headings)
  - Ink `#3b2516` and bark `#5a3a1e`
  - Honey `#c9841a`, gold `#f2c230` and glow `#ffd98a` (light, never text on cream)
  - **Sun** `#245a96` with soft `#dbe9f8` and glow `#8ec1f5`
  - **Shine** `#a82860` with soft `#fbdde9` and glow `#ff9fcb`
  - Night `#1a110b` for the gate, reveal and spinner
- **Signature motif:** strings of fairy-light bulbs (gold, blue and pink radial gradients) used as section dividers, the tally, and the reveal's lights-out moment.

## 10. Build notes for the developer
- The page is mostly static HTML with one ES module. GSAP is used only for the timelines, and the page degrades to CSS if it fails to load. Particles are one tiny canvas engine shared by the hero and the reveal.
- Apps Script endpoints:
  - `GET ?g=` returns the guest
  - `POST rsvp` returns a token
  - `GET tally`
  - `GET wishes` (first name + team)
  - `POST open` (sets the Opened badge)
  - Host endpoints are PIN-checked: `GET rsvps`, `POST contacts`, `POST status`, `POST result`
- Poll the tally every 30s, but only while it is visible.

## Needs from the hosts
1. **End time** for the calendar invite. The sketch assumes 12–3 PM.
2. **Host PIN**, and who besides Ayana & Sebin needs access.
3. **Contact list** (name + mobile), plus the party size per invite so the steppers can be prefilled.
4. Choice of **SMS template**, and whether the link domain will be the default `*.github.io` or a custom one.
5. **Number of gifts** (5–7), and whether **Maybe** guests and **bonus-round** winners are OK.
6. The photos: ultrasound, baby photo of Ayana, baby photo of Sebin, and 3–6 story photos with a one-line caption each.
7. A contact number for guest questions (the footer).
