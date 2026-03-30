const https = require('https');
const token = 'YOUR_SUPABASE_MGMT_TOKEN_HERE';
const sql = `
CREATE TABLE IF NOT EXISTS sterling_trades (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  action text NOT NULL,
  price numeric NOT NULL,
  quantity numeric NOT NULL,
  trade_date date NOT NULL,
  asset_type text DEFAULT 'PSE Stock',
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE sterling_trades ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sterling_trades' AND policyname='allow_all') THEN
    CREATE POLICY allow_all ON sterling_trades FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;
const data = JSON.stringify({ query: sql });
const req = https.request({
  hostname: 'api.supabase.com',
  path: '/v1/projects/fhfqjcvwcxizbioftvdw/database/query',
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => console.log('sterling_trades:', res.statusCode, d.slice(0,100)));
});
req.write(data); req.end();
