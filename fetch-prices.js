/**
 * Sterling - Fetch Prices
 * Fetches live PSE stock prices and updates portfolio
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function supabaseRequest(endpoint, method = 'GET', body = null) {
  const url = new URL(endpoint, SUPABASE_URL);
  const options = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
    }
  };
  if (body) options.body = JSON.stringify(body);
  return httpsRequest(url.toString(), options);
}

async function fetchPhisixPrice(symbol) {
  const url = `http://phisix-api3.appspot.com/stocks/${symbol}.json`;
  return new Promise((resolve, reject) => {
    require('http').get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // API returns "stocks" array, not "stock"
          const stocks = json.stocks || json.stock;
          if (stocks && stocks[0]) {
            resolve({
              symbol: stocks[0].symbol,
              price: stocks[0].price.amount,
              volume: stocks[0].volume,
              percent_change: stocks[0].percentChange || stocks[0].percent_change || 0,
              as_of: json.as_of
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getPortfolio() {
  const res = await supabaseRequest('/rest/v1/sterling_portfolio?select=*');
  return res.data || [];
}

async function updatePortfolioPrice(symbol, currentPrice, unrealizedPl, unrealizedPlPct) {
  const body = {
    current_price: currentPrice,
    unrealized_pl: unrealizedPl,
    unrealized_pl_pct: unrealizedPlPct,
    updated_at: new Date().toISOString()
  };

  const url = `/rest/v1/sterling_portfolio?symbol=eq.${symbol}`;
  await supabaseRequest(url, 'PATCH', body);
}

async function insertPriceHistory(symbol, price, volume, percentChange) {
  const body = {
    symbol,
    price,
    volume,
    percent_change: percentChange
  };
  await supabaseRequest('/rest/v1/sterling_price_history', 'POST', body);
}

async function fetchPrices() {
  console.log('Sterling: Fetching live prices...');

  const portfolio = await getPortfolio();
  if (!portfolio.length) {
    console.log('No holdings in portfolio');
    return { success: false, error: 'Empty portfolio' };
  }

  const results = [];
  let totalValue = 0;
  let totalCost = 0;

  for (const holding of portfolio) {
    console.log(`  Fetching ${holding.symbol}...`);
    const priceData = await fetchPhisixPrice(holding.symbol);

    if (priceData) {
      const currentPrice = priceData.price;
      const avgBuyPrice = parseFloat(holding.avg_buy_price);
      const qty = holding.qty;

      const unrealizedPl = (currentPrice - avgBuyPrice) * qty;
      const unrealizedPlPct = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

      const marketValue = currentPrice * qty;
      const costBasis = avgBuyPrice * qty;

      totalValue += marketValue;
      totalCost += costBasis;

      await updatePortfolioPrice(holding.symbol, currentPrice, unrealizedPl, unrealizedPlPct);
      await insertPriceHistory(holding.symbol, currentPrice, priceData.volume, priceData.percent_change);

      results.push({
        symbol: holding.symbol,
        company_name: holding.company_name,
        qty,
        avg_buy_price: avgBuyPrice,
        current_price: currentPrice,
        percent_change: priceData.percent_change,
        unrealized_pl: unrealizedPl,
        unrealized_pl_pct: unrealizedPlPct,
        market_value: marketValue
      });

      console.log(`    ${holding.symbol}: ₱${currentPrice.toFixed(2)} (${priceData.percent_change >= 0 ? '+' : ''}${priceData.percent_change}%)`);
    } else {
      console.log(`    ${holding.symbol}: Failed to fetch price`);
      results.push({
        symbol: holding.symbol,
        company_name: holding.company_name,
        error: 'Failed to fetch price'
      });
    }

    await sleep(500);
  }

  const summary = {
    success: true,
    timestamp: new Date().toISOString(),
    holdings: results,
    portfolio_value: totalValue,
    total_cost: totalCost,
    total_unrealized_pl: totalValue - totalCost,
    total_unrealized_pl_pct: ((totalValue - totalCost) / totalCost) * 100
  };

  console.log('\nPortfolio Summary:');
  console.log(`  Total Value: ₱${totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
  console.log(`  Total Cost:  ₱${totalCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`);
  console.log(`  Total P&L:   ₱${(totalValue - totalCost).toLocaleString('en-PH', { minimumFractionDigits: 2 })} (${summary.total_unrealized_pl_pct >= 0 ? '+' : ''}${summary.total_unrealized_pl_pct.toFixed(2)}%)`);

  return summary;
}

module.exports = { fetchPrices, fetchPhisixPrice, getPortfolio };

if (require.main === module) {
  fetchPrices().then(result => {
    console.log('\nDone.');
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

