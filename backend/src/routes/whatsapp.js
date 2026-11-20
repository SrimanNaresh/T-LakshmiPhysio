import { Router } from 'express';
import { query, h, bad } from '../db/query.js';
import * as wa from '../services/whatsapp.js';
import { loadBill, billPdf } from '../services/billPdf.js';

const router = Router();

// International number without "+"; local 10-digit numbers get India's 91 (same rule as the frontend).
export const waNumber = (mobile) => {
  let d = String(mobile || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return d;
};

const clinicRow = async () => (await query('SELECT TOP 1 ClinicId, WhatsAppNo, WhatsAppOwner, WhatsAppVerifiedAt FROM ClinicMaster ORDER BY ClinicId'))[0];

// The sender check: the phone linked by QR code must be the WhatsApp number saved in Clinic Master.
// Scanning the code proves the phone is in the clinic's hands and that the number is on WhatsApp,
// so a match marks the number verified.
async function checkSender() {
  const c = await clinicRow();
  const saved = waNumber(c?.WhatsAppNo);
  const st = wa.status();
  const linked = st.number ? waNumber(st.number) : null;
  let verified = !!(c?.WhatsAppVerifiedAt && saved && linked === saved);
  let problem = null;
  if (!saved) problem = 'Add the clinic / doctor WhatsApp number in Clinic Master first.';
  else if (st.state !== 'ready') problem = 'WhatsApp is not connected. Scan the QR code in Clinic Master first.';
  else if (linked !== saved) problem = `The linked phone is +${linked}, but Clinic Master has +${saved}. Unlink and scan with the +${saved} phone.`;
  else if (!c.WhatsAppVerifiedAt) {
    await query('UPDATE ClinicMaster SET WhatsAppVerifiedAt=GETDATE() WHERE ClinicId=@id', { id: c.ClinicId });
    verified = true;
  }
  const [row] = verified ? await query('SELECT WhatsAppVerifiedAt FROM ClinicMaster WHERE ClinicId=@id', { id: c.ClinicId }) : [];
  return { saved, linked, verified, verifiedAt: row?.WhatsAppVerifiedAt || null, owner: c?.WhatsAppOwner || 'Clinic', problem };
}

async function requireSender() {
  const s = await checkSender();
  if (!s.verified) throw bad(s.problem || 'The WhatsApp number is not verified.', 409);
  return s;
}

router.get('/whatsapp/status', (req, res) => res.json(wa.status()));
router.post('/whatsapp/connect', (req, res) => { wa.connect(); res.json(wa.status()); });
router.post('/whatsapp/logout', h(async (req, res) => {
  await wa.logout();
  await query('UPDATE ClinicMaster SET WhatsAppVerifiedAt=NULL');
  res.json(wa.status());
}));

// Clinic Master: link status plus whether the linked phone is the saved number (verifies it on a match).
router.post('/whatsapp/verify', h(async (req, res) => res.json({ ...wa.status(), ...(await checkSender()) })));

// Send to the patient's own number (taken from the patient record, not from the browser).
async function patientNumber(pid) {
  if (!pid) throw bad('Patient is required');
  const [p] = await query('SELECT Name, MobileNo FROM Patient WHERE PatientId=@pid', { pid });
  if (!p) throw bad('Patient not found', 404);
  const number = waNumber(p.MobileNo);
  if (number.length < 11) throw bad('This patient has no valid mobile number');
  return number;
}

// Send the chosen exercise / modality images and the message to the patient.
router.post('/whatsapp/send-exercises', h(async (req, res) => {
  const b = req.body || {};
  const pid = Number(b.PatientId);
  const ids = [...new Set((Array.isArray(b.SubTitleIds) ? b.SubTitleIds : []).map(Number).filter(Boolean))];
  if (!ids.length) throw bad('Select at least one exercise');
  if (ids.length > 30) throw bad('Send at most 30 images at a time');
  const number = await patientNumber(pid);
  await requireSender();

  const rows = await query(`SELECT s.MasterSubTitleId, s.SubTitle, s.Image, t.Title FROM MasterSubTitle s
    JOIN MasterTitle t ON t.MasterTitleId=s.MasterTitleId
    WHERE s.MasterSubTitleId IN (${ids.map((_, i) => `@i${i}`).join(',')})`,
  Object.fromEntries(ids.map((id, i) => [`i${i}`, id])));
  const byId = new Map(rows.map((r) => [r.MasterSubTitleId, r]));
  // Keep the order the staff picked; number captions to match the message.
  const images = ids.map((id) => byId.get(id)).filter((r) => r?.Image).map((r, i) => ({
    dataUrl: r.Image, caption: `${i + 1}. ${r.Title} › ${r.SubTitle}`, name: `${r.SubTitle}.jpg`,
  }));

  try {
    const out = await wa.send(number, String(b.Text || ''), images);
    res.json({ ...out, number, images: images.length });
  } catch (e) { throw bad(e.message, e.status || 500); }
}));

// Bill receipt as a PDF document, with a short caption, to the bill's patient.
router.post('/whatsapp/send-bill', h(async (req, res) => {
  const bill = await loadBill(Number(req.body?.BillId));
  if (!bill) throw bad('Bill not found', 404);
  const number = await patientNumber(bill.PatientId);
  await requireSender();
  const [clinic] = await query('SELECT TOP 1 * FROM ClinicMaster ORDER BY ClinicId');
  const c = clinic || {};
  const caption = [
    `Hello ${bill.PatientName}, thank you for visiting ${c.ClinicName || 'Lakshmi Physio'}.`,
    c.ContactNo ? `For queries call ${c.ContactNo}.` : '',
  ].filter(Boolean).join('\n');
  try {
    const pdf = await billPdf(bill, c);
    const out = await wa.send(number, '', [{ dataUrl: `data:application/pdf;base64,${pdf.toString('base64')}`, name: `Bill-${bill.BillNo}.pdf`, caption }]);
    res.json({ ...out, number, billNo: bill.BillNo });
  } catch (e) { throw bad(e.message, e.status || 500); }
}));

// Free message to a patient: text plus image / PDF files chosen by the staff.
// Files: [{ dataUrl, name, caption? }]
const MAX_FILES = 10;
const MAX_FILE = 10 * 1024 * 1024;
const MAX_TOTAL = 15 * 1024 * 1024;
const OK_TYPE = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/;
router.post('/whatsapp/send', h(async (req, res) => {
  const b = req.body || {};
  const text = String(b.Text || '').slice(0, 4000);
  const files = Array.isArray(b.Files) ? b.Files : [];
  if (!text.trim() && !files.length) throw bad('Type a message or attach a file');
  if (files.length > MAX_FILES) throw bad(`Send at most ${MAX_FILES} files at a time`);
  let total = 0;
  const media = files.map((f) => {
    const m = /^data:([^;]+);base64,(.+)$/s.exec(f?.dataUrl || '');
    if (!m || !OK_TYPE.test(m[1])) throw bad(`${f?.name || 'A file'} is not an image or PDF`);
    const size = Math.floor((m[2].length * 3) / 4);
    if (size > MAX_FILE) throw bad(`${f.name} is larger than 10 MB`);
    total += size;
    return { dataUrl: f.dataUrl, name: String(f.name || 'file').slice(0, 120), caption: f.caption ? String(f.caption).slice(0, 1000) : undefined };
  });
  if (total > MAX_TOTAL) throw bad('Files together must be under 15 MB');
  const number = await patientNumber(Number(b.PatientId));
  await requireSender();
  try {
    const out = await wa.send(number, text, media);
    res.json({ ...out, number, files: media.length });
  } catch (e) { throw bad(e.message, e.status || 500); }
}));

export default router;
