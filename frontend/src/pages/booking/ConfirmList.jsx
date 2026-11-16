import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, XCircle, Plus } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { canSee } from '../../lib/menu';
import { fDate, fTime, today } from '../../lib/fmt';
import { Badge, Button, Card, Field, Input, PageHeader, Select, STATUS_COLOR, Table, useToast } from '../../components/ui';

export default function ConfirmList() {
  const toast = useToast();
  const nav = useNavigate();
  const { screens } = useAuth();
  const [q, setQ] = useState({ from: today(), to: today(), status: '', search: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => { setLoading(true); api.get('/bookings', { params: q }).then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const cancel = async (r) => {
    if (!confirm(`Cancel confirmation for ${r.PatientName}?`)) return;
    try { await api.put(`/bookings/${r.BookingId}/cancel`); toast('Cancelled'); load(); } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <div>
      <PageHeader title="Confirm List" subtitle={`${rows.length} confirmation${rows.length === 1 ? '' : 's'}`}
        actions={canSee(screens, 'confirmPatient') && <Button icon={Plus} onClick={() => nav('/booking/confirm')}>Confirm Patient</Button>} />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid items-end gap-3 sm:grid-cols-[150px_150px_150px_1fr_auto]">
          <Field label="From"><Input type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value })}>
              <option value="">All</option><option>Confirmed</option><option>Examined</option><option>Billed</option><option>Cancelled</option>
            </Select>
          </Field>
          <Field label="Search"><Input placeholder="Name / mobile / Patient ID" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} /></Field>
          <Button type="submit" icon={Search}>Search</Button>
        </form>
      </Card>
      <Table keyField="BookingId" rows={rows} loading={loading} columns={[
        { label: '#', render: (r, i) => i + 1 },
        { label: 'Patient Name', render: (r) => <div><div className="font-medium">{r.PatientName}</div><div className="font-mono text-xs text-ink-400">{r.PatientCode}</div></div> },
        { label: 'Mobile No', key: 'MobileNo' },
        { label: 'Confirm Time', render: (r) => <div><div>{fTime(r.ConfirmTime)}</div><div className="text-xs text-ink-400">{fDate(r.ConfirmTime)}</div></div> },
        { label: 'Type', key: 'BookingType' },
        { label: 'Doctor', key: 'DoctorName' },
        { label: 'Status', render: (r) => <Badge color={STATUS_COLOR[r.Status]}>{r.Status}</Badge> },
        { label: '', className: 'text-right', render: (r) => r.Status === 'Confirmed' && <Button size="sm" variant="ghost" icon={XCircle} onClick={() => cancel(r)}>Cancel</Button> },
      ]} />
    </div>
  );
}
