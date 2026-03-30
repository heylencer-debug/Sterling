const https = require('https');
const queries = [
  'ALTER TABLE sterling_technicals ADD COLUMN IF NOT EXISTS week52_high NUMERIC',
  'ALTER TABLE sterling_technicals ADD COLUMN IF NOT EXISTS week52_low NUMERIC',
  'ALTER TABLE sterling_technicals ADD COLUMN IF NOT EXISTS volume BIGINT',
  'ALTER TABLE sterling_technicals ADD COLUMN IF NOT EXISTS avg_volume_10d BIGINT'
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
    console.log(r.status === 201 ? '✅' : '❌', sql.substring(0,60), r.body !== '[]' ? r.body : '');
  }
  console.log('Done.');
})();
