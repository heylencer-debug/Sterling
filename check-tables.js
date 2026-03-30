const db = require('better-sqlite3')('./sterling.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));
// Check news table
if (tables.find(t => t.name === 'news')) {
  const sample = db.prepare("SELECT symbol, headline, ai_summary, sentiment FROM news ORDER BY fetched_at DESC LIMIT 5").all();
  console.log('Sample news:', JSON.stringify(sample, null, 2));
}
