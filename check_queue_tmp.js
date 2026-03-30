const Database = require('better-sqlite3');
const db = new Database('C:/Users/Carl Rebadomia/.openclaw/workspace/sterling/sterling.db');
try {
  const rows = db.prepare("SELECT * FROM sterling_analysis_queue WHERE status = 'pending' ORDER BY created_at ASC").all();
  console.log(JSON.stringify({ count: rows.length, rows }));
} catch(e) {
  console.log(JSON.stringify({ error: e.message }));
}
db.close();
