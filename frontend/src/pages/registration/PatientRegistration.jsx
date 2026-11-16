import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, RotateCcw, CheckCircle2 } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { canSee } from '../../lib/menu';
import { Button, Card, Field, Input, PageHeader, Select, Textarea, useToast } from '../../components/ui';

const blank = { Name: '', MobileNo: '', Age: '', Gender: '', Address: '', Referral: '' };

export default function PatientRegistration() {
  const toast = useToast();
  const nav = useNavigate();
  const { screens } = useAuth();
  const [params] = useSearchParams();
  const [f, setF] = useState(blank);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nextCode, setNextCode] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const loadNext = () => api.get('/patients/next-id').then((r) => setNextCode(r.data.PatientCode)).catch(() => setNextCode(''));

  useEffect(() => {
    const id = params.get('id');
    if (id) api.get(`/patients/${id}`).then((r) => setF(r.data));
    else { setF({ ...blank, Name: params.get('name') || '', MobileNo: params.get('mobile') || '' }); loadNext(); }
  }, [params]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post('/patients', f);
      toast(f.PatientId ? 'Patient updated' : `Patient registered — ${r.data.PatientCode}`);
      setSaved(r.data);
      if (!f.PatientId) { setF(blank); loadNext(); } else setF(r.data);
    } catch (e2) { toast(errMsg(e2), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="w-full">
      <PageHeader title={f.PatientId ? 'Edit Patient' : 'Patient Registration'} subtitle="Patient ID is assigned automatically" />
      {saved && !f.PatientId && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-13 text-emerald-800">
          <CheckCircle2 size={18} />
          <span><b>{saved.Name}</b> registered with Patient ID <b>{saved.PatientCode}</b></span>
          {canSee(screens, 'confirmPatient') && (
            <Button size="sm" className="ml-auto" onClick={() => nav(`/booking/confirm?patientId=${saved.PatientId}`)}>Confirm visit now</Button>
          )}
        </div>
      )}
      <Card>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Patient ID"><Input disabled className="font-mono font-semibold !text-brand-700" value={f.PatientCode || nextCode || 'Auto generated'} /></Field>
          <Field label="Name" required className="sm:col-span-2"><Input autoFocus value={f.Name} onChange={set('Name')} /></Field>
          <Field label="Mobile No"><Input inputMode="numeric" maxLength={10} value={f.MobileNo || ''} onChange={(e) => setF({ ...f, MobileNo: e.target.value.replace(/\D/g, '') })} /></Field>
          <Field label="Age"><Input type="number" min="0" max="120" value={f.Age ?? ''} onChange={set('Age')} /></Field>
          <Field label="Gender">
            <Select value={f.Gender || ''} onChange={set('Gender')}><option value="">—</option><option>Male</option><option>Female</option><option>Other</option></Select>
          </Field>
          <Field label="Referral" className="sm:col-span-2"><Input value={f.Referral || ''} onChange={set('Referral')} placeholder="Referred by (doctor / person / source)" /></Field>
          <Field label="Address" className="sm:col-span-full"><Textarea rows={2} value={f.Address || ''} onChange={set('Address')} /></Field>
          <div className="flex justify-end gap-2 sm:col-span-full">
            <Button type="button" variant="secondary" icon={RotateCcw} onClick={() => (f.PatientId ? nav('/registration/patient') : setF(blank))}>{f.PatientId ? 'New' : 'Clear'}</Button>
            <Button type="submit" icon={Save} loading={busy}>{f.PatientId ? 'Update' : 'Register'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
