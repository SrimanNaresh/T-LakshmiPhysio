// Registration: Patients, Employees (Reception / Doctor)
import { Router } from 'express';
import { query, h, bad, nz, num } from '../db/query.js';

const router = Router();

/* ---------- Patients ---------- */
router.get('/patients', h(async (req, res) => {
  const { search = '', name = '', mobile = '', from, to } = req.query;
  res.json(await query(`SELECT TOP 500 * FROM Patient
    WHERE IsActive=1
      AND (@s='' OR Name LIKE '%'+@s+'%' OR MobileNo LIKE '%'+@s+'%' OR PatientCode LIKE '%'+@s+'%')
      AND (@n='' OR Name LIKE '%'+@n+'%')
      AND (@m='' OR MobileNo LIKE '%'+@m+'%')
      AND (@f IS NULL OR CAST(CreatedAt AS DATE) >= @f)
      AND (@t IS NULL OR CAST(CreatedAt AS DATE) <= @t)
    ORDER BY PatientId DESC`,
  { s: String(search).trim(), n: String(name).trim(), m: String(mobile).trim(), f: nz(from) || null, t: nz(to) || null }));
}));

// The Patient ID the next registration will get (a preview: if two people register at the same
// moment, the second one gets the following number — the saved record always shows the real ID).
router.get('/patients/next-id', h(async (req, res) => {
  const [r] = await query(`
    SELECT CAST(CASE WHEN last_value IS NULL THEN seed_value ELSE CAST(last_value AS BIGINT) + CAST(increment_value AS BIGINT) END AS INT) AS NextId
    FROM sys.identity_columns WHERE object_id = OBJECT_ID('Patient')`);
  const n = r?.NextId ?? 1;
  res.json({ nextId: n, PatientCode: 'LP' + String(n).padStart(5, '0') });
}));

router.get('/patients/:id', h(async (req, res) => {
  const [p] = await query('SELECT * FROM Patient WHERE PatientId=@id', { id: Number(req.params.id) });
  if (!p) throw bad('Patient not found', 404);
  res.json(p);
}));

router.post('/patients', h(async (req, res) => {
  const b = req.body || {};
  if (!b.Name?.trim()) throw bad('Name is required');
  if (b.MobileNo && !/^\d{10}$/.test(String(b.MobileNo).trim())) throw bad('Mobile No must be 10 digits');
  const p = {
    n: b.Name.trim(), m: nz(b.MobileNo?.trim?.() ?? b.MobileNo), a: b.Age === '' || b.Age == null ? null : Number(b.Age),
    g: nz(b.Gender), ad: nz(b.Address), r: nz(b.Referral),
  };
  if (b.PatientId) {
    await query('UPDATE Patient SET Name=@n, MobileNo=@m, Age=@a, Gender=@g, Address=@ad, Referral=@r WHERE PatientId=@id',
      { ...p, id: b.PatientId });
    const [row] = await query('SELECT * FROM Patient WHERE PatientId=@id', { id: b.PatientId });
    return res.json(row);
  }
  const [row] = await query(`INSERT INTO Patient (Name, MobileNo, Age, Gender, Address, Referral)
    OUTPUT INSERTED.* VALUES (@n,@m,@a,@g,@ad,@r)`, p);
  res.json(row);
}));

router.delete('/patients/:id', h(async (req, res) => {
  await query('UPDATE Patient SET IsActive=0 WHERE PatientId=@id', { id: Number(req.params.id) });
  res.json({ ok: true });
}));

/* ---------- Employees ---------- */
router.get('/employees', h(async (req, res) => {
  const { type = '' } = req.query;
  res.json(await query(`SELECT * FROM Employee WHERE IsActive=1 AND (@t='' OR EmpType=@t) ORDER BY Name`,
    { t: String(type) }));
}));

router.post('/employees', h(async (req, res) => {
  const b = req.body || {};
  if (!b.Name?.trim()) throw bad('Name is required');
  if (!['Reception', 'Doctor'].includes(b.EmpType)) throw bad('Type must be Reception or Doctor');
  const isDoc = b.EmpType === 'Doctor';
  if (isDoc && (!b.WorkDays?.length || !b.FromTime || !b.ToTime)) throw bad('Select Days, From Time and To Time for a Doctor');
  const days = Array.isArray(b.WorkDays) ? b.WorkDays.join(',') : b.WorkDays;
  const p = {
    n: b.Name.trim(), m: nz(b.MobileNo), t: b.EmpType, a: nz(b.Address),
    d: isDoc ? nz(days) : null, f: isDoc ? nz(b.FromTime) : null, to: isDoc ? nz(b.ToTime) : null,
    bf: isDoc ? nz(b.BreakFrom) : null, bt: isDoc ? nz(b.BreakTo) : null, fee: isDoc ? num(b.DoctorFee) : null,
  };
  if (b.EmployeeId) {
    await query(`UPDATE Employee SET Name=@n, MobileNo=@m, EmpType=@t, Address=@a, WorkDays=@d, FromTime=@f,
      ToTime=@to, BreakFrom=@bf, BreakTo=@bt, DoctorFee=@fee WHERE EmployeeId=@id`, { ...p, id: b.EmployeeId });
  } else {
    await query(`INSERT INTO Employee (Name, MobileNo, EmpType, Address, WorkDays, FromTime, ToTime, BreakFrom, BreakTo, DoctorFee)
      VALUES (@n,@m,@t,@a,@d,@f,@to,@bf,@bt,@fee)`, p);
  }
  res.json({ ok: true });
}));

router.delete('/employees/:id', h(async (req, res) => {
  await query('UPDATE Employee SET IsActive=0 WHERE EmployeeId=@id', { id: Number(req.params.id) });
  res.json({ ok: true });
}));

export default router;
