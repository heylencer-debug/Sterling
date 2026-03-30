const https = require('https');

const sql = `
CREATE TABLE IF NOT EXISTS sterling_ohlcv (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume BIGINT,
  source TEXT DEFAULT 'Yahoo Finance',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_date ON sterling_ohlcv(symbol, date DESC);

ALTER TABLE sterling_ohlcv ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sterling_ohlcv' AND policyname = 'read_all') THEN
    CREATE POLICY "read_all" ON sterling_ohlcv FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sterling_ohlcv' AND policyname = 'insert_all') THEN
    CREATE POLICY "insert_all" ON sterling_ohlcv FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sterling_ohlcv' AND policyname = 'update_all') THEN
    CREATE POLICY "update_all" ON sterling_ohlcv FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sterling_ohlcv' AND policyname = 'delete_all') THEN
    CREATE POLICY "delete_all" ON sterling_ohlcv FOR DELETE USING (true);
  END IF;
END $$;
`;

const body = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/fhfqjcvwcxizbioftvdw/database/query',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_MGMT_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
