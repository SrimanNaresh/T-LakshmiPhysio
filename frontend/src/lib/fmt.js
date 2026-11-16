// DATETIME values are clinic wall-clock times. The API serialises them with a "Z",
// but they are NOT UTC — so format the digits as-is instead of going through Date's timezone logic.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  return m ? { y: m[1], mo: Number(m[2]), d: m[3], h: m[4], mi: m[5] } : null;
}

export function fDate(v) {
  const p = parts(v);
  return p ? `${p.d}-${MONTHS[p.mo - 1]}-${p.y}` : '';
}

export function fTime(v) {
  const p = parts(v);
  if (!p || p.h === undefined) return '';
  const h = Number(p.h);
  return `${((h + 11) % 12) + 1}:${p.mi} ${h < 12 ? 'AM' : 'PM'}`;
}

export const fDateTime = (v) => (v ? `${fDate(v)} ${fTime(v)}` : '');

// "HH:mm" (24h) -> "h:mm AM"
export function fClock(hm) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const pad = (n) => String(n).padStart(2, '0');
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function nowLocal() {
  const d = new Date();
  return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const isoDate = (v) => (v ? String(v).slice(0, 10) : '');

export const money = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
