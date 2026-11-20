import { useEffect, useState } from 'react';
import { Dumbbell, Zap, ImageOff, MapPin, PenLine, Plus, Pencil, Check, X, CheckSquare, Loader2 } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import { WhatsAppIcon, WhatsAppLinkPanel, useWhatsAppLink, waNumber } from '../lib/whatsapp';
import { Button, Modal, Select, Spinner, Textarea, useToast } from './ui';
import ImageAnnotator from './ImageAnnotator';
import { EditDialog } from '../pages/examine/MasterDetails';

// Build the WhatsApp text for the picked exercises / modalities, grouped by title, with this patient's
// points and common note on each image.
function buildMessage({ patientName, clinicName, picked, markOf }) {
  const groups = {};
  picked.forEach((p) => { (groups[p.title] = groups[p.title] || []).push(p); });
  const lines = [`Hello ${patientName || ''}, here are your exercises from ${clinicName}:`.replace(/\s+,/, ',')];
  Object.entries(groups).forEach(([title, list]) => {
    lines.push('', `*${title}*`);
    list.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.sub}`);
      const m = markOf('sub', p.id);
      m?.Pins?.filter((x) => x.text?.trim()).forEach((x) => lines.push(`   • Point ${x.n}: ${x.text.trim()}`));
      if (m?.CommonNote?.trim()) lines.push(`   Note: ${m.CommonNote.trim()}`);
    });
  });
  lines.push('', 'Please do them as advised. Contact us if you feel any pain or discomfort. Thank you.');
  return lines.join('\n');
}

// Preview / edit the message, then the server sends the text and the picked images to the patient's
// WhatsApp in one click (needs the clinic phone linked once by QR code).
function SendDialog({ open, onClose, patientId, mobileNo, patientName, initialText, picked, onSent }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { st, connect } = useWhatsAppLink(open);
  useEffect(() => { if (open) setText(initialText); }, [open, initialText]);
  const number = waNumber(mobileNo);
  const withImages = picked.filter((p) => p.image);
  const ready = st?.state === 'ready';
  const okNumber = number.length >= 11;

  const send = async () => {
    setBusy(true);
    try {
      const r = await api.post('/whatsapp/send-exercises', { PatientId: patientId, SubTitleIds: picked.map((p) => p.id), Text: text });
      toast(`Sent to ${patientName || 'patient'} on WhatsApp (${r.data.images} image${r.data.images === 1 ? '' : 's'} + message)`);
      onSent();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} title={`Send to ${patientName || 'patient'} on WhatsApp`} onClose={onClose} width="max-w-xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-13">
          <span className="text-ink-500">WhatsApp number:</span>
          {okNumber
            ? <span className="font-mono font-semibold text-ink-800">+{number}</span>
            : <span className="font-semibold text-red-600">No valid mobile number for this patient</span>}
          <span className="ml-auto text-ink-400">{picked.length} selected · {withImages.length} image{withImages.length === 1 ? '' : 's'}</span>
        </div>
        <WhatsAppLinkPanel st={st} connect={connect} />
        {ready && (
          <p className="flex items-center gap-1.5 text-12 text-[#1DA851]">
            <span className="h-2 w-2 rounded-full bg-[#25D366]" /> WhatsApp connected{st.number ? ` (+${st.number})` : ''}
          </p>
        )}
        <div>
          <label htmlFor="wa-text" className="label">Message</label>
          <Textarea id="wa-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} className="font-mono !text-13" />
        </div>
        {withImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {withImages.map((p, i) => (
              <figure key={p.id} className="w-20 shrink-0">
                <img src={p.image} alt="" className="h-16 w-20 rounded border border-ink-100 bg-ink-50 object-contain" />
                <figcaption className="truncate text-10 text-ink-500" title={p.sub}>{i + 1}. {p.sub}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <button type="button" onClick={send} disabled={!ready || !okNumber || busy || (!text.trim() && !withImages.length)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5b] disabled:cursor-not-allowed disabled:bg-ink-300">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <WhatsAppIcon size={16} />} {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
    </Modal>
  );
}

const EXAMPLES = {
  Exercise: { title: 'e.g. Knee strengthening', sub: 'e.g. Straight leg raise' },
  Modality: { title: 'e.g. IFT, Ultrasound, TENS', sub: 'e.g. Knee placement' },
};

const TYPES = [
  { key: 'Exercise', icon: Dumbbell },
  { key: 'Modality', icon: Zap },
];

// Little badge showing how many points / notes this patient has on an image.
function NoteBadge({ mark }) {
  if (!mark) return null;
  const n = mark.Pins.length;
  return (
    <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-10 font-bold text-white shadow">
      {n ? <><MapPin size={10} /> {n}</> : <PenLine size={10} />}
    </span>
  );
}

// Examine tab: pick Exercise or Modality, then a title from Master Details, and see its sub titles
// with their images. Clicking an image opens it to add numbered points and notes for this patient.
export default function MasterDetailViewer({ patientId, patientName, mobileNo }) {
  const toast = useToast();
  const { clinic } = useAuth();
  // Sub titles ticked to send on WhatsApp, kept across titles and Exercise / Modality: { [subId]: { id, title, sub, image } }
  const [picked, setPicked] = useState({});
  const [sending, setSending] = useState(false);
  const pickedList = Object.values(picked);
  const togglePick = (t, s) => setPicked((cur) => {
    const next = { ...cur };
    if (next[s.MasterSubTitleId]) delete next[s.MasterSubTitleId];
    else next[s.MasterSubTitleId] = { id: s.MasterSubTitleId, title: t.Title, sub: s.SubTitle, image: s.Image };
    return next;
  });
  const [type, setType] = useState('Exercise');
  const [data, setData] = useState({}); // { Exercise: [...titles], Modality: [...] }
  const [titleId, setTitleId] = useState({ Exercise: '', Modality: '' });
  const [marks, setMarks] = useState([]);
  const [open, setOpen] = useState(null); // { refType, refId, image, title }
  const [dialog, setDialog] = useState(null); // { kind: 'title' | 'sub', item? } — add/edit Master Details from here

  const load = (cat = type) => api.get('/master-details', { params: { category: cat } })
    .then((r) => { setData((d) => ({ ...d, [cat]: r.data })); return r.data; });

  useEffect(() => {
    if (data[type]) return;
    load(type).catch((e) => { toast(errMsg(e), 'error'); setData((d) => ({ ...d, [type]: [] })); });
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!patientId) return;
    api.get('/patient-image-marks', { params: { patientId } }).then((r) => setMarks(r.data)).catch(() => {});
  }, [patientId]);

  const titles = data[type];
  const sel = titles?.find((t) => String(t.MasterTitleId) === String(titleId[type])) || null;
  const markOf = (refType, refId) => marks.find((m) => m.RefType === refType && m.RefId === refId) || null;
  const openMark = open ? markOf(open.refType, open.refId) : null;
  const onSaved = (m) => {
    setMarks((cur) => {
      const rest = cur.filter((x) => !(x.RefType === open.refType && x.RefId === open.refId));
      return m ? [...rest, m] : rest;
    });
    if (!m) setOpen(null);
  };
  // For this patient: images that have points come first, in the order they were first marked
  // (oldest first); the rest follow in their normal master order.
  const orderSubs = (subs) => subs
    .map((s, i) => ({ s, i, m: markOf('sub', s.MasterSubTitleId) }))
    .sort((a, b) => {
      if (!!a.m !== !!b.m) return a.m ? -1 : 1;
      if (a.m) return new Date(a.m.CreatedAt) - new Date(b.m.CreatedAt) || a.m.MarkId - b.m.MarkId;
      return a.i - b.i;
    })
    .map((x) => x.s);
  // Add or edit a title / sub title straight from the Examine tab (same API as the Master Details page).
  const saveTitle = async (name, img) => {
    const id = dialog.item?.MasterTitleId;
    try {
      const r = await api.post('/master-details', { MasterTitleId: id, Category: type, Title: name, Image: img });
      toast(id ? `${name} updated` : `${type} "${name}" added`);
      setDialog(null);
      await load();
      setTitleId((s) => ({ ...s, [type]: String(r.data.MasterTitleId) }));
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  const saveSub = async (name, img) => {
    try {
      await api.post(`/master-details/${sel.MasterTitleId}/subs`, { SubTitle: name, Image: img });
      toast(`Sub title added to ${sel.Title}`);
      setDialog(null);
      await load();
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  const countIn = (t) => [markOf('title', t.MasterTitleId), ...t.subs.map((s) => markOf('sub', s.MasterSubTitleId))].filter(Boolean).length;

  return (
    <div>
      <div className="grid items-end gap-x-4 gap-y-3 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div>
          <span className="label">Type</span>
          <div className="inline-flex rounded-lg bg-ink-100 p-0.5" role="radiogroup" aria-label="Type">
            {TYPES.map(({ key, icon: I }) => (
              <button key={key} type="button" role="radio" aria-checked={type === key} onClick={() => setType(key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-semibold transition-colors ${type === key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                <I size={14} /> {key}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="label">{type} Title</span>
          <Select value={titleId[type]} disabled={!titles} onChange={(e) => setTitleId({ ...titleId, [type]: e.target.value })}>
            <option value="">{!titles ? 'Loading…' : titles.length ? `Select ${type.toLowerCase()} title…` : `No ${type.toLowerCase()} titles in Master Details`}</option>
            {titles?.map((t) => {
              const n = countIn(t);
              return <option key={t.MasterTitleId} value={t.MasterTitleId}>{t.Title} ({t.subs.length}){n ? ` · notes on ${n}` : ''}</option>;
            })}
          </Select>
        </label>
        <Button size="sm" icon={Plus} disabled={!titles} onClick={() => setDialog({ kind: 'title' })}>New {type}</Button>
      </div>

      <div className="mt-3">
        {!titles ? <Spinner />
          : !sel ? (
            <div className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center text-13 text-ink-400">
              {titles.length ? `Select a ${type.toLowerCase()} title to see its sub titles and images.` : `No ${type.toLowerCase()} titles yet — use New ${type} to add one.`}
            </div>
          ) : (
            <div className="rounded-lg border border-ink-200">
              <div className="flex items-center gap-3 border-b border-ink-100 bg-ink-50/60 px-3 py-2">
                <button type="button" disabled={!sel.Image} title={sel.Image ? 'Open to add points and notes' : undefined}
                  onClick={() => setOpen({ refType: 'title', refId: sel.MasterTitleId, image: sel.Image, title: sel.Title })}
                  className={`relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-white ring-1 ring-ink-100 ${sel.Image ? 'cursor-pointer hover:ring-brand-300' : 'cursor-default'}`}>
                  {sel.Image ? <img src={sel.Image} alt="" className="h-full w-full object-cover" /> : <ImageOff size={15} className="text-ink-300" />}
                  {markOf('title', sel.MasterTitleId) && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-900">{sel.Title}</p>
                  <p className="text-11 text-ink-400">{type} · {sel.subs.length} sub title{sel.subs.length === 1 ? '' : 's'}</p>
                </div>
                <span className="hidden text-11 text-ink-400 xl:block">Click an image to add points &amp; notes for this patient</span>
                <div className="flex items-center gap-1">
                  {sel.subs.length > 0 && (() => {
                    const all = sel.subs.every((s) => picked[s.MasterSubTitleId]);
                    return (
                      <Button size="sm" variant="ghost" icon={CheckSquare} title={all ? 'Unselect all' : 'Select all to send'}
                        onClick={() => setPicked((cur) => {
                          const next = { ...cur };
                          sel.subs.forEach((s) => {
                            if (all) delete next[s.MasterSubTitleId];
                            else next[s.MasterSubTitleId] = { id: s.MasterSubTitleId, title: sel.Title, sub: s.SubTitle, image: s.Image };
                          });
                          return next;
                        })}>{all ? 'Unselect all' : 'Select all'}</Button>
                    );
                  })()}
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => setDialog({ kind: 'sub' })}>Sub Title</Button>
                  <Button size="sm" variant="ghost" icon={Pencil} title="Edit title" onClick={() => setDialog({ kind: 'title', item: sel })} />
                </div>
              </div>
              {sel.subs.length === 0 ? (
                <button type="button" onClick={() => setDialog({ kind: 'sub' })}
                  className="m-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-lg border border-dashed border-ink-200 py-3 text-13 text-ink-400 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700">
                  <Plus size={14} /> Add the first sub title to {sel.Title}
                </button>
              ) : (
                <div className="flex snap-x gap-2.5 overflow-x-auto p-3">
                  {orderSubs(sel.subs).map((s) => {
                    const m = markOf('sub', s.MasterSubTitleId);
                    const on = !!picked[s.MasterSubTitleId];
                    return (
                      <div key={s.MasterSubTitleId} className="relative w-40 shrink-0 snap-start">
                      {/* Tick box: pick this one to send on WhatsApp (separate from opening the image). */}
                      <button type="button" role="checkbox" aria-checked={on} aria-label={`Select ${s.SubTitle} to send`} title={on ? 'Selected to send' : 'Select to send'}
                        onClick={() => togglePick(sel, s)}
                        className={`absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-md border-2 shadow-sm transition-colors ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300 bg-white/95 text-transparent hover:border-brand-500'}`}>
                        <Check size={14} strokeWidth={3} />
                      </button>
                      <button type="button" disabled={!s.Image}
                        onClick={() => setOpen({ refType: 'sub', refId: s.MasterSubTitleId, image: s.Image, title: `${sel.Title} › ${s.SubTitle}` })}
                        className={`group flex h-full w-full flex-col overflow-hidden rounded-lg border bg-white text-left transition-shadow hover:shadow-md ${on ? 'border-brand-500 ring-2 ring-brand-200' : m ? 'border-red-200' : 'border-ink-100 hover:border-brand-200'} ${s.Image ? 'cursor-pointer' : 'cursor-default'}`}>
                        <span className="relative block h-28 w-full bg-ink-50">
                          {s.Image ? (
                            <>
                              <img src={s.Image} alt={s.SubTitle} className="absolute inset-0 h-full w-full object-contain p-1" />
                              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-brand-600/90 py-0.5 text-10 font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                                <MapPin size={10} /> {m ? 'Edit points' : 'Add points'}
                              </span>
                            </>
                          ) : <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-ink-300"><ImageOff size={18} /><span className="text-10">No image</span></span>}
                          <NoteBadge mark={m} />
                        </span>
                        <span className="line-clamp-2 break-words border-t border-ink-100 px-2 py-1.5 text-12 font-semibold leading-snug text-ink-800" title={s.SubTitle}>{s.SubTitle}</span>
                      </button>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => setDialog({ kind: 'sub' })}
                    className="flex w-28 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-200 text-12 font-semibold text-ink-400 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700">
                    <Plus size={16} /> Add
                  </button>
                </div>
              )}
            </div>
          )}
      </div>

      {/* Selection bar: what is ticked (any title) and the WhatsApp send. */}
      <div className={`mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${pickedList.length ? 'border-brand-200 bg-brand-50/60' : 'border-dashed border-ink-200'}`}>
        {pickedList.length === 0 ? (
          <span className="text-13 text-ink-400">Tick the exercises / modalities to send them to the patient on WhatsApp.</span>
        ) : (
          <>
            <span className="text-13 font-semibold text-ink-700">{pickedList.length} selected:</span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1">
              {pickedList.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-12 text-ink-700 ring-1 ring-brand-200">
                  <span className="max-w-[180px] truncate" title={`${p.title} › ${p.sub}`}>{p.sub}</span>
                  <button type="button" aria-label={`Remove ${p.sub}`} className="text-ink-400 hover:text-red-600"
                    onClick={() => setPicked((cur) => { const n = { ...cur }; delete n[p.id]; return n; })}><X size={12} /></button>
                </span>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setPicked({})}>Clear</Button>
          </>
        )}
        <button type="button" disabled={!pickedList.length} onClick={() => setSending(true)}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white ${pickedList.length ? 'bg-[#25D366] hover:bg-[#1ebe5b]' : 'cursor-not-allowed bg-ink-300'}`}>
          <WhatsAppIcon size={15} /> Send on WhatsApp
        </button>
      </div>

      <SendDialog open={sending} onClose={() => setSending(false)} patientId={patientId} mobileNo={mobileNo} patientName={patientName}
        picked={pickedList}
        initialText={sending ? buildMessage({ patientName, clinicName: clinic?.ClinicName || 'Lakshmi Physiotherapy', picked: pickedList, markOf }) : ''}
        onSent={() => { setSending(false); setPicked({}); }} />

      <ImageAnnotator open={!!open} onClose={() => setOpen(null)} image={open?.image} title={open?.title}
        patientId={patientId} refType={open?.refType} refId={open?.refId} mark={openMark} onSaved={onSaved} />
      <EditDialog
        open={dialog?.kind === 'title'}
        heading={dialog?.item ? `Edit ${type}` : `New ${type}`}
        label="Title" placeholder={EXAMPLES[type].title}
        initial={dialog?.kind === 'title' && dialog.item ? { id: dialog.item.MasterTitleId, name: dialog.item.Title, image: dialog.item.Image } : null}
        onSave={saveTitle} onClose={() => setDialog(null)} />
      <EditDialog
        open={dialog?.kind === 'sub' && !!sel}
        heading={`Add Sub Title · ${sel?.Title || ''}`}
        label="Sub Title" placeholder={EXAMPLES[type].sub}
        initial={null}
        onSave={saveSub} onClose={() => setDialog(null)} />
    </div>
  );
}
