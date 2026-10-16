import { useState } from 'react';
import { WEIGHT_CLASSES, weightClass } from '../data/catalog.js';
import { ClassPill, Field, KindPill, TechLabel } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';

const KINDS = ['standard', 'omni', 'hero', 'champion', 'special', 'legendary'];

export default function MechsPage() {
  const { catalog, data, actions, isCaptain, hangars, pilotsById } = useData();
  const [q, setQ] = useState('');
  const [wclass, setWclass] = useState('');
  const [tech, setTech] = useState('');
  const [form, setForm] = useState({ code: '', chassis: '', tons: 50, tech: 'IS', kind: 'standard' });

  const owners = {};
  for (const [pid, list] of Object.entries(hangars)) for (const h of list) (owners[h.variant] ||= []).push(pilotsById[pid]?.name);

  const f = q.trim().toLowerCase();
  const list = catalog.chassis.filter(
    (c) => (!wclass || c.wclass === wclass) && (!tech || c.tech === tech) && (!f || c.name.toLowerCase().includes(f) || c.variants.some((v) => v.code.toLowerCase().includes(f))),
  );

  const save = async () => {
    const code = form.code.trim().toUpperCase();
    if (!code || !form.chassis.trim()) return;
    const existing = data.custom_mechs.find((m) => m.code === code);
    const row = { code, chassis: form.chassis.trim(), tons: Number(form.tons), tech: form.tech, kind: form.kind };
    if (existing) await actions.update('custom_mechs', existing.id, row);
    else await actions.insert('custom_mechs', row);
    setForm({ ...form, code: '' });
  };

  const setKind = async (v, kind) => {
    const existing = data.custom_mechs.find((m) => m.code === v.code);
    const row = { code: v.code, chassis: v.chassis, tons: v.tons, tech: v.tech, kind };
    if (existing) await actions.update('custom_mechs', existing.id, row);
    else await actions.insert('custom_mechs', row);
  };

  const pickChassis = (name) => {
    const c = catalog.chassisByName.get(name);
    setForm({ ...form, chassis: name, ...(c ? { tons: c.tons, tech: c.tech } : {}) });
  };

  return (
    <div>
      <h1>Mech Catalog</h1>
      <div className="card stack">
        <h2>Add a missing mech or fix one</h2>
        <p className="muted small">
          New MWO release, or a wrong tonnage? Add it here and it's available to everyone straight away. Entering a code that already
          exists overrides it. To mark a Legendary, pick "legendary" in the list below or here.
        </p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Variant code"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. NGA-4" style={{ width: 140 }} /></Field>
          <Field label="Chassis (existing or new)">
            <input list="chassis-names" value={form.chassis} onChange={(e) => pickChassis(e.target.value)} style={{ width: 180 }} />
            <datalist id="chassis-names">{catalog.chassis.map((c) => <option key={c.name} value={c.name} />)}</datalist>
          </Field>
          <Field label="Tons"><input className="num" type="number" step="5" min="20" max="100" value={form.tons} onChange={(e) => setForm({ ...form, tons: e.target.value })} /></Field>
          <span className="muted small" style={{ paddingBottom: 8 }}>{weightClass(Number(form.tons))}</span>
          <Field label="Tech">
            <select value={form.tech} onChange={(e) => setForm({ ...form, tech: e.target.value })}><option value="IS">Inner Sphere</option><option value="CL">Clan</option></select>
          </Field>
          <Field label="Type">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </Field>
          <button className="primary" onClick={save}>Save mech</button>
        </div>
        {data.custom_mechs.length > 0 && (
          <div className="small">
            <b>Added or changed by the team:</b>{' '}
            {data.custom_mechs.map((m) => (
              <span className="chip" key={m.id} style={{ margin: 2 }}>
                {m.code} · {m.chassis} {m.tons}t {m.kind !== 'standard' ? m.kind : ''}
                {isCaptain && <button onClick={() => actions.remove('custom_mechs', m.id)} title="Remove (reverts to built-in)">×</button>}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
        <select value={wclass} onChange={(e) => setWclass(e.target.value)}><option value="">All classes</option>{WEIGHT_CLASSES.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={tech} onChange={(e) => setTech(e.target.value)}><option value="">IS + Clan</option><option value="IS">Inner Sphere</option><option value="CL">Clan</option></select>
        <span className="muted small">{list.length} chassis · {list.reduce((n, c) => n + c.variants.length, 0)} variants. Number = pilots who own it.</span>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Chassis</th><th>Tons</th><th>Class</th><th>Tech</th><th>Variants</th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.name}>
                <td><b>{c.name}</b></td>
                <td>{c.tons}</td>
                <td><ClassPill wclass={c.wclass} /></td>
                <td><TechLabel tech={c.tech} /></td>
                <td>
                  <div className="chips">
                    {c.variants.map((v) => (
                      <span key={v.code} className="chip" title={(owners[v.code] || []).join(', ')}>
                        {v.code} <KindPill kind={v.kind} />
                        {owners[v.code] && <span className="muted">{owners[v.code].length}</span>}
                        {isCaptain && (
                          <select value={v.kind} onChange={(e) => setKind(v, e.target.value)} style={{ padding: 0, fontSize: 11, border: 'none', background: 'transparent', width: 18 }} title="Change type">
                            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                          </select>
                        )}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
