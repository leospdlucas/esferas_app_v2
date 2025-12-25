import "dotenv/config";
import express from "express";
import morgan from "morgan";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import QRCode from "qrcode";

import { pool, migrate } from "./db.js";
import { authRequired, adminOnly } from "./auth_middleware.js";
import { loadQuestions, validateAnswers, computeScores, normalizeAffinities, computeTriangleCoords } from "./server_scoring.js";

const app = express();

// Behind proxies (Render) - let Express detect HTTPS via X-Forwarded-Proto
app.set('trust proxy', 1);
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error("Falta JWT_SECRET. Configure no .env (use .env.example).");
  process.exit(1);
}

await migrate();
const questions = loadQuestions();


async function queryAll(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}
async function queryOne(sql, params = []) {
  return (await pool.query(sql, params)).rows[0] || null;
}


// Ensure optional columns (Postgres schema already includes invite_id)
// (kept for backward-compat; no-op)
function ensureInviteColumn() {}
ensureInviteColumn();


function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// Seed admin (idempotent, with upsert)
// If ADMIN_EMAIL already exists as a normal user, it is promoted to admin and password is updated.
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Administrador";
  if (!email || !password) return;

  const normalizedEmail = String(email).trim().toLowerCase();
  const { rows } = await pool.query("SELECT id, role FROM users WHERE email = $1", [normalizedEmail]);
  const existing = rows[0];
  const password_hash = bcrypt.hashSync(String(password), 10);

  if (!existing) {
    await pool.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,'admin')",
      [name, normalizedEmail, password_hash]
    );
    console.log("Admin criado:", normalizedEmail);
    return;
  }

  await pool.query(
    "UPDATE users SET role='admin', password_hash=$1, name=$2 WHERE id=$3",
    [password_hash, name, existing.id]
  );
  console.log("Admin garantido (upsert):", normalizedEmail);
}
await seedAdmin();

app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

// Keep-alive endpoint (helps free tiers that sleep after inactivity)
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});


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

// Auth routes
app.post("/api/register", async (req, res) => {
  const { name, email, password, inviteCode } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Informe nome, e-mail e senha." });
  if (String(password).length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });

  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = await queryOne("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if (exists) return res.status(409).json({ error: "E-mail já cadastrado." });

  let invite_id = null;
  if (inviteCode) {
    const code = String(inviteCode).trim();
    const inv = await queryOne("SELECT id, expires_at, max_uses, uses FROM invites WHERE code = $1", [code]);
    if (!inv) return res.status(400).json({ error: "Convite inválido." });

    if (inv.expires_at) {
      const exp = new Date(inv.expires_at);
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
  const urows = await queryAll("INSERT INTO users(name,email,password_hash,role,invite_id) VALUES ($1,$2,$3,'user',$4) RETURNING id", [String(name).trim(), normalizedEmail, password_hash, invite_id]);
  const info = { lastInsertRowid: urows[0].id };


  if (invite_id) {
    await queryAll("UPDATE invites SET uses = uses + 1 WHERE id = $1", [invite_id]);
  }

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Informe e-mail e senha." });

  const normalizedEmail = String(email).trim().toLowerCase();
  const u = await queryOne("SELECT id,name,email,password_hash,role FROM users WHERE email = $1", [normalizedEmail]);
  if (!u) return res.status(401).json({ error: "Credenciais inválidas." });

  const ok = bcrypt.compareSync(String(password), u.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas." });

  res.json({ token: issueToken(u), role: u.role, name: u.name, email: u.email });
});

app.get("/api/me", authRequired, (req, res) => {
  res.json(req.user);
});

// Questions (shuffled) - user must be authenticated
app.get("/api/questions", authRequired, (req, res) => {
  // deliver only what the client needs; axis stays server-side
  const payload = shuffle(questions).map(q => ({ id: q.id, text: q.text }));
  res.json(payload);
});


// Submission: store answers and derived scores
app.post("/api/submit", authRequired, async (req, res) => {
  const { answersById } = req.body || {};
  if (!answersById || typeof answersById !== "object") {
    return res.status(400).json({ error: "Formato inválido de respostas." });
  }

  // Validate
  const { ok, missing } = validateAnswers(questions, answersById);
  if (!ok) return res.status(400).json({ error: `Respostas incompletas/ inválidas. Faltando/ inválidas: ${missing.slice(0,10).join(", ")}${missing.length>10?"...":""}` });

  const { S_M, S_C, S_R } = computeScores(questions, answersById);
  const { w_M, w_C, w_R } = normalizeAffinities(S_M, S_C, S_R);
  const { x, y } = computeTriangleCoords(w_M, w_C, w_R);

  if (req.user.role === "admin") {
    return res.status(403).json({ error: "Admins não podem enviar respostas. Crie um usuário comum para responder." });
  }

  // Overwrite: keep only the most recent submission per user
  // overwrite previous submission (most recent wins)


  await queryAll(`
  INSERT INTO submissions(user_id, answersById, S_M, S_C, S_R, w_M, w_C, w_R, x, y)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  ON CONFLICT (user_id) DO UPDATE SET
    created_at = NOW(),
    answersById = EXCLUDED.answersById,
    S_M = EXCLUDED.S_M,
    S_C = EXCLUDED.S_C,
    S_R = EXCLUDED.S_R,
    w_M = EXCLUDED.w_M,
    w_C = EXCLUDED.w_C,
    w_R = EXCLUDED.w_R,
    x = EXCLUDED.x,
    y = EXCLUDED.y
`, [
  req.user.id,
  JSON.stringify(answersById),
  S_M, S_C, S_R,
  w_M, w_C, w_R,
  x, y
]);
res.json({ ok: true });
});

app.get("/api/my-latest", authRequired, async (req, res) => {
  const row = await queryOne(`
    SELECT id, created_at, answersById, S_M, S_C, S_R, w_M, w_C, w_R, x, y
    FROM submissions
    WHERE user_id = $1
    LIMIT 1
  `, [req.user.id]);

  if (!row) return res.status(404).json({ error: "Sem respostas." });

  row.answersById = row.answersbyid || row.answersById;
  if (typeof row.answersById === "string") row.answersById = JSON.parse(row.answersById);
  res.json(row);
});


// Admin

// Admin - create invite links
app.post("/api/admin/invites", authRequired, adminOnly, async (req, res) => {
  const { expiresDays, maxUses } = req.body || {};
  const max_uses = Number.isFinite(Number(maxUses)) ? Math.max(0, Math.floor(Number(maxUses))) : 0;

  let expires_at = null;
  if (expiresDays !== undefined && expiresDays !== null && String(expiresDays).trim() !== "") {
    const days = Number(expiresDays);
    if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ error: "expiresDays deve ser um número > 0." });
    const ms = days * 24 * 60 * 60 * 1000;
    expires_at = new Date(Date.now() + ms).toISOString();
  }

  const code = crypto.randomBytes(16).toString("hex");
  await queryAll("INSERT INTO invites(code, created_by, expires_at, max_uses, uses) VALUES ($1,$2,$3,$4,0)", [code, req.user.id, expires_at, max_uses]);

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

app.get("/api/admin/invites", authRequired, adminOnly, async (req, res) => {
  const rows = await queryAll(`
    SELECT id, code, created_at, expires_at, max_uses, uses
    FROM invites
    ORDER BY created_at DESC
    LIMIT 200
  `, []);
  res.json(rows);
});

app.get("/api/admin/invites/:code/qr.png", authRequired, adminOnly, async (req, res) => {
  const code = String(req.params.code || "").trim();
  const inv = await queryOne("SELECT code FROM invites WHERE code = $1", [code]);
  if (!inv) return res.status(404).json({ error: "Convite não encontrado." });

  const absoluteUrl = `${req.protocol}://${req.get("host")}/invite.html?code=${code}`;
  try {
    const png = await QRCode.toBuffer(absoluteUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.send(png);
  } catch (e) {
    return res.status(500).json({ error: "Falha ao gerar QR Code." });
  }
});

// Public QR (anyone with the code can retrieve the image)
app.get("/api/invites/:code/qr.png", async (req, res) => {
  const code = String(req.params.code || "").trim();
  const inv = await queryOne("SELECT code FROM invites WHERE code = $1", [code]);
  if (!inv) return res.status(404).json({ error: "Convite não encontrado." });

  const absoluteUrl = `${req.protocol}://${req.get("host")}/invite.html?code=${code}`;
  try {
    const png = await QRCode.toBuffer(absoluteUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8
    });
    res.setHeader("Content-Type", "image/png");
    // cache a bit to reduce load; code still random
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(png);
  } catch (e) {
    return res.status(500).json({ error: "Falha ao gerar QR Code." });
  }
});



app.get("/api/admin/users", authRequired, adminOnly, async (req, res) => {
  const rows = await queryAll("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC", []);
  res.json(rows);
});

app.get("/api/admin/search", authRequired, adminOnly, async (req, res) => {
  const q = String(req.query.query || "").trim();
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const rows = await queryAll(`
    SELECT id, name, email
    FROM users
    WHERE name ILIKE $1 OR email ILIKE $1
    ORDER BY created_at DESC
    LIMIT 50
  `, [like]);
  res.json(rows);
});


app.get("/api/admin/user/:id", authRequired, adminOnly, async (req, res) => {
  const userId = Number(req.params.id);
  const user = await queryOne("SELECT id,name,email,role,created_at FROM users WHERE id = $1", [userId]);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado." });

  const latest = await queryOne(`
    SELECT id, created_at, answers_json as answersById, S_M, S_C, S_R, w_M, w_C, w_R, x, y
    FROM submissions
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [userId]);

  if (latest) {
    latest.answersById = latest.answersbyid || latest.answersById;
    if (typeof latest.answersById === "string") latest.answersById = JSON.parse(latest.answersById);
  }

  res.json({ user, latest });
});

app.get("/api/admin/aggregate", authRequired, adminOnly, async (req, res) => {
  const rows = await queryAll(`
    SELECT S_M, S_C, S_R, w_M, w_C, w_R, x, y
    FROM submissions
  `, []);

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

app.listen(PORT, () => {
  console.log(`DTE rodando em http://localhost:${PORT}`);
});