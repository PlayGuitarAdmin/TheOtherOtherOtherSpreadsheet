import { useState } from 'react';
import { CLASS_GROUPS, WEIGHT_CLASSES } from '../data/catalog.js';
import { CaptainNote, ChassisSelect, ClassPill, Field, TemplatesMissing } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';
import { slotMech } from '../lib/mechs.js';
import { lineupStats, validateLineup } from '../lib/rules.js';
import { slotsForSize, templateSummary } from '../lib/templates.js';
import { blankSlots } from './EventsPage.jsx';
import { BuildCell, useSlots, VariantCell } from './EventPage.jsx';

export default function TemplatesPage({ id }) {
  return id ? <TemplateEditor id={id} /> : <TemplateList />;
}

const rulesetName = (rulesetsById, id) => (id ? rulesetsById[id]?.name || 'Deleted ruleset' : 'No ruleset');

function TemplateList() {
  const { data, actions, isCaptain, rulesetsById, mapsById, missingTables } = useData();
  const [form, setForm] = useState({ name: '', ruleset_id: data.rulesets[0]?.id || '', team_size: 12 });
  const missing = missingTables.includes('drop_templates');

  const create = async () => {
    if (!form.name.trim()) return;
    const t = await actions.insert('drop_templates', {
      name: form.name.trim(), ruleset_id: form.ruleset_id || null, team_size: form.team_size, map_id: null, notes: '', slots: blankSlots(form.team_size),
    });
    window.location.hash = `#/templates/${t.id}`;
  };

  // Grouped by ruleset, in the ruleset list's order, then "No ruleset" and deleted ones.
  const groups = new Map();
  for (const t of [...data.drop_templates].sort((a, b) => a.name.localeCompare(b.name))) {
    const key = t.ruleset_id || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const order = [...data.rulesets.map((r) => r.id).filter((k) => groups.has(k)), ...[...groups.keys()].filter((k) => !rulesetsById[k])];

  return (
    <div>
      <h1>Drop templates</h1>
      <p className="muted">
        Plan a drop ahead of time: team size, map, and each slot's chassis, variant and build. Import it into any event with the same
        ruleset from the event's <b>+ From template</b> tab, then auto-assign pilots. Captains can also save any event drop as a template.
      </p>
      <TemplatesMissing />
      <CaptainNote />
      {isCaptain && !missing && (
        <div className="card row">
          <Field label="New template name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Brawl on HPG" /></Field>
          <Field label="Ruleset">
            <select value={form.ruleset_id} onChange={(e) => setForm({ ...form, ruleset_id: e.target.value })}>
              <option value="">None</option>
              {data.rulesets.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field label="Team size">
            <select value={form.team_size} onChange={(e) => setForm({ ...form, team_size: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}v{n}</option>)}
            </select>
          </Field>
          <button className="primary" onClick={create} disabled={!form.name.trim()} style={{ alignSelf: 'flex-end' }}>Create template</button>
        </div>
      )}
      {!data.drop_templates.length && !missing && <p className="muted">No templates yet.</p>}
      {order.map((key) => (
        <div className="card" key={key || 'none'}>
          <h2 style={{ marginTop: 0 }}>{rulesetName(rulesetsById, key)}</h2>
          <table>
            <thead><tr><th>Template</th><th>Size</th><th>Map</th><th>Chassis</th></tr></thead>
            <tbody>
              {groups.get(key).map((t) => (
                <tr key={t.id}>
                  <td><a href={`#/templates/${t.id}`}><b>{t.name}</b></a></td>
                  <td>{t.team_size}v{t.team_size}</td>
                  <td>{mapsById[t.map_id]?.name || <span className="muted">TBD</span>}</td>
                  <td className="small">{templateSummary(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function TemplateEditor({ id }) {
  const { data, actions, isCaptain, catalog, rulesetsById } = useData();
  const t = data.drop_templates.find((x) => x.id === id);
  if (!t) return <p className="muted"><TemplatesMissing />Template not found. <a href="#/templates">Back</a></p>;
  return <TemplateForm key={t.id} t={t} editable={isCaptain} actions={actions} data={data} catalog={catalog} rulesetsById={rulesetsById} />;
}

function TemplateForm({ t, editable, actions, data, catalog, rulesetsById }) {
  const [slots, save, patchSlot] = useSlots(t, t.team_size, (next) => actions.update('drop_templates', t.id, { slots: next }), catalog);
  const [name, setName] = useState(t.name);
  const [notes, setNotes] = useState(t.notes || '');
  const rules = rulesetsById[t.ruleset_id]?.rules;
  const warnings = validateLineup(catalog, slots, rules);
  const st = lineupStats(catalog, slots);
  const set = (patch) => actions.update('drop_templates', t.id, patch);

  const setSize = async (size) => {
    if (size < slots.length && slots.slice(size).some((s) => s.chassis) && !window.confirm(`Shrinking to ${size}v${size} drops the last ${slots.length - size} slots. Continue?`)) return;
    await actions.update('drop_templates', t.id, { team_size: size, slots: slotsForSize(slots, size) });
  };
  const duplicate = async () => {
    const copy = await actions.insert('drop_templates', { name: `${t.name} (copy)`, ruleset_id: t.ruleset_id, team_size: t.team_size, map_id: t.map_id, notes: t.notes || '', slots });
    window.location.hash = `#/templates/${copy.id}`;
  };
  const del = async () => {
    if (!window.confirm(`Delete the template "${t.name}"? Drops already imported from it stay.`)) return;
    await actions.remove('drop_templates', t.id);
    window.location.hash = '#/templates';
  };

  return (
    <div>
      <a href="#/templates">← Drop templates</a>
      <div className="card row" style={{ marginTop: 10 }}>
        <Field label="Name"><input value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== t.name && set({ name: name.trim() })} /></Field>
        <Field label="Ruleset">
          <select value={t.ruleset_id || ''} disabled={!editable} onChange={(e) => set({ ruleset_id: e.target.value || null })}>
            <option value="">None</option>
            {data.rulesets.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Team size">
          <select value={t.team_size} disabled={!editable} onChange={(e) => setSize(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}v{n}</option>)}
          </select>
        </Field>
        <Field label="Map">
          <select value={t.map_id || ''} disabled={!editable} onChange={(e) => set({ map_id: e.target.value || null })}>
            <option value="">Map TBD</option>
            {data.maps.filter((m) => m.active !== false || m.id === t.map_id).sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Drop notes (copied into the drop)" style={{ flex: 1 }}>
          <input value={notes} disabled={!editable} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (t.notes || '') && set({ notes })} style={{ width: '100%' }} />
        </Field>
      </div>

      <div className="lineup">
        <div className="card">
          <div className="row spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>{t.name}</h2>
            {editable && (
              <div className="row">
                <button onClick={() => window.confirm('Clear every chassis in this template?') && save(blankSlots(t.team_size))}>Clear all</button>
                <button onClick={duplicate}>Duplicate</button>
                <button className="danger" onClick={del}>Delete template</button>
              </div>
            )}
          </div>
          <div className="slot tpl muted small" style={{ borderBottom: '1px solid var(--line)' }}>
            <span className="n">#</span><span>Lance</span><span>Chassis</span><span>Variant</span><span>Class</span><span>Build</span><span />
          </div>
          {slots.map((s, i) => {
            const mech = slotMech(catalog, s);
            const onPatch = (fn) => patchSlot(i, fn);
            return (
              <div className="slot tpl" key={i}>
                <span className="n">{i + 1}</span>
                <input value={s.lance || ''} placeholder="–" disabled={!editable} onChange={(e) => onPatch(() => ({ lance: e.target.value }))} title="Optional lance name, e.g. Alpha" />
                <ChassisSelect value={s.chassis} disabled={!editable} onChange={(chassis) => onPatch(() => ({ chassis, variant: null, buildId: null, grim: null }))} />
                <VariantCell slot={s} editable={editable} onPatch={onPatch} />
                <span className="small" style={{ whiteSpace: 'nowrap' }}>{mech ? <><ClassPill wclass={mech.wclass} /> <span className="muted">{mech.tons}t</span></> : <span className="muted">–</span>}</span>
                <BuildCell slot={s} editable={editable} onPatch={onPatch} />
                {editable ? <button className="link" title="Clear slot" onClick={() => onPatch(() => ({ chassis: null, variant: null, buildId: null, grim: null }))}>×</button> : <span />}
              </div>
            );
          })}
        </div>
        <div className="card">
          <h3>Totals</h3>
          <div className="stats">
            <div className="stat"><div className="v">{st.tons}t</div><div className="k">Tonnage{rules?.maxTons ? ` / ${rules.maxTons}` : ''}{rules?.minTons ? ` (min ${rules.minTons})` : ''}</div></div>
            <div className="stat"><div className="v">{st.heroes}</div><div className="k">Heroes</div></div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            {WEIGHT_CLASSES.map((c) => <span key={c} className={`pill ${c}`}>{st.byClass[c]} {c}</span>)}
            {Object.entries(CLASS_GROUPS).map(([g, cs]) => <span key={g} className="pill">{cs.reduce((n, c) => n + st.byClass[c], 0)} {g.toLowerCase()}</span>)}
          </div>
          <div style={{ marginTop: 12 }}>
            {warnings.length ? (
              <div className="warnings"><b>{warnings.length} rule warning{warnings.length === 1 ? '' : 's'}</b><ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>
            ) : (
              <div className="ok-box">{st.filled ? `Legal for ${rulesetName(rulesetsById, t.ruleset_id)}.` : 'No mechs picked yet.'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
