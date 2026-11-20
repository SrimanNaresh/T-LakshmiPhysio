import { useEffect, useState } from 'react';
import { Save, Upload, Trash2, ShieldCheck, ShieldAlert, RefreshCw, Unlink } from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fDateTime } from '../../lib/fmt';
import { WhatsAppIcon, WhatsAppLinkPanel, useWhatsAppLink, waNumber } from '../../lib/whatsapp';
import { Button, Card, Field, Input, PageHeader, Textarea, useToast } from '../../components/ui';

// WhatsApp sender: number to send from (clinic's or doctor's) and its link-up. Verified when the phone
// that scans the QR code is this same number.
function WhatsAppSetup({ f, setF, saved }) {
  const toast = useToast();
  const savedNo = waNumber(saved.WhatsAppNo);
  const dirty = waNumber(f.WhatsAppNo) !== savedNo;
  const { st, connect } = useWhatsAppLink(!!savedNo && !dirty);
  const [check, setCheck] = useState(null); // { verified, linked, verifiedAt, problem }
  const [busy, setBusy] = useState(false);

  const verify = async () => {
    try { setCheck((await api.post('/whatsapp/verify')).data); } catch (e) { setCheck({ verified: false, problem: errMsg(e) }); }
  };
  // Check the linked phone against the saved number whenever it (re)connects or the number changes.
  useEffect(() => { if (st?.state === 'ready' && savedNo) verify(); else setCheck(null); }, [st?.state, st?.number, savedNo, saved.WhatsAppVerifiedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlink = async () => {
    if (!window.confirm(`Unlink WhatsApp${st?.number ? ` +${st.number}` : ''} from this app? Messages cannot be sent until a phone is linked again.`)) return;
    setBusy(true);
    try { await api.post('/whatsapp/logout'); setCheck(null); toast('WhatsApp unlinked'); connect(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  const owner = f.WhatsAppOwner || 'Clinic';
  const ready = st?.state === 'ready';

  return (
    <Card className="mt-4">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#25D366]/10 text-[#1DA851]"><WhatsAppIcon size={18} /></span>
        <div>
          <h3 className="text-sm font-bold text-ink-900">WhatsApp</h3>
          <p className="text-12 text-ink-500">Number used to send messages and images to patients</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Number belongs to">
          <div className="inline-flex rounded-lg bg-ink-100 p-0.5" role="radiogroup" aria-label="Number belongs to">
            {['Clinic', 'Doctor'].map((k) => (
              <button key={k} type="button" role="radio" aria-checked={owner === k} onClick={() => setF({ ...f, WhatsAppOwner: k })}
                className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${owner === k ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                {k}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`${owner} WhatsApp Number`} hint="10-digit mobile, or with country code">
          <Input inputMode="tel" placeholder="e.g. 98765 43210" value={f.WhatsAppNo || ''} onChange={(e) => setF({ ...f, WhatsAppNo: e.target.value })} />
        </Field>
      </div>

      <div className="mt-4 space-y-3">
        {!savedNo && !dirty && (
          <p className="rounded-lg border border-dashed border-ink-200 px-3 py-2 text-13 text-ink-500">Enter the WhatsApp number and click Save, then link the phone to verify it.</p>
        )}
        {dirty && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-13 text-amber-800">
            {waNumber(f.WhatsAppNo) ? 'Save to verify this number.' : 'Save to remove the WhatsApp number. Sending will stop until a number is added.'}
          </p>
        )}
        {savedNo && !dirty && (
          <>
            <WhatsAppLinkPanel st={st} connect={connect} />
            {st?.state === 'qr' && <p className="text-12 text-ink-500">Scan with the WhatsApp of <b>+{savedNo}</b>. The scan verifies the number.</p>}
            {ready && check && (check.verified ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-13 text-emerald-800">
                <ShieldCheck size={16} />
                <span className="flex-1"><b>Verified</b> · +{savedNo} is linked{check.verifiedAt ? ` since ${fDateTime(check.verifiedAt)}` : ''}. Staff can send messages and images to patients.</span>
                <Button size="sm" variant="ghost" icon={Unlink} loading={busy} onClick={unlink}>Unlink</Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-13 text-red-700">
                <ShieldAlert size={16} />
                <span className="flex-1"><b>Not verified.</b> {check.problem}</span>
                <Button size="sm" variant="ghost" icon={RefreshCw} onClick={verify}>Check again</Button>
                <Button size="sm" variant="secondary" icon={Unlink} loading={busy} onClick={unlink}>Unlink</Button>
              </div>
            ))}
          </>
        )}
      </div>
    </Card>
  );
}

export default function ClinicMaster() {
  const toast = useToast();
  const { refreshClinic } = useAuth();
  const [f, setF] = useState({});
  const [saved, setSaved] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = () => api.get('/clinic').then((r) => { setF(r.data); setSaved(r.data); });
  useEffect(() => { load(); }, []);

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
    try { await api.put('/clinic', f); toast('Clinic details saved'); refreshClinic(); await load(); } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
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
      </Card>
      <WhatsAppSetup f={f} setF={setF} saved={saved} />
      <div className="mt-5 flex justify-end"><Button icon={Save} loading={busy} onClick={save}>Save</Button></div>
    </div>
  );
}
