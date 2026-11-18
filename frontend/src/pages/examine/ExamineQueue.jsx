import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Save, Trash2, ArrowLeft, History, ChevronDown, Check, X, Plus, Dumbbell, CalendarDays } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { fDate, fTime, today, addDays, money } from '../../lib/fmt';
import { BodyChartPanel, SkeletonIcon, mergeBodyChart, parseBodyChart } from '../../components/BodyChart';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, STATUS_COLOR, Table, Textarea, useToast } from '../../components/ui';
import { VisitTimeline } from './PatientHistory';
import CreatableSelect from '../../components/CreatableSelect';

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

// Follow-up schedule: how often and for how long, from a start date. Offsets 0..span-1 in steps.
const REPEATS = [['once', 'Single date', 0], ['daily', 'Daily', 1], ['alt', 'Alternate days', 2], ['3d', 'Every 3 days', 3], ['weekly', 'Weekly', 7]];
const SPANS = [[7, '1 week'], [14, '2 weeks'], [21, '3 weeks'], [30, '1 month']];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fDay = (ymd) => `${WEEKDAYS[new Date(`${ymd}T00:00:00`).getDay()]}, ${fDate(ymd)}`;
// Days in typed text: "4" / "4 days" / "every 4 days" -> 4, "6 weeks" -> 42, "2 months" -> 60. null if no number.
const parseDays = (text) => {
  const m = String(text).toLowerCase().match(/(\d+(?:\.\d+)?)\s*(days|day|d|weeks|week|wks|wk|w|months|month|mo|m)?\b/);
  if (!m) return null;
  const unit = (m[2] || 'd')[0];
  const days = Math.round(Number(m[1]) * (unit === 'w' ? 7 : unit === 'm' ? 30 : 1));
  return days >= 1 && days <= 365 ? days : null;
};
const planDates = ({ repeat, span, start }, repeats = REPEATS) => {
  const step = repeats.find((r) => r[0] === repeat)?.[2];
  if (!step) return [start];
  const out = [];
  for (let k = 0; k < span; k += step) out.push(addDays(start, k));
  return out;
};
const customPlan = (dates) => ({ repeat: 'custom', span: 7, start: dates[0] || today(), dates });

function FollowUpPlanner({ plan, setPlan }) {
  const toast = useToast();
  const [extra, setExtra] = useState('');
  // Entries the clinic added to the Visit / For lists (saved in the database, shared by everyone).
  const [added, setAdded] = useState([]);
  useEffect(() => { api.get('/follow-up-options').then((r) => setAdded(r.data)).catch(() => {}); }, []);
  const repeats = useMemo(() => [...REPEATS, ...added.filter((o) => o.Kind === 'repeat' && !REPEATS.some((r) => r[2] === o.Days))
    .map((o) => [`every${o.Days}`, o.Label, o.Days, o.OptionId])].sort((a, b) => a[2] - b[2]), [added]);
  const spans = useMemo(() => [...SPANS, ...added.filter((o) => o.Kind === 'span' && !SPANS.some((s) => s[0] === o.Days))
    .map((o) => [o.Days, o.Label, o.OptionId])].sort((a, b) => a[0] - b[0]), [added]);
  const regen = (p) => setPlan({ ...p, dates: planDates(p, repeats) });

  // Add typed text as a new entry. A number of days already in the list just selects that entry.
  const addOption = async (kind, text) => {
    const days = parseDays(text);
    const list = kind === 'repeat' ? repeats : spans;
    const same = kind === 'repeat' ? list.find((r) => r[2] === days) : list.find((s) => s[0] === days);
    if (!same) {
      try {
        const { data } = await api.post('/follow-up-options', { Kind: kind, Label: text, Days: days });
        setAdded((cur) => [...cur.filter((o) => o.OptionId !== data.OptionId), data]);
        toast(`Added "${data.Label}" to the ${kind === 'repeat' ? 'Visit' : 'For'} list`);
        const key = kind === 'repeat' ? `every${data.Days}` : data.Days;
        const next = kind === 'repeat' ? { ...plan, repeat: key } : { ...plan, span: key };
        const withNew = kind === 'repeat' ? [...repeats, [key, data.Label, data.Days]] : repeats;
        setPlan({ ...next, dates: planDates(next, withNew) });
        return;
      } catch (e) { throw new Error(errMsg(e)); }
    }
    regen(kind === 'repeat' ? { ...plan, repeat: same[0] } : { ...plan, span: same[0] });
  };
  const removeOption = async (kind, o) => {
    if (!window.confirm(`Remove "${o.label}" from the ${kind === 'repeat' ? 'Visit' : 'For'} list?`)) return;
    try {
      await api.delete(`/follow-up-options/${o.id}`);
      setAdded((cur) => cur.filter((x) => x.OptionId !== o.id));
      // If it was the chosen one, fall back to a built-in choice.
      if (kind === 'repeat' && plan.repeat === o.value) regen({ ...plan, repeat: 'once' });
      if (kind === 'span' && plan.span === o.value) regen({ ...plan, span: 7 });
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  const repeatHint = (t) => (parseDays(t) ? '' : 'Include a number of days, e.g. "Every 4 days"');
  const spanHint = (t) => (parseDays(t) ? '' : 'Include a length, e.g. "10 days", "6 weeks" or "2 months"');
  const setDates = (dates) => setPlan({ ...plan, repeat: 'custom', dates: [...new Set(dates)].sort() });
  const repeating = !['once', 'custom'].includes(plan.repeat);
  const n = plan.dates.length;
  return (
    <div>
      {/* From, repeat, duration and add-a-date on one line; the scheduled dates follow below. */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Follow-up From" className="w-[150px]">
          <Input type="date" min={today()} value={plan.start}
            onChange={(e) => e.target.value && regen({ ...plan, start: e.target.value, repeat: plan.repeat === 'custom' ? 'once' : plan.repeat })} />
        </Field>
        <Field label="Visit" className="w-[170px]">
          <CreatableSelect aria-label="Visit" value={plan.repeat} placeholder="Type or pick…"
            options={[...repeats.map(([v, l, , id]) => ({ value: v, label: l, custom: !!id, id })),
              ...(plan.repeat === 'custom' ? [{ value: 'custom', label: 'Custom dates' }] : [])]}
            onChange={(v) => v !== 'custom' && regen({ ...plan, repeat: v })}
            onAdd={(t) => addOption('repeat', t)} canAdd={repeatHint} onDelete={(o) => removeOption('repeat', o)} />
        </Field>
        <Field label="For" className="w-[140px]">
          <CreatableSelect aria-label="For" value={plan.span} disabled={!repeating} placeholder="Type or pick…"
            options={spans.map(([v, l, id]) => ({ value: v, label: l, custom: !!id, id }))}
            onChange={(v) => regen({ ...plan, span: Number(v) })}
            onAdd={(t) => addOption('span', t)} canAdd={spanHint} onDelete={(o) => removeOption('span', o)} />
        </Field>
        <Field label="Add Date">
          <div className="flex items-center gap-1.5">
            <Input type="date" min={today()} value={extra} onChange={(e) => setExtra(e.target.value)} className="!w-[150px]" aria-label="Add a follow-up date" />
            <Button type="button" variant="secondary" icon={Plus} disabled={!extra} onClick={() => { setDates([...plan.dates, extra]); setExtra(''); }}>Add</Button>
          </div>
        </Field>
        <div className="pb-2 text-xs text-ink-500">
          {n === 0 ? 'No follow-up' : `${n} follow-up ${n === 1 ? 'date' : 'dates'}${n > 1 ? ` · ${fDate(plan.dates[0])} to ${fDate(plan.dates[n - 1])}` : ''}`}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {plan.dates.map((d) => (
          <span key={d} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-800">
            {fDay(d)}
            <button type="button" aria-label={`Remove ${fDate(d)}`} onClick={() => setDates(plan.dates.filter((x) => x !== d))}
              className="grid h-4 w-4 place-items-center rounded-full text-brand-600 hover:bg-brand-200"><X size={11} /></button>
          </span>
        ))}
      </div>
    </div>
  );
}

function ExamineForm({ booking, onBack, onSaved }) {
  const toast = useToast();
  const [masters, setMasters] = useState([]);
  const [history, setHistory] = useState([]); // earlier visits of this patient, newest first
  const [showHistory, setShowHistory] = useState(false);
  const [f, setF] = useState({ AssessmentNotes: '', DoctorFee: booking.DoctorFee ?? '' });
  const [plan, setPlan] = useState(() => { const p = { repeat: 'once', span: 7, start: today() }; return { ...p, dates: planDates(p) }; });
  const planTouched = useRef(false);
  const changePlan = (p) => { planTouched.current = true; setPlan(p); };
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('chart'); // 'chart' | 'notes' | 'treatment' | 'followup'
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
      .then((r) => {
        const earlier = r.data.filter((v) => v.BookingId !== booking.BookingId);
        const prev = earlier[0] || null; // the visit before this one
        setHistory(earlier);
        // A new assessment carries forward the dates still to come from the last visit's schedule.
        const remaining = (prev?.FollowUpDates || []).filter((d) => d > today());
        if (!editing && remaining.length && !planTouched.current) setPlan(customPlan(remaining));
      });
    if (editing) {
      api.get(`/visits/by-booking/${booking.BookingId}`).then(({ data: v }) => {
        setVisitId(v.VisitId);
        setF({ AssessmentNotes: v.AssessmentNotes || '', DoctorFee: v.DoctorFee ?? '' });
        if (v.FollowUpDates?.length) setPlan(customPlan(v.FollowUpDates));
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
        await api.put(`/visits/${visitId}`, { ...f, FollowUpDates: plan.dates, treatments: items });
        toast(`Assessment updated for ${booking.PatientName}`);
      } else {
        await api.post('/visits', { ...f, FollowUpDates: plan.dates, BookingId: booking.BookingId, PatientId: booking.PatientId, DoctorId: booking.DoctorId, treatments: items });
        toast(`Assessment saved for ${booking.PatientName}`);
      }
      onSaved();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="form-compact w-full">
      <PageHeader title={editing ? 'Edit Patient Assessment' : 'Patient Assessment'} actions={(
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={History} disabled={history.length === 0} onClick={() => setShowHistory(true)}
            title={history.length ? 'Earlier visits of this patient' : 'First visit — no history yet'}>
            Patient History{history.length > 0 && ` (${history.length})`}
          </Button>
          <Button variant="secondary" icon={ArrowLeft} onClick={onBack}>Back to list</Button>
        </div>
      )} />
      <Modal open={showHistory} width="max-w-4xl" onClose={() => setShowHistory(false)}
        title={`Patient History — ${booking.PatientName} (${booking.PatientCode}) · ${history.length} earlier ${history.length === 1 ? 'visit' : 'visits'}`}>
        <VisitTimeline visits={history} />
      </Modal>
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
      <Card>
        {loadingVisit && <div className="mb-3 text-xs text-ink-500">Loading the saved assessment…</div>}
        {/* One tab strip: body chart, notes, treatment & fees, follow-up. */}
        <div>
          <div role="tablist" aria-label="Assessment" className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-ink-200">
            <div className="flex flex-wrap gap-1">
              {[
                ['chart', 'Body Chart', SkeletonIcon, chartCount],
                ['notes', 'Assessment Notes', null, 0],
                ['treatment', 'Treatment & Fees', Dumbbell, items.length],
                ['followup', 'Follow-up', CalendarDays, plan.dates.length],
              ].map(([id, label, Icon, count]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm font-semibold transition-colors ${tab === id ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'}`}>
                  {Icon && <Icon size={16} />} {label}
                  {count > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] leading-4 text-white">{count}</span>}
                </button>
              ))}
            </div>
          </div>

          {tab === 'chart' && <BodyChartPanel notes={bodyNotes} setNotes={setBodyNotes} gender={booking.Gender} onDone={() => setTab('notes')} />}
          {tab === 'notes' && (
            <>
              <label htmlFor="assessment-notes" className="sr-only">Patient Assessment Notes</label>
              <Textarea id="assessment-notes" rows={7} autoFocus value={f.AssessmentNotes} onChange={(e) => setF({ ...f, AssessmentNotes: e.target.value })}
                placeholder="Chief complaint, history, pain scale, ROM, special tests, diagnosis, plan…" />
            </>
          )}
          {tab === 'followup' && <FollowUpPlanner plan={plan} setPlan={changePlan} />}
          {tab === 'treatment' && (
            <>
              <div className="grid items-end gap-x-4 gap-y-3 md:grid-cols-[minmax(0,1fr)_150px_auto]">
                <div><span className="label">Treatment / Exercise</span>
                  <TreatmentMultiSelect masters={masters} selected={items.map((x) => x.TreatmentId)} onToggle={toggleTreatment} onClear={() => setItems([])} />
                </div>
                <Field label="Consultation Fee (₹)" className="whitespace-nowrap"><Input type="number" min="0" value={f.DoctorFee} onChange={(e) => setF({ ...f, DoctorFee: e.target.value })} /></Field>
                <div className="flex min-h-[30px] items-center gap-3 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3 py-1 text-xs text-teal-900">
                  <span><span className="text-teal-700">Doctor </span>{money(f.DoctorFee)}</span>
                  <span><span className="text-teal-700">Treatment </span>{money(tFee)}</span>
                  <span className="border-l border-teal-200 pl-3 text-sm font-semibold text-teal-800">Total {money(Number(f.DoctorFee || 0) + tFee)}</span>
                </div>
              </div>
              {items.length > 0 && (
                // Selected treatments side by side on one line: a small card each (name, exercise, fee, remove).
                // As many as fit go on a line; more wrap to the next.
                <div className="mt-3 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                  {items.map((x, i) => (
                    <div key={x.TreatmentId ?? i} className="rounded-lg border border-ink-200 bg-white p-2">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="truncate text-sm font-semibold text-ink-800" title={x.TreatmentName}>{x.TreatmentName}</span>
                        <button type="button" aria-label={`Remove ${x.TreatmentName}`} onClick={() => setItems(items.filter((_, j) => j !== i))}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                      <div className="flex gap-1.5">
                        <Input value={x.Exercise} onChange={(e) => upd(i, 'Exercise', e.target.value)} placeholder="Exercise / instructions" aria-label={`${x.TreatmentName} exercise`} />
                        <Input type="number" min="0" value={x.Fee} onChange={(e) => upd(i, 'Fee', e.target.value)} className="!w-[80px] shrink-0" aria-label={`${x.TreatmentName} fee (₹)`} title="Fee (₹)" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

      </Card>
      {/* One Save for the whole assessment, below the tabs, so it works from any tab. */}
      <div className="mt-4 flex justify-end">
        <Button icon={Save} loading={busy} disabled={loadingVisit} onClick={save}>{editing ? 'Update Assessment' : 'Save Assessment'}</Button>
      </div>
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
