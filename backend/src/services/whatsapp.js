// WhatsApp Web link-up: the clinic phone scans a QR code once, then the server sends messages
// (text + images) by itself through a headless Chrome running WhatsApp Web (whatsapp-web.js).
// Unofficial: WhatsApp may block a number that sends a lot of automated messages — keep it to
// patient messages the staff choose to send.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import wweb from 'whatsapp-web.js';

const { Client, LocalAuth, MessageMedia } = wweb;
const here = path.dirname(fileURLToPath(import.meta.url));
// Login session is kept here so a server restart does not need a new scan. Never commit it.
const DATA_DIR = process.env.WHATSAPP_SESSION_DIR || path.resolve(here, '../../.wwebjs_auth');

// Use the Chrome / Edge already on the machine (the npm install skips Puppeteer's own browser).
function browserPath() {
  const list = [
    process.env.WHATSAPP_CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return list.find((p) => p && fs.existsSync(p));
}

// state: 'off' (not started) | 'starting' | 'qr' (waiting for scan) | 'ready' | 'error'
const S = { state: 'off', qr: null, error: null, me: null };
let client = null;
let shownQr = false; // a QR was shown in this start (so a timeout means "not scanned", not a broken session)

// Watchdog. On a restored login (e.g. after a server restart) whatsapp-web.js sometimes never fires
// 'ready' even though WhatsApp Web is connected and synced in Chrome, which left the app on
// "Connecting…" for ever. While starting, look at the page itself: if it is connected and synced,
// mark it ready; if it is still not up after STUCK_MS, restart Chrome (the saved login is kept).
const WATCH_MS = 4000;
const STUCK_MS = 150000;
const MAX_RESTARTS = 2;
let watch = null;
let startedAt = 0;
let restarts = 0;

const stopWatch = () => { if (watch) clearInterval(watch); watch = null; };

function markReady(me, how) {
  stopWatch();
  restarts = 0;
  Object.assign(S, { state: 'ready', qr: null, error: null, me });
  console.log(`WhatsApp linked (${me})${how ? ` — ${how}` : ''}`);
}

async function probe(c) {
  const page = c?.pupPage;
  if (!page || page.isClosed()) return null;
  return page.evaluate(() => {
    try {
      const sock = window.require('WAWebSocketModel').Socket;
      const meMod = window.require('WAWebUserPrefsMeUser');
      const me = meMod.getMaybeMePnUser?.() || meMod.getMaybeMeLidUser?.();
      return { state: sock.state, synced: sock.hasSynced === true, utils: typeof window.WWebJS !== 'undefined', me: me?.user || null };
    } catch { return null; }
  }).catch(() => null);
}

function startWatch(c) {
  stopWatch();
  startedAt = Date.now();
  watch = setInterval(async () => {
    if (client !== c || S.state === 'ready' || S.state === 'qr' || S.state === 'error') { if (client !== c || S.state === 'ready') stopWatch(); return; }
    const p = await probe(c);
    if (client !== c || S.state === 'ready') return;
    if (p?.state === 'CONNECTED' && p.synced && p.utils && p.me) { markReady(p.me, 'recovered, ready event was missed'); return; }
    if (Date.now() - startedAt < STUCK_MS) return;
    stopWatch();
    client = null;
    try { await c.destroy(); } catch { /* already closed */ }
    if (restarts < MAX_RESTARTS) {
      restarts++;
      console.log(`WhatsApp: still connecting after ${STUCK_MS / 1000}s — restarting (${restarts}/${MAX_RESTARTS})`);
      start(false);
    } else {
      restarts = 0;
      Object.assign(S, { state: 'error', qr: null, error: 'WhatsApp did not finish connecting. Click Try again; if it keeps happening, Unlink in Clinic Master and scan again.' });
    }
  }, WATCH_MS);
}

// A saved login that Chrome was killed in the middle of writing can no longer load WhatsApp Web.
// Remove it so the next start shows a fresh QR code.
// On Windows Chrome keeps the profile files locked for a moment after it is closed, so wait and retry
// until the folder is really gone (a half-removed profile is just as broken as before).
async function wipeSession() {
  for (let i = 0; i < 10 && fs.existsSync(DATA_DIR); i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { fs.rmSync(DATA_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch { /* still locked, retry */ }
  }
  if (fs.existsSync(DATA_DIR)) console.error('WhatsApp: could not remove the saved session folder', DATA_DIR);
  else console.log('WhatsApp: removed saved session');
}

async function start(retry = true) {
  if (client) return;
  shownQr = false;
  const exe = browserPath();
  if (!exe) { Object.assign(S, { state: 'error', error: 'Chrome or Edge was not found on the server. Set WHATSAPP_CHROME_PATH in .env.' }); return; }
  Object.assign(S, { state: 'starting', qr: null, error: null });
  const hadSession = fs.existsSync(DATA_DIR);
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: DATA_DIR }),
    // After a scan, the first sync of a busy phone can take longer than the default 30 s.
    authTimeoutMs: 60000,
    puppeteer: { headless: true, executablePath: exe, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });
  client.on('qr', async (qr) => {
    if (!shownQr) console.log('WhatsApp: QR code ready — scan it from the clinic phone');
    shownQr = true; S.state = 'qr'; S.qr = await QRCode.toDataURL(qr, { margin: 1, width: 280 });
  });
  // Give the first sync after a scan its full time before the watchdog calls it stuck.
  client.on('authenticated', () => { S.qr = null; if (S.state !== 'ready') { S.state = 'starting'; startedAt = Date.now(); } });
  client.on('ready', () => markReady(client?.info?.wid?.user || null));
  client.on('auth_failure', (m) => { Object.assign(S, { state: 'error', error: `WhatsApp login failed: ${m}` }); });
  client.on('disconnected', async (reason) => {
    console.log('WhatsApp disconnected:', reason);
    stopWatch();
    const c = client; client = null;
    Object.assign(S, {
      state: 'error', qr: null, me: null,
      error: reason === 'LOGOUT'
        ? 'WhatsApp logged this device out (the link was removed on the phone, or the scan did not complete). Click Try again for a new QR code.'
        : `WhatsApp disconnected (${reason}). Click Try again.`,
    });
    try { await c?.destroy(); } catch { /* already closed */ }
  });
  startWatch(client);
  client.initialize().catch(async (e) => {
    stopWatch();
    const msg = e?.message || String(e);
    console.error('WhatsApp start failed:', msg);
    const c = client; client = null;
    try { await c?.destroy(); } catch { /* not started */ }
    // A saved session that never reached the QR / ready stage is broken: clear it and start over once.
    if (retry && hadSession && !shownQr) {
      S.state = 'starting';
      await wipeSession();
      return start(false);
    }
    Object.assign(S, {
      state: 'error', qr: null,
      error: shownQr ? 'The QR code was not scanned in time, or the phone did not finish linking. Click Try again.' : `WhatsApp could not start: ${msg}`,
    });
  });
}

// Close Chrome properly when the server stops (also on the dev auto-restart), so the saved login
// is not left half-written.
let closing = false;
async function shutdown(sig) {
  if (closing) return;
  closing = true;
  stopWatch();
  const c = client; client = null;
  try { await c?.destroy(); } catch { /* already closed */ }
  process.exit(sig === 'SIGINT' ? 130 : 0);
}
['SIGINT', 'SIGTERM'].forEach((sig) => process.once(sig, () => shutdown(sig)));

// Started on first use (not at server boot), so a restart of the server while the phone is linking
// does not kill Chrome half-way. A machine that was linked before reconnects on the first status check.
export const status = () => {
  if (S.state === 'off' && !client && fs.existsSync(DATA_DIR)) start();
  return { state: S.state, qr: S.state === 'qr' ? S.qr : null, error: S.error, number: S.me };
};
export const connect = () => start();

export async function logout() {
  stopWatch();
  const c = client; client = null;
  Object.assign(S, { state: 'off', qr: null, me: null, error: null });
  if (c) {
    try { await c.logout(); } catch { /* session may already be gone */ }
    try { await c.destroy(); } catch { /* closed */ }
  }
  await wipeSession();
}

// Send the text, then each image (with its caption) to one number. images: [{ dataUrl, caption, name }]
export async function send(number, text, images = []) {
  if (S.state !== 'ready' || !client) {
    const e = new Error('WhatsApp is not connected. Scan the QR code first.'); e.status = 409; throw e;
  }
  const id = await client.getNumberId(number);
  if (!id) { const e = new Error(`+${number} is not on WhatsApp`); e.status = 400; throw e; }
  const chat = id._serialized;
  if (text?.trim()) await client.sendMessage(chat, text.trim());
  for (const img of images) {
    const m = /^data:([^;]+);base64,(.+)$/s.exec(img.dataUrl || '');
    if (!m) continue;
    await client.sendMessage(chat, new MessageMedia(m[1], m[2], img.name), { caption: img.caption });
  }
  return { sent: 1 + images.length };
}

