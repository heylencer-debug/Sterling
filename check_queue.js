const Database = require('better-sqlite3');
const db = new Database('sterling.db');
try {
  const rows = db.prepare("SELECT * FROM sterling_analysis_queue WHERE status = 'pending' ORDER BY created_at ASC").all();
  console.log(JSON.stringify(rows, null, 2));
} catch(e) {
  console.error('Error:', e.message);
}
db.close();
