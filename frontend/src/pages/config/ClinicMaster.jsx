import { useEffect, useState } from 'react';
import { Save, Upload, Trash2 } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Card, Field, Input, PageHeader, Textarea, useToast } from '../../components/ui';

export default function ClinicMaster() {
  const toast = useToast();
  const { refreshClinic } = useAuth();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { api.get('/clinic').then((r) => setF(r.data)); }, []);

  const onLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) return toast('Logo must be under 1 MB', 'error');
    const rd = new FileReader();
    rd.onload = () => setF((s) => ({ ...s, Logo: rd.result }));
    rd.readAsDataURL(file);
  };

  const save = async () => {
    setBusy(true);
    try { await api.put('/clinic', f); toast('Clinic details saved'); refreshClinic(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="w-full">
      <PageHeader title="Clinic Master" subtitle="Shown on the login page, sidebar and printed bills" />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Clinic Name" required><Input value={f.ClinicName || ''} onChange={set('ClinicName')} /></Field>
          <Field label="Doctor Name"><Input value={f.DoctorName || ''} onChange={set('DoctorName')} /></Field>
          <Field label="Email ID"><Input type="email" value={f.EmailId || ''} onChange={set('EmailId')} /></Field>
          <Field label="Contact No"><Input value={f.ContactNo || ''} onChange={set('ContactNo')} /></Field>
          <Field label="App Name"><Input value={f.AppName || ''} onChange={set('AppName')} /></Field>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg border border-dashed border-ink-300 bg-ink-50">
                {f.Logo ? <img src={f.Logo} alt="logo" className="h-full w-full object-contain" /> : <span className="text-xs text-ink-400">No logo</span>}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-2 text-sm hover:bg-ink-50"><Upload size={15} /> Upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
              </label>
              {f.Logo && <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setF({ ...f, Logo: null })}>Remove</Button>}
            </div>
          </Field>
          <Field label="Address" className="sm:col-span-full"><Textarea rows={3} value={f.Address || ''} onChange={set('Address')} /></Field>
        </div>
        <div className="mt-5 flex justify-end"><Button icon={Save} loading={busy} onClick={save}>Save</Button></div>
      </Card>
    </div>
  );
}
