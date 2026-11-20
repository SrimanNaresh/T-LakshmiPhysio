import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Pencil, CheckCircle2, History, UserPlus } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { canSee } from '../../lib/menu';
import { fDate } from '../../lib/fmt';
import { Button, Card, Field, Input, PageHeader, Table } from '../../components/ui';
import SendWhatsAppDialog from '../../components/SendWhatsAppDialog';
import { WhatsAppIcon } from '../../lib/whatsapp';

export default function PatientList() {
  const nav = useNavigate();
  const { screens } = useAuth();
  const [q, setQ] = useState({ search: '', from: '', to: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waFor, setWaFor] = useState(null); // patient to message on WhatsApp

  const load = () => { setLoading(true); api.get('/patients', { params: q }).then((r) => setRows(r.data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  return (
    <div>
      <PageHeader title="Patient List" subtitle={`${rows.length} patient${rows.length === 1 ? '' : 's'}`}
        actions={canSee(screens, 'patientRegistration') && <Button icon={UserPlus} onClick={() => nav('/registration/patient')}>New Patient</Button>} />
      <Card className="mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="grid gap-3 sm:grid-cols-[1fr_160px_160px_auto] items-end">
          <Field label="Search"><Input placeholder="Patient ID, name or mobile" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} /></Field>
          <Field label="Created From"><Input type="date" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></Field>
          <Field label="Created To"><Input type="date" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></Field>
          <Button type="submit" icon={Search}>Search</Button>
        </form>
      </Card>
      <Table keyField="PatientId" rows={rows} loading={loading} columns={[
        { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
        { label: 'Name', key: 'Name' },
        { label: 'Mobile No', key: 'MobileNo' },
        { label: 'Age', key: 'Age' },
        { label: 'Referral', key: 'Referral' },
        { label: 'Create Date', render: (r) => fDate(r.CreatedAt) },
        { label: '', className: 'text-right whitespace-nowrap', render: (r) => (
          <div className="flex justify-end gap-1">
            {canSee(screens, 'confirmPatient') && <Button size="sm" variant="secondary" icon={CheckCircle2} onClick={() => nav(`/booking/confirm?patientId=${r.PatientId}`)}>Confirm</Button>}
            <Button size="sm" variant="ghost" icon={WhatsAppIcon} title="Send WhatsApp message" disabled={!r.MobileNo} onClick={() => setWaFor(r)} className="!text-[#1DA851]" />
            {canSee(screens, 'patientHistory') && <Button size="sm" variant="ghost" icon={History} title="History" onClick={() => nav(`/examine/history?patientId=${r.PatientId}`)} />}
            {canSee(screens, 'patientRegistration') && <Button size="sm" variant="ghost" icon={Pencil} title="Edit" onClick={() => nav(`/registration/patient?id=${r.PatientId}`)} />}
          </div>) },
      ]} />
      <SendWhatsAppDialog open={!!waFor} patient={waFor} onClose={() => setWaFor(null)} />
    </div>
  );
}
