import { useEffect, useState } from 'react';
import { Dumbbell, Zap, ImageOff, Layers, Maximize2 } from 'lucide-react';
import api from '../lib/api';
import { Modal, Spinner } from './ui';

const ICON = { Exercise: Dumbbell, Modality: Zap };

// Image with its numbered points drawn on top (read-only).
function PinnedImage({ src, pins, className = '', big }) {
  if (!src) return <div className={`grid place-items-center bg-ink-50 text-ink-300 ${className}`}><ImageOff size={20} /></div>;
  const size = big ? 'h-7 w-7 text-12' : 'h-4 w-4 text-[9px]';
  return (
    <div className="relative inline-block">
      <img src={src} alt="" draggable={false} className={`block ${className}`} />
      {pins.map((p) => (
        <span key={p.n} title={p.text} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
          className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-brand-600 font-bold text-white shadow ${size}`}>
          {p.n}
        </span>
      ))}
    </div>
  );
}

function PointList({ m }) {
  return (
    <>
      {m.Pins.length > 0 && (
        <ol className="space-y-1">
          {m.Pins.map((p) => (
            <li key={p.n} className="flex gap-2 text-13">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{p.n}</span>
              <span className={`whitespace-pre-wrap ${p.text ? 'text-ink-700' : 'italic text-ink-400'}`}>{p.text || 'No note'}</span>
            </li>
          ))}
        </ol>
      )}
      {m.CommonNote && (
        <div className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-13 text-amber-900 ring-1 ring-amber-100">
          <span className="text-11 font-bold uppercase tracking-wide text-amber-700">Common notes · </span>
          <span className="whitespace-pre-wrap">{m.CommonNote}</span>
        </div>
      )}
    </>
  );
}

// Patient History: every Exercise / Modality image this patient has points or notes on.
export default function PatientImageNotes({ patientId }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!patientId) return;
    setRows(null);
    api.get('/patient-image-marks/detail', { params: { patientId } }).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [patientId]);

  if (rows === null) return <Spinner label="Loading exercise / modality notes…" />;
  const groups = ['Exercise', 'Modality'].map((c) => [c, rows.filter((m) => m.Category === c)]).filter(([, l]) => l.length);
  const name = (m) => (m.RefType === 'sub' ? `${m.Title} › ${m.SubTitle}` : m.Title) || 'Deleted image';

  return (
    <section className="mb-4 rounded-xl border border-violet-200 bg-violet-50/30 p-3">
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-800">
        <Layers size={15} className="text-violet-600" /> Exercise / Modality
        <span className="text-12 font-normal text-ink-400">· points and notes on images (patient-wise)</span>
      </h4>
      {groups.length === 0 ? <p className="text-13 italic text-ink-400">No points or notes on exercise / modality images yet.</p> : (
        <div className="space-y-3">
          {groups.map(([cat, list]) => {
            const I = ICON[cat];
            return (
              <div key={cat}>
                <p className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-11 font-bold uppercase tracking-wide text-violet-700"><I size={11} /> {cat} · {list.length}</p>
                <div className="grid gap-2.5 lg:grid-cols-2">
                  {list.map((m) => (
                    <div key={m.MarkId} className="flex gap-3 rounded-lg border border-ink-200 bg-white p-2.5">
                      <button type="button" disabled={!m.Image} onClick={() => setOpen(m)} title="View larger"
                        className="group relative shrink-0 self-start overflow-hidden rounded-md bg-ink-50 ring-1 ring-ink-100">
                        <PinnedImage src={m.Image} pins={m.Pins} className="max-h-40 w-36 object-contain" />
                        {m.Image && <span className="absolute right-1 top-1 rounded bg-white/90 p-0.5 text-ink-500 opacity-0 shadow-sm group-hover:opacity-100"><Maximize2 size={11} /></span>}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-ink-900" title={name(m)}>{name(m)}</p>
                        <p className="mb-1.5 text-11 text-ink-400">
                          {m.Pins.length} point{m.Pins.length === 1 ? '' : 's'} · {m.UpdatedBy || m.CreatedBy} · {new Date(m.UpdatedAt || m.CreatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <PointList m={m} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!open} title={open ? name(open) : ''} onClose={() => setOpen(null)} width="max-w-6xl">
        {open && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid place-items-center rounded-xl bg-ink-50 p-2"><PinnedImage src={open.Image} pins={open.Pins} big className="max-h-[68vh] max-w-full" /></div>
            <div><PointList m={open} /></div>
          </div>
        )}
      </Modal>
    </section>
  );
}
