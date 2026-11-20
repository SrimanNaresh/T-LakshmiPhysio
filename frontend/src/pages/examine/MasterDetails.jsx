import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Save, Pencil, Trash2, Plus, ImageOff, Search, X, Dumbbell, Zap, ImagePlus, AlertTriangle,
} from 'lucide-react';
import api, { errMsg } from '../../lib/api';
import { Button, EmptyState, Field, Input, Modal, PageHeader, Spinner, useToast } from '../../components/ui';

const CATEGORIES = [
  { key: 'Exercise', plural: 'Exercises', icon: Dumbbell, example: 'e.g. Knee strengthening', subExample: 'e.g. Straight leg raise' },
  { key: 'Modality', plural: 'Modalities', icon: Zap, example: 'e.g. IFT, Ultrasound, TENS', subExample: 'e.g. Knee placement' },
];

// Read a picked file, scale it down to at most 1200px and return a JPEG data URL (keeps the DB small).
function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file (JPG, PNG, WEBP)'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('Image must be under 15 MB'));
    const rd = new FileReader();
    rd.onerror = () => reject(new Error('Could not read the image'));
    rd.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read the image'));
      img.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

/* ---------- Image drop zone (click or drag & drop) ---------- */
function ImageDrop({ value, onChange }) {
  const toast = useToast();
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const take = async (file) => {
    if (!file) return;
    try { onChange(await readImage(file)); } catch (err) { toast(err.message, 'error'); }
  };
  const drop = {
    onDragOver: (e) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]); },
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      {value ? (
        <div {...drop} className={`group relative overflow-hidden rounded-xl border bg-ink-50 ${over ? 'border-violet-400 ring-4 ring-violet-100' : 'border-ink-200'}`}>
          <img src={value} alt="" className="mx-auto h-52 w-full object-contain" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-ink-900/60 to-transparent p-2.5">
            <button type="button" onClick={() => ref.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-13 font-semibold text-ink-700 shadow-sm hover:bg-white">
              <ImagePlus size={14} /> Replace
            </button>
            <button type="button" onClick={() => onChange(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-13 font-semibold text-red-600 shadow-sm hover:bg-white">
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" {...drop} onClick={() => ref.current?.click()}
          className={`flex h-52 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${over ? 'border-violet-400 bg-violet-50' : 'border-ink-200 bg-ink-50/60 hover:border-violet-300 hover:bg-violet-50/40'}`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-violet-600 shadow-sm ring-1 ring-ink-100"><ImagePlus size={20} /></span>
          <span className="text-sm font-semibold text-ink-700">Click to upload <span className="font-normal text-ink-400">or drag and drop</span></span>
          <span className="text-12 text-ink-400">JPG, PNG or WEBP · optional</span>
        </button>
      )}
    </div>
  );
}

/* ---------- Add / edit dialog (used for both titles and sub titles) ---------- */
export function EditDialog({ open, heading, label, placeholder, initial, onSave, onClose }) {
  const [name, setName] = useState('');
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(initial?.name || ''); setImg(initial?.image || null); } }, [open, initial]);
  const save = async () => {
    setBusy(true);
    try { await onSave(name, img); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title={heading} onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <Field label={label} required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder}
            onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <div>
          <span className="label">Image</span>
          <ImageDrop value={img} onChange={setImg} />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button icon={Save} loading={busy} disabled={!name.trim()} onClick={save}>{initial?.id ? 'Save changes' : 'Add'}</Button>
      </div>
    </Modal>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } };
  return (
    <Modal open={open} title={title} onClose={onClose} width="max-w-md">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={20} /></span>
        <p className="pt-2 text-sm text-ink-600">{message}</p>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" icon={Trash2} loading={busy} onClick={go}>Delete</Button>
      </div>
    </Modal>
  );
}

function Thumb({ src, className = 'h-11 w-11' }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-lg bg-ink-50 ring-1 ring-ink-100 ${className}`}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <ImageOff size={16} className="text-ink-300" />}
    </span>
  );
}

// Compact sub title tile: small image with hover actions, name underneath.
function SubCard({ s, onOpen, onEdit, onDelete }) {
  return (
    <div className="group relative flex w-36 shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-ink-100 bg-white transition-shadow hover:border-violet-200 hover:shadow-md">
      <button type="button" disabled={!s.Image} onClick={onOpen}
        className={`relative h-24 w-full bg-ink-50 ${s.Image ? 'cursor-zoom-in' : 'cursor-default'}`}>
        {s.Image
          ? <img src={s.Image} alt={s.SubTitle} className="absolute inset-0 h-full w-full object-contain p-1" />
          : <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-ink-300"><ImageOff size={18} /><span className="text-10">No image</span></span>}
      </button>
      <div className="absolute right-1 top-1 flex gap-0.5 rounded-md bg-white/95 p-0.5 shadow-sm ring-1 ring-ink-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <button type="button" title="Edit" onClick={onEdit} className="rounded p-1 text-ink-500 hover:bg-ink-100 hover:text-violet-700"><Pencil size={12} /></button>
        <button type="button" title="Delete" onClick={onDelete} className="rounded p-1 text-ink-500 hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>
      </div>
      <p className="line-clamp-2 break-words border-t border-ink-100 px-2 py-1.5 text-12 font-semibold leading-snug text-ink-800" title={s.SubTitle}>{s.SubTitle}</p>
    </div>
  );
}

export default function MasterDetails() {
  const toast = useToast();
  const [cat, setCat] = useState('Exercise');
  const C = CATEGORIES.find((c) => c.key === cat);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind: 'title' | 'sub', title?, item? }
  const [confirmDel, setConfirmDel] = useState(null); // { kind, item }
  const [preview, setPreview] = useState(null);
  const groupRefs = useRef({});

  const load = async (c = cat) => {
    try {
      const r = await api.get('/master-details', { params: { category: c } });
      setRows(r.data);
      setCounts((s) => ({ ...s, [c]: r.data.length }));
    } catch (e) { toast(errMsg(e), 'error'); } finally { setLoading(false); }
  };
  useEffect(() => {
    setLoading(true); setRows([]); setQ(''); setSelId(null);
    load(cat);
    const other = CATEGORIES.find((c) => c.key !== cat).key;
    api.get('/master-details', { params: { category: other } }).then((r) => setCounts((s) => ({ ...s, [other]: r.data.length }))).catch(() => {});
  }, [cat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search keeps a title when its name matches (all its sub titles) or only the matching sub titles.
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.flatMap((r) => {
      if (r.Title.toLowerCase().includes(t)) return [r];
      const subs = r.subs.filter((s) => s.SubTitle.toLowerCase().includes(t));
      return subs.length ? [{ ...r, subs }] : [];
    });
  }, [rows, q]);

  const jump = (id) => {
    setSelId(id);
    groupRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saveTitle = async (name, img) => {
    const id = dialog.item?.MasterTitleId;
    try {
      const r = await api.post('/master-details', { MasterTitleId: id, Category: cat, Title: name, Image: img });
      toast(id ? `${name} updated` : `${C.key} "${name}" added`);
      setDialog(null);
      await load();
      setSelId(r.data.MasterTitleId);
      setTimeout(() => groupRefs.current[r.data.MasterTitleId]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  const saveSub = async (name, img) => {
    const id = dialog.item?.MasterSubTitleId;
    const t = dialog.title;
    try {
      await api.post(`/master-details/${t.MasterTitleId}/subs`, { MasterSubTitleId: id, SubTitle: name, Image: img });
      toast(id ? 'Sub title updated' : `Sub title added to ${t.Title}`);
      setDialog(null);
      load();
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  const doDelete = async () => {
    const { kind, item } = confirmDel;
    try {
      if (kind === 'title') await api.delete(`/master-details/${item.MasterTitleId}`);
      else await api.delete(`/master-details/subs/${item.MasterSubTitleId}`);
      toast(`${kind === 'title' ? item.Title : item.SubTitle} deleted`);
      setConfirmDel(null);
      load();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  const tabs = (
    <div className="inline-flex rounded-xl bg-ink-100 p-1">
      {CATEGORIES.map(({ key, icon: I }) => (
        <button key={key} type="button" onClick={() => setCat(key)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all ${cat === key ? 'bg-white text-violet-700 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
          <I size={15} /> {key}
          {counts[key] != null && (
            <span className={`rounded-full px-1.5 text-11 font-bold ${cat === key ? 'bg-violet-100 text-violet-700' : 'bg-ink-200 text-ink-500'}`}>{counts[key]}</span>
          )}
        </button>
      ))}
    </div>
  );

  const search = (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or sub title" className="!pl-9 !pr-8" />
      {q && <button type="button" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-600"><X size={14} /></button>}
    </div>
  );
  const newBtn = <Button size="sm" icon={Plus} onClick={() => setDialog({ kind: 'title' })}>New {C.key}</Button>;
  const subTotal = rows.reduce((n, r) => n + r.subs.length, 0);

  return (
    <div className="w-full">
      <PageHeader title="Master Details" subtitle="Exercise and modality titles with their sub titles and reference images" actions={tabs} />

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ---------- Left: title index (desktop) ---------- */}
        <aside className="card-flush hidden flex-col lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-10rem)]">
          <div className="space-y-3 border-b border-ink-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-ink-800">{C.plural} <span className="font-medium text-ink-400">({rows.length})</span></h2>
              {newBtn}
            </div>
            {search}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading ? <Spinner />
              : shown.length === 0 ? <p className="px-3 py-6 text-center text-13 text-ink-400">{q ? 'Nothing matches your search.' : `No ${C.plural.toLowerCase()} yet.`}</p>
                : shown.map((r) => {
                  const on = r.MasterTitleId === selId;
                  return (
                    <button key={r.MasterTitleId} type="button" onClick={() => jump(r.MasterTitleId)}
                      className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${on ? 'bg-violet-50 ring-1 ring-violet-200' : 'hover:bg-ink-50'}`}>
                      <Thumb src={r.Image} className="h-8 w-8" />
                      <span className={`min-w-0 flex-1 truncate text-13 font-semibold ${on ? 'text-violet-800' : 'text-ink-700'}`}>{r.Title}</span>
                      <span className={`rounded-full px-1.5 text-11 font-bold ${on ? 'bg-violet-100 text-violet-700' : 'bg-ink-100 text-ink-500'}`}>{r.subs.length}</span>
                    </button>
                  );
                })}
          </div>
        </aside>

        {/* ---------- Right: every title with its sub titles, grouped ---------- */}
        <section className="min-w-0 space-y-3">
          <div className="card flex flex-col gap-2 !py-3 sm:flex-row sm:items-center lg:hidden">
            <div className="flex-1">{search}</div>
            {newBtn}
          </div>
          <p className="hidden px-1 text-12 text-ink-400 lg:block">
            {rows.length} {rows.length === 1 ? C.key.toLowerCase() : C.plural.toLowerCase()} · {subTotal} sub title{subTotal === 1 ? '' : 's'}
          </p>

          {loading ? <div className="card"><Spinner /></div>
            : shown.length === 0 ? (
              <div className="card py-6">
                <EmptyState message={q ? 'Nothing matches your search.' : `Start by adding a ${C.key.toLowerCase()} title, then add its sub titles with images.`} />
                {!q && <div className="text-center">{newBtn}</div>}
              </div>
            ) : shown.map((r) => (
              <div key={r.MasterTitleId} ref={(el) => { groupRefs.current[r.MasterTitleId] = el; }}
                className={`card scroll-mt-4 !p-0 overflow-hidden transition-shadow ${selId === r.MasterTitleId ? 'ring-2 ring-violet-300' : ''}`}>
                <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 bg-gradient-to-r from-violet-50/70 to-white px-3 py-2">
                  <button type="button" disabled={!r.Image} onClick={() => setPreview({ src: r.Image, title: r.Title })}
                    className={r.Image ? 'cursor-zoom-in' : 'cursor-default'}>
                    <Thumb src={r.Image} className="h-10 w-10" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-ink-900">{r.Title}</h3>
                    <p className="text-11 text-ink-400">{r.subs.length} sub title{r.subs.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="secondary" icon={Plus} onClick={() => setDialog({ kind: 'sub', title: r })}>Sub Title</Button>
                    <Button size="sm" variant="ghost" icon={Pencil} title="Edit title" onClick={() => setDialog({ kind: 'title', item: r })} />
                    <Button size="sm" variant="ghost" icon={Trash2} title="Delete title" className="hover:!text-red-600" onClick={() => setConfirmDel({ kind: 'title', item: rows.find((x) => x.MasterTitleId === r.MasterTitleId) })} />
                  </div>
                </div>
                <div className="p-3">
                  {r.subs.length === 0 ? (
                    <button type="button" onClick={() => setDialog({ kind: 'sub', title: r })}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-ink-200 py-3 text-13 text-ink-400 hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-700">
                      <Plus size={14} /> Add the first sub title
                    </button>
                  ) : (
                    <div className="-mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-2">
                      {r.subs.map((s) => (
                        <SubCard key={s.MasterSubTitleId} s={s}
                          onOpen={() => setPreview({ src: s.Image, title: `${r.Title} › ${s.SubTitle}` })}
                          onEdit={() => setDialog({ kind: 'sub', title: r, item: s })}
                          onDelete={() => setConfirmDel({ kind: 'sub', item: s })} />
                      ))}
                      <button type="button" onClick={() => setDialog({ kind: 'sub', title: r })}
                        className="flex w-28 shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-200 text-12 font-semibold text-ink-400 hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-700">
                        <Plus size={16} /> Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </section>
      </div>

      <EditDialog
        open={dialog?.kind === 'title'}
        heading={dialog?.item ? `Edit ${C.key}` : `New ${C.key}`}
        label="Title" placeholder={C.example}
        initial={dialog?.kind === 'title' && dialog.item ? { id: dialog.item.MasterTitleId, name: dialog.item.Title, image: dialog.item.Image } : null}
        onSave={saveTitle} onClose={() => setDialog(null)} />
      <EditDialog
        open={dialog?.kind === 'sub'}
        heading={dialog?.item ? `Edit Sub Title · ${dialog.title.Title}` : `Add Sub Title · ${dialog?.title?.Title || ''}`}
        label="Sub Title" placeholder={C.subExample}
        initial={dialog?.kind === 'sub' && dialog.item ? { id: dialog.item.MasterSubTitleId, name: dialog.item.SubTitle, image: dialog.item.Image } : null}
        onSave={saveSub} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={!!confirmDel}
        title={confirmDel?.kind === 'title' ? `Delete ${C.key}` : 'Delete Sub Title'}
        message={confirmDel?.kind === 'title'
          ? <>Delete <b>{confirmDel.item.Title}</b>{confirmDel.item.subs.length ? <> and its {confirmDel.item.subs.length} sub title{confirmDel.item.subs.length > 1 ? 's' : ''}</> : ''}? It will no longer appear in the list.</>
          : confirmDel && <>Delete sub title <b>{confirmDel.item.SubTitle}</b>?</>}
        onConfirm={doDelete} onClose={() => setConfirmDel(null)} />
      <Modal open={!!preview} title={preview?.title} onClose={() => setPreview(null)} width="max-w-4xl">
        {preview && <img src={preview.src} alt="" className="mx-auto max-h-[70vh] rounded-lg object-contain" />}
      </Modal>
    </div>
  );
}
