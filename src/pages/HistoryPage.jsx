import { useState } from 'react';
import { ClassPill } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';
import { slotMech } from '../lib/mechs.js';

export default function HistoryPage() {
  const { data, catalog, pilotsById, mapsById, eventsById } = useData();
  const [tab, setTab] = useState('pilots');

  const played = data.drops.filter((d) => d.result);
  const rows = [];
  for (const d of played) {
    const ev = eventsById[d.event_id];
    for (const s of d.slots || []) {
      if (!s.pilotId) continue;
      rows.push({ drop: d, event: ev, pilotId: s.pilotId, mech: slotMech(catalog, s), map: mapsById[d.map_id]?.name || 'Unknown map' });
    }
  }

  const tally = (keyFn) => {
    const out = {};
    for (const r of rows) {
      const k = keyFn(r);
      if (!k) continue;
      const t = (out[k] ||= { key: k, drops: 0, win: 0, loss: 0, draw: 0, mechs: {} });
      t.drops += 1;
      t[r.drop.result] += 1;
      if (r.mech) t.mechs[r.mech.chassis] = (t.mechs[r.mech.chassis] || 0) + 1;
    }
    return Object.values(out).sort((a, b) => b.drops - a.drops);
  };
  const top = (mechs) => Object.entries(mechs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ×${n}`).join(', ');
  const pct = (t) => (t.drops ? `${Math.round((t.win / t.drops) * 100)}%` : '–');

  const wins = played.filter((d) => d.result === 'win').length;

  return (
    <div>
      <h1>History & Stats</h1>
      <div className="card stats">
        <div className="stat"><div className="v">{played.length}</div><div className="k">Drops played</div></div>
        <div className="stat"><div className="v">{wins}</div><div className="k">Wins</div></div>
        <div className="stat"><div className="v">{played.filter((d) => d.result === 'loss').length}</div><div className="k">Losses</div></div>
        <div className="stat"><div className="v">{played.length ? `${Math.round((wins / played.length) * 100)}%` : '–'}</div><div className="k">Win rate</div></div>
      </div>
      <p className="muted small">Counts only drops with a result. Set the result on each drop tab after the match.</p>
      <div className="tabs">
        {[['pilots', 'By pilot'], ['mechs', 'By chassis'], ['maps', 'By map'], ['log', 'Drop log']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="card">
        {tab === 'pilots' && (
          <table>
            <thead><tr><th>Pilot</th><th>Drops</th><th>W</th><th>L</th><th>Win %</th><th>Most piloted</th></tr></thead>
            <tbody>{tally((r) => r.pilotId).map((t) => (
              <tr key={t.key}><td>{pilotsById[t.key]?.name || '(deleted)'}</td><td>{t.drops}</td><td>{t.win}</td><td>{t.loss}</td><td>{pct(t)}</td><td className="small">{top(t.mechs)}</td></tr>
            ))}</tbody>
          </table>
        )}
        {tab === 'mechs' && (
          <table>
            <thead><tr><th>Chassis</th><th>Class</th><th>Drops</th><th>W</th><th>L</th><th>Win %</th></tr></thead>
            <tbody>{tally((r) => r.mech?.chassis).map((t) => (
              <tr key={t.key}><td>{t.key}</td><td><ClassPill wclass={catalog.chassisByName.get(t.key)?.wclass} /></td><td>{t.drops}</td><td>{t.win}</td><td>{t.loss}</td><td>{pct(t)}</td></tr>
            ))}</tbody>
          </table>
        )}
        {tab === 'maps' && (
          <table>
            <thead><tr><th>Map</th><th>Drops</th><th>W</th><th>L</th><th>Win %</th><th>Most used chassis</th></tr></thead>
            <tbody>{(() => {
              const m = {};
              for (const d of played) {
                const k = mapsById[d.map_id]?.name || 'Unknown map';
                const t = (m[k] ||= { key: k, drops: 0, win: 0, loss: 0, draw: 0, mechs: {} });
                t.drops += 1; t[d.result] += 1;
                for (const s of d.slots || []) { const mech = slotMech(catalog, s); if (mech) t.mechs[mech.chassis] = (t.mechs[mech.chassis] || 0) + 1; }
              }
              return Object.values(m).sort((a, b) => b.drops - a.drops).map((t) => (
                <tr key={t.key}><td>{t.key}</td><td>{t.drops}</td><td>{t.win}</td><td>{t.loss}</td><td>{pct(t)}</td><td className="small">{top(t.mechs)}</td></tr>
              ));
            })()}</tbody>
          </table>
        )}
        {tab === 'log' && (
          <table>
            <thead><tr><th>Date</th><th>Event</th><th>Map</th><th>Result</th><th>Lineup</th></tr></thead>
            <tbody>{[...played].sort((a, b) => (eventsById[b.event_id]?.date || '').localeCompare(eventsById[a.event_id]?.date || '')).map((d) => (
              <tr key={d.id}>
                <td>{eventsById[d.event_id]?.date}</td>
                <td><a href={`#/events/${d.event_id}`}>{eventsById[d.event_id]?.name}</a></td>
                <td>{mapsById[d.map_id]?.name || '–'}</td>
                <td><span className={`pill ${d.result}`}>{d.result}</span></td>
                <td className="small">{(d.slots || []).filter((s) => s.pilotId).map((s) => `${pilotsById[s.pilotId]?.name || '?'}: ${slotMech(catalog, s)?.code || slotMech(catalog, s)?.chassis || '?'}`).join(' · ')}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {played.length === 0 && <p className="muted">No results recorded yet.</p>}
      </div>
    </div>
  );
}
