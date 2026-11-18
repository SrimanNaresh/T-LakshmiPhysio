import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Plus, Trash2 } from 'lucide-react';
import { inputCls } from './ui';

// A drop-down you can type into. Typing filters the list; text that matches nothing offers
// `+ Add "<text>" to the list`, which calls onAdd(text). Added entries (custom: true) can be removed.
//   options: [{ value, label, custom?, id? }]
//   onAdd(text) -> Promise; reject or throw with a message to show it under the list.
//   canAdd(text) -> '' when the text can be added, otherwise a hint explaining why not.
export default function CreatableSelect({ value, options, onChange, onAdd, onDelete, canAdd = () => '', disabled, placeholder, id, 'aria-label': ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = useRef(null);
  const input = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));
  const q = text.trim().toLowerCase();
  const shown = useMemo(() => (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options), [options, q]);
  const exact = q && options.some((o) => o.label.toLowerCase() === q);
  const addable = q && !exact && !!onAdd;
  const hint = addable ? canAdd(text.trim()) : '';
  const rows = shown.length + (addable ? 1 : 0); // the Add row is last

  const close = () => { setOpen(false); setText(''); setError(''); };
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => { if (!box.current?.contains(e.target)) close(); };
    document.addEventListener('pointerdown', out);
    return () => document.removeEventListener('pointerdown', out);
  }, [open]);
  useEffect(() => { setActive(0); }, [q]);

  const pick = (o) => { onChange(o.value); close(); input.current?.blur(); };
  const add = async () => {
    if (!addable || hint || busy) return;
    setBusy(true); setError('');
    try { await onAdd(text.trim()); close(); input.current?.blur(); } catch (e) { setError(e?.message || 'Could not add'); } finally { setBusy(false); }
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); input.current?.blur(); return; }
    if (e.key === 'Tab') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, rows - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (active < shown.length) pick(shown[active]); else add();
    }
  };

  return (
    <div ref={box} className="relative">
      <input ref={input} id={id} aria-label={ariaLabel} role="combobox" aria-expanded={open} aria-autocomplete="list" autoComplete="off"
        disabled={disabled} className={`${inputCls} pr-7`}
        value={open ? text : (selected?.label || '')} placeholder={open ? (selected?.label || placeholder) : placeholder}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={onKey}
        onChange={(e) => { setText(e.target.value); setOpen(true); setError(''); }} />
      <ChevronDown size={15} aria-hidden="true"
        className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      {open && !disabled && (
        <div role="listbox" className="absolute left-0 z-30 mt-1 max-h-64 min-w-full overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-elevated">
          {shown.length === 0 && !addable && <div className="px-3 py-2 text-xs text-ink-400">No matches</div>}
          {shown.map((o, i) => {
            const on = String(o.value) === String(value);
            return (
              <div key={o.value} role="option" aria-selected={on} onMouseEnter={() => setActive(i)}
                className={`group flex items-center gap-2 px-3 py-1.5 text-sm ${i === active ? 'bg-brand-50' : ''} ${on ? 'font-semibold text-brand-800' : 'text-ink-700'}`}>
                <button type="button" className="flex flex-1 items-center gap-2 whitespace-nowrap text-left" onClick={() => pick(o)}>
                  <span className="w-3.5 shrink-0">{on && <Check size={14} strokeWidth={3} />}</span>{o.label}
                </button>
                {o.custom && onDelete && (
                  <button type="button" aria-label={`Remove ${o.label} from the list`} title="Remove from the list"
                    onClick={() => onDelete(o)} className="grid h-5 w-5 shrink-0 place-items-center rounded text-ink-300 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
          {addable && (
            <div className={`border-t border-ink-100 ${shown.length ? 'mt-1 pt-1' : ''}`}>
              <button type="button" disabled={!!hint || busy} onMouseEnter={() => setActive(shown.length)} onClick={add}
                className={`flex w-full items-center gap-2 whitespace-nowrap px-3 py-1.5 text-left text-sm font-medium text-brand-700 disabled:cursor-not-allowed disabled:text-ink-400 ${active === shown.length ? 'bg-brand-50' : ''}`}>
                <Plus size={14} /> {busy ? 'Adding…' : <>Add &ldquo;{text.trim()}&rdquo; to the list</>}
              </button>
              {hint && <div className="px-3 pb-1.5 text-11 text-ink-400">{hint}</div>}
            </div>
          )}
          {error && <div className="px-3 py-1.5 text-11 text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
