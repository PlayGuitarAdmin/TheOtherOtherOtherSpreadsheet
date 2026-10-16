import { useState } from 'react';
import { WEIGHT_CLASSES } from '../data/catalog.js';
import { CaptainNote, Field, MechChips, NumInput } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';
import { emptyRules, normalizeRules } from '../lib/rules.js';

export default function RulesetsPage() {
  const { data, actions, isCaptain } = useData();
  const [selected, setSelected] = useState(data.rulesets[0]?.id || null);
  const current = data.rulesets.find((r) => r.id === selected);

  const create = async (copyFrom) => {
    const r = await actions.insert('rulesets', {
      name: copyFrom ? `${copyFrom.name} (copy)` : 'New ruleset',
      rules: copyFrom ? normalizeRules(copyFrom.rules) : emptyRules(),
    });
    setSelected(r.id);
  };

  return (
    <div>
      <h1>Rulesets</h1>
      <CaptainNote />
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
        <div className="card">
          {data.rulesets.map((r) => (
            <div key={r.id} style={{ marginBottom: 6 }}>
              <button className={selected === r.id ? 'gold' : ''} style={{ width: '100%', textAlign: 'left' }} onClick={() => setSelected(r.id)}>{r.name}</button>
            </div>
          ))}
          {isCaptain && <button className="primary" style={{ marginTop: 8 }} onClick={() => create(null)}>+ New ruleset</button>}
        </div>
        {current ? <RulesetEditor key={current.id} ruleset={current} onCopy={() => create(current)} onDeleted={() => setSelected(null)} /> : <p className="muted">Pick or create a ruleset.</p>}
      </div>
    </div>
  );
}

function RulesetEditor({ ruleset, onCopy, onDeleted }) {
  const { actions, isCaptain, data } = useData();
  const [name, setName] = useState(ruleset.name);
  const [rules, setRules] = useState(normalizeRules(ruleset.rules));
  const dis = !isCaptain;
  const set = (patch) => setRules({ ...rules, ...patch });
  const setClass = (c, k, v) => set({ classes: { ...rules.classes, [c]: { ...rules.classes[c], [k]: v } } });
  const usedBy = data.events.filter((e) => e.ruleset_id === ruleset.id);
  const dirty = name !== ruleset.name || JSON.stringify(rules) !== JSON.stringify(normalizeRules(ruleset.rules));

  const del = async () => {
    if (!window.confirm(`Delete ruleset "${ruleset.name}"?${usedBy.length ? ` ${usedBy.length} event(s) use it and will have no ruleset.` : ''}`)) return;
    for (const e of usedBy) await actions.update('events', e.id, { ruleset_id: null });
    await actions.remove('rulesets', ruleset.id);
    onDeleted();
  };

  return (
    <div className="card stack">
      <div className="row">
        <Field label="Ruleset name"><input value={name} disabled={dis} onChange={(e) => setName(e.target.value)} style={{ width: 320 }} /></Field>
        <span className="muted small">Used by {usedBy.length} event{usedBy.length === 1 ? '' : 's'}. Breaking a rule shows a warning; it never blocks.</span>
      </div>
      <div className="grid2">
        <div className="stack">
          <h2>Tonnage</h2>
          <div className="row">
            <Field label="Minimum total tons"><NumInput value={rules.minTons} disabled={dis} onChange={(v) => set({ minTons: v })} /></Field>
            <Field label="Maximum total tons"><NumInput value={rules.maxTons} disabled={dis} onChange={(v) => set({ maxTons: v })} /></Field>
          </div>
          <h2>Weight classes (mechs per drop)</h2>
          <table style={{ width: 'auto' }}>
            <thead><tr><th>Class</th><th>Min</th><th>Max</th></tr></thead>
            <tbody>
              {WEIGHT_CLASSES.map((c) => (
                <tr key={c}>
                  <td>{c}</td>
                  <td><NumInput value={rules.classes[c].min} disabled={dis} onChange={(v) => setClass(c, 'min', v)} /></td>
                  <td><NumInput value={rules.classes[c].max} disabled={dis} onChange={(v) => setClass(c, 'max', v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Duplicates and heroes</h2>
          <div className="row">
            <Field label="Max copies of one chassis"><NumInput value={rules.maxPerChassis} disabled={dis} onChange={(v) => set({ maxPerChassis: v })} /></Field>
            <Field label="Max copies of one variant"><NumInput value={rules.maxPerVariant} disabled={dis} onChange={(v) => set({ maxPerVariant: v })} /></Field>
            <Field label="Max hero mechs"><NumInput value={rules.maxHero} disabled={dis} onChange={(v) => set({ maxHero: v })} /></Field>
          </div>
        </div>
        <div className="stack">
          <h2>Tech base</h2>
          <select value={rules.tech} disabled={dis} onChange={(e) => set({ tech: e.target.value })} style={{ width: 220 }}>
            <option value="any">Any (mixed IS and Clan)</option>
            <option value="IS">Inner Sphere only</option>
            <option value="CL">Clan only</option>
          </select>
          <label className="row"><input type="checkbox" checked={rules.banLegendary} disabled={dis} onChange={(e) => set({ banLegendary: e.target.checked })} /> Ban Legendary mechs</label>
          <h2>Banned chassis</h2>
          <MechChips value={rules.bannedChassis} disabled={dis} allowVariants={false} onChange={(v) => set({ bannedChassis: v })} />
          <h2>Banned variants</h2>
          <p className="muted small">Use this for heroes of Legendary mechs and any one-off bans.</p>
          <MechChips value={rules.bannedVariants} disabled={dis} allowChassis={false} onChange={(v) => set({ bannedVariants: v })} />
        </div>
      </div>
      {isCaptain && (
        <div className="row">
          <button className="primary" disabled={!dirty} onClick={() => actions.update('rulesets', ruleset.id, { name: name.trim() || ruleset.name, rules })}>Save ruleset</button>
          <button onClick={onCopy}>Duplicate</button>
          <button className="danger right" onClick={del}>Delete</button>
        </div>
      )}
    </div>
  );
}
