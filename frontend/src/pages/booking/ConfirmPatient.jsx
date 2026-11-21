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
    // form-compact: smaller text throughout this screen, same as the Patient Assessment form.
    <div className="form-compact w-full">
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
          {/* Patient details in one compact line (label: value), wrapping only on narrow screens. */}
          <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg bg-brand-50 px-4 py-1.5 text-sm leading-tight">
            <span><span className="text-xs text-ink-500">Patient ID: </span><span className="font-mono font-semibold text-brand-800">{sel.PatientCode}</span></span>
            <span><span className="text-xs text-ink-500">Name: </span><span className="font-medium">{sel.Name}</span></span>
            <span><span className="text-xs text-ink-500">Mobile No: </span>{sel.MobileNo || '—'}</span>
            <span><span className="text-xs text-ink-500">Age: </span>{sel.Age ?? '—'}</span>
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
            <div className="mt-3 flex items-center gap-3 text-sm text-ink-500">
              Not in the list?
              {/* No match → primary call to action; otherwise a quieter secondary button. */}
              <Button icon={UserPlus} variant={rows.length === 0 ? 'primary' : 'secondary'}
                onClick={() => nav(`/registration/patient?name=${encodeURIComponent(q.name)}&mobile=${encodeURIComponent(q.mobile)}`)}>
                Register new patient
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
