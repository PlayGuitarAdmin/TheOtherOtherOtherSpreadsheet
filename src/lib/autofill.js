import { CLASS_GROUPS, WEIGHT_CLASSES, classesInText } from '../data/catalog.js';
import { lookupVariant } from './mechs.js';
import { breaksCap, lineupStats, normalizeRules } from './rules.js';

function matches(list, mech) {
  return (list || []).findIndex((x) => x === mech.code || x === mech.chassis || x === mech.baseCode);
}

function bestBuild(builds, mech) {
  const official = builds.filter((b) => b.official);
  return (
    official.find((b) => b.variant === mech.code) ||
    official.find((b) => b.chassis === mech.chassis) ||
    null
  );
}

// Suggest pilots + mechs for the empty slots of a drop. Filled slots are never touched.
// Greedy: the pilot with the fewest legal options goes first, and each pick is scored on
// the pilot's event request, favourites, ranked weight classes, mastered mechs, official builds and
// whatever the ruleset still needs (class minimums, minimum tonnage).
export function autoFill({ catalog, slots, pool, hangars, builds, rules: rulesIn, requests = {} }) {
  const rules = normalizeRules(rulesIn);
  const result = slots.map((s) => ({ ...s }));
  let remainingPilots = [...pool];

  const options = new Map();
  for (const p of remainingPilots) {
    const owned = (hangars[p.id] || [])
      .map((h) => ({ mech: lookupVariant(catalog, h.variant), mastered: h.mastered }))
      .filter((o) => o.mech && matches(p.prefs?.wont, o.mech) < 0 && !(p.prefs?.wontClasses || []).includes(o.mech.wclass));
    options.set(p.id, owned);
  }

  for (;;) {
    const emptyIdx = result.findIndex((s) => !s.pilotId);
    if (emptyIdx < 0 || remainingPilots.length === 0) break;
    const emptyAfter = result.filter((s) => !s.pilotId).length - 1;
    const filled = result.filter((s) => s.pilotId);
    const st = lineupStats(catalog, filled);
    const minTons = rules.minTons === null || rules.minTons === '' ? null : Number(rules.minTons);
    const tonDeficit = minTons !== null ? Math.max(0, minTons - st.tons) : 0;
    const needClass = WEIGHT_CLASSES.filter((c) => {
      const min = rules.classes[c]?.min;
      return min !== null && min !== '' && st.byClass[c] < Number(min);
    });
    for (const [g, classes] of Object.entries(CLASS_GROUPS)) {
      const min = rules.groups[g]?.min;
      if (min !== null && min !== '' && classes.reduce((s, c) => s + st.byClass[c], 0) < Number(min)) needClass.push(...classes);
    }

    let pick = null;
    for (const p of remainingPilots) {
      const legal = options.get(p.id).filter((o) => !breaksCap(catalog, filled, o.mech, rules, emptyAfter));
      if (!legal.length) continue;
      let best = null;
      for (const o of legal) {
        let score = 0;
        const fav = matches(p.prefs?.favorites, o.mech);
        if (fav >= 0) score += 50 - fav * 5;
        const rank = (p.prefs?.classes || []).indexOf(o.mech.wclass);
        if (rank >= 0) score += 20 - rank * 6;
        // The pilot's note for this event, e.g. "Timber Wolf" or "bigs please".
        const req = String(requests[p.id] || '').toLowerCase();
        if (req) {
          if (req.includes(o.mech.chassis.toLowerCase()) || req.includes(o.mech.code.toLowerCase())) score += 60;
          else if (classesInText(req).includes(o.mech.wclass)) score += 30;
        }
        if (o.mastered) score += 10;
        if (bestBuild(builds, o.mech)) score += 8;
        if (needClass.includes(o.mech.wclass)) score += 40;
        if (tonDeficit > 0) score += o.mech.tons / 5;
        if (o.mech.kind === 'hero' && rules.maxHero !== null && rules.maxHero !== '') score -= 5;
        if (!best || score > best.score) best = { ...o, score };
      }
      const cand = { pilot: p, option: best, nLegal: legal.length };
      if (!pick || cand.nLegal < pick.nLegal || (cand.nLegal === pick.nLegal && best.score > pick.option.score)) pick = cand;
    }
    if (!pick) break;

    const build = bestBuild(builds, pick.option.mech);
    result[emptyIdx] = {
      ...result[emptyIdx],
      pilotId: pick.pilot.id,
      chassis: pick.option.mech.chassis,
      variant: pick.option.mech.code,
      buildId: build?.id || null,
    };
    remainingPilots = remainingPilots.filter((p) => p.id !== pick.pilot.id);
  }
  return result;
}
