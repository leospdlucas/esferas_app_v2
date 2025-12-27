import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

// Em produção (Render), usa /data para persistência
// Em desenvolvimento, usa ./data local
const isProduction = process.env.NODE_ENV === 'production';
const dataDir = isProduction && fs.existsSync('/data') 
  ? '/data' 
  : path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "app.db");
console.log(`Database path: ${dbPath}`);

// Inicializa sql.js
const SQL = await initSqlJs();

// Carrega banco existente ou cria novo
let db;
if (fs.existsSync(dbPath)) {
  const fileBuffer = fs.readFileSync(dbPath);
  db = new SQL.Database(fileBuffer);
  console.log("Database loaded from file");
} else {
  db = new SQL.Database();
  console.log("New database created");
}

// Função para salvar o banco em disco
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Auto-save a cada 30 segundos
setInterval(saveDatabase, 30000);

// Salva ao encerrar
process.on('exit', saveDatabase);
process.on('SIGINT', () => { saveDatabase(); process.exit(); });
process.on('SIGTERM', () => { saveDatabase(); process.exit(); });

// Wrapper para compatibilidade com a API do better-sqlite3
class DatabaseWrapper {
  constructor(sqlDb) {
    this.sqlDb = sqlDb;
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self.sqlDb.run(sql, params);
        saveDatabase();
        const lastId = self.sqlDb.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0];
        const changes = self.sqlDb.getRowsModified();
        return { lastInsertRowid: lastId, changes };
      },
      get(...params) {
        const stmt = self.sqlDb.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const columns = stmt.getColumnNames();
          const values = stmt.get();
          stmt.free();
          const row = {};
          columns.forEach((col, i) => row[col] = values[i]);
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params) {
        const stmt = self.sqlDb.prepare(sql);
        stmt.bind(params);
        const rows = [];
        const columns = stmt.getColumnNames();
        while (stmt.step()) {
          const values = stmt.get();
          const row = {};
          columns.forEach((col, i) => row[col] = values[i]);
          rows.push(row);
        }
        stmt.free();
        return rows;
      }
    };
  }

  exec(sql) {
    this.sqlDb.run(sql);
    saveDatabase();
  }
}

const wrappedDb = new DatabaseWrapper(db);

export { wrappedDb as db };

export function migrate() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NULL,
      max_uses INTEGER NOT NULL DEFAULT 0,
      uses INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      answers_json TEXT NOT NULL,
      S_M REAL NOT NULL,
      S_C REAL NOT NULL,
      S_R REAL NOT NULL,
      w_M REAL NOT NULL,
      w_C REAL NOT NULL,
      w_R REAL NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id)`);

  saveDatabase();
  console.log("Database migration completed");
}
