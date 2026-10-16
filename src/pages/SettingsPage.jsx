import { useState } from 'react';
import { Field } from '../components/ui.jsx';
import { useData } from '../lib/data.jsx';
import { downloadFile } from '../lib/export.js';
import { getSupabaseConfig, saveSupabaseConfig, TABLES } from '../lib/store.js';

export default function SettingsPage() {
  const { backend, user, data, actions, notify } = useData();
  const cfg = getSupabaseConfig();
  const [url, setUrl] = useState(cfg?.url || '');
  const [key, setKey] = useState(cfg?.key || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = () => {
    if (!url.trim() || !key.trim()) return;
    saveSupabaseConfig({ url: url.trim(), key: key.trim() });
    window.location.reload();
  };
  const disconnect = () => {
    saveSupabaseConfig(null);
    window.location.reload();
  };
  const signIn = async (magic) => {
    setBusy(true);
    try {
      if (magic) {
        await backend.auth.signInMagic(email.trim());
        notify('Check your email for the sign-in link.');
      } else {
        await backend.auth.signInPassword(email.trim(), password);
        notify('Signed in as captain.');
      }
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const backup = () => downloadFile(`drop-deck-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
  const restore = async (file) => {
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    if (!TABLES.every((t) => Array.isArray(parsed[t] || []))) return notify('That file is not a Drop Deck backup.', 'error');
    if (!window.confirm('Replace all data in this browser with the backup?')) return;
    await actions.replaceAll(parsed);
    notify('Backup restored.');
  };

  return (
    <div>
      <h1>Settings</h1>
      <div className="grid2">
        <div className="card stack">
          <h2>Captain sign-in</h2>
          {user ? (
            <>
              <p>Signed in as <b>{user.email}</b>. You can edit events, lineups, rulesets, maps and official builds.</p>
              <button onClick={() => backend.auth.signOut()}>Sign out</button>
            </>
          ) : backend.kind === 'local' ? (
            <>
              <p className="muted">In offline demo mode there are no accounts. Turn on captain mode to try the captain tools in this browser.</p>
              <button className="primary" onClick={() => backend.auth.signInPassword()}>Turn on captain mode</button>
            </>
          ) : (
            <>
              <p className="muted small">
                Pilots don't need an account. Captains sign in to build drops and manage rulesets, maps and team builds.
                Captain accounts are created in the Supabase dashboard (see SETUP.md).
              </p>
              <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && signIn(false)} /></Field>
              <div className="row">
                <button className="primary" disabled={busy || !email || !password} onClick={() => signIn(false)}>Sign in</button>
                <button disabled={busy || !email} onClick={() => signIn(true)}>Email me a magic link instead</button>
              </div>
            </>
          )}
        </div>

        <div className="card stack">
          <h2>Team database</h2>
          {backend.kind === 'local' ? (
            <div className="banner small">
              <b>Offline demo mode.</b> Everything is saved in this browser only, so nobody else sees it. Connect a free Supabase
              database to share the app with the team.
            </div>
          ) : (
            <div className="ok-box small">Connected to the shared Supabase database{cfg?.source === 'build' ? ' (set when the site was built)' : ' (saved in this browser)'}.</div>
          )}
          <Field label="Supabase Project URL"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" /></Field>
          <Field label="Supabase anon (public) key"><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi…" /></Field>
          <div className="row">
            <button className="primary" onClick={connect}>Connect</button>
            {cfg?.source === 'browser' && <button onClick={disconnect}>Disconnect (back to demo mode)</button>}
          </div>
          <p className="muted small">The anon key is designed to be public; the database rules (row level security) decide who can change what.</p>
        </div>

        <div className="card stack">
          <h2>Backup</h2>
          <p className="muted small">Download everything (pilots, hangars, builds, events, lineups) as one JSON file.</p>
          <div className="row">
            <button onClick={backup}>Download backup</button>
            {backend.kind === 'local' && (
              <label className="btn">Restore backup… <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => restore(e.target.files[0])} /></label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
