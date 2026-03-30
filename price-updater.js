/**
 * Sterling — Live Price Updater
 * Runs every 10 minutes during PSE trading hours (Mon-Fri 9:30AM-3:30PM)
 * Fetches live prices, updates portfolio P&L, records price history,
 * calculates RSI and moving averages, triggers alerts
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SB_HOST = 'fhfqjcvwcxizbioftvdw.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY;
const OPENCLAW = 'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs';
const TELEGRAM_ID = process.env.TELEGRAM_CHAT_ID || '1424637649';

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function ts() { return new Date().toISOString().substring(11, 19); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

function sbGet(table, query = '') {
  return new Promise(res => {
    https.get({
      host: SB_HOST, path: `/rest/v1/${table}${query ? '?' + query : ''}`,
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res([]); } });
    }).on('error', () => res([]));
  });
}

function sbPost(table, body, onConflict = null) {
  return new Promise(res => {
    const b = JSON.stringify(body);
    const path = `/rest/v1/${table}${onConflict ? '?on_conflict=' + onConflict : ''}`;
    const req = https.request({
      host: SB_HOST, path, method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': `resolution=merge-duplicates,return=minimal`,
        'Content-Length': Buffer.byteLength(b)
      }
    }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ status: r.statusCode, body: d })); });
    req.on('error', e => res({ status: 500, error: e.message }));
    req.write(b); req.end();
  });
}

function sbPatch(table, id, body) {
  return new Promise(res => {
    const b = JSON.stringify(body);
    const req = https.request({
      host: SB_HOST, path: `/rest/v1/${table}?id=eq.${id}`, method: 'PATCH',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(b)
      }
    }, r => { r.resume(); r.on('end', () => res(r.statusCode)); });
    req.on('error', () => res(500));
    req.write(b); req.end();
  });
}

// ===== PHISIX API =====

function fetchPrice(symbol) {
  return new Promise(res => {
    const req = https.get({
      host: 'phisix-api3.appspot.com',
      path: `/stocks/${symbol}.json`,
      headers: { 'User-Agent': 'Sterling/1.0' },
      timeout: 8000
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          const s = j.stocks && j.stocks[0];
          if (!s) return res(null);
          res({
            symbol,
            price: parseFloat(s.price.amount),
            percent_change: parseFloat(s.percentChange),
            volume: parseInt(s.volume) || 0,
            as_of: s.as_of
          });
        } catch(e) { res(null); }
      });
    });
    req.on('error', () => res(null));
    req.on('timeout', () => { req.destroy(); res(null); });
    setTimeout(() => { try { req.destroy(); } catch(e){} res(null); }, 10000);
  });
}

function fetchPSEi() {
  return new Promise(res => {
    const req = https.get({
      host: 'phisix-api3.appspot.com',
      path: '/stocks.json',
      headers: { 'User-Agent': 'Sterling/1.0' },
      timeout: 8000
    }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => {
        try {
          const j = JSON.parse(d);
          // PSEi is usually the first or find PSEi in the list
          const psxi = j.stock && j.stock.find(s => s.symbol === 'PSEi' || s.symbol === 'PSEI');
          if (psxi) {
            res({ value: parseFloat(psxi.price.amount), change: parseFloat(psxi.percent_change) });
          } else {
            res(null);
          }
        } catch(e) { res(null); }
      });
    });
    req.on('error', () => res(null));
    req.on('timeout', () => { req.destroy(); res(null); });
    setTimeout(() => { try { req.destroy(); } catch(e){} res(null); }, 10000);
  });
}

// ===== RSI CALCULATION =====
// RSI = 100 - (100 / (1 + RS))
// RS = Average Gain / Average Loss over 14 periods

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  const recent = changes.slice(-period);
  const gains = recent.filter(c => c > 0);
  const losses = recent.filter(c => c < 0).map(c => Math.abs(c));
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - (100 / (1 + rs)));
}

function calculateMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function rsiLabel(rsi) {
  if (rsi === null) return 'N/A';
  if (rsi < 30) return `${rsi} 🟢 OVERSOLD (potential buy)`;
  if (rsi > 70) return `${rsi} 🔴 OVERBOUGHT (potential sell)`;
  return `${rsi} ⚪ Neutral`;
}

// ===== ALERT SENDER =====

function sendAlert(message) {
  const { spawnSync } = require('child_process');
  spawnSync(process.execPath, [OPENCLAW, 'message', 'send', '--channel', 'telegram', '--target', TELEGRAM_ID, '--message', message], { timeout: 15000, encoding: 'utf8' });
}

// ===== MAIN =====

async function main() {
  log('=== Sterling Price Updater ===');

  // Step 1: Fetch all portfolio holdings
  const portfolio = await sbGet('sterling_portfolio', 'select=*');
  if (!portfolio || portfolio.length === 0) {
    log('No portfolio data found. Exiting.');
    return;
  }
  log(`Portfolio: ${portfolio.length} holdings`);

  // Step 2: Fetch live prices for all holdings
  const priceResults = [];
  for (const holding of portfolio) {
    const data = await fetchPrice(holding.symbol);
    if (data) {
      priceResults.push({ holding, data });
      log(`  ${holding.symbol}: ₱${data.price} (${data.percent_change > 0 ? '+' : ''}${data.percent_change}%)`);
    } else {
      log(`  ${holding.symbol}: failed to fetch`);
    }
    await delay(400);
  }

  // Step 3: Fetch PSEi
  const psxi = await fetchPSEi();
  if (psxi) log(`PSEi: ${psxi.value} (${psxi.change > 0 ? '+' : ''}${psxi.change}%)`);

  // Step 4: Get price history for RSI/MA calculation
  const now = new Date();

  for (const { holding, data } of priceResults) {
    // Insert to price history
    await sbPost('sterling_price_history', [{
      symbol: data.symbol,
      price: data.price,
      volume: data.volume,
      percent_change: data.percent_change,
      recorded_at: now.toISOString()
    }]);

    // Get last 50 prices for this symbol to calculate RSI/MA
    const history = await sbGet('sterling_price_history',
      `symbol=eq.${data.symbol}&select=price,recorded_at&order=recorded_at.desc&limit=50`
    );
    const prices = Array.isArray(history) ? history.map(h => parseFloat(h.price)).reverse() : [];

    const rsi = calculateRSI(prices);
    const ma50 = calculateMA(prices, Math.min(50, prices.length));
    const ma20 = calculateMA(prices, Math.min(20, prices.length));

    // Calculate unrealized P&L
    const avgBuy = parseFloat(holding.avg_buy_price);
    const qty = parseInt(holding.qty);
    const currentValue = data.price * qty;
    const costBasis = avgBuy * qty;
    const unrealizedPL = currentValue - costBasis;
    const unrealizedPLPct = ((data.price - avgBuy) / avgBuy) * 100;

    // Update portfolio row
    await sbPatch('sterling_portfolio', holding.id, {
      current_price: data.price,
      unrealized_pl: Math.round(unrealizedPL * 100) / 100,
      unrealized_pl_pct: Math.round(unrealizedPLPct * 100) / 100,
      updated_at: now.toISOString()
    });

    // Step 5: Generate alerts for significant moves
    const alerts = [];

    // Price drop alert (>3% intraday)
    if (data.percent_change <= -3) {
      alerts.push({
        symbol: data.symbol,
        alert_type: 'price_drop',
        message: `⚠️ ${data.symbol} DOWN ${data.percent_change}% today (₱${data.price}). ${
          holding.is_reit ? 'Check if any news driving this. REIT drops on no news = buying opportunity.' :
          'Check PSE Edge for any disclosure. No news = likely market-wide selling.'
        }`,
        severity: Math.abs(data.percent_change) >= 5 ? 'urgent' : 'warning',
        is_sent: false
      });
    }

    // Approaching buy target (watchlist)
    const watchlistItem = await sbGet('sterling_watchlist', `symbol=eq.${data.symbol}&select=target_buy_price,recommendation`);
    if (Array.isArray(watchlistItem) && watchlistItem[0] && watchlistItem[0].target_buy_price) {
      const target = parseFloat(watchlistItem[0].target_buy_price);
      if (data.price <= target * 1.02) { // within 2% of target
        alerts.push({
          symbol: data.symbol,
          alert_type: 'price_target',
          message: `🎯 ${data.symbol} at ₱${data.price} — near target buy zone ₱${target}. ${watchlistItem[0].recommendation || 'Consider entry.'}`,
          severity: 'info',
          is_sent: false
        });
      }
    }

    // RSI oversold alert
    if (rsi !== null && rsi < 30) {
      alerts.push({
        symbol: data.symbol,
        alert_type: 'pattern',
        message: `📊 ${data.symbol} RSI is ${rsi} — OVERSOLD territory. RSI below 30 means heavy selling may be overdone. Watch for reversal signal. This is NOT a buy signal alone — check fundamentals too.`,
        severity: 'info',
        is_sent: false
      });
    }

    if (alerts.length > 0) {
      await sbPost('sterling_alerts', alerts);
      // Send urgent alerts immediately to Telegram
      for (const alert of alerts.filter(a => a.severity === 'urgent')) {
        sendAlert(`⚔️ STERLING ALERT\n${alert.message}`);
      }
    }

    log(`  ${data.symbol} updated — RSI: ${rsi || 'N/A'}, MA20: ₱${ma20 ? ma20.toFixed(2) : 'N/A'}, P&L: ${unrealizedPLPct.toFixed(2)}%`);
  }

  // Step 6: Log activity
  await sbPost('agent_activity', [{
    agent: 'sterling',
    action: 'price_update',
    details: `Updated ${priceResults.length} holdings. PSEi: ${psxi ? psxi.value : 'N/A'}`,
    status: 'done'
  }]);

  log(`Done. ${priceResults.length}/${portfolio.length} prices updated.`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

