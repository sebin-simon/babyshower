# Design Brief: "Sun or Shine"

## Event
- **Hosts:** Ayana & Sebin
- **What:** Baby Shower & Gender Reveal
- **When:** Saturday, November 7, 2026, 12:00 PM (Pacific)
- **Where:** eaves Redmond Campus, 15606 NE 40th St, Bldg Z, Redmond, WA
- **Hosts' note:** "She brings the sunshine to our lives, but will our baby be the Sun ☀️ (Boy) or the Shine ✨ (Girl)? Your presence is our greatest gift, so please no wrapped presents—just bring your love and predictions!"
- **Teams:** ☀️💙 Team Sun (Boy) vs. ✨💖 Team Shine (Girl)
- **Deadline:** Today is Oct 29, 2026. The site must be ready to text out within about 2 days.

## Theme and mood
"Sunshine": the word splits into **Sun** (boy) and **Shine** (girl). The visual world is a golden autumn forest: yellow maple and gingko canopy, warm glowing lanterns, string fairy lights, woodland critters (squirrel, hedgehog, small birds), acorns, mushrooms, and drifting leaves. The art style is soft watercolour/storybook, warm and cozy, with lots of light bokeh. The site should feel **unique, magical and crafted**, not a template. The hosts want an Evite-like experience with great animation. Falling leaves were suggested, but the designers have creative freedom.

## Reference art (in `assets/`; never modify the originals)
- `assets/invitation.jpeg`: the printed invite (golden forest, cream note card, maroon script headings)
- `assets/cartoon.jpeg`, `Gemini_Generated_Image_14cdms…jpeg`: storybook cartoon of the couple, heart hands on the bump holding a maple leaf, with hedgehog, squirrel and lanterns
- `assets/Gemini_Generated_Image_buettk…jpeg`: cartoon variant with a glowing lantern-lit forest and an empty bottom area (good for a hero image)
- `assets/Gemini_Generated_Image_r6tell…jpeg`: landscape semi-realistic illustrated version
- `assets/Gemini_Generated_Image_zeroqg…jpeg`: alternate invitation layout (cream scalloped card)
- `assets/DSC_4735.JPG`: the **real photo** (6048×4032, 12 MB) of the couple in a yellow-leaf forest, with a maple leaf heart on the bump. It must be optimized before use.
- Key colours seen: canopy gold (#f2c230 to #e8a317), deep honey (#c9841a), bark brown (#5a3a1e), maroon sweater/headings (#6b1f2a to #7a2533), cream card (#fbf5e6), lantern glow (#ffd98a). Sun accent is blue (💙); Shine accent is pink (💖).

## Photos still to come (design **placeholders** for these)
1. Ultrasound / sonogram: a "first look" moment
2. A baby photo of Ayana and one of Sebin, for "Who will baby look like?"
3. 3–6 couple / story photos

## Required features
1. **Hero and invitation:** the event details, the hosts' note, Add to Calendar (Google + .ics), and a Maps link.
2. **RSVP form:** name, phone, attending (yes / maybe / no), adults count, kids count, Sun/Shine vote, wish/note for baby, and a baby-name suggestion.
3. **Personal invite links:** `?g=<token>`. The page greets the guest by name and pre-fills their RSVP, which they can update later.
4. **Live poll tally:** Sun vs. Shine counts, shown in a playful way.
5. **Wishes wall:** guests' notes, showing first names only.
6. **Photo moments:** the real photo, the cartoon, and the placeholders above.
7. **Hidden host page** (not linked from the site, passcode-gated):
   - Head count totals and the RSVP table
   - Invite manager: a list of friends with a 1-tap "Text invite" button that opens the phone's Messages app with a pre-filled message and personal link, plus WhatsApp share
   - Reveal-day control: the host taps "It's a Sun!" or "It's a Shine!", which triggers a big full-screen reveal animation and then a **name spinner** that picks N winners (5–7) from **only the guests who guessed correctly**, for small gifts
8. **Responsive and accessible:** mobile-first (most guests open the link from a text message), from 360px wide up to desktop. Honour `prefers-reduced-motion`. Meet WCAG AA contrast for text.

## Tech constraints (for whoever builds it)
- A static site on **GitHub Pages**, with no build step: vanilla HTML/CSS/ES modules.
- Allowed CDNs: cdnjs.cloudflare.com (e.g. GSAP 3.12.5 including ScrollTrigger), cdn.jsdelivr.net/npm. Fonts from Google Fonts.
- Data goes to a Google Apps Script/Sheet backend, which the full-stack developer handles. Design against the features above.
- Performance: the first paint must be fast on a phone over LTE. Lazy-load images below the fold. Use canvas for particle effects.
