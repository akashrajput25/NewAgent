import initSqlJs from 'sql.js';
import { join } from 'path';

const SQL = await initSqlJs({ locateFile: (file) => join(process.cwd(), 'node_modules/sql.js/dist', file) });
const db = new SQL.Database();
db.exec('CREATE TABLE conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT);');
const stmt = db.prepare('INSERT INTO conversations (title) VALUES (?);');
stmt.bind(['test']);
stmt.step();
stmt.free();
const res = db.exec('SELECT last_insert_rowid() AS id;');
console.log(JSON.stringify(res, null, 2));
