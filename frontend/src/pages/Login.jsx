import { useState } from 'react';
import { LogIn, User, Lock, Eye, EyeOff, AlertCircle, UserPlus, Stethoscope, Receipt } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { errMsg } from '../lib/api';

// Sign-in: branded gradient backdrop; on wide screens the app name and what it does sit on the left.
export default function Login() {
  const { login, clinic } = useAuth();
  const appName = clinic.AppName || clinic.ClinicName || 'Lakshmi Physio';
  const [f, setF] = useState({ userName: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await login(f.userName, f.password); } catch (e2) { setErr(errMsg(e2)); } finally { setBusy(false); }
  };

  const features = [
    [UserPlus, 'Registration', 'Patients, staff and doctor schedules'],
    [Stethoscope, 'Examine', 'Assessments, treatments, exercises and follow-ups'],
    [Receipt, 'Billing', 'Doctor and treatment fees with printed receipts'],
  ];
  const logo = clinic.Logo || '/favicon.svg';

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-sidebar-gradient px-4 py-8">
      <span className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/5" />
      <span className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-teal-400/10" />
      <span className="pointer-events-none absolute right-1/3 top-10 h-40 w-40 rounded-full bg-brand-400/10 blur-2xl" />

      <div className="relative grid w-full max-w-4xl items-center gap-8 lg:grid-cols-2">
        <div className="hidden text-white lg:block">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-lg">
            <img src={logo} alt="" className="h-full w-full object-contain" />
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight">{appName}</h1>
          <p className="mt-2 max-w-sm text-sm text-white/70">Physiotherapy clinic management — from walk-in to receipt.</p>
          <ul className="mt-7 space-y-3.5">
            {features.map(([Icon, title, text]) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><Icon size={18} /></span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-12 text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto w-full max-w-sm animate-fade-in rounded-3xl bg-white p-7 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.5)] sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 shadow-md ring-1 ring-ink-100 lg:hidden">
              <img src={logo} alt="" className="h-full w-full object-contain" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-ink-900">Welcome back</h2>
            <p className="mt-1 text-13 text-ink-400"><span className="lg:hidden">{appName} · </span>Sign in to continue</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input className="input min-h-[38px] pl-9" autoFocus placeholder="Username" autoComplete="username"
                  value={f.userName} onChange={(e) => setF({ ...f, userName: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input type={show ? 'text' : 'password'} className="input min-h-[38px] pl-9 pr-10" placeholder="Password" autoComplete="current-password"
                  value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
                <button type="button" onClick={() => setShow((v) => !v)} title={show ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-600">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {err && (
              <p className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-13 font-medium text-red-700">
                <AlertCircle size={15} className="shrink-0" /> {err}
              </p>
            )}
            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={busy}>
              {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <LogIn size={16} />}
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="mt-6 text-center text-11 text-ink-300">© {new Date().getFullYear()} {appName}</p>
        </div>
      </div>
    </div>
  );
}
