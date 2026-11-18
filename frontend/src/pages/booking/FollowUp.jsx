import { useEffect, useState } from 'react';
import { Search, CheckCircle2, Phone } from 'lucide-react';
import api from '../../lib/api';
import { fDate, today, addDays, isoDate, nowLocal } from '../../lib/fmt';
import ConfirmForm from '../../components/ConfirmForm';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, STATUS_COLOR, Table } from '../../components/ui';

// WhatsApp glyph (lucide has no brand icons).
function WhatsAppIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// wa.me needs the number in international form without "+". Local 10-digit numbers get India's 91.
const waNumber = (mobile) => {
  let d = String(mobile || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d;
};

const waReminder = (r) => {
  const text = `Hello ${r.PatientName}, this is a reminder from Lakshmi Physiotherapy: your follow-up visit is due on ${fDate(r.FollowUpDate)}.`
    + `${r.DoctorName ? ` Doctor: ${r.DoctorName}.` : ''} Please reply to confirm your time. Thank you.`;
  return `https://wa.me/${waNumber(r.MobileNo)}?text=${encodeURIComponent(text)}`;
};

export default function FollowUp() {
  const [q, setQ] = useState({ from: today(), to: addDays(today(), 7), status: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);

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
        { label: 'Follow-up Date', render: (r) => <b>{fDate(r.FollowUpDate)}</b> },
        { label: 'Session', render: (r) => (r.Sessions > 1 ? <span className="text-ink-500">{r.SessionNo} of {r.Sessions}</span> : '—') },
        { label: 'Doctor', key: 'DoctorName' },
        { label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.FollowUpStatus]}>{r.FollowUpStatus}</Badge> },
        { label: '', className: 'text-right', render: (r) => r.FollowUpStatus !== 'Confirmed' && (
          <span className="inline-flex items-center justify-end gap-3">
            {r.MobileNo && (
              <a href={waReminder(r)} target="_blank" rel="noopener noreferrer" title="Send WhatsApp reminder" aria-label={`Send WhatsApp reminder to ${r.PatientName}`}
                onClick={(e) => e.stopPropagation()}
                className="grid h-6 w-6 place-items-center rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 text-[#1DA851] transition-colors hover:bg-[#25D366] hover:text-white">
                <WhatsAppIcon size={14} />
              </a>
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
