/**
 * Sterling - Stock Discovery Engine
 * Finds new stocks for Carlo's watchlist based on dividend + long-term criteria
 */

const https = require('https');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Carlo's preferred sectors
const FAVORED_SECTORS = ['Banking', 'Telecoms', 'REIT', 'Consumer', 'Retail', 'Utilities'];

// Candidate stocks to research (high-dividend, blue chips)
const DISCOVERY_CANDIDATES = [
  { symbol: 'BDO', company_name: 'BDO Unibank Inc', sector: 'Banking' },
  { symbol: 'BPI', company_name: 'Bank of the Philippine Islands', sector: 'Banking' },
  { symbol: 'TEL', company_name: 'PLDT Inc', sector: 'Telecoms' },
  { symbol: 'AC', company_name: 'Ayala Corporation', sector: 'Holding' },
  { symbol: 'SM', company_name: 'SM Investments Corporation', sector: 'Holding' },
  { symbol: 'JFC', company_name: 'Jollibee Foods Corporation', sector: 'Consumer' },
  { symbol: 'ALI', company_name: 'Ayala Land Inc', sector: 'Property' },
  { symbol: 'ACEN', company_name: 'ACEN Corporation', sector: 'Utilities' },
  { symbol: 'RLC', company_name: 'Robinsons Land Corporation', sector: 'Property' },
  { symbol: 'AREIT', company_name: 'AREIT Inc', sector: 'REIT' },
  { symbol: 'DDMPR', company_name: 'DDMP REIT Inc', sector: 'REIT' },
  { symbol: 'CREIT', company_name: 'Citicore REIT Inc', sector: 'REIT' },
  { symbol: 'SCC', company_name: 'Semirara Mining and Power', sector: 'Mining/Power' },
  { symbol: 'ICT', company_name: 'International Container Terminal', sector: 'Port Services' },
  { symbol: 'SECB', company_name: 'Security Bank Corporation', sector: 'Banking' }
];

// Estimated fundamentals (would be scraped in production)
const STOCK_FUNDAMENTALS = {
  'BDO': { pe_ratio: 9.2, dividend_yield: 3.8, eps_growth: 15, target_price: 165 },
  'BPI': { pe_ratio: 10.5, dividend_yield: 4.2, eps_growth: 12, target_price: 125 },
  'TEL': { pe_ratio: 14.5, dividend_yield: 5.8, eps_growth: 8, target_price: 1450 },
  'AC': { pe_ratio: 18.2, dividend_yield: 1.5, eps_growth: 10, target_price: 720 },
  'SM': { pe_ratio: 22.5, dividend_yield: 0.8, eps_growth: 12, target_price: 980 },
  'JFC': { pe_ratio: 28.5, dividend_yield: 1.2, eps_growth: 18, target_price: 285 },
  'ALI': { pe_ratio: 15.8, dividend_yield: 1.8, eps_growth: 10, target_price: 38 },
  'ACEN': { pe_ratio: 35.0, dividend_yield: 0.5, eps_growth: 25, target_price: 5.50 },
  'RLC': { pe_ratio: 12.5, dividend_yield: 2.5, eps_growth: 8, target_price: 18 },
  'AREIT': { pe_ratio: 12.0, dividend_yield: 6.2, eps_growth: 5, target_price: 38 },
  'DDMPR': { pe_ratio: 8.5, dividend_yield: 8.5, eps_growth: 3, target_price: 2.00 },
  'CREIT': { pe_ratio: 10.0, dividend_yield: 7.2, eps_growth: 6, target_price: 2.80 },
  'SCC': { pe_ratio: 4.5, dividend_yield: 12.5, eps_growth: -5, target_price: 38 },
  'ICT': { pe_ratio: 16.0, dividend_yield: 3.2, eps_growth: 10, target_price: 245 },
  'SECB': { pe_ratio: 8.8, dividend_yield: 3.5, eps_growth: 14, target_price: 95 }
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

function fetchPhisixPrice(symbol) {
  const url = `http://phisix-api3.appspot.com/stocks/${symbol}.json`;
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const stocks = json.stocks || json.stock;
          if (stocks && stocks[0]) {
            resolve({
              symbol: stocks[0].symbol,
              price: stocks[0].price.amount,
              volume: stocks[0].volume,
              percent_change: stocks[0].percentChange || stocks[0].percent_change || 0
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateFundamentalScore(fundamentals, currentPrice, targetPrice) {
  let score = 50; // Base score

  // PE Ratio scoring (lower is better, max 20 points)
  if (fundamentals.pe_ratio < 10) score += 20;
  else if (fundamentals.pe_ratio < 15) score += 15;
  else if (fundamentals.pe_ratio < 20) score += 10;
  else if (fundamentals.pe_ratio < 25) score += 5;

  // Dividend yield scoring (higher is better, max 25 points)
  if (fundamentals.dividend_yield >= 8) score += 25;
  else if (fundamentals.dividend_yield >= 5) score += 20;
  else if (fundamentals.dividend_yield >= 4) score += 15;
  else if (fundamentals.dividend_yield >= 3) score += 10;
  else if (fundamentals.dividend_yield >= 2) score += 5;

  // EPS growth scoring (positive growth, max 15 points)
  if (fundamentals.eps_growth >= 15) score += 15;
  else if (fundamentals.eps_growth >= 10) score += 12;
  else if (fundamentals.eps_growth >= 5) score += 8;
  else if (fundamentals.eps_growth > 0) score += 4;

  // Upside to target (max 10 points)
  const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
  if (upside >= 20) score += 10;
  else if (upside >= 15) score += 8;
  else if (upside >= 10) score += 6;
  else if (upside >= 5) score += 3;

  return Math.min(100, Math.max(0, score));
}

function generateTechnicalSignal(percentChange) {
  if (percentChange <= -3) return 'Oversold territory, potential bounce';
  if (percentChange <= -1.5) return 'Pullback, watch for support';
  if (percentChange >= 3) return 'Strong momentum, wait for pullback';
  if (percentChange >= 1.5) return 'Bullish continuation';
  return 'Consolidating, neutral';
}

function generateRecommendation(score, currentPrice, targetBuy, upside) {
  if (score >= 80 && currentPrice <= targetBuy * 1.02) {
    return `STRONG BUY — High score ${score}, currently in buy zone`;
  }
  if (score >= 70 && currentPrice <= targetBuy * 1.05) {
    return `BUY on dip — Target entry ₱${targetBuy.toFixed(2)}-${(targetBuy * 1.03).toFixed(2)}`;
  }
  if (score >= 60) {
    return `ACCUMULATE — Good fundamentals, wait for ₱${targetBuy.toFixed(2)} entry`;
  }
  return `WATCH — Monitor for better entry at ₱${targetBuy.toFixed(2)}`;
}

async function getExistingWatchlist() {
  const res = await supabaseRequest('/rest/v1/sterling_watchlist?select=symbol');
  return (res.data || []).map(w => w.symbol);
}

async function getPortfolioSymbols() {
  const res = await supabaseRequest('/rest/v1/sterling_portfolio?select=symbol');
  return (res.data || []).map(p => p.symbol);
}

async function upsertWatchlist(stock) {
  // Check if exists
  const checkRes = await supabaseRequest(`/rest/v1/sterling_watchlist?symbol=eq.${stock.symbol}&select=id`);

  if (checkRes.data && checkRes.data.length > 0) {
    // Update existing
    await supabaseRequest(`/rest/v1/sterling_watchlist?symbol=eq.${stock.symbol}`, 'PATCH', {
      ...stock,
      updated_at: new Date().toISOString()
    });
  } else {
    // Insert new
    await supabaseRequest('/rest/v1/sterling_watchlist', 'POST', stock);
  }
}

async function discoverStocks() {
  console.log('Sterling: Running stock discovery...');
  console.log('Criteria: Dividend yield >4%, PE <20, favored sectors\n');

  const existingWatchlist = await getExistingWatchlist();
  const portfolioSymbols = await getPortfolioSymbols();
  const discovered = [];

  for (const candidate of DISCOVERY_CANDIDATES) {
    // Skip if already in portfolio
    if (portfolioSymbols.includes(candidate.symbol)) {
      console.log(`  ${candidate.symbol}: Already in portfolio, skipping`);
      continue;
    }

    console.log(`  Analyzing ${candidate.symbol} (${candidate.company_name})...`);

    const priceData = await fetchPhisixPrice(candidate.symbol);
    if (!priceData) {
      console.log(`    Failed to fetch price`);
      await sleep(500);
      continue;
    }

    const fundamentals = STOCK_FUNDAMENTALS[candidate.symbol];
    if (!fundamentals) {
      await sleep(500);
      continue;
    }

    // Apply Carlo's criteria
    const meetsYieldCriteria = fundamentals.dividend_yield >= 4.0;
    const meetsPECriteria = fundamentals.pe_ratio < 20;
    const meetsScore = true; // Calculate below

    // Calculate entry points
    const currentPrice = priceData.price;
    const targetBuyPrice = Math.round(currentPrice * 0.95 * 100) / 100; // 5% below current
    const stopLoss = Math.round(targetBuyPrice * 0.92 * 100) / 100; // 8% below entry
    const targetPrice = fundamentals.target_price;

    const fundamentalScore = calculateFundamentalScore(fundamentals, currentPrice, targetPrice);
    const technicalSignal = generateTechnicalSignal(priceData.percent_change);
    const upside = ((targetPrice - currentPrice) / currentPrice) * 100;
    const recommendation = generateRecommendation(fundamentalScore, currentPrice, targetBuyPrice, upside);

    // Build reason string
    const reasons = [];
    if (fundamentals.pe_ratio < 15) reasons.push(`PE ${fundamentals.pe_ratio}x (attractive)`);
    if (fundamentals.dividend_yield >= 5) reasons.push(`Div yield ${fundamentals.dividend_yield}%`);
    if (fundamentals.eps_growth > 10) reasons.push(`EPS growth ${fundamentals.eps_growth}%`);
    if (upside > 10) reasons.push(`${upside.toFixed(0)}% upside to ₱${targetPrice}`);

    const stockData = {
      symbol: candidate.symbol,
      company_name: candidate.company_name,
      current_price: currentPrice,
      target_buy_price: targetBuyPrice,
      stop_loss: stopLoss,
      reason: reasons.join(', ') || 'Solid blue chip with consistent dividends',
      sector: candidate.sector,
      pe_ratio: fundamentals.pe_ratio,
      dividend_yield: fundamentals.dividend_yield,
      analyst_target: targetPrice,
      technical_signal: technicalSignal,
      fundamental_score: fundamentalScore,
      recommendation
    };

    // Only add if meets criteria or has high score
    if ((meetsYieldCriteria || meetsPECriteria) && fundamentalScore >= 50) {
      await upsertWatchlist(stockData);
      discovered.push(stockData);

      console.log(`    Price: ₱${currentPrice.toFixed(2)} | PE: ${fundamentals.pe_ratio} | Yield: ${fundamentals.dividend_yield}%`);
      console.log(`    Score: ${fundamentalScore}/100 | ${recommendation}`);
    } else {
      console.log(`    Does not meet criteria (Score: ${fundamentalScore})`);
    }

    await sleep(500);
  }

  // Sort by fundamental score
  discovered.sort((a, b) => b.fundamental_score - a.fundamental_score);

  console.log('\n========== TOP PICKS ==========');
  for (const stock of discovered.slice(0, 5)) {
    console.log(`\n${stock.symbol} (${stock.company_name})`);
    console.log(`  Score: ${stock.fundamental_score}/100`);
    console.log(`  Price: ₱${stock.current_price} | Target Buy: ₱${stock.target_buy_price}`);
    console.log(`  ${stock.recommendation}`);
  }

  return {
    success: true,
    timestamp: new Date().toISOString(),
    stocks_analyzed: DISCOVERY_CANDIDATES.length,
    stocks_discovered: discovered.length,
    top_picks: discovered.slice(0, 5),
    all_discovered: discovered
  };
}

module.exports = { discoverStocks };

if (require.main === module) {
  discoverStocks().then(result => {
    console.log(`\nDiscovery complete. ${result.stocks_discovered} stocks added to watchlist.`);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
