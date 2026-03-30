/**
 * Sterling - Weekly Digest
 * Comprehensive fundamental analysis sent Monday 8AM
 */

const https = require('https');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { fetchPrices, getPortfolio } = require('./fetch-prices');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY;
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Sector PE averages (approximates)
const SECTOR_PE_AVERAGES = {
  'Banking': 11.0,
  'Telecoms': 15.0,
  'REIT': 12.0,
  'Holding/Mining': 8.0,
  'Retail': 18.0,
  'Property': 14.0,
  'Utilities': 12.0,
  'Consumer': 20.0
};

// Stock fundamentals (would be scraped in production)
const STOCK_FUNDAMENTALS = {
  'DMC': { pe_ratio: 7.5, eps: 1.28, roe: 15.2, debt_to_equity: 0.45, payout_ratio: 65 },
  'FILRT': { pe_ratio: 11.2, eps: 0.27, roe: 8.5, debt_to_equity: 0.35, payout_ratio: 90 },
  'GLO': { pe_ratio: 14.8, eps: 117.5, roe: 12.8, debt_to_equity: 1.2, payout_ratio: 50 },
  'KEEPR': { pe_ratio: 9.5, eps: 0.24, roe: 7.2, debt_to_equity: 0.28, payout_ratio: 95 },
  'MBT': { pe_ratio: 9.8, eps: 7.86, roe: 11.5, debt_to_equity: 8.5, payout_ratio: 25 },
  'MREIT': { pe_ratio: 12.5, eps: 1.14, roe: 9.8, debt_to_equity: 0.32, payout_ratio: 90 },
  'RRHI': { pe_ratio: 15.2, eps: 2.51, roe: 8.2, debt_to_equity: 0.55, payout_ratio: 45 }
};

// Analyst targets (would be scraped from Investagrams/COL)
const ANALYST_TARGETS = {
  'DMC': { target: 12.50, rating: 'Buy' },
  'FILRT': { target: 3.80, rating: 'Hold' },
  'GLO': { target: 2100, rating: 'Buy' },
  'KEEPR': { target: 2.85, rating: 'Buy' },
  'MBT': { target: 88.00, rating: 'Buy' },
  'MREIT': { target: 16.50, rating: 'Hold' },
  'RRHI': { target: 45.00, rating: 'Buy' }
};

function supabaseRequest(endpoint, method = 'GET', body = null) {
  const url = new URL(endpoint, SUPABASE_URL);
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
      }
    };

    const req = https.request(url.toString(), options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sendTelegram(message) {
  const url = new URL('/api/message', OPENCLAW_GATEWAY);

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      channel: 'telegram',
      to: TELEGRAM_CHAT_ID,
      message
    });

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(url.toString(), options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    req.on('error', (err) => {
      console.log('Telegram send failed:', err.message);
      resolve({ status: 500, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

function calculatePortfolioHealthScore(portfolio, fundamentals) {
  let score = 50; // Base score

  // Diversification (max 15 points)
  const sectors = [...new Set(portfolio.map(h => h.sector))];
  if (sectors.length >= 4) score += 15;
  else if (sectors.length >= 3) score += 10;
  else if (sectors.length >= 2) score += 5;

  // Average dividend yield (max 15 points)
  const avgYield = portfolio.reduce((sum, h) => sum + (parseFloat(h.dividend_yield) || 0), 0) / portfolio.length;
  if (avgYield >= 6) score += 15;
  else if (avgYield >= 4) score += 10;
  else if (avgYield >= 2) score += 5;

  // PE ratios (max 10 points)
  const avgPE = Object.values(fundamentals).reduce((sum, f) => sum + f.pe_ratio, 0) / Object.values(fundamentals).length;
  if (avgPE < 12) score += 10;
  else if (avgPE < 15) score += 7;
  else if (avgPE < 18) score += 3;

  // P&L status (max 10 points)
  const profitablePositions = portfolio.filter(h => parseFloat(h.unrealized_pl_pct) > 0).length;
  const profitRatio = profitablePositions / portfolio.length;
  if (profitRatio >= 0.7) score += 10;
  else if (profitRatio >= 0.5) score += 7;
  else if (profitRatio >= 0.3) score += 3;

  return Math.min(100, score);
}

function formatDate() {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila'
  };
  return new Date().toLocaleDateString('en-PH', options);
}

function formatCurrency(amount) {
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateTopRecommendations(portfolio) {
  const recommendations = [];

  // Check for undervalued positions
  for (const holding of portfolio) {
    const fundamental = STOCK_FUNDAMENTALS[holding.symbol];
    const analyst = ANALYST_TARGETS[holding.symbol];

    if (!fundamental || !analyst) continue;

    const currentPrice = parseFloat(holding.current_price) || 0;
    const upside = ((analyst.target - currentPrice) / currentPrice) * 100;
    const sectorAvg = SECTOR_PE_AVERAGES[holding.sector] || 12;
    const peDiscount = ((sectorAvg - fundamental.pe_ratio) / sectorAvg) * 100;

    if (upside > 15 && peDiscount > 10) {
      recommendations.push({
        symbol: holding.symbol,
        action: 'ACCUMULATE',
        reason: `${upside.toFixed(0)}% upside to target, PE at ${peDiscount.toFixed(0)}% discount to sector`,
        priority: upside + peDiscount
      });
    } else if (parseFloat(holding.unrealized_pl_pct) > 15 && upside < 5) {
      recommendations.push({
        symbol: holding.symbol,
        action: 'PARTIAL PROFIT',
        reason: `Up ${holding.unrealized_pl_pct}% with limited upside remaining`,
        priority: 50
      });
    }
  }

  // Sort by priority
  recommendations.sort((a, b) => b.priority - a.priority);
  return recommendations.slice(0, 3);
}

async function generateWeeklyDigest() {
  console.log('Sterling: Generating weekly digest...\n');

  // Step 1: Fetch fresh prices
  console.log('Step 1: Fetching prices...');
  try {
    await fetchPrices();
  } catch (err) {
    console.log('Price fetch error:', err.message);
  }

  // Step 2: Get portfolio
  const portfolio = await getPortfolio();

  // Step 3: Calculate health score
  const healthScore = calculatePortfolioHealthScore(portfolio, STOCK_FUNDAMENTALS);

  // Step 4: Generate recommendations
  const recommendations = generateTopRecommendations(portfolio);

  // Build the digest
  const date = formatDate();
  let digest = `⚔️ STERLING — Weekly Digest\n`;
  digest += `📅 Week of ${date}\n\n`;

  // Portfolio health
  const healthEmoji = healthScore >= 80 ? '🟢' : healthScore >= 60 ? '🟡' : '🔴';
  digest += `📊 PORTFOLIO HEALTH: ${healthEmoji} ${healthScore}/100\n\n`;

  // Fundamental analysis for each holding
  digest += `📈 FUNDAMENTAL ANALYSIS\n`;

  for (const holding of portfolio) {
    const fund = STOCK_FUNDAMENTALS[holding.symbol];
    const analyst = ANALYST_TARGETS[holding.symbol];
    const sectorAvg = SECTOR_PE_AVERAGES[holding.sector] || 12;

    if (!fund) continue;

    const currentPrice = parseFloat(holding.current_price) || 0;
    const peVsSector = fund.pe_ratio < sectorAvg ? '✓' : '⚠';

    digest += `\n${holding.symbol} (${holding.sector})\n`;
    digest += `  PE: ${fund.pe_ratio}x ${peVsSector} (sector avg: ${sectorAvg}x)\n`;
    digest += `  EPS: ₱${fund.eps} | ROE: ${fund.roe}%\n`;
    digest += `  Yield: ${holding.dividend_yield}% | Payout: ${fund.payout_ratio}%\n`;

    if (analyst) {
      const upside = ((analyst.target - currentPrice) / currentPrice) * 100;
      digest += `  Target: ₱${analyst.target} (${upside > 0 ? '+' : ''}${upside.toFixed(0)}%) | ${analyst.rating}\n`;
    }
  }

  // REIT-specific analysis
  const reits = portfolio.filter(h => h.is_reit);
  if (reits.length > 0) {
    digest += `\n🏢 REIT ANALYSIS\n`;
    for (const reit of reits) {
      digest += `• ${reit.symbol}: ${reit.dividend_yield}% yield\n`;
      digest += `  Note: Watch 10Y bond yield spread. REITs attractive if spread >3%\n`;
    }
  }

  // Sector allocation
  digest += `\n📊 SECTOR ALLOCATION\n`;
  const sectorAllocation = {};
  let totalValue = 0;

  for (const holding of portfolio) {
    const value = parseFloat(holding.current_price) * holding.qty;
    totalValue += value;
    sectorAllocation[holding.sector] = (sectorAllocation[holding.sector] || 0) + value;
  }

  for (const [sector, value] of Object.entries(sectorAllocation)) {
    const pct = (value / totalValue) * 100;
    digest += `• ${sector}: ${pct.toFixed(1)}%\n`;
  }

  // Portfolio value summary
  let portfolioValue = 0;
  let totalPl = 0;
  for (const holding of portfolio) {
    const value = parseFloat(holding.current_price) * holding.qty;
    portfolioValue += value;
    totalPl += parseFloat(holding.unrealized_pl) || 0;
  }

  const plPct = (totalPl / (portfolioValue - totalPl)) * 100;
  const plSign = totalPl >= 0 ? '+' : '';

  digest += `\n💰 PORTFOLIO SUMMARY\n`;
  digest += `Total Value: ₱${formatCurrency(portfolioValue)}\n`;
  digest += `Total P&L: ${plSign}₱${formatCurrency(totalPl)} (${plSign}${plPct.toFixed(2)}%)\n`;

  // Top 3 recommendations
  if (recommendations.length > 0) {
    digest += `\n🎯 TOP 3 RECOMMENDATIONS\n`;
    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      digest += `${i + 1}. ${rec.symbol}: ${rec.action}\n`;
      digest += `   ${rec.reason}\n`;
    }
  }

  // Weekly outlook
  digest += `\n💡 WEEKLY OUTLOOK\n`;
  if (healthScore >= 70) {
    digest += `Portfolio in good shape. Focus on accumulating during market dips. `;
    digest += `Banking sector remains attractive with strong NIM. `;
    digest += `REITs offer steady income but watch interest rate moves.\n`;
  } else {
    digest += `Portfolio needs attention. Review underperformers and consider rebalancing. `;
    digest += `Focus on dividend-paying blue chips for income stability.\n`;
  }

  digest += `\n—Sterling`;

  console.log('\n========== WEEKLY DIGEST ==========');
  console.log(digest);
  console.log('====================================\n');

  // Send to Telegram (may need to split if too long)
  console.log('Sending to Telegram...');

  // Split message if too long (Telegram limit is 4096 chars)
  if (digest.length > 4000) {
    const mid = digest.indexOf('\n🎯 TOP 3');
    const part1 = digest.substring(0, mid);
    const part2 = digest.substring(mid);

    await sendTelegram(part1);
    await new Promise(r => setTimeout(r, 1000));
    const sendResult = await sendTelegram(part2);
    console.log('Telegram response:', sendResult.status);
    return { success: true, digest, telegram_status: sendResult.status };
  } else {
    const sendResult = await sendTelegram(digest);
    console.log('Telegram response:', sendResult.status);
    return { success: true, digest, telegram_status: sendResult.status };
  }
}

module.exports = { generateWeeklyDigest };

if (require.main === module) {
  generateWeeklyDigest().then(result => {
    console.log('Weekly digest complete.');
    console.log(`Telegram status: ${result.telegram_status}`);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
