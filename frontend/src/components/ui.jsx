// UI kit in the tayush (Ayush All In One) design: .card / .input / .btn-* / .table classes
// from index.css, section-coloured card headers, gradient icon badges.
import { createContext, useCallback, useContext, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, CheckCircle2, AlertCircle, Inbox } from 'lucide-react';
import { sectionOf } from '../lib/menu';

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const push = useCallback((message, type = 'success') => {
    const t = { message, type, id: Math.random() };
    setToast(t);
    setTimeout(() => setToast((cur) => (cur?.id === t.id ? null : cur)), 3500);
  }, []);
  const s = toast?.type === 'error'
    ? { box: 'border-red-200', icon: 'bg-red-500', Icon: AlertCircle }
    : { box: 'border-emerald-200', icon: 'bg-emerald-500', Icon: CheckCircle2 };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {toast && (
        <div className="no-print fixed inset-x-3 top-14 z-[60] flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto">
          <div key={toast.id} className={`toast-in flex max-w-md items-center gap-2.5 rounded-xl border bg-white py-2 pl-2 pr-4 text-sm font-medium text-ink-800 shadow-elevated ${s.box}`}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${s.icon}`}><s.Icon size={16} /></span>
            {toast.message}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ---------- Headers ---------- */
// Section-coloured header: gradient icon badge, "Section › " path, title, subtitle, actions.
export function CardHeader({ icon, title, subtitle, actions }) {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const { tone } = section;
  const Icon = icon || section.icon;
  const path = section.group !== title && section.group !== 'Dashboard' ? section.group : '';
  return (
    <div className="relative mb-2.5 flex flex-col flex-wrap gap-2 border-b border-ink-100 pb-2 sm:flex-row sm:items-center sm:justify-between">
      <span className={`pointer-events-none absolute -bottom-px left-0 h-0.5 w-14 rounded-full ${tone.bar}`} />
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        {Icon && (
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ring-4 ${tone.grad} ${tone.ring}`}>
            <Icon size={15} />
          </div>
        )}
        <div className="min-w-0">
          {path && <p className={`hidden text-10 font-bold uppercase leading-tight tracking-[0.12em] sm:block ${tone.text}`}>{path}</p>}
          <h3 className="text-15 font-bold leading-tight tracking-tight text-ink-900">{title}</h3>
          {subtitle && <p className="text-12 leading-snug text-ink-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
    </div>
  );
}

// Top-of-screen header: a card holding the section header.
export function PageHeader({ title, subtitle, actions, icon }) {
  return (
    <div className="card no-print mb-4 !pb-0.5">
      <CardHeader icon={icon} title={title} subtitle={subtitle} actions={actions} />
    </div>
  );
}

export function Card({ title, children, className = '', actions }) {
  return (
    <div className={`card ${title ? '' : '!pt-5'} ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-ink-100 pb-2">
          <h2 className="section-title">{title}</h2>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

/* ---------- Form controls ---------- */
export function Field({ label, required, children, className = '', hint }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
      {hint && <span className="mt-0.5 block text-11 text-ink-400">{hint}</span>}
    </label>
  );
}

export const inputCls = 'input disabled:bg-ink-50 disabled:text-ink-500';
export const Input = (p) => <input {...p} className={`${inputCls} ${p.className || ''}`} />;
export const Textarea = (p) => <textarea rows={4} {...p} className={`${inputCls} ${p.className || ''}`} />;
export const Select = ({ children, ...p }) => <select {...p} className={`${inputCls} ${p.className || ''}`}>{children}</select>;

const BTN = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger', ghost: 'btn-ghost' };
export function Button({ variant = 'primary', loading, icon: Icon, children, className = '', size = 'md', ...p }) {
  const sz = size === 'sm' ? (children ? '!px-2.5 !py-1 !text-xs' : '!p-1.5') : '';
  return (
    <button type="button" {...p} disabled={p.disabled || loading} className={`${BTN[variant]} ${sz} ${className}`}>
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function Badge({ children, color = 'slate' }) {
  const c = {
    slate: 'bg-ink-100 text-ink-600', green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
    blue: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100', amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
    red: 'bg-red-50 text-red-600 ring-1 ring-red-100', teal: 'bg-teal-50 text-teal-700 ring-1 ring-teal-100',
  }[color];
  return <span className={`badge ${c}`}>{children}</span>;
}

export const STATUS_COLOR = { Confirmed: 'blue', Examined: 'amber', Billed: 'green', Cancelled: 'red', Pending: 'amber', Missed: 'red' };

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-10 text-ink-400">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full border-[3px] border-brand-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-r-teal-400 border-t-brand-500" />
      </div>
      <span className="text-13 font-medium">{label}</span>
    </div>
  );
}

export function EmptyState({ message = 'No records found.' }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-ink-50 to-ink-100 text-ink-400 ring-1 ring-ink-100">
        <Inbox size={22} />
      </span>
      <p className="max-w-xs text-sm text-ink-500">{message}</p>
    </div>
  );
}

/* ---------- Table (list screens: inside a flush card) ---------- */
export function Table({ columns, rows, keyField, empty = 'No records found.', loading, onRowClick, rowClass }) {
  return (
    <div className="card-flush">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>{columns.map((c) => <th key={c.key || c.label} className={c.className || ''}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {!loading && rows.map((r, i) => (
              <tr key={r[keyField] ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`${onRowClick ? 'cursor-pointer' : ''} ${rowClass ? rowClass(r) : ''}`}>
                {columns.map((c) => <td key={c.key || c.label} className={`!py-1.5 !align-middle text-ink-700 ${c.className || ''}`}>{c.render ? c.render(r, i) : r[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? <Spinner /> : rows.length === 0 && <EmptyState message={empty} />}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, title, onClose, children, width = 'max-w-2xl' }) {
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={`mt-8 w-full ${width} animate-fade-in overflow-hidden rounded-2xl bg-white shadow-elevated`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-100 bg-gradient-to-r from-ink-50 to-white px-6 py-3.5">
          <h3 className="text-base font-bold tracking-tight text-ink-800">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600"><X size={20} /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
