// Body chart: a 3D skeleton (male or female) the doctor can rotate, zoom and focus by region. Clicking a bone names it (e.g. "T3 thoracic vertebra") and opens a
// note for it, tagged front or back by the side clicked. The findings are written as one block into
// the assessment notes (no separate storage), replacing the previous block when saved again.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Check, RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2, MapPin, Rotate3d } from 'lucide-react';
import { Button, Spinner } from './ui';
import { BONES, BOUNDS, REGION, REGIONS, VIEWS, boneName, boneType, inRegion, keyLabel, keyOf, parseKey, sortKeys } from './bodyParts';

const Skeleton3D = lazy(() => import('./Skeleton3D')); // three.js loads only when the chart is opened

/* ---------- consolidated text in the assessment notes ---------- */
export const BODY_CHART_HEADER = 'Body chart findings:';
const BLOCK_RE = /(^|\n)Body chart findings:\n(?:• .*(?:\n|$))*/;
const filled = (notes) => Object.keys(notes || {}).filter((k) => notes[k]?.text?.trim());

export function bodyChartText(notes) {
  const lines = sortKeys(filled(notes)).map((k) => `• ${keyLabel(k)}: ${notes[k].text.trim().replace(/\s*\n+\s*/g, '; ')}`);
  return lines.length ? `${BODY_CHART_HEADER}\n${lines.join('\n')}` : '';
}

// Reads the findings back out of saved notes (to edit a saved assessment): { key: { text, p: null } }.
let LABEL_TO_KEY;
export function parseBodyChart(text) {
  const m = (text || '').match(BLOCK_RE);
  if (!m) return {};
  LABEL_TO_KEY ??= Object.fromEntries(BONES.flatMap((b) => VIEWS.map((v) => [keyLabel(keyOf(b.id, v)), keyOf(b.id, v)])));
  const out = {};
  for (const line of m[0].split('\n')) {
    const lm = line.match(/^• (.+? — (?:front|back)): (.*)$/);
    const key = lm && LABEL_TO_KEY[lm[1]];
    if (key) out[key] = { text: lm[2].replace(/; /g, '\n'), p: null };
  }
  return out;
}

// Splits saved notes into the body chart lines ("Bone — front: note") and the doctor's own notes.
export function splitBodyChart(text) {
  const cur = text || '';
  const m = cur.match(BLOCK_RE);
  if (!m) return { findings: [], rest: cur.trim() };
  const findings = m[0].split('\n').filter((l) => l.startsWith('• ')).map((l) => l.slice(2));
  return { findings, rest: cur.replace(BLOCK_RE, '\n').replace(/\n{3,}/g, '\n\n').trim() };
}

// Puts the block into the notes: replaces an existing block, or appends it at the end.
export function mergeBodyChart(text, notes) {
  const block = bodyChartText(notes);
  const cur = text || '';
  if (BLOCK_RE.test(cur)) {
    return cur.replace(BLOCK_RE, (m, lead) => (block ? `${lead}${block}\n` : lead)).replace(/\n{3,}/g, '\n\n').trimEnd();
  }
  if (!block) return cur;
  return cur.trim() ? `${cur.trimEnd()}\n\n${block}` : block;
}

/* ---------- icons ---------- */
export function SkeletonIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="3.6" r="2.3" />
      <path d="M12 6v9.5M8 8.2h8M8.6 10.6h6.8M9.2 13h5.6M8 8.2l-2.2 6M16 8.2l2.2 6M10 16.2h4M10.4 16.6 9.4 22M13.6 16.6l1 5.4" />
    </svg>
  );
}

// Tiny skeleton with one region lit in its colour (for the Region list).
const MINI = {
  skull: <circle cx="12" cy="3.6" r="2.3" />,
  spine: <path d="M12 6v9.5" />,
  ribcage: <path d="M8.6 8.4h6.8M8.9 10.4h6.2M9.4 12.4h5.2" />,
  arm: <path d="M8 7.6 6 13.8M16 7.6l2 6.2" />,
  hand: <><circle cx="5.7" cy="15.3" r="1.1" /><circle cx="18.3" cy="15.3" r="1.1" /></>,
  pelvis: <path d="M9.4 15.6h5.2l-1 1.7h-3.2z" />,
  leg: <path d="M10.4 17.4 9.6 21.4M13.6 17.4l.8 4" />,
  foot: <path d="M8.4 22.4h2M13.6 22.4h2" />,
};
function MiniSkel({ region, size = 20 }) {
  const lit = REGION[region]?.color;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Object.entries(MINI).map(([k, d]) => (
        <g key={k} stroke={region === 'all' || region === k ? lit : '#6b7385'} fill={k === 'hand' && (region === 'all' || region === k) ? lit : 'none'}>{d}</g>
      ))}
    </svg>
  );
}

/* ---------- dark viewer controls ---------- */
const PanelTitle = ({ children }) => <div className="px-2 pb-1 pt-1.5 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">{children}</div>;
const PanelBtn = ({ active, onClick, children, label }) => (
  <button type="button" onClick={onClick} aria-pressed={!!active} aria-label={label}
    className={`flex w-full items-center gap-2 rounded-xl border px-2 py-1 text-left text-[12px] font-medium whitespace-nowrap transition-colors ${active ? 'border-amber-200/50 bg-white/10 text-white' : 'border-transparent text-ink-200 hover:bg-white/5 hover:text-white'}`}>
    {children}
  </button>
);
const IconBtn = ({ icon: Icon, label, onClick, active }) => (
  <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active}
    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${active ? 'bg-white/15 text-white' : 'text-ink-300 hover:bg-white/10 hover:text-white'}`}>
    <Icon size={16} />
  </button>
);

// A scroll bar for one axis over the 3D view. size / pos are the thumb's length and start as
// fractions of the track (0..1); onScroll gets the new start fraction.
function ScrollBar({ vertical, size, pos, onScroll, label }) {
  const track = useRef(null);
  const drag = useRef(null);
  const len = () => { const r = track.current.getBoundingClientRect(); return vertical ? r.height : r.width; };
  const at = (e) => (vertical ? e.clientY : e.clientX);
  const end = () => { drag.current = null; };
  return (
    <div ref={track} role="scrollbar" aria-label={label} aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round((pos / Math.max(1 - size, 0.0001)) * 100)}
      onPointerDown={(e) => {
        if (e.target !== track.current) return; // click on the track: jump there (thumb centred)
        const r = track.current.getBoundingClientRect();
        onScroll((vertical ? e.clientY - r.top : e.clientX - r.left) / len() - size / 2);
      }}
      className={`absolute z-10 cursor-pointer rounded-full bg-white/10 ${vertical ? 'bottom-9 right-1.5 top-2 w-3 lg:right-[136px]' : 'bottom-1.5 left-2 right-6 h-3 lg:left-[150px] lg:right-[142px]'}`}>
      <div
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { start: at(e), pos }; }}
        onPointerMove={(e) => { if (drag.current) onScroll(drag.current.pos + (at(e) - drag.current.start) / len()); }}
        onPointerUp={end} onPointerCancel={end}
        className="absolute cursor-grab touch-none rounded-full bg-white/45 transition-colors hover:bg-amber-200 active:cursor-grabbing active:bg-amber-300"
        style={vertical ? { top: `${pos * 100}%`, height: `${size * 100}%`, left: 0, right: 0 } : { left: `${pos * 100}%`, width: `${size * 100}%`, top: 0, bottom: 0 }} />
    </div>
  );
}

/* ---------- the chart (shown inline, as a tab of the assessment form) ---------- */
// notes: { "femur-r@Back": { text, p: [x,y,z] | null } }; setNotes is a React state setter
// (takes a value or an updater). Every edit goes straight to the parent.
export function BodyChartPanel({ notes, setNotes, gender, onDone }) {
  const draft = notes || {};
  const setDraft = setNotes;
  const [active, setActive] = useState(null); // key being edited
  const [hover, setHover] = useState(null); // { id, view, x, y }
  const [pick, setPick] = useState('');
  const [vp, setVp] = useState(null); // what the camera shows: { visH, visW, x, y } in metres
  const [sex, setSex] = useState(() => (/^f/i.test(gender || '') ? 'Female' : 'Male'));
  const [region, setRegion] = useState('all');
  const [spin, setSpin] = useState(false);
  const side = useRef('Right');
  const viewer = useRef(null);

  // Leaving the tab drops a finding that was opened but never written.
  useEffect(() => () => setNotes((d) => Object.fromEntries(Object.entries(d).filter(([, v]) => v.text?.trim()))), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll bars appear once zoomed in far enough that part of the skeleton is out of view.
  const H = BOUNDS.yMax - BOUNDS.yMin, W = BOUNDS.xMax - BOUNDS.xMin;
  const clamp01 = (p, size) => Math.min(Math.max(p, 0), 1 - size);
  const vBar = vp && vp.visH < H * 0.98 && (() => {
    const size = vp.visH / H;
    return { size, pos: clamp01((BOUNDS.yMax - (vp.y + vp.visH / 2)) / H, size),
      onScroll: (p) => viewer.current?.panTo(vp.x, BOUNDS.yMax - clamp01(p, size) * H - vp.visH / 2) };
  })();
  const hBar = vp && vp.visW < W * 0.98 && (() => {
    const size = vp.visW / W;
    return { size, pos: clamp01((vp.x - vp.visW / 2 - BOUNDS.xMin) / W, size),
      onScroll: (p) => viewer.current?.panTo(BOUNDS.xMin + clamp01(p, size) * W + vp.visW / 2, vp.y) };
  })();

  const openKey = (k, p) => {
    setDraft((d) => ({ ...d, [k]: { text: d[k]?.text || '', p: p ?? d[k]?.p ?? null } }));
    setActive(k);
  };
  const setText = (k, text) => setDraft((d) => ({ ...d, [k]: { ...d[k], text } }));
  const remove = (k) => { setDraft(({ [k]: _, ...rest }) => rest); if (active === k) setActive(null); };
  // Move the finding being edited to the other side (front <-> back).
  const switchView = (view) => {
    const { id } = parseKey(active), nk = keyOf(id, view);
    if (nk === active) return;
    setDraft(({ [active]: cur, ...rest }) => {
      const merged = [rest[nk]?.text?.trim(), cur?.text?.trim()].filter(Boolean).join('\n');
      return { ...rest, [nk]: { text: merged, p: cur?.p ?? rest[nk]?.p ?? null } };
    });
    setActive(nk);
    viewer.current?.view(view);
  };
  const edit = (k) => {
    const { id, view } = parseKey(k);
    setActive(k);
    if (!inRegion(id, region)) setRegion('all');
    viewer.current?.view(view);
  };
  const goView = (v) => {
    setSpin(false);
    if (v === 'Side') { side.current = side.current === 'Right' ? 'Left' : 'Right'; viewer.current?.view(side.current); } else viewer.current?.view(v);
  };

  const marked = sortKeys(filled(draft));
  // The scene shows pins for saved findings and for the one being edited.
  const sceneNotes = Object.fromEntries(Object.entries(draft).filter(([k, v]) => k === active || v.text?.trim()));
  const activeId = active && parseKey(active).id;

  const viewButtons = [['Front', 'Front view'], ['Back', 'Back view'], ['Side', 'Side view (right / left)']];
  const sexToggle = (
    <div className="flex rounded-xl bg-white/5 p-0.5">
      {[['Male', '♂'], ['Female', '♀']].map(([s, sym]) => (
        <button key={s} type="button" onClick={() => setSex(s)} aria-pressed={sex === s}
          className={`flex-1 whitespace-nowrap rounded-lg px-1 py-1 text-[11px] font-semibold transition-colors ${sex === s ? 'bg-white/15 text-white' : 'text-ink-300 hover:text-white'}`}>
          <span className="mr-0.5">{sym}</span>{s}
        </button>
      ))}
    </div>
  );

  return (
      <div className="grid gap-5 md:grid-cols-[minmax(0,600px)_minmax(260px,1fr)]">
        {/* 3D view */}
        <div className="min-w-0">
          {/* compact controls on smaller screens */}
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-ink-900 p-2 lg:hidden">
            <select className="rounded-lg border border-white/10 bg-ink-800 px-2 py-1 text-xs text-white" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div className="flex">
              {viewButtons.map(([v, l]) => <button key={v} type="button" onClick={() => goView(v)} aria-label={l} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-200 hover:bg-white/10">{v}</button>)}
              <IconBtn icon={Rotate3d} label="Auto-rotate" active={spin} onClick={() => setSpin((s) => !s)} />
            </div>
            <div className="w-36">{sexToggle}</div>
          </div>

          <div className="relative h-[64vh] min-h-[420px] overflow-hidden rounded-2xl border border-ink-800 bg-[radial-gradient(ellipse_at_50%_28%,#2b3243_0%,#161b26_55%,#0b0e14_100%)]"
            onMouseLeave={() => setHover(null)}>
            {(
              <Suspense fallback={<div className="grid h-full place-items-center"><Spinner label="Loading 3D skeleton…" /></div>}>
                <Skeleton3D ref={viewer} notes={sceneNotes} activeKey={active} sex={sex} region={region} autoRotate={spin}
                  onPick={(id, view, p) => { openKey(keyOf(id, view), p); setHover(null); setSpin(false); }}
                  onHover={setHover} onViewChange={setVp} />
              </Suspense>
            )}

            {/* left panel: region + colour */}
            <div className="absolute left-3 top-3 z-10 hidden w-[134px] rounded-2xl border border-white/10 bg-ink-900/75 p-1.5 shadow-xl backdrop-blur lg:block">
              <PanelTitle>Region</PanelTitle>
              <div className="space-y-0.5">
                {REGIONS.map((r) => (
                  <PanelBtn key={r.id} active={region === r.id} onClick={() => setRegion(r.id)} label={`Focus ${r.name}`}>
                    <MiniSkel region={r.id} size={17} /> {r.name}
                  </PanelBtn>
                ))}
              </div>
            </div>

            {/* right panel: view + sex + zoom */}
            <div className="absolute right-3 top-3 z-10 hidden w-[124px] rounded-2xl border border-white/10 bg-ink-900/75 p-1.5 shadow-xl backdrop-blur lg:block">
              <PanelTitle>View</PanelTitle>
              <div className="space-y-0.5">
                {viewButtons.map(([v, l]) => <PanelBtn key={v} onClick={() => goView(v)} label={l}><SkeletonIcon size={16} className="text-amber-100" /> {v}</PanelBtn>)}
                <PanelBtn active={spin} onClick={() => setSpin((s) => !s)} label="Auto-rotate"><Rotate3d size={16} className="text-amber-100" /> Rotate</PanelBtn>
              </div>
              <div className="mt-1.5 flex justify-center gap-0.5 border-t border-white/10 pt-1.5">
                <IconBtn icon={ZoomIn} label="Zoom in" onClick={() => viewer.current?.zoom(0.75)} />
                <IconBtn icon={ZoomOut} label="Zoom out" onClick={() => viewer.current?.zoom(1.33)} />
                <IconBtn icon={Maximize2} label="Reset view" onClick={() => { setRegion('all'); viewer.current?.reset(); }} />
              </div>
              <div className="flex justify-center gap-0.5">
                <IconBtn icon={RotateCcw} label="Rotate left" onClick={() => viewer.current?.rotate(-45)} />
                <IconBtn icon={RotateCw} label="Rotate right" onClick={() => viewer.current?.rotate(45)} />
              </div>
              <div className="mx-1 my-1.5 border-t border-white/10" />
              <PanelTitle>Skeleton</PanelTitle>
              {sexToggle}
            </div>

            {/* zoom buttons on smaller screens */}
            <div className="absolute right-2 top-2 z-10 flex flex-col rounded-xl bg-ink-900/75 p-0.5 lg:hidden">
              <IconBtn icon={ZoomIn} label="Zoom in" onClick={() => viewer.current?.zoom(0.75)} />
              <IconBtn icon={ZoomOut} label="Zoom out" onClick={() => viewer.current?.zoom(1.33)} />
              <IconBtn icon={Maximize2} label="Reset view" onClick={() => { setRegion('all'); viewer.current?.reset(); }} />
            </div>

            {vBar && <ScrollBar vertical label="Scroll up / down the body" {...vBar} />}
            {hBar && <ScrollBar label="Scroll left / right" {...hBar} />}

            {hover && (
              <div className="pointer-events-none absolute z-20 max-w-[240px] -translate-x-1/2 rounded-xl border border-white/10 bg-ink-900/95 px-3 py-2 text-xs text-white shadow-elevated"
                style={{ left: hover.x, top: hover.y + 22 }}>
                <div className="text-[13px] font-semibold">{boneName(hover.id)}</div>
                <div className="text-ink-300">{boneType(hover.id)} · {hover.view.toLowerCase()}</div>
                {draft[keyOf(hover.id, hover.view)]?.text?.trim() && <div className="mt-1 line-clamp-3 text-amber-100">{draft[keyOf(hover.id, hover.view)].text.trim()}</div>}
              </div>
            )}

            <div className={`pointer-events-none absolute inset-x-2 text-center text-[11px] text-ink-400 ${hBar ? 'bottom-6' : 'bottom-2'}`}>
              <span className="sm:hidden">Drag to rotate · pinch to zoom · tap a bone to add a note</span>
              <span className="hidden sm:inline">Drag to rotate · scroll or pinch to zoom · right-drag to move · click a bone to add a note</span>
            </div>
          </div>
        </div>

        {/* notes */}
        <div className="flex min-w-0 flex-col">
          {active ? (
            <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/60 p-3"
              onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.stopPropagation(); setActive(null); } }}>
              <div className="flex items-start gap-1.5 text-sm font-semibold text-brand-800"><MapPin size={15} className="mt-0.5 shrink-0" /> {boneName(activeId)}</div>
              <div className="mb-2 ml-5 text-xs text-ink-500">{boneType(activeId)}</div>
              <div className="mb-2 flex gap-1">
                {VIEWS.map((v) => (
                  <button key={v} type="button" onClick={() => switchView(v)}
                    className={`rounded-lg border px-3 py-1 text-xs font-semibold ${parseKey(active).view === v ? 'border-brand-500 bg-brand-600 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300'}`}>
                    {v}
                  </button>
                ))}
              </div>
              <textarea key={active} autoFocus rows={4} className="input text-sm" value={draft[active]?.text || ''}
                onChange={(e) => setText(active, e.target.value)} placeholder="Pain, tenderness, swelling, ROM, findings…" />
              <div className="mt-2 flex justify-between gap-2">
                <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(active)}>Clear</Button>
                <Button size="sm" icon={Check} onClick={() => setActive(null)}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <div className="mb-1 text-xs text-ink-500">Or choose a bone / joint from the list</div>
              <select className="input text-sm" value={pick}
                onChange={(e) => {
                  const id = e.target.value; setPick('');
                  if (!id) return;
                  const b = BONES.find((x) => x.id === id);
                  if (!inRegion(id, region)) setRegion(b.region);
                  openKey(keyOf(id, viewer.current?.facing() || 'Front'), null);
                }}>
                <option value="">Select a bone or joint…</option>
                {REGIONS.filter((r) => r.id !== 'all').map((r) => (
                  <optgroup key={r.id} label={r.name}>
                    {BONES.filter((b) => b.region === r.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Findings ({marked.length})</div>
          {marked.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 p-4 text-sm text-ink-400">
              No notes yet. Rotate the skeleton and click a bone to add a note. Use Back to mark the back of the body.
            </div>
          ) : (
            <ul className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
              {marked.map((k) => (
                <li key={k} className={`rounded-lg border p-2.5 text-sm ${active === k ? 'border-brand-300 bg-brand-50' : 'border-ink-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-ink-800">{keyLabel(k)}</div>
                    <div className="flex shrink-0 gap-0.5">
                      <button type="button" className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-brand-700" onClick={() => edit(k)} aria-label={`Edit ${keyLabel(k)}`}><Pencil size={14} /></button>
                      <button type="button" className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(k)} aria-label={`Remove ${keyLabel(k)}`}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-ink-600">{draft[k].text.trim()}</div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-ink-500">
            <span>Findings are added to the assessment notes automatically.</span>
            {onDone && <Button variant="secondary" icon={Check} onClick={onDone}>Go to assessment notes</Button>}
          </div>
        </div>
      </div>
  );
}
