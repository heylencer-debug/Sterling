/**
 * Setup sterling_technicals table in Supabase
 * Run once to create the table
 */
const https = require('https');
const token = 'YOUR_SUPABASE_MGMT_TOKEN_HERE';

const sql = `
CREATE TABLE IF NOT EXISTS sterling_technicals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL,
  -- Price
  current_price numeric,
  day_change_pct numeric,
  -- RSI
  rsi14 numeric,
  rsi_signal text,
  -- MACD
  macd_line numeric,
  macd_signal_line numeric,
  macd_histogram numeric,
  macd_signal text,
  -- Moving Averages
  sma20 numeric,
  sma50 numeric,
  sma100 numeric,
  sma200 numeric,
  ema12 numeric,
  ema26 numeric,
  ma_buy_count integer,
  ma_sell_count integer,
  ma_signal text,
  -- Support / Resistance
  support1 numeric,
  support2 numeric,
  resistance1 numeric,
  resistance2 numeric,
  -- Overall
  overall_signal text,
  -- Meta
  data_source text DEFAULT 'Yahoo Finance OHLCV + calculated',
  candles_used integer,
  updated_at timestamptz DEFAULT now(),
  market_session text
);

-- Index for fast lookup by symbol
CREATE INDEX IF NOT EXISTS idx_sterling_technicals_symbol ON sterling_technicals(symbol);
CREATE INDEX IF NOT EXISTS idx_sterling_technicals_updated ON sterling_technicals(updated_at DESC);

-- RLS
ALTER TABLE sterling_technicals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sterling_technicals' AND policyname='allow_all') THEN
    CREATE POLICY allow_all ON sterling_technicals FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

const data = JSON.stringify({ query: sql });
const req = https.request({
  hostname: 'api.supabase.com',
  path: '/v1/projects/fhfqjcvwcxizbioftvdw/database/query',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, res => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => console.log('sterling_technicals:', res.statusCode, d.slice(0, 200)));
});
req.write(data); req.end();
