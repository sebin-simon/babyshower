# Sun or Shine

The website for Ayana & Sebin's Baby Shower & Gender Reveal (Sat, Nov 7, 2026 · Redmond).
It's a static site (no build step) on GitHub Pages, with a private Google Sheet behind it.

```
site/                    ← everything that gets published
  index.html             ← the guest page
  hostdesk-tze3q93o/     ← the hidden host page (passcode-gated, not linked anywhere)
  js/config.js           ← the settings you edit (API URL, site URL)
backend/apps-script/     ← Code.gs + SETUP.md (the Google Sheet "server")
dev/                     ← local mock server, tests, image tools (never published)
design/                  ← design concepts and sketches
assets/                  ← original photos (git-ignored; see below)
```

---

## 1. Run it locally

You need Node 20 or newer.

```bash
cd dev
npm install          # only needed for the image tools
npm run dev          # → http://localhost:5173
npm test             # API + host-page tests
```

- The guest page is at http://localhost:5173/ and the host page is at http://localhost:5173/hostdesk-tze3q93o/.
- The local host passcode is `letmein`.
- The mock server runs the real `Code.gs` against a fake Sheet saved in `dev/data.json`. Delete that file to start fresh.
- To use a second copy side by side, run `PORT=5174 DATA_FILE=data-host.json npm run dev`.

## 2. Connect the Google Sheet

Follow **[backend/apps-script/SETUP.md](backend/apps-script/SETUP.md)**. It takes about 10 minutes and gives you two things:

- the web app URL, which ends in `/exec`
- your **host passcode**, stored in Script Properties as `HOST_KEY`. Keep it secret; it is never in the website code.

## 3. Publish on GitHub Pages

1. Create a **public** repository on GitHub, e.g. `sun-or-shine`. Don't add a README; this folder already has one.
2. Push this folder:
   ```bash
   git init && git add . && git commit -m "Sun or Shine site"
   git branch -M main
   git remote add origin https://github.com/<your-user>/sun-or-shine.git
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. The workflow in `.github/workflows/pages.yml` publishes the `site/` folder on every push to `main`. You can watch it under the **Actions** tab. When it's done, the site is at `https://<your-user>.github.io/sun-or-shine/`.

## 4. Fill in the settings (then push again)

1. In **`site/js/config.js`**, set:
   ```js
   const apiUrl = 'https://script.google.com/macros/s/AKfy…/exec';   // from SETUP.md
   …
   siteUrl: 'https://<your-user>.github.io/sun-or-shine/',
   ```
   `siteUrl` is used for the personal invite links and the QR code. If you leave it empty, the host page works it out from its own address, which is fine on GitHub Pages too.
2. In **`site/index.html`**, replace the placeholder `https://YOUR-USERNAME.github.io/REPO/` in the `og:url`, `og:image` and `twitter:image` tags with your real site URL. iMessage and WhatsApp need absolute URLs to show the preview card.
3. Commit and push. Then open the site on your phone, RSVP as a test guest, and check that the RSVP appears in the Sheet.

## 5. Photos

The site uses optimised copies in `site/img/photos/`, never the originals.

- **Re-run all photos:** run `cd dev && npm run images`.
- **Add one new photo:** put the original in `assets/`, then run `node optimize-images.mjs ../assets/ultrasound.jpg ultrasound 800,1600`. This writes `ultrasound-800.jpg/.webp` and `ultrasound-1600.jpg/.webp`.
- **Make it permanent:** add a `JOBS` entry in `dev/optimize-images.mjs`.

The originals in `assets/` (including the 12 MB `DSC_4735.JPG`) are listed in `.gitignore`, so they never reach the public repo. Keep a copy somewhere safe, such as your Google Drive; git won't back them up.

## 6. The host page (keep this link private)

**`https://<your-user>.github.io/sun-or-shine/hostdesk-tze3q93o/`**

Nothing on the guest site links to it, and search engines are told not to index it. Even so, the real protection is the passcode, which is checked by the Google script. Bookmark the link on both phones. After you unlock it, it stays unlocked in that browser tab for 12 hours. Tap **Lock** to log out.

The page has four tabs:

- **Overview:** expected guests (adults and kids, plus maybes), Yes/Maybe/No, unanswered invites, the Sun vs Shine split and the latest RSVPs. It refreshes every minute while it's open; tap **Refresh** any time.
- **RSVPs:**
  - Search and filter the RSVPs.
  - Download or copy a CSV for the caterer.
  - **Hide from wall** removes a wish from the public wishes wall. The RSVP itself is kept.
- **Invites:**
  1. Paste your contacts, one per line as `Name, phone`. The preview shows who's ready, who's a duplicate and who's missing a number. Then tap **Add**.
  2. Tap **Text next** over and over. Each tap opens Messages with that person's personal link already filled in. Send it, then come back.
  3. Each row is marked *Texted* automatically. Tap **Undo** if you backed out.
  4. Pick the **Warm** or **Short** message. You can edit both, and your changes are remembered on that phone.
  5. **QR code → Download PNG** gives you a code for reprinting the invitation.
- **Reveal:** the gender reveal and the gift draw. See the checklist below.

## 7. Reveal-day checklist

**The day before**
- [ ] On the laptop you'll plug into the TV, open the host page, unlock it, and go to the **Reveal** tab.
- [ ] Leave **Practice run ON**. Tap **Present full screen**, then press and hold **It's a Sun!** for 1.5 seconds. Watch the whole show on the TV, then tap **Find our lucky guessers** and draw a few names. Do the same with **It's a Shine!**.
  - A practice run uses **fake names** and **saves nothing**: no answer and no winners.
- [ ] Check the TV sound and brightness, the laptop charger, and that sleep is turned off. Use reliable Wi-Fi or a phone hotspot.
- [ ] Set **Gifts to give**. The default is 5, and you can choose 1 to 10. The tab shows how many correct guessers would be in the draw for each answer.

**At the party**
1. Refresh the page so the latest RSVPs are loaded.
2. Turn **Practice run OFF**. The box turns red and says "this is the real reveal".
3. Tap **Present full screen**.
4. Press and hold the real answer. On a keyboard, press Enter twice. The answer is saved to the Sheet the moment the show starts.
5. Tap **Find our lucky guessers →**. Only guests who guessed right **and** said Yes or Maybe are in the lantern, with one entry per RSVP. Tap **Draw** for each gift.
   - **Not here? Re-spin:** moves the last winner to a "not here" list and draws again. Tap their name to put them back.
   - **Fewer correct guessers than gifts:** they all win. Then choose **Bonus round** to draw from everyone else who said Yes or Maybe (those winners are tagged *Bonus*), or **Keep them for later**.
   - Each winner is saved straight away. If the page reloads, hold the same answer again and the draw picks up where it left off. **Saved results** on the Reveal tab lists everyone.
6. If you revealed the wrong answer by mistake, use **Saved results → Reset the reveal** and **Clear saved winners**.
