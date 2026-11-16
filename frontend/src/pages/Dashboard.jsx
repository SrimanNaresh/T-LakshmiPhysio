import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, CalendarCheck, Clock, Stethoscope, Repeat, IndianRupee, Receipt, LayoutDashboard, ArrowRight } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { MENU, TONES, canSee } from '../lib/menu';
import { money, fDate, today } from '../lib/fmt';
import { CardHeader } from '../components/ui';

export default function Dashboard() {
  const { user, screens } = useAuth();
  const [d, setD] = useState(null);
  useEffect(() => { api.get('/dashboard').then((r) => setD(r.data)).catch(() => {}); }, []);

  const tiles = [
    { label: 'Total Patients', v: d?.TotalPatients, icon: Users, to: '/registration/patients', k: 'patientList', tone: 'brand' },
    { label: 'New Today', v: d?.NewPatients, icon: UserPlus, to: '/registration/patient', k: 'patientRegistration', tone: 'teal' },
    { label: 'Confirmed Today', v: d?.TodayConfirmed, icon: CalendarCheck, to: '/booking/list', k: 'confirmList', tone: 'sky' },
    { label: 'Waiting to Examine', v: d?.Waiting, icon: Clock, to: '/examine/queue', k: 'examine', tone: 'amber' },
    { label: 'Examined Today', v: d?.Examined, icon: Stethoscope, to: '/examine/queue', k: 'examine', tone: 'violet' },
    { label: 'Follow-ups Today', v: d?.FollowUpsToday, icon: Repeat, to: '/booking/follow-up', k: 'followUp', tone: 'emerald' },
    { label: 'Pending Bills', v: d?.PendingBills, icon: Receipt, to: '/billing', k: 'billing', tone: 'rose' },
    { label: "Today's Collection", v: d ? money(d.TodayCollection) : null, icon: IndianRupee, to: '/billing', k: 'billing', tone: 'teal' },
  ];
  const modules = MENU.map((g) => ({ ...g, items: g.items.filter((i) => canSee(screens, i.key)) })).filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      <div className="card !pb-0.5">
        <CardHeader icon={LayoutDashboard} title={`Welcome, ${user.fullName || user.userName}`} subtitle={`${fDate(today())} · today at a glance`} />
      </div>

      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const tone = TONES[t.tone];
          const Icon = t.icon;
          const body = (
            <div className="card card-hover relative h-full overflow-hidden !py-4">
              <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${tone.grad}`} />
              <div className="flex items-start justify-between gap-2">
                <span className="text-11 font-semibold uppercase tracking-wider text-ink-400">{t.label}</span>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${tone.grad}`}><Icon size={15} /></span>
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-ink-900">{t.v ?? '—'}</div>
            </div>
          );
          return canSee(screens, t.k) ? <Link key={t.label} to={t.to}>{body}</Link> : <div key={t.label}>{body}</div>;
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1500px]:grid-cols-5">
        {modules.map((g) => {
          const tone = TONES[g.tone];
          const Icon = g.icon;
          return (
            <div key={g.group} className="card flex flex-col !pt-4">
              <div className="mb-3 flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${tone.grad}`}><Icon size={18} /></div>
                <div>
                  <p className="whitespace-nowrap text-15 font-bold text-ink-900">{g.group}</p>
                  <p className="text-12 text-ink-400">{g.items.length} screen{g.items.length === 1 ? '' : 's'}</p>
                </div>
              </div>
              <ul className="space-y-0.5">
                {g.items.map((p) => (
                  <li key={p.key}>
                    <Link to={p.path} className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-13 text-ink-600 hover:bg-ink-50">
                      <span className="truncate">{p.label}</span>
                      <ArrowRight size={13} className="shrink-0 text-ink-300 group-hover:text-ink-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
