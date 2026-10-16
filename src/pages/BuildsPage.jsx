import { useState } from 'react';
import { ChassisSelect, ClassPill, Field } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';
import { lookupVariant, parseMechPaste } from '../lib/mechs.js';
import { ROLES } from './PilotPage.jsx';

const empty = { name: '', chassis: null, variant: '', link: '', code: '', notes: '', tags: [], official: false, pilot_id: null };

export default function BuildsPage() {
  const { data, catalog, isCaptain, actions, pilots, pilotsById } = useData();
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState('all');
  const [showImport, setShowImport] = useState(false);

  const f = q.trim().toLowerCase();
  const list = data.builds
    .filter((b) => scope === 'all' || (scope === 'official' ? b.official : !b.official))
    .filter((b) => !f || [b.name, b.chassis, b.variant, ...(b.tags || []), pilotsById[b.pilot_id]?.name].join(' ').toLowerCase().includes(f))
    .sort((a, b) => (catalog.chassisByName.get(a.chassis)?.tons || 0) - (catalog.chassisByName.get(b.chassis)?.tons || 0) || a.name.localeCompare(b.name));

  return (
    <div>
      <div className="row spread">
        <h1>Builds</h1>
        <div className="row">
          <button onClick={() => setShowImport(!showImport)}>Import from Google Sheet</button>
          <button className="primary" onClick={() => setEditing({ ...empty, official: isCaptain })}>New build</button>
        </div>
      </div>
      {showImport && <SheetImport onDone={() => setShowImport(false)} />}
      {editing && <BuildForm build={editing} onClose={() => setEditing(null)} />}
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <input placeholder="Search name, mech, tag, pilot…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All builds</option>
            <option value="official">Team (official) builds</option>
            <option value="personal">Personal builds</option>
          </select>
          <span className="muted small">★ = official team build. Pilots can save personal builds; captains mark builds official.</span>
        </div>
        <table>
          <thead><tr><th>Build</th><th>Mech</th><th>Class</th><th>Tags</th><th>Owner</th><th>Link / code</th><th /></tr></thead>
          <tbody>
            {list.map((b) => {
              const c = catalog.chassisByName.get(b.chassis);
              return (
                <tr key={b.id}>
                  <td>{b.official && <span style={{ color: 'var(--gold)' }}>★ </span>}<b>{b.name}</b>{b.notes && <div className="muted small">{b.notes}</div>}</td>
                  <td>{b.variant || <span>{b.chassis} <span className="muted small">(any)</span></span>}</td>
                  <td>{c && <><ClassPill wclass={c.wclass} /> <span className="muted small">{c.tons}t</span></>}</td>
                  <td className="small">{(b.tags || []).join(', ')}</td>
                  <td className="small">{b.official ? 'Team' : pilotsById[b.pilot_id]?.name || '–'}</td>
                  <td className="small">
                    {b.link && <a href={b.link} target="_blank" rel="noreferrer">Open ↗</a>}{' '}
                    {b.code && <button className="small" onClick={() => navigator.clipboard.writeText(b.code)}>Copy code</button>}
                  </td>
                  <td>{(isCaptain || !b.official) && <button className="small" onClick={() => setEditing(b)}>Edit</button>}</td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={7} className="muted">No builds yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {pilots.length === 0 && <p className="muted small">Tip: add pilots first if you want to save personal builds.</p>}
    </div>
  );
}

function BuildForm({ build, onClose }) {
  const { catalog, isCaptain, actions, pilots } = useData();
  const [b, setB] = useState({ ...build, tags: build.tags || [] });
  const [tagText, setTagText] = useState('');
  const variants = b.chassis ? catalog.chassisByName.get(b.chassis)?.variants || [] : [];
  const save = async () => {
    if (!b.name.trim() || !b.chassis) return;
    const row = {
      name: b.name.trim(), chassis: b.chassis, variant: b.variant || null, link: b.link, code: b.code, notes: b.notes,
      tags: b.tags, official: isCaptain ? b.official : false, pilot_id: b.official ? null : b.pilot_id || null,
    };
    if (b.id) await actions.update('builds', b.id, row);
    else await actions.insert('builds', row);
    onClose();
  };
  const del = async () => {
    if (window.confirm('Delete this build?')) {
      await actions.remove('builds', b.id);
      onClose();
    }
  };
  const addTag = (t) => {
    const tag = t.trim();
    if (tag && !b.tags.includes(tag)) setB({ ...b, tags: [...b.tags, tag] });
    setTagText('');
  };
  return (
    <div className="card stack">
      <h2>{b.id ? 'Edit build' : 'New build'}</h2>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Build name"><input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="e.g. Laser Vomit" style={{ width: 220 }} /></Field>
        <Field label="Chassis"><ChassisSelect value={b.chassis} onChange={(chassis) => setB({ ...b, chassis, variant: '' })} /></Field>
        <Field label="Variant (optional)">
          <select value={b.variant || ''} onChange={(e) => setB({ ...b, variant: e.target.value })} disabled={!b.chassis}>
            <option value="">Any variant</option>
            {variants.map((v) => <option key={v.code} value={v.code}>{v.code}</option>)}
          </select>
        </Field>
        {isCaptain && (
          <label className="row"><input type="checkbox" checked={b.official} onChange={(e) => setB({ ...b, official: e.target.checked })} /> Official team build</label>
        )}
        {!b.official && (
          <Field label="Personal build of">
            <select value={b.pilot_id || ''} onChange={(e) => setB({ ...b, pilot_id: e.target.value || null })}>
              <option value="">Nobody in particular</option>
              {pilots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <Field label="Link (nav-alpha, Grimmechs, …)"><input value={b.link || ''} onChange={(e) => setB({ ...b, link: e.target.value })} style={{ width: 340 }} /></Field>
        <Field label="MWO loadout export code"><input value={b.code || ''} onChange={(e) => setB({ ...b, code: e.target.value })} style={{ width: 300 }} /></Field>
      </div>
      <Field label="Notes"><input value={b.notes || ''} onChange={(e) => setB({ ...b, notes: e.target.value })} /></Field>
      <div>
        <div className="muted small" style={{ marginBottom: 4 }}>Tags (role, map type, anything)</div>
        <div className="row">
          {ROLES.map((r) => (
            <label key={r} className="row small"><input type="checkbox" checked={b.tags.includes(r)} onChange={() => setB({ ...b, tags: b.tags.includes(r) ? b.tags.filter((x) => x !== r) : [...b.tags, r] })} /> {r}</label>
          ))}
          {b.tags.filter((t) => !ROLES.includes(t)).map((t) => (
            <span className="chip" key={t}>{t}<button onClick={() => setB({ ...b, tags: b.tags.filter((x) => x !== t) })}>×</button></span>
          ))}
          <input value={tagText} placeholder="Other tag…" onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag(tagText)} style={{ width: 140 }} />
        </div>
      </div>
      <div className="row">
        <button className="primary" onClick={save} disabled={!b.name.trim() || !b.chassis}>Save</button>
        <button onClick={onClose}>Cancel</button>
        {b.id && <button className="danger right" onClick={del}>Delete</button>}
      </div>
    </div>
  );
}

// Paste rows copied from the team's Google Sheet. The first row must be headers;
// columns are matched by name so the sheet's column order doesn't matter.
function SheetImport({ onDone }) {
  const { catalog, actions, isCaptain, notify } = useData();
  const [text, setText] = useState('');
  const lines = text.trim() ? text.trim().split(/\r?\n/).map((l) => l.split('\t')) : [];
  const header = (lines[0] || []).map((h) => h.trim().toLowerCase());
  const col = (...names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const ci = { name: col('build', 'name'), mech: col('variant', 'mech', 'chassis'), link: col('link', 'url'), code: col('code', 'export'), notes: col('note'), tags: col('tag', 'role') };
  const rows = lines.slice(1).map((cells) => {
    const get = (i) => (i >= 0 ? (cells[i] || '').trim() : '');
    const mechText = get(ci.mech);
    const v = parseMechPaste(mechText, catalog).found[0] || lookupVariant(catalog, mechText);
    const chassis = v?.chassis || catalog.chassis.find((c) => c.name.toLowerCase() === mechText.toLowerCase())?.name || null;
    return {
      name: get(ci.name) || mechText,
      chassis,
      variant: v?.code || null,
      link: get(ci.link),
      code: get(ci.code),
      notes: get(ci.notes),
      tags: get(ci.tags).split(/[,/;]/).map((t) => t.trim()).filter(Boolean),
      official: isCaptain,
      pilot_id: null,
      mechText,
    };
  }).filter((r) => r.name || r.mechText);
  const good = rows.filter((r) => r.chassis);
  const save = async () => {
    await actions.insertMany('builds', good.map(({ mechText, ...r }) => r));
    notify(`Imported ${good.length} builds.`);
    onDone();
  };
  return (
    <div className="card stack">
      <h2>Import builds from a spreadsheet</h2>
      <p className="muted small">
        In Google Sheets select the build rows <b>including the header row</b>, copy, and paste here. Columns are matched by
        header name: Name/Build, Mech/Variant/Chassis, Link/URL, Code/Export, Notes, Tags/Role.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      {lines.length > 1 && (
        <>
          <p className="small">
            Found <b>{rows.length}</b> rows; <b>{good.length}</b> matched a mech.
            {ci.mech < 0 && <span style={{ color: 'var(--warn)' }}> No Mech/Variant/Chassis column found in the header.</span>}
          </p>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            <table>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.chassis ? r.variant || r.chassis : <span style={{ color: 'var(--warn)' }}>"{r.mechText}" not recognised, skipped</span>}</td>
                    <td className="small">{r.tags.join(', ')}</td>
                    <td className="small muted">{r.link}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="primary" onClick={save} disabled={!good.length}>Import {good.length} builds</button>
        </>
      )}
    </div>
  );
}
