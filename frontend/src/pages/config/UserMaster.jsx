import { useEffect, useState } from 'react';
import { Save, Pencil, RotateCcw } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table, useToast } from '../../components/ui';

const ROLES = ['Admin', 'Doctor', 'Reception'];
const blank = { UserName: '', FullName: '', Password: '', Role: 'Reception', IsActive: true };

export default function UserMaster() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/users').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try { await api.post('/users', f); toast(f.UserId ? 'User updated' : 'User created'); setF(blank); load(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="w-full">
      <PageHeader title="User Master" subtitle="Admin users see every screen. Other users see only the screens given in Menu Access." />
      <Card title={f.UserId ? `Edit ${f.UserName}` : 'New User'}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="User Name" required><Input value={f.UserName} onChange={set('UserName')} autoComplete="off" /></Field>
          <Field label="Full Name"><Input value={f.FullName || ''} onChange={set('FullName')} /></Field>
          <Field label="Password" required={!f.UserId} hint={f.UserId ? 'Leave blank to keep the current password' : ''}>
            <Input type="password" value={f.Password || ''} onChange={set('Password')} autoComplete="new-password" />
          </Field>
          <Field label="Role"><Select value={f.Role} onChange={set('Role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Active">
            <label className="flex h-[38px] items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!f.IsActive} onChange={(e) => setF({ ...f, IsActive: e.target.checked })} /> Active
            </label>
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {f.UserId && <Button variant="secondary" icon={RotateCcw} onClick={() => setF(blank)}>Cancel</Button>}
          <Button icon={Save} loading={busy} onClick={save}>Save</Button>
        </div>
      </Card>
      <div className="mt-5">
        <Table keyField="UserId" rows={rows} columns={[
          { label: 'User Name', key: 'UserName' },
          { label: 'Full Name', key: 'FullName' },
          { label: 'Role', render: (r) => <Badge color={r.Role === 'Admin' ? 'teal' : 'slate'}>{r.Role}</Badge> },
          { label: 'Active', render: (r) => (r.IsActive ? <Badge color="green">Active</Badge> : <Badge color="red">Inactive</Badge>) },
          { label: '', className: 'text-right', render: (r) => <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setF({ ...r, Password: '' })} /> },
        ]} />
      </div>
    </div>
  );
}
