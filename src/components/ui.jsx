import { useState } from 'react';
import { WEIGHT_CLASSES } from '../data/catalog.js';
import { useData } from '../lib/data.jsx';

export function ClassPill({ wclass }) {
  if (!wclass) return null;
  return <span className={`pill ${wclass}`}>{wclass}</span>;
}

export function KindPill({ kind }) {
  if (!kind || kind === 'standard' || kind === 'omni') return null;
  const label = { hero: 'Hero', legendary: 'Legendary', champion: 'Champion', special: 'Special' }[kind] || kind;
  return <span className={`pill ${kind}`}>{label}</span>;
}

export function TechLabel({ tech }) {
  return <span className="muted small">{tech === 'CL' ? 'Clan' : 'IS'}</span>;
}

// <select> of chassis grouped by weight class. `only` limits the options (e.g. chassis a pilot owns).
export function ChassisSelect({ value, onChange, only, placeholder = 'Chassis…', disabled }) {
  const { catalog } = useData();
  const list = only ? catalog.chassis.filter((c) => only.has(c.name)) : catalog.chassis;
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {WEIGHT_CLASSES.map((wc) => {
        const items = list.filter((c) => c.wclass === wc);
        if (!items.length) return null;
        return (
          <optgroup key={wc} label={wc}>
            {items.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.tons}t {c.tech === 'CL' ? 'Clan' : 'IS'})
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}

// Editable list of chassis names and/or variant codes, used for favourites, won't-play and bans.
export function MechChips({ value = [], onChange, allowChassis = true, allowVariants = true, ordered = false, disabled }) {
  const { catalog } = useData();
  const [text, setText] = useState('');
  const options = [
    ...(allowChassis ? catalog.chassis.map((c) => c.name) : []),
    ...(allowVariants ? catalog.variants.map((v) => v.code) : []),
  ];
  const listId = `mechs-${allowChassis}-${allowVariants}`;
  const add = () => {
    const t = text.trim();
    if (!t) return;
    const match = options.find((o) => o.toLowerCase() === t.toLowerCase()) || t.toUpperCase();
    if (!value.includes(match)) onChange([...value, match]);
    setText('');
  };
  const move = (i, d) => {
    const next = [...value];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="stack">
      <div className="chips">
        {value.length === 0 && <span className="muted small">None</span>}
        {value.map((v, i) => (
          <span className="chip" key={v}>
            {ordered && <b>{i + 1}.</b>} {v}
            {!disabled && ordered && <button onClick={() => move(i, -1)} title="Move up">↑</button>}
            {!disabled && <button onClick={() => onChange(value.filter((x) => x !== v))} title="Remove">×</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="row">
          <input
            list={listId}
            value={text}
            placeholder={allowChassis ? 'Type a chassis or variant…' : 'Type a variant code…'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            style={{ width: 260 }}
          />
          <button onClick={add}>Add</button>
          <datalist id={listId}>
            {options.map((o) => <option key={o} value={o} />)}
          </datalist>
        </div>
      )}
    </div>
  );
}

export function CaptainNote() {
  const { isCaptain } = useData();
  if (isCaptain) return null;
  return (
    <div className="banner small">
      View only. Captains sign in on the <a href="#/settings">Settings</a> page to edit this.
    </div>
  );
}

export function Field({ label, children, style }) {
  return (
    <label className="field" style={style}>
      {label}
      {children}
    </label>
  );
}

export function NumInput({ value, onChange, disabled, placeholder = '–' }) {
  return (
    <input
      className="num"
      type="number"
      value={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}
