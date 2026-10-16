import { WEIGHT_CLASSES } from '../data/catalog.js';
import { slotMech } from './mechs.js';

export function emptyRules() {
  return {
    minTons: null,
    maxTons: null,
    classes: Object.fromEntries(WEIGHT_CLASSES.map((c) => [c, { min: null, max: null }])),
    maxPerChassis: null,
    maxPerVariant: null,
    tech: 'any', // any | IS | CL
    banLegendary: true,
    banLegendaryHeroes: true, // hero versions of Legendaries, e.g. PXH-S next to PXH-S(LGD)
    maxHero: null,
    bannedChassis: [],
    bannedVariants: [],
  };
}

export function normalizeRules(rules) {
  const base = emptyRules();
  const r = { ...base, ...(rules || {}) };
  r.classes = { ...base.classes, ...(rules?.classes || {}) };
  r.bannedChassis = r.bannedChassis || [];
  r.bannedVariants = r.bannedVariants || [];
  return r;
}

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

export function lineupStats(catalog, slots) {
  const mechs = slots.map((s) => slotMech(catalog, s)).filter(Boolean);
  const byClass = Object.fromEntries(WEIGHT_CLASSES.map((c) => [c, 0]));
  const byChassis = {};
  const byVariant = {};
  let tons = 0;
  let heroes = 0;
  for (const m of mechs) {
    tons += m.tons;
    byClass[m.wclass] += 1;
    byChassis[m.chassis] = (byChassis[m.chassis] || 0) + 1;
    if (m.code) byVariant[m.code] = (byVariant[m.code] || 0) + 1;
    if (m.kind === 'hero') heroes += 1;
  }
  return { mechs, tons, byClass, byChassis, byVariant, heroes, filled: mechs.length };
}

// Returns a list of human readable warnings. Rules only warn; nothing is blocked.
export function validateLineup(catalog, slots, rulesIn) {
  const rules = normalizeRules(rulesIn);
  const st = lineupStats(catalog, slots);
  const warnings = [];
  const maxTons = num(rules.maxTons);
  const minTons = num(rules.minTons);
  if (maxTons !== null && st.tons > maxTons) warnings.push(`Over the tonnage cap: ${st.tons} t of ${maxTons} t (${st.tons - maxTons} t too heavy).`);
  if (minTons !== null && st.tons < minTons) warnings.push(`Under the minimum tonnage: ${st.tons} t, needs at least ${minTons} t (${minTons - st.tons} t short).`);
  for (const c of WEIGHT_CLASSES) {
    const min = num(rules.classes[c]?.min);
    const max = num(rules.classes[c]?.max);
    if (min !== null && st.byClass[c] < min) warnings.push(`Needs at least ${min} ${c} mech${min === 1 ? '' : 's'}, has ${st.byClass[c]}.`);
    if (max !== null && st.byClass[c] > max) warnings.push(`At most ${max} ${c} mech${max === 1 ? '' : 's'} allowed, has ${st.byClass[c]}.`);
  }
  const maxC = num(rules.maxPerChassis);
  if (maxC !== null) {
    for (const [ch, n] of Object.entries(st.byChassis)) if (n > maxC) warnings.push(`${n}× ${ch} chassis; the limit is ${maxC}.`);
  }
  const maxV = num(rules.maxPerVariant);
  if (maxV !== null) {
    for (const [v, n] of Object.entries(st.byVariant)) if (n > maxV) warnings.push(`${n}× ${v}; the limit per variant is ${maxV}.`);
  }
  const maxHero = num(rules.maxHero);
  if (maxHero !== null && st.heroes > maxHero) warnings.push(`${st.heroes} hero mechs; the limit is ${maxHero}.`);
  for (const m of st.mechs) {
    const name = m.code || m.chassis;
    if (rules.tech !== 'any' && m.tech !== rules.tech) warnings.push(`${name} is ${m.tech === 'CL' ? 'Clan' : 'Inner Sphere'}; this ruleset is ${rules.tech === 'CL' ? 'Clan' : 'Inner Sphere'} only.`);
    if (rules.banLegendary && m.kind === 'legendary') warnings.push(`${name} is a Legendary mech, which is banned.`);
    if (rules.banLegendaryHeroes && m.lgdHero) warnings.push(`${name} is the hero version of a Legendary, which is banned.`);
    if (rules.bannedChassis.includes(m.chassis)) warnings.push(`${m.chassis} chassis is banned.`);
    if (m.code && (rules.bannedVariants.includes(m.code) || rules.bannedVariants.includes(m.baseCode))) warnings.push(`${m.code} is banned.`);
  }
  return [...new Set(warnings)];
}

// Would adding this mech break a hard limit? Used by auto-fill (soft limits like minimums are ignored here).
export function breaksCap(catalog, slots, mech, rulesIn, remainingAfter) {
  const rules = normalizeRules(rulesIn);
  const st = lineupStats(catalog, slots);
  const maxTons = num(rules.maxTons);
  // Leave room for the cheapest possible mech (20 t) in every slot still to fill.
  if (maxTons !== null && st.tons + mech.tons + remainingAfter * 20 > maxTons) return true;
  const cmax = num(rules.classes[mech.wclass]?.max);
  if (cmax !== null && st.byClass[mech.wclass] + 1 > cmax) return true;
  const maxC = num(rules.maxPerChassis);
  if (maxC !== null && (st.byChassis[mech.chassis] || 0) + 1 > maxC) return true;
  const maxV = num(rules.maxPerVariant);
  if (maxV !== null && mech.code && (st.byVariant[mech.code] || 0) + 1 > maxV) return true;
  const maxHero = num(rules.maxHero);
  if (maxHero !== null && mech.kind === 'hero' && st.heroes + 1 > maxHero) return true;
  if (rules.tech !== 'any' && mech.tech !== rules.tech) return true;
  if (rules.banLegendary && mech.kind === 'legendary') return true;
  if (rules.banLegendaryHeroes && mech.lgdHero) return true;
  if (rules.bannedChassis.includes(mech.chassis)) return true;
  if (mech.code && (rules.bannedVariants.includes(mech.code) || rules.bannedVariants.includes(mech.baseCode))) return true;
  return false;
}
