const https = require('https');
const queries = [
  'ALTER TABLE sterling_technicals ADD CONSTRAINT sterling_technicals_symbol_key UNIQUE (symbol)',
  'ALTER TABLE sterling_intelligence ADD CONSTRAINT sterling_intelligence_symbol_pillar_key UNIQUE (symbol, pillar)'
];
async function run(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: '/v1/projects/fhfqjcvwcxizbioftvdw/database/query',
      method: 'POST',
      headers: { 'Authorization': 'Bearer YOUR_SUPABASE_MGMT_TOKEN_HERE', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    req.on('error', reject); req.write(body); req.end();
  });
}
(async () => {
  for (const sql of queries) {
    const r = await run(sql);
    const ok = r.status === 201 || r.body.includes('already exists');
    console.log(ok ? '✅' : '❌', sql.substring(0,70), !ok ? r.body : '');
  }
  console.log('Done.');
})();
