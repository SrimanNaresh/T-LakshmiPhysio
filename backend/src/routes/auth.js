import { Router } from 'express';
import { query, h, bad } from '../db/query.js';
import { verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function currentValidity() {
  const rows = await query(`SELECT TOP 1 PlanName, StartDate, EndDate,
      DATEDIFF(DAY, CAST(GETDATE() AS DATE), EndDate) AS DaysLeft
    FROM Validity ORDER BY EndDate DESC`);
  return rows[0] || null;
}

async function screensFor(user) {
  if (user.Role === 'Admin') return ['*'];
  const rows = await query('SELECT ScreenKey FROM MenuAccess WHERE UserId=@id', { id: user.UserId });
  return rows.map((r) => r.ScreenKey);
}

router.post('/login', h(async (req, res) => {
  const { userName, password } = req.body || {};
  if (!userName || !password) throw bad('Enter user name and password');
  const [user] = await query('SELECT * FROM AppUser WHERE UserName=@u', { u: String(userName).trim() });
  if (!user || !verifyPassword(password, user.PasswordHash)) throw bad('Invalid user name or password', 401);
  if (!user.IsActive) throw bad('This user is inactive. Contact the administrator.', 403);

  const validity = await currentValidity();
  const expired = !validity || validity.DaysLeft < 0;
  if (expired && user.Role !== 'Admin') {
    throw bad('Software validity has expired. Please contact the administrator to renew.', 403);
  }
  const token = signToken({ id: user.UserId, userName: user.UserName, role: user.Role });
  res.json({
    token,
    user: { id: user.UserId, userName: user.UserName, fullName: user.FullName, role: user.Role },
    screens: await screensFor(user),
    validity,
  });
}));

router.get('/me', requireAuth, h(async (req, res) => {
  const [user] = await query('SELECT * FROM AppUser WHERE UserId=@id AND IsActive=1', { id: req.user.id });
  if (!user) throw bad('User not found or inactive', 401);
  res.json({
    user: { id: user.UserId, userName: user.UserName, fullName: user.FullName, role: user.Role },
    screens: await screensFor(user),
    validity: await currentValidity(),
  });
}));

export default router;
