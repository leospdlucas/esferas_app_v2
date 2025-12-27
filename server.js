import "dotenv/config";
import express from "express";
import morgan from "morgan";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import QRCode from "qrcode";
import nodemailer from "nodemailer";

import { db, migrate } from "./db.js";
import { authRequired, adminOnly } from "./auth_middleware.js";
import { loadQuestions, validateAnswers, computeScores, normalizeAffinities, computeTriangleCoords } from "./server_scoring.js";

const app = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error("Falta JWT_SECRET. Configure no .env (use .env.example).");
  process.exit(1);
}

migrate();
const questions = loadQuestions();

// Ensure optional columns (idempotent)
function ensureColumns() {
  const alterStatements = [
    "ALTER TABLE users ADD COLUMN invite_id INTEGER",
    "ALTER TABLE users ADD COLUMN reset_code TEXT",
    "ALTER TABLE users ADD COLUMN reset_code_expires TEXT"
  ];
  
  for (const sql of alterStatements) {
    try {
      db.prepare(sql).run();
    } catch (e) {
      // column probably exists
    }
  }
}
ensureColumns();

// Email transporter setup
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log("Email transporter configurado:", process.env.SMTP_HOST);
} else {
  console.log("SMTP não configurado. Recuperação de senha mostrará código no console.");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Seed admin
function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Administrador";
  if (!email || !password) return;

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = db.prepare("SELECT id, role FROM users WHERE email = ?").get(normalizedEmail);

  const password_hash = bcrypt.hashSync(String(password), 10);

  if (!existing) {
    db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES (?,?,?, 'admin')")
      .run(name, normalizedEmail, password_hash);
    console.log("Admin criado:", normalizedEmail);
    return;
  }

  db.prepare("UPDATE users SET role = 'admin', password_hash = ?, name = ? WHERE id = ?")
    .run(password_hash, name, existing.id);

  console.log("Admin garantido (upsert):", normalizedEmail);
}
seedAdmin();

app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

// Static
app.use(express.static(path.join(process.cwd(), "public")));

// Helpers
function issueToken(u) {
  return jwt.sign(
    { id: u.id, role: u.role, name: u.name, email: u.email },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function generateResetCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

async function sendResetEmail(email, code) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a1a; color: #f1f5f9; padding: 40px; }
        .container { max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(99, 102, 241, 0.3); }
        h1 { color: #8b5cf6; font-size: 24px; margin-bottom: 20px; }
        .code { font-family: 'Courier New', monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #06b6d4; background: rgba(6, 182, 212, 0.1); padding: 20px 30px; border-radius: 12px; text-align: center; margin: 30px 0; border: 1px solid rgba(6, 182, 212, 0.3); }
        p { color: #94a3b8; line-height: 1.6; }
        .footer { margin-top: 30px; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Recuperação de Senha</h1>
        <p>Você solicitou a redefinição de senha da sua conta no DTE.</p>
        <p>Use o código abaixo para criar uma nova senha:</p>
        <div class="code">${code}</div>
        <p>Este código expira em <strong>15 minutos</strong>.</p>
        <p>Se você não solicitou esta alteração, ignore este email.</p>
        <div class="footer">DTE - Diagrama de Tendência Esferal</div>
      </div>
    </body>
    </html>
  `;

  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "DTE - Código de Recuperação de Senha",
      html: htmlContent
    });
    console.log(`Email de recuperação enviado para: ${email}`);
  } else {
    console.log(`\n========================================`);
    console.log(`CÓDIGO DE RECUPERAÇÃO PARA: ${email}`);
    console.log(`CÓDIGO: ${code}`);
    console.log(`========================================\n`);
  }
}

// Auth routes
app.post("/api/register", (req, res) => {
  const { name, email, password, inviteCode } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Informe nome, e-mail e senha." });
  if (String(password).length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });

  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (exists) return res.status(409).json({ error: "E-mail já cadastrado." });

  let invite_id = null;
  if (inviteCode) {
    const code = String(inviteCode).trim();
    const inv = db.prepare("SELECT id, expires_at, max_uses, uses FROM invites WHERE code = ?").get(code);
    if (!inv) return res.status(400).json({ error: "Convite inválido." });

    if (inv.expires_at) {
      const exp = new Date(inv.expires_at + "Z");
      if (Number.isFinite(exp.getTime()) && exp.getTime() < Date.now()) {
        return res.status(400).json({ error: "Convite expirado." });
      }
    }
    if (inv.max_uses && inv.max_uses > 0 && inv.uses >= inv.max_uses) {
      return res.status(400).json({ error: "Convite já foi utilizado o máximo permitido." });
    }
    invite_id = inv.id;
  }

  const password_hash = bcrypt.hashSync(String(password), 10);
  const info = db.prepare("INSERT INTO users(name,email,password_hash,role,invite_id) VALUES (?,?,?, 'user', ?)")
    .run(String(name).trim(), normalizedEmail, password_hash, invite_id);

  if (invite_id) {
    db.prepare("UPDATE invites SET uses = uses + 1 WHERE id = ?").run(invite_id);
  }

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Informe e-mail e senha." });

  const normalizedEmail = String(email).trim().toLowerCase();
  const u = db.prepare("SELECT id,name,email,password_hash,role FROM users WHERE email = ?").get(normalizedEmail);
  if (!u) return res.status(401).json({ error: "Credenciais inválidas." });

  const ok = bcrypt.compareSync(String(password), u.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas." });

  res.json({ token: issueToken(u), role: u.role, name: u.name, email: u.email });
});

// Password reset routes
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Informe o e-mail." });

  const normalizedEmail = String(email).trim().toLowerCase();
  const u = db.prepare("SELECT id, email FROM users WHERE email = ?").get(normalizedEmail);
  
  // Always return success to prevent email enumeration
  if (!u) {
    return res.json({ ok: true, message: "Se o e-mail existir, você receberá um código." });
  }

  const code = generateResetCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  db.prepare("UPDATE users SET reset_code = ?, reset_code_expires = ? WHERE id = ?")
    .run(code, expiresAt, u.id);

  try {
    await sendResetEmail(normalizedEmail, code);
    res.json({ ok: true, message: "Código enviado para o e-mail." });
  } catch (err) {
    console.error("Erro ao enviar email:", err);
    res.status(500).json({ error: "Erro ao enviar e-mail. Tente novamente." });
  }
});

app.post("/api/verify-reset-code", (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: "Informe e-mail e código." });

  const normalizedEmail = String(email).trim().toLowerCase();
  const u = db.prepare("SELECT id, reset_code, reset_code_expires FROM users WHERE email = ?").get(normalizedEmail);
  
  if (!u || !u.reset_code) {
    return res.status(400).json({ error: "Código inválido ou expirado." });
  }

  if (u.reset_code !== String(code).trim()) {
    return res.status(400).json({ error: "Código incorreto." });
  }

  const expires = new Date(u.reset_code_expires);
  if (expires < new Date()) {
    return res.status(400).json({ error: "Código expirado. Solicite um novo." });
  }

  res.json({ ok: true, message: "Código válido." });
});

app.post("/api/reset-password", (req, res) => {
  const { email, code, newPassword } = req.body || {};
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "Informe e-mail, código e nova senha." });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const u = db.prepare("SELECT id, reset_code, reset_code_expires FROM users WHERE email = ?").get(normalizedEmail);
  
  if (!u || !u.reset_code) {
    return res.status(400).json({ error: "Código inválido ou expirado." });
  }

  if (u.reset_code !== String(code).trim()) {
    return res.status(400).json({ error: "Código incorreto." });
  }

  const expires = new Date(u.reset_code_expires);
  if (expires < new Date()) {
    return res.status(400).json({ error: "Código expirado. Solicite um novo." });
  }

  const password_hash = bcrypt.hashSync(String(newPassword), 10);
  db.prepare("UPDATE users SET password_hash = ?, reset_code = NULL, reset_code_expires = NULL WHERE id = ?")
    .run(password_hash, u.id);

  res.json({ ok: true, message: "Senha alterada com sucesso." });
});

app.get("/api/me", authRequired, (req, res) => {
  res.json(req.user);
});

// Questions (shuffled)
app.get("/api/questions", authRequired, (req, res) => {
  const payload = shuffle(questions).map(q => ({ id: q.id, text: q.text }));
  res.json(payload);
});

// Submission
app.post("/api/submit", authRequired, (req, res) => {
  const { answersById } = req.body || {};
  if (!answersById || typeof answersById !== "object") {
    return res.status(400).json({ error: "Formato inválido de respostas." });
  }

  const { ok, missing } = validateAnswers(questions, answersById);
  if (!ok) return res.status(400).json({ error: `Respostas incompletas/inválidas.` });

  const { S_M, S_C, S_R } = computeScores(questions, answersById);
  const { w_M, w_C, w_R } = normalizeAffinities(S_M, S_C, S_R);
  const { x, y } = computeTriangleCoords(w_M, w_C, w_R);

  db.prepare("DELETE FROM submissions WHERE user_id = ?").run(req.user.id);

  db.prepare(`
    INSERT INTO submissions(user_id, answers_json, S_M, S_C, S_R, w_M, w_C, w_R, x, y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    JSON.stringify(answersById),
    S_M, S_C, S_R, w_M, w_C, w_R, x, y
  );

  res.json({ ok: true });
});

app.get("/api/my-latest", authRequired, (req, res) => {
  const row = db.prepare(`
    SELECT id, created_at, answers_json as answersById, S_M, S_C, S_R, w_M, w_C, w_R, x, y
    FROM submissions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(req.user.id);

  if (!row) return res.status(404).json({ error: "Sem respostas." });

  row.answersById = JSON.parse(row.answersById);
  res.json(row);
});

// Admin routes
app.post("/api/admin/invites", authRequired, adminOnly, (req, res) => {
  const { expiresDays, maxUses } = req.body || {};
  const max_uses = Number.isFinite(Number(maxUses)) ? Math.max(0, Math.floor(Number(maxUses))) : 0;

  let expires_at = null;
  if (expiresDays !== undefined && expiresDays !== null && String(expiresDays).trim() !== "") {
    const days = Number(expiresDays);
    if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ error: "expiresDays deve ser um número > 0." });
    const ms = days * 24 * 60 * 60 * 1000;
    expires_at = new Date(Date.now() + ms).toISOString().slice(0, 19).replace("T", " ");
  }

  const code = crypto.randomBytes(16).toString("hex");
  db.prepare("INSERT INTO invites(code, created_by, expires_at, max_uses, uses) VALUES (?,?,?,?,0)")
    .run(code, req.user.id, expires_at, max_uses);

  const absoluteUrl = `${req.protocol}://${req.get("host")}/invite.html?code=${code}`;
  res.json({
    code,
    expires_at,
    max_uses,
    url: `/invite.html?code=${code}`,
    absoluteUrl,
    qrPngUrl: `/api/invites/${code}/qr.png`
  });
});

app.get("/api/admin/invites", authRequired, adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT id, code, created_at, expires_at, max_uses, uses
    FROM invites
    ORDER BY created_at DESC
    LIMIT 200
  `).all();
  res.json(rows);
});

app.get("/api/admin/invites/:code/qr.png", authRequired, adminOnly, async (req, res) => {
  const code = String(req.params.code || "").trim();
  const inv = db.prepare("SELECT code FROM invites WHERE code = ?").get(code);
  if (!inv) return res.status(404).json({ error: "Convite não encontrado." });

  const absoluteUrl = `${req.protocol}://${req.get("host")}/invite.html?code=${code}`;
  try {
    const png = await QRCode.toBuffer(absoluteUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: { dark: "#6366f1", light: "#ffffff" }
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.send(png);
  } catch (e) {
    return res.status(500).json({ error: "Falha ao gerar QR Code." });
  }
});

app.get("/api/invites/:code/qr.png", async (req, res) => {
  const code = String(req.params.code || "").trim();
  const inv = db.prepare("SELECT code FROM invites WHERE code = ?").get(code);
  if (!inv) return res.status(404).json({ error: "Convite não encontrado." });

  const absoluteUrl = `${req.protocol}://${req.get("host")}/invite.html?code=${code}`;
  try {
    const png = await QRCode.toBuffer(absoluteUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: { dark: "#6366f1", light: "#ffffff" }
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(png);
  } catch (e) {
    return res.status(500).json({ error: "Falha ao gerar QR Code." });
  }
});

app.get("/api/admin/users", authRequired, adminOnly, (req, res) => {
  const rows = db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC").all();
  res.json(rows);
});

app.get("/api/admin/search", authRequired, adminOnly, (req, res) => {
  const q = String(req.query.query || "").trim();
  if (!q) return res.json([]);
  const like = `%${q.toLowerCase()}%`;
  const rows = db.prepare(`
    SELECT id, name, email
    FROM users
    WHERE lower(name) LIKE ? OR lower(email) LIKE ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(like, like);
  res.json(rows);
});

app.get("/api/admin/user/:id", authRequired, adminOnly, (req, res) => {
  const userId = Number(req.params.id);
  const user = db.prepare("SELECT id,name,email,role,created_at FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

  const latest = db.prepare(`
    SELECT id, created_at, answers_json as answersById, S_M, S_C, S_R, w_M, w_C, w_R, x, y
    FROM submissions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(userId);

  if (latest) latest.answersById = JSON.parse(latest.answersById);

  res.json({ user, latest });
});

app.get("/api/admin/aggregate", authRequired, adminOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT S_M, S_C, S_R, w_M, w_C, w_R, x, y
    FROM submissions
  `).all();

  const n = rows.length;
  if (n === 0) {
    return res.json({ n: 0, S_M: 0, S_C: 0, S_R: 0, w_M: 1/3, w_C: 1/3, w_R: 1/3, points: [] });
  }

  const avg = (k) => rows.reduce((s, r) => s + Number(r[k]), 0) / n;

  res.json({
    n,
    S_M: avg("S_M"),
    S_C: avg("S_C"),
    S_R: avg("S_R"),
    w_M: avg("w_M"),
    w_C: avg("w_C"),
    w_R: avg("w_R"),
    points: rows.map(r => ({ x: r.x, y: r.y }))
  });
});

// Health check endpoint for keep-alive
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Keep-alive ping endpoint (lightweight)
app.get("/api/ping", (req, res) => {
  res.send("pong");
});

app.listen(PORT, () => {
  console.log(`DTE rodando em http://localhost:${PORT}`);
});
