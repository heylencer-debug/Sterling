const https = require('https');

// PSE Edge internal endpoints - their charts load data from somewhere
const endpoints = [
  // Historical closing prices
  '/stockMarket/companyInfo.ax?cmpy_id=573',
  '/stockMarket/stockQuotes.ax?cmpy_id=573',
  '/stockMarket/priceHistory.ax?cmpy_id=573',
  '/common/closingPriceList.ax?cmpy_id=573',
  '/common/historicalStockInfo.ax?cmpy_id=573&dateFrom=20260101&dateTo=20260302',
  '/companyPage/chartData.ax?cmpy_id=573',
  '/stockMarket/stockMarketSummary.ax',
];

endpoints.forEach(path => {
  https.get({
    hostname: 'edge.pse.com.ph',
    path,
    headers: {
      'User-Agent': 'Mozilla/5.0 Chrome/120',
      'Accept': 'application/json, text/javascript, */*',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=573'
    }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      const preview = d.substring(0, 120).replace(/\s+/g, ' ');
      console.log(`${res.statusCode} ${path.split('?')[0]}: ${preview}`);
    });
  }).on('error', e => console.log(`ERR ${path}: ${e.message}`));
});
