const https = require('https');

// Test PSELookup API for historical data
const symbols = ['MBT', 'KEEPR', 'GLO', 'DMC', 'FILRT', 'MREIT', 'RRHI'];
const testDate = '2026-02-28';

symbols.forEach((sym, i) => {
  setTimeout(() => {
    const url = `https://pselookup.vrymel.com/api/stocks/${sym}/history/${testDate}`;
    console.log(`Testing: ${sym} on ${testDate}`);
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (j.open && j.close) {
            console.log(`  ✅ ${sym}: O=${j.open} H=${j.high} L=${j.low} C=${j.close} V=${j.volume}`);
          } else {
            console.log(`  ❌ ${sym}: ${JSON.stringify(j).substring(0, 100)}`);
          }
        } catch (e) {
          console.log(`  ❌ ${sym}: Parse error - ${data.substring(0, 100)}`);
        }
      });
    }).on('error', e => console.log(`  ❌ ${sym}: ${e.message}`));
  }, i * 300);
});
