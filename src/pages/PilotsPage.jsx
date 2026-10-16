import { useState } from 'react';
import { WEIGHT_CLASSES } from '../data/catalog.js';
import { useData } from '../lib/data.jsx';
import { lookupVariant } from '../lib/mechs.js';

export default function PilotsPage() {
  const { pilots, hangars, catalog, actions, isCaptain, data } = useData();
  const [name, setName] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    if (pilots.some((p) => p.name.toLowerCase() === n.toLowerCase())) return;
    const row = await actions.insert('pilots', { name: n, active: true, prefs: {} });
    setName('');
    window.location.hash = `#/pilots/${row.id}`;
  };

  const shown = pilots.filter((p) => showInactive || p.active !== false);
  const upcoming = data.events.filter((e) => !e.date || e.date >= new Date().toISOString().slice(0, 10));

  return (
    <div>
      <div className="row spread">
        <h1>Pilots & Hangars</h1>
        <label className="row small muted">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
        </label>
      </div>
      <div className="card">
        <div className="row">
          <input placeholder="Pilot name (in-game name)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} style={{ width: 280 }} />
          <button className="primary" onClick={add}>Add pilot</button>
          <span className="muted small">New pilots can add themselves, then paste their mech list from mwomercs.com.</span>
        </div>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Pilot</th>
              <th>Chassis</th>
              <th>Variants</th>
              {WEIGHT_CLASSES.map((c) => <th key={c}>{c}</th>)}
              <th>Prefers</th>
              <th>Upcoming events</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const owned = (hangars[p.id] || []).map((h) => lookupVariant(catalog, h.variant)).filter(Boolean);
              const chassis = new Set(owned.map((m) => m.chassis));
              const byClass = Object.fromEntries(WEIGHT_CLASSES.map((c) => [c, new Set(owned.filter((m) => m.wclass === c).map((m) => m.chassis)).size]));
              const att = upcoming.map((e) => data.attendance.find((a) => a.event_id === e.id && a.pilot_id === p.id)?.status);
              const yes = att.filter((s) => s === 'yes').length;
              return (
                <tr key={p.id}>
                  <td><a href={`#/pilots/${p.id}`}><b>{p.name}</b></a>{p.active === false && <span className="muted small"> (inactive)</span>}</td>
                  <td>{chassis.size}</td>
                  <td>{owned.length}</td>
                  {WEIGHT_CLASSES.map((c) => <td key={c}>{byClass[c] || <span className="muted">0</span>}</td>)}
                  <td className="small">{(p.prefs?.classes || []).join(', ') || <span className="muted">–</span>}</td>
                  <td className="small">{upcoming.length ? `${yes}/${upcoming.length} attending` : <span className="muted">–</span>}</td>
                  <td>
                    {isCaptain && (
                      <button className="small" onClick={() => actions.update('pilots', p.id, { active: p.active === false })}>
                        {p.active === false ? 'Reactivate' : 'Deactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr><td colSpan={10} className="muted">No pilots yet. Add the first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
