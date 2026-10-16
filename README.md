# ♠ Drop Deck · Aces Wild

A team organizer for competitive **MechWarrior Online**: who's attending, which mechs each pilot owns,
which builds to run, and who drops in what on each map, with tournament rules checked as you go.

## What it does

- **Pilots & hangars.** Pilots add themselves and paste their mwomercs.com mech list; the app finds every
  variant code in the pasted text, whatever the page layout. Manual tick-box editing and a "mastered ★" flag too.
- **Preferences.** Ranked favourite mechs, "won't play" mechs, preferred weight classes and roles, plus an
  optional per-event "wants to pilot" note.
- **Builds.** Team (official) and personal builds with link, MWO export code, notes and tags. Import from a
  Google Sheet by copy/paste.
- **Events & drops.** Team size 1v1 to 12v12, per-event attendance (Yes/Maybe/No), one lineup per map drop,
  optional lance names. Assigned pilots leave the pool; pilots only see mechs they own (toggle to show all).
- **Rulesets.** Min/max tonnage, min/max per weight class, max copies per chassis and per variant, hero limit,
  Legendary ban, tech base, banned chassis/variants. Broken rules show as warnings, never blocks.
- **Auto-fill** suggests a legal lineup from attending pilots' hangars and preferences. Everything stays editable by hand.
- **Sharing.** Live view for everyone, Discord-formatted copy/paste, CSV export for Google Sheets.
- **History.** Results per drop with win rates by pilot, chassis and map.
- **Mech catalog** of every MWO chassis and variant (IS and Clan, hero, omni), editable in the app for new
  releases and Legendary flags.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173, offline demo mode
npm test         # unit tests for the parser, rules and auto-fill
npm run build    # static site in dist/
```

To use the shared database, follow [SETUP.md](SETUP.md).

## Code map

| Path | What |
| --- | --- |
| `src/data/catalog.js` | Built-in mech catalog and default map list |
| `src/lib/mechs.js` | Catalog merge, variant lookup, mwomercs paste parser |
| `src/lib/rules.js` | Ruleset model and lineup validation |
| `src/lib/autofill.js` | Lineup suggestion |
| `src/lib/store.js` | Data layer: Supabase or browser-only demo |
| `src/pages/` | One file per screen |
| `supabase/schema.sql` | Tables, permissions and starting data |

Colours live at the top of `src/styles.css`.
