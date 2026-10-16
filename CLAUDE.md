# CLAUDE.md

Guidance for Claude sessions working on this repo.

## What this is

**The Other Other Other Spreadsheet**: a team organizer for the **Aces Wild** competitive MechWarrior Online
(Piranha Games) unit. It's a standalone project; don't copy anything from Sean's other apps.
React 19 + Vite 8 static site on GitHub Pages, with Supabase (Postgres + auth + realtime) as the shared database.

- Live site: https://playguitaradmin.github.io/TheOtherOtherOtherSpreadsheet/
- `main` is the default branch; pushing to `main` deploys (`.github/workflows/deploy.yml`). CI runs on other branches.
- Ask Sean before merging, deleting data, or anything irreversible.

## Commands

```bash
npm install
npm run dev     # offline demo mode unless VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (.env.local)
npm test        # vitest: tests/lib.test.js (catalog, paste parser, rules, auto-assign)
npm run build
```

Run `npm test` and `npm run build` before pushing. Desktop only (min width 1100px), so there's no mobile layout work.

## Architecture

- `src/lib/store.js`: data layer. Two backends with the same API (`loadAll/insert/insertMany/update/remove/removeMany/removeWhere/subscribe/auth`):
  Supabase, or a localStorage "offline demo" when no Supabase config exists. Config comes from build env vars or the
  in-app Settings page. `cleanUrl` strips a pasted `/rest/v1/` suffix.
- `src/lib/data.jsx`: React context. Loads every table, reloads on realtime changes, and exposes `actions`, `catalog`, `isCaptain` and lookup maps.
- `src/data/catalog-data.js`: generated from nav-alpha MechDB by `scripts/import-nav-alpha.mjs`; don't hand-edit.
  It holds 1,296 variants. Kinds: standard, omni, hero, champion, loyalty, special, legendary. Heroes are named by display name
  ("HUGINN") with the short code ("RVN-H") as an alias. Per Sean: **"(L)" is always Loyalty**. Legendary means "(LGD)" plus the
  earlier paid named ones like HOWL; both have nav-alpha internal names ending in "lgd". Heroes that share a code with a
  Legendary (TBR-H vs HOWL, PXH-S vs PXH-S(LGD)) carry `lgdHero`, which the rule `banLegendaryHeroes` bans.
  Tournament Supporter Pack mechs are stored as "TBR-M(TSP)", with nav-alpha's "TBR-MTS(P)" as an alias.
  Team fixes go in the `custom_mechs` table (a matching code overrides the built-in).
- `src/lib/mechs.js`: `buildCatalog`, `lookupVariant` (handles aliases and suffixes like `AS7-D(F)`), and `parseMechPaste`
  (finds variant codes plus hyphen-less hero names anywhere in pasted mwomercs.com text).
- `src/lib/rules.js`: ruleset model and `validateLineup` (warnings only, never blocks). `breaksCap` is currently unused.
- `src/lib/autofill.js`: `assignPilots` puts pool pilots into slots that have a chassis and no pilot. It solves the whole drop at once
  (Hungarian algorithm: most slots filled, then highest total score). Score (Sean, 2026-10-16): favourite chassis/variant flat +50
  (order ignored), class rank 1st–4th +20/14/8/2, event note naming the chassis/variant +60 or its class +30. Mastery is not scored.
  Exact ties are broken by a random pilot order drawn fresh on each run (`random` option; tests pass a fixed one);
  slot-by-slot greedy gave a bigs pilot a light while a better-suited pilot sat out. Per Sean it sets **only `pilotId`**: never chassis,
  variant or build (captains pick chassis and variants by hand). A variant set on a slot limits it to pilots who own that variant.
  Picking a pilot by hand also sets only the pilot. Older slots may carry stray `autoVariant`/`autoBuild` flags; they're ignored.
- `src/lib/grimmechs.js` + `scripts/import-grimmechs.mjs`: GrimMechs community builds (https://grimmechs.isengrim.org/Database).
  The site sends no CORS headers and has no API (one server-rendered ~2.8 MB HTML table), so the browser can't read it live.
  The deploy workflow runs the import script before every build and on a daily schedule (09:17 UTC), writing
  `public/grimmechs.json` (served next to the app); if the fetch fails or parses under 500 rows, the committed copy is kept.
  Refresh the committed copy now and then with `node scripts/import-grimmechs.mjs`. `indexGrimBuilds` maps Grim's loose
  variant labels ("IFR-A/B/C/D", "FMT-any", "SCR-COR+LC", "TBR-M" = TBR-M(TSP), "RFL-3N-SH" = RFL-3N-SHLGD) onto our chassis/codes.
  Drops' Build column (Sean, 2026-10-16) shows the GrimMechs "Loadout" text linked to its "Build" link; team builds are still
  pickable there too. Picking a Grim build for one variant sets the slot's variant if it had none; changing to a variant the build
  doesn't fit clears it. GitHub disables scheduled workflows after 60 days without repo activity; re-enable in the Actions tab.
- `src/lib/export.js`: Discord text (code block) and CSV. `slotBuild` gives a slot's build label and link (Grim or team build).
- `src/pages/*`: one screen each, with hash routing in `App.jsx` (`#/events/:id`, `#/pilots/:id`, …).
- `supabase/schema.sql`: tables, RLS and seed data. Changing table columns means updating this and the code together.

Data shape notes: `drops.slots` is a jsonb array of `{pilotId, chassis, variant, buildId, grim, lance}`
(`grim` is a copy of the picked GrimMechs build `{id, loadout, link, name, variant}`, so it survives Grim removing the row); `pilots.prefs` is
`{favorites[], wont[], classes[] (ranked, best first), wontClasses[], roles[]}`; `rulesets.rules` matches `emptyRules()`.

## Permissions model (RLS)

Pilots never log in (anon key). Anyone can read everything and can edit pilots, hangars (`pilot_mechs`), attendance,
personal builds, and add `custom_mechs`. **Captains** are signed-in Supabase users (email+password or magic link;
sign-ups disabled, accounts created in the dashboard). Only captains can change events, drops, rulesets, maps, official
builds, and delete pilots. The UI hides captain controls via `isCaptain`; RLS enforces the same rules.

## Sean's decisions (from the Q&A)

- Team sizes 1v1 to 12v12. Each map drop has its own unique lineup (no "copy from previous drop").
- Track ownership per variant, but filter and assign by **chassis** (variant optional).
- Hero/Champion/Special count as the same chassis with a different variant. Rulesets can cap heroes. Most tournaments
  ban Legendaries and the hero versions of Legendaries (`banLegendary` plus `bannedVariants`).
- Rules: min/max tonnage, min/max per weight class, max per chassis and per variant, tech base, banned chassis/variants.
  Breaking a rule shows a **warning**, never a block. Rulesets are user-defined and saved; there are no presets.
- Attendance is per event date (Yes/Maybe/No). **"Maybe" pilots are hidden** from pools. Assigned pilots leave the pool.
- Pilot prefs: favourites (unranked), "won't play", preferred classes and roles, plus an optional per-event "wants to pilot" note.
- **Chassis first, then pilots** (Sean, 2026-10-16): captains pick and keep the chassis list for each drop by hand, then pilots are
  assigned to those chassis ("Auto-assign pilots" or by hand). Choosing a pilot never clears the chassis. Everything stays doable by hand.
  Drop lineups sort by chassis tonnage, then chassis name (`sortSlots`, applied on save and in exports). Columns: Chassis, Variant,
  Class (read-only), Pilot, Build. "Clear pilots" removes only pilots.
- Builds: name, link, MWO export code, notes and tags; team (official) or personal. Can be imported from their Google Sheet by paste.
- Output: everyone sees lineups live in the app, Discord copy/paste, and CSV for Google Sheets.
- History: win/loss per drop, with stats by pilot, chassis and map.
- Theme from the-aces.com: dark teal, amber `#ffaa00`, cyan `#00e5ff`, red `#c40000`; Play and Open Sans fonts. Variables are at the top of `src/styles.css`.
- Lances are an optional, future-planning field.
- Team shorthand: **"lights" = Light + Medium**, **"bigs"/"heavies" = Heavy + Assault** (`CLASS_GROUPS` and `classesInText` in
  `src/data/catalog.js`). Used in class filters, ruleset group min/max (`rules.groups`), lineup totals, and auto-assign
  reading the per-event "wants to pilot" note.

## Setup status (2026-10-16)

- GitHub Pages is on, the default branch is `main`, and the Supabase secrets are set.
- The `VITE_SUPABASE_URL` secret was entered as the REST URL (`…/rest/v1/`); the code now strips that.
- `supabase/schema.sql` has been run (19 maps and the "Open (no limits)" ruleset are seeded), and the captain accounts exist.
  The live site loads from Supabase with no errors.

## External data

The sandbox can reach mwo.nav-alpha.com, the-aces.com and mwomercs.com. nav-alpha's `/api/mechs/` needs a Bearer key
when called directly. The catalog was captured by loading the site in headless Chromium
(`executablePath: '/opt/pw-browsers/chromium'`) and saving the response, then running the import script.
