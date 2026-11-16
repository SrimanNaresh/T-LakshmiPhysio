import { useEffect, useState } from 'react';
import { Search, CheckCircle2, Phone } from 'lucide-react';
import api from '../../lib/api';
import { fDate, today, addDays, isoDate, nowLocal } from '../../lib/fmt';
import ConfirmForm from '../../components/ConfirmForm';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, STATUS_COLOR, Table } from '../../components/ui';

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
      <Table keyField="VisitId" rows={shown} loading={loading} columns={[
        { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
        { label: 'Name', key: 'PatientName' },
        { label: 'Mobile No', render: (r) => r.MobileNo && <a href={`tel:${r.MobileNo}`} className="inline-flex items-center gap-1 hover:text-brand-700"><Phone size={13} />{r.MobileNo}</a> },
        { label: 'Last Visit', render: (r) => fDate(r.VisitDate) },
        { label: 'Follow-up Date', render: (r) => <b>{fDate(r.FollowUpDate)}</b> },
        { label: 'Doctor', key: 'DoctorName' },
        { label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.FollowUpStatus]}>{r.FollowUpStatus}</Badge> },
        { label: '', className: 'text-right', render: (r) => r.FollowUpStatus !== 'Confirmed' && (
          <Button size="sm" icon={CheckCircle2} onClick={() => setSel(r)}>Confirm</Button>) },
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
