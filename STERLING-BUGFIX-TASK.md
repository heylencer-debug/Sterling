# STERLING BUGFIX TASK
> Agent: claude-opus-4-5 | Priority: URGENT
> Fix 3 confirmed bugs in app.js

---

## Bug 1 — "Full Rationale" shows `undefined`

**Root cause:** `renderStockAction()` reads `a.detail` but `STOCK_INTELLIGENCE` uses `a.conclusion`.

**File:** `C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch\docs\app.js`

**Find line ~1017:**
```js
<div class="action-detail" style="display:none">
  <div>${a.detail}</div>
  ${sourceLinks ? `<div class="action-sources">${sourceLinks}</div>` : ''}
</div>
```

**Replace with:**
```js
<div class="action-detail" style="display:none">
  <p class="action-conclusion">${a.conclusion || ''}</p>
  ${renderThreePillarSources(a)}
</div>
```

**Also find the sourceLinks line above it (~line 992):**
```js
const sourceLinks = (a.sources || []).map(s =>
  `<a href="${s.url}" target="_blank" class="action-src">${s.name} ↗</a>`
).join('');
```

**Replace with:** remove the `sourceLinks` const entirely — it's no longer needed since we use `renderThreePillarSources`.

**Add this helper function** right before `renderStockAction`:
```js
function renderThreePillarSources(a) {
  const allSources = [
    ...(a.fundamentals?.sources || []),
    ...(a.news?.sources || []),
    ...(a.technicals?.sources || [])
  ];
  // Deduplicate by url
  const seen = new Set();
  const unique = allSources.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
  if (!unique.length) return '';
  return `<div class="action-sources">${unique.map(s =>
    `<a href="${s.url}" target="_blank" class="action-src">${s.name} ↗</a>`
  ).join('')}</div>`;
}
```

---

## Bug 2 — Trade log does not update Portfolio cards

**Root cause:** After `sbUpdate` and re-fetch, `renderPortfolio()` correctly re-renders BUT:
- The PATCH updates `qty` and `avg_buy_price` in Supabase
- The re-fetch returns the new values  
- BUT `renderPortfolio()` normalizes: `quantity: h.qty || h.quantity || 0` — this should work

**Real issue to verify:** After `submitTrade`, the code does:
```js
portfolioData = await window.sbFetch('sterling_portfolio', { order: 'symbol.asc' });
renderPortfolio();
```

But `sbFetch` call needs the order format fixed. Check `window.sbFetch` — the `order` option appends `&order=symbol.asc`. That's correct.

**The actual bug:** After a SELL that reduces qty to 0, nothing removes the card. After a BUY of a new symbol, the insert happens but `company_name` and `sector` are set to 'symbol' and 'Unknown' — the card renders ugly.

**Fix the portfolio refresh** — make it more robust:

Find in `submitTrade` (around line 2420):
```js
closeTradeLog();
// Refresh portfolio if loaded
if (loadedPages['portfolio']) {
  portfolioData = await window.sbFetch('sterling_portfolio', { order: 'symbol.asc' });
  renderPortfolio();
}
```

**Replace with:**
```js
closeTradeLog();
showToast(`${action} ${symbol} logged — updating portfolio...`);
// Always refresh portfolio (regardless of which tab is active)
portfolioData = await window.sbFetch('sterling_portfolio', { order: 'symbol.asc' });
loadedPages['portfolio'] = true; // ensure renderPortfolio runs fully
renderPortfolio();
// Also refresh trade history section
if (typeof renderTradeHistory === 'function') {
  renderTradeHistory();
}
```

**Also fix: after a SELL** — if newQty becomes 0, remove from portfolio:
Find the SELL calculation block in submitTrade:
```js
} else {
  newQty = Math.max(0, oldQty - qty);
  newAvg = oldAvg; // avg cost doesn't change on sell
}
await window.sbUpdate('sterling_portfolio', `symbol=eq.${symbol}`, {
  qty: parseFloat(newQty.toFixed(4)),
  avg_buy_price: parseFloat(newAvg.toFixed(4))
});
```

**Replace with:**
```js
} else {
  newQty = Math.max(0, oldQty - qty);
  newAvg = oldAvg;
}
if (action === 'SELL' && newQty === 0) {
  // Remove position entirely
  await window.sbFetch(`sterling_portfolio?symbol=eq.${symbol}`, { method: 'DELETE' });
  // Actually use a delete call:
  const { url, anonKey } = window.SUPABASE_CONFIG;
  await fetch(`${url}/rest/v1/sterling_portfolio?symbol=eq.${symbol}`, {
    method: 'DELETE',
    headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
  });
  showToast(`${symbol} position closed — removed from portfolio`);
} else {
  await window.sbUpdate('sterling_portfolio', `symbol=eq.${symbol}`, {
    qty: parseFloat(newQty.toFixed(4)),
    avg_buy_price: parseFloat(newAvg.toFixed(4))
  });
}
```

---

## Bug 3 — New BUY position gets "Unknown" company name

When a new symbol is added via BUY trade, `company_name` defaults to the symbol string and `sector` to 'Unknown'.

**Fix:** Add a lookup from `PSE_UNIVERSE` array before inserting:

Find in submitTrade:
```js
} else if (action === 'BUY') {
  // New position
  await window.sbInsert('sterling_portfolio', {
    symbol: symbol,
    qty: qty,
    avg_buy_price: price,
    current_price: price,
    company_name: symbol,
    sector: 'Unknown'
  });
```

**Replace with:**
```js
} else if (action === 'BUY') {
  // Look up company info
  const knownStock = PSE_UNIVERSE.find(s => s.symbol === symbol) || {};
  await window.sbInsert('sterling_portfolio', {
    symbol: symbol,
    qty: qty,
    avg_buy_price: price,
    current_price: price,
    company_name: knownStock.name || symbol,
    sector: knownStock.sector || 'PSE',
    is_reit: knownStock.sector === 'REIT'
  });
```

---

## After all fixes

1. Push `app.js`:
```
cd "C:\Users\Carl Rebadomia\.openclaw\workspace\knightwatch"
node push-file.js docs/app.js docs/app.js
```

2. Notify Carlo via Telegram:
```js
const { spawnSync } = require('child_process');
spawnSync(process.execPath, [
  'C:\\Users\\Carl Rebadomia\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
  'message', 'send',
  '--channel', 'telegram',
  '--target', '1424637649',
  '--message', '⚔️ Sterling bugfixes deployed:\n\n✅ Full Rationale now shows properly (was reading wrong key)\n✅ Trade logs now update Portfolio cards immediately\n✅ Sell to zero removes position from portfolio\n✅ New BUY positions get proper company name + sector'
], { stdio: 'inherit' });
```

---

## IMPORTANT NOTES
- Read app.js FULLY before editing — it is 2900+ lines
- Use the `edit` tool for surgical changes — do NOT rewrite the whole file
- PowerShell: no `&&` — use workdir parameter or separate exec calls
- Push only `app.js` — do not touch index.html, style.css, gold.js, or sb.js
