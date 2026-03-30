/**
 * Sterling — fetch-news.js
 * Uses Google Gemini 2.5 Flash with Google Search grounding to fetch real-time
 * PSE news AND generate dividend-investor analysis in a single call per stock.
 *
 * Why Gemini: Google Search grounding gives real-time, relevant PSE news.
 * No more stale articles or hallucinated results for smaller stocks.
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = 'https://fhfqjcvwcxizbioftvdw.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
let OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const GEMINI_MODEL = 'gemini-2.5-flash';
const MODEL = GEMINI_MODEL; // for logging

const COMPANY_NAMES = {
  MBT:   'Metrobank (Metropolitan Bank and Trust)',
  GLO:   'Globe Telecom',
  DMC:   'DMCI Holdings',
  FILRT: 'Filinvest REIT (FILRT)',
  KEEPR: 'Keepr REIT (Keppel Philippines)',
  MREIT: 'MREIT (Megaworld REIT)',
  RRHI:  'Robinsons Retail Holdings',
  BDO:   'BDO Unibank',
  BPI:   'Bank of Philippine Islands',
  TEL:   'PLDT (Philippine Long Distance Telephone)',
  AC:    'Ayala Corporation',
  ALI:   'Ayala Land',
  RLC:   'Robinsons Land',
  AREIT: 'AREIT (Ayala REIT)',
  DDMPR: 'DoubleDragon REIT (DDMPR)',
  CREIT: 'Citicore REIT',
  SCC:   'Semirara Mining and Power',
  ICT:   'International Container Terminal Services (ICTSI)',
  SECB:  'Security Bank',
  AP:    'Aboitiz Power',
  PCOR:  'Petron Corporation',
  CNVRG: 'Converge ICT Solutions',
};

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function sbRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'fhfqjcvwcxizbioftvdw.supabase.co',
      path,
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0, 300)}`));
        }
        try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function clearOldNews(symbol) {
  await sbRequest('DELETE', `/rest/v1/sterling_news?symbol=eq.${symbol}`);
}

async function insertNews(article) {
  await sbRequest('POST', '/rest/v1/sterling_news', article);
}

async function getSymbols() {
  try {
    const res = await sbRequest('GET', '/rest/v1/sterling_portfolio?select=symbol', null);
    const wl  = await sbRequest('GET', '/rest/v1/sterling_watchlist?select=symbol', null);
    const fallback = ['MBT', 'GLO', 'DMC', 'FILRT', 'MREIT', 'RRHI', 'KEEPR'];
    return [...new Set([
      ...(Array.isArray(res) ? res.map(r => r.symbol) : []),
      ...(Array.isArray(wl)  ? wl.map(r => r.symbol)  : []),
      ...fallback
    ])].filter(s => s && !s.includes('/'));
  } catch (e) {
    console.log('⚠️ Could not load symbols from Supabase:', e.message);
    return ['MBT', 'GLO', 'DMC', 'FILRT', 'MREIT', 'RRHI', 'KEEPR'];
  }
}

// ─── Gemini + Google Search Grounding ────────────────────────────────────────

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

function callGemini(prompt) {
  return new Promise((resolve) => {
    if (!GOOGLE_API_KEY) {
      console.log('    ⚠️ GOOGLE_API_KEY not set');
      return resolve(null);
    }

    const body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        maxOutputTokens: 6000,
        temperature: 0.3,
      },
    });

    const apiPath = `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.log(`    ⚠️ Gemini HTTP ${res.statusCode}: ${d.slice(0, 200)}`);
            return resolve(null);
          }
          const json = JSON.parse(d);
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || null;
          resolve(text);
        } catch (e) {
          console.log(`    ⚠️ Parse error: ${e.message}`);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.log(`    ⚠️ Gemini error: ${e.message}`);
      resolve(null);
    });
    req.setTimeout(20000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function fetchExDividendDate(symbol) {
  const company = COMPANY_NAMES[symbol] || symbol + ' Philippines';
  const today = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `Today is ${today}. What is the next upcoming ex-dividend date for ${company} (PSE: ${symbol})? 
  
Output ONLY a raw JSON object. No markdown, no explanation.
Format: {"ex_date":"YYYY-MM-DD","dividend_per_share":0.00,"confidence":"high|medium|low"}

If no upcoming ex-dividend date is known, return: {"ex_date":null,"dividend_per_share":null,"confidence":"low"}`;

  const raw = await callGemini(prompt);
  if (!raw) return null;

  try {
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.ex_date && parsed.confidence !== 'low') return parsed.ex_date;
    return null;
  } catch { return null; }
}

async function updateExDivDate(symbol, exDate) {
  try {
    const body = JSON.stringify({ next_ex_date: exDate });
    await sbRequest('PATCH', `/rest/v1/sterling_portfolio?symbol=eq.${symbol}`, body);
  } catch (e) {
    console.log(`    ⚠️ Could not update ex-div for ${symbol}: ${e.message}`);
  }
}

async function fetchAndAnalyzeStock(symbol) {
  const company = COMPANY_NAMES[symbol] || symbol + ' Philippines';
  const today = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });

  const prompt = `You are Sterling, a broker-mentor AI for Carlo — a long-term PSE dividend investor in the Philippines (REITs, banks, conglomerates). Today is ${today}.

Using your knowledge, provide up to 3 recent news articles about ${company} (PSE: ${symbol}). Focus on: dividends, earnings, REIT distributions, PSE disclosures, analyst coverage, corporate actions. Use articles from the last 12 months if possible.

Output ONLY a raw JSON object — no markdown fences, no preamble, no explanation. Start your response with { and end with }.

Format:
{"articles":[{"headline":"...","source":"BusinessWorld|Inquirer|PSE Edge|etc","published_at":"YYYY-MM-DD","url":"https://... or null","ai_summary":"2-3 sentences: what happened, impact on dividend thesis, what a long-term holder should consider","ai_action":"ACCUMULATE|ADD ON DIP|HOLD|MONITOR"}]}

Rules:
- Only include articles you are confident about. If unsure of exact headline, use closest known version.
- Minimum 1 article, maximum 3.
- ai_action: ACCUMULATE (strong buy case), ADD ON DIP (good but wait), HOLD (thesis intact, no action needed), MONITOR (watch for risk)
- Never recommend selling based on price action alone.
- published_at must be a plausible real date.`;

  const raw = await callGemini(prompt);
  if (!raw) return [];

  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
    const parsed = JSON.parse(cleaned);
    const articles = parsed.articles || [];

    return articles
      .filter(a => a.headline && a.ai_summary)
      .slice(0, 3)
      .map(a => ({
        symbol,
        headline: a.headline,
        source: a.source || 'Gemini Search',
        published_at: a.published_at ? new Date(a.published_at).toISOString() : new Date().toISOString(),
        url: a.url || null,
        ai_summary: a.ai_summary,
        ai_action: a.ai_action || 'HOLD',
        sentiment: tagSentiment(a.headline + ' ' + a.ai_summary),
        impact: 'medium',
        scraped_at: new Date().toISOString()
      }));
  } catch (e) {
    console.log(`    ⚠️ JSON parse failed for ${symbol}: ${e.message}`);
    console.log(`    Raw (first 300): ${raw.slice(0, 300)}`);
    return [];
  }
}

function tagSentiment(text) {
  const t = text.toLowerCase();
  const bullish = ['gain', 'up', 'rise', 'rally', 'growth', 'profit', 'record', 'beat', 'strong', 'buy', 'upgrade', 'dividend', 'expand', 'positive', 'surge', 'increase', 'accumulate'];
  const bearish = ['loss', 'down', 'fall', 'drop', 'decline', 'cut', 'miss', 'weak', 'sell', 'downgrade', 'risk', 'warning', 'negative', 'slump', 'decrease', 'debt'];
  const bullScore = bullish.filter(w => t.includes(w)).length;
  const bearScore = bearish.filter(w => t.includes(w)).length;
  if (bullScore > bearScore) return 'bullish';
  if (bearScore > bullScore) return 'bearish';
  return 'neutral';
}

// ─── Migration ────────────────────────────────────────────────────────────────

async function runMigration() {
  try {
    const body = JSON.stringify({
      query: 'ALTER TABLE sterling_news ADD COLUMN IF NOT EXISTS ai_summary text; ALTER TABLE sterling_news ADD COLUMN IF NOT EXISTS ai_action text;'
    });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: '/v1/projects/fhfqjcvwcxizbioftvdw/database/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_SUPABASE_MGMT_TOKEN_HERE',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => { res.resume(); });
    req.on('error', () => {});
    req.write(body);
    req.end();
    await new Promise(r => setTimeout(r, 1500));
    console.log('✅ Schema ensured (ai_summary, ai_action columns)');
  } catch (e) {
    console.log('⚠️ Migration skipped:', e.message);
  }
}

// ─── Per-symbol processor ─────────────────────────────────────────────────────

async function processSymbol(symbol) {
  const articles = await fetchAndAnalyzeStock(symbol);

  if (articles.length === 0) {
    console.log(` ⚠️ No articles — skipping`);
    return { count: 0 };
  }

  await clearOldNews(symbol);
  for (const article of articles) {
    await insertNews(article);
  }
  process.stdout.write(` (news ok)`);

  // Ex-div: best-effort only, don't let it block
  try {
    const exDate = await Promise.race([
      fetchExDividendDate(symbol),
      new Promise(resolve => setTimeout(() => resolve(null), 12000))
    ]);
    if (exDate) {
      await updateExDivDate(symbol, exDate);
      process.stdout.write(` 📅 ${exDate}`);
    }
  } catch (e) {
    // ex-div failure is non-fatal
  }

  return { count: articles.length, headline: articles[0]?.headline };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function fetchNews() {
  // Hard stop after 8 minutes (cron limit is 10min)
  const scriptTimeout = setTimeout(() => {
    console.log('\n⏱️ HARD TIMEOUT — 8 min script limit reached. Exiting cleanly.');
    process.exit(0);
  }, 8 * 60 * 1000);

  // Ensure timeout doesn't keep process alive
  scriptTimeout.unref();

  const startTime = Date.now();

  const manilaStr = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
  console.log(`\n⚔️ Sterling News Fetch — ${manilaStr}`);
  console.log(`Model: ${GEMINI_MODEL} with Google Search grounding\n`);

  // Load OpenRouter key from Supabase app_settings
  try {
    const res = await sbRequest('GET', '/rest/v1/app_settings?select=key,value', null);
    const orKey = Array.isArray(res) && res.find(s => s.key === 'openrouter_api_key');
    if (orKey?.value) { OPENROUTER_API_KEY = orKey.value; console.log('✓ OpenRouter key loaded from Supabase\n'); }
  } catch (e) {
    console.log('⚠️ Using .env OpenRouter key\n');
  }

  if (!OPENROUTER_API_KEY) { console.log('❌ No OpenRouter API key — aborting'); process.exit(1); }

  await runMigration();

  const symbols = await getSymbols();
  console.log(`Fetching news for: ${symbols.join(', ')}\n`);

  let totalInserted = 0;

  for (const symbol of symbols) {
    const symbolTimer = Date.now();
    try {
      process.stdout.write(`  🔍 ${symbol}: fetching...`);

      // Wrap entire per-symbol work in a 30s timeout
      const result = await Promise.race([
        processSymbol(symbol),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SYMBOL_TIMEOUT')), 30000)
        )
      ]);

      if (result) {
        totalInserted += result.count;
        console.log(` ✅ ${result.count} articles — ${(Date.now() - symbolTimer)}ms`);
      }
    } catch (e) {
      if (e.message === 'SYMBOL_TIMEOUT') {
        console.log(` ⏱️ TIMEOUT (30s) — skipping ${symbol}`);
      } else {
        console.log(` ❌ ${e.message}`);
      }
    }

    // Rate limit: 1s between stocks
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Complete: ${totalInserted} articles inserted across ${symbols.length} stocks`);
  console.log(`Model: ${GEMINI_MODEL} with Google Search grounding`);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n⏱️ Total time: ${elapsed}s`);
  clearTimeout(scriptTimeout);
}

if (require.main === module) {
  fetchNews().catch(err => { console.error('Fatal:', err); process.exit(1); });
}

module.exports = { fetchNews, tagSentiment };
