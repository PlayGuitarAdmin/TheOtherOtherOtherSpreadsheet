import { lookupVariant } from './mechs.js';

// GrimMechs (grimmechs.isengrim.org/Database) community builds.
// The site sends no CORS headers, so the browser can't read it directly. scripts/import-grimmechs.mjs copies it
// into public/grimmechs.json at deploy time (and on a daily schedule); the app loads that file.

const decode = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// Each build is a <tr class="BdEnt">; cells are found by their class so column order doesn't matter.
export function parseGrimMechs(html) {
  const out = [];
  for (const row of html.matchAll(/<tr id="(\d+)" class="BdEnt[^"]*">([\s\S]*?)<\/tr>/g)) {
    const [, id, body] = row;
    const cell = (cls) => body.match(new RegExp(`<td class="[^"]*\\b${cls}\\b[^"]*">([\\s\\S]*?)</td>`))?.[1] ?? '';
    const variantCell = cell('variantname');
    const variant = decode(variantCell.match(/title="([^"]+)"/)?.[1] || variantCell);
    const buildCell = cell('buildname');
    const link = buildCell.match(/<a href="([^"]+)"/)?.[1] || '';
    const name = decode(buildCell.match(/<a [^>]*>([\s\S]*?)<\/a>/)?.[1] || '');
    const loadout = decode(cell('loadout'));
    if (!variant || !loadout) continue;
    out.push({
      id,
      variant,
      chassis: decode(cell('chassisname')),
      name,
      loadout,
      link: link.replace(/&amp;/g, '&'),
      engine: decode(cell('engine')),
      range: decode(cell('range')),
      updated: decode(cell('date').replace(/<div[\s\S]*?<\/div>/g, '')),
      reco: /reco-yes/.test(buildCell),
    });
  }
  return out;
}

// GrimMechs variant labels are looser than our codes: "IFR-A/B/C/D", "NGA-II-Prime/A/C", "FMT-any", "ACW-omni",
// omnipod mixes like "SCR-COR+LC", and TSP/Legendary mechs without their suffix ("TBR-M", "RFL-3N-SH").
function expandVariant(label) {
  const base = label.split('+')[0];
  if (/-(any|omni)$/i.test(base)) return { prefix: base.replace(/-(any|omni)$/i, ''), codes: [] };
  const [first, ...more] = base.split('/');
  const prefix = first.slice(0, first.lastIndexOf('-') + 1);
  return { prefix: prefix.replace(/-$/, ''), codes: [first, ...more.map((m) => prefix + m)] };
}

function resolveCode(catalog, code) {
  const tries = [code, `${code}(TSP)`, `${code}(LGD)`, `${code}LGD`, code.replace(/(-[A-Z0-9]+)([A-Z])$/i, '$1($2)')];
  for (const t of tries) {
    const v = lookupVariant(catalog, t);
    if (v) return v;
  }
  return null;
}

const normName = (s) => s.toLowerCase().replace(/^(.*)\(c\)$/, 'clan $1').replace(/[^a-z0-9]/g, '');

// Groups GrimMechs builds by our chassis name. Each build gets `variants`: our variant codes it fits,
// or [] when it is listed for any variant of the chassis.
export function indexGrimBuilds(catalog, rows) {
  const byNorm = new Map(catalog.chassis.map((c) => [normName(c.name), c.name]));
  const byPrefix = new Map();
  for (const v of catalog.variants) {
    const p = v.code.split('-')[0];
    if (!byPrefix.has(p)) byPrefix.set(p, v.chassis);
  }
  const byChassis = new Map();
  const byId = new Map();
  for (const r of rows || []) {
    const { prefix, codes } = expandVariant(r.variant);
    const hits = codes.map((c) => resolveCode(catalog, c)).filter(Boolean);
    const chassis = hits[0]?.chassis || byNorm.get(normName(r.chassis)) || byPrefix.get(prefix.split('-')[0]);
    if (!chassis) continue;
    const b = { ...r, chassis, variants: [...new Set(hits.filter((h) => h.chassis === chassis).map((h) => h.code))] };
    if (!byChassis.has(chassis)) byChassis.set(chassis, []);
    byChassis.get(chassis).push(b);
    byId.set(r.id, b);
  }
  return { byChassis, byId, count: byId.size };
}

// Builds for a slot: every build of its chassis, narrowed to its variant when one is set.
export function grimBuildsFor(index, chassis, variant) {
  const all = (chassis && index?.byChassis.get(chassis)) || [];
  const fits = (b) => !variant || !b.variants.length || b.variants.includes(variant);
  return all
    .filter(fits)
    .sort((a, b) => (b.reco - a.reco) || a.variant.localeCompare(b.variant) || a.loadout.localeCompare(b.loadout));
}
