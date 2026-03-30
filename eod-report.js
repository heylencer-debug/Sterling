/**
 * Sterling — End-of-Day Report (3:30PM Mon-Fri)
 * Day summary, candle patterns, volume analysis, tomorrow's watchpoints
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
    const req = https.get({ host: 'phisix-api3.appspot.com', path: `/stocks/${symbol}.json`, headers: {'User-Agent':'Sterling/1.0'}, timeout: 8000 }, r => {
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{const j=JSON.parse(d);const s=j.stock&&j.stock[0];res(s?{price:parseFloat(s.price.amount),change:parseFloat(s.percentChange),volume:parseInt(s.volume)||0}:null);}catch(e){res(null);}});
    });
    req.on('error',()=>res(null)); req.on('timeout',()=>{req.destroy();res(null);});
    setTimeout(()=>{try{req.destroy();}catch(e){}res(null);},10000);
  });
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const changes = []; for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i-1]);
  const recent = changes.slice(-period);
  const avgGain = recent.filter(c=>c>0).reduce((a,b)=>a+b,0)/period;
  const avgLoss = recent.filter(c=>c<0).map(c=>Math.abs(c)).reduce((a,b)=>a+b,0)/period;
  if (avgLoss===0) return 100;
  return Math.round(100-(100/(1+avgGain/avgLoss)));
}

function send(message) {
  const { spawnSync } = require('child_process');
  spawnSync(process.execPath, [OPENCLAW,'message','send','--channel','telegram','--target',TELEGRAM_ID,'--message',message],{timeout:15000,encoding:'utf8'});
}

async function main() {
  const portfolio = await sbGet('sterling_portfolio', 'select=*');
  const day = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' });

  let report = `⚔️ STERLING — End of Day\n📅 ${day} | PSE CLOSED\n\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━\n📊 DAY SUMMARY\n━━━━━━━━━━━━━━━━━━━━━━\n`;

  let totalValue = 0, totalCost = 0, winner = null, loser = null;

  for (const h of portfolio) {
    const data = await fetchPrice(h.symbol);
    if (!data) continue;
    const pl = ((data.price - parseFloat(h.avg_buy_price)) / parseFloat(h.avg_buy_price) * 100).toFixed(2);
    const dayLabel = data.change >= 0 ? `+${data.change}%` : `${data.change}%`;
    const emoji = data.change >= 1 ? '🟢' : data.change <= -1 ? '🔴' : '⚪';
    report += `${emoji} ${h.symbol} ₱${data.price} | Day: ${dayLabel} | P&L: ${pl > 0 ? '+' : ''}${pl}%\n`;
    totalValue += data.price * parseInt(h.qty);
    totalCost += parseFloat(h.avg_buy_price) * parseInt(h.qty);
    if (!winner || data.change > winner.change) winner = { symbol: h.symbol, change: data.change };
    if (!loser || data.change < loser.change) loser = { symbol: h.symbol, change: data.change };

    // Get RSI from price history
    const history = await sbGet('sterling_price_history', `symbol=eq.${h.symbol}&select=price&order=recorded_at.desc&limit=20`);
    const prices = Array.isArray(history) ? history.map(x => parseFloat(x.price)).reverse() : [];
    const rsi = calculateRSI(prices);

    // Pattern reading based on day change
    let pattern = '';
    if (data.change >= 2 && data.volume > 1000000) pattern = `High volume rally — conviction move. Bullish.`;
    else if (data.change >= 2) pattern = `Up on normal volume — steady buying.`;
    else if (data.change <= -3) pattern = `Sharp sell-off. Check for news. If no news, may be oversold.`;
    else if (data.change <= -1) pattern = `Mild pullback — normal within uptrend.`;
    else pattern = `Flat/consolidating — market indecision.`;
    if (rsi !== null) pattern += ` RSI: ${rsi}${rsi < 30 ? ' (oversold — watch for reversal)' : rsi > 70 ? ' (overbought — be cautious)' : ''}`;
    report += `   📌 ${pattern}\n`;
    await new Promise(r => setTimeout(r, 400));
  }

  const totalPL = totalValue - totalCost;
  const totalPLPct = (totalPL / totalCost * 100).toFixed(2);
  report += `\n💼 Portfolio: ₱${totalValue.toLocaleString()} | P&L: ${totalPL >= 0 ? '+' : ''}₱${Math.round(totalPL).toLocaleString()} (${totalPLPct}%)\n`;
  if (winner) report += `🏆 Best today: ${winner.symbol} (${winner.change > 0 ? '+' : ''}${winner.change}%)\n`;
  if (loser) report += `📉 Worst today: ${loser.symbol} (${loser.change}%)\n`;

  report += `\n━━━━━━━━━━━━━━━━━━━━━━\n🔭 TOMORROW'S WATCHPOINTS\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `• Watch if today's losers recover at open — if not, selling may continue\n`;
  report += `• Watch if today's gainers hold — if they gap up again, trend is strong\n`;
  report += `• Check PSE Edge tonight for any after-hours disclosures: edge.pse.com.ph\n`;

  report += `\n━━━━━━━━━━━━━━━━━━━━━━\n📚 EOD LESSON\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `Volume tells you HOW MUCH conviction is behind a price move.
Big price move + big volume = real signal. People who matter are buying/selling.
Big price move + thin volume = suspect. Could reverse easily.
Always ask: "How many shares traded today?" before reacting to a price swing.\n`;

  report += `\nSee full analysis: https://heylencer-debug.github.io/Sterling\n—Sterling ⚔️`;

  send(report);
  console.log('EOD report sent.');
}

main().catch(e => { console.error(e); process.exit(1); });

