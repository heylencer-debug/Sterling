// create-intelligence-table.js — Create sterling_intelligence table in Supabase
// Uses Management API to execute SQL

const sql = `
CREATE TABLE IF NOT EXISTS sterling_intelligence (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  pillar TEXT NOT NULL,        -- 'fundamentals' | 'news' | 'technicals'
  verdict TEXT,
  ai_summary TEXT,             -- 2-sentence AI-generated plain English summary
  points JSONB,                -- array of bullet point strings
  sources JSONB,               -- array of {name, url} objects
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, pillar)
);

-- Enable RLS
ALTER TABLE sterling_intelligence ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "read_all" ON sterling_intelligence;
DROP POLICY IF EXISTS "insert_all" ON sterling_intelligence;
DROP POLICY IF EXISTS "update_all" ON sterling_intelligence;
DROP POLICY IF EXISTS "delete_all" ON sterling_intelligence;

-- Create policies
CREATE POLICY "read_all" ON sterling_intelligence FOR SELECT USING (true);
CREATE POLICY "insert_all" ON sterling_intelligence FOR INSERT WITH CHECK (true);
CREATE POLICY "update_all" ON sterling_intelligence FOR UPDATE USING (true);
CREATE POLICY "delete_all" ON sterling_intelligence FOR DELETE USING (true);
`;

async function main() {
  const MGMT_TOKEN = 'YOUR_SUPABASE_MGMT_TOKEN_HERE';
  const PROJECT_REF = 'fhfqjcvwcxizbioftvdw';
  
  console.log('Creating sterling_intelligence table...');
  
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MGMT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  
  if (!res.ok) {
    const text = await res.text();
    console.error('Failed:', res.status, text);
    process.exit(1);
  }
  
  const data = await res.json();
  console.log('✅ Table created successfully');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
