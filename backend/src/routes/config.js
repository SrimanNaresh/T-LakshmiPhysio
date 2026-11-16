// Configuration: Clinic Master, Validity, User Master, Menu Access
import { Router } from 'express';
import { query, h, bad, nz, withTransaction } from '../db/query.js';
import { hashPassword } from '../utils/password.js';

const router = Router();

function adminOnly(req) {
  if (req.user.role !== 'Admin') throw bad('Only an Admin can change this', 403);
}

/* ---------- Clinic Master (single row) ---------- */
router.get('/clinic', h(async (req, res) => {
  const [row] = await query('SELECT TOP 1 * FROM ClinicMaster ORDER BY ClinicId');
  res.json(row || {});
}));

router.put('/clinic', h(async (req, res) => {
  const b = req.body || {};
  if (!b.ClinicName?.trim()) throw bad('Clinic Name is required');
  const p = {
    n: b.ClinicName.trim(), d: nz(b.DoctorName), e: nz(b.EmailId), c: nz(b.ContactNo),
    a: nz(b.Address), l: nz(b.Logo), app: nz(b.AppName),
  };
  const [row] = await query('SELECT TOP 1 ClinicId FROM ClinicMaster ORDER BY ClinicId');
  if (row) {
    await query(`UPDATE ClinicMaster SET ClinicName=@n, DoctorName=@d, EmailId=@e, ContactNo=@c,
      Address=@a, Logo=@l, AppName=@app, UpdatedAt=GETDATE() WHERE ClinicId=@id`, { ...p, id: row.ClinicId });
  } else {
    await query(`INSERT INTO ClinicMaster (ClinicName, DoctorName, EmailId, ContactNo, Address, Logo, AppName)
      VALUES (@n,@d,@e,@c,@a,@l,@app)`, p);
  }
  res.json({ ok: true });
}));

/* ---------- Validity ---------- */
router.get('/validity', h(async (req, res) => {
  res.json(await query(`SELECT *, DATEDIFF(DAY, CAST(GETDATE() AS DATE), EndDate) AS DaysLeft
    FROM Validity ORDER BY EndDate DESC`));
}));

router.post('/validity', h(async (req, res) => {
  adminOnly(req);
  const b = req.body || {};
  if (!b.PlanName || !b.StartDate || !b.EndDate) throw bad('Plan, Start Date and End Date are required');
  if (b.EndDate < b.StartDate) throw bad('End Date must be after Start Date');
  const p = { p: b.PlanName, s: b.StartDate, e: b.EndDate, n: nz(b.Notes) };
  if (b.ValidityId) {
    await query('UPDATE Validity SET PlanName=@p, StartDate=@s, EndDate=@e, Notes=@n WHERE ValidityId=@id', { ...p, id: b.ValidityId });
  } else {
    await query('INSERT INTO Validity (PlanName, StartDate, EndDate, Notes) VALUES (@p,@s,@e,@n)', p);
  }
  res.json({ ok: true });
}));

router.delete('/validity/:id', h(async (req, res) => {
  adminOnly(req);
  await query('DELETE FROM Validity WHERE ValidityId=@id', { id: Number(req.params.id) });
  res.json({ ok: true });
}));

/* ---------- User Master ---------- */
router.get('/users', h(async (req, res) => {
  res.json(await query('SELECT UserId, UserName, FullName, Role, IsActive, CreatedAt FROM AppUser ORDER BY UserName'));
}));

router.post('/users', h(async (req, res) => {
  adminOnly(req);
  const b = req.body || {};
  if (!b.UserName?.trim()) throw bad('User Name is required');
  const p = { u: b.UserName.trim(), f: nz(b.FullName), r: b.Role || 'Reception', a: b.IsActive === false ? 0 : 1 };
  const dup = await query('SELECT UserId FROM AppUser WHERE UserName=@u AND UserId<>@id', { u: p.u, id: b.UserId || 0 });
  if (dup.length) throw bad('User Name already exists');
  if (b.UserId) {
    if (Number(b.UserId) === Number(req.user.id) && (p.a === 0 || p.r !== 'Admin')) {
      throw bad('You cannot deactivate or demote your own account');
    }
    await query('UPDATE AppUser SET UserName=@u, FullName=@f, Role=@r, IsActive=@a WHERE UserId=@id', { ...p, id: b.UserId });
    if (b.Password) {
      await query('UPDATE AppUser SET PasswordHash=@hsh WHERE UserId=@id', { hsh: hashPassword(b.Password), id: b.UserId });
    }
  } else {
    if (!b.Password) throw bad('Password is required');
    await query('INSERT INTO AppUser (UserName, FullName, PasswordHash, Role, IsActive) VALUES (@u,@f,@hsh,@r,@a)',
      { ...p, hsh: hashPassword(b.Password) });
  }
  res.json({ ok: true });
}));

/* ---------- Menu Access ---------- */
router.get('/menu-access/:userId', h(async (req, res) => {
  const rows = await query('SELECT ScreenKey FROM MenuAccess WHERE UserId=@id', { id: Number(req.params.userId) });
  res.json(rows.map((r) => r.ScreenKey));
}));

router.put('/menu-access/:userId', h(async (req, res) => {
  adminOnly(req);
  const id = Number(req.params.userId);
  const screens = Array.isArray(req.body?.screens) ? req.body.screens : [];
  await withTransaction(async (tx) => {
    await query('DELETE FROM MenuAccess WHERE UserId=@id', { id }, tx);
    for (const s of screens) {
      await query('INSERT INTO MenuAccess (UserId, ScreenKey) VALUES (@id, @s)', { id, s: String(s) }, tx);
    }
  });
  res.json({ ok: true });
}));

export default router;
