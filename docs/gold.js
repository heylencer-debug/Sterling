// Sterling — Gold Trading Module
// Live XAU/USD price, gold positions, broker recommendations

let goldPriceData = { usd: null, php: null, change: null };
let goldTrades = [];
let usdPhpRate = 56.50; // fallback

// ==================== GOLD PAGE INIT ====================

async function loadGoldPage() {
  showLoader();
  try {
    await Promise.all([
      fetchGoldPrice(),
      fetchGoldTrades()
    ]);
    renderGoldPage();
    updateLastUpdate();

    // Auto-refresh every 60s
    setInterval(async () => {
      await fetchGoldPrice();
      await fetchGoldTrades();
      renderGoldPage();
      updateLastUpdate();
    }, 60000);
  } catch (err) {
    console.error('Gold page load error:', err);
  }
  hideLoader();
}

// ==================== GOLD PRICE FETCHING ====================

async function fetchGoldPrice() {
  // Fetch USD/PHP rate
  try {
    const fxRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const fxData = await fxRes.json();
    if (fxData.rates && fxData.rates.PHP) {
      usdPhpRate = fxData.rates.PHP;
    }
  } catch (e) {
    console.log('USD/PHP fetch error, using fallback:', e);
  }

  // Try primary: gold-api.com
  try {
    const res = await fetch('https://api.gold-api.com/price/XAU');
    const data = await res.json();
    if (data.price) {
      goldPriceData.usd = data.price;
      goldPriceData.php = data.price * usdPhpRate;
      goldPriceData.change = data.ch || data.chp || 0;
      return;
    }
  } catch (e) {
    console.log('Primary gold API error:', e);
  }

  // Fallback: open.er-api.com (XAU base rates)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/XAU');
    const data = await res.json();
    if (data.rates && data.rates.USD) {
      // XAU/USD = 1/rate since XAU is base
      goldPriceData.usd = 1 / data.rates.USD;
      goldPriceData.php = goldPriceData.usd * usdPhpRate;
      goldPriceData.change = 0; // No change data from this API
    }
  } catch (e) {
    console.log('Fallback gold API error:', e);
  }
}

// ==================== GOLD TRADES ====================

async function fetchGoldTrades() {
  try {
    goldTrades = await window.sbFetch('sterling_gold_trades', { order: 'date.desc' });
  } catch (e) {
    console.log('Gold trades fetch error (table may not exist yet):', e);
    goldTrades = [];
  }
}

// ==================== RENDER ====================

function renderGoldPage() {
  const container = document.getElementById('page-gold');
  if (!container) return;

  const priceUsd = goldPriceData.usd ? `$${goldPriceData.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const pricePhp = goldPriceData.php ? `₱${goldPriceData.php.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const changeVal = goldPriceData.change || 0;
  const changeClass = changeVal >= 0 ? 'up' : 'down';
  const changeSign = changeVal >= 0 ? '+' : '';
  const fxDisplay = `$1 = ₱${usdPhpRate.toFixed(2)}`;

  // Calculate running P&L
  let totalProfitUsd = 0;
  let totalProfitPhp = 0;
  goldTrades.forEach(t => {
    totalProfitUsd += parseFloat(t.profit_usd || 0);
    totalProfitPhp += parseFloat(t.profit_php || 0);
  });
  const plClass = totalProfitUsd >= 0 ? 'positive' : 'negative';

  container.innerHTML = `
    <div class="page-header">
      <h1>Gold Trading</h1>
      <div class="gold-fx-badge">${fxDisplay}</div>
    </div>

    <!-- Gold Price Ticker -->
    <div class="gold-ticker">
      <div class="gold-ticker-main">
        <div class="gold-ticker-label">XAU/USD</div>
        <div class="gold-ticker-price">${priceUsd}</div>
        <div class="gold-ticker-change ${changeClass}">${changeSign}${changeVal.toFixed(2)}%</div>
      </div>
      <div class="gold-ticker-php">
        <div class="gold-ticker-label">XAU/PHP Equivalent</div>
        <div class="gold-ticker-price-php">${pricePhp}</div>
      </div>
      <div class="gold-ticker-meta">
        <span>Refreshes every 60s</span>
        <span>Last: ${new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <!-- Gold Positions Table -->
    <div class="gold-positions">
      <div class="gold-positions-header">
        <h2>Trade Positions</h2>
        <div class="gold-running-pl">
          <span class="gold-pl-label">Running P&L:</span>
          <span class="gold-pl-value ${plClass}">$${totalProfitUsd.toFixed(2)} / ₱${totalProfitPhp.toFixed(2)}</span>
        </div>
      </div>
      ${renderGoldTradesTable()}
    </div>

    <!-- Platform Recommendations -->
    <div class="gold-brokers">
      <h2>Recommended Gold Trading Platforms</h2>
      <div class="broker-cards-grid">
        ${renderBrokerCards()}
      </div>
    </div>
  `;
}

function renderGoldTradesTable() {
  if (!goldTrades || goldTrades.length === 0) {
    return `<div class="empty-state"><div class="empty-state-icon">⚡</div><div class="empty-state-text">No gold trades logged yet. Use the Trade Log button to add your first trade.</div></div>`;
  }

  const rows = goldTrades.map(t => {
    const dir = t.direction || 'BUY';
    const dirClass = dir === 'BUY' ? 'buy-dir' : 'sell-dir';
    const status = t.status || 'OPEN';
    const statusClass = status === 'OPEN' ? 'status-open' : 'status-closed';
    const profitUsd = parseFloat(t.profit_usd || 0);
    const profitPhp = parseFloat(t.profit_php || 0);
    const plClass = profitUsd >= 0 ? 'positive' : 'negative';

    return `
      <tr>
        <td>${t.date || '—'}</td>
        <td class="${dirClass}">${dir}</td>
        <td>$${parseFloat(t.entry_price || 0).toFixed(2)}</td>
        <td>${t.exit_price ? '$' + parseFloat(t.exit_price).toFixed(2) : '—'}</td>
        <td>${t.lot_size || 0}</td>
        <td class="${plClass}">$${profitUsd.toFixed(2)}</td>
        <td class="${plClass}">₱${profitPhp.toFixed(2)}</td>
        <td><span class="trade-status ${statusClass}">${status}</span></td>
        <td class="trade-notes">${t.notes || ''}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="gold-table-wrap">
      <table class="gold-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Direction</th>
            <th>Entry</th>
            <th>Exit</th>
            <th>Lots</th>
            <th>P&L (USD)</th>
            <th>P&L (PHP)</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderBrokerCards() {
  const brokers = [
    {
      name: 'XM',
      logo: '🟢',
      pros: ['Free demo account', 'MT4/MT5 platforms', 'GCash deposits accepted', 'Low minimum deposit ($5)'],
      bestFor: 'Beginners',
      url: 'https://www.xm.com',
      color: '#00C97A'
    },
    {
      name: 'Exness',
      logo: '🔵',
      pros: ['Most popular in PH', 'Tight gold spreads', 'Instant GCash withdrawal', 'No minimum deposit'],
      bestFor: 'Filipino Traders',
      url: 'https://www.exness.com',
      color: '#3B82F6'
    },
    {
      name: 'IC Markets',
      logo: '🟣',
      pros: ['Tightest spreads globally', 'Raw ECN pricing', 'cTrader + MT5', 'Best for scalping'],
      bestFor: 'Advanced Traders',
      url: 'https://www.icmarkets.com',
      color: '#8B5CF6'
    },
    {
      name: 'OANDA',
      logo: '🟠',
      pros: ['No minimum deposit', 'Trusted & regulated', 'API available for bots', 'Great charting tools'],
      bestFor: 'API / Bot Traders',
      url: 'https://www.oanda.com',
      color: '#F59E0B'
    }
  ];

  return brokers.map(b => `
    <div class="broker-card" style="border-left: 3px solid ${b.color}">
      <div class="broker-header">
        <span class="broker-logo">${b.logo}</span>
        <span class="broker-name">${b.name}</span>
        <span class="broker-best-for" style="background: ${b.color}20; color: ${b.color}">Best for: ${b.bestFor}</span>
      </div>
      <ul class="broker-pros">
        ${b.pros.map(p => `<li>${p}</li>`).join('')}
      </ul>
      <a href="${b.url}" target="_blank" class="broker-link" style="border-color: ${b.color}; color: ${b.color}">Visit ${b.name} &rarr;</a>
    </div>
  `).join('');
}
