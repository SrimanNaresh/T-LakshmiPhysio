import { getPool, sql } from './pool.js';

// Run a parameterised query. `params` is { name: value }; referenced as @name.
// Strings go as NVarChar so Tamil / unicode text is stored correctly.
export async function query(text, params = {}, tx = null) {
  const req = tx ? new sql.Request(tx) : (await getPool()).request();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') req.input(k, sql.NVarChar(sql.MAX), v);
    else req.input(k, v === undefined ? null : v);
  }
  const r = await req.query(text);
  return r.recordset || [];
}

export async function withTransaction(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const out = await fn(tx);
    await tx.commit();
    return out;
  } catch (e) {
    try { await tx.rollback(); } catch { /* already rolled back */ }
    throw e;
  }
}

// Wrap an async route handler so thrown errors become a JSON 500.
export const h = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(req.method, req.originalUrl, e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error: ' + e.message });
  });

export function bad(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export const nz = (v) => (v === '' || v === undefined ? null : v);
export const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
