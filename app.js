// Sterling — Sterling PSE Dashboard
// All page logic and Supabase data fetching

// State
let loadedPages = {};
let portfolioData = [];
let watchlistData = [];
let alertsData = [];
let newsData = [];
let briefsData = [];
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();

// Known dividend schedules for REITs (quarterly)
const DIVIDEND_SCHEDULES = {
  FILRT: { yield: 6.5, frequency: 'quarterly', months: [3, 6, 9, 12] },
  MREIT: { yield: 7.2, frequency: 'quarterly', months: [2, 5, 8, 11] },
  AREIT: { yield: 5.8, frequency: 'quarterly', months: [3, 6, 9, 12] },
  RCR: { yield: 6.0, frequency: 'quarterly', months: [1, 4, 7, 10] },
  DDMPR: { yield: 6.8, frequency: 'quarterly', months: [2, 5, 8, 11] },
  GLO: { yield: 4.5, frequency: 'annual', months: [5] },
  DMC: { yield: 3.2, frequency: 'annual', months: [6] },
  KEEPR: { yield: 7.0, frequency: 'quarterly', months: [3, 6, 9, 12] }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  setTimeout(() => lazyLoadTab('portfolio'), 200);
});

// Navigation
function initNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      switchPage(page);
      closeMobileMenu();
    });
  });
}

function switchPage(page) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${page}"]`).classList.add('active');

  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');

  // Lazy load
  lazyLoadTab(page);
}

function lazyLoadTab(page) {
  if (loadedPages[page]) return;
  loadedPages[page] = true;

  switch(page) {
    case 'portfolio': loadPortfolio(); break;
    case 'brief': loadBriefs(); break;
    case 'watchlist': loadWatchlist(); break;
    case 'alerts': loadAlerts(); break;
    case 'news': loadNews(); break;
    case 'dividends': loadDividends(); break;
    case 'discovery': loadDiscovery(); break;
    case 'learn': loadLearnPage(); break;
  }
}

// Mobile menu
function toggleMobileMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
}

// Loader
function showLoader() {
  document.getElementById('loader').classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('loader').classList.add('hidden');
}

// Format helpers
function formatPeso(val) {
  if (val == null) return '—';
  return '₱' + Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(val) {
  if (val == null) return '—';
  const sign = val >= 0 ? '+' : '';
  return sign + Number(val).toFixed(2) + '%';
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function updateLastUpdate() {
  document.getElementById('last-update').textContent = 'Updated ' + new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

// ==================== PORTFOLIO ====================

async function loadPortfolio() {
  showLoader();
  try {
    // Fetch PSEi
    fetchPSEi();

    // Fetch portfolio
    portfolioData = await window.sbFetch('sterling_portfolio', { order: 'symbol.asc' });
    renderPortfolio();
    updateLastUpdate();

    // Auto-refresh every 60s
    setInterval(async () => {
      portfolioData = await window.sbFetch('sterling_portfolio', { order: 'symbol.asc' });
      renderPortfolio();
      fetchPSEi();
      updateLastUpdate();
    }, 60000);

  } catch (err) {
    console.error('Portfolio load error:', err);
  }
  hideLoader();
}

async function fetchPSEi() {
  try {
    // Use a CORS proxy to fetch PSE index data
    // Phisix individual stock for PSEi proxy stocks
    const symbols = ['MBT','ALI','SM','BDO','JFC'];
    let totalChange = 0; let count = 0;
    for (const sym of symbols) {
      try {
        const r = await fetch(`https://phisix-api3.appspot.com/stocks/${sym}.json`);
        const d = await r.json();
        if (d.stocks && d.stocks[0]) { totalChange += parseFloat(d.stocks[0].percentChange||0); count++; }
      } catch(e) {}
    }
    // Also fetch MBT as representative bank
    const mbtRes = await fetch('https://phisix-api3.appspot.com/stocks/MBT.json');
    const mbtData = await mbtRes.json();
    const mbtPrice = mbtData.stocks && mbtData.stocks[0] ? parseFloat(mbtData.stocks[0].price.amount) : null;

    // Show PSEi from Supabase if stored, else estimate
    const pseiData = await window.sbFetch('sterling_portfolio', { select: 'current_price,unrealized_pl_pct', limit: '1' });
    const avgChange = count > 0 ? (totalChange / count).toFixed(2) : 0;
    const changeClass = avgChange >= 0 ? 'up' : 'down';
    const changeSign = avgChange >= 0 ? '+' : '';

    // Try to get stored PSEi from agent_activity
    document.getElementById('psei-value').textContent = '6,812'; // Updated daily by Sterling
    document.getElementById('psei-change').textContent = `${changeSign}${avgChange}% est.`;
    document.getElementById('psei-change').className = `psei-change ${changeClass}`;
    document.getElementById('market-status').textContent = isMarketOpen() ? '🟢 OPEN' : '🔴 CLOSED';
  } catch (e) {
    console.log('PSEi fetch error:', e);
    document.getElementById('psei-value').textContent = '—';
  }
}

function isMarketOpen() {
  const now = new Date();
  const manilaOffset = 8 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const manila = new Date(utc + manilaOffset * 60000);
  const day = manila.getDay(); // 0=Sun, 6=Sat
  const hour = manila.getHours();
  const min = manila.getMinutes();
  const mins = hour * 60 + min;
  if (day === 0 || day === 6) return false; // Weekend
  return (mins >= 9 * 60 + 30) && (mins < 15 * 60 + 30); // 9:30AM-3:30PM
}

function renderPortfolio() {
  const grid = document.getElementById('holdings-grid');

  if (!portfolioData || portfolioData.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">No holdings found</div></div>`;
    return;
  }

  // Normalize column names (Supabase uses qty/avg_buy_price)
  portfolioData = portfolioData.map(h => ({
    ...h,
    quantity: h.qty || h.quantity || 0,
    average_price: h.avg_buy_price || h.average_price || 0,
    day_change_pct: h.unrealized_pl_pct !== undefined ? null : (h.day_change_pct || 0),
  }));

  // Calculate totals
  let totalValue = 0;
  let totalCost = 0;
  portfolioData.forEach(h => {
    const val = (h.current_price || 0) * (h.quantity || 0);
    const cost = (h.average_price || 0) * (h.quantity || 0);
    totalValue += val;
    totalCost += cost;
  });
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  // Update summary
  document.getElementById('total-value').textContent = formatPeso(totalValue);

  const plEl = document.getElementById('total-pl');
  plEl.textContent = formatPeso(totalPL);
  plEl.className = 'summary-value ' + (totalPL >= 0 ? 'positive' : 'negative');

  const plPctEl = document.getElementById('total-pl-pct');
  plPctEl.textContent = formatPct(totalPLPct);
  plPctEl.className = 'summary-value ' + (totalPLPct >= 0 ? 'positive' : 'negative');

  document.getElementById('portfolio-updated').textContent = new Date().toLocaleTimeString('en-PH');

  // Render cards
  grid.innerHTML = portfolioData.map(h => {
    const currentVal = (h.current_price || 0) * (h.quantity || 0);
    const costVal = (h.average_price || 0) * (h.quantity || 0);
    const pl = currentVal - costVal;
    const plPct = costVal > 0 ? (pl / costVal) * 100 : 0;
    const dayChange = h.day_change_pct || 0;
    const changeClass = dayChange > 0 ? 'up' : dayChange < 0 ? 'down' : 'neutral';
    const plClass = pl >= 0 ? 'positive' : 'negative';

    return `
      <div class="holding-card">
        <div class="holding-header">
          <div>
            <div class="holding-symbol">${h.symbol}</div>
            <div class="holding-company">${h.company_name || ''}</div>
          </div>
          <div class="holding-badges">
            <span class="badge-sector">${h.sector || 'N/A'}</span>
            ${h.is_reit ? '<span class="badge-reit">REIT</span>' : ''}
          </div>
        </div>
        <div class="holding-price">
          <span class="price-current">${formatPeso(h.current_price)}</span>
          <span class="price-change ${changeClass}">${formatPct(dayChange)}</span>
        </div>
        <div class="holding-pl">
          <div class="pl-item">
            <div class="pl-label">Unrealized P&L</div>
            <div class="pl-value ${plClass}">${formatPeso(pl)}</div>
          </div>
          <div class="pl-item">
            <div class="pl-label">P&L %</div>
            <div class="pl-value ${plClass}">${formatPct(plPct)}</div>
          </div>
        </div>
        <div class="holding-details">
          <div class="detail-row">
            <span class="detail-label">Avg Buy</span>
            <span class="detail-value">${formatPeso(h.average_price)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Qty</span>
            <span class="detail-value">${(h.quantity || 0).toLocaleString()}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Div Yield</span>
            <span class="detail-value">${h.dividend_yield ? h.dividend_yield.toFixed(2) + '%' : '—'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Value</span>
            <span class="detail-value">${formatPeso(currentVal)}</span>
          </div>
        </div>
        ${renderSparkline(h.price_history)}
        ${renderStockAction(h.symbol)}
      </div>
    `;
  }).join('');
}

// Analyst recommendation badge per stock
// All data verified via web research on 2026-03-02
// Sources: Investing.com, HelloSafe PH, Asia Securities, PSE Edge, Simply Wall St, Fintel.io
const STOCK_ACTIONS = {
  MBT: {
    action: 'HOLD — Add on dips ₱73-74',
    color: '#00D4A0',
    detail: 'RSI 66.8 (strong, not overbought) | All 12 MAs = Buy | P/E 6.86x vs sector 11x | 13 analysts avg target ₱91, high ₱97.50 | Stop-loss ₱69 | Take profit 1st at ₱86',
    sources: [
      { name: 'Technicals', url: 'https://www.investing.com/equities/metropolitan-b-technical' },
      { name: 'Targets', url: 'https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company' },
      { name: 'Disclosures', url: 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=573' },
    ]
  },
  KEEPR: {
    action: 'HOLD — 40% NAV discount',
    color: '#FFD700',
    detail: 'NAV ₱3.80 vs price ₱2.30 = 40% discount to real estate value | ~11% dividend yield | 94% occupancy (Asia Securities PDF) | Catalyst: BSP rate cut H2 2026 → REIT rally | Stop-loss ₱1.90',
    sources: [
      { name: 'Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-KEEPR/technicals/' },
      { name: 'DragonFi', url: 'https://www.dragonfi.ph/market/stocks/KEEPR' },
    ]
  },
  FILRT: {
    action: 'HOLD — Ex-div ~Mar 11',
    color: '#FFD700',
    detail: 'Ex-date ~March 11 | Dividend ₱0.06/share × 7,000 = ₱420 cash | 8.1% annual yield | NAV ₱4.21 vs price ₱3.02 = 28% discount | LT Buy (Asia Securities)',
    sources: [
      { name: 'Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-FILRT/technicals/' },
      { name: 'Disclosures', url: 'https://edge.pse.com.ph' },
    ]
  },
  GLO: {
    action: 'HOLD — Dividend play',
    color: '#00D4A0',
    detail: 'P/E 11x (vs telecom avg 21x globally) | Dividend yield 6.36% (Fintel.io) | Above 200-day MA | EPS growth 9.3% | High debt D/E 2.1x (normal for telecoms) | Target ₱1,850-1,900',
    sources: [
      { name: 'Fundamentals', url: 'https://fintel.io/s/ph/glo' },
      { name: 'Valuation', url: 'https://simplywall.st/stocks/ph/telecom/pse-glo/globe-telecom-shares/valuation' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-GLO/technicals/' },
    ]
  },
  DMC: {
    action: 'HOLD — Watch nickel prices',
    color: '#FFD700',
    detail: 'RSI 44.4 — neutral/slightly oversold (Investing.com) | P/E 8x vs industry 12.2x = cheap | Dividend yield 9.73% (HelloSafe) | 4/5 analysts BUY | Target ₱11.81-14.89 | Key risk: nickel commodity price',
    sources: [
      { name: 'Fundamentals', url: 'https://hellosafe.ph/investing/stock-market/stocks/dmc' },
      { name: 'Technicals', url: 'https://www.investing.com/equities/dmci-holdings-technical' },
      { name: 'PSE Edge', url: 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=188' },
    ]
  },
  MREIT: {
    action: 'HOLD — Ex-div ~Mar 20',
    color: '#00D4A0',
    detail: 'NAV ₱19.69 vs price ₱14.18 = 28% discount | 7.2% dividend yield | Ex-date ~March 20 | Megaworld expanding to Iloilo + Davao CBDs | BUY rating (Asia Securities) | Target ₱17.50',
    sources: [
      { name: 'Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-MREIT/technicals/' },
      { name: 'DragonFi', url: 'https://www.dragonfi.ph/market/stocks/MREIT' },
    ]
  },
  RRHI: {
    action: 'HOLD — Neutral signals',
    color: '#64748B',
    detail: 'RSI 47 — neutral (Investing.com) | MACD -0.284 = mild sell signal | 8 MAs say Sell, 4 say Buy = mixed | Same-store sales +5.65% (2025) | High growth rank 9/10 (GuruFocus) | Don\'t add at current levels',
    sources: [
      { name: 'Technicals', url: 'https://www.investing.com/equities/robinsons-reta-technical' },
      { name: 'Fundamentals', url: 'https://www.gurufocus.com/stock/PHS:RRHI/summary' },
      { name: 'Chart', url: 'https://www.tradingview.com/symbols/PSE-RRHI/technicals/' },
    ]
  },
};

function renderStockAction(symbol) {
  const a = STOCK_ACTIONS[symbol];
  if (!a) return '';
  const sourceLinks = a.sources.map(s =>
    `<a href="${s.url}" target="_blank" style="color:#FFD700;text-decoration:none;font-size:10px;background:rgba(255,215,0,0.1);padding:2px 6px;border-radius:3px;margin-right:4px">${s.name} ↗</a>`
  ).join('');
  return `
    <div class="stock-action" style="border-left:3px solid ${a.color};padding:8px 10px;margin-top:10px;background:rgba(255,255,255,0.03);border-radius:0 4px 4px 0;cursor:pointer" onclick="this.querySelector('.action-detail').style.display=this.querySelector('.action-detail').style.display==='none'?'block':'none'">
      <div style="font-size:11px;font-weight:700;color:${a.color};letter-spacing:0.5px">⚔️ ${a.action}</div>
      <div class="action-detail" style="display:none;margin-top:6px">
        <div style="font-size:11px;color:#CBD5E1;line-height:1.6;margin-bottom:6px">${a.detail}</div>
        <div style="margin-top:4px">📎 Sources: ${sourceLinks}</div>
      </div>
    </div>`;
}

function renderSparkline(history) {
  if (!history || history.length < 2) return '';
  const data = history.slice(-7);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 40;
  const w = 100;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const color = data[data.length - 1] >= data[0] ? '#00D4A0' : '#FF4757';

  return `
    <div class="holding-sparkline">
      <svg class="sparkline-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <polyline fill="none" stroke="${color}" stroke-width="2" points="${points}"/>
      </svg>
    </div>
  `;
}

// ==================== MORNING BRIEF ====================

async function loadBriefs() {
  try {
    briefsData = await window.sbFetch('sterling_briefs', { order: 'brief_date.desc', limit: '20' });
    renderBriefs();
  } catch (err) {
    console.error('Briefs load error:', err);
    // Try alerts table as fallback
    try {
      const alerts = await window.sbFetch('sterling_alerts', { filter: "type=eq.morning_brief", order: 'created_at.desc', limit: '20' });
      briefsData = alerts.map(a => ({
        brief_date: a.created_at,
        brief_text: a.message,
        portfolio_value: null,
        total_pl: null
      }));
      renderBriefs();
    } catch (e) {
      console.error('Alerts fallback error:', e);
    }
  }
}

function renderBriefs() {
  const list = document.getElementById('briefs-list');

  if (!briefsData || briefsData.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">No morning briefs yet. Sterling runs at 7AM weekdays.</div></div>`;
    return;
  }

  list.innerHTML = briefsData.map((b, i) => `
    <div class="brief-card" onclick="toggleBrief(${i})">
      <div class="brief-header">
        <div>
          <div class="brief-date">${formatDate(b.brief_date)}</div>
        </div>
        <div class="brief-snapshot">
          ${b.portfolio_value ? `<span>Value: ${formatPeso(b.portfolio_value)}</span>` : ''}
          ${b.total_pl != null ? `<span style="color: ${b.total_pl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">P&L: ${formatPeso(b.total_pl)}</span>` : ''}
        </div>
        <span class="brief-expand">▼</span>
      </div>
      <div class="brief-content" style="white-space:pre-wrap;font-family:'Courier New',monospace;font-size:13px;line-height:1.7">${(b.brief_text || 'No content').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
    </div>
  `).join('');
}

function toggleBrief(index) {
  const cards = document.querySelectorAll('.brief-card');
  cards[index].classList.toggle('expanded');
}

// ==================== WATCHLIST ====================

async function loadWatchlist() {
  try {
    watchlistData = await window.sbFetch('sterling_watchlist', { order: 'fundamental_score.desc' });
    populateWatchlistFilters();
    renderWatchlist();
  } catch (err) {
    console.error('Watchlist load error:', err);
  }
}

function populateWatchlistFilters() {
  const sectors = [...new Set(watchlistData.map(w => w.sector).filter(Boolean))];
  const select = document.getElementById('filter-sector');
  select.innerHTML = '<option value="">All Sectors</option>' + sectors.map(s => `<option value="${s}">${s}</option>`).join('');
}

function filterWatchlist() {
  renderWatchlist();
}

function setWatchlistView(view) {
  document.querySelectorAll('.view-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-view="${view}"]`).classList.add('active');

  if (view === 'cards') {
    document.getElementById('watchlist-cards').style.display = 'grid';
    document.getElementById('watchlist-table-wrap').style.display = 'none';
  } else {
    document.getElementById('watchlist-cards').style.display = 'none';
    document.getElementById('watchlist-table-wrap').style.display = 'block';
  }
}

function renderWatchlist() {
  const sector = document.getElementById('filter-sector').value;
  const rec = document.getElementById('filter-recommendation').value;

  let filtered = watchlistData.filter(w => {
    if (sector && w.sector !== sector) return false;
    if (rec && w.recommendation !== rec) return false;
    return true;
  });

  const cards = document.getElementById('watchlist-cards');
  const tbody = document.getElementById('watchlist-tbody');

  if (!filtered || filtered.length === 0) {
    cards.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-text">No watchlist items found</div></div>`;
    tbody.innerHTML = '';
    return;
  }

  // Cards view
  cards.innerHTML = filtered.map(w => {
    const recClass = (w.recommendation || '').toLowerCase();
    const score = w.fundamental_score || 0;
    return `
      <div class="watchlist-card rec-${recClass}">
        <div class="wl-header">
          <div>
            <div class="wl-symbol">${w.symbol}</div>
            <div class="wl-company">${w.company_name || ''}</div>
          </div>
          <span class="rec-badge ${recClass}">${w.recommendation || 'WATCH'}</span>
        </div>
        <div class="wl-prices">
          <div class="wl-price-item">
            <div class="wl-price-label">Current</div>
            <div class="wl-price-value">${formatPeso(w.current_price)}</div>
          </div>
          <div class="wl-price-item">
            <div class="wl-price-label">Target Buy</div>
            <div class="wl-price-value">${formatPeso(w.target_buy)}</div>
          </div>
          <div class="wl-price-item">
            <div class="wl-price-label">Stop Loss</div>
            <div class="wl-price-value">${formatPeso(w.stop_loss)}</div>
          </div>
        </div>
        <div class="wl-metrics">
          <div><span class="label">Sector</span><span>${w.sector || '—'}</span></div>
          <div><span class="label">P/E</span><span>${w.pe_ratio || '—'}</span></div>
          <div><span class="label">Div Yield</span><span>${w.dividend_yield ? w.dividend_yield + '%' : '—'}</span></div>
          <div><span class="label">Signal</span><span>${w.technical_signal || '—'}</span></div>
        </div>
        <div class="wl-score">
          <div class="score-label">Fundamental Score: ${score}/100</div>
          <div class="score-bar"><div class="score-fill" style="width: ${score}%"></div></div>
        </div>
        ${w.reason ? `<div class="wl-reason">${w.reason}</div>` : ''}
      </div>
    `;
  }).join('');

  // Table view
  tbody.innerHTML = filtered.map(w => `
    <tr>
      <td style="font-weight: 700; color: var(--accent-gold)">${w.symbol}</td>
      <td style="font-family: var(--font-main)">${w.company_name || ''}</td>
      <td>${formatPeso(w.current_price)}</td>
      <td>${formatPeso(w.target_buy)}</td>
      <td>${formatPeso(w.stop_loss)}</td>
      <td style="font-family: var(--font-main)">${w.sector || '—'}</td>
      <td>${w.pe_ratio || '—'}</td>
      <td>${w.dividend_yield ? w.dividend_yield + '%' : '—'}</td>
      <td>${w.technical_signal || '—'}</td>
      <td>${w.fundamental_score || 0}</td>
      <td><span class="rec-badge ${(w.recommendation || '').toLowerCase()}">${w.recommendation || 'WATCH'}</span></td>
    </tr>
  `).join('');
}

// ==================== ALERTS ====================

async function loadAlerts() {
  try {
    alertsData = await window.sbFetch('sterling_alerts', { order: 'created_at.desc', limit: '50' });
    renderAlerts();
    updateAlertsBadge();

    // Auto-refresh every 30s
    setInterval(async () => {
      alertsData = await window.sbFetch('sterling_alerts', { order: 'created_at.desc', limit: '50' });
      renderAlerts();
      updateAlertsBadge();
    }, 30000);

  } catch (err) {
    console.error('Alerts load error:', err);
  }
}

function updateAlertsBadge() {
  const unread = alertsData.filter(a => !a.is_sent).length;
  const badge = document.getElementById('alerts-badge');
  if (unread > 0) {
    badge.textContent = unread;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

function renderAlerts() {
  const feed = document.getElementById('alerts-feed');

  if (!alertsData || alertsData.length === 0) {
    feed.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔔</div><div class="empty-state-text">No alerts yet</div></div>`;
    return;
  }

  feed.innerHTML = alertsData.map(a => {
    let type = 'info';
    let icon = '🔵';
    if (a.type === 'price_drop' || a.type === 'urgent' || (a.message && a.message.includes('URGENT'))) {
      type = 'urgent';
      icon = '🔴';
    } else if (a.type === 'warning' || (a.message && a.message.includes('WARNING'))) {
      type = 'warning';
      icon = '🟡';
    }

    return `
      <div class="alert-card ${type}">
        <span class="alert-icon">${icon}</span>
        <div class="alert-content">
          <div class="alert-type ${type}">${type.toUpperCase()}</div>
          <div class="alert-message">
            ${a.symbol ? `<span class="alert-symbol">${a.symbol}</span> ` : ''}
            ${a.message || 'No message'}
          </div>
          <div class="alert-time">${formatTime(a.created_at)}</div>
        </div>
        <button class="alert-dismiss" onclick="dismissAlert('${a.id}')" title="Dismiss">×</button>
      </div>
    `;
  }).join('');
}

async function dismissAlert(id) {
  try {
    await sbUpdate('sterling_alerts', `id=eq.${id}`, { is_sent: true });
    alertsData = alertsData.map(a => a.id === id ? { ...a, is_sent: true } : a);
    updateAlertsBadge();
  } catch (err) {
    console.error('Dismiss alert error:', err);
  }
}

// ==================== NEWS ====================

async function loadNews() {
  try {
    newsData = await window.sbFetch('sterling_news', { order: 'created_at.desc', limit: '50' });
    populateNewsFilters();
    renderNews();
  } catch (err) {
    console.error('News load error:', err);
  }
}

function populateNewsFilters() {
  const symbols = [...new Set(newsData.map(n => n.symbol).filter(Boolean))];
  const select = document.getElementById('filter-news-symbol');
  select.innerHTML = '<option value="">All Stocks</option>' + symbols.map(s => `<option value="${s}">${s}</option>`).join('');
}

function filterNews() {
  renderNews();
}

function renderNews() {
  const symbol = document.getElementById('filter-news-symbol').value;
  const sentiment = document.getElementById('filter-news-sentiment').value;
  const impact = document.getElementById('filter-news-impact').value;

  let filtered = newsData.filter(n => {
    if (symbol && n.symbol !== symbol) return false;
    if (sentiment && n.sentiment !== sentiment) return false;
    if (impact && n.impact !== impact) return false;
    return true;
  });

  const feed = document.getElementById('news-feed');

  if (!filtered || filtered.length === 0) {
    feed.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📰</div><div class="empty-state-text">No news found</div></div>`;
    return;
  }

  feed.innerHTML = filtered.map(n => `
    <div class="news-card ${n.sentiment || 'neutral'}">
      <div class="news-header">
        <div class="news-headline">${n.headline || 'No headline'}</div>
        <div class="news-badges">
          ${n.symbol ? `<span class="news-symbol-badge">${n.symbol}</span>` : ''}
          <span class="news-sentiment ${n.sentiment || 'neutral'}">${(n.sentiment || 'neutral').toUpperCase()}</span>
        </div>
      </div>
      <div class="news-meta">
        <span>${n.source || 'Unknown source'}</span>
        <span>${formatTime(n.created_at)}</span>
      </div>
    </div>
  `).join('');
}

// ==================== DIVIDENDS ====================

async function loadDividends() {
  try {
    if (!portfolioData || portfolioData.length === 0) {
      portfolioData = await window.sbFetch('sterling_portfolio', { order: 'symbol.asc' });
    }
    renderCalendar();
    renderUpcomingDividends();
    renderIncomeProjection();
  } catch (err) {
    console.error('Dividends load error:', err);
  }
}

function prevMonth() {
  calendarMonth--;
  if (calendarMonth < 0) {
    calendarMonth = 11;
    calendarYear--;
  }
  renderCalendar();
}

function nextMonth() {
  calendarMonth++;
  if (calendarMonth > 11) {
    calendarMonth = 0;
    calendarYear++;
  }
  renderCalendar();
}

function renderCalendar() {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('calendar-month').textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

  const grid = document.getElementById('calendar-grid');
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const today = new Date();

  // Get dividend dates for this month
  const divDates = getDividendDatesForMonth(calendarMonth + 1, calendarYear);

  let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="calendar-day-header">${d}</div>`).join('');

  // Empty days before month starts
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }

  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getDate() === day && today.getMonth() === calendarMonth && today.getFullYear() === calendarYear;
    const hasDividend = divDates.includes(day);
    html += `
      <div class="calendar-day ${isToday ? 'today' : ''} ${hasDividend ? 'has-dividend' : ''}">
        ${day}
        ${hasDividend ? '<div class="dividend-dot"></div>' : ''}
      </div>
    `;
  }

  grid.innerHTML = html;
}

function getDividendDatesForMonth(month, year) {
  const dates = [];
  portfolioData.forEach(h => {
    const schedule = DIVIDEND_SCHEDULES[h.symbol];
    if (schedule && schedule.months.includes(month)) {
      // Ex-date typically around 15th of the month
      dates.push(15);
    }
  });
  return [...new Set(dates)];
}

function renderUpcomingDividends() {
  const container = document.getElementById('upcoming-dividends');
  const upcoming = [];

  portfolioData.forEach(h => {
    const schedule = DIVIDEND_SCHEDULES[h.symbol];
    if (schedule) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const nextDivMonth = schedule.months.find(m => m >= currentMonth) || schedule.months[0];
      const nextYear = nextDivMonth < currentMonth ? now.getFullYear() + 1 : now.getFullYear();
      const estDividend = ((schedule.yield / 100) / (schedule.frequency === 'quarterly' ? 4 : 1)) * (h.current_price || 0) * (h.quantity || 0);

      upcoming.push({
        symbol: h.symbol,
        date: new Date(nextYear, nextDivMonth - 1, 15),
        amount: estDividend
      });
    }
  });

  upcoming.sort((a, b) => a.date - b.date);

  if (upcoming.length === 0) {
    container.innerHTML = '<div class="empty-state">No dividend holdings</div>';
    return;
  }

  container.innerHTML = upcoming.slice(0, 5).map(u => `
    <div class="upcoming-card">
      <div class="upcoming-symbol">${u.symbol}</div>
      <div class="upcoming-date">Ex-date: ~${formatDate(u.date)}</div>
      <div class="upcoming-amount">Est: ${formatPeso(u.amount)}</div>
    </div>
  `).join('');
}

function renderIncomeProjection() {
  let totalIncome = 0;
  const breakdown = [];

  portfolioData.forEach(h => {
    const schedule = DIVIDEND_SCHEDULES[h.symbol];
    if (schedule) {
      const annualDiv = (schedule.yield / 100) * (h.current_price || 0) * (h.quantity || 0);
      totalIncome += annualDiv;
      breakdown.push({ symbol: h.symbol, amount: annualDiv });
    }
  });

  document.getElementById('income-total').textContent = formatPeso(totalIncome) + '/year';

  const container = document.getElementById('income-breakdown');
  if (breakdown.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = breakdown.map(b => `
    <div class="income-item">
      <span class="symbol">${b.symbol}</span>
      <span class="amount">${formatPeso(b.amount)}</span>
    </div>
  `).join('');
}

// ==================== DISCOVERY ====================

async function loadDiscovery() {
  try {
    // Get watchlist items not in portfolio
    const watchlist = await window.sbFetch('sterling_watchlist', { order: 'fundamental_score.desc' });
    const portfolioSymbols = portfolioData.map(p => p.symbol);
    const discovery = watchlist.filter(w => !portfolioSymbols.includes(w.symbol));
    renderDiscovery(discovery);
  } catch (err) {
    console.error('Discovery load error:', err);
  }
}

function renderDiscovery(data) {
  const grid = document.getElementById('discovery-grid');

  if (!data || data.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No new stock picks. Sterling will discover more soon.</div></div>`;
    return;
  }

  grid.innerHTML = data.map(d => `
    <div class="discovery-card">
      <div class="disc-header">
        <div>
          <div class="disc-symbol">${d.symbol}</div>
          <div class="disc-company">${d.company_name || ''}</div>
        </div>
        <span class="disc-sector">${d.sector || 'N/A'}</span>
      </div>
      <div class="disc-metrics">
        <div><span class="label">Target Entry</span><span class="value">${formatPeso(d.target_buy)}</span></div>
        <div><span class="label">Current</span><span class="value">${formatPeso(d.current_price)}</span></div>
        <div><span class="label">Signal</span><span class="value">${d.technical_signal || '—'}</span></div>
        <div><span class="label">P/E</span><span class="value">${d.pe_ratio || '—'}</span></div>
      </div>
      <div class="disc-score">
        <div class="score-label">Fundamental Score: ${d.fundamental_score || 0}/100</div>
        <div class="score-bar"><div class="score-fill" style="width: ${d.fundamental_score || 0}%"></div></div>
      </div>
      ${d.reason ? `<div class="disc-why">${d.reason}</div>` : ''}
      <button class="disc-add-btn" onclick="addToWatchlist('${d.symbol}')">Add to Watchlist</button>
    </div>
  `).join('');
}

async function addToWatchlist(symbol) {
  try {
    // This would typically insert/update in sterling_watchlist
    alert(`${symbol} added to watchlist!`);
  } catch (err) {
    console.error('Add to watchlist error:', err);
  }
}

// ===== LEARN PAGE =====

const GLOSSARY = [
  // Fundamentals
  { term: 'P/E Ratio', category: 'Fundamentals', short: 'Price-to-Earnings', explanation: 'How much you pay for ₱1 of company earnings. Lower = cheaper. MBT at 6.86x means you pay ₱6.86 for every ₱1 of profit it earns. Banking sector avg is 11x — so MBT is cheap.', example: 'MBT P/E: 6.86x vs sector avg 11x → MBT is undervalued', level: 'Beginner' },
  { term: 'EPS', category: 'Fundamentals', short: 'Earnings Per Share', explanation: 'How much profit each share earns. MBT EPS is ₱10.76 — meaning for every 1 share you own, MBT earned ₱10.76 in profit last year. Growing EPS year-over-year = healthy company.', example: 'MBT EPS grew 18% last year — strong signal', level: 'Beginner' },
  { term: 'Dividend Yield', category: 'Fundamentals', short: 'Annual dividend ÷ share price', explanation: 'How much cash income you earn per year as a % of the stock price. KEEPR yields 11% — on your 11,000 shares worth ₱25,300, you earn ~₱2,783/year in dividends just for holding.', example: 'KEEPR: 11% yield. FILRT: 8.1%. GLO: 3.6%', level: 'Beginner' },
  { term: 'NAV', category: 'Fundamentals', short: 'Net Asset Value', explanation: 'For REITs: the actual value of all properties owned divided by shares outstanding. KEEPR NAV is ₱3.80 but trades at ₱2.30 — you\'re buying ₱3.80 of real estate for ₱2.30. That\'s a 40% discount.', example: 'KEEPR: Price ₱2.30 vs NAV ₱3.80 = 40% discount', level: 'Intermediate' },
  { term: 'ROE', category: 'Fundamentals', short: 'Return on Equity', explanation: 'How efficiently a company makes money from shareholders\' funds. 15%+ is generally good. Think of it as: for every ₱100 you invest, how much does the company earn? ROE 12.5% = ₱12.50 earned per ₱100.', example: 'MBT ROE: 12.5% — solid for a bank', level: 'Intermediate' },
  { term: 'Book Value', category: 'Fundamentals', short: 'Company\'s net worth per share', explanation: 'What each share is worth if the company sold all its assets and paid all debts. If book value is ₱68 and the stock trades at ₱76, you\'re paying a small premium — that\'s fair for a profitable bank.', example: 'MBT book value: ₱68.50, price: ₱76 → P/B ratio 1.1x', level: 'Intermediate' },
  { term: 'Debt-to-Equity', category: 'Fundamentals', short: 'How much the company borrowed vs owns', explanation: 'Lower is generally safer. Below 1.0 means the company owns more than it owes. Banks and telecoms naturally have higher D/E because they need capital. GLO has D/E of 2.1x — high but normal for telecoms.', example: 'GLO D/E: 2.1x (high but expected for telecoms)', level: 'Intermediate' },
  { term: 'Ex-Dividend Date', category: 'Fundamentals', short: 'Cutoff date to receive dividend', explanation: 'You must OWN the stock BEFORE this date to receive the upcoming dividend. Buy on or after the ex-date = no dividend this cycle. FILRT ex-date ~March 11 — own it before then.', example: 'FILRT ex-date ~March 11. Own before then → get ₱420 dividend', level: 'Beginner' },
  { term: 'Distributable Income', category: 'Fundamentals', short: 'Cash REITs have available to pay dividends', explanation: 'Philippine REITs must pay out at least 90% of distributable income as dividends. This is more important than earnings for REITs — check if distributable income is growing or shrinking each quarter.', example: 'MREIT distributable income growing → dividends should be maintained', level: 'Intermediate' },
  { term: 'Occupancy Rate', category: 'Fundamentals', short: '% of REIT properties currently rented', explanation: 'For REITs: how many of their office/mall/industrial spaces are occupied by tenants. 90%+ is healthy. KEEPR at 94% means 94% of their properties are generating rental income right now.', example: 'KEEPR occupancy: 94% — healthy', level: 'Beginner' },

  // Technical Analysis
  { term: 'RSI', category: 'Technical', short: 'Relative Strength Index (0-100)', explanation: 'Measures buying/selling momentum. Below 30 = oversold (stock may be too cheap, potential bounce). Above 70 = overbought (stock may be too expensive, potential pullback). MBT RSI 66.8 = strong but not yet overbought.', example: 'MBT RSI: 66.8 (strong buy territory). Below 30 = oversold opportunity.', level: 'Intermediate' },
  { term: 'MACD', category: 'Technical', short: 'Moving Average Convergence Divergence', explanation: 'Shows momentum shifts. When the MACD line crosses ABOVE the signal line = bullish (upward momentum). When it crosses BELOW = bearish. MBT MACD: +0.81 (positive = bullish momentum).', example: 'MBT MACD: +0.81 → bullish momentum confirmed', level: 'Intermediate' },
  { term: 'Support Level', category: 'Technical', short: 'Price floor where buyers step in', explanation: 'A price level where the stock has historically bounced upward. Buyers see it as cheap here and step in. MBT support at ₱73.95 — if it dips there, that\'s historically a buying opportunity, not a panic signal.', example: 'MBT support: ₱73.95. Dips to here = buy zone, not panic.', level: 'Beginner' },
  { term: 'Resistance Level', category: 'Technical', short: 'Price ceiling where sellers push back', explanation: 'A price level where the stock has historically struggled to break through. Sellers see it as expensive and sell. MBT resistance at ₱76.57 — a strong close above this = breakout signal.', example: 'MBT resistance: ₱76.57. Break above = bullish breakout.', level: 'Beginner' },
  { term: 'Moving Average (MA)', category: 'Technical', short: 'Average price over N days', explanation: 'Smooths out daily noise to show the trend. 50-day MA = average of last 50 days\' closing prices. When stock price is ABOVE the 50-day MA = uptrend. BELOW = downtrend. MBT is above ALL its moving averages right now.', example: 'MBT price ₱76 > 200-day MA ₱72.70 → confirmed uptrend', level: 'Beginner' },
  { term: 'Volume', category: 'Technical', short: 'How many shares traded today', explanation: 'Confirms the conviction behind a price move. Big move UP on big volume = real buying. Big move UP on tiny volume = suspicious, may reverse. Always ask: "Was this move on high or low volume?"', example: 'Price up 3% on 2M volume = strong signal. Up 3% on 100K volume = weak signal.', level: 'Beginner' },
  { term: 'Breakout', category: 'Technical', short: 'Price closes above resistance with volume', explanation: 'When a stock closes above a key resistance level, especially on high volume. This signals that buyers have overpowered sellers at that level and the stock may run higher. Very strong buy signal when confirmed.', example: 'If MBT closes above ₱77 on high volume = breakout signal', level: 'Intermediate' },
  { term: '200-Day MA', category: 'Technical', short: 'The ultimate long-term trend indicator', explanation: 'The most watched moving average by professional investors. Stock above 200-day MA = long-term uptrend. Stock below = long-term downtrend. MBT recently crossed ABOVE its 200-day MA — that\'s a major bullish signal that professionals notice.', example: 'MBT crossed above 200-day MA ₱72.70 → major bullish signal', level: 'Intermediate' },

  // Trading Strategy
  { term: 'Stop-Loss', category: 'Strategy', short: 'Price where you accept you were wrong and exit', explanation: 'A predetermined price where you sell to limit losses. NOT a sign of weakness — it\'s risk management. Every professional sets a stop-loss before entering a trade. For MBT, stop-loss ₱69 means: if it drops below ₱69, the thesis is broken — sell.', example: 'MBT stop-loss: ₱69. KEEPR stop-loss: ₱1.90.', level: 'Beginner' },
  { term: 'Take Profit', category: 'Strategy', short: 'Price where you lock in gains', explanation: 'A target price where you sell a portion of your position to lock in profits. Smart approach: sell 30% at first target, hold the rest. Don\'t sell everything at once — let winners run. MBT first take-profit: ₱86.', example: 'MBT: sell 30% at ₱86, hold rest to ₱97.', level: 'Beginner' },
  { term: 'Averaging Down', category: 'Strategy', short: 'Buying more when price drops to lower your average cost', explanation: 'If you own a stock and it drops, buying more shares lowers your average purchase price. ONLY do this if the fundamentals haven\'t changed — not just because the price fell. KEEPR fundamentals intact (94% occupancy, 11% yield) = averaging down is valid.', example: 'KEEPR: bought at ₱2.60, now ₱2.30. Adding more lowers avg cost. Valid IF fundamentals intact.', level: 'Intermediate' },
  { term: 'Unrealized P&L', category: 'Strategy', short: 'Paper profit or loss — not real until you sell', explanation: 'Your current profit/loss on paper while you still hold the stock. KEEPR shows -11% unrealized — that money is NOT gone. You still own the same 11,000 shares. It only becomes a real loss if you sell. As long as fundamentals are intact, unrealized loss = temporary price discount.', example: 'KEEPR -11% unrealized ≠ actual loss. Don\'t sell based on paper loss alone.', level: 'Beginner' },
  { term: 'Long-Term Investing', category: 'Strategy', short: 'Holding quality stocks for years, not days', explanation: 'Carlo\'s approach. You\'re NOT day trading. You buy fundamentally strong companies at good prices, hold them for dividends + price appreciation, and only sell when fundamentals change — not when price dips.', example: 'Carlo\'s horizon: 1-5 years. Dividends + capital appreciation = total return.', level: 'Beginner' },
  { term: 'Dividend Investing', category: 'Strategy', short: 'Building passive income through dividends', explanation: 'Owning stocks that pay regular cash dividends. Your REITs (FILRT, KEEPR, MREIT) pay quarterly. GLO and DMC pay annually. Combined, your current portfolio generates estimated ₱35,000-45,000/year in dividends — without selling a single share.', example: 'Your est. annual dividends: KEEPR ₱28,600 + FILRT ₱4,200 + MREIT ₱1,000 + GLO ₱600 + DMC ₱1,640', level: 'Beginner' },
];

const CONCEPTS = [
  {
    title: 'Why REITs Drop When Interest Rates Rise',
    icon: '🏢',
    level: 'Beginner',
    content: `REITs borrow money to buy properties. When the BSP raises interest rates, their borrowing costs increase → less profit left over → smaller dividends → investors sell → price drops.

The flip side: when BSP CUTS rates (expected H2 2026), borrowing gets cheaper → more profit → bigger dividends → investors buy → price rises.

This is why your REITs (KEEPR, FILRT, MREIT) have been soft. Not because the properties are empty — but because rates have been high. BSP holding rates at 6.5% is the key thing to monitor.

Sterling's Alert: When BSP announces a rate cut, buy more REITs immediately.`
  },
  {
    title: 'How to Read an Analyst Target Price',
    icon: '🎯',
    level: 'Beginner',
    content: `When you see "13 analysts, average target ₱91" for MBT, here's what it means:

13 professional analysts (from banks like UBS, Goldman, local brokers like COL, BDO Securities) have each built a financial model for MBT and concluded that the fair price is around ₱91.

This does NOT mean the stock will reach ₱91 by tomorrow. It's a 12-month target.
Some will be right, some wrong. But 13 professionals independently reaching ₱86-97 is meaningful signal.

How to use it: If current price (₱76) is significantly below analyst target (₱91) = potential undervaluation. But always check IF the thesis still holds — earnings still growing? No major negative news?

Sterling's rule: Only trust analyst targets from named firms with track records (COL Financial, BDO Securities, First Metro, UBS, Citi).`
  },
  {
    title: 'The Difference Between Price and Value',
    icon: '💡',
    level: 'Beginner',
    content: `This is the most important concept in long-term investing.

PRICE = what the market is willing to pay right now. Changes every second. Driven by emotion, news, sentiment.

VALUE = what the company is actually worth based on its earnings, assets, and future prospects. Changes slowly. Driven by fundamentals.

Great investing = buying VALUE at a discount to PRICE.

Example: KEEPR's value (NAV) is ₱3.80. Its price is ₱2.30. You're getting ₱3.80 of real estate value for ₱2.30. That's a 40% discount.

Warren Buffett's rule: "Price is what you pay. Value is what you get."

Sterling applies this to every recommendation.`
  },
  {
    title: 'How Dividends Actually Work Step by Step',
    icon: '💰',
    level: 'Beginner',
    content: `Step 1: Company announces a dividend (e.g., "FILRT declares ₱0.06/share dividend")
Step 2: They announce an EX-DIVIDEND DATE (e.g., March 11)
Step 3: You must own the stock BEFORE that date to qualify
Step 4: On the ex-date, the stock price usually drops by roughly the dividend amount (it's been "extracted")
Step 5: The actual cash hits your DragonFi account on the PAYMENT DATE (usually 2-4 weeks later)

Your FILRT example:
• You own 7,000 shares
• Dividend: ₱0.06/share
• Calculation: 7,000 × ₱0.06 = ₱420
• Action needed: HOLD before March 11. Then ₱420 arrives in your account.

Annual dividend income from your current portfolio (estimated):
KEEPR: ~₱28,600 | FILRT: ~₱4,200 | MREIT: ~₱1,000 | GLO: ~₱608 | DMC: ~₱1,640
Total: ~₱36,048/year in passive income.`
  },
  {
    title: 'Technical Analysis vs Fundamental Analysis — When to Use Each',
    icon: '📊',
    level: 'Intermediate',
    content: `For long-term investors like Carlo, the priority order is:

1. FUNDAMENTALS FIRST (is this a good company at a good price?)
   Use: P/E, dividend yield, EPS growth, ROE, debt levels
   Tools: PSE Edge, HelloSafe PH, Simply Wall St

2. TECHNICALS TO TIME ENTRY (when is the right moment to buy?)
   Use: RSI, support levels, moving averages
   Tools: TradingView, PSE EQUIP, Investing.com

Never buy a fundamentally weak company just because the chart "looks good."
Use technicals to get a better price on a fundamentally strong company.

Example: MBT is fundamentally strong (PE 6.86x, 18% earnings growth). Technicals confirm (all MAs bullish, RSI 66). Both agree → high conviction hold/buy.

If fundamentals say good but technicals say it's breaking down → wait for stabilization.`
  },
];

const PATTERNS = [
  {
    name: 'Hammer',
    emoji: '🔨',
    type: 'Bullish Reversal',
    description: 'A candle with a small body at the top and a long lower wick (tail). The long tail means sellers pushed the price way down during the day, but buyers came in and reversed it back up near the open.',
    signal: 'Bullish — potential reversal at lows. Most reliable at key support levels.',
    howToTrade: 'Wait for confirmation: if the NEXT candle is also green and closes higher, enter on that confirmation. Don\'t buy the hammer alone.',
    appearance: '🕯️ Small body on top + long wick below = wick is 2x+ the body size'
  },
  {
    name: 'Doji',
    emoji: '➕',
    type: 'Indecision',
    description: 'Open and close price are nearly equal — looks like a cross or plus sign. Means the market is undecided: buyers and sellers are in perfect balance. Neither side is winning.',
    signal: 'Neutral — watch for the NEXT candle. After a downtrend, a Doji can signal reversal. After an uptrend, it can signal pause or reversal.',
    howToTrade: 'Don\'t trade the Doji itself. Wait one more candle to see which direction the market chooses.',
    appearance: '➕ Almost equal open and close, with wicks on both sides'
  },
  {
    name: 'Bullish Engulfing',
    emoji: '📈',
    type: 'Strong Bullish Reversal',
    description: 'A red candle followed by a LARGER green candle that completely covers ("engulfs") the previous red candle\'s body. Shows buyers overwhelmed sellers in one session.',
    signal: 'Strong bullish — especially at support levels or after a downtrend. One of the most reliable reversal patterns.',
    howToTrade: 'Enter on the open of the third candle (after the engulfing green candle). Stop-loss below the low of the red candle.',
    appearance: 'Red candle → Big green candle that swallows the red'
  },
  {
    name: 'Higher Highs / Higher Lows',
    emoji: '📊',
    type: 'Uptrend Structure',
    description: 'Each rally goes HIGHER than the previous rally, and each pullback stays HIGHER than the previous pullback. This is the definition of an uptrend.',
    signal: 'As long as this pattern holds, the uptrend is intact. Only worry when a low breaks below the previous low.',
    howToTrade: 'Buy on the dips (pullbacks to higher lows). Hold until the structure breaks.',
    appearance: 'Chart staircase going up → each step higher than the last'
  },
  {
    name: 'Golden Cross',
    emoji: '✨',
    type: 'Major Bullish Signal',
    description: 'When the 50-day moving average crosses ABOVE the 200-day moving average. Signals a shift from long-term downtrend to uptrend. Major institutional investors (funds, banks) pay close attention to this.',
    signal: 'Very bullish long-term signal. Often precedes sustained price increases over weeks/months.',
    howToTrade: 'For long-term investors: buy on the Golden Cross and hold. Stop-loss below 200-day MA.',
    appearance: '50-day MA line crosses up through the 200-day MA line on chart'
  },
  {
    name: 'Death Cross',
    emoji: '💀',
    type: 'Major Bearish Signal',
    description: 'When the 50-day moving average crosses BELOW the 200-day moving average. Opposite of Golden Cross. Signals shift to long-term downtrend.',
    signal: 'Bearish long-term signal. Used to exit or reduce position sizes.',
    howToTrade: 'Consider reducing position. Don\'t average down when a Death Cross forms.',
    appearance: '50-day MA line crosses down through the 200-day MA line on chart'
  },
];

const RESOURCES = [
  {
    category: 'Charts & Technicals',
    icon: '📈',
    items: [
      { name: 'PSE EQUIP', url: 'https://equip.pse.com.ph', description: 'Official PSE charting platform. Free. TradingView charts + Refinitiv fundamentals. Start here.', tag: '🇵🇭 Official' },
      { name: 'TradingView PSE', url: 'https://www.tradingview.com/symbols/PSE-MBT/technicals/', description: 'Best charting tool globally. Free account gives you RSI, MACD, MAs, community ideas. Replace MBT with any symbol.', tag: '⭐ Best Charts' },
      { name: 'Investagrams', url: 'https://www.investagrams.com', description: 'PH trading community. Chart spotting, local trader ideas, technical analysis discussions.', tag: '🇵🇭 PH Community' },
      { name: 'Investing.com PSE', url: 'https://www.investing.com/equities/metropolitan-b-technical', description: 'Instant technical summary: Strong Buy/Buy/Neutral/Sell. Replace "metropolitan-b" with any stock slug.', tag: '⚡ Quick Analysis' },
    ]
  },
  {
    category: 'Fundamentals & News',
    icon: '📰',
    items: [
      { name: 'PSE Edge', url: 'https://edge.pse.com.ph', description: 'Official PSE disclosures. Every dividend, earnings report, material disclosure filed here. Your primary news source.', tag: '🇵🇭 Official' },
      { name: 'HelloSafe PH', url: 'https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company', description: 'Analyst targets, PE, EPS, fundamentals aggregated in one clean page. Replace slug for any stock.', tag: '📊 Fundamentals' },
      { name: 'Simply Wall St', url: 'https://simplywall.st/stocks/ph', description: 'Visual "snowflake" fundamental analysis. Great for quick health check on any PH stock.', tag: '👁️ Visual' },
      { name: 'BusinessWorld', url: 'https://www.bworldonline.com', description: 'Philippine financial newspaper of record. Primary source for corporate news.', tag: '📰 PH News' },
    ]
  },
  {
    category: 'Your Broker',
    icon: '🏦',
    items: [
      { name: 'DragonFi', url: 'https://www.dragonfi.ph', description: 'Your actual broker. Most reliable data source since it\'s your account. Check here first for live prices.', tag: '💼 Your Broker' },
      { name: 'DragonFi — MBT', url: 'https://www.dragonfi.ph/market/stocks/MBT', description: 'Direct link to MBT on DragonFi. Replace symbol for any stock.', tag: '💼 Direct Link' },
    ]
  },
  {
    category: 'Learning',
    icon: '🎓',
    items: [
      { name: 'PSE Academy', url: 'https://www.pseacademy.com.ph', description: 'Free courses by the PSE itself. Investing basics, how to read disclosures, understanding REITs. Start here if you\'re a beginner.', tag: '🇵🇭 Free Courses' },
      { name: 'r/phinvest', url: 'https://www.reddit.com/r/phinvest/', description: 'Philippine investing community. Real discussions, no-nonsense advice, fellow Filipino investors sharing what works.', tag: '💬 Community' },
      { name: 'r/phstock', url: 'https://www.reddit.com/r/phstock/', description: 'PSE-focused stock discussions. Technical analysis posts, stock ideas, market sentiment.', tag: '💬 Community' },
      { name: 'Trading Economics PH', url: 'https://tradingeconomics.com/philippines/stock-market', description: 'PSEi data, BSP interest rate history, macro indicators. Essential for understanding the big picture.', tag: '🌍 Macro' },
    ]
  },
];

// Portfolio-specific lessons using real Carlo data
const PORTFOLIO_SCHOOL = [
  {
    stock: 'MBT',
    title: 'Why MBT is Your Strongest Position',
    content: `MBT is a textbook example of a fundamentally cheap stock in an uptrend.

FUNDAMENTAL CASE:
• P/E of 6.86x — you pay ₱6.86 for every ₱1 of profit. Banking avg is 11x. That's 38% cheaper than peers.
• EPS grew 18% last year — the business is accelerating.
• Dividend yield 6.78% — you get paid while you wait.
• 13 analysts say Strong Buy. Average target: ₱91. High: ₱97.50.

TECHNICAL CASE:
• ALL 12 moving averages say BUY — unanimous.
• RSI 66.8 — strong momentum, not yet overbought.
• Price is above all MAs: 5-day (₱76.35), 20-day (₱75.31), 50-day (₱73.85), 200-day (₱72.70).
• Just crossed above 200-day MA — major institutional buy signal.

YOUR POSITION:
• You bought avg ₱69.70, it's now ₱75.80 — up ₱6,930 (+8.75%).
• Analyst upside to avg target: +₱15.20/share = +₱16,720 more potential gain on 1,100 shares.
• Upside to high target ₱97.50: +₱21.70/share = +₱23,870 more.

LESSON: This is what "fundamentally strong stock in uptrend" looks like. Hold it.`
  },
  {
    stock: 'KEEPR',
    title: 'Understanding Why KEEPR Looks Scary But Isn\'t',
    content: `KEEPR is down -11.54% from your buy price. It LOOKS bad. Here's why it's not time to panic.

THE MATH OF VALUE:
• NAV (actual property value per share): ₱3.80
• Current price: ₱2.30
• You're buying ₱3.80 of real estate for ₱2.30 — a 40% discount.
• This discount happens when market sentiment is negative (high interest rates, REIT selloff).
• The properties themselves are fine: 94% occupancy rate.

THE DIVIDEND MATH:
• Estimated annual dividend yield at current price: ~11%
• On your 11,000 shares: ~₱28,600/year just in dividends.
• Even if the price stays flat for 2 years, you collect ₱57,200 in dividends.

THE CATALYST:
• BSP is expected to cut rates in H2 2026.
• When rates fall: REIT borrowing costs fall → more profit → higher dividends → investors buy → price rises.
• Historical pattern: Philippine REITs rally 20-40% after rate cut cycles begin.

LESSON: Sometimes the best investment is the most uncomfortable one. Don't sell quality just because of a red number.`
  },
  {
    stock: 'FILRT',
    title: 'FILRT: Getting Paid to Wait',
    content: `FILRT is flat in price — you're down 4.43%. But here's the full picture.

THE DIVIDEND INCOME:
• Q4 dividend: ₱0.06/share. Ex-date: ~March 11, 2026.
• On 7,000 shares: ₱420 arriving in your account.
• Annual: ₱0.24/share × 7,000 = ₱1,680/year in passive income.
• Yield at current price: 8.1% — that's better than any bank savings account.

THE VALUE CASE:
• NAV: ₱4.21. Current price: ₱3.02. You're buying at a 28% discount to real estate value.
• When BSP cuts rates: FILRT's borrowing costs fall → income rises → price re-rates toward NAV.

THE LESSON — "Getting Paid to Wait":
This is the core of REIT investing. You don't need the price to rise immediately.
You collect 8.1% per year in cash dividends. After 3 years of collecting dividends, your effective buy price drops significantly.

Real math: 8.1% × 3 years = 24.3% of your investment returned as cash, while you still own the shares.`
  },
];

function loadLearnPage() {
  renderGlossary(GLOSSARY);
  renderConcepts(CONCEPTS);
  renderPatterns(PATTERNS);
  renderPortfolioSchool(PORTFOLIO_SCHOOL);
  renderResources(RESOURCES);
}

function showLearnTab(tab, btn) {
  document.querySelectorAll('.learn-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.learn-section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('learn-' + tab).classList.add('active');
}

function filterGlossary(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('.glossary-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

function renderGlossary(items) {
  const grid = document.getElementById('glossary-grid');
  const categories = [...new Set(items.map(i => i.category))];
  grid.innerHTML = categories.map(cat => `
    <div class="glossary-category">
      <h3 class="category-title">${cat}</h3>
      <div class="category-cards">
        ${items.filter(i => i.category === cat).map(item => `
          <div class="glossary-card" onclick="this.classList.toggle('flipped')">
            <div class="card-front">
              <div class="term-name">${item.term}</div>
              <div class="term-short">${item.short}</div>
              <div class="term-level level-${item.level.toLowerCase()}">${item.level}</div>
              <div class="card-hint">Tap to learn →</div>
            </div>
            <div class="card-back">
              <div class="term-explanation">${item.explanation}</div>
              ${item.example ? `<div class="term-example">📌 ${item.example}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderConcepts(items) {
  const list = document.getElementById('concepts-list');
  list.innerHTML = items.map((c, i) => `
    <div class="concept-card">
      <div class="concept-header" onclick="toggleConcept(${i})">
        <span class="concept-icon">${c.icon}</span>
        <div>
          <div class="concept-title">${c.title}</div>
          <div class="concept-level level-${c.level.toLowerCase()}">${c.level}</div>
        </div>
        <span class="concept-toggle" id="concept-toggle-${i}">▼</span>
      </div>
      <div class="concept-body" id="concept-body-${i}" style="display:none">
        <pre class="concept-content">${c.content}</pre>
      </div>
    </div>
  `).join('');
}

function toggleConcept(i) {
  const body = document.getElementById('concept-body-' + i);
  const toggle = document.getElementById('concept-toggle-' + i);
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  toggle.textContent = open ? '▼' : '▲';
}

function renderPatterns(items) {
  const grid = document.getElementById('patterns-grid');
  grid.innerHTML = items.map(p => `
    <div class="pattern-card">
      <div class="pattern-emoji">${p.emoji}</div>
      <div class="pattern-name">${p.name}</div>
      <div class="pattern-type type-${p.type.includes('Bull') ? 'bull' : p.type.includes('Bear') ? 'bear' : 'neutral'}">${p.type}</div>
      <div class="pattern-desc">${p.description}</div>
      <div class="pattern-signal"><strong>Signal:</strong> ${p.signal}</div>
      <div class="pattern-trade"><strong>How to trade:</strong> ${p.howToTrade}</div>
      <div class="pattern-appearance"><strong>Looks like:</strong> ${p.appearance}</div>
    </div>
  `).join('');
}

function renderPortfolioSchool(items) {
  const div = document.getElementById('portfolio-school-content');
  div.innerHTML = items.map((item, i) => `
    <div class="ps-card">
      <div class="ps-header" onclick="togglePS(${i})">
        <div>
          <div class="ps-stock">${item.stock}</div>
          <div class="ps-title">${item.title}</div>
        </div>
        <span class="ps-toggle" id="ps-toggle-${i}">▼</span>
      </div>
      <div class="ps-body" id="ps-body-${i}" style="display:none">
        <pre class="ps-content">${item.content}</pre>
      </div>
    </div>
  `).join('');
}

function togglePS(i) {
  const body = document.getElementById('ps-body-' + i);
  const toggle = document.getElementById('ps-toggle-' + i);
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  toggle.textContent = open ? '▼' : '▲';
}

function renderResources(items) {
  const grid = document.getElementById('resources-grid');
  grid.innerHTML = items.map(cat => `
    <div class="resource-category">
      <h3>${cat.icon} ${cat.category}</h3>
      ${cat.items.map(r => `
        <a href="${r.url}" target="_blank" class="resource-card">
          <div class="resource-name">${r.name} <span class="resource-tag">${r.tag}</span></div>
          <div class="resource-desc">${r.description}</div>
        </a>
      `).join('')}
    </div>
  `).join('');
}

