import { Pool } from "pg";

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Falta ${name}. Configure nas variáveis de ambiente.`);
  }
  return v;
}

export const pool = new Pool({
  connectionString: requireEnv("DATABASE_URL"),
  // Render Postgres requires SSL for external connections; internal URLs may still work without,
  // but enabling SSL is safe for managed DBs.
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});

export async function migrate() {
  // Tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      invite_id INTEGER NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invites (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NULL,
      max_uses INTEGER NOT NULL DEFAULT 0,
      uses INTEGER NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      answersById JSONB NOT NULL,
      S_M DOUBLE PRECISION NOT NULL,
      S_C DOUBLE PRECISION NOT NULL,
      S_R DOUBLE PRECISION NOT NULL,
      w_M DOUBLE PRECISION NOT NULL,
      w_C DOUBLE PRECISION NOT NULL,
      w_R DOUBLE PRECISION NOT NULL,
      x DOUBLE PRECISION NOT NULL,
      y DOUBLE PRECISION NOT NULL
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_invites_created_at ON invites(created_at DESC);`);
}
