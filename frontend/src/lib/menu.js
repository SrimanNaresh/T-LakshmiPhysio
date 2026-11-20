import {
  Building2, CalendarClock, Users, ShieldCheck, UserPlus, List, Briefcase, CheckCircle2,
  ClipboardList, Repeat, Stethoscope, Dumbbell, History, Layers, Receipt, LayoutDashboard, Settings, CalendarCheck,
  BarChart3, IndianRupee,
} from 'lucide-react';

// Every screen that can be granted in Menu Access. `key` is what gets stored in MenuAccess.ScreenKey.
// `tone` is the section colour used by the menu and every screen's card header (same scheme as tayush).
export const MENU = [
  { group: 'Registration', icon: UserPlus, tone: 'teal', items: [
    { key: 'patientRegistration', label: 'Patient Registration', path: '/registration/patient', icon: UserPlus },
    { key: 'patientList', label: 'Patient List', path: '/registration/patients', icon: List },
    { key: 'employee', label: 'Employee Registration', path: '/registration/employee', icon: Briefcase },
  ] },
  { group: 'Booking / Walk-in', icon: CalendarCheck, tone: 'sky', items: [
    { key: 'confirmPatient', label: 'Confirm Patient', path: '/booking/confirm', icon: CheckCircle2 },
    { key: 'confirmList', label: 'Confirm List', path: '/booking/list', icon: ClipboardList },
    { key: 'followUp', label: 'Follow-up Patients', path: '/booking/follow-up', icon: Repeat },
  ] },
  { group: 'Examine', icon: Stethoscope, tone: 'violet', items: [
    { key: 'examine', label: 'Confirm Patient List', path: '/examine/queue', icon: Stethoscope },
    { key: 'treatmentMaster', label: 'Treatment Master', path: '/examine/treatments', icon: Dumbbell },
    { key: 'masterDetails', label: 'Master Details', path: '/examine/master-details', icon: Layers },
    { key: 'patientHistory', label: 'Patient History', path: '/examine/history', icon: History },
  ] },
  { group: 'Billing', icon: Receipt, tone: 'rose', items: [
    { key: 'billing', label: 'Billing', path: '/billing', icon: Receipt },
  ] },
  { group: 'Report', icon: BarChart3, tone: 'amber', items: [
    { key: 'collectionReport', label: 'Reports', path: '/report/collection', icon: IndianRupee },
  ] },
  { group: 'Configuration', icon: Settings, tone: 'slate', items: [
    { key: 'clinic', label: 'Clinic Master', path: '/config/clinic', icon: Building2 },
    { key: 'validity', label: 'Validity', path: '/config/validity', icon: CalendarClock },
    { key: 'users', label: 'User Master', path: '/config/users', icon: Users },
    { key: 'menuAccess', label: 'Menu Access', path: '/config/menu-access', icon: ShieldCheck },
  ] },
];

export const DASHBOARD = { key: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard };
export const ALL_SCREENS = MENU.flatMap((g) => g.items);

export const canSee = (screens, key) => screens?.includes('*') || screens?.includes(key);

// Full class names (not built from parts) so Tailwind keeps them.
export const TONES = {
  brand: { chip: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500', text: 'text-brand-700', grad: 'from-brand-500 to-brand-700', ring: 'ring-brand-100' },
  teal: { chip: 'bg-teal-50 text-teal-600', bar: 'bg-teal-500', text: 'text-teal-700', grad: 'from-teal-500 to-teal-700', ring: 'ring-teal-100' },
  sky: { chip: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500', text: 'text-sky-700', grad: 'from-sky-500 to-sky-700', ring: 'ring-sky-100' },
  violet: { chip: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500', text: 'text-violet-700', grad: 'from-violet-500 to-violet-700', ring: 'ring-violet-100' },
  rose: { chip: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500', text: 'text-rose-700', grad: 'from-rose-500 to-rose-700', ring: 'ring-rose-100' },
  amber: { chip: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500', text: 'text-amber-700', grad: 'from-amber-400 to-amber-600', ring: 'ring-amber-100' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500', text: 'text-emerald-700', grad: 'from-emerald-500 to-emerald-700', ring: 'ring-emerald-100' },
  slate: { chip: 'bg-slate-100 text-slate-600', bar: 'bg-slate-500', text: 'text-slate-700', grad: 'from-slate-500 to-slate-700', ring: 'ring-slate-200' },
};

// The menu section a page belongs to: { group, label, icon, tone }.
export function sectionOf(pathname) {
  for (const g of MENU) {
    const item = g.items.find((i) => i.path === pathname);
    if (item) return { group: g.group, label: item.label, icon: item.icon, tone: TONES[g.tone] };
  }
  return { group: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard, tone: TONES.brand };
}
