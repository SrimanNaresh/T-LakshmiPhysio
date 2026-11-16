import { useEffect, useState } from 'react';
import { Save, User } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { MENU, ALL_SCREENS } from '../../lib/menu';
import { Badge, Button, Card, PageHeader, useToast } from '../../components/ui';

export default function MenuAccess() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [sel, setSel] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/users').then((r) => setUsers(r.data)); }, []);
  useEffect(() => {
    if (!sel) return;
    api.get(`/menu-access/${sel.UserId}`).then((r) => setChecked(new Set(r.data)));
  }, [sel]);

  const toggle = (k) => setChecked((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleGroup = (items, on) => setChecked((s) => { const n = new Set(s); items.forEach((i) => (on ? n.add(i.key) : n.delete(i.key))); return n; });

  const save = async () => {
    setBusy(true);
    try { await api.put(`/menu-access/${sel.UserId}`, { screens: [...checked] }); toast(`Access saved for ${sel.UserName}`); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Menu Access" subtitle="Select a user on the left, then tick the screens they may open" />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card title="User Name" className="self-start">
          <div className="-m-2 space-y-1">
            {users.map((u) => (
              <button key={u.UserId} onClick={() => setSel(u)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${sel?.UserId === u.UserId ? 'bg-brand-600 text-white' : 'hover:bg-ink-100 text-ink-700'}`}>
                <User size={15} />
                <span className="flex-1 truncate">{u.UserName}<span className="ml-1 opacity-70">{u.FullName ? `· ${u.FullName}` : ''}</span></span>
                {!u.IsActive && <Badge color="red">Inactive</Badge>}
              </button>
            ))}
          </div>
        </Card>
        <Card title={sel ? `Screen Name — ${sel.UserName}` : 'Screen Name'}
          actions={sel && sel.Role !== 'Admin' && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setChecked(new Set(ALL_SCREENS.map((s) => s.key)))}>Select all</Button>
              <Button size="sm" variant="secondary" onClick={() => setChecked(new Set())}>Clear</Button>
            </div>)}>
          {!sel ? <p className="py-10 text-center text-ink-400">Select a user</p>
            : sel.Role === 'Admin' ? <p className="py-10 text-center text-ink-500">Admin users always have access to every screen.</p>
              : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {MENU.map((g) => {
                      const all = g.items.every((i) => checked.has(i.key));
                      return (
                        <div key={g.group} className="rounded-lg border border-ink-200 p-3">
                          <label className="mb-2 flex items-center gap-2 border-b border-ink-100 pb-2 text-sm font-semibold text-ink-700">
                            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={all} onChange={() => toggleGroup(g.items, !all)} />
                            {g.group}
                          </label>
                          <div className="space-y-1.5">
                            {g.items.map((i) => (
                              <label key={i.key} className="flex items-center gap-2 text-sm text-ink-600">
                                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={checked.has(i.key)} onChange={() => toggle(i.key)} />
                                {i.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex justify-end"><Button icon={Save} loading={busy} onClick={save}>Save Access</Button></div>
                </>
              )}
        </Card>
      </div>
    </div>
  );
}
