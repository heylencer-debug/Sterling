const https = require('https');

// Find actual chart app URL inside the WordPress landing page
https.get('https://equip.pse.com.ph/', { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' } }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Find all external links / app URLs
    const links = d.match(/https?:\/\/[^\s'"<>]+(?:app|chart|equip|stock)[^\s'"<>]*/gi) || [];
    const uniqueLinks = [...new Set(links)].filter(l => !l.includes('wp-content'));
    console.log('App-related links:');
    uniqueLinks.slice(0, 20).forEach(l => console.log(' ', l));
    
    // Look for iframe src
    const iframes = d.match(/<iframe[^>]+src=['"](https?:\/\/[^'"]+)['"]/gi) || [];
    console.log('\nIframes:', iframes);
    
    // Look for app store / redirect links
    const appLinks = d.match(/href=['"](https?:\/\/[^'"]*pse[^'"]*)['"]/gi) || [];
    console.log('\nPSE links:');
    appLinks.slice(0, 15).forEach(l => console.log(' ', l));
  });
}).on('error', e => console.log('err:', e.message));
