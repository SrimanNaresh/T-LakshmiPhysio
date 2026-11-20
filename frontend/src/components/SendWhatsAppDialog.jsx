import { useEffect, useState } from 'react';
import { Paperclip, X, FileText, Loader2 } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { WhatsAppIcon, WhatsAppLinkPanel, useWhatsAppLink, waNumber } from '../lib/whatsapp';
import { Button, Modal, Textarea, useToast } from './ui';

const MAX_FILES = 10;
const MAX_FILE = 10 * 1024 * 1024;
const MAX_TOTAL = 15 * 1024 * 1024;
const OK_TYPE = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/;

const readDataUrl = (file) => new Promise((res, rej) => {
  const rd = new FileReader();
  rd.onload = () => res(rd.result);
  rd.onerror = () => rej(rd.error);
  rd.readAsDataURL(file);
});
const dataUrlSize = (u) => Math.floor(((u.length - u.indexOf(',') - 1) * 3) / 4);

// Phone photos are often several MB: shrink big JPEG / PNG / WebP to 2000 px JPEG before sending.
async function shrink(dataUrl, type) {
  if (!/^image\/(jpeg|png|webp)$/.test(type) || dataUrlSize(dataUrl) < 1.5 * 1024 * 1024) return dataUrl;
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const k = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  const out = c.toDataURL('image/jpeg', 0.85);
  return out.length < dataUrl.length ? out : dataUrl;
}

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Free WhatsApp message to one patient: text plus image / PDF files, sent from the verified
// clinic / doctor number linked in Clinic Master.
export default function SendWhatsAppDialog({ open, onClose, patient }) {
  const toast = useToast();
  const { clinic } = useAuth();
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]); // { name, type, dataUrl, size }
  const [busy, setBusy] = useState(false);
  const [check, setCheck] = useState(null);
  const { st, connect } = useWhatsAppLink(open);
  const number = waNumber(patient?.MobileNo);
  const okNumber = number.length >= 11;

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setText(`Hello ${patient?.Name || ''},\n\n\n— ${clinic?.ClinicName || 'Lakshmi Physiotherapy'}`.replace(/ ,/, ','));
  }, [open, patient?.PatientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same sender check as the server: the linked phone must be the verified Clinic Master number.
  useEffect(() => {
    if (!open || st?.state !== 'ready') { setCheck(null); return; }
    api.post('/whatsapp/verify').then((r) => setCheck(r.data)).catch((e) => setCheck({ verified: false, problem: errMsg(e) }));
  }, [open, st?.state, st?.number]);

  const addFiles = async (e) => {
    const list = [...(e.target.files || [])];
    e.target.value = '';
    const next = [...files];
    for (const f of list) {
      if (next.length >= MAX_FILES) { toast(`At most ${MAX_FILES} files`, 'error'); break; }
      if (!OK_TYPE.test(f.type)) { toast(`${f.name}: only images (JPG, PNG, WebP, GIF) and PDF`, 'error'); continue; }
      try {
        const dataUrl = await shrink(await readDataUrl(f), f.type);
        const size = dataUrlSize(dataUrl);
        if (size > MAX_FILE) { toast(`${f.name} is larger than 10 MB`, 'error'); continue; }
        next.push({ name: f.name, type: dataUrl.slice(5, dataUrl.indexOf(';')), dataUrl, size });
      } catch { toast(`Could not read ${f.name}`, 'error'); }
    }
    setFiles(next);
  };

  const total = files.reduce((s, f) => s + f.size, 0);
  const ready = st?.state === 'ready';
  const canSend = ready && check?.verified && okNumber && !busy && (text.trim() || files.length) && total <= MAX_TOTAL;

  const send = async () => {
    setBusy(true);
    try {
      const r = await api.post('/whatsapp/send', { PatientId: patient.PatientId, Text: text, Files: files.map(({ name, dataUrl }) => ({ name, dataUrl })) });
      toast(`Sent to ${patient.Name || 'patient'} on WhatsApp${r.data.files ? ` (${r.data.files} file${r.data.files === 1 ? '' : 's'})` : ''}`);
      onClose();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} title={`WhatsApp · ${patient?.Name || 'Patient'}`} onClose={onClose} width="max-w-xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-13">
          <span className="text-ink-500">To:</span>
          {okNumber
            ? <span className="font-mono font-semibold text-ink-800">+{number}</span>
            : <span className="font-semibold text-red-600">No valid mobile number for this patient</span>}
          {ready && check?.verified && <span className="ml-auto flex items-center gap-1.5 text-12 text-[#1DA851]"><span className="h-2 w-2 rounded-full bg-[#25D366]" /> From +{check.linked}</span>}
        </div>
        <WhatsAppLinkPanel st={st} connect={connect} />
        {ready && check && !check.verified && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-13 text-red-700">{check.problem}</p>
        )}
        <div>
          <label htmlFor="wa-free-text" className="label">Message</label>
          <Textarea id="wa-free-text" rows={7} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="label !mb-0">Attachments</span>
            <span className={`text-11 ${total > MAX_TOTAL ? 'font-semibold text-red-600' : 'text-ink-400'}`}>{files.length}/{MAX_FILES} · {kb(total)} of 15 MB</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <figure key={`${f.name}-${i}`} className="relative w-24">
                <div className="grid h-20 w-24 place-items-center overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
                  {f.type.startsWith('image/') ? <img src={f.dataUrl} alt="" className="h-full w-full object-cover" /> : <FileText size={26} className="text-red-500" />}
                </div>
                <figcaption className="truncate text-10 text-ink-500" title={f.name}>{f.name} · {kb(f.size)}</figcaption>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink-800 text-white shadow hover:bg-red-600"><X size={12} /></button>
              </figure>
            ))}
            {files.length < MAX_FILES && (
              <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-300 text-12 font-semibold text-ink-500 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700">
                <Paperclip size={16} /> Add file
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="hidden" onChange={addFiles} />
              </label>
            )}
          </div>
          <p className="mt-1 text-11 text-ink-400">Images or PDF. Large photos are reduced before sending.</p>
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <button type="button" onClick={send} disabled={!canSend}
          className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5b] disabled:cursor-not-allowed disabled:bg-ink-300">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <WhatsAppIcon size={16} />} {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </Modal>
  );
}
