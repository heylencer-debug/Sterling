/**
 * Sterling — Market Open Alert (9:30AM Mon-Fri)
 * Gap analysis, key levels to watch, trading plan for the day
 */
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SB_HOST = 'fhfqjcvwcxizbioftvdw.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY;
const OPENCLAW = 'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs';
const TELEGRAM_ID = process.env.TELEGRAM_CHAT_ID || '1424637649';

function sbGet(table, query = '') {
  return new Promise(res => {
    https.get({ host: SB_HOST, path: `/rest/v1/${table}${query ? '?' + query : ''}`, headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res([]); } });
    }).on('error', () => res([]));
  });
}

function fetchPrice(symbol) {
  return new Promise(res => {
    const req = https.get({ host: 'phisix-api3.appspot.com', path: `/stocks/${symbol}.json`, headers: { 'User-Agent': 'Sterling/1.0' }, timeout: 8000 }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { const j = JSON.parse(d); const s = j.stocks && j.stocks[0]; res(s ? { price: parseFloat(s.price.amount), change: parseFloat(s.percentChange) } : null); } catch(e) { res(null); } });
    });
    req.on('error', () => res(null)); req.on('timeout', () => { req.destroy(); res(null); });
    setTimeout(() => { try { req.destroy(); } catch(e){} res(null); }, 10000);
  });
}

function send(message) {
  const { spawnSync } = require('child_process');
  spawnSync(process.execPath, [OPENCLAW, 'message', 'send', '--channel', 'telegram', '--target', TELEGRAM_ID, '--message', message], { timeout: 15000, encoding: 'utf8' });
}

async function main() {
  const portfolio = await sbGet('sterling_portfolio', 'select=*');
  const day = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });

  let brief = `⚔️ STERLING — Market Open\n📅 ${day} | PSE NOW OPEN\n\n`;
  brief += `━━━━━━━━━━━━━━━━━━━━━━\n🔔 OPENING PRICES\n━━━━━━━━━━━━━━━━━━━━━━\n`;

  const gappers = [];
  for (const h of portfolio) {
    const data = await fetchPrice(h.symbol);
    if (!data) continue;
    const pl = ((data.price - parseFloat(h.avg_buy_price)) / parseFloat(h.avg_buy_price) * 100).toFixed(2);
    const dayColor = data.change >= 0 ? '🟢' : '🔴';
    brief += `${dayColor} ${h.symbol} ₱${data.price} | Day: ${data.change > 0 ? '+' : ''}${data.change}% | Your P&L: ${pl > 0 ? '+' : ''}${pl}%\n`;
    if (Math.abs(data.change) >= 2) gappers.push({ symbol: h.symbol, change: data.change, price: data.price });
    await new Promise(r => setTimeout(r, 400));
  }

  if (gappers.length > 0) {
    brief += `\n━━━━━━━━━━━━━━━━━━━━━━\n⚡ GAP MOVERS (>2% at open)\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    for (const g of gappers) {
      brief += `${g.change > 0 ? '⬆️' : '⬇️'} ${g.symbol}: ${g.change > 0 ? '+' : ''}${g.change}% at ₱${g.price}\n`;
      if (g.change <= -3) brief += `   → Big gap down. Watch if it recovers in first 30 min. If not, selling pressure may continue.\n`;
      if (g.change >= 3) brief += `   → Gap up. Don't chase — wait for a pullback to a support level before adding.\n`;
    }
  }

  brief += `\n━━━━━━━━━━━━━━━━━━━━━━\n📋 TODAY'S PLAN\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  brief += `• Trading hours: 9:30AM – 12:00PM, 1:30PM – 3:30PM\n`;
  brief += `• First 30 minutes are volatile — don't react, observe\n`;
  brief += `• I'll send midday update at 12:30PM and EOD at 3:30PM\n\n`;
  brief += `💡 OPEN RULE: The first 30 minutes of trading is the most irrational. Professionals watch. Amateurs react.\n\n`;
  brief += `—Sterling ⚔️`;

  send(brief);
  console.log('Market open alert sent.');
}

main().catch(e => { console.error(e); process.exit(1); });

