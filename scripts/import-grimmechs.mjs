// Copies the GrimMechs build database (https://grimmechs.isengrim.org/Database) into public/grimmechs.json.
// The deploy workflow runs this before every build and once a day on a schedule, so the live site stays current.
// If the site can't be reached or the page changes shape, the committed public/grimmechs.json is kept.
//
//   node scripts/import-grimmechs.mjs            # fetch from the site
//   node scripts/import-grimmechs.mjs page.html  # parse a saved copy
import fs from 'node:fs';
import { parseGrimMechs } from '../src/lib/grimmechs.js';

const SOURCE = 'https://grimmechs.isengrim.org/Database';
const OUT = new URL('../public/grimmechs.json', import.meta.url);

async function main() {
  const file = process.argv[2];
  const html = file
    ? fs.readFileSync(file, 'utf8')
    : await fetch(SOURCE, { headers: { 'User-Agent': 'AcesWild-TeamOrganizer (daily copy for team lineups)' } }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      });
  const builds = parseGrimMechs(html);
  // A real page has thousands of rows; a handful means the layout changed and the parser needs a look.
  if (builds.length < 500) throw new Error(`only ${builds.length} builds parsed; the page layout may have changed`);
  const json = JSON.stringify({ source: SOURCE, fetched: new Date().toISOString(), builds });
  fs.writeFileSync(OUT, `${json}\n`);
  console.log(`Wrote ${builds.length} GrimMechs builds to public/grimmechs.json`);
}

main().catch((e) => {
  console.warn(`GrimMechs import skipped, keeping the existing file: ${e.message}`);
});
