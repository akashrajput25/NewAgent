import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { config } from '../config.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbFilePath = config.dbPath;
mkdirSync(dirname(dbFilePath), { recursive: true });
const SQL = await initSqlJs({
    locateFile: (file) => join(__dirname, '../../../node_modules/sql.js/dist', file),
});
const SCHEMA = `CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  personality TEXT NOT NULL DEFAULT 'professional',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE TABLE IF NOT EXISTS generated_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fact',
  source_conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`;
function saveDb(database) {
    const buffer = Buffer.from(database.export());
    writeFileSync(dbFilePath, buffer);
}
const db = existsSync(dbFilePath)
    ? new SQL.Database(readFileSync(dbFilePath))
    : new SQL.Database();
try {
    db.exec('PRAGMA journal_mode = WAL;');
}
catch {
    // Ignore if PRAGMA is unsupported in this runtime
}
db.exec(SCHEMA);
saveDb(db);
const adapter = {
    pragma: (_sql) => undefined,
    exec: (sql) => {
        db.exec(sql);
        saveDb(db);
    },
    prepare: (sql) => {
        return {
            all: (...params) => {
                const statement = db.prepare(sql);
                statement.bind(params);
                const rows = [];
                while (statement.step()) {
                    rows.push(statement.getAsObject());
                }
                statement.free();
                return rows;
            },
            get: (...params) => {
                const statement = db.prepare(sql);
                statement.bind(params);
                const row = statement.step() ? statement.getAsObject() : undefined;
                statement.free();
                return row;
            },
            run: (...params) => {
                const statement = db.prepare(sql);
                statement.bind(params);
                statement.step();
                statement.free();
                saveDb(db);
                const lastRow = db.exec('SELECT last_insert_rowid() AS id;');
                return { lastInsertRowid: lastRow[0]?.values?.[0]?.[0] ?? undefined };
            },
        };
    },
};
export default adapter;
//# sourceMappingURL=connection.js.map