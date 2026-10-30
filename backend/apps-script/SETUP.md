# Connecting the website to your Google Sheet

You do this once. It takes about 10 minutes. You'll need a Google account and
a computer (the Apps Script editor doesn't work well on a phone).

> **Keep the Sheet private.** It holds your guests' names and phone numbers.
> Don't click "Share", and don't set it to "Anyone with the link". The website
> never opens the Sheet directly; it talks to a small script that runs as you,
> and that script only ever hands out first names, wishes and the vote tally.

---

## Part 1: Create the Sheet and add the script

1. Go to [sheets.google.com](https://sheets.google.com) and create a **blank
   spreadsheet** (or open one you already use for the party). Name it
   something like **Sun or Shine RSVPs**.
2. In the Sheet's menu, click **Extensions → Apps Script**. A new tab opens
   with a code editor and a file called `Code.gs`.
3. Delete everything in that editor. Then open
   `backend/apps-script/Code.gs` from this project, copy **all** of it, and
   paste it into the editor.
4. Click the **Save** icon (the floppy disk), or press Ctrl+S / Cmd+S.
5. At the top, rename the project from "Untitled project" to
   **Sun or Shine** (optional, but it makes the next steps clearer).

## Part 2: Run the one-time setup

6. In the toolbar, find the dropdown next to **Run** and **Debug**, and pick
   **`setup`**. Then click **Run**.
7. Google asks for permission:
   - Click **Review permissions** and choose your Google account.
   - You'll see "Google hasn't verified this app". That's expected, because
     it's your own script. Click **Advanced**, then
     **Go to Sun or Shine (unsafe)**.
   - Click **Allow**. (The script only needs access to this spreadsheet.)
8. When it finishes, the **Execution log** at the bottom shows a line like
   `Your host passcode is: xbWV2Qv2Ex`. Back in your Sheet you'll now see three
   new tabs: **Guests**, **RSVPs** and **Meta**. (You can delete the empty
   "Sheet1" tab if you like.)

## Part 3: Choose your host passcode

The passcode unlocks the hidden host page: head counts, the invite manager and
the reveal. Setup created a random one, and you can change it whenever you like.

9. In the Apps Script editor, click the **gear icon (Project Settings)** in the
   left sidebar.
10. Scroll down to **Script Properties** and click **Edit script properties**.
11. Find the property **`HOST_KEY`** and replace its value with your own
    passcode. Pick something at least 10 characters long that guests won't
    guess, for example a short phrase like `maple-lantern-42`.
12. Click **Save script properties**. The change takes effect right away; you
    don't need to redeploy.

## Part 4: Publish the script as a web app

13. Top right, click **Deploy → New deployment**.
14. Click the **gear icon** next to "Select type" and choose **Web app**.
15. Fill in:
    - **Description:** `v1`
    - **Execute as:** **Me** (your Google account)
    - **Who has access:** **Anyone**

    "Anyone" means anyone can *talk to the script*, which guests need in order
    to RSVP. It does **not** give anyone access to your Sheet.
16. Click **Deploy** (authorize again if asked), then **copy the Web app
    URL**. It looks like
    `https://script.google.com/macros/s/AKfy…long…/exec` and must end in
    **`/exec`**.
17. Check it works: paste that URL into a new browser tab. You should see
    something like `{"ok":true,"service":"sun-or-shine","version":"1.1.0"}`.

## Part 5: Connect the website

18. In this project, open **`site/js/config.js`** and paste the URL between
    the quotes on the `apiUrl` line:

    ```js
    const apiUrl = 'https://script.google.com/macros/s/AKfy…/exec';
    ```

    While you're there, set `siteUrl` to your public site address (e.g.
    `https://<you>.github.io/<repo>/`). The host page uses it for personal
    invite links and the QR code.

19. Save, commit and push to GitHub. Once GitHub Pages updates, the live site
    reads and writes your Sheet. (This URL isn't a secret; it's fine for it to
    sit in the public code. Your passcode is never in the website code.)

---

## Updating the script later

If `Code.gs` changes, paste the new version into the editor and save. Saving
alone does **not** update the live site. To publish it **and keep the same
URL**:

1. Click **Deploy → Manage deployments**.
2. Select your existing deployment, then click the **pencil (Edit)** icon.
3. Under **Version**, choose **New version**.
4. Click **Deploy**.

**Version 1.1.0** (the host page release) added two small things, so
redeploy if your `/exec` URL still reports `"version":"1.0.0"`:
- **Undo** on the Invites tab un-marks a guest as texted (`markTexted` with
  `texted:false`).
- Bonus-round winners keep their **Bonus** tag when they're saved.

Don't use "New deployment" for updates: that creates a *different* URL, and
you'd have to change `config.js` again.

## Good to know

- **Editing the Sheet by hand is fine.** You can fix a typo in a name, add your
  own columns (e.g. "notes"), or delete a test row. Leave the header names in
  row 1 as they are.
- **Hiding a wish:** use the host page, or type `TRUE` in that row's `hidden`
  column.
- **The host page** lives at `/hostdesk-tze3q93o/` on your site and uses the
  same `HOST_KEY` passcode. Practice runs on its Reveal tab never write to the
  Sheet; the real reveal writes `reveal`, `winners` and `winners_saved_at`
  rows in the **Meta** tab.
- **Starting fresh after testing:** delete the rows under the headers in the
  Guests and RSVPs tabs, and the rows in Meta.
- **"Unauthorized" on the host page** means the passcode doesn't match
  `HOST_KEY` exactly (it's case-sensitive). There's a short pause after each
  wrong try; that's deliberate, to slow down guessing.
- **The site says it can't reach the server:** open the `/exec` URL in a
  browser (step 17). If you see a Google sign-in page instead of `{"ok":true…}`,
  edit the deployment and set **Who has access** to **Anyone**.
- **Optional, for a standalone script:** if you created the script from
  script.google.com instead of from the Sheet's Extensions menu, add a Script
  Property `SHEET_ID` set to the Sheet's ID (the long code in the Sheet's URL
  between `/d/` and `/edit`).
