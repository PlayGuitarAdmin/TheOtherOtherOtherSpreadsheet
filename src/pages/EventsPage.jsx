import { useState } from 'react';
import { CaptainNote, Field } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';

export const SIZE_PRESETS = [1, 2, 4, 8, 12];

export function blankSlots(n) {
  return Array.from({ length: n }, () => ({ pilotId: null, chassis: null, variant: null, buildId: null, lance: '' }));
}

export default function EventsPage() {
  const { data, actions, isCaptain, rulesetsById } = useData();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ name: '', date: today, team_size: 12, ruleset_id: data.rulesets[0]?.id || '', notes: '' });
  const [showPast, setShowPast] = useState(false);

  const create = async () => {
    if (!form.name.trim()) return;
    const ev = await actions.insert('events', { ...form, name: form.name.trim(), ruleset_id: form.ruleset_id || null });
    window.location.hash = `#/events/${ev.id}`;
  };

  const events = [...data.events].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const upcoming = events.filter((e) => !e.date || e.date >= today);
  const past = events.filter((e) => e.date && e.date < today).reverse();

  const row = (e) => {
    const att = data.attendance.filter((a) => a.event_id === e.id);
    const drops = data.drops.filter((d) => d.event_id === e.id);
    const results = drops.map((d) => d.result).filter(Boolean);
    return (
      <tr key={e.id}>
        <td>{e.date || '–'}</td>
        <td><a href={`#/events/${e.id}`}><b>{e.name}</b></a></td>
        <td>{e.team_size}v{e.team_size}</td>
        <td>{rulesetsById[e.ruleset_id]?.name || <span className="muted">none</span>}</td>
        <td>
          <span className="pill yes">{att.filter((a) => a.status === 'yes').length} yes</span>{' '}
          <span className="pill maybe">{att.filter((a) => a.status === 'maybe').length} maybe</span>
        </td>
        <td>{drops.length}</td>
        <td>
          {results.filter((r) => r === 'win').length > 0 && <span className="pill win">{results.filter((r) => r === 'win').length} W</span>}{' '}
          {results.filter((r) => r === 'loss').length > 0 && <span className="pill loss">{results.filter((r) => r === 'loss').length} L</span>}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <h1>Events & Drops</h1>
      <CaptainNote />
      {isCaptain && (
        <div className="card">
          <h2>New event</h2>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="Name"><input value={form.name} placeholder="Week 3 vs Clan X" onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: 240 }} /></Field>
            <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Team size">
              <select value={form.team_size} onChange={(e) => setForm({ ...form, team_size: Number(e.target.value) })}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}v{n}{SIZE_PRESETS.includes(n) ? '' : ' (custom)'}</option>)}
              </select>
            </Field>
            <Field label="Ruleset">
              <select value={form.ruleset_id} onChange={(e) => setForm({ ...form, ruleset_id: e.target.value })}>
                <option value="">None</option>
                {data.rulesets.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ width: 240 }} /></Field>
            <button className="primary" onClick={create}>Create event</button>
          </div>
        </div>
      )}
      <div className="card">
        <h2>Upcoming</h2>
        <table>
          <thead><tr><th>Date</th><th>Event</th><th>Size</th><th>Ruleset</th><th>Attendance</th><th>Drops</th><th>Results</th></tr></thead>
          <tbody>
            {upcoming.map(row)}
            {upcoming.length === 0 && <tr><td colSpan={7} className="muted">No upcoming events.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="row spread">
          <h2>Past events ({past.length})</h2>
          <button className="small" onClick={() => setShowPast(!showPast)}>{showPast ? 'Hide' : 'Show'}</button>
        </div>
        {showPast && (
          <table>
            <tbody>{past.map(row)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
