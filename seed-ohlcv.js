/**
 * seed-ohlcv.js — Seeds realistic OHLCV data for testing
 * Since Yahoo Finance doesn't have 2026 data, this seeds realistic historical patterns
 * Based on typical PSE stock behavior and current prices from analysis-data.js
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fhfqjcvwcxizbioftvdw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Base prices and typical daily ranges for each stock (updated March 2026)
const STOCK_PROFILES = {
  'MBT': { basePrice: 67.70, dailyRange: 0.015, trend: 0.0003 },
  'KEEPR': { basePrice: 2.14, dailyRange: 0.02, trend: -0.0001 },
  'FILRT': { basePrice: 2.88, dailyRange: 0.018, trend: 0 },
  'GLO': { basePrice: 1600.00, dailyRange: 0.012, trend: 0.0001 },
  'DMC': { basePrice: 9.20, dailyRange: 0.02, trend: 0.0002 },
  'MREIT': { basePrice: 13.66, dailyRange: 0.015, trend: 0 },
  'RRHI': { basePrice: 35.30, dailyRange: 0.018, trend: -0.0002 },
  'PSEi': { basePrice: 6850, dailyRange: 0.01, trend: 0.0001 }
};

function generateOHLCV(symbol, profile, days = 365) {
  const rows = [];
  let price = profile.basePrice * (1 - profile.trend * days * 0.5); // Start from historical value
  const today = new Date('2026-03-02');
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Skip weekends
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    
    // Random daily movement with trend
    const dailyMove = (Math.random() - 0.5) * 2 * profile.dailyRange;
    const trendMove = profile.trend;
    
    const open = price;
    const change = price * (dailyMove + trendMove);
    const close = price + change;
    
    // High and low
    const intraRange = Math.abs(change) + price * profile.dailyRange * 0.5 * Math.random();
    const high = Math.max(open, close) + intraRange * Math.random();
    const low = Math.min(open, close) - intraRange * Math.random();
    
    // Volume (randomized, higher on bigger moves)
    const baseVolume = symbol === 'PSEi' ? 0 : Math.floor(Math.random() * 1000000 + 100000);
    const volume = Math.floor(baseVolume * (1 + Math.abs(dailyMove) * 10));
    
    rows.push({
      symbol: symbol,
      date: date.toISOString().split('T')[0],
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume,
      source: 'Seed Data (simulated historical)'
    });
    
    price = close;
  }
  
  return rows;
}

function upsertToSupabase(rows) {
  return new Promise((resolve, reject) => {
    if (rows.length === 0) {
      resolve(0);
      return;
    }
    
    const body = JSON.stringify(rows);
    const urlObj = new URL(`${SUPABASE_URL}/rest/v1/sterling_ohlcv`);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(rows.length);
        } else {
          reject(new Error(`Supabase error ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Sterling OHLCV Seeder — Generating Realistic Data');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\nSupabase: ${SUPABASE_URL}`);
  console.log(`Symbols: ${Object.keys(STOCK_PROFILES).join(', ')}`);
  console.log(`Range: ~1 year of simulated historical data\n`);
  
  let totalRows = 0;
  
  for (const [symbol, profile] of Object.entries(STOCK_PROFILES)) {
    console.log(`📊 Generating ${symbol}...`);
    const rows = generateOHLCV(symbol, profile, 365);
    console.log(`   📅 Date range: ${rows[0].date} to ${rows[rows.length - 1].date}`);
    console.log(`   📈 ${rows.length} rows generated`);
    
    // Batch upsert (100 rows at a time)
    let upserted = 0;
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      try {
        const count = await upsertToSupabase(batch);
        upserted += count;
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
    }
    
    console.log(`   ✅ ${upserted} rows upserted to Supabase`);
    totalRows += upserted;
    
    // Small delay between symbols
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`📊 Total rows seeded: ${totalRows}`);
  console.log('Note: This is simulated historical data for infrastructure testing.');
  console.log('When Yahoo Finance has real 2026 data, run fetch-ohlcv.js to replace.');
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
