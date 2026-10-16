import { CATALOG_ROWS } from './catalog-data.js';

// Built-in MechWarrior Online mech catalog, generated from nav-alpha MechDB
// (see scripts/import-nav-alpha.mjs). Captains can add or fix mechs in the app
// (Mech Catalog page), which stores overrides in the database.

export const WEIGHT_CLASSES = ['Light', 'Medium', 'Heavy', 'Assault'];

export function weightClass(tons) {
  if (tons <= 35) return 'Light';
  if (tons <= 55) return 'Medium';
  if (tons <= 75) return 'Heavy';
  return 'Assault';
}

function parse() {
  const variants = [];
  for (const [chassis, tons, tech, list] of CATALOG_ROWS) {
    for (const [code, kind, alias, lgdHero] of list) {
      variants.push({ code, chassis, tons, tech, kind, alias: alias || undefined, lgdHero: !!lgdHero });
    }
  }
  return variants;
}

export const BUILTIN_VARIANTS = parse();

export const DEFAULT_MAPS = [
  'Alpine Peaks', 'Canyon Network', 'Caustic Valley', 'Crimson Strait', 'Emerald Taiga',
  'Forest Colony', 'Frozen City', 'Grim Plexus', 'HPG Manifold', 'Hellebore Springs',
  'Mining Collective', 'Polar Highlands', 'River City', 'Rubellite Oasis', 'Solaris City',
  'Terra Therma', 'Tourmaline Desert', 'Vitric Forge', 'Viridian Bog',
];

// Team shorthand: "lights" = Light + Medium, "bigs" / "heavies" = Heavy + Assault.
export const CLASS_GROUPS = { Lights: ['Light', 'Medium'], Bigs: ['Heavy', 'Assault'] };

const CLASS_WORDS = [
  [/\blights\b/, CLASS_GROUPS.Lights],
  [/\b(bigs|heavies)\b/, CLASS_GROUPS.Bigs],
  [/\blight\b/, ['Light']],
  [/\bmediums?\b/, ['Medium']],
  [/\bheavy\b/, ['Heavy']],
  [/\bassaults?\b/, ['Assault']],
];

// Weight classes mentioned in free text such as "any of the bigs" or "lights please".
export function classesInText(text) {
  const t = String(text || '').toLowerCase();
  const out = new Set();
  for (const [re, classes] of CLASS_WORDS) if (re.test(t)) classes.forEach((c) => out.add(c));
  return [...out];
}

// True if a class filter value ("Heavy", "Bigs", "Lights" or "") includes this weight class.
export function classMatches(filter, wclass) {
  if (!filter) return true;
  return CLASS_GROUPS[filter] ? CLASS_GROUPS[filter].includes(wclass) : filter === wclass;
}
