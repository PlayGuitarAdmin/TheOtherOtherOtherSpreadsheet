import { classesInText } from '../data/catalog.js';
import { lookupVariant } from './mechs.js';
import { normalizeRules } from './rules.js';

// Captains choose the chassis for each slot; this fills in pilots. Only slots that have a
// chassis and no pilot are touched: chassis, pilots, variants and builds already set are kept.

function indexIn(list, mech) {
  return (list || []).findIndex((x) => x === mech.code || x === mech.chassis || x === mech.baseCode);
}

// Variants a ruleset would reject, so a pilot isn't put in a mech they can only bring illegally.
function variantAllowed(rules, v) {
  if (rules.banLegendary && v.kind === 'legendary') return false;
  if (rules.banLegendaryHeroes && v.lgdHero) return false;
  if (rules.bannedVariants.includes(v.code) || (v.baseCode && rules.bannedVariants.includes(v.baseCode))) return false;
  return true;
}

// Which of a pilot's variants (all of one chassis) to bring: a favourite, then mastered, then a non-hero.
export function pickVariant(prefs, mine) {
  if (!mine.length) return null;
  return [...mine].sort((a, b) => {
    const fa = indexIn(prefs?.favorites, a), fb = indexIn(prefs?.favorites, b);
    if ((fa >= 0) !== (fb >= 0)) return fa >= 0 ? -1 : 1;
    if (fa !== fb) return fa - fb;
    if (!!a.mastered !== !!b.mastered) return a.mastered ? -1 : 1;
    return (a.kind === 'hero') - (b.kind === 'hero');
  })[0].code;
}

export function officialBuild(builds, chassis, variant) {
  const official = builds.filter((b) => b.official && b.chassis === chassis);
  return official.find((b) => variant && b.variant === variant) || official.find((b) => !b.variant) || official[0] || null;
}

// How well pilot p fits a slot of this chassis, or null if they can't take it.
export function pilotFit({ catalog, pilot, chassis, slotVariant, owned, rules, request }) {
  const prefs = pilot.prefs || {};
  let mine = owned.filter((v) => v.chassis === chassis && variantAllowed(rules, v));
  if (slotVariant) mine = mine.filter((v) => v.code === slotVariant);
  if (!mine.length) return null;
  const c = catalog.chassisByName.get(chassis);
  if (!c) return null;
  if ((prefs.wontClasses || []).includes(c.wclass)) return null;
  if ((prefs.wont || []).includes(chassis)) return null;
  mine = mine.filter((v) => !(prefs.wont || []).includes(v.code));
  if (!mine.length) return null;

  let score = 0;
  const favChassis = (prefs.favorites || []).findIndex((f) => f === chassis || mine.some((v) => v.code === f));
  if (favChassis >= 0) score += 50 - favChassis * 5;
  const rank = (prefs.classes || []).indexOf(c.wclass);
  if (rank >= 0) score += 20 - rank * 6;
  const req = String(request || '').toLowerCase();
  if (req) {
    if (req.includes(chassis.toLowerCase()) || mine.some((v) => req.includes(v.code.toLowerCase()))) score += 60;
    else if (classesInText(req).includes(c.wclass)) score += 30;
  }
  if (mine.some((v) => v.mastered)) score += 10;

  const variant = slotVariant || pickVariant(prefs, mine);
  return { score, variant };
}

export function assignPilots({ catalog, slots, pool, hangars, builds = [], rules: rulesIn, requests = {} }) {
  const rules = normalizeRules(rulesIn);
  const result = slots.map((s) => ({ ...s }));
  const ownedBy = {};
  for (const p of pool) {
    ownedBy[p.id] = (hangars[p.id] || [])
      .map((h) => {
        const v = lookupVariant(catalog, h.variant);
        return v && { ...v, mastered: h.mastered };
      })
      .filter(Boolean);
  }

  const open = result.map((s, i) => i).filter((i) => result[i].chassis && !result[i].pilotId);
  const used = new Set(result.map((s) => s.pilotId).filter(Boolean));
  const fits = new Map(); // slot index -> [{pilot, score, variant}]
  for (const i of open) {
    const s = result[i];
    const list = [];
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const fit = pilotFit({ catalog, pilot: p, chassis: s.chassis, slotVariant: s.variant, owned: ownedBy[p.id], rules, request: requests[p.id] });
      if (fit) list.push({ pilot: p, ...fit });
    }
    fits.set(i, list);
  }

  // Greedy: fill the slot with the fewest candidates first, giving it its best-scoring pilot.
  const remaining = new Set(open);
  for (;;) {
    let best = null;
    for (const i of remaining) {
      const cands = fits.get(i).filter((f) => !used.has(f.pilot.id));
      if (!cands.length) continue;
      const top = cands.reduce((a, b) => (b.score > a.score ? b : a));
      if (!best || cands.length < best.n || (cands.length === best.n && top.score > best.top.score)) best = { i, n: cands.length, top };
    }
    if (!best) break;
    const s = result[best.i];
    const build = s.buildId ? null : officialBuild(builds, s.chassis, best.top.variant);
    result[best.i] = {
      ...s,
      pilotId: best.top.pilot.id,
      ...(s.variant ? {} : { variant: best.top.variant, autoVariant: true }),
      ...(s.buildId || !build ? {} : { buildId: build.id, autoBuild: true }),
    };
    used.add(best.top.pilot.id);
    remaining.delete(best.i);
  }
  return { slots: result, unfilled: [...remaining] };
}
