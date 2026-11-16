import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, X } from 'lucide-react';
import api from '../../lib/api';
import { fDate } from '../../lib/fmt';
import { useAuth } from '../../lib/auth';
import { canSee } from '../../lib/menu';
import ConfirmForm from '../../components/ConfirmForm';
import { Button, Card, Field, Input, PageHeader, Table } from '../../components/ui';

export default function ConfirmPatient() {
  const nav = useNavigate();
  const { screens } = useAuth();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState({ name: '', mobile: '' });
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    const id = params.get('patientId');
    if (id) api.get(`/patients/${id}`).then((r) => setSel(r.data));
  }, [params]);

  const search = async (e) => {
    e?.preventDefault();
    setLoading(true); setSel(null);
    try { setRows((await api.get('/patients', { params: q })).data); } finally { setLoading(false); }
  };

  const reset = () => { setSel(null); setRows(null); setQ({ name: '', mobile: '' }); setParams({}); };

  return (
    <div className="w-full">
      <PageHeader title="Confirm Patient" subtitle="Search the patient list, select the patient and confirm the visit" />
      <Card className="mb-4">
        <form onSubmit={search} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Patient Name"><Input autoFocus value={q.name} onChange={(e) => setQ({ ...q, name: e.target.value })} /></Field>
          <Field label="Mobile No"><Input inputMode="numeric" value={q.mobile} onChange={(e) => setQ({ ...q, mobile: e.target.value.replace(/\D/g, '') })} /></Field>
          <Button type="submit" icon={Search} loading={loading}>Search</Button>
        </form>
      </Card>

      {sel ? (
        <Card title="Confirm Visit" actions={<Button size="sm" variant="ghost" icon={X} onClick={reset}>Change patient</Button>}>
          <div className="mb-5 grid gap-3 rounded-lg bg-brand-50 p-4 text-sm sm:grid-cols-4">
            <div><div className="text-xs text-ink-500">Patient ID</div><div className="font-mono font-semibold text-brand-800">{sel.PatientCode}</div></div>
            <div><div className="text-xs text-ink-500">Name</div><div className="font-medium">{sel.Name}</div></div>
            <div><div className="text-xs text-ink-500">Mobile No</div><div>{sel.MobileNo || '—'}</div></div>
            <div><div className="text-xs text-ink-500">Age</div><div>{sel.Age ?? '—'}</div></div>
          </div>
          <ConfirmForm patient={sel} onDone={() => (canSee(screens, 'confirmList') ? nav('/booking/list') : reset())} />
        </Card>
      ) : rows && (
        <>
          <Table keyField="PatientId" rows={rows} onRowClick={setSel} empty="No matching patient in the Patient List" columns={[
            { label: 'Patient ID', render: (r) => <span className="font-mono text-brand-700">{r.PatientCode}</span> },
            { label: 'Name', key: 'Name' },
            { label: 'Mobile No', key: 'MobileNo' },
            { label: 'Age', key: 'Age' },
            { label: 'Create Date', render: (r) => fDate(r.CreatedAt) },
            { label: '', className: 'text-right', render: () => <span className="text-xs font-medium text-brand-700">Select →</span> },
          ]} />
          {canSee(screens, 'patientRegistration') && (
            <div className="mt-3 text-sm text-ink-500">
              Not in the list?{' '}
              <button className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                onClick={() => nav(`/registration/patient?name=${encodeURIComponent(q.name)}&mobile=${encodeURIComponent(q.mobile)}`)}>
                <UserPlus size={14} /> Register new patient
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
