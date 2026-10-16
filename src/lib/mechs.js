import { BUILTIN_VARIANTS, weightClass } from '../data/catalog.js';

// Merge the built-in catalog with database rows from `custom_mechs`.
// A custom row with the same code as a built-in variant overrides it, which is
// how captains fix a wrong tonnage or mark a variant as Legendary.
export function buildCatalog(customRows = []) {
  const byCode = new Map();
  for (const v of BUILTIN_VARIANTS) byCode.set(v.code, { ...v, custom: false });
  for (const r of customRows) {
    const code = String(r.code || '').toUpperCase().trim();
    if (!code) continue;
    byCode.set(code, {
      code,
      chassis: r.chassis,
      tons: Number(r.tons),
      tech: r.tech,
      kind: r.kind || 'standard',
      custom: true,
      id: r.id,
    });
  }
  const variants = [...byCode.values()].map((v) => ({ ...v, wclass: weightClass(v.tons) }));
  for (const v of variants) byCode.set(v.code, v);
  const chassisMap = new Map();
  for (const v of variants) {
    if (!chassisMap.has(v.chassis)) {
      chassisMap.set(v.chassis, { name: v.chassis, tons: v.tons, tech: v.tech, wclass: v.wclass, variants: [] });
    }
    chassisMap.get(v.chassis).variants.push(v);
  }
  const chassis = [...chassisMap.values()].sort((a, b) => a.tons - b.tons || a.name.localeCompare(b.name));
  return { byCode, variants, chassis, chassisByName: chassisMap };
}

const SUFFIX = /^(.*?)\s?\(([A-Z0-9]{1,3})\)$/;

// Look up a variant code. Special variants like "AS7-D(F)" resolve to their base
// variant's chassis and tonnage, with kind "champion" for (C) and "special" otherwise.
export function lookupVariant(catalog, rawCode) {
  if (!rawCode) return null;
  const code = String(rawCode).toUpperCase().replace(/\s+\(/, '(').trim();
  const exact = catalog.byCode.get(code);
  if (exact) return exact;
  const m = code.match(SUFFIX);
  if (m) {
    const base = catalog.byCode.get(m[1]);
    if (base) return { ...base, code, kind: m[2] === 'C' ? 'champion' : 'special', baseCode: base.code };
  }
  return null;
}

const TOKEN = /[A-Z0-9]+(?:-[A-Z0-9]+)+(?:\s?\([A-Z0-9]{1,3}\))?/g;

// Find every known variant code in pasted text (e.g. a copy of the
// mwomercs.com profile Mech Stats page). Layout independent on purpose.
export function parseMechPaste(text, catalog) {
  const found = new Map();
  const unknown = new Set();
  const upper = String(text || '').toUpperCase();
  for (const match of upper.matchAll(TOKEN)) {
    let token = match[0].replace(/\s+\(/, '(');
    let hit = lookupVariant(catalog, token);
    // Tokens can run into neighbouring text ("AS7-D-FOO"); trim segments until known.
    let trimmed = token;
    while (!hit && trimmed.includes('-')) {
      trimmed = trimmed.slice(0, trimmed.lastIndexOf('-'));
      hit = lookupVariant(catalog, trimmed);
    }
    if (hit) found.set(hit.code, hit);
    else if (/^[A-Z]{2,5}\d*-[A-Z0-9]/.test(token) && !/^\d/.test(token)) unknown.add(token);
  }
  return { found: [...found.values()], unknown: [...unknown] };
}

// Tonnage/class/tech for a lineup slot. A slot always has a chassis and may name a variant.
export function slotMech(catalog, slot) {
  if (!slot) return null;
  if (slot.variant) {
    const v = lookupVariant(catalog, slot.variant);
    if (v) return v;
  }
  if (slot.chassis) {
    const c = catalog.chassisByName.get(slot.chassis);
    if (c) return { code: null, chassis: c.name, tons: c.tons, tech: c.tech, kind: 'standard', wclass: c.wclass };
  }
  return null;
}

export function mechLabel(mech) {
  if (!mech) return '';
  return mech.code ? `${mech.code} (${mech.chassis})` : `${mech.chassis} (any variant)`;
}
