import { useState } from 'react';
import { CLASS_GROUPS, WEIGHT_CLASSES } from '../data/catalog.js';
import { CaptainNote, ChassisSelect, Field, KindPill } from '../components/ui.jsx';
import { autoFill } from '../lib/autofill.js';
import { useData } from '../lib/data.jsx';
import { discordText, downloadFile, lineupCsvRows, toCsv } from '../lib/export.js';
import { lookupVariant, slotMech } from '../lib/mechs.js';
import { lineupStats, validateLineup } from '../lib/rules.js';
import { blankSlots } from './EventsPage.jsx';

export default function EventPage({ id }) {
  const { eventsById, data, isCaptain, actions } = useData();
  const event = eventsById[id];
  const drops = data.drops.filter((d) => d.event_id === id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const [tab, setTab] = useState('attendance');
  if (!event) return <p className="muted">Event not found. <a href="#/events">Back</a></p>;

  const addDrop = async () => {
    const d = await actions.insert('drops', {
      event_id: id,
      map_id: null,
      position: drops.length,
      slots: blankSlots(event.team_size),
      result: null,
      notes: '',
    });
    setTab(d.id);
  };

  const activeTab = tab === 'attendance' || tab === 'share' || tab === 'settings' || drops.some((d) => d.id === tab) ? tab : 'attendance';

  return (
    <div>
      <a href="#/events">← Events</a>
      <div className="row" style={{ marginTop: 10 }}>
        <h1 style={{ margin: 0 }}>{event.name}</h1>
        <span className="muted">{event.date} · {event.team_size}v{event.team_size}</span>
      </div>
      {event.notes && <p className="muted">{event.notes}</p>}
      <CaptainNote />
      <div className="tabs" style={{ marginTop: 12 }}>
        <button className={activeTab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Attendance</button>
        {drops.map((d, i) => (
          <button key={d.id} className={activeTab === d.id ? 'active' : ''} onClick={() => setTab(d.id)}>
            Drop {i + 1}: {data.maps.find((m) => m.id === d.map_id)?.name || 'map TBD'}
            {d.result === 'win' && ' ✓'}{d.result === 'loss' && ' ✗'}
          </button>
        ))}
        {isCaptain && <button onClick={addDrop}>+ Add drop</button>}
        <button className={activeTab === 'share' ? 'active' : ''} onClick={() => setTab('share')}>Share / Export</button>
        {isCaptain && <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Event settings</button>}
      </div>
      {activeTab === 'attendance' && <AttendanceTab event={event} />}
      {activeTab === 'share' && <ShareTab event={event} drops={drops} />}
      {activeTab === 'settings' && <EventSettings event={event} drops={drops} />}
      {drops.map((d, i) => activeTab === d.id && <DropEditor key={d.id} event={event} drop={d} index={i} drops={drops} onDeleted={() => setTab('attendance')} />)}
    </div>
  );
}

function AttendanceTab({ event }) {
  const { pilots, data, actions, catalog, hangars } = useData();
  const active = pilots.filter((p) => p.active !== false);
  const rowFor = (p) => data.attendance.find((a) => a.event_id === event.id && a.pilot_id === p.id);
  const setStatus = async (p, status) => {
    const row = rowFor(p);
    if (row) await actions.update('attendance', row.id, { status });
    else await actions.insert('attendance', { event_id: event.id, pilot_id: p.id, status, request: '' });
  };
  const setRequest = async (p, request) => {
    const row = rowFor(p);
    if (row) await actions.update('attendance', row.id, { request });
    else await actions.insert('attendance', { event_id: event.id, pilot_id: p.id, status: 'yes', request });
  };
  const counts = { yes: 0, maybe: 0, no: 0 };
  active.forEach((p) => { const s = rowFor(p)?.status; if (s) counts[s] += 1; });
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="pill yes">{counts.yes} yes</span>
        <span className="pill maybe">{counts.maybe} maybe</span>
        <span className="pill no">{counts.no} no</span>
        <span className="muted small">{active.length - counts.yes - counts.maybe - counts.no} haven't answered. Only "Yes" pilots appear in the drop pools.</span>
      </div>
      <table>
        <thead><tr><th>Pilot</th><th>Attending?</th><th>Wants to pilot (optional)</th><th>Hangar</th></tr></thead>
        <tbody>
          {active.map((p) => {
            const r = rowFor(p);
            const owned = (hangars[p.id] || []).map((h) => lookupVariant(catalog, h.variant)).filter(Boolean);
            return (
              <tr key={p.id}>
                <td><a href={`#/pilots/${p.id}`}>{p.name}</a></td>
                <td className="row">
                  {['yes', 'maybe', 'no'].map((s) => (
                    <button key={s} className={`small ${r?.status === s ? 'gold' : ''}`} onClick={() => setStatus(p, s)}>{s[0].toUpperCase() + s.slice(1)}</button>
                  ))}
                </td>
                <td><RequestInput value={r?.request || ''} onSave={(v) => setRequest(p, v)} /></td>
                <td className="small muted">
                  {WEIGHT_CLASSES.map((c) => `${new Set(owned.filter((m) => m.wclass === c).map((m) => m.chassis)).size}${c[0]}`).join(' · ')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RequestInput({ value, onSave }) {
  const [v, setV] = useState(value);
  return (
    <input
      value={v}
      placeholder="e.g. Timber Wolf, or bigs"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
      onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
      style={{ width: 260 }}
    />
  );
}

function DropEditor({ event, drop, index, drops, onDeleted }) {
  const ctx = useData();
  const { data, actions, isCaptain, catalog, hangars, pilotsById, rulesetsById, notify } = ctx;
  const [showAll, setShowAll] = useState(false);
  const slots = drop.slots?.length ? drop.slots : blankSlots(event.team_size);
  const ruleset = rulesetsById[event.ruleset_id];
  const rules = ruleset?.rules;

  const save = (next) => actions.update('drops', drop.id, { slots: next });
  const setSlot = (i, patch) => save(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const attendance = data.attendance.filter((a) => a.event_id === event.id);
  const statusOf = (pid) => attendance.find((a) => a.pilot_id === pid)?.status;
  const requestOf = (pid) => attendance.find((a) => a.pilot_id === pid)?.request;
  const assigned = new Set(slots.map((s) => s.pilotId).filter(Boolean));
  const attending = ctx.pilots.filter((p) => p.active !== false && statusOf(p.id) === 'yes');
  const pool = attending.filter((p) => !assigned.has(p.id));
  const hiddenMaybe = ctx.pilots.filter((p) => statusOf(p.id) === 'maybe').length;

  const warnings = validateLineup(catalog, slots, rules);
  const st = lineupStats(catalog, slots);

  const assignToNext = (pilot) => {
    const i = slots.findIndex((s) => !s.pilotId);
    if (i < 0) return notify('All slots are full.', 'error');
    setSlot(i, { pilotId: pilot.id, chassis: null, variant: null, buildId: null });
  };

  const runAutoFill = async () => {
    const requests = Object.fromEntries(attendance.map((a) => [a.pilot_id, a.request]));
    const next = autoFill({ catalog, slots, pool, hangars, builds: data.builds, rules, requests });
    const added = next.filter((s, i) => s.pilotId && !slots[i].pilotId).length;
    await save(next);
    notify(added ? `Auto-fill placed ${added} pilot${added === 1 ? '' : 's'}. Check and adjust as needed.` : 'Auto-fill found nobody to place (no attending pilots with legal mechs).');
  };

  const copyDiscord = async () => {
    await navigator.clipboard.writeText(discordText({ event, drops: [drop], ctx }));
    notify('Copied. Paste it into Discord.');
  };

  const del = async () => {
    if (!window.confirm('Delete this drop and its lineup?')) return;
    await actions.remove('drops', drop.id);
    onDeleted();
  };

  const slotFlags = (s) => {
    const flags = [];
    if (!s.pilotId) return flags;
    const p = pilotsById[s.pilotId];
    if (!p) return ['Pilot no longer exists'];
    if (statusOf(s.pilotId) !== 'yes') flags.push(`${p.name} is not marked as attending`);
    const m = slotMech(catalog, s);
    if (m) {
      const owned = (hangars[s.pilotId] || []).map((h) => lookupVariant(catalog, h.variant)).filter(Boolean);
      if (!owned.some((o) => o.chassis === m.chassis)) flags.push(`doesn't own a ${m.chassis}`);
      else if (m.code && !owned.some((o) => o.code === m.code)) flags.push(`doesn't own ${m.code}`);
      const wont = p.prefs?.wont || [];
      if (wont.includes(m.chassis) || (m.code && wont.includes(m.code))) flags.push("marked this mech as won't play");
      if ((p.prefs?.wontClasses || []).includes(m.wclass)) flags.push(`won't play ${m.wclass} mechs`);
    }
    const dup = slots.filter((x) => x.pilotId === s.pilotId).length > 1;
    if (dup) flags.push('assigned twice in this drop');
    return flags;
  };

  return (
    <div>
      <div className="card">
        <div className="row">
          <Field label="Map">
            <select value={drop.map_id || ''} disabled={!isCaptain} onChange={(e) => actions.update('drops', drop.id, { map_id: e.target.value || null })}>
              <option value="">Map TBD</option>
              {data.maps.filter((m) => m.active !== false || m.id === drop.map_id).sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Result">
            <select value={drop.result || ''} disabled={!isCaptain} onChange={(e) => actions.update('drops', drop.id, { result: e.target.value || null })}>
              <option value="">Not played</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="draw">Draw</option>
            </select>
          </Field>
          <Field label="Drop notes (shown in Discord text)" style={{ flex: 1 }}>
            <NotesInput value={drop.notes || ''} disabled={!isCaptain} onSave={(notes) => actions.update('drops', drop.id, { notes })} />
          </Field>
          <span className="muted small">Ruleset: <a href="#/rulesets">{ruleset?.name || 'none'}</a></span>
        </div>
      </div>

      <div className="lineup">
        <div className="card">
          <div className="row spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Drop {index + 1} lineup</h2>
            {isCaptain && (
              <div className="row">
                <label className="row small muted" title="Let any chassis/variant be picked, not only the ones the pilot owns">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all mechs
                </label>
                <button className="gold" onClick={runAutoFill} disabled={!pool.length}>Auto-fill empty slots</button>
                <button onClick={() => window.confirm('Clear every slot in this drop?') && save(blankSlots(event.team_size))}>Clear</button>
                <button onClick={copyDiscord}>Copy for Discord</button>
                <button className="danger" onClick={del}>Delete drop</button>
              </div>
            )}
            {!isCaptain && <button onClick={copyDiscord}>Copy for Discord</button>}
          </div>
          <div className="slot muted small" style={{ borderBottom: '1px solid var(--line)' }}>
            <span className="n">#</span><span>Lance</span><span>Pilot</span><span>Chassis</span><span>Variant</span><span>Build</span><span />
          </div>
          {slots.map((s, i) => (
            <SlotRow
              key={i}
              i={i}
              slot={s}
              flags={slotFlags(s)}
              pool={pool}
              showAll={showAll}
              editable={isCaptain}
              onChange={(patch) => setSlot(i, patch)}
              requestOf={requestOf}
            />
          ))}
        </div>

        <div>
          <div className="card">
            <h3>Totals</h3>
            <div className="stats">
              <div className="stat"><div className="v">{st.tons}t</div><div className="k">Tonnage{rules?.maxTons ? ` / ${rules.maxTons}` : ''}{rules?.minTons ? ` (min ${rules.minTons})` : ''}</div></div>
              <div className="stat"><div className="v">{st.filled}/{slots.length}</div><div className="k">Filled</div></div>
              <div className="stat"><div className="v">{st.heroes}</div><div className="k">Heroes</div></div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              {WEIGHT_CLASSES.map((c) => <span key={c} className={`pill ${c}`}>{st.byClass[c]} {c}</span>)}
              {Object.entries(CLASS_GROUPS).map(([g, cs]) => <span key={g} className="pill">{cs.reduce((n, c) => n + st.byClass[c], 0)} {g.toLowerCase()}</span>)}
            </div>
            <div style={{ marginTop: 12 }}>
              {warnings.length ? (
                <div className="warnings">
                  <b>{warnings.length} rule warning{warnings.length === 1 ? '' : 's'}</b>
                  <ul>{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
              ) : (
                <div className="ok-box">{st.filled ? 'Lineup is legal for this ruleset.' : 'No mechs assigned yet.'}</div>
              )}
            </div>
          </div>
          <div className="card pool">
            <h3>Available pilots ({pool.length})</h3>
            {pool.length === 0 && <p className="muted small">Everyone attending is assigned. Mark attendance on the Attendance tab.</p>}
            {pool.map((p) => {
              const owned = (hangars[p.id] || []).map((h) => lookupVariant(catalog, h.variant)).filter(Boolean);
              const counts = WEIGHT_CLASSES.map((c) => `${new Set(owned.filter((m) => m.wclass === c).map((m) => m.chassis)).size}${c[0]}`).join(' ');
              return (
                <div key={p.id} className="pilot" onClick={() => isCaptain && assignToNext(p)} title={isCaptain ? 'Click to put in the next open slot' : ''}>
                  <div className="row spread"><b>{p.name}</b><span className="muted small">{counts}</span></div>
                  {(p.prefs?.favorites?.length > 0 || requestOf(p.id)) && (
                    <div className="small muted">
                      {requestOf(p.id) ? `Wants: ${requestOf(p.id)}` : `Likes: ${p.prefs.favorites.slice(0, 3).join(', ')}`}
                    </div>
                  )}
                </div>
              );
            })}
            {hiddenMaybe > 0 && <p className="muted small">{hiddenMaybe} "maybe" pilot{hiddenMaybe === 1 ? ' is' : 's are'} hidden.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesInput({ value, onSave, disabled }) {
  const [v, setV] = useState(value);
  return <input value={v} disabled={disabled} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} style={{ width: '100%' }} />;
}

function SlotRow({ i, slot, flags, pool, showAll, editable, onChange, requestOf }) {
  const { catalog, hangars, pilotsById, data } = useData();
  const pilot = pilotsById[slot.pilotId];
  const owned = slot.pilotId ? (hangars[slot.pilotId] || []).map((h) => ({ ...lookupVariant(catalog, h.variant), mastered: h.mastered })).filter((m) => m.code) : [];
  const ownedChassis = new Set(owned.map((m) => m.chassis));
  const chassisFilter = showAll || !slot.pilotId ? null : ownedChassis;

  const variantOptions = slot.chassis
    ? showAll || !slot.pilotId
      ? catalog.chassisByName.get(slot.chassis)?.variants || []
      : owned.filter((m) => m.chassis === slot.chassis)
    : [];
  const builds = data.builds.filter(
    (b) => slot.chassis && b.chassis === slot.chassis && (!slot.variant || !b.variant || b.variant === slot.variant || b.official) && (b.official || !b.pilot_id || b.pilot_id === slot.pilotId),
  );
  const mech = slotMech(catalog, slot);

  const pilotOptions = [...(pilot ? [pilot] : []), ...pool];

  return (
    <div className={`slot ${flags.length ? 'flag' : ''}`}>
      <span className="n">{i + 1}</span>
      <input value={slot.lance || ''} placeholder="–" disabled={!editable} onChange={(e) => onChange({ lance: e.target.value })} title="Optional lance name, e.g. Alpha" />
      <select value={slot.pilotId || ''} disabled={!editable} onChange={(e) => onChange({ pilotId: e.target.value || null, chassis: null, variant: null, buildId: null })}>
        <option value="">— open —</option>
        {pilotOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div title={slot.pilotId && requestOf(slot.pilotId) ? `Wants: ${requestOf(slot.pilotId)}` : ''}>
        <ChassisSelect
          value={slot.chassis}
          only={chassisFilter}
          disabled={!editable}
          placeholder={slot.pilotId && !ownedChassis.size && !showAll ? 'No mechs in hangar' : 'Chassis…'}
          onChange={(chassis) => {
            const mine = owned.filter((m) => m.chassis === chassis);
            const pick = mine.length === 1 ? mine[0].code : mine.find((m) => m.mastered)?.code || null;
            const b = data.builds.find((x) => x.official && x.chassis === chassis && (!pick || x.variant === pick));
            onChange({ chassis, variant: pick, buildId: b?.id || null });
          }}
        />
      </div>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
        <select value={slot.variant || ''} disabled={!editable || !slot.chassis} onChange={(e) => onChange({ variant: e.target.value || null })}>
          <option value="">Any variant</option>
          {variantOptions.map((v) => <option key={v.code} value={v.code}>{v.code}{v.mastered ? ' ★' : ''}{v.kind === 'hero' ? ' (hero)' : ''}{v.kind === 'legendary' ? ' (legendary)' : ''}</option>)}
        </select>
        {mech && <KindPill kind={mech.kind} />}
      </div>
      <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
        <select value={slot.buildId || ''} disabled={!editable || !slot.chassis} onChange={(e) => onChange({ buildId: e.target.value || null })}>
          <option value="">{slot.chassis ? (builds.length ? 'No build' : 'No builds saved') : '–'}</option>
          {builds.map((b) => <option key={b.id} value={b.id}>{b.official ? '★ ' : ''}{b.name}{b.variant ? ` (${b.variant})` : ''}</option>)}
        </select>
        {slot.buildId && data.builds.find((b) => b.id === slot.buildId)?.link && (
          <a href={data.builds.find((b) => b.id === slot.buildId).link} target="_blank" rel="noreferrer" title="Open build">↗</a>
        )}
      </div>
      {editable ? <button className="link" title="Clear slot" onClick={() => onChange({ pilotId: null, chassis: null, variant: null, buildId: null })}>×</button> : <span />}
      {flags.length > 0 && <div className="flags">⚠ {flags.join('; ')}</div>}
    </div>
  );
}

function ShareTab({ event, drops }) {
  const ctx = useData();
  const text = discordText({ event, drops, ctx });
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    ctx.notify('Copied. Paste it into Discord.');
  };
  const csv = () => downloadFile(`${event.name.replace(/[^\w-]+/g, '_')}.csv`, toCsv(lineupCsvRows({ event, drops, ctx })));
  return (
    <div className="grid2">
      <div className="card stack">
        <h2>Discord post (all drops)</h2>
        <pre className="discord">{text}</pre>
        <button className="primary" onClick={copy}>Copy for Discord</button>
        {text.length > 2000 && <p className="warnings small">This is {text.length} characters; Discord's limit is 2000 per message. Copy drops one at a time from each drop tab instead.</p>}
      </div>
      <div className="card stack">
        <h2>Everyone can see this page</h2>
        <p className="muted">Lineups update live for everyone who has the app open. Send pilots this link:</p>
        <code className="small">{window.location.href}</code>
        <h2 style={{ marginTop: 18 }}>Spreadsheet</h2>
        <p className="muted">Download a CSV of every slot in this event. In Google Sheets use File → Import → Upload to add it to your existing sheet.</p>
        <button onClick={csv}>Download CSV</button>
      </div>
    </div>
  );
}

function EventSettings({ event, drops }) {
  const { data, actions } = useData();
  const [form, setForm] = useState({ name: event.name, date: event.date || '', team_size: event.team_size, ruleset_id: event.ruleset_id || '', notes: event.notes || '' });
  const save = async () => {
    await actions.update('events', event.id, { ...form, ruleset_id: form.ruleset_id || null });
    if (form.team_size !== event.team_size) {
      for (const d of drops) {
        const cur = d.slots || [];
        const next = cur.length > form.team_size ? cur.slice(0, form.team_size) : [...cur, ...blankSlots(form.team_size - cur.length)];
        await actions.update('drops', d.id, { slots: next });
      }
    }
  };
  const del = async () => {
    if (!window.confirm(`Delete "${event.name}" with its ${drops.length} drops and attendance? This can't be undone.`)) return;
    await actions.removeWhere('drops', 'event_id', event.id);
    await actions.removeWhere('attendance', 'event_id', event.id);
    await actions.remove('events', event.id);
    window.location.hash = '#/events';
  };
  return (
    <div className="card stack" style={{ maxWidth: 600 }}>
      <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Date"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
      <Field label="Team size (shrinking it drops the last slots of every drop)">
        <select value={form.team_size} onChange={(e) => setForm({ ...form, team_size: Number(e.target.value) })}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}v{n}</option>)}
        </select>
      </Field>
      <Field label="Ruleset">
        <select value={form.ruleset_id} onChange={(e) => setForm({ ...form, ruleset_id: e.target.value })}>
          <option value="">None</option>
          {data.rulesets.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <Field label="Notes"><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      <div className="row">
        <button className="primary" onClick={save}>Save</button>
        <button className="danger right" onClick={del}>Delete event</button>
      </div>
    </div>
  );
}
