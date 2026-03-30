const Database = require('better-sqlite3');
const db = new Database('./sterling.db', { readonly: true });

// Check if queue table exists
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%queue%'").all();
console.log('Queue tables:', JSON.stringify(tables));

if (tables.length > 0) {
  for (const t of tables) {
    console.log(`\nTable: ${t.name}`);
    try {
      const rows = db.prepare(`SELECT * FROM ${t.name} WHERE status = 'pending' ORDER BY created_at ASC`).all();
      console.log('Pending rows:', JSON.stringify(rows, null, 2));
    } catch(e) {
      const rows = db.prepare(`SELECT * FROM ${t.name}`).all();
      console.log('All rows:', JSON.stringify(rows, null, 2));
    }
  }
} else {
  console.log('No queue tables found.');
}

db.close();
