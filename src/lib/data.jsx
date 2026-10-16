import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { buildCatalog } from './mechs.js';
import { createBackend, TABLES } from './store.js';

const DataContext = createContext(null);

const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

export function DataProvider({ children }) {
  const backend = useMemo(() => createBackend(), []);
  const [data, setData] = useState(() => Object.fromEntries(TABLES.map((t) => [t, []])));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const reloadTimer = useRef(null);

  const reload = useCallback(async () => {
    try {
      setData(await backend.loadAll());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    reload();
    // Other people's changes arrive here; batch bursts into one reload.
    const unsub = backend.subscribe(() => {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(reload, 250);
    });
    const refreshUser = () => backend.auth.getUser().then(setUser);
    refreshUser();
    const unsubAuth = backend.auth.onChange(refreshUser);
    return () => {
      unsub();
      unsubAuth();
    };
  }, [backend, reload]);

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind, at: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.at >= 3500 ? null : t)), 3600);
  }, []);

  const run = useCallback(
    async (fn) => {
      try {
        const res = await fn();
        await reload();
        return res;
      } catch (e) {
        notify(e.message, 'error');
        throw e;
      }
    },
    [reload, notify],
  );

  const actions = useMemo(
    () => ({
      insert: (table, row) => run(() => backend.insert(table, row)),
      insertMany: (table, rows) => run(() => backend.insertMany(table, rows)),
      update: (table, id, patch) => run(() => backend.update(table, id, patch)),
      remove: (table, id) => run(() => backend.remove(table, id)),
      removeMany: (table, ids) => run(() => backend.removeMany(table, ids)),
      removeWhere: (table, field, value) => run(() => backend.removeWhere(table, field, value)),
      replaceAll: (all) => run(() => backend.replaceAll(all)),
    }),
    [backend, run],
  );

  const catalog = useMemo(() => buildCatalog(data.custom_mechs), [data.custom_mechs]);

  const value = useMemo(() => {
    const hangars = {};
    for (const pm of data.pilot_mechs) (hangars[pm.pilot_id] ||= []).push(pm);
    const pilots = [...data.pilots].sort((a, b) => a.name.localeCompare(b.name));
    return {
      backend,
      data,
      loading,
      error,
      user,
      isCaptain: !!user,
      catalog,
      actions,
      notify,
      toast,
      reload,
      pilots,
      hangars,
      pilotsById: byId(data.pilots),
      mapsById: byId(data.maps),
      buildsById: byId(data.builds),
      rulesetsById: byId(data.rulesets),
      eventsById: byId(data.events),
    };
  }, [backend, data, loading, error, user, catalog, actions, notify, toast, reload]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
