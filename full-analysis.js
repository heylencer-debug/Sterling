/**
 * Sterling - Full Analysis Generator
 * Deep analysis for a single stock on demand
 * Usage: node full-analysis.js MBT
 */

const analysisData = require('./analysis-data');

const STOCK_SLUGS = {
  MBT: 'metropolitan-b',
  BDO: 'bdo-unibank',
  GLO: 'globe-telecom',
  DMC: 'dmci-holdings',
  RRHI: 'robinsons-retail-holdings',
  FILRT: 'filinvest-reit-corp',
  KEEPR: 'keppel-philippines-properties',
  MREIT: 'megaworld-reit',
  SCC: 'semirara-mining-and-power'
};

function formatCurrency(amount) {
  if (typeof amount !== 'number') return amount;
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getRSIStatus(rsi) {
  if (rsi < 30) return 'OVERSOLD — Strong buying signal';
  if (rsi < 40) return 'Near oversold — Watch for reversal';
  if (rsi > 70) return 'OVERBOUGHT — Consider taking profits';
  if (rsi > 60) return 'Strong momentum, not yet overbought';
  return 'Neutral territory';
}

function getPEAnalysis(pe, sectorAvg) {
  if (!pe || !sectorAvg) return 'Data unavailable';
  const diff = ((sectorAvg - pe) / sectorAvg * 100).toFixed(0);
  if (pe < sectorAvg * 0.8) return `${diff}% CHEAPER than sector — undervalued`;
  if (pe < sectorAvg) return `${diff}% cheaper than sector — fair value`;
  if (pe > sectorAvg * 1.2) return `${Math.abs(diff)}% more expensive than sector — premium valuation`;
  return 'Trading near sector average';
}

function generateFullAnalysis(symbol) {
  const stock = analysisData.stocks[symbol];
  const watchlistStock = analysisData.watchlistAnalysis[symbol];

  if (!stock && !watchlistStock) {
    console.log(`\nStock ${symbol} not found in analysis database.`);
    console.log('Available stocks:', Object.keys(analysisData.stocks).join(', '));
    console.log('Watchlist stocks:', Object.keys(analysisData.watchlistAnalysis).join(', '));
    return null;
  }

  const data = stock || watchlistStock;
  const isPortfolio = !!stock;
  const slug = STOCK_SLUGS[symbol] || symbol.toLowerCase();

  let report = '';

  // Header
  report += `\n${'='.repeat(60)}\n`;
  report += `STERLING — Full Analysis: ${symbol}\n`;
  report += `${'='.repeat(60)}\n\n`;
  report += `${data.company}\n`;
  report += `Sector: ${data.sector}\n`;
  report += `Current Price: P${formatCurrency(data.currentPrice)}\n`;
  report += `Last Updated: ${isPortfolio ? data.analyst?.lastUpdated : data.lastUpdated || '2026-03-02'}\n\n`;

  // FUNDAMENTALS
  report += `${'━'.repeat(50)}\n`;
  report += `FUNDAMENTALS\n`;
  report += `${'━'.repeat(50)}\n\n`;

  if (isPortfolio && data.fundamental) {
    const f = data.fundamental;
    const sectorAvg = f.sectorAvgPE || 11;

    report += `• P/E Ratio: ${f.pe}x (Sector avg: ${sectorAvg}x) -> ${getPEAnalysis(f.pe, sectorAvg)}\n`;
    report += `• Dividend Yield: ${f.dividendYield}% -> ${f.dividendYield > 6 ? 'Excellent income' : f.dividendYield > 4 ? 'Good income' : 'Moderate income'}\n`;

    if (f.eps) report += `• EPS: P${f.eps} ${f.epsGrowthYoY ? `(+${f.epsGrowthYoY}% YoY growth)` : ''}\n`;
    if (f.roe) report += `• ROE: ${f.roe}% -> For every P100 invested, company makes P${f.roe} profit\n`;
    if (f.priceToBook) report += `• Price-to-Book: ${f.priceToBook}x -> ${f.priceToBook < 1 ? 'Trading below book value!' : f.priceToBook < 1.5 ? 'Fair value' : 'Premium to book'}\n`;
    if (f.nav) {
      report += `• NAV (Net Asset Value): P${f.nav}\n`;
      report += `• Discount to NAV: ${f.discountToNav}% -> Buying P${f.nav} of assets for P${data.currentPrice}\n`;
    }
    if (f.occupancyRate) report += `• Occupancy Rate: ${f.occupancyRate}% -> ${f.occupancyRate > 90 ? 'Healthy' : 'Needs attention'}\n`;
    if (f.debtEquity) report += `• Debt/Equity: ${f.debtEquity}x -> ${f.debtEquity < 1 ? 'Low leverage' : f.debtEquity < 2 ? 'Moderate leverage' : 'High leverage'}\n`;
  } else if (!isPortfolio) {
    // Watchlist stock
    report += `• P/E Ratio: ${data.pe}x (Sector avg: ${data.sectorAvgPE || 11}x)\n`;
    report += `• Dividend Yield: ${data.dividendYield}%\n`;
    report += `• RSI: ${data.rsi}\n`;
  }

  report += '\n';

  // TECHNICALS
  report += `${'━'.repeat(50)}\n`;
  report += `TECHNICALS (Investing.com data)\n`;
  report += `${'━'.repeat(50)}\n\n`;

  if (isPortfolio && data.technical) {
    const t = data.technical;

    report += `• RSI(14): ${t.rsi14} -> ${getRSIStatus(t.rsi14)}\n`;
    if (t.macd !== undefined) report += `• MACD: ${t.macd > 0 ? '+' : ''}${t.macd} -> ${t.macdSignal}\n`;

    report += `• Moving Averages Signal: ${t.allMAsignal}\n`;
    if (t.ma20) report += `  - 20-day MA: P${formatCurrency(t.ma20)}\n`;
    if (t.ma50) report += `  - 50-day MA: P${formatCurrency(t.ma50)}\n`;
    if (t.ma100) report += `  - 100-day MA: P${formatCurrency(t.ma100)}\n`;
    if (t.ma200) report += `  - 200-day MA: P${formatCurrency(t.ma200)}\n`;

    report += `\n• Support Levels: P${formatCurrency(t.support1)}`;
    if (t.support2) report += ` / P${formatCurrency(t.support2)}`;
    report += `\n• Resistance Levels: P${formatCurrency(t.resistance1)}`;
    if (t.resistance2) report += ` / P${formatCurrency(t.resistance2)}`;

    report += `\n\n• Pattern: ${t.pattern}\n`;
    report += `• Overall Signal: ${t.overallSignal}\n`;
  } else {
    report += `• RSI: ${data.rsi} -> ${getRSIStatus(data.rsi)}\n`;
    report += `• Overall Signal: ${data.overallSignal}\n`;
  }

  report += '\n';

  // ANALYST CONSENSUS
  if (isPortfolio && data.analyst) {
    report += `${'━'.repeat(50)}\n`;
    report += `ANALYST CONSENSUS\n`;
    report += `${'━'.repeat(50)}\n\n`;

    const a = data.analyst;
    report += `• Consensus: ${a.consensusRating}\n`;
    if (a.numberOfAnalysts) report += `• Number of Analysts: ${a.numberOfAnalysts}\n`;
    if (a.buyRatings) report += `• Buy Ratings: ${a.buyRatings} out of ${a.numberOfAnalysts}\n`;
    if (a.targetPriceLow) report += `• Target Price Low: P${formatCurrency(a.targetPriceLow)}\n`;
    if (a.targetPriceAvg) {
      const upside = ((a.targetPriceAvg - data.currentPrice) / data.currentPrice * 100).toFixed(1);
      report += `• Target Price Average: P${formatCurrency(a.targetPriceAvg)} (+${upside}% upside)\n`;
    }
    if (a.targetPriceHigh) {
      const upside = ((a.targetPriceHigh - data.currentPrice) / data.currentPrice * 100).toFixed(1);
      report += `• Target Price High: P${formatCurrency(a.targetPriceHigh)} (+${upside}% upside)\n`;
    }
    if (a.targetPrice2026End) report += `• 2026 End Target: P${formatCurrency(a.targetPrice2026End)}\n`;
    report += `• Source: ${a.source}\n\n`;
  } else if (!isPortfolio && data.targetBuy) {
    report += `${'━'.repeat(50)}\n`;
    report += `TARGETS\n`;
    report += `${'━'.repeat(50)}\n\n`;

    report += `• Target Buy Price: P${formatCurrency(data.targetBuy)}\n`;
    report += `• Stop Loss: P${formatCurrency(data.stopLoss)}\n`;
    report += `• Target 1: P${formatCurrency(data.target1)}\n`;
    report += `• Target 2: P${formatCurrency(data.target2)}\n\n`;
  }

  // WHAT SHOULD YOU DO?
  report += `${'━'.repeat(50)}\n`;
  report += `WHAT SHOULD YOU DO?\n`;
  report += `${'━'.repeat(50)}\n\n`;

  if (isPortfolio && data.recommendation) {
    const r = data.recommendation;
    report += `VERDICT: ${r.action}\n`;
    report += `Conviction: ${r.conviction}\n\n`;

    report += `WHY:\n`;
    report += `${r.rationale.split('\n').map(line => `  ${line}`).join('\n')}\n\n`;

    report += `ACTION PLAN:\n`;
    report += `${r.action_detail.split('\n').map(line => `  ${line}`).join('\n')}\n\n`;

    report += `PRICE LEVELS:\n`;
    report += `• Entry Zone: ${r.entry_zone}\n`;
    report += `• Stop Loss: ${r.stop_loss}\n`;
    report += `• Take Profit 1: ${r.take_profit_1}\n`;
    report += `• Take Profit 2: ${r.take_profit_2}\n\n`;
  } else if (!isPortfolio) {
    report += `VERDICT: ${data.overallSignal}\n\n`;
    report += `ANALYSIS:\n`;
    report += `${data.reason}\n\n`;

    report += `PRICE LEVELS:\n`;
    report += `• Buy Zone: P${formatCurrency(data.targetBuy)} or below\n`;
    report += `• Stop Loss: P${formatCurrency(data.stopLoss)}\n`;
    report += `• Target 1: P${formatCurrency(data.target1)}\n`;
    report += `• Target 2: P${formatCurrency(data.target2)}\n\n`;
  }

  // SOURCE LINKS
  report += `${'━'.repeat(50)}\n`;
  report += `SOURCE LINKS\n`;
  report += `${'━'.repeat(50)}\n\n`;

  report += `• TradingView Chart: https://www.tradingview.com/symbols/PSE-${symbol}/technicals/\n`;
  report += `• Investing.com Technicals: https://www.investing.com/equities/${slug}-technical\n`;
  report += `• PSE Edge Disclosures: https://edge.pse.com.ph (search ${symbol})\n`;
  report += `• Investagrams: https://www.investagrams.com/Stock/${symbol}\n`;
  report += `• DragonFi: https://www.dragonfi.ph/market/stocks/${symbol}\n`;

  report += `\n${'='.repeat(60)}\n`;
  report += `--Sterling\n`;
  report += `Analysis generated: ${new Date().toISOString().split('T')[0]}\n`;
  report += `${'='.repeat(60)}\n`;

  return report;
}

function listAvailableStocks() {
  console.log('\nSterling Analysis Database');
  console.log('=' .repeat(40));
  console.log('\nPortfolio Stocks:');
  for (const [symbol, data] of Object.entries(analysisData.stocks)) {
    console.log(`  ${symbol.padEnd(8)} - ${data.company}`);
  }
  console.log('\nWatchlist Stocks:');
  for (const [symbol, data] of Object.entries(analysisData.watchlistAnalysis)) {
    console.log(`  ${symbol.padEnd(8)} - ${data.company}`);
  }
  console.log('\nUsage: node full-analysis.js <SYMBOL>');
  console.log('Example: node full-analysis.js MBT\n');
}

// Main execution
if (require.main === module) {
  const symbol = process.argv[2]?.toUpperCase();

  if (!symbol || symbol === '--HELP' || symbol === '-H') {
    listAvailableStocks();
    process.exit(0);
  }

  const report = generateFullAnalysis(symbol);
  if (report) {
    console.log(report);
  } else {
    process.exit(1);
  }
}

module.exports = { generateFullAnalysis, listAvailableStocks };
