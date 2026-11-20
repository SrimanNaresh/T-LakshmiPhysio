import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Save, Trash2, MousePointerClick, X, MapPin, Eraser } from 'lucide-react';
import api, { errMsg } from '../lib/api';
import { Button, Modal, Textarea, inputCls, useToast } from './ui';

// Full-screen image with numbered pins for one patient: click the image to drop point 1, 2, 3…,
// drag a pin to move it, write a note per point on the right plus one common note. Saved per patient.
export default function ImageAnnotator({ open, onClose, image, title, patientId, refType, refId, mark, onSaved }) {
  const toast = useToast();
  const [pins, setPins] = useState([]);
  const [common, setCommon] = useState('');
  const [active, setActive] = useState(null); // index of the selected point
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const boxRef = useRef(null);
  const drag = useRef(null); // { i, moved }
  const noteRefs = useRef([]);
  const focusNext = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPins((mark?.Pins || []).map((p) => ({ ...p })));
    setCommon(mark?.CommonNote || '');
    setActive(null); setDirty(false); setAskDelete(false);
  }, [open, mark]);

  const pos = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const change = (fn) => { setPins(fn); setDirty(true); };

  const addAt = (e) => {
    if (drag.current) return;
    const { x, y } = pos(e);
    const i = pins.length;
    change((cur) => [...cur, { n: cur.length + 1, x, y, text: '' }]);
    setActive(i);
    focusNext.current = i;
  };
  // Put the cursor in a new point's note right after it renders, so the doctor can type straight away.
  useLayoutEffect(() => {
    if (focusNext.current == null) return;
    const el = noteRefs.current[focusNext.current];
    focusNext.current = null;
    el?.focus();
    el?.scrollIntoView({ block: 'nearest' });
  }, [pins.length]);
  const removeAt = (i) => {
    change((cur) => cur.filter((_, j) => j !== i).map((p, j) => ({ ...p, n: j + 1 })));
    setActive(null);
  };

  const onPinDown = (e, i) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { i, moved: false };
    setActive(i);
  };
  const onPinMove = (e) => {
    if (!drag.current) return;
    const { x, y } = pos(e);
    drag.current.moved = true;
    const { i } = drag.current;
    change((cur) => cur.map((p, j) => (j === i ? { ...p, x, y } : p)));
  };
  const onPinUp = (e) => {
    const d = drag.current;
    setTimeout(() => { drag.current = null; }, 0); // swallow the click that follows the drag
    if (d && !d.moved) noteRefs.current[d.i]?.focus();
    e.stopPropagation();
  };

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.put('/patient-image-marks', { PatientId: patientId, RefType: refType, RefId: refId, Pins: pins, CommonNote: common });
      toast(mark ? 'Notes updated' : 'Notes saved');
      setDirty(false);
      onSaved(r.data);
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };
  const deleteAll = async () => {
    setBusy(true);
    try {
      await api.delete(`/patient-image-marks/${mark.MarkId}`);
      toast('Notes deleted');
      onSaved(null);
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); setAskDelete(false); }
  };
  const close = () => {
    if (dirty && !confirm('You have unsaved points or notes. Close without saving?')) return;
    onClose();
  };

  return (
    <Modal open={open} title={title} onClose={close} width="max-w-7xl">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------- Image with pins ---------- */}
        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-12 font-medium text-brand-700">
            <MousePointerClick size={13} /> Click on the image to add a point · drag a point to move it
          </p>
          <div className="grid place-items-center rounded-xl bg-ink-50 p-2 ring-1 ring-ink-100">
            <div ref={boxRef} className="relative inline-block cursor-crosshair select-none touch-none" onClick={addAt}>
              <img src={image} alt="" draggable={false} className="block max-h-[68vh] max-w-full" />
              {pins.map((p, i) => (
                <button key={i} type="button" title={p.text || `Point ${p.n}`}
                  onPointerDown={(e) => onPinDown(e, i)} onPointerMove={onPinMove} onPointerUp={onPinUp} onClick={(e) => e.stopPropagation()}
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  className={`absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab place-items-center rounded-full border-2 border-white text-12 font-bold text-white shadow-lg transition-transform active:cursor-grabbing ${active === i ? 'scale-125 bg-red-600 ring-4 ring-red-200' : 'bg-brand-600 hover:scale-110'}`}>
                  {p.n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- Notes ---------- */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="section-title">Points ({pins.length})</h4>
            {pins.length > 0 && (
              <button type="button" onClick={() => { if (confirm('Remove all points?')) { change(() => []); setActive(null); } }}
                className="inline-flex items-center gap-1 text-12 font-semibold text-ink-400 hover:text-red-600"><Eraser size={13} /> Clear points</button>
            )}
          </div>
          <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">
            {pins.length === 0 && (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-ink-200 px-3 py-6 text-center text-13 text-ink-400">
                <MapPin size={18} className="text-ink-300" /> No points yet. Click on the image to add point 1.
              </div>
            )}
            {pins.map((p, i) => (
              <div key={i} className={`rounded-lg border p-2 transition-colors ${active === i ? 'border-red-300 bg-red-50/40' : 'border-ink-200 bg-white'}`}>
                <div className="mb-1 flex items-center gap-2">
                  <button type="button" onClick={() => setActive(i)}
                    className={`grid h-6 w-6 place-items-center rounded-full text-11 font-bold text-white ${active === i ? 'bg-red-600' : 'bg-brand-600'}`}>{p.n}</button>
                  <span className="flex-1 text-12 font-semibold text-ink-600">Point {p.n}</span>
                  <button type="button" aria-label={`Delete point ${p.n}`} onClick={() => removeAt(i)}
                    className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-red-50 hover:text-red-600"><X size={14} /></button>
                </div>
                <textarea ref={(el) => { noteRefs.current[i] = el; }} rows={2} className={inputCls} value={p.text} onFocus={() => setActive(i)}
                  onChange={(e) => { const v = e.target.value; change((cur) => cur.map((x, j) => (j === i ? { ...x, text: v } : x))); }}
                  placeholder={`Note for point ${p.n}…`} aria-label={`Note for point ${p.n}`} />
              </div>
            ))}
          </div>

          <div className="mt-3">
            <label htmlFor="img-common-note" className="section-title mb-1 block">Common Notes</label>
            <Textarea id="img-common-note" rows={3} value={common} onChange={(e) => { setCommon(e.target.value); setDirty(true); }}
              placeholder="General notes for this image and patient…" />
          </div>

          {mark?.UpdatedAt || mark?.CreatedAt ? (
            <p className="mt-2 text-11 text-ink-400">Last saved by {mark.UpdatedBy || mark.CreatedBy} · {new Date(mark.UpdatedAt || mark.CreatedAt).toLocaleString()}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-ink-100 pt-3">
            {mark && (askDelete ? (
              <span className="mr-auto inline-flex items-center gap-2 text-12 text-red-700">
                Delete all notes?
                <Button size="sm" variant="danger" loading={busy} onClick={deleteAll}>Yes, delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setAskDelete(false)}>No</Button>
              </span>
            ) : (
              <Button variant="secondary" icon={Trash2} className="mr-auto !text-red-600" onClick={() => setAskDelete(true)}>Delete</Button>
            ))}
            <Button variant="secondary" onClick={close}>Close</Button>
            <Button icon={Save} loading={busy} disabled={!dirty} onClick={save}>{mark ? 'Update' : 'Save'}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
