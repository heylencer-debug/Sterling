const Database = require('better-sqlite3');
const db = new Database('C:\\Users\\Carl Rebadomia\\.openclaw\\workspace\\sterling\\sterling.db');
try {
  const rows = db.prepare("SELECT * FROM sterling_analysis_queue WHERE status = 'pending' ORDER BY created_at ASC").all();
  console.log(rows.length + ' pending');
  console.log(JSON.stringify(rows, null, 2));
} catch(e) {
  console.log('ERR: ' + e.message);
}
db.close();
