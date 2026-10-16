import { classesInText } from '../data/catalog.js';
import { lookupVariant } from './mechs.js';
import { normalizeRules } from './rules.js';

// Captains choose the chassis (and variants) for each slot; this fills in pilots and nothing else.
// Only slots that have a chassis and no pilot are touched.

// Variants a ruleset would reject, so a pilot isn't put in a mech they can only bring illegally.
function variantAllowed(rules, v) {
  if (rules.banLegendary && v.kind === 'legendary') return false;
  if (rules.banLegendaryHeroes && v.lgdHero) return false;
  if (rules.bannedVariants.includes(v.code) || (v.baseCode && rules.bannedVariants.includes(v.baseCode))) return false;
  return true;
}

// Each drop a pilot has already played in this event costs this many points, so pilots who have sat out get picked first.
// 25 is half a favourite: two extra drops cancel a favourite, three outweigh a favourite plus their top class.
export const PLAYED_PENALTY = 25;

// How many drops each pilot is in, over the event's drops before `index` (drops sorted by position).
export function dropsPlayed(drops, index = drops.length) {
  const counts = {};
  for (const d of drops.slice(0, index)) {
    for (const pid of new Set((d.slots || []).map((s) => s.pilotId).filter(Boolean))) counts[pid] = (counts[pid] || 0) + 1;
  }
  return counts;
}

// How well pilot p fits a slot of this chassis, or null if they can't take it.
export function pilotFit({ catalog, pilot, chassis, slotVariant, owned, rules, request, played = 0 }) {
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
  // Favourites are a flat bonus; their order doesn't matter.
  if ((prefs.favorites || []).some((f) => f === chassis || mine.some((v) => v.code === f))) score += 50;
  const rank = (prefs.classes || []).indexOf(c.wclass);
  if (rank >= 0) score += 20 - rank * 6;
  const req = String(request || '').toLowerCase();
  if (req) {
    if (req.includes(chassis.toLowerCase()) || mine.some((v) => req.includes(v.code.toLowerCase()))) score += 60;
    else if (classesInText(req).includes(c.wclass)) score += 30;
  }
  score -= PLAYED_PENALTY * played;

  return { score };
}

export function assignPilots({ catalog, slots, pool, hangars, rules: rulesIn, requests = {}, played = {}, random = Math.random }) {
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
  const free = pool.filter((p) => !used.has(p.id));
  // fit[r][c]: pilot c in open slot r. A variant or build that only followed an earlier pilot isn't binding.
  const fit = open.map((i) => {
    const s = result[i];
    return free.map((p) => pilotFit({ catalog, pilot: p, chassis: s.chassis, slotVariant: s.variant, owned: ownedBy[p.id], rules, request: requests[p.id], played: played[p.id] || 0 }));
  });

  // Best overall lineup, not slot by slot: fill as many slots as possible, then maximise the total preference score
  // (which includes the drops-played penalty).
  // Ties are broken by a random pilot order, drawn fresh on each run. The tie-breaker adds under 1 point in total,
  // so it never outweighs a real preference. The 10000 per filled slot stays far above any score, penalties included.
  const n = Math.max(open.length, free.length);
  const tie = free.map(() => (random() * 0.9) / (open.length || 1));
  const cost = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => {
    const f = fit[r]?.[c];
    return f ? -(10000 + f.score + tie[c]) : 0;
  }));
  const match = hungarian(cost);

  const unfilled = [];
  open.forEach((i, r) => {
    const f = fit[r][match[r]];
    if (!f) return unfilled.push(i);
    result[i] = { ...result[i], pilotId: free[match[r]].id };
  });
  return { slots: result, unfilled };
}

// Minimum-cost assignment on a square matrix (Hungarian algorithm). Returns the column picked for each row.
function hungarian(a) {
  const n = a.length;
  const INF = Infinity;
  const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF), usedCol = new Array(n + 1).fill(false);
    do {
      usedCol[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (usedCol[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (usedCol[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const rowCol = new Array(n);
  for (let j = 1; j <= n; j++) if (p[j]) rowCol[p[j] - 1] = j - 1;
  return rowCol;
}
