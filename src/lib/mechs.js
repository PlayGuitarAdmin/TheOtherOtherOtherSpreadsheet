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
  // Aliases: hero short codes ("RVN-H" for HUGINN) and nav-alpha's TSP spelling ("TBR-MTS(P)").
  const aliases = new Map();
  for (const v of variants) if (v.alias && !byCode.has(v.alias)) aliases.set(v.alias, v.code);
  // Variants whose name has no dash (mostly heroes, e.g. "HUGINN", "THE BOAR'S HEAD") need
  // their own search when parsing pasted text. Longest first so "GRID IRON LTD" beats "GRID IRON".
  const names = variants
    .filter((v) => !v.code.includes('-'))
    .map((v) => v.code)
    .sort((a, b) => b.length - a.length);
  const chassisMap = new Map();
  for (const v of variants) {
    if (!chassisMap.has(v.chassis)) {
      chassisMap.set(v.chassis, { name: v.chassis, tons: v.tons, tech: v.tech, wclass: v.wclass, variants: [] });
    }
    chassisMap.get(v.chassis).variants.push(v);
  }
  const chassis = [...chassisMap.values()].sort((a, b) => a.tons - b.tons || a.name.localeCompare(b.name));
  return { byCode, aliases, names, variants, chassis, chassisByName: chassisMap };
}

const SUFFIX = /^(.*?)\s?\(([A-Z0-9]{1,4})\)$/;

// Look up a variant code. Special variants like "AS7-D(F)" resolve to their base
// variant's chassis and tonnage, with kind "champion" for (C), "loyalty" for (L), "legendary" for (LGD) and "special" otherwise.
export function lookupVariant(catalog, rawCode) {
  // Real codes are under 20 characters; capping the length keeps junk hangar rows from stalling the regexes below.
  if (!rawCode || String(rawCode).length > 40) return null;
  const code = String(rawCode).toUpperCase().replace(/\s+\(/, '(').trim();
  const exact = catalog.byCode.get(code) || catalog.byCode.get(catalog.aliases?.get(code));
  if (exact) return exact;
  const m = code.match(SUFFIX);
  if (m) {
    const base = catalog.byCode.get(m[1]);
    if (base) {
      const kind = { C: 'champion', L: 'loyalty', LGD: 'legendary' }[m[2]] || 'special';
      return { ...base, code, kind, baseCode: base.code };
    }
  }
  return null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TOKEN = /[A-Z0-9]+(?:-[A-Z0-9]+)+(?:\s?\([A-Z0-9]{1,4}\))?/g;

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
  let rest = upper;
  for (const name of catalog.names || []) {
    const re = new RegExp(`(?<![A-Z0-9'])${escapeRe(name)}(?:\\s?\\(([A-Z0-9]{1,4})\\))?(?![A-Z0-9])`, 'g');
    for (const m of rest.matchAll(re)) {
      const hit = lookupVariant(catalog, m[1] ? `${name}(${m[1]})` : name) || lookupVariant(catalog, name);
      if (hit) found.set(hit.code, hit);
    }
    rest = rest.replace(re, ' ');
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

// Drop lineups are listed lightest chassis first, then by chassis name; slots without a chassis go last.
export function sortSlots(catalog, slots) {
  const tons = (s) => (s.chassis ? catalog.chassisByName.get(s.chassis)?.tons ?? 999 : Infinity);
  return [...slots].sort((a, b) => tons(a) - tons(b) || String(a.chassis || '').localeCompare(String(b.chassis || '')));
}
