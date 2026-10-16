import { createClient } from '@supabase/supabase-js';
import { DEFAULT_MAPS } from '../data/catalog.js';
import { emptyRules } from './rules.js';

export const TABLES = [
  'pilots', 'pilot_mechs', 'custom_mechs', 'builds', 'maps', 'rulesets', 'events', 'attendance', 'drops',
];

const CONFIG_KEY = 'dropdeck-supabase';
const LOCAL_KEY = 'dropdeck-local-data';
const LOCAL_CAPTAIN_KEY = 'dropdeck-local-captain';

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
}

// Supabase settings come from the build (.env / GitHub secrets) or from the
// in-app Settings page, which saves them in this browser.
// People often paste the REST endpoint (".../rest/v1/") instead of the project URL.
const cleanUrl = (url) => String(url).trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

export function getSupabaseConfig() {
  const saved = safeGet(CONFIG_KEY);
  if (saved) {
    try {
      const c = JSON.parse(saved);
      if (c.url && c.key) return { ...c, url: cleanUrl(c.url), source: 'browser' };
    } catch { /* ignore */ }
  }
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) return { url: cleanUrl(url), key: key.trim(), source: 'build' };
  return null;
}

export function saveSupabaseConfig(cfg) {
  safeSet(CONFIG_KEY, cfg ? JSON.stringify(cfg) : null);
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function seedLocal() {
  const now = new Date().toISOString();
  return {
    pilots: [], pilot_mechs: [], custom_mechs: [], builds: [], events: [], attendance: [], drops: [],
    maps: DEFAULT_MAPS.map((name) => ({ id: uid(), name, active: true, created_at: now })),
    rulesets: [{ id: uid(), name: 'Open (no limits)', rules: emptyRules(), created_at: now }],
  };
}

function localBackend() {
  const read = () => {
    const raw = safeGet(LOCAL_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* fall through */ }
    }
    const seeded = seedLocal();
    safeSet(LOCAL_KEY, JSON.stringify(seeded));
    return seeded;
  };
  const write = (data) => safeSet(LOCAL_KEY, JSON.stringify(data));
  const listeners = new Set();
  const authListeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_KEY) emit();
  });

  return {
    kind: 'local',
    async loadAll() {
      const d = read();
      return Object.fromEntries(TABLES.map((t) => [t, d[t] || []]));
    },
    async insert(table, row) {
      const d = read();
      const full = { id: uid(), created_at: new Date().toISOString(), ...row };
      d[table] = [...(d[table] || []), full];
      write(d);
      emit();
      return full;
    },
    async insertMany(table, rows) {
      const d = read();
      const now = new Date().toISOString();
      d[table] = [...(d[table] || []), ...rows.map((r) => ({ id: uid(), created_at: now, ...r }))];
      write(d);
      emit();
    },
    async update(table, id, patch) {
      const d = read();
      d[table] = (d[table] || []).map((r) => (r.id === id ? { ...r, ...patch } : r));
      write(d);
      emit();
    },
    async remove(table, id) {
      const d = read();
      d[table] = (d[table] || []).filter((r) => r.id !== id);
      write(d);
      emit();
    },
    async removeMany(table, ids) {
      const d = read();
      const set = new Set(ids);
      d[table] = (d[table] || []).filter((r) => !set.has(r.id));
      write(d);
      emit();
    },
    async removeWhere(table, field, value) {
      const d = read();
      d[table] = (d[table] || []).filter((r) => r[field] !== value);
      write(d);
      emit();
    },
    async replaceAll(data) {
      write(Object.fromEntries(TABLES.map((t) => [t, data[t] || []])));
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    auth: {
      async getUser() {
        return safeGet(LOCAL_CAPTAIN_KEY) ? { email: 'captain (this browser)' } : null;
      },
      async signInPassword() {
        safeSet(LOCAL_CAPTAIN_KEY, '1');
        authListeners.forEach((fn) => fn());
        return {};
      },
      async signInMagic() {
        return this.signInPassword();
      },
      async signOut() {
        safeSet(LOCAL_CAPTAIN_KEY, null);
        authListeners.forEach((fn) => fn());
      },
      onChange(fn) {
        authListeners.add(fn);
        return () => authListeners.delete(fn);
      },
    },
  };
}

function supabaseBackend(cfg) {
  const sb = createClient(cfg.url, cfg.key);
  const check = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };
  // Supabase returns at most 1,000 rows per request, and a full team's hangars are several
  // thousand rows, so read every table in pages.
  const PAGE = 1000;
  async function selectAll(table) {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const page = check(await sb.from(table).select('*').order('created_at').order('id').range(from, from + PAGE - 1)) || [];
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  }

  return {
    kind: 'supabase',
    client: sb,
    async loadAll() {
      const results = await Promise.all(TABLES.map((t) => selectAll(t)));
      return Object.fromEntries(TABLES.map((t, i) => [t, results[i]]));
    },
    async insert(table, row) {
      return check(await sb.from(table).insert(row).select().single());
    },
    async insertMany(table, rows) {
      if (!rows.length) return;
      // Hangar rows are unique per pilot + variant; skip any that already exist instead of failing.
      const q = table === 'pilot_mechs'
        ? sb.from(table).upsert(rows, { onConflict: 'pilot_id,variant', ignoreDuplicates: true })
        : sb.from(table).insert(rows);
      check(await q);
    },
    async update(table, id, patch) {
      check(await sb.from(table).update(patch).eq('id', id));
    },
    async remove(table, id) {
      check(await sb.from(table).delete().eq('id', id));
    },
    async removeMany(table, ids) {
      if (ids.length) check(await sb.from(table).delete().in('id', ids));
    },
    async removeWhere(table, field, value) {
      check(await sb.from(table).delete().eq(field, value));
    },
    async replaceAll() {
      throw new Error('Restoring a backup is only available in offline demo mode.');
    },
    subscribe(fn) {
      const channel = sb
        .channel('dropdeck-all')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => fn())
        .subscribe();
      return () => sb.removeChannel(channel);
    },
    auth: {
      async getUser() {
        const { data } = await sb.auth.getSession();
        return data.session?.user || null;
      },
      async signInPassword(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      async signInMagic(email) {
        const { error } = await sb.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: window.location.href.split('#')[0] },
        });
        if (error) throw new Error(error.message);
      },
      async signOut() {
        await sb.auth.signOut();
      },
      onChange(fn) {
        const { data } = sb.auth.onAuthStateChange(() => fn());
        return () => data.subscription.unsubscribe();
      },
    },
  };
}

export function createBackend() {
  const cfg = getSupabaseConfig();
  return cfg ? supabaseBackend(cfg) : localBackend();
}
