import { describe, expect, it } from 'vitest';
import { BUILTIN_VARIANTS, classesInText } from '../src/data/catalog.js';
import { assignPilots, dropsPlayed } from '../src/lib/autofill.js';
import { buildCatalog, lookupVariant, parseMechPaste, sortSlots } from '../src/lib/mechs.js';
import { grimBuildsFor, indexGrimBuilds, parseGrimMechs } from '../src/lib/grimmechs.js';
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

  it('knows heroes by name and short code, and Legendaries', () => {
    expect(lookupVariant(catalog, 'RVN-H')).toMatchObject({ code: 'HUGINN', chassis: 'Raven', kind: 'hero' });
    expect(lookupVariant(catalog, 'AS7-S(L)').kind).toBe('loyalty');
    expect(lookupVariant(catalog, 'CN9-YLW2(LGD)').kind).toBe('legendary');
    expect(lookupVariant(catalog, 'HOWL')).toMatchObject({ chassis: 'Timber Wolf', kind: 'legendary' });
    expect(lookupVariant(catalog, 'TBR-H')).toMatchObject({ kind: 'hero', lgdHero: true });
  });

  it('accepts both spellings of Tournament Supporter Pack mechs', () => {
    for (const c of ['LCT', 'CRB', 'MAD', 'TBR', 'KDK']) {
      expect(lookupVariant(catalog, `${c}-M(TSP)`)?.code).toBe(`${c}-M(TSP)`);
      expect(lookupVariant(catalog, `${c}-MTS(P)`)?.code).toBe(`${c}-M(TSP)`);
    }
    const { found } = parseMechPaste('TBR-M(TSP) and KDK-MTS(P)', catalog);
    expect(found.map((f) => f.code).sort()).toEqual(['KDK-M(TSP)', 'TBR-M(TSP)']);
    expect(lookupVariant(catalog, 'SD1-O')).toMatchObject({ chassis: 'Sunder', tons: 90 });
  });

  it('resolves special suffix variants', () => {
    expect(lookupVariant(catalog, 'AS7-D(F)')).toMatchObject({ chassis: 'Atlas', tons: 100, kind: 'special' });
    expect(lookupVariant(catalog, 'SDR-5K (C)')).toMatchObject({ chassis: 'Spider', kind: 'champion' });
  });
});

describe('paste parser', () => {
  it('finds codes in messy text and reports unknown ones', () => {
    const text = `MECH STATS\nAtlas AS7-D 120 matches\nTimber Wolf TBR-Prime\nKDK-3, ZZZ-9X\nAS7-D(F) 3 matches\nHuginn 4\nThe Boar's Head\nGrid Iron Ltd\nDate 2026-10-15`;
    const { found, unknown } = parseMechPaste(text, catalog);
    expect(found.map((f) => f.code).sort()).toEqual(['AS7-D', 'AS7-D(F)', 'GRID IRON LTD', 'HUGINN', 'KDK-3', 'TBR-PRIME', "THE BOAR'S HEAD"]);
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

  it('bans Legendaries and their hero versions but not Loyalty mechs', () => {
    const w = validateLineup(catalog, [slot('HOWL'), slot('TBR-H'), slot('AS7-S(L)')], emptyRules());
    expect(w).toEqual(['HOWL is a Legendary mech, which is banned.', 'TBR-H is the hero version of a Legendary, which is banned.']);
  });

  it('is happy with a legal lineup', () => {
    expect(validateLineup(catalog, [slot('TBR-PRIME'), slot('ACH-PRIME')], { ...emptyRules(), maxTons: 200 })).toEqual([]);
  });
});

describe('auto-assign pilots', () => {
  const hangars = {
    a: [{ variant: 'DWF-PRIME' }, { variant: 'ACH-PRIME' }],
    b: [{ variant: 'TBR-PRIME' }, { variant: 'TBR-S', mastered: true }, { variant: 'DWF-A' }],
    c: [{ variant: 'ACH-A' }, { variant: 'TBR-C' }],
  };
  const pool = [
    { id: 'a', prefs: { favorites: ['Dire Wolf'] } },
    { id: 'b', prefs: {} },
    { id: 'c', prefs: { wont: ['Timber Wolf'] } },
  ];
  const run = (slots, opts = {}) => assignPilots({ catalog, slots, pool, hangars, rules: emptyRules(), ...opts });

  it('only fills slots that have a chassis and no pilot, and changes nothing else', () => {
    const slots = [
      { pilotId: null, chassis: 'Dire Wolf', variant: null },
      { pilotId: 'z', chassis: 'Atlas', variant: 'AS7-D', lance: 'Alpha' },
      { pilotId: null, chassis: null, variant: null },
      { pilotId: null, chassis: 'Timber Wolf', variant: null },
    ];
    const { slots: out, unfilled } = run(slots);
    expect(out[0]).toEqual({ ...slots[0], pilotId: 'a' });
    expect(out[1]).toEqual(slots[1]);
    expect(out[2]).toEqual(slots[2]);
    expect(out[3]).toEqual({ ...slots[3], pilotId: 'b' });
    expect(unfilled).toEqual([]);
  });

  it('respects a variant the captain set, won\'t-play, and reports chassis nobody owns', () => {
    const { slots: out, unfilled } = run([
      { pilotId: null, chassis: 'Dire Wolf', variant: 'DWF-A' },
      { pilotId: null, chassis: 'Timber Wolf', variant: 'TBR-C' },
      { pilotId: null, chassis: 'Atlas', variant: null },
    ]);
    expect(out[0].pilotId).toBe('b');
    expect(out[1].pilotId).toBe(null);
    expect(unfilled).toEqual([1, 2]);
  });

  it('optimises the whole lineup, not slot by slot', () => {
    // B ranks Assault first but also owns the light; C has no preferences. B must get the assault.
    const h = { b: [{ variant: 'RVN-4X' }, { variant: 'SR-1' }], c: [{ variant: 'RVN-3L' }, { variant: 'SR-2' }], d: [{ variant: 'SR-1' }] };
    const p = [{ id: 'b', prefs: { classes: ['Assault', 'Heavy', 'Light'] } }, { id: 'c', prefs: {} }, { id: 'd', prefs: {} }];
    const out = assignPilots({ catalog, slots: [{ chassis: 'Raven' }, { chassis: 'Stone Rhino' }], pool: p, hangars: h, rules: emptyRules() }).slots;
    expect(out.map((s) => s.pilotId)).toEqual(['c', 'b']);
  });

  it('gives favourites a flat bonus and breaks exact ties at random', () => {
    const h = { x: [{ variant: 'DWF-PRIME' }], y: [{ variant: 'DWF-A' }] };
    const p = [{ id: 'x', prefs: { favorites: ['Atlas', 'Timber Wolf', 'Dire Wolf'] } }, { id: 'y', prefs: { favorites: ['Dire Wolf'] } }];
    const pick = (r) => assignPilots({ catalog, slots: [{ chassis: 'Dire Wolf' }], pool: p, hangars: h, rules: emptyRules(), random: r }).slots[0].pilotId;
    let k = 0;
    expect(pick(() => [0.9, 0.1][k++ % 2])).toBe('x');
    k = 0;
    expect(pick(() => [0.1, 0.9][k++ % 2])).toBe('y');
  });

  it('counts drops played in earlier drops only, once per drop', () => {
    const drops = [
      { slots: [{ pilotId: 'a' }, { pilotId: 'b' }, { pilotId: 'a' }] },
      { slots: [{ pilotId: 'a' }, { pilotId: null }] },
      { slots: [{ pilotId: 'c' }] },
    ];
    expect(dropsPlayed(drops, 2)).toEqual({ a: 2, b: 1 });
    expect(dropsPlayed(drops)).toEqual({ a: 2, b: 1, c: 1 });
    expect(dropsPlayed(drops, 0)).toEqual({});
  });

  it('prefers pilots who have played fewer drops, growing with each drop', () => {
    const h = { x: [{ variant: 'DWF-PRIME' }], y: [{ variant: 'DWF-A' }] };
    const p = [{ id: 'x', prefs: { favorites: ['Dire Wolf'] } }, { id: 'y', prefs: {} }];
    const pick = (played) => assignPilots({ catalog, slots: [{ chassis: 'Dire Wolf' }], pool: p, hangars: h, rules: emptyRules(), played, random: () => 0 }).slots[0].pilotId;
    expect(pick({})).toBe('x');
    expect(pick({ x: 1 })).toBe('x');
    expect(pick({ x: 3 })).toBe('y');
    expect(pick({ x: 3, y: 2 })).toBe('x');
  });

  it('still fills every slot it can, however many drops pilots have played', () => {
    const out = run([{ chassis: 'Dire Wolf' }, { chassis: 'Timber Wolf' }], { played: { a: 30, b: 30, c: 0 } }).slots;
    expect(out.map((s) => s.pilotId)).toEqual(['a', 'b']);
  });

  it('gives a contested chassis to the pilot who fits it better', () => {
    const { slots: out } = run([{ pilotId: null, chassis: 'Arctic Cheetah' }, { pilotId: null, chassis: 'Dire Wolf' }]);
    expect(out[1].pilotId).toBe('a');
    expect(out[0].pilotId).toBe('c');
  });
});

describe('drop order', () => {
  it('sorts by chassis tonnage, then name, with empty slots last', () => {
    const out = sortSlots(catalog, [{ chassis: null }, { chassis: 'Atlas' }, { chassis: 'Timber Wolf' }, { chassis: 'Mad Dog' }, { chassis: 'Arctic Cheetah' }]);
    expect(out.map((s) => s.chassis)).toEqual(['Arctic Cheetah', 'Mad Dog', 'Timber Wolf', 'Atlas', null]);
  });
});

describe('weight class shorthand and preferences', () => {
  it('reads lights / bigs / heavies', () => {
    expect(classesInText('lights please')).toEqual(['Light', 'Medium']);
    expect(classesInText('any of the bigs')).toEqual(['Heavy', 'Assault']);
    expect(classesInText('Heavies')).toEqual(['Heavy', 'Assault']);
    expect(classesInText('a light')).toEqual(['Light']);
    expect(classesInText('Timber Wolf')).toEqual([]);
  });

  it('applies lights / bigs limits in rulesets', () => {
    const rules = emptyRules();
    rules.groups.Bigs = { min: null, max: 1 };
    rules.groups.Lights = { min: 1, max: null };
    const w = validateLineup(catalog, [slot('TBR-PRIME'), slot('DWF-PRIME')], rules);
    expect(w).toContain('At most 1 bigs (Heavy + Assault) allowed, has 2.');
    expect(w).toContain('Needs at least 1 lights (Light + Medium), has 0.');
  });

  it('auto-assign follows ranked classes, won\'t-play classes and event requests', () => {
    const hangars = { a: [{ variant: 'DWF-PRIME' }, { variant: 'ACH-PRIME' }, { variant: 'NVA-PRIME' }] };
    const slots = [{ pilotId: null, chassis: 'Dire Wolf' }, { pilotId: null, chassis: 'Nova' }, { pilotId: null, chassis: 'Arctic Cheetah' }];
    const run = (prefs, requests = {}) => {
      const out = assignPilots({ catalog, slots, pool: [{ id: 'a', prefs }], hangars, rules: emptyRules(), requests }).slots;
      return out.find((s) => s.pilotId)?.chassis;
    };
    expect(run({ classes: ['Medium', 'Assault'] })).toBe('Nova');
    expect(run({ classes: ['Assault'], wontClasses: ['Assault'] })).not.toBe('Dire Wolf');
    expect(run({ classes: ['Light'] }, { a: 'bigs tonight' })).toBe('Dire Wolf');
  });
});

describe('GrimMechs builds', () => {
  const row = (id, variant, chassis, loadout = 'LOAD', extra = '') =>
    `<tr id="${id}" class="BdEnt"><td class="faction Clan center">Clan</td><td class="mechname chassisname Clan">${chassis}</td>` +
    `<td class="mechname variantname"><span><span title="${variant}">${variant}</span></span></td>` +
    `<td class="buildname leftBorderThicc"><div class="bd"><button><img class="bc"></button></div><a href="https://mwo.nav-alpha.com/mechlab?b=x_${id}&amp;y=1" target="_blank">Build ${id}</a>${extra}</td>` +
    `<td class="buildname engine center">XL300</td><td class="buildname loadout">${loadout}</td><td class="range long-range center">long</td>` +
    `<td class="date leftBorderThicc center"><span>3 Mar 2025</span><div style="display:none;">Added by X</div></td></tr>`;
  const html = `<tbody>${[
    row(1, 'TBR-PRIME', 'Timber Wolf', '2ERLL + 4ERML', '<span class="reco-yes">&nbsp;&#9733;</span>'),
    row(2, 'TBR-M', 'Timber Wolf', '4HLL'),
    row(3, 'TBR-A/C/D/BH', 'Timber Wolf', '2LPL &amp; more'),
    row(4, 'EBJ-any', 'Ebon Jaguar'),
    row(5, 'RFL-3N-SH', 'Sneede'),
  ].join('')}</tbody>`;
  const rows = parseGrimMechs(html);
  const idx = indexGrimBuilds(catalog, rows);

  it('reads loadout, build link and name from the page', () => {
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ id: '1', variant: 'TBR-PRIME', loadout: '2ERLL + 4ERML', name: 'Build 1', engine: 'XL300', range: 'long', updated: '3 Mar 2025', reco: true });
    expect(rows[0].link).toBe('https://mwo.nav-alpha.com/mechlab?b=x_1&y=1');
    expect(rows[2].loadout).toBe('2LPL & more');
  });

  it('maps loose variant labels onto our chassis and codes', () => {
    expect(idx.byId.get('2').variants).toEqual(['TBR-M(TSP)']);
    expect(idx.byId.get('3').variants).toEqual(['TBR-A', 'TBR-C', 'TBR-D', 'TBR-BH']);
    expect(idx.byId.get('4')).toMatchObject({ chassis: 'Ebon Jaguar', variants: [] });
    expect(idx.byId.get('5').variants).toEqual(['RFL-3N-SHLGD']);
  });

  it('lists builds for a slot, narrowed by variant, recommended first', () => {
    expect(grimBuildsFor(idx, 'Timber Wolf', null).map((b) => b.id)).toEqual(['1', '3', '2']);
    expect(grimBuildsFor(idx, 'Timber Wolf', 'TBR-C').map((b) => b.id)).toEqual(['3']);
    expect(grimBuildsFor(idx, 'Ebon Jaguar', 'EBJ-A')).toHaveLength(1);
    expect(grimBuildsFor(idx, null, null)).toEqual([]);
  });
});
