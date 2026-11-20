// Master Details (Examine): Exercise / Modality titles, each with sub-titles. Soft delete only.
import { Router } from 'express';
import { query, h, bad, nz } from '../db/query.js';

const router = Router();
const CATEGORIES = ['Exercise', 'Modality'];

function category(v) {
  if (!CATEGORIES.includes(v)) throw bad('Category must be Exercise or Modality');
  return v;
}

// Images arrive as data URLs from the browser; reject anything else so no external links get stored.
function image(v) {
  const s = nz(v);
  if (s === null) return null;
  if (typeof s !== 'string' || !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s)) throw bad('Image must be a PNG, JPG, WEBP or GIF');
  if (s.length > 3 * 1024 * 1024) throw bad('Image is too large');
  return s;
}

// All active titles of a category with their active sub-titles nested.
router.get('/master-details', h(async (req, res) => {
  const cat = category(req.query.category || 'Exercise');
  const titles = await query(`SELECT MasterTitleId, Category, Title, Image, CreatedAt, UpdatedAt
    FROM MasterTitle WHERE IsActive=1 AND Category=@c ORDER BY Title`, { c: cat });
  const subs = await query(`SELECT s.MasterSubTitleId, s.MasterTitleId, s.SubTitle, s.Image, s.CreatedAt
    FROM MasterSubTitle s JOIN MasterTitle t ON t.MasterTitleId = s.MasterTitleId
    WHERE s.IsActive=1 AND t.IsActive=1 AND t.Category=@c ORDER BY s.SubTitle`, { c: cat });
  res.json(titles.map((t) => ({ ...t, subs: subs.filter((s) => s.MasterTitleId === t.MasterTitleId) })));
}));

router.post('/master-details', h(async (req, res) => {
  const b = req.body || {};
  const p = { c: category(b.Category), t: String(b.Title || '').trim(), i: image(b.Image), id: Number(b.MasterTitleId) || 0 };
  if (!p.t) throw bad('Title is required');
  const dup = await query(`SELECT 1 AS x FROM MasterTitle WHERE IsActive=1 AND Category=@c AND Title=@t AND MasterTitleId<>@id`, p);
  if (dup.length) throw bad(`${p.c} "${p.t}" already exists`);
  if (p.id) {
    const r = await query(`UPDATE MasterTitle SET Title=@t, Image=@i, UpdatedAt=GETDATE()
      OUTPUT inserted.MasterTitleId WHERE MasterTitleId=@id AND IsActive=1`, p);
    if (!r.length) throw bad('Title not found', 404);
    return res.json({ ok: true, MasterTitleId: p.id });
  }
  const [row] = await query(`INSERT INTO MasterTitle (Category, Title, Image, CreatedBy)
    OUTPUT inserted.MasterTitleId VALUES (@c,@t,@i,@u)`, { ...p, u: req.user.userName });
  res.json({ ok: true, MasterTitleId: row.MasterTitleId });
}));

// Soft delete a title and its sub-titles.
router.delete('/master-details/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  await query(`UPDATE MasterSubTitle SET IsActive=0, UpdatedAt=GETDATE() WHERE MasterTitleId=@id AND IsActive=1;
    UPDATE MasterTitle SET IsActive=0, UpdatedAt=GETDATE() WHERE MasterTitleId=@id`, { id });
  res.json({ ok: true });
}));

router.post('/master-details/:id/subs', h(async (req, res) => {
  const b = req.body || {};
  const p = { mid: Number(req.params.id), s: String(b.SubTitle || '').trim(), i: image(b.Image), id: Number(b.MasterSubTitleId) || 0 };
  if (!p.s) throw bad('Sub Title is required');
  const [t] = await query('SELECT MasterTitleId FROM MasterTitle WHERE MasterTitleId=@mid AND IsActive=1', p);
  if (!t) throw bad('Title not found', 404);
  const dup = await query(`SELECT 1 AS x FROM MasterSubTitle WHERE IsActive=1 AND MasterTitleId=@mid AND SubTitle=@s AND MasterSubTitleId<>@id`, p);
  if (dup.length) throw bad(`Sub Title "${p.s}" already exists under this title`);
  if (p.id) {
    const r = await query(`UPDATE MasterSubTitle SET SubTitle=@s, Image=@i, UpdatedAt=GETDATE()
      OUTPUT inserted.MasterSubTitleId WHERE MasterSubTitleId=@id AND MasterTitleId=@mid AND IsActive=1`, p);
    if (!r.length) throw bad('Sub Title not found', 404);
  } else {
    await query(`INSERT INTO MasterSubTitle (MasterTitleId, SubTitle, Image, CreatedBy) VALUES (@mid,@s,@i,@u)`,
      { ...p, u: req.user.userName });
  }
  res.json({ ok: true });
}));

router.delete('/master-details/subs/:subId', h(async (req, res) => {
  await query('UPDATE MasterSubTitle SET IsActive=0, UpdatedAt=GETDATE() WHERE MasterSubTitleId=@id', { id: Number(req.params.subId) });
  res.json({ ok: true });
}));

/* ---------- Patient notes on a Master Details image (numbered pins + common note) ---------- */
const REF_TYPES = ['title', 'sub'];

function cleanPins(v) {
  if (!Array.isArray(v)) return [];
  if (v.length > 99) throw bad('Too many points (max 99)');
  const clamp = (n) => Math.min(1, Math.max(0, Number(n) || 0));
  return v.map((p, i) => ({ n: i + 1, x: clamp(p.x), y: clamp(p.y), text: String(p.text || '').slice(0, 4000) }));
}

const markOut = (m) => ({ ...m, Pins: m.Pins ? JSON.parse(m.Pins) : [] });

// All active image notes of a patient (used to badge the images that already have notes).
router.get('/patient-image-marks', h(async (req, res) => {
  const pid = Number(req.query.patientId);
  if (!pid) throw bad('patientId is required');
  const rows = await query(`SELECT MarkId, PatientId, RefType, RefId, Pins, CommonNote, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
    FROM PatientImageMark WHERE IsActive=1 AND PatientId=@pid`, { pid });
  res.json(rows.map(markOut));
}));

// Same notes with the image, category and names, for Patient History. Titles / sub titles that were
// deleted from Master Details later are still shown, so the history stays complete.
router.get('/patient-image-marks/detail', h(async (req, res) => {
  const pid = Number(req.query.patientId);
  if (!pid) throw bad('patientId is required');
  const rows = await query(`
    SELECT m.MarkId, m.RefType, m.RefId, m.Pins, m.CommonNote, m.CreatedBy, m.CreatedAt, m.UpdatedBy, m.UpdatedAt,
           t.Category, t.Title, s.SubTitle, COALESCE(s.Image, CASE WHEN m.RefType='title' THEN t.Image END) AS Image
    FROM PatientImageMark m
    LEFT JOIN MasterSubTitle s ON m.RefType='sub' AND s.MasterSubTitleId=m.RefId
    LEFT JOIN MasterTitle t ON t.MasterTitleId = CASE WHEN m.RefType='sub' THEN s.MasterTitleId ELSE m.RefId END
    WHERE m.IsActive=1 AND m.PatientId=@pid
    ORDER BY t.Category, m.CreatedAt, m.MarkId`, { pid });
  res.json(rows.map(markOut));
}));

// Add or edit: one active note set per patient + image.
router.put('/patient-image-marks', h(async (req, res) => {
  const b = req.body || {};
  const p = {
    pid: Number(b.PatientId), t: String(b.RefType || ''), r: Number(b.RefId),
    pins: JSON.stringify(cleanPins(b.Pins)), c: nz(String(b.CommonNote ?? '').trim()), u: req.user.userName,
  };
  if (!p.pid || !p.r || !REF_TYPES.includes(p.t)) throw bad('Patient and image are required');
  const [pat] = await query('SELECT PatientId FROM Patient WHERE PatientId=@pid', p);
  if (!pat) throw bad('Patient not found', 404);
  const [cur] = await query('SELECT MarkId FROM PatientImageMark WHERE IsActive=1 AND PatientId=@pid AND RefType=@t AND RefId=@r', p);
  let row;
  if (cur) {
    [row] = await query(`UPDATE PatientImageMark SET Pins=@pins, CommonNote=@c, UpdatedBy=@u, UpdatedAt=GETDATE()
      OUTPUT inserted.* WHERE MarkId=@id`, { ...p, id: cur.MarkId });
  } else {
    [row] = await query(`INSERT INTO PatientImageMark (PatientId, RefType, RefId, Pins, CommonNote, CreatedBy)
      OUTPUT inserted.* VALUES (@pid,@t,@r,@pins,@c,@u)`, p);
  }
  res.json(markOut(row));
}));

// Delete (soft) every point and the common note of one image for this patient.
router.delete('/patient-image-marks/:id', h(async (req, res) => {
  await query('UPDATE PatientImageMark SET IsActive=0, UpdatedBy=@u, UpdatedAt=GETDATE() WHERE MarkId=@id',
    { id: Number(req.params.id), u: req.user.userName });
  res.json({ ok: true });
}));

export default router;
