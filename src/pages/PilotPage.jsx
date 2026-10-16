import { useMemo, useState } from 'react';
import { CLASS_GROUPS, WEIGHT_CLASSES, classMatches } from '../data/catalog.js';
import { ClassPill, Field, KindPill, MechChips, TechLabel } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';
import { lookupVariant, parseMechPaste } from '../lib/mechs.js';

export const ROLES = ['Brawl', 'Poke', 'Sniper', 'Scout', 'LRM', 'Support', 'Flex'];

export default function PilotPage({ id }) {
  const { pilotsById } = useData();
  const pilot = pilotsById[id];
  const [tab, setTab] = useState('hangar');
  if (!pilot) return <p className="muted">Pilot not found. <a href="#/pilots">Back to pilots</a></p>;
  return (
    <div>
      <div className="row">
        <a href="#/pilots">← Pilots</a>
      </div>
      <h1 style={{ marginTop: 10 }}>{pilot.name}</h1>
      <div className="tabs">
        {[['hangar', 'Hangar'], ['paste', 'Paste from mwomercs.com'], ['prefs', 'Preferences'], ['attendance', 'Attendance'], ['profile', 'Profile']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'hangar' && <Hangar pilot={pilot} />}
      {tab === 'paste' && <PasteImport pilot={pilot} onDone={() => setTab('hangar')} />}
      {tab === 'prefs' && <Prefs pilot={pilot} />}
      {tab === 'attendance' && <Attendance pilot={pilot} />}
      {tab === 'profile' && <Profile pilot={pilot} />}
    </div>
  );
}

function Hangar({ pilot }) {
  const { catalog, hangars, actions } = useData();
  const [filter, setFilter] = useState('');
  const [wclass, setWclass] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(true);
  const owned = hangars[pilot.id] || [];
  const ownedByCode = new Map(owned.map((h) => [h.variant, h]));
  const ownedMechs = owned.map((h) => lookupVariant(catalog, h.variant)).filter(Boolean);
  const ownedChassis = new Set(ownedMechs.map((m) => m.chassis));

  const toggle = async (code) => {
    const h = ownedByCode.get(code);
    if (h) await actions.remove('pilot_mechs', h.id);
    else await actions.insert('pilot_mechs', { pilot_id: pilot.id, variant: code, mastered: false });
  };
  const toggleMastered = (code) => {
    const h = ownedByCode.get(code);
    if (h) actions.update('pilot_mechs', h.id, { mastered: !h.mastered });
  };

  const f = filter.trim().toLowerCase();
  const list = catalog.chassis.filter((c) => {
    if (!classMatches(wclass, c.wclass)) return false;
    if (ownedOnly && !ownedChassis.has(c.name)) return false;
    if (f && !c.name.toLowerCase().includes(f) && !c.variants.some((v) => v.code.toLowerCase().includes(f))) return false;
    return true;
  });

  return (
    <div>
      <div className="card">
        <div className="stats">
          <div className="stat"><div className="v">{ownedChassis.size}</div><div className="k">Chassis</div></div>
          <div className="stat"><div className="v">{owned.length}</div><div className="k">Variants</div></div>
          {WEIGHT_CLASSES.map((c) => (
            <div className="stat" key={c}>
              <div className="v">{new Set(ownedMechs.filter((m) => m.wclass === c).map((m) => m.chassis)).size}</div>
              <div className="k">{c} chassis</div>
            </div>
          ))}
          <div className="stat"><div className="v">{owned.filter((h) => h.mastered).length}</div><div className="k">Mastered ★</div></div>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Search chassis or variant…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 240 }} />
        <select value={wclass} onChange={(e) => setWclass(e.target.value)}>
          <option value="">All classes</option>
          {WEIGHT_CLASSES.map((c) => <option key={c}>{c}</option>)}
          <option value="Lights">Lights (Light + Medium)</option>
          <option value="Bigs">Bigs (Heavy + Assault)</option>
        </select>
        <label className="row small"><input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} /> Owned chassis only</label>
        <span className="muted small">Tick the variants you own. Click ★ to mark one mastered / ready.</span>
      </div>
      {list.length === 0 && <p className="muted">{ownedOnly ? 'No mechs yet. Untick "Owned chassis only" to add some, or use the paste tab.' : 'No match.'}</p>}
      <div className="chassis-grid">
        {list.map((c) => {
          const extras = owned.filter((h) => {
            const m = lookupVariant(catalog, h.variant);
            return m && m.chassis === c.name && !c.variants.some((v) => v.code === h.variant);
          });
          return (
            <div key={c.name} className={`chassis-box ${ownedChassis.has(c.name) ? 'owned' : ''}`}>
              <div className="title">
                <span>{c.name}</span>
                <span className="row"><span className="muted small">{c.tons}t</span> <TechLabel tech={c.tech} /> <ClassPill wclass={c.wclass} /></span>
              </div>
              {[...c.variants, ...extras.map((h) => lookupVariant(catalog, h.variant))].map((v) => {
                const h = ownedByCode.get(v.code);
                return (
                  <label key={v.code} title={v.kind !== 'standard' ? v.kind : ''}>
                    <input type="checkbox" checked={!!h} onChange={() => toggle(v.code)} />
                    <span style={{ color: v.kind === 'hero' ? 'var(--gold)' : v.kind === 'legendary' ? '#c58cff' : undefined }}>{v.code}</span>
                    {h && (
                      <button className="link small" onClick={(e) => { e.preventDefault(); toggleMastered(v.code); }} title="Mastered / ready">
                        {h.mastered ? '★' : '☆'}
                      </button>
                    )}
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PasteImport({ pilot, onDone }) {
  const { catalog, hangars, actions, notify } = useData();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [replace, setReplace] = useState(false);
  const owned = hangars[pilot.id] || [];
  const ownedCodes = new Set(owned.map((h) => h.variant));

  const parse = () => {
    const r = parseMechPaste(text, catalog);
    setResult(r);
    setPicked(new Set(r.found.map((m) => m.code)));
  };

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveHangar();
    } finally {
      setSaving(false);
    }
  };
  const saveHangar = async () => {
    const add = [...picked].filter((c) => !ownedCodes.has(c));
    await actions.insertMany('pilot_mechs', add.map((variant) => ({ pilot_id: pilot.id, variant, mastered: false })));
    let removed = 0;
    if (replace) {
      const drop = owned.filter((h) => !picked.has(h.variant)).map((h) => h.id);
      removed = drop.length;
      await actions.removeMany('pilot_mechs', drop);
    }
    notify(`Added ${add.length} mech${add.length === 1 ? '' : 's'}${replace ? `, removed ${removed}` : ''}.`);
    onDone();
  };

  const sorted = useMemo(
    () => (result ? [...result.found].sort((a, b) => a.tons - b.tons || a.code.localeCompare(b.code)) : []),
    [result],
  );

  return (
    <div className="grid2">
      <div className="card stack">
        <h2>1. Paste your mech list</h2>
        <ol className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Log in at mwomercs.com and open your profile's <b>Mech Stats</b> page (or any page that lists your mechs).</li>
          <li>Select the whole page (Ctrl+A), copy (Ctrl+C) and paste it below (Ctrl+V).</li>
          <li>The app finds every mech variant code in the text, whatever the layout. You check the list before saving.</li>
        </ol>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste here… e.g. TBR-PRIME, AS7-D(F), KDK-3 …" style={{ minHeight: 260 }} />
        <div className="row">
          <button className="primary" onClick={parse} disabled={!text.trim()}>Find mechs</button>
          <button onClick={() => { setText(''); setResult(null); }}>Clear</button>
        </div>
      </div>
      <div className="card stack">
        <h2>2. Check and save</h2>
        {!result && <p className="muted">Results appear here.</p>}
        {result && (
          <>
            <div className="row">
              <b>{result.found.length}</b> mechs found, <b>{result.found.filter((m) => !ownedCodes.has(m.code)).length}</b> new.
              <button className="small" onClick={() => setPicked(new Set(result.found.map((m) => m.code)))}>All</button>
              <button className="small" onClick={() => setPicked(new Set())}>None</button>
            </div>
            <div style={{ maxHeight: 380, overflow: 'auto' }}>
              <table>
                <tbody>
                  {sorted.map((m) => (
                    <tr key={m.code}>
                      <td><input type="checkbox" checked={picked.has(m.code)} onChange={() => {
                        const n = new Set(picked);
                        n.has(m.code) ? n.delete(m.code) : n.add(m.code);
                        setPicked(n);
                      }} /></td>
                      <td><b>{m.code}</b></td>
                      <td>{m.chassis}</td>
                      <td>{m.tons}t</td>
                      <td><ClassPill wclass={m.wclass} /> <KindPill kind={m.kind} /></td>
                      <td className="small">{ownedCodes.has(m.code) ? <span className="muted">already owned</span> : <span style={{ color: 'var(--green)' }}>new</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.unknown.length > 0 && (
              <div className="warnings small">
                These look like mech codes but aren't in the catalog: <b>{result.unknown.slice(0, 30).join(', ')}</b>
                {result.unknown.length > 30 && ' …'}. If any is a real mech, add it on the <a href="#/mechs">Mech Catalog</a> page and paste again.
              </div>
            )}
            <label className="row small">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Replace my hangar (remove mechs that aren't ticked here)
            </label>
            <button className="primary" onClick={save} disabled={saving || (!picked.size && !replace)}>{saving ? 'Saving…' : 'Save to hangar'}</button>
          </>
        )}
      </div>
    </div>
  );
}

function Prefs({ pilot }) {
  const { actions } = useData();
  const prefs = pilot.prefs || {};
  const set = (patch) => actions.update('pilots', pilot.id, { prefs: { ...prefs, ...patch } });
  const toggleIn = (key, val) => {
    const list = prefs[key] || [];
    set({ [key]: list.includes(val) ? list.filter((x) => x !== val) : [...list, val] });
  };
  return (
    <div className="grid2">
      <div className="card stack">
        <h2>Favourite mechs</h2>
        <p className="muted small">Chassis or exact variants, in any order. Auto-assign gives each favourite the same bonus.</p>
        <MechChips value={prefs.favorites || []} onChange={(v) => set({ favorites: v })} />
        <h2 style={{ marginTop: 18 }}>Won't play</h2>
        <p className="muted small">Auto-assign never puts you in these, and captains get a warning if they do.</p>
        <MechChips value={prefs.wont || []} onChange={(v) => set({ wont: v })} />
      </div>
      <div className="card stack">
        <h2>Weight classes</h2>
        <p className="muted small">Rank the classes you like best. Auto-assign prefers higher ranks and never picks a class marked "Won't play".</p>
        <ClassRanking prefs={prefs} set={set} />
        <h2 style={{ marginTop: 18 }}>Preferred roles</h2>
        <div className="row">
          {ROLES.map((r) => (
            <label key={r} className="row"><input type="checkbox" checked={(prefs.roles || []).includes(r)} onChange={() => toggleIn('roles', r)} /> {r}</label>
          ))}
        </div>
      </div>
    </div>
  );
}

function Attendance({ pilot }) {
  const { data, actions } = useData();
  const events = [...data.events].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const setStatus = async (event, status) => {
    const row = data.attendance.find((a) => a.event_id === event.id && a.pilot_id === pilot.id);
    if (row) await actions.update('attendance', row.id, { status });
    else await actions.insert('attendance', { event_id: event.id, pilot_id: pilot.id, status });
  };
  return (
    <div className="card">
      <table>
        <thead><tr><th>Date</th><th>Event</th><th>Attending?</th></tr></thead>
        <tbody>
          {events.map((e) => {
            const st = data.attendance.find((a) => a.event_id === e.id && a.pilot_id === pilot.id)?.status;
            return (
              <tr key={e.id}>
                <td>{e.date || '–'}</td>
                <td><a href={`#/events/${e.id}`}>{e.name}</a></td>
                <td className="row">
                  {['yes', 'maybe', 'no'].map((s) => (
                    <button key={s} className={`small ${st === s ? 'gold' : ''}`} onClick={() => setStatus(e, s)}>{s[0].toUpperCase() + s.slice(1)}</button>
                  ))}
                </td>
              </tr>
            );
          })}
          {events.length === 0 && <tr><td colSpan={3} className="muted">No events yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Profile({ pilot }) {
  const { actions, isCaptain } = useData();
  const [name, setName] = useState(pilot.name);
  const [notes, setNotes] = useState(pilot.notes || '');
  const del = async () => {
    if (!window.confirm(`Delete ${pilot.name} and their whole hangar? This can't be undone.`)) return;
    await actions.removeWhere('pilot_mechs', 'pilot_id', pilot.id);
    await actions.removeWhere('attendance', 'pilot_id', pilot.id);
    await actions.remove('pilots', pilot.id);
    window.location.hash = '#/pilots';
  };
  return (
    <div className="card stack" style={{ maxWidth: 560 }}>
      <Field label="Pilot name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 80, fontFamily: 'inherit' }} /></Field>
      <div className="row">
        <button className="primary" onClick={() => actions.update('pilots', pilot.id, { name: name.trim() || pilot.name, notes })}>Save</button>
        {isCaptain && <button className="danger right" onClick={del}>Delete pilot</button>}
      </div>
    </div>
  );
}

const ORDINAL = ['1st choice', '2nd choice', '3rd choice', '4th choice'];

// prefs.classes is the ranked list (best first); prefs.wontClasses are never picked.
function ClassRanking({ prefs, set }) {
  const ranked = prefs.classes || [];
  const wont = prefs.wontClasses || [];
  const valueOf = (c) => (wont.includes(c) ? 'wont' : ranked.includes(c) ? String(ranked.indexOf(c)) : '');
  const choose = (c, v) => {
    const rest = ranked.filter((x) => x !== c);
    const nextWont = wont.filter((x) => x !== c);
    if (v === 'wont') return set({ classes: rest, wontClasses: [...nextWont, c] });
    if (v === '') return set({ classes: rest, wontClasses: nextWont });
    rest.splice(Math.min(Number(v), rest.length), 0, c);
    set({ classes: rest, wontClasses: nextWont });
  };
  const preset = (group) => {
    const classes = CLASS_GROUPS[group];
    set({ classes: [...classes, ...ranked.filter((c) => !classes.includes(c))], wontClasses: wont.filter((c) => !classes.includes(c)) });
  };
  return (
    <div className="stack">
      <table style={{ width: 'auto' }}>
        <tbody>
          {WEIGHT_CLASSES.map((c) => (
            <tr key={c}>
              <td><ClassPill wclass={c} /></td>
              <td>
                <select value={valueOf(c)} onChange={(e) => choose(c, e.target.value)}>
                  <option value="">No preference</option>
                  {ORDINAL.map((o, i) => <option key={o} value={i}>{o}</option>)}
                  <option value="wont">Won't play</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row small">
        <span className="muted">Quick pick:</span>
        <button className="small" onClick={() => preset('Lights')}>Prefers lights (Light + Medium)</button>
        <button className="small" onClick={() => preset('Bigs')}>Prefers bigs (Heavy + Assault)</button>
      </div>
    </div>
  );
}
