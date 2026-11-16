import { useEffect, useState } from 'react';
import { Save, Pencil, Trash2, RotateCcw } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { fDate, isoDate, today, addDays } from '../../lib/fmt';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table, Textarea, useToast } from '../../components/ui';

const PLANS = { Monthly: 30, Quarterly: 90, 'Half Yearly': 182, Annual: 365, Trial: 15 };
const blank = () => ({ PlanName: 'Annual', StartDate: today(), EndDate: addDays(today(), 365), Notes: '' });

export default function Validity() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(blank());
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/validity').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);

  const setPlan = (p) => setF({ ...f, PlanName: p, EndDate: PLANS[p] ? addDays(f.StartDate, PLANS[p]) : f.EndDate });
  const save = async () => {
    setBusy(true);
    try { await api.post('/validity', f); toast('Validity saved'); setF(blank()); load(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  const del = async (r) => {
    if (!confirm(`Delete plan ${r.PlanName} (${fDate(r.StartDate)} – ${fDate(r.EndDate)})?`)) return;
    try { await api.delete(`/validity/${r.ValidityId}`); load(); } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <div className="w-full">
      <PageHeader title="Validity" subtitle="Software subscription period. When it ends, only Admin users can log in." />
      <Card title={f.ValidityId ? 'Edit Plan' : 'Add Plan'}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Plan" required>
            <Select value={f.PlanName} onChange={(e) => setPlan(e.target.value)}>
              {Object.keys(PLANS).map((p) => <option key={p}>{p}</option>)}
              {!PLANS[f.PlanName] && <option>{f.PlanName}</option>}
            </Select>
          </Field>
          <Field label="Start Date" required><Input type="date" value={f.StartDate} onChange={(e) => setF({ ...f, StartDate: e.target.value, EndDate: PLANS[f.PlanName] ? addDays(e.target.value, PLANS[f.PlanName]) : f.EndDate })} /></Field>
          <Field label="End Date" required><Input type="date" value={f.EndDate} onChange={(e) => setF({ ...f, EndDate: e.target.value })} /></Field>
          <Field label="Notes" className="sm:col-span-full"><Textarea rows={2} value={f.Notes || ''} onChange={(e) => setF({ ...f, Notes: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {f.ValidityId && <Button variant="secondary" icon={RotateCcw} onClick={() => setF(blank())}>Cancel</Button>}
          <Button icon={Save} loading={busy} onClick={save}>Save</Button>
        </div>
      </Card>
      <div className="mt-5">
        <Table keyField="ValidityId" rows={rows} columns={[
          { label: 'Plan', key: 'PlanName' },
          { label: 'Start Date', render: (r) => fDate(r.StartDate) },
          { label: 'End Date', render: (r) => fDate(r.EndDate) },
          { label: 'Status', render: (r) => (r.DaysLeft < 0 ? <Badge color="red">Expired</Badge>
            : isoDate(r.StartDate) > today() ? <Badge color="blue">Upcoming</Badge>
              : <Badge color={r.DaysLeft <= 15 ? 'amber' : 'green'}>{r.DaysLeft} days left</Badge>) },
          { label: 'Notes', key: 'Notes' },
          { label: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setF({ ...r, StartDate: isoDate(r.StartDate), EndDate: isoDate(r.EndDate) })} />
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => del(r)} />
            </div>) },
        ]} />
      </div>
    </div>
  );
}
