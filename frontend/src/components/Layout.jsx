// App shell in the tayush design: white glass header (logo, clinic name, status, user menu),
// a gradient menu bar whose groups open dropdown panels, and a Menu button on phones.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, LogOut, AlertTriangle, LayoutGrid, X, LayoutDashboard, Menu, Search } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { MENU, TONES, canSee } from '../lib/menu';

function useMenu() {
  const { screens } = useAuth();
  return MENU.map((g) => ({ ...g, items: g.items.filter((i) => canSee(screens, i.key)) })).filter((g) => g.items.length);
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const initials = (user.fullName || user.userName || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  useEffect(() => {
    const off = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-ink-100">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-11 font-semibold text-white shadow-sm">{initials}</div>
        <p className="hidden text-13 font-semibold text-ink-700 sm:block">{user.userName}</p>
        <ChevronDown size={14} className="hidden text-ink-400 sm:block" />
      </button>
      {open && (
        <div className="menu-drop absolute right-0 z-30 mt-2 w-44 rounded-xl border border-ink-100 bg-white py-1.5 shadow-elevated">
          <div className="border-b border-ink-100 px-3.5 pb-1.5 pt-0.5">
            <p className="truncate text-13 font-semibold text-ink-800">{user.fullName || user.userName}</p>
            <p className="text-11 text-ink-400">{user.role}</p>
          </div>
          <button onClick={logout} className="flex w-full items-center gap-2 px-3.5 py-2 text-sm text-red-600 transition-colors hover:bg-red-50">
            <LogOut size={15} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Desktop menu bar ---------- */
function DropdownPanel({ group, rect, panelRef, onNavigate }) {
  const tone = TONES[group.tone];
  const w = Math.min(280, window.innerWidth - 16);
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - w - 8);
  const GIcon = group.icon;
  return createPortal(
    <div ref={panelRef} style={{ position: 'fixed', top: rect.bottom + 6, left, width: w }}
      className="menu-drop z-50 overflow-hidden rounded-xl border border-ink-200/70 bg-gradient-to-b from-slate-50 to-white shadow-elevated">
      <div className={`h-0.5 bg-gradient-to-r ${tone.grad}`} />
      <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-sm ${tone.grad}`}><GIcon size={13} /></span>
        <span className="text-13 font-semibold text-ink-800">{group.group}</span>
        <span className="text-11 text-ink-400">· {group.items.length} screen{group.items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="p-1.5">
        {group.items.map((i) => {
          const Icon = i.icon;
          return (
            <NavLink key={i.key} to={i.path} onClick={onNavigate}
              className={({ isActive }) => `group flex items-center gap-2 rounded-md px-2 py-1.5 text-13 transition-colors ${isActive ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-brand-700'}`}>
              <Icon size={14} className="shrink-0 text-ink-400 group-hover:text-brand-500" />
              <span className="flex-1">{i.label}</span>
              <ChevronRight size={12} strokeWidth={2.5} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
            </NavLink>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

function MenuBar() {
  const { pathname } = useLocation();
  const menu = useMenu();
  const [open, setOpen] = useState(null); // { group, rect }
  const barRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    const off = (e) => {
      if (barRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(null);
    };
    const close = () => setOpen(null);
    document.addEventListener('mousedown', off);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', off); window.removeEventListener('resize', close); };
  }, []);

  const btn = (active, isOpen) => `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-sm font-medium transition-colors ${active || isOpen ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`;

  return (
    <nav ref={barRef} onScroll={() => setOpen(null)} className="no-scrollbar hidden items-center gap-1 overflow-x-auto bg-sidebar-gradient px-4 py-1 shadow-sm lg:flex lg:px-6">
      <NavLink to="/" end className={({ isActive }) => btn(isActive, false)}>
        {({ isActive }) => (<><LayoutDashboard size={16} className={isActive ? 'text-teal-300' : 'text-white/50'} />Dashboard</>)}
      </NavLink>
      {menu.map((g) => {
        const active = g.items.some((i) => i.path === pathname);
        const isOpen = open?.group.group === g.group;
        const Icon = g.icon;
        if (g.items.length === 1) {
          return (
            <NavLink key={g.group} to={g.items[0].path} className={btn(active, false)}>
              <Icon size={16} className={active ? 'text-teal-300' : 'text-white/50'} />{g.group}
            </NavLink>
          );
        }
        return (
          <button key={g.group} className={btn(active, isOpen)}
            onClick={(e) => setOpen(isOpen ? null : { group: g, rect: e.currentTarget.getBoundingClientRect() })}>
            <Icon size={16} className={active ? 'text-teal-300' : 'text-white/50'} />
            {g.group}
            <ChevronDown size={13} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        );
      })}
      {open && <DropdownPanel group={open.group} rect={open.rect} panelRef={panelRef} onNavigate={() => setOpen(null)} />}
    </nav>
  );
}

/* ---------- Desktop left-side menu (the header's ☰ button moves the menu here and back) ---------- */
function Highlight({ text, query }) {
  const i = query ? text.toLowerCase().indexOf(query) : -1;
  if (i < 0) return text;
  return (<>{text.slice(0, i)}<mark className="rounded-sm bg-amber-200/70 px-px text-inherit">{text.slice(i, i + query.length)}</mark>{text.slice(i + query.length)}</>);
}

function SideGroup({ g, pathname }) {
  const active = g.items.some((i) => i.path === pathname);
  const [open, setOpen] = useState(active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  const Icon = g.icon;
  const row = `flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`;
  if (g.items.length === 1) {
    return (
      <NavLink to={g.items[0].path} className={`${row} gap-3`}>
        <Icon size={18} className={active ? 'text-teal-300' : 'text-white/50'} />{g.group}
      </NavLink>
    );
  }
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className={`${row} justify-between`}>
        <span className="flex items-center gap-3"><Icon size={18} className={active ? 'text-teal-300' : 'text-white/50'} />{g.group}</span>
        <ChevronRight size={15} className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="ml-[22px] mt-1 animate-slide-in space-y-0.5 border-l border-white/10 pl-3">
          {g.items.map((i) => (
            <NavLink key={i.key} to={i.path}
              className={({ isActive }) => `relative block rounded-lg px-3 py-1.5 text-13 transition-colors ${isActive ? 'bg-white/10 font-semibold text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}>
              {({ isActive }) => (<>{isActive && <span className="absolute -left-[13px] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-teal-300" />}{i.label}</>)}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

// Search box on top lists matching screens; ↑ / ↓ pick one, Enter opens it, Esc clears.
function SideNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const menu = useMenu();
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState(0);
  const q = query.trim().toLowerCase();
  const results = useMemo(() => (q ? menu.flatMap((g) => g.items.map((i) => ({ ...i, title: g.items.length === 1 ? i.label : `${g.group} › ${i.label}` })))
    .filter((i) => i.title.toLowerCase().includes(q)) : []), [menu, q]);
  useEffect(() => setPick(0), [q]);
  const go = (to) => { setQuery(''); navigate(to); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setPick((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPick((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[pick]) { e.preventDefault(); go(results[pick].path); }
    else if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
  };
  const dashActive = pathname === '/';

  return (
    <aside className="no-print no-scrollbar hidden w-56 shrink-0 animate-slide-in overflow-y-auto bg-sidebar-gradient shadow-sm lg:block">
      <div className="sticky top-0 z-10 bg-[#1d306e] px-2 pb-1 pt-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder="Search menu..." aria-label="Search menu"
            className="w-full rounded-lg border border-white/15 bg-white/10 py-1.5 pl-8 pr-7 text-13 text-white placeholder-white/40 outline-none transition-colors focus:border-teal-300/60 focus:bg-white/15" />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/50 hover:text-white"><X size={13} /></button>
          )}
        </div>
      </div>
      {q ? (
        <nav className="space-y-0.5 px-2 py-1">
          {results.length === 0 && <p className="px-3 py-2 text-13 text-white/50">No matching screens.</p>}
          {results.map((r, i) => {
            const Icon = r.icon;
            return (
              <button key={r.key} onClick={() => go(r.path)} onMouseEnter={() => setPick(i)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-13 transition-colors ${i === pick ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'} ${pathname === r.path ? 'font-semibold' : ''}`}>
                <Icon size={15} className="shrink-0 text-white/50" />
                <span className="min-w-0"><Highlight text={r.title} query={q} /></span>
              </button>
            );
          })}
        </nav>
      ) : (
        <nav className="space-y-0.5 px-2 py-1">
          <NavLink to="/" end className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${dashActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
            <LayoutDashboard size={18} className={dashActive ? 'text-teal-300' : 'text-white/50'} />Dashboard
          </NavLink>
          {menu.map((g) => <SideGroup key={g.group} g={g} pathname={pathname} />)}
        </nav>
      )}
    </aside>
  );
}

/* ---------- Phone / tablet: Menu button bottom-right ---------- */
function MobileMenu() {
  const menu = useMenu();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="no-print lg:hidden">
      {open && (
        <div className="menu-fade fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className="menu-pop absolute bottom-20 right-3 max-h-[75vh] w-[min(22rem,calc(100vw-1.5rem))] origin-bottom-right overflow-y-auto rounded-2xl bg-white p-3 shadow-elevated">
            <NavLink to="/" end className="menu-item-in mb-2 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
            {menu.map((g, gi) => {
              const tone = TONES[g.tone];
              const GIcon = g.icon;
              return (
                <div key={g.group} className="menu-item-in mb-2" style={{ animationDelay: `${(gi + 1) * 40}ms` }}>
                  <div className="mb-1 flex items-center gap-2 px-1">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-white ${tone.grad}`}><GIcon size={13} /></span>
                    <span className={`text-11 font-bold uppercase tracking-wider ${tone.text}`}>{g.group}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {g.items.map((i) => (
                      <NavLink key={i.key} to={i.path}
                        className={({ isActive }) => `rounded-lg px-2.5 py-2 text-13 ring-1 ${isActive ? 'bg-brand-50 font-semibold text-brand-700 ring-brand-100' : 'text-ink-700 ring-ink-100 hover:bg-ink-50'}`}>
                        {i.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow">
        {!open && <span className="fab-halo absolute inset-0 rounded-full bg-brand-500" />}
        {open ? <X size={20} className="relative" /> : <LayoutGrid size={20} className="relative" />}
      </button>
    </div>
  );
}

export default function Layout() {
  const { clinic, validity } = useAuth();
  const daysLeft = validity?.DaysLeft;
  // Desktop: the ☰ button moves the menu between the top bar and a left-side column (remembered in this browser).
  const [navSide, setNavSide] = useState(() => {
    try { return localStorage.getItem('lp-nav-side') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('lp-nav-side', navSide ? '1' : '0'); } catch { /* not stored */ }
  }, [navSide]);
  const toggleSide = () => setNavSide((v) => !v);
  return (
    <div className="flex h-full flex-col">
      <div className="no-print sticky top-0 z-20">
        <header className="relative z-10 flex items-center gap-3 border-b border-ink-100 bg-white/85 px-4 py-1 backdrop-blur-md lg:px-6">
          <button onClick={toggleSide} aria-label="Toggle menu" title={navSide ? 'Move menu to the top' : 'Move menu to the left'}
            className={`hidden rounded-lg p-1 transition-colors hover:bg-ink-100 lg:block ${navSide ? 'bg-ink-100 text-brand-700' : 'text-ink-600'}`}>
            <Menu size={18} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-ink-100">
              <img src={clinic.Logo || '/favicon.svg'} alt="" className="h-full w-full object-contain" />
            </span>
            <div className="flex min-w-0 items-baseline gap-2">
              <p className="truncate font-display text-base font-bold tracking-tight text-brand-800 sm:text-lg">{clinic.AppName || clinic.ClinicName}</p>            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-ink-100 bg-ink-50 px-2.5 py-0.5 text-11 text-ink-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> Connected
            </div>
            <UserMenu />
          </div>
        </header>
        {!navSide && <MenuBar />}
        {daysLeft != null && daysLeft <= 15 && (
          <div className={`flex items-center gap-2 px-4 py-1.5 text-13 lg:px-6 ${daysLeft < 0 ? 'bg-red-600 text-white' : 'border-b border-amber-200 bg-amber-50 text-amber-800'}`}>
            <AlertTriangle size={15} />
            {daysLeft < 0 ? 'Software validity has expired. Only Admin can log in — please renew under Configuration › Validity.'
              : `Software validity (${validity.PlanName}) ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
          </div>
        )}
      </div>
      <MobileMenu />
      <div className="flex min-h-0 flex-1">
        {navSide && <SideNav />}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-20 pt-3 lg:px-6 lg:pb-6">
          <div className="w-full animate-fade-in"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
