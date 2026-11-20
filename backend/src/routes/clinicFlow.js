// Booking / Walk-in, Examine, Treatment master, Patient History, Billing, Dashboard
import { Router } from 'express';
import { query, h, bad, nz, num, withTransaction } from '../db/query.js';
import { loadBill } from '../services/billPdf.js';

const router = Router();

const BOOKING_SELECT = `
  SELECT b.*, p.PatientCode, p.Name AS PatientName, p.MobileNo, p.Age, p.Gender,
         e.Name AS DoctorName, e.DoctorFee
  FROM Booking b
  JOIN Patient p ON p.PatientId = b.PatientId
  LEFT JOIN Employee e ON e.EmployeeId = b.DoctorId`;

/* ---------- Booking / Walk-in ---------- */
router.get('/bookings', h(async (req, res) => {
  const { from, to, status = '', search = '' } = req.query;
  res.json(await query(`${BOOKING_SELECT}
    WHERE (@f IS NULL OR CAST(b.ConfirmTime AS DATE) >= @f)
      AND (@t IS NULL OR CAST(b.ConfirmTime AS DATE) <= @t)
      AND (@st='' OR b.Status=@st)
      AND (@s='' OR p.Name LIKE '%'+@s+'%' OR p.MobileNo LIKE '%'+@s+'%' OR p.PatientCode LIKE '%'+@s+'%')
    ORDER BY b.ConfirmTime DESC`,
  { f: nz(from) || null, t: nz(to) || null, st: String(status), s: String(search).trim() }));
}));

router.post('/bookings', h(async (req, res) => {
  const b = req.body || {};
  if (!b.PatientId) throw bad('Select a patient');
  // Times are clinic wall-clock (IST) values, same as GETDATE() on the SQL server.
  // "YYYY-MM-DDTHH:mm" from the browser is passed through as text, never via a JS Date (that would shift it to UTC).
  const when = b.ConfirmTime ? String(b.ConfirmTime).replace('T', ' ') : null;
  if (when && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(when)) throw bad('Invalid confirm time');
  const dup = await query(`SELECT BookingId FROM Booking WHERE PatientId=@p AND Status='Confirmed'
      AND CAST(ConfirmTime AS DATE) = CAST(ISNULL(CAST(@w AS DATETIME), GETDATE()) AS DATE)`, { p: Number(b.PatientId), w: when });
  if (dup.length) throw bad('This patient is already confirmed for that day');
  const [row] = await query(`INSERT INTO Booking (PatientId, DoctorId, BookingType, ConfirmTime, Notes, CreatedBy)
    OUTPUT INSERTED.BookingId VALUES (@p, @d, @bt, ISNULL(CAST(@w AS DATETIME), GETDATE()), @n, @u)`, {
    p: Number(b.PatientId), d: b.DoctorId ? Number(b.DoctorId) : null, bt: b.BookingType || 'Walk-in',
    w: when, n: nz(b.Notes), u: req.user.userName,
  });
  res.json(row);
}));

router.put('/bookings/:id/cancel', h(async (req, res) => {
  const [bk] = await query('SELECT Status FROM Booking WHERE BookingId=@id', { id: Number(req.params.id) });
  if (!bk) throw bad('Not found', 404);
  if (bk.Status !== 'Confirmed') throw bad(`Cannot cancel a booking that is already ${bk.Status}`);
  await query(`UPDATE Booking SET Status='Cancelled' WHERE BookingId=@id`, { id: Number(req.params.id) });
  res.json({ ok: true });
}));

/* ---------- Follow-up patients ---------- */
// One row per scheduled follow-up date of each patient's latest visit.
// A date counts as Confirmed when the patient has a booking on it or before the next scheduled date.
router.get('/follow-ups', h(async (req, res) => {
  const { from, to } = req.query;
  res.json(await query(`
    WITH fu AS (
      SELECT VisitFollowUpId, VisitId, FollowUpDate,
             LEAD(FollowUpDate) OVER (PARTITION BY VisitId ORDER BY FollowUpDate) AS NextDate,
             ROW_NUMBER() OVER (PARTITION BY VisitId ORDER BY FollowUpDate) AS SessionNo,
             COUNT(*) OVER (PARTITION BY VisitId) AS Sessions
      FROM VisitFollowUp)
    SELECT fu.VisitFollowUpId, fu.FollowUpDate, fu.SessionNo, fu.Sessions,
           v.VisitId, v.VisitDate, v.AssessmentNotes, v.PatientId,
           p.PatientCode, p.Name AS PatientName, p.MobileNo, v.DoctorId, e.Name AS DoctorName,
           CASE WHEN EXISTS (SELECT 1 FROM Booking b WHERE b.PatientId=v.PatientId AND b.Status<>'Cancelled'
                              AND CAST(b.ConfirmTime AS DATE) >= fu.FollowUpDate
                              AND (fu.NextDate IS NULL OR CAST(b.ConfirmTime AS DATE) < fu.NextDate)) THEN 'Confirmed'
                WHEN fu.FollowUpDate < CAST(GETDATE() AS DATE) THEN 'Missed'
                ELSE 'Pending' END AS FollowUpStatus
    FROM fu
    JOIN Visit v ON v.VisitId=fu.VisitId
    JOIN Patient p ON p.PatientId=v.PatientId
    LEFT JOIN Employee e ON e.EmployeeId=v.DoctorId
    WHERE (@f IS NULL OR fu.FollowUpDate >= @f) AND (@t IS NULL OR fu.FollowUpDate <= @t)
      AND NOT EXISTS (SELECT 1 FROM Visit v2 WHERE v2.PatientId=v.PatientId AND v2.VisitId>v.VisitId)
    ORDER BY fu.FollowUpDate, p.Name`, { f: nz(from) || null, t: nz(to) || null }));
}));

// Move one follow-up date (Follow-up Patients screen). Visit.FollowUpDate keeps the earliest of the visit's dates.
router.put('/follow-ups/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  const d = String(req.body?.FollowUpDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) throw bad('Enter a valid follow-up date');
  const [fu] = await query(`SELECT f.VisitFollowUpId, f.VisitId, CONVERT(char(10), v.VisitDate, 23) AS VisitDay
    FROM VisitFollowUp f JOIN Visit v ON v.VisitId=f.VisitId WHERE f.VisitFollowUpId=@id`, { id });
  if (!fu) throw bad('Follow-up not found', 404);
  if (d < fu.VisitDay) throw bad('Follow-up date cannot be before the visit date');
  const [dup] = await query('SELECT 1 AS x FROM VisitFollowUp WHERE VisitId=@v AND FollowUpDate=@d AND VisitFollowUpId<>@id',
    { v: fu.VisitId, d, id });
  if (dup) throw bad('This patient already has a follow-up on that date');
  await withTransaction(async (tx) => {
    await query('UPDATE VisitFollowUp SET FollowUpDate=@d WHERE VisitFollowUpId=@id', { d, id }, tx);
    await query('UPDATE Visit SET FollowUpDate=(SELECT MIN(FollowUpDate) FROM VisitFollowUp WHERE VisitId=@v) WHERE VisitId=@v',
      { v: fu.VisitId }, tx);
  });
  res.json({ ok: true });
}));

/* ---------- Treatment master ---------- */
router.get('/treatments', h(async (req, res) => {
  res.json(await query('SELECT * FROM Treatment WHERE IsActive=1 ORDER BY TreatmentName'));
}));

router.post('/treatments', h(async (req, res) => {
  const b = req.body || {};
  if (!b.TreatmentName?.trim()) throw bad('Treatment is required');
  const p = { n: b.TreatmentName.trim(), e: nz(b.Exercise), f: num(b.Fee) };
  if (b.TreatmentId) {
    await query('UPDATE Treatment SET TreatmentName=@n, Exercise=@e, Fee=@f WHERE TreatmentId=@id', { ...p, id: b.TreatmentId });
  } else {
    await query('INSERT INTO Treatment (TreatmentName, Exercise, Fee) VALUES (@n,@e,@f)', p);
  }
  res.json({ ok: true });
}));

router.delete('/treatments/:id', h(async (req, res) => {
  await query('UPDATE Treatment SET IsActive=0 WHERE TreatmentId=@id', { id: Number(req.params.id) });
  res.json({ ok: true });
}));

/* ---------- Follow-up options ---------- */
// Entries the doctor adds to the Examine "Visit" (repeat every N days) and "For" (span of N days)
// drop-downs. The built-in choices live in the frontend; only added ones are stored here.
const FOLLOW_UP_KINDS = ['repeat', 'span'];
let followUpTableReady = null;
const ensureFollowUpOptionTable = () => {
  followUpTableReady ||= query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='FollowUpOption' AND xtype='U')
    CREATE TABLE FollowUpOption (
        OptionId  INT IDENTITY(1,1) PRIMARY KEY,
        Kind      NVARCHAR(10) NOT NULL,
        Label     NVARCHAR(60) NOT NULL,
        Days      INT NOT NULL,
        CreatedBy NVARCHAR(100) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_FollowUpOption UNIQUE (Kind, Days)
    );`).catch((e) => { followUpTableReady = null; throw e; });
  return followUpTableReady;
};

router.get('/follow-up-options', h(async (req, res) => {
  await ensureFollowUpOptionTable();
  res.json(await query('SELECT OptionId, Kind, Label, Days FROM FollowUpOption ORDER BY Kind, Days'));
}));

router.post('/follow-up-options', h(async (req, res) => {
  const b = req.body || {};
  const label = String(b.Label || '').trim();
  const days = Math.round(Number(b.Days));
  if (!FOLLOW_UP_KINDS.includes(b.Kind)) throw bad('Invalid option type');
  if (!label) throw bad('Name is required');
  if (label.length > 60) throw bad('Name is too long');
  if (!Number.isFinite(days) || days < 1 || days > 365) throw bad('Days must be between 1 and 365');
  await ensureFollowUpOptionTable();
  const [dup] = await query('SELECT OptionId, Kind, Label, Days FROM FollowUpOption WHERE Kind=@k AND Days=@d', { k: b.Kind, d: days });
  if (dup) return res.json(dup); // same number of days already listed: reuse it
  const [row] = await query(`INSERT INTO FollowUpOption (Kind, Label, Days, CreatedBy)
    OUTPUT INSERTED.OptionId, INSERTED.Kind, INSERTED.Label, INSERTED.Days VALUES (@k, @l, @d, @u)`,
  { k: b.Kind, l: label, d: days, u: req.user.userName });
  res.json(row);
}));

router.delete('/follow-up-options/:id', h(async (req, res) => {
  await ensureFollowUpOptionTable();
  await query('DELETE FROM FollowUpOption WHERE OptionId=@id', { id: Number(req.params.id) });
  res.json({ ok: true });
}));

/* ---------- Examine ---------- */
// Follow-up dates from the form: FollowUpDates (list) or the older single FollowUpDate.
function followUpDates(b) {
  const list = Array.isArray(b.FollowUpDates) ? b.FollowUpDates : (b.FollowUpDate ? [b.FollowUpDate] : []);
  const out = [...new Set(list.filter(Boolean).map((d) => String(d).slice(0, 10)))].sort();
  if (out.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) throw bad('Invalid follow-up date');
  if (out.length > 90) throw bad('Too many follow-up dates');
  return out;
}

async function saveFollowUps(visitId, dates, tx) {
  await query('DELETE FROM VisitFollowUp WHERE VisitId=@v', { v: visitId }, tx);
  for (const d of dates) await query('INSERT INTO VisitFollowUp (VisitId, FollowUpDate) VALUES (@v, @d)', { v: visitId, d }, tx);
}

const followUpsOf = async (visitIds) => (visitIds.length
  ? query(`SELECT VisitId, CONVERT(CHAR(10), FollowUpDate, 23) AS D FROM VisitFollowUp
      WHERE VisitId IN (SELECT value FROM STRING_SPLIT(@ids, ',')) ORDER BY FollowUpDate`, { ids: visitIds.join(',') })
  : []);

router.post('/visits', h(async (req, res) => {
  const b = req.body || {};
  if (!b.PatientId) throw bad('Select a patient');
  const treatments = Array.isArray(b.treatments) ? b.treatments : [];
  const treatmentFee = treatments.reduce((s, t) => s + num(t.Fee), 0);
  const dates = followUpDates(b);
  const out = await withTransaction(async (tx) => {
    if (b.BookingId) {
      const [bk] = await query('SELECT Status FROM Booking WITH (UPDLOCK) WHERE BookingId=@id', { id: Number(b.BookingId) }, tx);
      if (!bk) throw bad('Booking not found', 404);
      if (bk.Status !== 'Confirmed') throw bad(`This patient is already ${bk.Status}`);
    }
    const [v] = await query(`INSERT INTO Visit (BookingId, PatientId, DoctorId, AssessmentNotes, FollowUpDate, DoctorFee, TreatmentFee, CreatedBy)
      OUTPUT INSERTED.VisitId VALUES (@b, @p, @d, @n, @fu, @df, @tf, @u)`, {
      b: b.BookingId ? Number(b.BookingId) : null, p: Number(b.PatientId), d: b.DoctorId ? Number(b.DoctorId) : null,
      n: nz(b.AssessmentNotes), fu: dates[0] || null, df: num(b.DoctorFee), tf: treatmentFee, u: req.user.userName,
    }, tx);
    await saveFollowUps(v.VisitId, dates, tx);
    for (const t of treatments) {
      await query(`INSERT INTO VisitTreatment (VisitId, TreatmentId, TreatmentName, Exercise, Fee)
        VALUES (@v, @tid, @n, @e, @f)`, {
        v: v.VisitId, tid: t.TreatmentId ? Number(t.TreatmentId) : null, n: String(t.TreatmentName || ''),
        e: nz(t.Exercise), f: num(t.Fee),
      }, tx);
    }
    if (b.BookingId) await query(`UPDATE Booking SET Status='Examined' WHERE BookingId=@id`, { id: Number(b.BookingId) }, tx);
    return v;
  });
  res.json(out);
}));

// The assessment recorded for a booking (to edit it again from the Confirm Patient List).
router.get('/visits/by-booking/:bookingId', h(async (req, res) => {
  const [v] = await query('SELECT TOP 1 * FROM Visit WHERE BookingId=@b ORDER BY VisitId DESC', { b: Number(req.params.bookingId) });
  if (!v) throw bad('No assessment recorded for this booking', 404);
  const treatments = await query('SELECT * FROM VisitTreatment WHERE VisitId=@v ORDER BY VisitTreatmentId', { v: v.VisitId });
  const fus = await followUpsOf([v.VisitId]);
  res.json({ ...v, treatments, FollowUpDates: fus.map((x) => x.D) });
}));

// Update an assessment: notes, follow-up, fee and the treatment list (replaced). Not once it is billed.
router.put('/visits/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const treatments = Array.isArray(b.treatments) ? b.treatments : [];
  const treatmentFee = treatments.reduce((s, t) => s + num(t.Fee), 0);
  const dates = followUpDates(b);
  await withTransaction(async (tx) => {
    const [v] = await query('SELECT IsBilled, BookingId FROM Visit WITH (UPDLOCK) WHERE VisitId=@id', { id }, tx);
    if (!v) throw bad('Assessment not found', 404);
    if (v.IsBilled) throw bad('This visit is already billed and cannot be changed');
    await query(`UPDATE Visit SET AssessmentNotes=@n, FollowUpDate=@fu, DoctorFee=@df, TreatmentFee=@tf WHERE VisitId=@id`, {
      id, n: nz(b.AssessmentNotes), fu: dates[0] || null, df: num(b.DoctorFee), tf: treatmentFee,
    }, tx);
    await saveFollowUps(id, dates, tx);
    await query('DELETE FROM VisitTreatment WHERE VisitId=@id', { id }, tx);
    for (const t of treatments) {
      await query(`INSERT INTO VisitTreatment (VisitId, TreatmentId, TreatmentName, Exercise, Fee)
        VALUES (@v, @tid, @n, @e, @f)`, {
        v: id, tid: t.TreatmentId ? Number(t.TreatmentId) : null, n: String(t.TreatmentName || ''),
        e: nz(t.Exercise), f: num(t.Fee),
      }, tx);
    }
    if (v.BookingId) await query(`UPDATE Booking SET Status='Examined' WHERE BookingId=@b AND Status='Confirmed'`, { b: v.BookingId }, tx);
  });
  res.json({ ok: true });
}));

/* ---------- Patient History (visit-wise) ---------- */
router.get('/visits', h(async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) throw bad('patientId is required');
  const visits = await query(`
    SELECT v.*, e.Name AS DoctorName, bl.BillId, bl.BillNo, bl.NetAmount
    FROM Visit v
    LEFT JOIN Employee e ON e.EmployeeId=v.DoctorId
    LEFT JOIN Bill bl ON bl.VisitId=v.VisitId
    WHERE v.PatientId=@p ORDER BY v.VisitDate DESC`, { p: Number(patientId) });
  const items = visits.length ? await query(`SELECT vt.* FROM VisitTreatment vt
    JOIN Visit v ON v.VisitId=vt.VisitId WHERE v.PatientId=@p`, { p: Number(patientId) }) : [];
  const fus = await followUpsOf(visits.map((v) => v.VisitId));
  res.json(visits.map((v) => ({
    ...v,
    treatments: items.filter((i) => i.VisitId === v.VisitId),
    FollowUpDates: fus.filter((x) => x.VisitId === v.VisitId).map((x) => x.D),
  })));
}));

/* ---------- Billing ---------- */
// Unbilled visits. ?date=YYYY-MM-DD limits it to that day's visits (the Billing screen sends today).
router.get('/billing/pending', h(async (req, res) => {
  const date = nz(req.query.date) || null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw bad('Invalid date');
  res.json(await query(`
    SELECT v.VisitId, v.VisitDate, v.PatientId, v.DoctorFee, v.TreatmentFee, p.PatientCode, p.Name AS PatientName,
           p.MobileNo, e.Name AS DoctorName
    FROM Visit v JOIN Patient p ON p.PatientId=v.PatientId
    LEFT JOIN Employee e ON e.EmployeeId=v.DoctorId
    WHERE v.IsBilled=0 AND (@d IS NULL OR CAST(v.VisitDate AS DATE) = @d)
    ORDER BY v.VisitDate DESC`, { d: date }));
}));

router.post('/bills', h(async (req, res) => {
  const b = req.body || {};
  if (!b.PatientId) throw bad('Select a patient');
  const df = num(b.DoctorFee), tf = num(b.TreatmentFee), disc = num(b.Discount);
  const net = df + tf - disc;
  if (net < 0) throw bad('Discount cannot exceed the total');
  const out = await withTransaction(async (tx) => {
    if (b.VisitId) {
      const [v] = await query('SELECT IsBilled, BookingId FROM Visit WITH (UPDLOCK) WHERE VisitId=@id', { id: Number(b.VisitId) }, tx);
      if (!v) throw bad('Visit not found', 404);
      if (v.IsBilled) throw bad('This visit is already billed');
      await query('UPDATE Visit SET IsBilled=1 WHERE VisitId=@id', { id: Number(b.VisitId) }, tx);
      if (v.BookingId) await query(`UPDATE Booking SET Status='Billed' WHERE BookingId=@id`, { id: v.BookingId }, tx);
    }
    const [row] = await query(`INSERT INTO Bill (VisitId, PatientId, DoctorFee, TreatmentFee, Discount, NetAmount, PaymentMode, CreatedBy)
      OUTPUT INSERTED.BillId VALUES (@v, @p, @df, @tf, @d, @net, @pm, @u)`, {
      v: b.VisitId ? Number(b.VisitId) : null, p: Number(b.PatientId), df, tf, d: disc, net,
      pm: b.PaymentMode || 'Cash', u: req.user.userName,
    }, tx);
    return row;
  });
  res.json(out);
}));

router.get('/bills', h(async (req, res) => {
  const { from, to, search = '' } = req.query;
  res.json(await query(`
    SELECT bl.*, p.PatientCode, p.Name AS PatientName, p.MobileNo
    FROM Bill bl JOIN Patient p ON p.PatientId=bl.PatientId
    WHERE (@f IS NULL OR CAST(bl.BillDate AS DATE) >= @f) AND (@t IS NULL OR CAST(bl.BillDate AS DATE) <= @t)
      AND (@s='' OR p.Name LIKE '%'+@s+'%' OR p.MobileNo LIKE '%'+@s+'%' OR bl.BillNo LIKE '%'+@s+'%')
    ORDER BY bl.BillId DESC`, { f: nz(from) || null, t: nz(to) || null, s: String(search).trim() }));
}));

router.get('/bills/:id', h(async (req, res) => {
  const bill = await loadBill(req.params.id);
  if (!bill) throw bad('Bill not found', 404);
  res.json(bill);
}));

/* ---------- Dashboard ---------- */
router.get('/dashboard', h(async (req, res) => {
  const [r] = await query(`
    DECLARE @today DATE = CAST(GETDATE() AS DATE);
    SELECT
      (SELECT COUNT(*) FROM Patient WHERE IsActive=1) AS TotalPatients,
      (SELECT COUNT(*) FROM Patient WHERE IsActive=1 AND CAST(CreatedAt AS DATE)=@today) AS NewPatients,
      (SELECT COUNT(*) FROM Booking WHERE CAST(ConfirmTime AS DATE)=@today AND Status<>'Cancelled') AS TodayConfirmed,
      (SELECT COUNT(*) FROM Booking WHERE CAST(ConfirmTime AS DATE)=@today AND Status='Confirmed') AS Waiting,
      (SELECT COUNT(*) FROM Visit WHERE CAST(VisitDate AS DATE)=@today) AS Examined,
      (SELECT COUNT(*) FROM VisitFollowUp f JOIN Visit v ON v.VisitId=f.VisitId WHERE f.FollowUpDate=@today
         AND NOT EXISTS (SELECT 1 FROM Visit v2 WHERE v2.PatientId=v.PatientId AND v2.VisitId>v.VisitId)) AS FollowUpsToday,
      (SELECT ISNULL(SUM(NetAmount),0) FROM Bill WHERE CAST(BillDate AS DATE)=@today) AS TodayCollection,
      (SELECT COUNT(*) FROM Visit WHERE IsBilled=0) AS PendingBills`);
  res.json(r);
}));

export default router;
