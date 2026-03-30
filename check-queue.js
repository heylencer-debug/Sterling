const Database = require('better-sqlite3');
const db = new Database('./sterling.db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', JSON.stringify(tables.map(t => t.name)));

if (tables.find(t => t.name === 'sterling_analysis_queue')) {
  const rows = db.prepare("SELECT * FROM sterling_analysis_queue WHERE status = 'pending' ORDER BY created_at ASC").all();
  console.log('Pending queue:', JSON.stringify(rows, null, 2));
} else {
  console.log('No sterling_analysis_queue table found.');
}

db.close();
