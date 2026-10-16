import { useState } from 'react';
import { CaptainNote } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';

export default function MapsPage() {
  const { data, actions, isCaptain } = useData();
  const [name, setName] = useState('');
  const maps = [...data.maps].sort((a, b) => a.name.localeCompare(b.name));
  const add = async () => {
    const n = name.trim();
    if (!n || maps.some((m) => m.name.toLowerCase() === n.toLowerCase())) return;
    await actions.insert('maps', { name: n, active: true });
    setName('');
  };
  const played = (id) => data.drops.filter((d) => d.map_id === id);
  return (
    <div>
      <h1>Maps</h1>
      <CaptainNote />
      {isCaptain && (
        <div className="card row">
          <input value={name} placeholder="Map name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="primary" onClick={add}>Add map</button>
          <span className="muted small">Untick "In pool" to hide a map from drop pickers without losing its history.</span>
        </div>
      )}
      <div className="card">
        <table>
          <thead><tr><th>Map</th><th>In pool</th><th>Drops</th><th>Wins</th><th>Losses</th><th /></tr></thead>
          <tbody>
            {maps.map((m) => {
              const d = played(m.id);
              return (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td><input type="checkbox" checked={m.active !== false} disabled={!isCaptain} onChange={(e) => actions.update('maps', m.id, { active: e.target.checked })} /></td>
                  <td>{d.length}</td>
                  <td>{d.filter((x) => x.result === 'win').length}</td>
                  <td>{d.filter((x) => x.result === 'loss').length}</td>
                  <td>{isCaptain && d.length === 0 && <button className="small danger" onClick={() => actions.remove('maps', m.id)}>Delete</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
