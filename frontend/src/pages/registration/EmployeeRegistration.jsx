import { useEffect, useState } from 'react';
import { Save, Pencil, Trash2, RotateCcw } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { fClock, money } from '../../lib/fmt';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Table, Textarea, useToast } from '../../components/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const blank = { Name: '', MobileNo: '', EmpType: 'Reception', Address: '', WorkDays: [], FromTime: '09:00', ToTime: '18:00', BreakFrom: '13:00', BreakTo: '14:00', DoctorFee: '' };

export default function EmployeeRegistration() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const load = () => api.get('/employees').then((r) => setRows(r.data));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isDoc = f.EmpType === 'Doctor';

  const toggleDay = (d) => setF({ ...f, WorkDays: f.WorkDays.includes(d) ? f.WorkDays.filter((x) => x !== d) : DAYS.filter((x) => x === d || f.WorkDays.includes(x)) });

  const save = async () => {
    setBusy(true);
    try { await api.post('/employees', f); toast(f.EmployeeId ? 'Employee updated' : 'Employee registered'); setF(blank); load(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  const edit = (r) => setF({ ...blank, ...r, WorkDays: r.WorkDays ? r.WorkDays.split(',') : [], DoctorFee: r.DoctorFee ?? '' });
  const del = async (r) => {
    if (!confirm(`Remove ${r.Name}?`)) return;
    await api.delete(`/employees/${r.EmployeeId}`); load();
  };

  return (
    <div className="w-full">
      <PageHeader title="Employee Registration" subtitle="Reception staff and doctors. Doctors also get their working days and hours." />
      <Card title={f.EmployeeId ? `Edit ${f.Name}` : 'New Employee'}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required><Input value={f.Name} onChange={set('Name')} /></Field>
          <Field label="Mobile No"><Input inputMode="numeric" maxLength={10} value={f.MobileNo || ''} onChange={(e) => setF({ ...f, MobileNo: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Type" required><Select value={f.EmpType} onChange={set('EmpType')}><option>Reception</option><option>Doctor</option></Select></Field>
          <Field label="Address" className="sm:col-span-full"><Textarea rows={2} value={f.Address || ''} onChange={set('Address')} /></Field>
        </div>
        {isDoc && (
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/50 p-4">
            <div className="mb-3 text-sm font-semibold text-brand-800">Doctor Schedule</div>
            <Field label="Days" required>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button type="button" key={d} onClick={() => toggleDay(d)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${f.WorkDays.includes(d) ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white text-ink-600 hover:border-brand-400'}`}>{d}</button>
                ))}
                <button type="button" className="px-2 text-xs text-brand-700 underline" onClick={() => setF({ ...f, WorkDays: DAYS.slice(0, 6) })}>Mon–Sat</button>
              </div>
            </Field>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="From Time" required><Input type="time" value={f.FromTime || ''} onChange={set('FromTime')} /></Field>
              <Field label="To Time" required><Input type="time" value={f.ToTime || ''} onChange={set('ToTime')} /></Field>
              <Field label="Break From"><Input type="time" value={f.BreakFrom || ''} onChange={set('BreakFrom')} /></Field>
              <Field label="Break To"><Input type="time" value={f.BreakTo || ''} onChange={set('BreakTo')} /></Field>
              <Field label="Consultation Fee (₹)"><Input type="number" min="0" value={f.DoctorFee} onChange={set('DoctorFee')} /></Field>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {f.EmployeeId && <Button variant="secondary" icon={RotateCcw} onClick={() => setF(blank)}>Cancel</Button>}
          <Button icon={Save} loading={busy} onClick={save}>Save</Button>
        </div>
      </Card>
      <div className="mt-5">
        <Table keyField="EmployeeId" rows={rows} columns={[
          { label: 'Name', key: 'Name' },
          { label: 'Mobile No', key: 'MobileNo' },
          { label: 'Type', render: (r) => <Badge color={r.EmpType === 'Doctor' ? 'teal' : 'slate'}>{r.EmpType}</Badge> },
          { label: 'Days', render: (r) => r.WorkDays?.split(',').join(', ') },
          { label: 'Timing', render: (r) => (r.FromTime ? `${fClock(r.FromTime)} – ${fClock(r.ToTime)}` : '') },
          { label: 'Break', render: (r) => (r.BreakFrom ? `${fClock(r.BreakFrom)} – ${fClock(r.BreakTo)}` : '') },
          { label: 'Fee', render: (r) => (r.EmpType === 'Doctor' ? money(r.DoctorFee) : '') },
          { label: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => edit(r)} />
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => del(r)} />
            </div>) },
        ]} />
      </div>
    </div>
  );
}
