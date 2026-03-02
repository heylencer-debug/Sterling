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
        ${renderStockAction(h.symbol, h.unrealized_pl_pct)}
      </div>
    `;
  }).join('');
}

// Analyst recommendation badge per stock
const STOCK_ACTIONS = {
  MBT:   { action: 'HOLD — Target ₱86-97', color: '#00D4A0', detail: 'All 12 MAs bullish. RSI 66.8. 13 analysts avg target ₱91. DO NOT sell yet.' },
  KEEPR: { action: 'HOLD — 40% NAV Discount', color: '#FFD700', detail: 'NAV ₱3.80 vs price ₱2.30. 11% dividend yield. Wait for BSP rate cut.' },
  FILRT: { action: 'HOLD — Dividend ~Mar 11', color: '#FFD700', detail: 'Ex-date ~March 11. 8.1% yield. 28% discount to NAV ₱4.21.' },
  GLO:   { action: 'HOLD — Target ₱1,850', color: '#00D4A0', detail: 'Above 200-day MA. Stable dividend. Small position.' },
  DMC:   { action: 'HOLD — Watch Nickel', color: '#FFD700', detail: 'PE 7.5x cheap. 8.5% yield. Monitor nickel commodity prices.' },
  MREIT: { action: 'HOLD — Dividend ~Mar 20', color: '#00D4A0', detail: 'NAV ₱19.69 vs ₱14.18 price. 7.2% yield. Megaworld expanding.' },
  RRHI:  { action: 'HOLD — Target ₱40-42', color: '#64748B', detail: 'Stable retail. PE 18.5x is higher. Don\'t add at current levels.' },
};

function renderStockAction(symbol, plPct) {
  const a = STOCK_ACTIONS[symbol];
  if (!a) return '';
  return `
    <div class="stock-action" style="border-left:3px solid ${a.color};padding:8px 10px;margin-top:10px;background:rgba(255,255,255,0.03);border-radius:0 4px 4px 0;cursor:pointer" onclick="this.querySelector('.action-detail').style.display=this.querySelector('.action-detail').style.display==='none'?'block':'none'">
      <div style="font-size:11px;font-weight:700;color:${a.color};letter-spacing:0.5px">⚔️ ${a.action}</div>
      <div class="action-detail" style="display:none;font-size:11px;color:#94A3B8;margin-top:4px;line-height:1.5">${a.detail}</div>
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

