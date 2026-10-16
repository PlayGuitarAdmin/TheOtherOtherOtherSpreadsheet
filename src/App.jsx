import { useEffect, useState } from 'react';
import { useData } from './lib/data.jsx';
import EventsPage from './pages/EventsPage.jsx';
import EventPage from './pages/EventPage.jsx';
import PilotsPage from './pages/PilotsPage.jsx';
import PilotPage from './pages/PilotPage.jsx';
import BuildsPage from './pages/BuildsPage.jsx';
import MechsPage from './pages/MechsPage.jsx';
import RulesetsPage from './pages/RulesetsPage.jsx';
import MapsPage from './pages/MapsPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

// Hash routing (#/events/123) so the app works on GitHub Pages without server rewrites.
function useRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState(get);
  useEffect(() => {
    const on = () => setParts(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

const NAV = [
  ['events', 'Events & Drops'],
  ['pilots', 'Pilots & Hangars'],
  ['builds', 'Builds'],
  ['mechs', 'Mech Catalog'],
  ['rulesets', 'Rulesets'],
  ['maps', 'Maps'],
  ['history', 'History & Stats'],
  ['settings', 'Settings'],
];

export default function App() {
  const [section = 'events', id] = useRoute();
  const { loading, error, toast, backend, user } = useData();

  let page;
  if (loading) page = <p className="muted">Loading…</p>;
  else if (section === 'events') page = id ? <EventPage id={id} /> : <EventsPage />;
  else if (section === 'pilots') page = id ? <PilotPage id={id} /> : <PilotsPage />;
  else if (section === 'builds') page = <BuildsPage />;
  else if (section === 'mechs') page = <MechsPage />;
  else if (section === 'rulesets') page = <RulesetsPage />;
  else if (section === 'maps') page = <MapsPage />;
  else if (section === 'history') page = <HistoryPage />;
  else page = <SettingsPage />;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="suit"><span style={{ color: 'var(--text)' }}>♠</span> ♥ <span style={{ color: 'var(--text)' }}>♣</span> ♦</div>
          <div className="name">ACES WILD</div>
          <div className="sub">Drop Deck</div>
        </div>
        <nav className="nav">
          {NAV.map(([key, label]) => (
            <a key={key} href={`#/${key}`} className={section === key ? 'active' : ''}>{label}</a>
          ))}
        </nav>
        <div className="who">
          {backend.kind === 'local' ? 'Offline demo (this browser only)' : 'Shared team database'}
          <br />
          {user ? `Captain: ${user.email}` : 'Pilot mode'}
        </div>
      </aside>
      <main className="main">
        {error && <div className="warnings" style={{ marginBottom: 16 }}>Database error: {error}</div>}
        {page}
      </main>
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </div>
  );
}
