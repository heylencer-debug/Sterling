/**
 * Sterling — Morning Analysis
 * Runs 7AM Mon–Fri. Analyzes Carlo's 7 dividend holdings.
 * Saves verdicts to sterling_intelligence (pillar='morning_brief').
 * Sends Telegram summary.
 */

const https = require('https');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const OPENCLAW = 'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs';

const SB_URL  = 'https://fhfqjcvwcxizbioftvdw.supabase.co';
const SB_KEY  = process.env.SUPABASE_KEY;
const OC_URL  = 'http://127.0.0.1:18789';
const OC_TOK  = 'YOUR_OPENCLAW_TOKEN_HERE';
const TG_CHAT = '1424637649';

let OR_KEY = null; // loaded from Supabase app_settings

// ── Holdings loaded dynamically from Supabase ─────────────────────────────────
// No hardcoded data — new positions added to sterling_portfolio are auto-included
let HOLDINGS = {};
let SYMBOLS = [];

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function sbGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`${SB_URL}${path}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { reject(new Error(`Parse error: ${d.slice(0, 100)}`)); }
      });
    }).on('error', reject);
  });
}

function sbUpsert(table, onConflict, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(`${SB_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`HTTP ${res.statusCode}: ${d.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpPost(hostname, path, headers, body, isHttps = true) {
  const payload = JSON.stringify(body);
  const lib = isHttps ? https : require('http');
  const [host, port] = hostname.split(':');
  return new Promise((resolve, reject) => {
    const req = lib.request({ hostname: host, port: port ? parseInt(port) : undefined, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Load OpenRouter key from Supabase ─────────────────────────────────────────
async function loadORKey() {
  try {
    const rows = await sbGet('/rest/v1/app_settings?select=key,value');
    const row = Array.isArray(rows) && rows.find(r => r.key === 'openrouter_api_key');
    if (row?.value) { OR_KEY = row.value; console.log('  ✓ OpenRouter key loaded from Supabase'); }
    else throw new Error('key not found');
  } catch (e) {
    OR_KEY = process.env.OPENROUTER_API_KEY;
    console.log('  ⚠ Falling back to .env OpenRouter key');
  }
}

// ── Fetch data ────────────────────────────────────────────────────────────────
async function fetchPortfolio(userId) {
  // Fetch positions for a specific user only — portfolios are never shared
  const rows = await sbGet(`/rest/v1/sterling_portfolio?select=symbol,company_name,qty,avg_buy_price,current_price,unrealized_pl_pct,dividend_yield,next_ex_date,user_id&user_id=eq.${userId}`);

  HOLDINGS = {};
  const map = {};

  for (const r of (Array.isArray(rows) ? rows : [])) {
    map[r.symbol] = r;
    HOLDINGS[r.symbol] = {
      name:     r.company_name || r.symbol,
      avgCost:  parseFloat(r.avg_buy_price) || 0,
      qty:      parseInt(r.qty) || 0,
      divYield: parseFloat(r.dividend_yield) || 0,
      nav:      null,
      user_id:  r.user_id,
    };
  }

  SYMBOLS = Object.keys(HOLDINGS);
  return map;
}

async function fetchTechnicals() {
  // sterling_technicals columns: symbol, rsi14, rsi_signal, overall_signal, macd_signal, ma_signal, updated_at
  const rows = await sbGet('/rest/v1/sterling_technicals?select=symbol,rsi14,rsi_signal,overall_signal,macd_signal,ma_signal,updated_at&order=updated_at.desc');
  const map = {};
  for (const r of (Array.isArray(rows) ? rows : [])) {
    if (!map[r.symbol]) map[r.symbol] = r;
  }
  return map;
}

async function fetchNews() {
  // sterling_news columns: symbol, headline, ai_summary, sentiment, published_at
  const rows = await sbGet('/rest/v1/sterling_news?select=symbol,headline,ai_summary,sentiment,published_at&order=published_at.desc&limit=100');
  const map = {};
  for (const sym of SYMBOLS) map[sym] = [];
  for (const r of (Array.isArray(rows) ? rows : [])) {
    if (!map[r.symbol]) map[r.symbol] = [];
    if (map[r.symbol].length < 3) map[r.symbol].push(r);
  }
  return map;
}

// ── Detect if stock is a dividend/income play or speculative ──────────────────
function isDividendStock(symbol, meta) {
  const divYield = parseFloat(meta.divYield) || 0;
  // Speculative if yield < 1% and P&L is very high (momentum play)
  return divYield >= 1.0;
}

// ── AI analysis ───────────────────────────────────────────────────────────────
async function analyzeStock(symbol, meta, portfolio, tech, news, userName = 'Carlo') {
  const price      = portfolio?.current_price || meta.avgCost;
  const avgCost    = meta.avgCost;
  const plPct      = portfolio?.unrealized_pl_pct != null
    ? `${portfolio.unrealized_pl_pct >= 0 ? '+' : ''}${Number(portfolio.unrealized_pl_pct).toFixed(2)}%`
    : `${(((price - avgCost) / avgCost) * 100).toFixed(2)}%`;

  // Yield at current market price
  const yieldAtMarket = meta.divYield > 0 ? ((meta.divYield / 100) * avgCost / price * 100).toFixed(2) : null;
  // Yield on cost (what the investor actually earns on their capital)
  const yieldOnCost   = meta.divYield > 0 ? meta.divYield.toFixed(2) : null;

  const navLine  = meta.nav ? `NAV: ₱${meta.nav} | NAV discount: ${(((meta.nav - price) / meta.nav) * 100).toFixed(1)}%` : '';
  const exDate   = portfolio?.next_ex_date ? `Next ex-dividend: ${portfolio.next_ex_date}` : '';

  const techLine = tech
    ? `Technical (entry timing only): RSI ${tech.rsi14 || 'N/A'} (${tech.rsi_signal || ''}), Overall: ${tech.overall_signal || 'N/A'}, MACD: ${tech.macd_signal || 'N/A'}`
    : 'Technical data: not available';

  const newsLines = news?.length
    ? news.map(n => `- ${n.headline} [${n.sentiment}]`).join('\n')
    : 'No recent news.';

  const isDiv = isDividendStock(symbol, meta);

  // Short prompt for Grok - reduce tokens to avoid timeout
  const prompt = isDiv
    ? `You are Sterling. ${userName} holds ${symbol} (${meta.name}) at ₱${avgCost.toFixed(2)} avg, current ₱${price}, P&L ${plPct}. Yield ${yieldOnCost || meta.divYield}%. ${techLine}

News: ${newsLines ? newsLines.slice(0,200) : 'None'}

Should ${userName} ACCUMULATE, ADD ON DIP, HOLD, MONITOR, or WAIT?
Reply 1-2 sentences. End with VERDICT: ACCUMULATE|ADD ON DIP|HOLD & COLLECT|MONITOR|WAIT`
    : `You are Sterling. ${userName} holds ${symbol} at ₱${avgCost.toFixed(2)}, current ₱${price}, P&L ${plPct}. ${techLine}

Is momentum intact? Should they HOLD, MONITOR, or WAIT?
Reply 1-2 sentences. End with VERDICT: HOLD & COLLECT|MONITOR|WAIT`;

  // Use xAI Grok directly (not via OpenRouter)
  const GROK_KEY = 'process.env.XAI_API_KEY';
  const payload = JSON.stringify({
    model: 'grok-4-latest',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 250
  });

  return new Promise((resolve) => {
    const req = https.request('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROK_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.error) { resolve({ verdict: 'MONITOR', summary: 'AI unavailable — check manually.' }); return; }
          const text = json.choices?.[0]?.message?.content || '';
          const match = text.match(/VERDICT:\s*(ACCUMULATE|ADD ON DIP|HOLD & COLLECT|MONITOR|WAIT)/i);
          const verdict = match ? match[1].toUpperCase() : 'MONITOR';
          const summary = text.replace(/\n?VERDICT:.*$/i, '').trim();
          resolve({ verdict, summary });
        } catch { resolve({ verdict: 'MONITOR', summary: 'Parse error.' }); }
      });
    });
    req.on('error', () => resolve({ verdict: 'MONITOR', summary: 'Network error.' }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ verdict: 'MONITOR', summary: 'Timeout.' }); });
    req.write(payload);
    req.end();
  });
}

// ── Telegram via OpenClaw CLI ─────────────────────────────────────────────────
function sendTelegram(text) {
  const result = spawnSync(process.execPath, [OPENCLAW, 'message', 'send', '--channel', 'telegram', '--target', TG_CHAT, '--message', text], { timeout: 30000 });
  if (result.status === 0) { console.log('  ✓ Telegram sent'); }
  else { console.log('  ⚠ Telegram failed:', (result.stderr || '').toString().slice(0, 100)); }
}

// ── Verdict emoji ─────────────────────────────────────────────────────────────
const EMOJI = { 'ACCUMULATE': '🟢', 'ADD ON DIP': '🟡', 'HOLD & COLLECT': '✅', 'MONITOR': '🔵', 'WAIT': '⏳' };

// ── Analyze one user's portfolio and return Telegram message ──────────────────
async function analyzeUser(userId, displayName, dateStr, technicals, allNews) {
  console.log(`\n👤 ${displayName} (${userId})`);

  const portfolio = await fetchPortfolio(userId).catch(e => {
    console.log(`  ⚠ Portfolio fetch failed: ${e.message}`); return {};
  });

  if (SYMBOLS.length === 0) {
    console.log(`  — No positions found for ${userId}`);
    return null;
  }

  console.log(`  ✓ ${SYMBOLS.length} positions: ${SYMBOLS.join(', ')}`);

  const results = [];
  for (const symbol of SYMBOLS) {
    const meta = HOLDINGS[symbol];
    console.log(`  🔍 ${symbol} — ${meta.name}`);
    try {
      const { verdict, summary } = await analyzeStock(symbol, meta, portfolio[symbol], technicals[symbol], allNews[symbol], displayName);
      console.log(`    ✓ Verdict: ${verdict}`);
      await sbUpsert('sterling_intelligence', 'symbol,pillar', {
        symbol,
        pillar: 'morning_brief',
        verdict,
        ai_summary: summary,
        points: [],
        analyzed_at: new Date().toISOString(),
      });
      results.push({ symbol, name: meta.name, verdict, summary, price: portfolio[symbol]?.current_price || meta.avgCost, plPct: portfolio[symbol]?.unrealized_pl_pct });
    } catch (e) {
      console.log(`    ✗ Failed: ${e.message}`);
      results.push({ symbol, name: meta.name, verdict: 'ERROR', summary: e.message });
    }
    if (symbol !== SYMBOLS[SYMBOLS.length - 1]) await new Promise(r => setTimeout(r, 2000));
  }

  const lines = results.map(r => {
    const em = EMOJI[r.verdict] || '⚪';
    const priceStr = r.price ? `₱${r.price}` : '';
    const plStr = r.plPct != null ? ` (${r.plPct >= 0 ? '+' : ''}${Number(r.plPct).toFixed(1)}%)` : '';
    const oneLiner = r.summary?.split('\n')[0]?.slice(0, 120) || '';
    return `${em} ${r.symbol} ${priceStr}${plStr}\n→ ${r.verdict} — ${oneLiner}`;
  }).join('\n\n');

  const annualDiv = Object.entries(HOLDINGS)
    .reduce((sum, [sym, m]) => sum + (m.qty * (portfolio[sym]?.current_price || m.avgCost) * (m.divYield / 100)), 0);

  return `⚔️ Sterling Morning Brief — ${displayName}\n📅 ${dateStr}\n\n${lines}\n\n💰 Est. Annual Dividends: ₱${annualDiv.toLocaleString('en-PH', { maximumFractionDigits: 0 })}\n— Sterling ⚔️`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dateStr = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila'
  });
  console.log(`\n⚔️  STERLING — Morning Analysis\n📅 ${dateStr}\n`);

  await loadORKey();

  // Fetch shared data (technicals + news) once
  const [technicals, allNews] = await Promise.all([
    fetchTechnicals().catch(e => { console.log('  ⚠ Technicals:', e.message); return {}; }),
    fetchNews().catch(e => { console.log('  ⚠ News:', e.message); return {}; }),
  ]);

  // Users with portfolios — add more users here as needed
  const users = [
    { id: 'carlo', name: 'Carlo' },
    { id: 'james', name: 'James' },
  ];

  for (const user of users) {
    const msg = await analyzeUser(user.id, user.name, dateStr, technicals, allNews);
    if (msg) {
      console.log('\n' + '─'.repeat(60));
      console.log(msg);
      console.log('─'.repeat(60));
      // Telegram send disabled 2026-03-05 — Carlo requested no morning brief announcements
      // await sendTelegram(msg);
    }
    // Brief pause between users
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\nDone ✓`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(0); });
