const Database = require('better-sqlite3');
const db = new Database('C:/Users/Carl Rebadomia/.openclaw/workspace/sterling/sterling.db');
try {
  const rows = db.prepare("SELECT * FROM sterling_analysis_queue WHERE status = 'pending' ORDER BY created_at").all();
  console.log('PENDING_COUNT:' + rows.length);
  console.log(JSON.stringify(rows));
} catch(e) {
  console.log('TABLE_ERROR:' + e.message);
}
db.close();
