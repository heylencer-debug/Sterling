const https = require('https');

const symbols = ['MBT.PS', 'KEEPR.PS', 'GLO.PS', 'DMC.PS', '%5EPSEi'];

symbols.forEach((sym, i) => {
  setTimeout(() => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=5d`;
    console.log(`Testing: ${sym}`);
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.chart?.result?.[0]?.timestamp) {
            console.log(`  ✅ ${sym}: ${j.chart.result[0].timestamp.length} data points`);
          } else if (j.chart?.error) {
            console.log(`  ❌ ${sym}: ${j.chart.error.description || 'API error'}`);
          } else {
            console.log(`  ❌ ${sym}: No data`);
          }
        } catch (e) {
          console.log(`  ❌ ${sym}: Parse error - ${data.substring(0, 200)}`);
        }
      });
    }).on('error', e => console.log(`  ❌ ${sym}: ${e.message}`));
  }, i * 500);
});
