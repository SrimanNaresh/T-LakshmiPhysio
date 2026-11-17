import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Save, Trash2, ArrowLeft, History, ChevronDown, Check } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { fDate, fTime, today, addDays, money } from '../../lib/fmt';
import { BodyChartPanel, SkeletonIcon, mergeBodyChart, parseBodyChart } from '../../components/BodyChart';
import { Badge, Button, Card, Field, Input, PageHeader, Select, STATUS_COLOR, Table, Textarea, useToast } from '../../components/ui';

// Drop-down with a tick box per treatment: several can be chosen at once. selected = TreatmentIds.
function TreatmentMultiSelect({ masters, selected, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const chosen = masters.filter((m) => selected.includes(m.TreatmentId));
  const sum = chosen.reduce((s, m) => s + Number(m.Fee || 0), 0);
  return (
    <div ref={box} className="relative">
      <button type="button" className="input flex items-center justify-between gap-2 text-left" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`truncate ${chosen.length ? '' : 'text-ink-400'}`}>
          {chosen.length ? chosen.map((m) => m.TreatmentName).join(', ') : 'Select treatments from master…'}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {chosen.length > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] leading-4 text-white">{chosen.length}</span>}
          <ChevronDown size={15} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div role="listbox" aria-multiselectable="true" className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-elevated">
          {masters.length === 0 && <div className="px-3 py-2 text-xs text-ink-400">No treatments in master</div>}
          {masters.map((m) => {
            const on = selected.includes(m.TreatmentId);
            return (
              <button key={m.TreatmentId} type="button" role="option" aria-selected={on} onClick={() => onToggle(m)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-brand-50 ${on ? 'text-brand-800' : 'text-ink-700'}`}>
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white'}`}>{on && <Check size={12} strokeWidth={3} />}</span>
                <span className="flex-1 truncate">{m.TreatmentName}</span>
                <span className="text-ink-500">{money(m.Fee)}</span>
              </button>
            );
          })}
          {chosen.length > 0 && (
            <div className="sticky bottom-0 flex items-center justify-between border-t border-ink-100 bg-white px-3 py-1.5 text-xs">
              <button type="button" className="text-ink-500 hover:text-red-600" onClick={onClear}>Clear all</button>
              <span>{chosen.length} selected · <b>{money(sum)}</b></span>
              <button type="button" className="font-semibold text-brand-700" onClick={() => setOpen(false)}>Done</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExamineForm({ booking, onBack, onSaved }) {
  const toast = useToast();
  const [masters, setMasters] = useState([]);
  const [last, setLast] = useState(null);
  const [f, setF] = useState({ AssessmentNotes: '', FollowUpDate: '', DoctorFee: booking.DoctorFee ?? '' });
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('chart'); // 'chart' | 'notes'
  const [bodyNotes, setBodyNotes] = useState({});
  // An examined patient opens their saved assessment for editing; a waiting patient starts a new one.
  const editing = booking.Status === 'Examined';
  const [visitId, setVisitId] = useState(null);
  const [loadingVisit, setLoadingVisit] = useState(editing);
  const chartCount = Object.values(bodyNotes).filter((v) => v.text?.trim()).length;

  // Body chart findings are kept as one block inside the assessment notes, updated as they change.
  useEffect(() => { setF((cur) => ({ ...cur, AssessmentNotes: mergeBodyChart(cur.AssessmentNotes, bodyNotes) })); }, [bodyNotes]);

  useEffect(() => {
    api.get('/treatments').then((r) => setMasters(r.data));
    api.get('/visits', { params: { patientId: booking.PatientId } })
      .then((r) => setLast(r.data.find((v) => v.BookingId !== booking.BookingId) || null)); // the visit before this one
    if (editing) {
      api.get(`/visits/by-booking/${booking.BookingId}`).then(({ data: v }) => {
        setVisitId(v.VisitId);
        setF({ AssessmentNotes: v.AssessmentNotes || '', FollowUpDate: v.FollowUpDate ? String(v.FollowUpDate).slice(0, 10) : '', DoctorFee: v.DoctorFee ?? '' });
        setItems(v.treatments.map((t) => ({ TreatmentId: t.TreatmentId, TreatmentName: t.TreatmentName, Exercise: t.Exercise || '', Fee: t.Fee })));
        setBodyNotes(parseBodyChart(v.AssessmentNotes));
      }).catch((e) => toast(errMsg(e), 'error')).finally(() => setLoadingVisit(false));
    }
  }, [booking.PatientId, booking.BookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ticking a treatment adds it to the list below (fee from master, editable); unticking removes it.
  const toggleTreatment = (t) => setItems((cur) => (cur.some((x) => x.TreatmentId === t.TreatmentId)
    ? cur.filter((x) => x.TreatmentId !== t.TreatmentId)
    : [...cur, { TreatmentId: t.TreatmentId, TreatmentName: t.TreatmentName, Exercise: t.Exercise || '', Fee: t.Fee }]));
  const upd = (i, k, v) => setItems(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const tFee = useMemo(() => items.reduce((s, x) => s + Number(x.Fee || 0), 0), [items]);

  const save = async () => {
    setBusy(true);
    try {
      if (visitId) {
        await api.put(`/visits/${visitId}`, { ...f, treatments: items });
        toast(`Assessment updated for ${booking.PatientName}`);
      } else {
        await api.post('/visits', { ...f, BookingId: booking.BookingId, PatientId: booking.PatientId, DoctorId: booking.DoctorId, treatments: items });
        toast(`Assessment saved for ${booking.PatientName}`);
      }
      onSaved();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="form-compact w-full">
      <PageHeader title={editing ? 'Edit Patient Assessment' : 'Patient Assessment'} actions={<Button variant="secondary" icon={ArrowLeft} onClick={onBack}>Back to list</Button>} />
      {/* Patient details on one line (wraps only on narrow screens). */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-lg border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm leading-tight">
        {[
          ['Patient ID', <span className="font-mono font-semibold text-brand-800">{booking.PatientCode}</span>],
          ['Name', <span className="font-medium">{booking.PatientName}</span>],
          ['Age / Gender', `${booking.Age ?? '—'}${booking.Gender ? ` / ${booking.Gender}` : ''}`],
          ['Mobile No', booking.MobileNo || '—'],
          ['Doctor', booking.DoctorName || '—'],
          ['Status', <Badge color={STATUS_COLOR[booking.Status]}>{booking.Status === 'Confirmed' ? 'Waiting' : booking.Status}</Badge>],
          ...(booking.Notes ? [['Reason', booking.Notes]] : []),
        ].map(([label, value]) => (
          <span key={label} className={label === 'Reason' ? 'min-w-0' : 'whitespace-nowrap'}><span className="text-[11px] text-ink-500">{label}: </span>{value}</span>
        ))}
      </div>
      {last && (
        <div className="mb-4 rounded-xl border border-ink-200 bg-white p-4 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500"><History size={14} /> Last visit — {fDate(last.VisitDate)}</div>
          <div className="whitespace-pre-wrap text-ink-700">{last.AssessmentNotes || <i className="text-ink-400">No notes</i>}</div>
          {last.treatments?.length > 0 && <div className="mt-1 text-ink-500">Treatment: {last.treatments.map((t) => t.TreatmentName).join(', ')}</div>}
        </div>
      )}
      <Card>
        {loadingVisit && <div className="mb-3 text-xs text-ink-500">Loading the saved assessment…</div>}
        <div>
          <div role="tablist" aria-label="Assessment" className="mb-3 flex gap-1 border-b border-ink-200">
            {[['chart', 'Body Chart', SkeletonIcon], ['notes', 'Assessment Notes', null]].map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors ${tab === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>
                {Icon && <Icon size={16} />} {label}
                {id === 'chart' && chartCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] leading-4 text-white">{chartCount}</span>}
              </button>
            ))}
          </div>
          {tab === 'notes' ? (
            <>
              <label htmlFor="assessment-notes" className="sr-only">Patient Assessment Notes</label>
              <Textarea id="assessment-notes" rows={7} autoFocus value={f.AssessmentNotes} onChange={(e) => setF({ ...f, AssessmentNotes: e.target.value })}
                placeholder="Chief complaint, history, pain scale, ROM, special tests, diagnosis, plan…" />
            </>
          ) : (
            <BodyChartPanel notes={bodyNotes} setNotes={setBodyNotes} gender={booking.Gender} onDone={() => setTab('notes')} />
          )}
        </div>

        {/* Treatment, follow-up, fee and totals on one line (stacks on smaller screens). */}
        <div className="mt-5 grid items-end gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_150px_auto]">
          <div><span className="label">Treatment / Exercise</span>
            <TreatmentMultiSelect masters={masters} selected={items.map((x) => x.TreatmentId)} onToggle={toggleTreatment} onClear={() => setItems([])} />
          </div>
          <Field label="Follow-up Date">
            <div className="flex items-center gap-1.5">
              <Input type="date" min={today()} value={f.FollowUpDate} onChange={(e) => setF({ ...f, FollowUpDate: e.target.value })} className="!w-[150px]" />
              {[1, 3, 7, 15].map((n) => (
                <button key={n} type="button" className="whitespace-nowrap rounded border border-ink-200 px-1.5 py-0.5 text-xs text-ink-600 hover:border-brand-400"
                  onClick={() => setF({ ...f, FollowUpDate: addDays(today(), n) })}>+{n}d</button>
              ))}
            </div>
          </Field>
          <Field label="Consultation Fee (₹)" className="whitespace-nowrap"><Input type="number" min="0" value={f.DoctorFee} onChange={(e) => setF({ ...f, DoctorFee: e.target.value })} /></Field>
          <div className="flex min-h-[30px] items-center gap-3 whitespace-nowrap rounded-lg bg-ink-50 px-3 py-1 text-xs">
            <span><span className="text-ink-500">Doctor </span>{money(f.DoctorFee)}</span>
            <span><span className="text-ink-500">Treatment </span>{money(tFee)}</span>
            <span className="border-l border-ink-200 pl-3 text-sm font-semibold">Total {money(Number(f.DoctorFee || 0) + tFee)}</span>
          </div>
        </div>

        <div>
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

        <div className="mt-5 flex justify-end">
          <Button icon={Save} loading={busy} disabled={loadingVisit} onClick={save}>{editing ? 'Update Assessment' : 'Save Assessment'}</Button>
        </div>
      </Card>
    </div>
  );
}

export default function ExamineQueue() {
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('open'); // 'open' = waiting + examined
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/bookings', { params: { from: date, to: date, status: status === 'open' ? '' : status } })
      .then((r) => setRows(r.data.filter((b) => (status === 'open' ? ['Confirmed', 'Examined'].includes(b.Status) : b.Status !== 'Cancelled')).reverse()))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (sel) return <ExamineForm booking={sel} onBack={() => setSel(null)} onSaved={() => { setSel(null); load(); }} />;

  return (
    <div>
      <PageHeader title="Confirm Patient List" subtitle="Select a waiting patient to record the assessment, or an examined patient to edit it" />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid items-end gap-3 sm:grid-cols-[170px_170px_auto]">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Waiting + Examined</option><option value="Confirmed">Waiting</option><option value="Examined">Examined</option><option value="Billed">Billed</option><option value="">All</option>
            </Select>
          </Field>
          <Button type="submit" icon={Search}>Show</Button>
        </form>
      </Card>
      <Table keyField="BookingId" rows={rows} loading={loading} empty="No patients for this date"
        onRowClick={(r) => ['Confirmed', 'Examined'].includes(r.Status) && setSel(r)}
        columns={[
          { label: 'Token', render: (r, i) => <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{i + 1}</span> },
          { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
          { label: 'Patient Name', key: 'PatientName' },
          { label: 'Mobile No', key: 'MobileNo' },
          { label: 'Confirm Time', render: (r) => fTime(r.ConfirmTime) },
          { label: 'Type', key: 'BookingType' },
          { label: 'Doctor', key: 'DoctorName' },
          { label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.Status]}>{r.Status === 'Confirmed' ? 'Waiting' : r.Status}</Badge> },
          { label: '', className: 'text-right', render: (r) => (r.Status === 'Confirmed' ? <span className="text-xs font-medium text-brand-700">Examine →</span>
            : r.Status === 'Examined' ? <span className="text-xs font-medium text-teal-700">Edit →</span> : null) },
        ]} />
    </div>
  );
}
