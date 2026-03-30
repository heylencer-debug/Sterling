const http = require('http');
const https = require('https');

// Test Phisix API for current data
const symbols = ['MBT', 'KEEPR', 'GLO', 'DMC'];

console.log('Testing Phisix API (live data):');
symbols.forEach((sym, i) => {
  setTimeout(() => {
    http.get(`http://phisix-api3.appspot.com/stocks/${sym}.json`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const s = j.stock[0];
          console.log(`  ${sym}: price=${s.price.amount} change=${s.percent_change}`);
        } catch (e) {
          console.log(`  ${sym}: Parse error`);
        }
      });
    }).on('error', e => console.log(`  ${sym}: ${e.message}`));
  }, i * 300);
});

// Try investagrams web scraping approach
console.log('\nTesting Investagrams page fetch:');
setTimeout(() => {
  https.get('https://www.investagrams.com/Stock/PSE:MBT', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log(`  Investagrams response length: ${data.length} chars`);
      console.log(`  Status: ${res.statusCode}`);
    });
  }).on('error', e => console.log(`  Investagrams error: ${e.message}`));
}, 2000);
