import { useEffect, useMemo, useState } from 'react';
import { Search, Save, Plus, Trash2, ArrowLeft, History } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { fDate, fTime, today, addDays, money } from '../../lib/fmt';
import { Badge, Button, Card, Field, Input, PageHeader, Select, STATUS_COLOR, Table, Textarea, useToast } from '../../components/ui';

function ExamineForm({ booking, onBack, onSaved }) {
  const toast = useToast();
  const [masters, setMasters] = useState([]);
  const [last, setLast] = useState(null);
  const [f, setF] = useState({ AssessmentNotes: '', FollowUpDate: '', DoctorFee: booking.DoctorFee ?? '' });
  const [items, setItems] = useState([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/treatments').then((r) => setMasters(r.data));
    api.get('/visits', { params: { patientId: booking.PatientId } }).then((r) => setLast(r.data[0] || null));
  }, [booking.PatientId]);

  const addTreatment = () => {
    const t = masters.find((m) => String(m.TreatmentId) === String(pick));
    if (!t) return;
    setItems([...items, { TreatmentId: t.TreatmentId, TreatmentName: t.TreatmentName, Exercise: t.Exercise || '', Fee: t.Fee }]);
    setPick('');
  };
  const upd = (i, k, v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const tFee = useMemo(() => items.reduce((s, x) => s + Number(x.Fee || 0), 0), [items]);

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/visits', { ...f, BookingId: booking.BookingId, PatientId: booking.PatientId, DoctorId: booking.DoctorId, treatments: items });
      toast(`Assessment saved for ${booking.PatientName}`);
      onSaved();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="w-full">
      <PageHeader title="Patient Assessment" actions={<Button variant="secondary" icon={ArrowLeft} onClick={onBack}>Back to list</Button>} />
      <div className="mb-4 grid gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm sm:grid-cols-5">
        <div><div className="text-xs text-ink-500">Patient ID</div><div className="font-mono font-semibold text-brand-800">{booking.PatientCode}</div></div>
        <div><div className="text-xs text-ink-500">Name</div><div className="font-medium">{booking.PatientName}</div></div>
        <div><div className="text-xs text-ink-500">Age / Gender</div><div>{booking.Age ?? '—'} {booking.Gender ? `/ ${booking.Gender}` : ''}</div></div>
        <div><div className="text-xs text-ink-500">Mobile No</div><div>{booking.MobileNo || '—'}</div></div>
        <div><div className="text-xs text-ink-500">Doctor</div><div>{booking.DoctorName || '—'}</div></div>
        {booking.Notes && <div className="sm:col-span-5"><span className="text-xs text-ink-500">Reason: </span>{booking.Notes}</div>}
      </div>
      {last && (
        <div className="mb-4 rounded-xl border border-ink-200 bg-white p-4 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500"><History size={14} /> Last visit — {fDate(last.VisitDate)}</div>
          <div className="whitespace-pre-wrap text-ink-700">{last.AssessmentNotes || <i className="text-ink-400">No notes</i>}</div>
          {last.treatments?.length > 0 && <div className="mt-1 text-ink-500">Treatment: {last.treatments.map((t) => t.TreatmentName).join(', ')}</div>}
        </div>
      )}
      <Card>
        <Field label="Patient Assessment Notes">
          <Textarea rows={7} autoFocus value={f.AssessmentNotes} onChange={(e) => setF({ ...f, AssessmentNotes: e.target.value })}
            placeholder="Chief complaint, history, pain scale, ROM, special tests, diagnosis, plan…" />
        </Field>

        <div className="mt-5">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">Treatment / Exercise</div>
          <div className="flex gap-2">
            <Select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Select treatment from master…</option>
              {masters.map((m) => <option key={m.TreatmentId} value={m.TreatmentId}>{m.TreatmentName} — {money(m.Fee)}</option>)}
            </Select>
            <Button variant="secondary" icon={Plus} onClick={addTreatment} disabled={!pick}>Add</Button>
          </div>
          {items.length > 0 && (
            <div className="mt-3 space-y-2">
              {items.map((x, i) => (
                <div key={i} className="grid items-start gap-2 rounded-lg border border-ink-200 p-3 sm:grid-cols-[1fr_2fr_120px_auto]">
                  <div className="pt-2 text-sm font-medium">{x.TreatmentName}</div>
                  <Input value={x.Exercise} onChange={(e) => upd(i, 'Exercise', e.target.value)} placeholder="Exercise / instructions" />
                  <Input type="number" min="0" value={x.Fee} onChange={(e) => upd(i, 'Fee', e.target.value)} />
                  <Button variant="ghost" icon={Trash2} onClick={() => setItems(items.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Field label="Follow-up Date">
            <Input type="date" min={today()} value={f.FollowUpDate} onChange={(e) => setF({ ...f, FollowUpDate: e.target.value })} />
            <div className="mt-1.5 flex gap-1.5">
              {[1, 3, 7, 15].map((n) => (
                <button key={n} type="button" className="rounded border border-ink-200 px-2 py-0.5 text-xs text-ink-600 hover:border-brand-400"
                  onClick={() => setF({ ...f, FollowUpDate: addDays(today(), n) })}>+{n}d</button>
              ))}
            </div>
          </Field>
          <Field label="Fee (Doctor / Consultation ₹)"><Input type="number" min="0" value={f.DoctorFee} onChange={(e) => setF({ ...f, DoctorFee: e.target.value })} /></Field>
          <div className="rounded-lg bg-ink-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Doctor Fee</span><span>{money(f.DoctorFee)}</span></div>
            <div className="flex justify-between"><span className="text-ink-500">Treatment Fee</span><span>{money(tFee)}</span></div>
            <div className="mt-1 flex justify-between border-t border-ink-200 pt-1 font-semibold"><span>Total</span><span>{money(Number(f.DoctorFee || 0) + tFee)}</span></div>
          </div>
        </div>
        <div className="mt-5 flex justify-end"><Button icon={Save} loading={busy} onClick={save}>Save Assessment</Button></div>
      </Card>
    </div>
  );
}

export default function ExamineQueue() {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('Confirmed');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/bookings', { params: { from: date, to: date, status } }).then((r) => setRows(r.data.filter((b) => b.Status !== 'Cancelled').reverse())).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (sel) return <ExamineForm booking={sel} onBack={() => setSel(null)} onSaved={() => { setSel(null); load(); }} />;

  return (
    <div>
      <PageHeader title="Confirm Patient List" subtitle="Select a confirmed patient to record the assessment" />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid items-end gap-3 sm:grid-cols-[170px_170px_auto]">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Confirmed">Waiting</option><option value="Examined">Examined</option><option value="Billed">Billed</option><option value="">All</option>
            </Select>
          </Field>
          <Button type="submit" icon={Search}>Show</Button>
        </form>
      </Card>
      <Table keyField="BookingId" rows={rows} loading={loading} empty="No patients waiting"
        onRowClick={(r) => r.Status === 'Confirmed' && setSel(r)}
        columns={[
          { label: 'Token', render: (r, i) => <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{i + 1}</span> },
          { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
          { label: 'Patient Name', key: 'PatientName' },
          { label: 'Mobile No', key: 'MobileNo' },
          { label: 'Confirm Time', render: (r) => fTime(r.ConfirmTime) },
          { label: 'Type', key: 'BookingType' },
          { label: 'Doctor', key: 'DoctorName' },
          { label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.Status]}>{r.Status === 'Confirmed' ? 'Waiting' : r.Status}</Badge> },
          { label: '', className: 'text-right', render: (r) => r.Status === 'Confirmed' && <span className="text-xs font-medium text-brand-700">Examine →</span> },
        ]} />
    </div>
  );
}
