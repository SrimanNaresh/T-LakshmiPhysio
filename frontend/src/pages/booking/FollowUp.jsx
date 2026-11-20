import { useEffect, useRef, useState } from 'react';
import { Search, CheckCircle2, Phone, Loader2 } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { fDate, today, addDays, isoDate, nowLocal } from '../../lib/fmt';
import ConfirmForm from '../../components/ConfirmForm';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, STATUS_COLOR, Table, useToast } from '../../components/ui';
import { WhatsAppIcon } from '../../lib/whatsapp';
import { useAuth } from '../../lib/auth';

// Follow-up date with a calendar picker. Saves a moment after the last change (so typing a date
// digit by digit saves once), and only valid dates on or after the visit day.
function FollowUpDateCell({ row, onSaved }) {
  const toast = useToast();
  const orig = isoDate(row.FollowUpDate);
  const minDay = isoDate(row.VisitDate);
  const [val, setVal] = useState(orig);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  useEffect(() => { setVal(orig); }, [orig]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const save = async (d) => {
    setBusy(true);
    try {
      await api.put(`/follow-ups/${row.VisitFollowUpId}`, { FollowUpDate: d });
      toast(`Follow-up for ${row.PatientName} moved to ${fDate(d)}`);
      onSaved();
    } catch (e) { toast(errMsg(e), 'error'); setVal(orig); } finally { setBusy(false); }
  };
  const change = (d) => {
    setVal(d);
    clearTimeout(timer.current);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d === orig || d < minDay) return;
    timer.current = setTimeout(() => save(d), 700);
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <input type="date" value={val} min={minDay} disabled={busy} onChange={(e) => change(e.target.value)}
        onBlur={() => { if (val < minDay || !val) setVal(orig); }}
        aria-label={`Follow-up date for ${row.PatientName}`} title="Change follow-up date"
        className="input !w-[150px] !py-1 font-semibold" />
      {busy && <Loader2 size={14} className="animate-spin text-brand-600" />}
    </span>
  );
}

const reminderText = (r, clinicName) => `Hello ${r.PatientName}, this is a reminder from ${clinicName || 'Lakshmi Physiotherapy'}: your follow-up visit is due on ${fDate(r.FollowUpDate)}.`
  + `${r.DoctorName ? ` Doctor: ${r.DoctorName}.` : ''} Please reply to confirm your time. Thank you.`;

export default function FollowUp() {
  const [q, setQ] = useState({ from: today(), to: addDays(today(), 7), status: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const toast = useToast();
  const { clinic } = useAuth();
  // Send the reminder straight from the clinic's linked WhatsApp (no WhatsApp Web tab). The server takes
  // the number from the patient record and sends only from the verified Clinic Master number.
  const [sendingId, setSendingId] = useState(null);
  const sendReminder = async (r) => {
    if (sendingId) return;
    setSendingId(r.VisitFollowUpId);
    try {
      await api.post('/whatsapp/send', { PatientId: r.PatientId, Text: reminderText(r, clinic?.ClinicName) });
      toast(`Reminder sent to ${r.PatientName} on WhatsApp`);
    } catch (e) { toast(errMsg(e), 'error'); } finally { setSendingId(null); }
  };

  const load = () => { setLoading(true); api.get('/follow-ups', { params: q }).then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);
  const shown = q.status ? rows.filter((r) => r.FollowUpStatus === q.status) : rows;

  return (
    <div>
      <PageHeader title="Follow-up Patients" subtitle="Patients whose follow-up date (set during examination) falls in the selected range" />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid items-end gap-3 sm:grid-cols-[160px_160px_160px_auto_auto]">
          <Field label="Follow-up From"><Input type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></Field>
          <Field label="Follow-up To"><Input type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value })}>
              <option value="">All</option><option>Pending</option><option>Confirmed</option><option>Missed</option>
            </Select>
          </Field>
          <Button type="submit" icon={Search}>Search</Button>
          <Button type="button" variant="secondary" onClick={() => setQ({ ...q, from: addDays(today(), -30), to: addDays(today(), -1), status: 'Missed' })}>Missed (30 days)</Button>
        </form>
      </Card>
      <Table keyField="VisitFollowUpId" rows={shown} loading={loading} columns={[
        { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
        { label: 'Name', key: 'PatientName' },
        { label: 'Mobile No', render: (r) => r.MobileNo && <a href={`tel:${r.MobileNo}`} className="inline-flex items-center gap-1 hover:text-brand-700"><Phone size={13} />{r.MobileNo}</a> },
        { label: 'Last Visit', render: (r) => fDate(r.VisitDate) },
        // Every follow-up date can be moved with the calendar (status is worked out again after the change).
        { label: 'Follow-up Date', render: (r) => <FollowUpDateCell row={r} onSaved={load} /> },
        { label: 'Session', render: (r) => (r.Sessions > 1 ? <span className="text-ink-500">{r.SessionNo} of {r.Sessions}</span> : '—') },
        { label: 'Doctor', key: 'DoctorName' },
        { label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.FollowUpStatus]}>{r.FollowUpStatus}</Badge> },
        { label: '', className: 'text-right', render: (r) => r.FollowUpStatus !== 'Confirmed' && (
          <span className="inline-flex items-center justify-end gap-3">
            {r.MobileNo && (
              <button type="button" title="Send WhatsApp reminder" aria-label={`Send WhatsApp reminder to ${r.PatientName}`}
                disabled={!!sendingId} onClick={(e) => { e.stopPropagation(); sendReminder(r); }}
                className="grid h-6 w-6 place-items-center rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 text-[#1DA851] transition-colors hover:bg-[#25D366] hover:text-white disabled:cursor-not-allowed disabled:opacity-60">
                {sendingId === r.VisitFollowUpId ? <Loader2 size={14} className="animate-spin" /> : <WhatsAppIcon size={14} />}
              </button>
            )}
            <Button size="sm" icon={CheckCircle2} onClick={() => setSel(r)}>Confirm</Button>
          </span>) },
      ]} />
      <Modal open={!!sel} title={`Confirm follow-up — ${sel?.PatientName} (${sel?.PatientCode})`} onClose={() => setSel(null)}>
        {sel && (
          <ConfirmForm
            patient={{ PatientId: sel.PatientId, Name: sel.PatientName }}
            defaultType="Follow-up"
            defaultTime={isoDate(sel.FollowUpDate) > today() ? `${isoDate(sel.FollowUpDate)}T10:00` : nowLocal()}
            onDone={() => { setSel(null); load(); }}
          />
        )}
      </Modal>
    </div>
  );
}
