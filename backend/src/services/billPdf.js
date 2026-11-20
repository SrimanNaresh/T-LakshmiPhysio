// Bill receipt as a PDF (same layout as the printed receipt on the Billing screen), for sending
// on WhatsApp. Rendered by the headless Chrome that the WhatsApp link-up already runs.
import { query } from '../db/query.js';
import { pdfFromHtml } from './whatsapp.js';

export async function loadBill(id) {
  const [bill] = await query(`
    SELECT bl.*, p.PatientCode, p.Name AS PatientName, p.MobileNo, p.Age, p.Gender, p.Address,
           e.Name AS DoctorName
    FROM Bill bl JOIN Patient p ON p.PatientId=bl.PatientId
    LEFT JOIN Visit v ON v.VisitId=bl.VisitId
    LEFT JOIN Employee e ON e.EmployeeId=v.DoctorId
    WHERE bl.BillId=@id`, { id: Number(id) });
  if (!bill) return null;
  bill.treatments = bill.VisitId
    ? await query('SELECT TreatmentName, Fee FROM VisitTreatment WHERE VisitId=@v', { v: bill.VisitId }) : [];
  return bill;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// DATETIME values are clinic wall-clock times read as UTC by the driver: format the digits as-is
// (same rule as the frontend's fDateTime).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fDateTime(v) {
  if (!v) return '';
  const m = (v instanceof Date ? v.toISOString() : String(v)).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return '';
  const date = `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
  if (m[4] === undefined) return date;
  const h = Number(m[4]);
  return `${date} ${((h + 11) % 12) + 1}:${m[5]} ${h < 12 ? 'AM' : 'PM'}`;
}

export function billHtml(bill, clinic) {
  const logo = /^data:image\//.test(clinic.Logo || '') ? `<img class="logo" src="${clinic.Logo}" alt="">` : '';
  const contact = [clinic.ContactNo, clinic.EmailId].filter(Boolean).map(esc).join(' · ');
  const row = (label, amount, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="r">${amount}</td></tr>`;
  const rows = [
    row('Doctor Fee', money(bill.DoctorFee)),
    ...(bill.treatments || []).map((t) => row(esc(t.TreatmentName), money(t.Fee), 'sub')),
    row('Treatment Fee', money(bill.TreatmentFee)),
    Number(bill.Discount) > 0 ? row('Discount', `- ${money(bill.Discount)}`) : '',
    row('Net Amount', money(bill.NetAmount), 'net'),
  ].join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A5; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", Inter, Roboto, "Noto Sans", Arial, sans-serif; font-size: 11px; color: #1e293b; }
  .head { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #1e293b; padding-bottom: 10px; }
  .logo { width: 52px; height: 52px; object-fit: contain; }
  .clinic { font-size: 17px; font-weight: 700; }
  .muted { color: #475569; font-size: 10px; }
  .title { text-align: center; font-weight: 600; letter-spacing: .08em; margin: 14px 0 10px; font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; row-gap: 4px; }
  .grid .r, td.r { text-align: right; }
  .full { grid-column: 1 / -1; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
  td { padding: 6px 0; }
  tr.sub td { padding: 3px 0 3px 8px; color: #475569; }
  tr.net td { border-top: 1px solid #cbd5e1; font-weight: 700; font-size: 13px; padding: 8px 0; }
  .sign { margin-top: 40px; text-align: right; }
  .thanks { margin-top: 16px; text-align: center; color: #64748b; }
</style></head><body>
  <div class="head">${logo}<div>
    <div class="clinic">${esc(clinic.ClinicName || 'Lakshmi Physio')}</div>
    ${clinic.DoctorName ? `<div>${esc(clinic.DoctorName)}</div>` : ''}
    ${clinic.Address ? `<div class="muted">${esc(clinic.Address)}</div>` : ''}
    ${contact ? `<div class="muted">${contact}</div>` : ''}
  </div></div>
  <div class="title">RECEIPT</div>
  <div class="grid">
    <div>Bill No: <b>${esc(bill.BillNo)}</b></div><div class="r">Date: ${fDateTime(bill.BillDate)}</div>
    <div>Patient ID: <b>${esc(bill.PatientCode)}</b></div><div class="r">Mobile: ${esc(bill.MobileNo)}</div>
    <div class="full">Name: <b>${esc(bill.PatientName)}</b>${bill.Age ? ` (${esc(bill.Age)} yrs)` : ''}</div>
    ${bill.DoctorName ? `<div class="full">Doctor: ${esc(bill.DoctorName)}</div>` : ''}
  </div>
  <table><tbody>${rows}</tbody></table>
  <div style="margin-top:8px">Paid by: ${esc(bill.PaymentMode)}</div>
  <div class="sign">Authorised Signature</div>
  <div class="thanks">Thank you. Get well soon!</div>
</body></html>`;
}

// Returns the PDF as a Buffer.
export const billPdf = (bill, clinic) => pdfFromHtml(billHtml(bill, clinic));
