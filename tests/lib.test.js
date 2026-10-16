import { describe, expect, it } from 'vitest';
import { BUILTIN_VARIANTS } from '../src/data/catalog.js';
import { autoFill } from '../src/lib/autofill.js';
import { buildCatalog, lookupVariant, parseMechPaste } from '../src/lib/mechs.js';
import { emptyRules, validateLineup } from '../src/lib/rules.js';

const catalog = buildCatalog();
const slot = (variant, pilotId = 'p') => ({ pilotId, variant, chassis: lookupVariant(catalog, variant)?.chassis });

describe('catalog', () => {
  it('has unique variant codes and sane tonnage', () => {
    const codes = BUILTIN_VARIANTS.map((v) => v.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const v of BUILTIN_VARIANTS) {
      expect(v.tons % 5).toBe(0);
      expect(v.tons).toBeGreaterThanOrEqual(20);
      expect(v.tons).toBeLessThanOrEqual(100);
    }
  });

  it('custom rows override built-ins', () => {
    const c = buildCatalog([{ code: 'AS7-D', chassis: 'Atlas', tons: 100, tech: 'IS', kind: 'legendary' }]);
    expect(lookupVariant(c, 'AS7-D').kind).toBe('legendary');
  });

  it('resolves special suffix variants', () => {
    expect(lookupVariant(catalog, 'AS7-D(F)')).toMatchObject({ chassis: 'Atlas', tons: 100, kind: 'special' });
    expect(lookupVariant(catalog, 'SDR-5K (C)')).toMatchObject({ chassis: 'Spider', kind: 'champion' });
  });
});

describe('paste parser', () => {
  it('finds codes in messy text and reports unknown ones', () => {
    const text = `MECH STATS\nAtlas AS7-D 120 matches\nTimber Wolf TBR-Prime\nKDK-3, ZZZ-9X\nAS7-D(F) 3 matches\nDate 2026-10-15`;
    const { found, unknown } = parseMechPaste(text, catalog);
    expect(found.map((f) => f.code).sort()).toEqual(['AS7-D', 'AS7-D(F)', 'KDK-3', 'TBR-PRIME']);
    expect(unknown).toContain('ZZZ-9X');
    expect(unknown).not.toContain('2026-10-15');
  });
});

describe('rules', () => {
  it('warns on tonnage, classes, duplicates, heroes and legendaries', () => {
    const rules = { ...emptyRules(), maxTons: 150, minTons: 10, maxPerChassis: 1, maxHero: 0 };
    rules.classes.Light = { min: 1, max: null };
    const w = validateLineup(catalog, [slot('AS7-D'), slot('AS7-K'), slot('AS7-BH')], rules);
    expect(w.some((x) => x.includes('tonnage cap'))).toBe(true);
    expect(w.some((x) => x.includes('Light'))).toBe(true);
    expect(w.some((x) => x.includes('Atlas chassis'))).toBe(true);
    expect(w.some((x) => x.includes('hero'))).toBe(true);
  });

  it('is happy with a legal lineup', () => {
    expect(validateLineup(catalog, [slot('TBR-PRIME'), slot('ACH-PRIME')], { ...emptyRules(), maxTons: 200 })).toEqual([]);
  });
});

describe('auto-fill', () => {
  it('fills slots within caps and honours class minimums and won\'t-play', () => {
    const rules = { ...emptyRules(), maxTons: 200, maxPerChassis: 1 };
    rules.classes.Light = { min: 1, max: null };
    const pool = [
      { id: 'a', name: 'A', prefs: { favorites: ['Dire Wolf'] } },
      { id: 'b', name: 'B', prefs: { wont: ['Timber Wolf'] } },
      { id: 'c', name: 'C', prefs: {} },
    ];
    const hangars = {
      a: [{ variant: 'DWF-PRIME' }, { variant: 'ACH-PRIME' }],
      b: [{ variant: 'TBR-PRIME' }, { variant: 'MDD-PRIME' }],
      c: [{ variant: 'ACH-A' }, { variant: 'KFX-PRIME' }],
    };
    const empty = Array.from({ length: 3 }, () => ({ pilotId: null }));
    const out = autoFill({ catalog, slots: empty, pool, hangars, builds: [], rules });
    expect(out.every((s) => s.pilotId)).toBe(true);
    expect(validateLineup(catalog, out, rules), JSON.stringify(out)).toEqual([]);
    expect(out.find((s) => s.pilotId === 'b').chassis).toBe('Mad Dog');
  });
});
