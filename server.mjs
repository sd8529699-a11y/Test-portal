/**
 * MCE Exam Portal - Express server
 *  - `npm run dev`   : Vite dev server + email API, ek hi port (3000) par
 *  - `npm run build` ke baad `npm start` : dist/ serve + email API
 *
 * Email API:  POST /api/send-results   body: { "testId": "test_123" }
 * Server khud Firestore se us test ke submissions aur students ke email padhta hai,
 * isliye bahar se koi bhi apni marzi ke address par mail nahi bhej sakta.
 */
import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import nodemailer from 'nodemailer';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROD = process.argv.includes('--prod');
const PORT = Number(process.env.PORT) || 3000;

// ---------- Firebase (wahi config jo src/services/storage.ts mein hai) ----------
const firebaseConfig = {
  apiKey: 'AIzaSyDDyWDDgLmgL_zXq1I_p7i9ca7l2nFt4J8',
  authDomain: 'exam-portal-18495.firebaseapp.com',
  projectId: 'exam-portal-18495',
  storageBucket: 'exam-portal-18495.firebasestorage.app',
  messagingSenderId: '785313781415',
  appId: '1:785313781415:web:323746970a2d0d309a6d82',
};
const db = getFirestore(initializeApp(firebaseConfig));

// ---------- Gmail ----------
const GMAIL_USER = (process.env.GMAIL_USER || '').trim();
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
const FROM_NAME = process.env.MAIL_FROM_NAME || 'MCE Examination Portal';
const mailConfigured = () => !!(GMAIL_USER && GMAIL_APP_PASSWORD);

const transporter = mailConfigured()
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      pool: true,
      maxConnections: 2,
    })
  : null;

const esc = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const row = (label, value) =>
  `<tr><td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;width:40%">${label}</td>` +
  `<td style="padding:8px 10px;border:1px solid #e2e8f0">${value}</td></tr>`;

function buildEmail(s, testTitle, testCode) {
  const status = s.passed ? 'PASS' : 'FAIL';
  const color = s.passed ? '#16a34a' : '#dc2626';
  const subject = `Result: ${testTitle}`;
  const text =
    `Dear ${s.studentName},\n\nYour result for ${testTitle} has been published.\n\n` +
    `Name: ${s.studentName}\nRegistration No: ${s.studentReg}\nRoll No: ${s.studentRoll}\n` +
    `Marks: ${s.totalMarks} / ${s.maxMarks} (${s.percentageScore}%)\nResult: ${status}\n` +
    `Correct / Wrong / Skipped: ${s.correctAnswersCount} / ${s.incorrectAnswersCount} / ${s.unattemptedCount}\n`;
  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;color:#0f172a">
  <div style="background:#0f172a;color:#ffffff;padding:18px 24px">
    <div style="font-size:18px;font-weight:bold">${esc(FROM_NAME)}</div>
    <div style="font-size:13px;color:#cbd5e1;margin-top:4px">Result Notification</div>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px">Dear <b>${esc(s.studentName)}</b>,</p>
    <p style="margin:0 0 16px;font-size:14px">Your result for <b>${esc(testTitle)}</b> has been published.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${row('Name', `<b>${esc(s.studentName)}</b>`)}
      ${row('Registration No', `<b>${esc(s.studentReg)}</b>`)}
      ${row('Roll No', esc(s.studentRoll))}
      ${row('Test', `${esc(testTitle)}${testCode ? ` (${esc(testCode)})` : ''}`)}
      ${row('Marks', `<b>${esc(s.totalMarks)} / ${esc(s.maxMarks)}</b> (${esc(s.percentageScore)}%)`)}
      ${row('Result', `<b style="color:${color}">${status}</b>`)}
      ${row('Correct / Wrong / Skipped', `${esc(s.correctAnswersCount)} / ${esc(s.incorrectAnswersCount)} / ${esc(s.unattemptedCount)}`)}
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#64748b">This is an automatically generated email. Please do not reply.</p>
  </div>
</div>`;
  return { subject, text, html };
}

// ---------- API ----------
const app = express();
app.use(express.json({ limit: '100kb' }));

const sendingNow = new Set(); // ek test ke liye ek time par ek hi bulk send

app.get('/api/health', (_req, res) => res.json({ ok: true, mailConfigured: mailConfigured() }));

app.post('/api/send-results', async (req, res) => {
  const testId = String(req.body?.testId || '').trim();
  if (!testId) return res.status(400).json({ error: 'testId missing' });
  if (!transporter) {
    return res.status(500).json({
      error: 'Gmail set nahi hai. .env mein GMAIL_USER aur GMAIL_APP_PASSWORD daalo aur server restart karo.',
    });
  }
  if (sendingNow.has(testId)) {
    return res.status(429).json({ error: 'Is test ke emails abhi bheje ja rahe hain. Thoda ruko.' });
  }

  sendingNow.add(testId);
  try {
    const testSnap = await getDoc(doc(db, 'tests', testId));
    if (!testSnap.exists()) return res.status(404).json({ error: 'Test Firestore mein nahi mila.' });
    const test = testSnap.data();
    const testTitle = test.title || test.name || test.subject || `Test ${testId}`;
    const testCode = test.code || '';

    const [subSnap, stuSnap] = await Promise.all([
      getDocs(query(collection(db, 'submissions'), where('testId', '==', testId))),
      getDocs(collection(db, 'students')),
    ]);
    const emailById = new Map();
    stuSnap.forEach((d) => {
      const st = d.data();
      emailById.set(String(st.id ?? d.id), String(st.email || '').trim());
    });

    const report = { total: subSnap.size, sent: 0, failed: [], noEmail: [] };
    const jobs = [];
    subSnap.forEach((d) => {
      const s = d.data();
      const email = String(s.studentEmail || emailById.get(String(s.studentId)) || '').trim();
      if (!EMAIL_RE.test(email)) report.noEmail.push(s.studentName || s.studentReg || 'Unknown');
      else jobs.push({ s, email });
    });

    for (let i = 0; i < jobs.length; i++) {
      const { s, email } = jobs[i];
      try {
        const mail = buildEmail(s, testTitle, testCode);
        await transporter.sendMail({
          from: `"${FROM_NAME}" <${GMAIL_USER}>`,
          to: email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        report.sent++;
      } catch (e) {
        report.failed.push({
          name: s.studentName,
          email,
          reason: String(e?.message || e).slice(0, 140),
        });
      }
      if (i < jobs.length - 1) await sleep(300);
    }

    console.log(`[mail] ${testTitle}: sent ${report.sent}, failed ${report.failed.length}, no-email ${report.noEmail.length}`);
    res.json(report);
  } catch (e) {
    console.error('[mail] error:', e);
    res.status(500).json({ error: String(e?.message || e).slice(0, 200) });
  } finally {
    sendingNow.delete(testId);
  }
});

// ---------- Frontend ----------
const server = http.createServer(app);
server.requestTimeout = 0; // bade batch mein email bhejne mein time lag sakta hai

if (PROD) {
  const dist = path.join(__dirname, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    server: { middlewareMode: true, hmr: process.env.DISABLE_HMR === 'true' ? false : { server } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Portal running on http://localhost:${PORT}  (${PROD ? 'production' : 'development'})`);
  console.log(`  Email: ${mailConfigured() ? 'Gmail ready (' + GMAIL_USER + ')' : 'NOT configured (.env mein GMAIL_USER / GMAIL_APP_PASSWORD)'}\n`);
});
