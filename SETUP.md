# Setting up Drop Deck for the team

The app works straight away in **offline demo mode** (data stays in your browser). To share it with
the team you need two free things: a **Supabase** database and a **GitHub Pages** site. This takes
about 15 minutes.

## 1. Create the Supabase database

1. Go to <https://supabase.com>, click **Start your project**, and sign in with GitHub.
2. Click **New project**.
   - Name: `aces-wild-drop-deck` (anything works).
   - Database password: click **Generate**, and save it in your password manager. The app never needs it.
   - Region: the one closest to most of your pilots.
   - Plan: **Free**.
3. Wait a minute or two for the project to finish setting up.
4. In the left menu open **SQL Editor**, click **New query**, paste the whole of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. You should see "Success. No rows returned".
   This creates the tables, the permission rules and the starting map list.

## 2. Create captain accounts

Pilots never log in. Captains sign in so they can build drops and manage rulesets, maps and official builds.

1. Open **Authentication → Sign In / Providers**. Make sure **Email** is enabled, then turn **off**
   "Allow new users to sign up". That way only accounts you create can become captains.
2. Open **Authentication → Users → Add user → Create new user**. Enter the captain's email and a password,
   tick **Auto Confirm User**, and create it. Repeat for each captain.
3. For magic-link sign-in, open **Authentication → URL Configuration** and set **Site URL** to your
   GitHub Pages address from step 4 (for example `https://playguitaradmin.github.io/TheOtherOtherOtherSpreadsheet/`).
   Captains can always use email + password instead.

## 3. Copy the two connection values

Open **Project Settings → API** (on newer dashboards: **Project Settings → Data API** for the URL and
**API Keys** for the key) and copy:

- **Project URL**, like `https://abcdefgh.supabase.co`
- **anon public** key (newer projects call it the **publishable** key, starting `sb_publishable_`). Either works.

These are safe to share: the permission rules in the database decide what each person can change.
**Never** use the `service_role` / secret key in the app.

## 4. Publish the site on GitHub Pages

1. In the GitHub repo open **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key
2. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Merge the app into `main` (or open **Actions → Deploy to GitHub Pages → Run workflow**). When it finishes,
   the site address appears on the workflow run and under Settings → Pages.

Note: GitHub Pages on a **private** repository needs a paid GitHub plan. If the repo is private and you don't
want to pay, either make the repo public (the database keys are safe to expose) or host the `dist` folder on
Netlify or Cloudflare Pages for free.

Without the secrets, anyone can still connect by pasting the URL and key on the app's **Settings** page; that
setting is saved per browser.

## 5. First steps in the app

1. Captain: open **Settings** and sign in.
2. Share the link in Discord. Each pilot opens **Pilots & Hangars → Add pilot**, then
   **Paste from mwomercs.com** to load their mechs.
3. Captain: set up **Rulesets** for the tournaments you play, then create an **Event**.
4. Pilots mark attendance on the event (Yes / Maybe / No). Only "Yes" pilots show in the pools.
5. Captain: add a drop per map, use **Auto-fill** or pick pilots by hand, then **Copy for Discord**.

## Good to know

- Free Supabase projects pause after a week with no activity. Open the Supabase dashboard and click
  **Restore** if the app says it can't reach the database.
- **Settings → Download backup** saves everything as a JSON file. Do this before big tournaments.
- New mechs: **Mech Catalog → Add a missing mech**. The same form fixes a wrong tonnage or marks a variant
  as Legendary.
