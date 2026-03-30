const https = require('https');
const PAT = 'YOUR_SUPABASE_MGMT_TOKEN_HERE';
const sql = 'ALTER TABLE sterling_technicals ADD COLUMN IF NOT EXISTS tv_recommend_all FLOAT, ADD COLUMN IF NOT EXISTS tv_recommend_ma FLOAT, ADD COLUMN IF NOT EXISTS tv_recommend_osc FLOAT, ADD COLUMN IF NOT EXISTS ma_trend TEXT;';
const body = JSON.stringify({ query: sql });
const req = https.request({
  hostname: 'api.supabase.com',
  path: '/v1/projects/fhfqjcvwcxizbioftvdw/database/query',
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + PAT, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => console.log('Status:', res.statusCode, d));
});
req.on('error', e => console.error(e.message));
req.write(body); req.end();
