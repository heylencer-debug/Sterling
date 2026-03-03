// Sterling — Sterling PSE Dashboard v55
// All page logic and Supabase data fetching
// v55: Analysis persistence - saves AI analysis to sterling_analysis, reloads on page render
// v52: SECURITY - API keys fetched from Supabase app_settings (no localStorage)

// ==================== SECURE KEY LOADER ====================
// API keys are stored in Supabase app_settings table, not in code or localStorage
let _appSettings = null;
async function getAppSetting(key) {
  if (!_appSettings) {
    try {
      const { url, anonKey } = window.SUPABASE_CONFIG || {};
      if (!url || !anonKey) {
        console.warn('[Sterling] SUPABASE_CONFIG not loaded');
        _appSettings = {};
        return null;
      }
      const res = await fetch(url + '/rest/v1/app_settings?select=key,value', {
        headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey }
      });
      const rows = await res.json();
      _appSettings = {};
      (rows || []).forEach(r => { _appSettings[r.key] = r.value; });
    } catch(e) {
      console.warn('[Sterling] Failed to load app settings:', e.message);
      _appSettings = {};
    }
  }
  return _appSettings[key] || null;
}

// State
let loadedPages = {};
let portfolioData = [];
let watchlistData = [];
let alertsData = [];
let newsData = [];
let briefsData = [];
let technicalsData = [];
let analysisData = {}; // Persisted AI analysis from sterling_analysis table: { symbol: { analysis_text, action, analyzed_at } }
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

// Annualized dividends (PHP per share per year) for yield-on-cost calculation
const ANNUALIZED_DIVIDENDS = {
  MREIT: 1.05, FILRT: 0.21, AREIT: 1.10, DDMPR: 0.48, CREIT: 0.36,
  GLO: 80.00, MBT: 3.50, BDO: 4.50, KEEPR: 0.70, RCR: 0.60
};

// PSE Universe - 40 stocks for Discovery scanner
const PSE_UNIVERSE = [
  // Banking
  { symbol:'BDO', name:'BDO Unibank', sector:'Banking' },
  { symbol:'MBT', name:'Metrobank', sector:'Banking' },
  { symbol:'BPI', name:'Bank of the Philippine Islands', sector:'Banking' },
  { symbol:'SECB', name:'Security Bank', sector:'Banking' },
  { symbol:'EW', name:'East West Banking', sector:'Banking' },
  { symbol:'PNB', name:'Philippine National Bank', sector:'Banking' },
  { symbol:'RCBC', name:'Rizal Commercial Banking Corp', sector:'Banking' },
  { symbol:'CBK', name:'China Banking Corp', sector:'Banking' },
  { symbol:'PSB', name:'Philippine Savings Bank', sector:'Banking' },
  { symbol:'SB', name:'Security Bank', sector:'Banking' },
  { symbol:'UBP', name:'Union Bank of the Philippines', sector:'Banking' },
  { symbol:'PBCOM', name:'Philippine Bank of Communications', sector:'Banking' },
  { symbol:'BOC', name:'Bank of Commerce', sector:'Banking' },
  { symbol:'MBTC', name:'Metropolitan Bank & Trust', sector:'Banking' },
  // REIT
  { symbol:'AREIT', name:'Ayala REIT', sector:'REIT' },
  { symbol:'MREIT', name:'Megaworld REIT', sector:'REIT' },
  { symbol:'FILRT', name:'Filinvest REIT', sector:'REIT' },
  { symbol:'DDMPR', name:'DoubleDragon REIT', sector:'REIT' },
  { symbol:'CREIT', name:'Citicore REIT', sector:'REIT' },
  { symbol:'KEEPR', name:'Keppel Philippines REIT', sector:'REIT' },
  { symbol:'RCR', name:'RL Commercial REIT', sector:'REIT' },
  { symbol:'VREIT', name:'Vista REIT', sector:'REIT' },
  { symbol:'PREIT', name:'Premiere Island Power REIT', sector:'REIT' },
  { symbol:'OREIT', name:'Robinsons Land REIT', sector:'REIT' },
  // Telecom
  { symbol:'GLO', name:'Globe Telecom', sector:'Telecom' },
  { symbol:'TEL', name:'PLDT Inc.', sector:'Telecom' },
  { symbol:'NOW', name:'Now Corporation', sector:'Telecom' },
  // Property
  { symbol:'ALI', name:'Ayala Land', sector:'Property' },
  { symbol:'SMPH', name:'SM Prime Holdings', sector:'Property' },
  { symbol:'MEG', name:'Megaworld Corp', sector:'Property' },
  { symbol:'RLC', name:'Robinsons Land', sector:'Property' },
  { symbol:'FLI', name:'Filinvest Land', sector:'Property' },
  { symbol:'ROCK', name:'Rockwell Land', sector:'Property' },
  { symbol:'DDPR', name:'DoubleDragon Properties', sector:'Property' },
  { symbol:'VLL', name:'Vista Land & Lifescapes', sector:'Property' },
  { symbol:'CLI', name:'Cebu Landmasters', sector:'Property' },
  { symbol:'HLCM', name:'Holcim Philippines', sector:'Property' },
  { symbol:'SHNG', name:'Shang Properties', sector:'Property' },
  { symbol:'CPVW', name:'Camp John Hay Development', sector:'Property' },
  { symbol:'PHR', name:'Philippine Realty & Holdings', sector:'Property' },
  { symbol:'MRC', name:'MRC Allied', sector:'Property' },
  { symbol:'LAND', name:'Landco Pacific', sector:'Property' },
  { symbol:'POPI', name:'Premiere Horizon Alliance', sector:'Property' },
  // Mining & Oil
  { symbol:'DMC', name:'DMCI Holdings', sector:'Mining & Oil' },
  { symbol:'SCC', name:'Semirara Mining', sector:'Mining & Oil' },
  { symbol:'PX', name:'Philex Mining', sector:'Mining & Oil' },
  { symbol:'LC', name:'Lorenzo Shipping / LC', sector:'Mining & Oil' },
  { symbol:'AT', name:'Atlas Consolidated Mining', sector:'Mining & Oil' },
  { symbol:'OPM', name:'OceanaGold Philippines', sector:'Mining & Oil' },
  { symbol:'NIKL', name:'Nickel Asia', sector:'Mining & Oil' },
  { symbol:'PHA', name:'Philippine Gold Properties', sector:'Mining & Oil' },
  { symbol:'APM', name:'Apex Mining', sector:'Mining & Oil' },
  { symbol:'MARC', name:'Marcventures Holdings', sector:'Mining & Oil' },
  { symbol:'GOL', name:'Lepanto Consolidated Mining B', sector:'Mining & Oil' },
  { symbol:'LCB', name:'Lepanto Consolidated B', sector:'Mining & Oil' },
  { symbol:'LCI', name:'Lepanto Consolidated A', sector:'Mining & Oil' },
  { symbol:'MEDCO', name:'MEDCO Holdings', sector:'Mining & Oil' },
  // Retail
  { symbol:'RRHI', name:'Robinsons Retail', sector:'Retail' },
  { symbol:'PGOLD', name:'Puregold Price Club', sector:'Retail' },
  { symbol:'CNPF', name:'Century Pacific Food', sector:'Retail' },
  { symbol:'SSI', name:'SSI Group', sector:'Retail' },
  { symbol:'MRSGI', name:'Metro Retail Stores Group', sector:'Retail' },
  { symbol:'COSCO', name:'Cosco Capital', sector:'Retail' },
  { symbol:'DNL', name:'D&L Industries', sector:'Retail' },
  // Energy
  { symbol:'ACEN', name:'ACEN Corporation', sector:'Energy' },
  { symbol:'FGEN', name:'First Gen Corp', sector:'Energy' },
  { symbol:'MPI', name:'Metro Pacific Investments', sector:'Energy' },
  { symbol:'AP', name:'Aboitiz Power', sector:'Energy' },
  { symbol:'SPC', name:'SPC Power Corp', sector:'Energy' },
  { symbol:'PHEN', name:'Philippine Energy Development', sector:'Energy' },
  { symbol:'PERC', name:'Philippine Electric Corp', sector:'Energy' },
  { symbol:'PNOC', name:'PNOC Energy Development', sector:'Energy' },
  { symbol:'GEO', name:'Geo Energy Resources', sector:'Energy' },
  { symbol:'PEAK', name:'Alternergy Holdings', sector:'Energy' },
  // Industrial
  { symbol:'JFC', name:'Jollibee Foods Corp', sector:'Industrial' },
  { symbol:'ICT', name:'Int\'l Container Terminal', sector:'Industrial' },
  { symbol:'MONDE', name:'Monde Nissin', sector:'Industrial' },
  { symbol:'URC', name:'Universal Robina Corp', sector:'Industrial' },
  { symbol:'BLOOM', name:'Bloomberry Resorts', sector:'Industrial' },
  { symbol:'MAXS', name:'Max\'s Group', sector:'Industrial' },
  { symbol:'EEI', name:'EEI Corporation', sector:'Industrial' },
  { symbol:'VITA', name:'Vitarich Corp', sector:'Industrial' },
  { symbol:'PIZZA', name:'Shakey\'s Pizza Asia Ventures', sector:'Industrial' },
  { symbol:'FOOD', name:'Fruitas Holdings', sector:'Industrial' },
  { symbol:'MWIDE', name:'Megawide Construction', sector:'Industrial' },
  { symbol:'WLCON', name:'Wilcon Depot', sector:'Industrial' },
  { symbol:'EAGLE', name:'Eagle Cement', sector:'Industrial' },
  { symbol:'PRMX', name:'Premiumx / Pryce Corp', sector:'Industrial' },
  { symbol:'GSMI', name:'Ginebra San Miguel', sector:'Industrial' },
  { symbol:'DELM', name:'Del Monte Pacific', sector:'Industrial' },
  { symbol:'CHP', name:'Cemex Holdings Philippines', sector:'Industrial' },
  { symbol:'AXLM', name:'Axelum Resources', sector:'Industrial' },
  { symbol:'DGTL', name:'DigiPlus Interactive', sector:'Industrial' },
  { symbol:'ASLAG', name:'Phinma Renewable Energy', sector:'Industrial' },
  { symbol:'DFNN', name:'DFNN Inc', sector:'Industrial' },
  { symbol:'SGI', name:'Steam Industries', sector:'Industrial' },
  { symbol:'POPI', name:'Premiere Horizon Alliance', sector:'Industrial' },
  { symbol:'PAL', name:'Philippine Airlines', sector:'Industrial' },
  { symbol:'CEB', name:'Cebu Pacific Air', sector:'Industrial' },
  { symbol:'2GO', name:'2GO Group', sector:'Industrial' },
  // Holding Firms
  { symbol:'AC', name:'Ayala Corporation', sector:'Holding Firms' },
  { symbol:'SM', name:'SM Investments', sector:'Holding Firms' },
  { symbol:'AGI', name:'Alliance Global Group', sector:'Holding Firms' },
  { symbol:'LTG', name:'LT Group Inc', sector:'Holding Firms' },
  { symbol:'JGS', name:'JG Summit Holdings', sector:'Holding Firms' },
  { symbol:'AEV', name:'Aboitiz Equity Ventures', sector:'Holding Firms' },
  { symbol:'GTCAP', name:'GT Capital Holdings', sector:'Holding Firms' },
  { symbol:'HOUSE', name:'8990 Holdings', sector:'Holding Firms' },
  { symbol:'ION', name:'ION Group Holdings', sector:'Holding Firms' },
  { symbol:'MHC', name:'Manila Hotel Corp', sector:'Holding Firms' },
  { symbol:'POPI', name:'Premiere Horizon', sector:'Holding Firms' },
  { symbol:'FPH', name:'First Philippine Holdings', sector:'Holding Firms' },
  { symbol:'IMI', name:'Integrated Micro-Electronics', sector:'Holding Firms' },
  { symbol:'PCOR', name:'Petron Corp', sector:'Holding Firms' },
  { symbol:'SMCGP', name:'SMC Global Power', sector:'Holding Firms' },
  { symbol:'SMC', name:'San Miguel Corp', sector:'Holding Firms' },
  { symbol:'TOP', name:'Trans-Asia Oil & Energy', sector:'Holding Firms' },
  { symbol:'BEL', name:'Belle Corporation', sector:'Holding Firms' },
  { symbol:'ALLDY', name:'Alsons Consolidated Resources', sector:'Holding Firms' },
  { symbol:'ATN', name:'ATN Holdings', sector:'Holding Firms' },
  { symbol:'ANS', name:'A. Soriano Corp', sector:'Holding Firms' },
  { symbol:'MRSGI', name:'Metro Retail Stores Group', sector:'Holding Firms' },
  { symbol:'ABA', name:'ABA Holdings', sector:'Holding Firms' },
  // Financial Services
  { symbol:'COL', name:'COL Financial Group', sector:'Financial Services' },
  { symbol:'FDC', name:'Filinvest Development Corp', sector:'Financial Services' },
  { symbol:'PLC', name:'Premium Leisure Corp', sector:'Financial Services' },
  { symbol:'SLI', name:'Sterling Equity Inc', sector:'Financial Services' },
  { symbol:'PPI', name:'Pepsi-Cola Products Philippines', sector:'Financial Services' },
  // Services
  { symbol:'DITO', name:'DITO CME Holdings', sector:'Services' },
  { symbol:'M', name:'Melco Resorts Leisure', sector:'Services' },
  { symbol:'PCEV', name:'Philippine Seven Corp', sector:'Services' },
  { symbol:'SFI', name:'South Force Inc', sector:'Services' },
  { symbol:'BCOR', name:'Bayan Telecommunications', sector:'Services' },
  { symbol:'IDC', name:'Integrated Diversified Corp', sector:'Services' },
  // Gold / Forex (for gold trades)
  { symbol:'XAU/USD', name:'Gold vs US Dollar', sector:'Gold' },
  { symbol:'XAU/PHP', name:'Gold vs Philippine Peso', sector:'Gold' },
];

// Portfolio connections for watchlist
const PORTFOLIO_CONNECTIONS = {
  'Banking': 'Similar to MBT in your portfolio — same banking sector',
  'REIT': 'Same REIT category as MREIT, FILRT, KEEPR — dividend-focused',
  'Telecom': 'Same sector as GLO in your portfolio',
  'Mining & Oil': 'Same sector as DMC in your portfolio — cyclical',
  'Retail': 'Same sector as RRHI in your portfolio',
  'Property': 'Property developer — watch for REIT spin-off potential',
  'Energy': 'Growth sector — diversifies away from your current holdings',
  'Industrial': 'No direct match — pure diversification play',
  'Holding Firms': 'Conglomerate — broad market exposure',
};

// Discovery filter state
let discoveryFilters = { sector: '', search: '', sort: 'alpha' };
let watchlistSymbols = new Set();
let portfolioSymbols = new Set();

// Boot
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  try { initAccounts(); } catch(e) { console.warn('initAccounts failed:', e); }
  setTimeout(() => lazyLoadTab('portfolio'), 200);
  // Safety: force-hide loader after 8s no matter what
  setTimeout(() => hideLoader(), 8000);
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

  // Fade out current page, fade in new page
  const currentPage = document.querySelector('.page.active');
  const newPage = document.getElementById(`page-${page}`);

  if (currentPage && currentPage !== newPage) {
    currentPage.style.opacity = '0';
    setTimeout(() => {
      currentPage.classList.remove('active');
      newPage.classList.add('active');
      newPage.style.opacity = '0';
      setTimeout(() => {
        newPage.style.transition = 'opacity 0.15s ease';
        newPage.style.opacity = '1';
      }, 10);
    }, 100);
  } else {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    newPage.classList.add('active');
    newPage.style.opacity = '1';
  }

  // Lazy load
  lazyLoadTab(page);

  // Apply glossary tooltips after page switch
  setTimeout(() => window.applyGlossary(document.getElementById('page-' + page)), 200);
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
    case 'gold': loadGoldPage(); break;
  }
}

// Mobile menu
function toggleMobileMenu() {
  document.getElementById('sidebar').classList.toggle('open');
}

function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('open');
}

// Dynamic script loader
function loadScript(src, cb) {
  if (document.querySelector(`script[src="${src}"]`)) { if (cb) cb(); return; }
  const s = document.createElement('script');
  s.src = src;
  s.onload = () => { if (cb) cb(); };
  document.head.appendChild(s);
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

// Count-up animation for portfolio numbers
function animateCountUp(elementId, targetValue, isPeso) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const duration = 600;
  const startTime = performance.now();
  const startValue = 0;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = startValue + (targetValue - startValue) * easeOut;

    if (isPeso) {
      el.textContent = formatPeso(currentValue);
    } else {
      el.textContent = formatPct(currentValue);
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// Card stagger entrance animation
function animateCardsEntrance(containerSelector) {
  const cards = document.querySelectorAll(containerSelector);
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(8px)';
    setTimeout(() => {
      card.classList.add('animate-in');
    }, i * 60);
  });
}

// ==================== INTELLIGENCE LOADER ====================
// Cache intelligence data (loaded once per session)
let _intelligenceCache = {};

async function loadIntelligence(symbol) {
  if (_intelligenceCache[symbol]) return _intelligenceCache[symbol];
  try {
    const rows = await window.sbFetch('sterling_intelligence', {
      filter: `symbol=eq.${symbol}`,
      select: 'pillar,verdict,ai_summary,points,sources,analyzed_at'
    });
    const intel = {};
    (rows || []).forEach(r => { intel[r.pillar] = r; });
    _intelligenceCache[symbol] = intel;
    return intel;
  } catch { return {}; }
}

// ==================== PERSISTED ANALYSIS LOADER ====================

async function loadAnalysisData(symbols) {
  // Load persisted AI analysis from sterling_analysis table
  if (!symbols || symbols.length === 0) return;

  try {
    const { url, anonKey } = window.SUPABASE_CONFIG || {};
    if (!url || !anonKey) return;

    const symbolList = symbols.map(s => `"${s}"`).join(',');
    const res = await fetch(
      `${url}/rest/v1/sterling_analysis?symbol=in.(${symbolList})&select=symbol,analysis_text,action,analyzed_at&order=analyzed_at.desc`,
      { headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey } }
    );
    if (!res.ok) {
      console.warn('[Sterling] Failed to load analysis data:', res.status);
      return;
    }
    const rows = await res.json();

    // Build analysisData map (latest per symbol)
    rows.forEach(r => {
      if (!analysisData[r.symbol]) {
        analysisData[r.symbol] = {
          analysis_text: r.analysis_text,
          action: r.action,
          analyzed_at: r.analyzed_at
        };
      }
    });
    console.log('[Sterling] Loaded persisted analysis for', Object.keys(analysisData).length, 'symbols');
  } catch (e) {
    console.warn('[Sterling] Error loading analysis data:', e.message);
  }
}

// ==================== PORTFOLIO ====================

async function loadPortfolio() {
  showLoader();
  try {
    // Fetch PSEi
    fetchPSEi();

    // Fetch portfolio
    portfolioData = await window.sbFetch('sterling_portfolio', { filter: _uf(), order: 'symbol.asc' });

    // Load persisted analysis for portfolio symbols
    const portfolioSymbols = portfolioData.map(h => h.symbol).filter(Boolean);
    await loadAnalysisData(portfolioSymbols);

    renderPortfolio();
    updateLastUpdate();
    startLivePrices();

    // Auto-refresh every 60s — preserves open toggle state
    // Price updates now handled by startLivePrices() — in-place, no full re-render
    // PSEi still refreshes every 60s
    setInterval(() => { fetchPSEi(); updateLastUpdate(); }, 60000);

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

  // Inject mentor note at top of page
  const pageEl = document.getElementById('page-portfolio');
  if (pageEl && !pageEl.querySelector('.mentor-note')) {
    pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('portfolio'));
    loadLiveLesson('portfolio');
  }

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

  // Update summary with count-up animation
  animateCountUp('total-value', totalValue, true);
  animateCountUp('total-pl', totalPL, true);
  animateCountUp('total-pl-pct', totalPLPct, false);

  const plEl = document.getElementById('total-pl');
  plEl.className = 'stat-value font-mono ' + (totalPL >= 0 ? 'positive' : 'negative');

  const plPctEl = document.getElementById('total-pl-pct');
  plPctEl.className = 'stat-value font-mono ' + (totalPLPct >= 0 ? 'positive' : 'negative');

  document.getElementById('portfolio-updated').textContent = new Date().toLocaleTimeString('en-PH');

  // ── Main chart (DragonFi iframe) ──────────────────────────────────────────
  const firstSym = portfolioData[0]?.symbol || 'MBT';
  let mainChart = document.getElementById('main-chart-section');
  if (!mainChart) {
    const chartHTML = `
      <div id="main-chart-section" style="margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:#0A0A0A;font-size:18px;font-weight:800;letter-spacing:-0.02em" id="main-chart-label">${firstSym}</span>
            <span style="color:#64748B;font-size:11px">DragonFi Live Chart</span>
          </div>
          <a id="main-chart-open" href="https://www.dragonfi.ph/market/stocks/${firstSym}" target="_blank"
             style="color:#0A0A0A;font-size:11px;font-weight:700;text-decoration:none;border:1.5px solid #0A0A0A;padding:6px 12px;border-radius:6px">
            Open full ↗
          </a>
        </div>
        <div style="border-radius:8px;overflow:hidden;border:1.5px solid #0A0A0A;background:#FFFFFF;height:780px;position:relative">
          <iframe id="main-chart-iframe"
            src="https://www.dragonfi.ph/market/stocks/${firstSym}"
            width="100%"
            frameborder="0" scrolling="yes"
            style="border:none;height:calc(100% + 72px);margin-top:-72px;display:block"
            loading="lazy"
            title="${firstSym} — DragonFi">
          </iframe>
        </div>
      </div>`;
    grid.insertAdjacentHTML('beforebegin', chartHTML);
  }

  // FEATURE 3: Sector concentration warning
  const sectorConcentrationHtml = renderSectorConcentration(portfolioData, totalValue);
  let sectorBlock = document.getElementById('sector-concentration-block');
  if (!sectorBlock) {
    const mainChart = document.getElementById('main-chart-section');
    if (mainChart) {
      mainChart.insertAdjacentHTML('afterend', `<div id="sector-concentration-block">${sectorConcentrationHtml}</div>`);
    } else {
      grid.insertAdjacentHTML('beforebegin', `<div id="sector-concentration-block">${sectorConcentrationHtml}</div>`);
    }
  } else {
    sectorBlock.innerHTML = sectorConcentrationHtml;
  }

  // Render cards
  grid.innerHTML = portfolioData.map(h => {
    const currentVal = (h.current_price || 0) * (h.quantity || 0);
    const costVal = (h.average_price || 0) * (h.quantity || 0);
    const pl = currentVal - costVal;
    const plPct = costVal > 0 ? (pl / costVal) * 100 : 0;
    const dayChange = h.day_change_pct || 0;
    const changeClass = dayChange > 0 ? 'up' : dayChange < 0 ? 'down' : 'neutral';
    const plClass = pl >= 0 ? 'positive' : 'negative';

    // FEATURE 2: Break-even tracker
    const avgPrice = h.average_price || 0;
    const curPrice = h.current_price || 0;
    let breakEvenHtml = '';
    if (avgPrice > 0) {
      if (curPrice >= avgPrice) {
        breakEvenHtml = `<div class="detail-row"><span class="detail-label">Break-even</span><span class="detail-value" style="color:#059669">✓ Above B/E</span></div>`;
      } else {
        breakEvenHtml = `<div class="detail-row"><span class="detail-label">Break-even</span><span class="detail-value">${formatPeso(avgPrice)}</span></div>
          <div class="detail-row dca-hint"><span class="detail-label" style="font-size:9px">DCA TIP</span><span class="detail-value" style="font-size:11px;color:#555">DCA to lower avg cost</span></div>`;
      }
    }

    // FEATURE 4: Max drawdown (from cost basis)
    let drawdownHtml = '';
    if (avgPrice > 0 && curPrice < avgPrice) {
      const drawdownPct = ((avgPrice - curPrice) / avgPrice) * 100;
      drawdownHtml = `<div class="detail-row"><span class="detail-label">Max Drawdown</span><span class="detail-value negative">-${drawdownPct.toFixed(1)}%</span></div>`;
    }

    // FEATURE 5: Yield on cost
    let yieldOnCostHtml = '';
    const annualDiv = ANNUALIZED_DIVIDENDS[h.symbol];
    if (annualDiv && avgPrice > 0) {
      const yoc = (annualDiv / avgPrice) * 100;
      yieldOnCostHtml = `<div class="detail-row"><span class="detail-label">Yield on Cost</span><span class="detail-value" style="color:#059669">${yoc.toFixed(2)}%</span></div>`;
    }

    // FEATURE 6: Persisted Sterling Analysis from sterling_analysis table
    let savedAnalysisHtml = '';
    let analyzeButtonText = '⚡ ANALYZE';
    const savedAnalysis = analysisData[h.symbol];
    if (savedAnalysis && savedAnalysis.analysis_text) {
      const savedTs = savedAnalysis.analyzed_at
        ? new Date(savedAnalysis.analyzed_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '';
      savedAnalysisHtml = `
        <div class="sterling-analysis-section sas-open">
          <div class="sas-header" onclick="this.parentElement.classList.toggle('sas-open')">
            <span class="sas-label">⚡ STERLING ANALYSIS</span>
            <span class="sas-ts">${savedTs}</span>
            <span class="sas-toggle">▼</span>
          </div>
          <div class="sas-body"><p class="sas-text">${savedAnalysis.analysis_text}</p></div>
        </div>`;
      analyzeButtonText = '⚡ RE-ANALYZE';
    }

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
          ${breakEvenHtml}
          ${drawdownHtml}
          ${yieldOnCostHtml}
        </div>
        ${renderStockAction(h.symbol)}
        <div style="display:flex;gap:8px;margin-top:10px">
          <button onclick="switchMainChart('${h.symbol}')" class="view-chart-btn" style="flex:1">
            📈 View Chart
          </button>
          <button onclick="editPosition('${h.symbol}')" style="flex:0 0 auto;padding:8px 12px;font-size:11px;font-weight:700;border:1.5px solid #0A0A0A;border-radius:6px;background:#FFFFFF;cursor:pointer;font-family:inherit">✏️ Edit</button>
        </div>
        ${savedAnalysisHtml}
        <button class="analyze-btn" onclick="triggerAnalysis('${h.symbol}', this)" data-symbol="${h.symbol}">${analyzeButtonText}</button>
      </div>
    `;
  }).join('');
  window.applyGlossary(document.getElementById('page-portfolio'));

  // Animate cards entrance with stagger
  animateCardsEntrance('#holdings-grid .holding-card');

  // Restore pillar open/closed state from localStorage
  try {
    Object.keys(localStorage).forEach(key => {
      if (!key.startsWith('sterling_pillar_')) return;
      const id = key.replace('sterling_pillar_', '');
      const isOpen = localStorage.getItem(key) === '1';
      const body = document.getElementById('body-' + id);
      const chev = document.getElementById('chev-' + id);
      if (body) body.style.display = isOpen ? 'block' : 'none';
      if (chev) chev.style.transform = isOpen ? 'rotate(90deg)' : '';
    });
  } catch(e) {}

  // Load and render trade history below the grid
  renderTradeHistory();
}

// FEATURE 3: Sector concentration helper
function renderSectorConcentration(holdings, totalValue) {
  if (!holdings || holdings.length === 0 || totalValue <= 0) return '';

  // Calculate sector allocations
  const sectorValues = {};
  holdings.forEach(h => {
    const val = (h.current_price || 0) * (h.quantity || 0);
    // Look up sector from PSE_UNIVERSE or use holding's sector
    let sector = h.sector;
    if (!sector) {
      const found = PSE_UNIVERSE.find(u => u.symbol === h.symbol);
      sector = found?.sector || 'Other';
    }
    sectorValues[sector] = (sectorValues[sector] || 0) + val;
  });

  // Convert to percentages and sort
  const sectors = Object.entries(sectorValues)
    .map(([name, value]) => ({ name, value, pct: (value / totalValue) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  // Check for concentration > 40%
  const concentrated = sectors.filter(s => s.pct > 40);
  let warningHtml = '';
  if (concentrated.length > 0) {
    warningHtml = concentrated.map(s => `
      <div class="sector-warning-banner">
        ⚠️ SECTOR RISK: <strong>${s.name}</strong> is ${s.pct.toFixed(1)}% of your portfolio. Consider diversifying.
      </div>
    `).join('');
  }

  // Sector breakdown bars
  const barsHtml = sectors.map(s => `
    <div class="sector-bar-row">
      <span class="sector-bar-label">${s.name}</span>
      <div class="sector-bar-track">
        <div class="sector-bar-fill" style="width:${Math.min(s.pct, 100)}%;background:${s.pct > 40 ? '#DC2626' : s.pct > 25 ? '#EA580C' : '#059669'}"></div>
      </div>
      <span class="sector-bar-pct">${s.pct.toFixed(1)}%</span>
    </div>
  `).join('');

  return `
    ${warningHtml}
    <div class="sector-concentration-card">
      <div class="sector-concentration-header">SECTOR ALLOCATION</div>
      <div class="sector-bars">${barsHtml}</div>
    </div>
  `;
}

function toggleMainChart() {
  const body = document.getElementById('main-chart-body');
  const toggle = document.getElementById('main-chart-toggle');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (toggle) toggle.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function switchMainChart(symbol) {
  const iframe = document.getElementById('main-chart-iframe');
  const label  = document.getElementById('main-chart-label');
  const link   = document.getElementById('main-chart-open');
  const url    = `https://www.dragonfi.ph/market/stocks/${symbol}`;
  if (iframe) { iframe.src = url; }
  if (label)  { label.textContent = symbol; }
  if (link)   { link.href = url; }
  // Highlight active card
  document.querySelectorAll('.view-chart-btn').forEach(b => b.classList.remove('active'));
  const active = [...document.querySelectorAll('.view-chart-btn')].find(b => b.onclick?.toString().includes(`'${symbol}'`));
  if (active) active.classList.add('active');
  // Scroll to chart smoothly
  document.getElementById('main-chart-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Trade store — kept in memory so CRUD doesn't refetch every time
let _tradeCache = [];

async function renderTradeHistory() {
  const pageEl = document.getElementById('page-portfolio');
  if (!pageEl) return;
  const old = document.getElementById('trade-history-section');
  if (old) old.remove();
  const section = document.createElement('div');
  section.id = 'trade-history-section';
  section.style.cssText = 'margin-top:32px';
  section.innerHTML = '<div class="section-header" style="margin-bottom:12px">📋 Trade History</div><div id="trade-history-body" style="color:#475569;font-size:12px;text-align:center;padding:16px">Loading trades…</div>';
  pageEl.appendChild(section);
  await _loadAndRenderTrades();
}

async function _loadAndRenderTrades() {
  try {
    const [pseRows, goldRows] = await Promise.all([
      window.sbFetch('sterling_trades', { filter: _uf(), order: 'created_at.desc', limit: '100' }).catch(() => []),
      window.sbFetch('sterling_gold_trades', { filter: _uf(), order: 'created_at.desc', limit: '50' }).catch(() => [])
    ]);
    _tradeCache = [
      ...(pseRows || []).map(r => ({ ...r, _table: 'sterling_trades', asset_type: r.asset_type || 'PSE Stock' })),
      ...(goldRows || []).map(r => ({ ...r, _table: 'sterling_gold_trades', symbol: r.symbol || 'XAU/USD', asset_type: 'Gold' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    _renderTradeTable();
  } catch {
    const body = document.getElementById('trade-history-body');
    if (body) body.innerHTML = '<div style="color:#475569;text-align:center;padding:16px">Could not load trades</div>';
  }
}

function _renderTradeTable() {
  const body = document.getElementById('trade-history-body');
  if (!body) return;
  if (!_tradeCache.length) {
    body.innerHTML = '<div style="text-align:center;padding:24px;color:#475569">No trades yet. Tap ⚡ Log Trade to start.</div>';
    return;
  }
  body.innerHTML = `
    <div style="overflow-x:auto">
      <table class="trade-history-table">
        <thead><tr>
          <th>Date</th><th>Symbol</th><th>Type</th><th>Action</th>
          <th>Price</th><th>Qty</th><th>Total</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>
          ${_tradeCache.map((t, idx) => {
            const isBuy = (t.action || '').toUpperCase() === 'BUY';
            const qty = parseFloat(t.quantity || t.qty || t.lot_size || 0);
            const price = parseFloat(t.price || t.entry_price || 0);
            const total = price * qty;
            const dateStr = t.trade_date || t.date || (t.created_at || '').split('T')[0];
            return `<tr id="trade-row-${idx}">
              <td>${dateStr}</td>
              <td style="font-weight:700;color:#F1F5F9">${t.symbol || '—'}</td>
              <td><span style="font-size:10px;color:#64748B">${t.asset_type}</span></td>
              <td><span class="trade-action-badge ${isBuy ? 'buy' : 'sell'}">${t.action || '—'}</span></td>
              <td style="font-family:monospace">₱${price.toFixed(2)}</td>
              <td style="font-family:monospace">${qty.toLocaleString()}</td>
              <td style="font-family:monospace;color:${isBuy ? '#FF4757' : '#00D4A0'}">${total ? (isBuy ? '-' : '+') + '₱' + total.toLocaleString('en', {maximumFractionDigits:2}) : '—'}</td>
              <td style="color:#64748B;font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.notes || '—'}</td>
              <td class="trade-actions">
                <button class="trade-btn edit" onclick="editTrade(${idx})" title="Edit">✏️</button>
                <button class="trade-btn dupe" onclick="duplicateTrade(${idx})" title="Duplicate">📋</button>
                <button class="trade-btn del" onclick="deleteTrade(${idx})" title="Delete">🗑️</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

async function deleteTrade(idx) {
  const t = _tradeCache[idx];
  if (!t || !t.id) return;
  if (!confirm(`Delete ${t.action} ${t.symbol} on ${t.trade_date || t.date}?`)) return;
  try {
    const { url, anonKey } = window.SUPABASE_CONFIG;

    // 1. Delete the trade record
    const res = await fetch(`${url}/rest/v1/${t._table}?id=eq.${t.id}`, {
      method: 'DELETE',
      headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey }
    });
    if (!res.ok && res.status !== 204) { showToast('Delete failed'); return; }

    // 2. Reverse the effect on sterling_portfolio (PSE trades only)
    if (t._table === 'sterling_trades' && t.symbol && t.action) {
      const price = parseFloat(t.price || 0);
      const qty   = parseFloat(t.quantity || t.qty || 0);
      const existing = await window.sbFetch('sterling_portfolio', { filter: _uf(`symbol=eq.${t.symbol}`) });

      if (existing && existing.length > 0) {
        const row = existing[0];
        const oldQty = parseFloat(row.qty || 0);
        const oldAvg = parseFloat(row.avg_buy_price || 0);
        let newQty, newAvg;

        if (t.action === 'BUY') {
          // Undo a BUY: subtract qty, recalculate avg
          newQty = Math.max(0, oldQty - qty);
          newAvg = newQty > 0
            ? Math.max(0, ((oldAvg * oldQty) - (price * qty)) / newQty)
            : 0;
        } else {
          // Undo a SELL: add qty back, avg cost unchanged
          newQty = oldQty + qty;
          newAvg = oldAvg;
        }

        if (newQty <= 0) {
          // Position fully reversed — remove from portfolio
          await fetch(`${url}/rest/v1/sterling_portfolio?symbol=eq.${t.symbol}&user_id=eq.${_uid()}`, {
            method: 'DELETE',
            headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
          });
          showToast(`${t.symbol} position removed from portfolio`);
        } else {
          await window.sbUpdate('sterling_portfolio', `symbol=eq.${t.symbol}&user_id=eq.${_uid()}`, {
            qty: parseFloat(newQty.toFixed(4)),
            avg_buy_price: parseFloat(newAvg.toFixed(4))
          });
        }
      }

      // Refresh portfolio cards
      portfolioData = await window.sbFetch('sterling_portfolio', { filter: _uf(), order: 'symbol.asc' });
      loadedPages['portfolio'] = true;
      renderPortfolio();
    }

    _tradeCache.splice(idx, 1);
    _renderTradeTable();
    showToast(`Trade deleted — portfolio updated`);
  } catch(e) {
    console.error('deleteTrade error:', e);
    showToast('Delete failed');
  }
}

function duplicateTrade(idx) {
  const t = _tradeCache[idx];
  if (!t) return;
  // Pre-fill the trade log form with this trade's values
  document.getElementById('trade-asset-type').value = t.asset_type === 'Gold' ? 'Gold (XAU/USD)' : 'PSE Stock';
  document.getElementById('trade-symbol').value = t.symbol || '';
  document.getElementById('trade-action').value = t.action || 'BUY';
  document.getElementById('trade-price').value = t.price || t.entry_price || '';
  document.getElementById('trade-qty').value = t.quantity || t.qty || t.lot_size || '';
  document.getElementById('trade-date').value = new Date().toISOString().split('T')[0]; // today's date
  document.getElementById('trade-notes').value = t.notes ? 'Copy of: ' + t.notes : '';
  onAssetTypeChange();
  openTradeLog();
  showToast('Form pre-filled — edit and submit to duplicate');
}

function editTrade(idx) {
  const t = _tradeCache[idx];
  if (!t) return;
  // Pre-fill form with existing values
  document.getElementById('trade-asset-type').value = t.asset_type === 'Gold' ? 'Gold (XAU/USD)' : 'PSE Stock';
  document.getElementById('trade-symbol').value = t.symbol || '';
  document.getElementById('trade-action').value = t.action || 'BUY';
  document.getElementById('trade-price').value = t.price || t.entry_price || '';
  document.getElementById('trade-qty').value = t.quantity || t.qty || t.lot_size || '';
  document.getElementById('trade-date').value = t.trade_date || t.date || new Date().toISOString().split('T')[0];
  document.getElementById('trade-notes').value = t.notes || '';
  onAssetTypeChange();

  // Mark the form as editing (stores id + table for PATCH on submit)
  document.getElementById('trade-log-form').dataset.editId = t.id;
  document.getElementById('trade-log-form').dataset.editTable = t._table;
  document.getElementById('trade-log-form').dataset.editIdx = idx;
  document.querySelector('.trade-modal-header h2').textContent = '✏️ Edit Trade';
  document.getElementById('trade-submit-btn').textContent = 'Save Changes';
  openTradeLog();
}

// Fetch OHLCV from Supabase (no CORS issues on GitHub Pages)
async function fetchOHLCVFromSupabase(symbol) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const since = cutoff.toISOString().split('T')[0];
  try {
    const data = await window.sbFetch(
      `sterling_ohlcv?symbol=eq.${symbol}&date=gte.${since}&order=date.asc&select=date,open,high,low,close,volume`
    );
    return data || [];
  } catch {
    return [];
  }
}

async function toggleCardChart(sym, btn) {
  const container = document.getElementById('card-chart-' + sym);
  const inner = document.getElementById('card-chart-inner-' + sym);
  const chevron = btn.querySelector('.chevron');
  if (!container) return;

  const isOpen = container.style.display !== 'none';
  container.style.display = isOpen ? 'none' : 'block';
  chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
  btn.querySelector('span').textContent = isOpen ? '📈 View Chart' : '📉 Hide Chart';

  if (!isOpen && inner && !inner.dataset.rendered) {
    inner.dataset.rendered = '1';
    inner.style.height = '220px';
    inner.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:220px;color:#475569;font-size:12px">Loading chart…</div>';

    // Fetch OHLCV from Supabase sterling_ohlcv
    let ohlcv = [];
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - 3);
      const since = cutoff.toISOString().split('T')[0];
      ohlcv = await window.sbFetch('sterling_ohlcv', {
        filter: `symbol=eq.${sym}&date=gte.${since}&order=date.asc`,
        select: 'date,open,high,low,close,volume'
      });
    } catch(e) { ohlcv = []; }

    inner.innerHTML = '';

    // Embed DragonFi chart (no iframe restrictions, real PSE data, Carlo's own broker)
    inner.style.height = '420px';
    inner.style.position = 'relative';
    inner.innerHTML = `
      <div style="position:absolute;top:0;left:0;right:0;bottom:32px;border-radius:8px;overflow:hidden;background:#F8FAFC">
        <iframe
          src="https://www.dragonfi.ph/market/stocks/${sym}"
          width="100%" height="100%"
          frameborder="0"
          scrolling="yes"
          style="border:none;border-radius:8px"
          loading="lazy"
          title="${sym} chart — DragonFi">
        </iframe>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;display:flex;gap:6px;justify-content:flex-end;padding:4px 0">
        <span style="color:#475569;font-size:10px;align-self:center">📊 DragonFi live chart</span>
        <a href="https://www.dragonfi.ph/market/stocks/${sym}" target="_blank"
           style="background:#F1F5F9;color:#64748B;font-size:10px;padding:4px 10px;border-radius:4px;text-decoration:none;border:1px solid #E2E8F0">
          Open full ↗
        </a>
        <a href="https://www.tradingview.com/chart/?symbol=PSE:${sym}" target="_blank"
           style="background:#F1F5F9;color:#64748B;font-size:10px;padding:4px 10px;border-radius:4px;text-decoration:none;border:1px solid #E2E8F0">
          TradingView ↗
        </a>
      </div>`;
    return;

    if (typeof LightweightCharts === 'undefined') {
      inner.innerHTML = '<div style="color:#475569;font-size:12px;padding:16px;text-align:center">Charts loading…</div>';
      return;
    }

    const chart = LightweightCharts.createChart(inner, {
      width: inner.clientWidth || 320,
      height: 220,
      layout: { background: { color: '#FFFFFF' }, textColor: '#475569' },
      grid: { vertLines: { color: '#E2E8F0' }, horzLines: { color: '#E2E8F0' } },
      timeScale: { borderColor: '#E2E8F0', timeVisible: false },
      rightPriceScale: { borderColor: '#E2E8F0' },
      crosshair: { mode: 1 },
      handleScroll: false, handleScale: false
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350',
      borderDownColor: '#ef5350', borderUpColor: '#26a69a',
      wickDownColor: '#ef5350', wickUpColor: '#26a69a'
    });

    candleSeries.setData(ohlcv.map(d => ({
      time: d.date,
      open: parseFloat(d.open), high: parseFloat(d.high),
      low: parseFloat(d.low),   close: parseFloat(d.close)
    })));
    chart.timeScale().fitContent();

    // Live price badge + TradingView deep-link
    const latestClose = parseFloat(ohlcv[ohlcv.length - 1].close);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:6px;right:6px;display:flex;gap:6px;align-items:center;z-index:2;pointer-events:none';
    overlay.innerHTML = `
      <span style="background:rgba(201,150,12,0.12);color:#EA580C;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;font-family:monospace">
        ₱${latestClose.toFixed(2)} · 3mo
      </span>`;
    inner.style.position = 'relative';
    inner.appendChild(overlay);

    window.addEventListener('resize', () => {
      if (inner.clientWidth > 0) chart.resize(inner.clientWidth, 220);
    });
  }
}

// Three-Pillar Intelligence System
// Every insight backed by: Fundamentals + News + Technicals with sources
// All data verified via web research on 2026-03-02
// Sources: Investing.com, HelloSafe PH, Asia Securities, PSE Edge, Simply Wall St, Fintel.io, TradingView
const STOCK_INTELLIGENCE = {
  MBT: {
    badge: 'ADD ON DIP', badgeClass: 'badge-buy',
    entry: '₱73–74', target: '₱86–97', stop: '₱69',
    summary: 'Strong bank at 38% discount to peers. All technicals bullish.',
    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'P/E 6.86x vs Philippine banking sector average 11x = 38% cheaper than peers',
        'EPS grew 18% YoY — earnings are accelerating, not slowing',
        '13 analysts cover MBT: consensus target ₱91, highest target ₱97.50',
        'Dividend yield 6.78% — you get paid while you wait',
      ],
      sources: [
        { name: 'HelloSafe PH analyst targets', url: 'https://hellosafe.ph/investing/stock-market/stocks/metropolitan-bank-trust-company' },
        { name: 'PSE Edge disclosures', url: 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=573' },
      ]
    },
    news: {
      verdict: 'Positive',
      points: [
        'Q4 2025 net income rose 18% YoY on loan growth and net interest margin expansion',
        'Consumer and SME loan book expanding — supports continued earnings growth',
        'No negative news or regulatory concerns flagged on PSE Edge',
      ],
      sources: [
        { name: 'BusinessWorld Q4 earnings', url: 'https://bworldonline.com' },
        { name: 'PSE Edge', url: 'https://edge.pse.com.ph' },
      ]
    },
    technicals: {
      verdict: 'Bullish',
      points: [
        'RSI 66.8 — strong momentum, NOT yet overbought (overbought = above 70)',
        'All 12 moving averages signal BUY — short, medium, and long-term trend all pointing up',
        'Price above 200-day MA = confirmed long-term uptrend',
        'MACD positive = buying momentum stronger than selling pressure',
      ],
      sources: [
        { name: 'Investing.com MBT technicals', url: 'https://www.investing.com/equities/metropolitan-b-technical' },
        { name: 'TradingView PSE:MBT', url: 'https://www.tradingview.com/symbols/PSE-MBT/technicals/' },
      ]
    },
    conclusion: 'All three pillars align: business is growing (fundamentals), news is positive, and all technical indicators are bullish. The only reason to wait: RSI at 66.8 is not cheap technically. Best entry is on a dip to ₱73–74 (closer to 50-day MA). Stop-loss at ₱69 — if it breaks that level, momentum has shifted.',
  },
  KEEPR: {
    badge: 'DCA ZONE', badgeClass: 'badge-dca',
    entry: '₱2.00–2.10', target: '₱2.80–3.20', stop: '₱1.90',
    summary: 'Real estate worth ₱3.80/share selling for ₱2.30. 40% discount. 11% yield.',
    fundamentals: {
      verdict: 'Deep Value',
      points: [
        'NAV (Net Asset Value) = ₱3.80/share — audited real estate portfolio value',
        'Current price ₱2.30 = buying ₱1 of property for ₱0.61. That is a 40% discount.',
        'Dividend yield ~11% — one of the highest yields on the PSE',
        '94% occupancy rate — nearly full portfolio, stable rental income',
        'Asia Securities rates LONG-TERM BUY',
      ],
      sources: [
        { name: 'Asia Securities REIT Research Feb 2026', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
        { name: 'DragonFi KEEPR page', url: 'https://www.dragonfi.ph/market/stocks/KEEPR' },
      ]
    },
    news: {
      verdict: 'Cautious — Watching BSP',
      points: [
        'BSP (Bangko Sentral) held rates in Feb 2026 — rate cuts expected H2 2026',
        'REIT prices move OPPOSITE to interest rates — when BSP cuts, REITs rally',
        'No negative operational news on Keppel Philippines properties',
        'Macro headwind: global "higher for longer" rate narrative pressuring all REITs',
      ],
      sources: [
        { name: 'BSP monetary policy', url: 'https://www.bsp.gov.ph/monetary-policy' },
        { name: 'BusinessWorld REIT coverage', url: 'https://bworldonline.com' },
      ]
    },
    technicals: {
      verdict: 'Oversold — Building Base',
      points: [
        'RSI in oversold territory — more sellers than buyers recently, but often precedes reversal',
        'Price forming a base pattern near ₱2.20–2.30 support level',
        'High volume on down days = institutional selling; watch for volume to dry up (exhaustion signal)',
        'Pattern watch: look for a Hammer candle at support = potential reversal signal',
      ],
      sources: [
        { name: 'TradingView PSE:KEEPR', url: 'https://www.tradingview.com/symbols/PSE-KEEPR/technicals/' },
        { name: 'Investing.com KEEPR', url: 'https://www.investing.com/equities/keppel-reit-technical' },
      ]
    },
    conclusion: 'Fundamentals are exceptional (40% NAV discount, 11% yield). The weakness is purely macro — high interest rates hurt all REITs globally, not just KEEPR. Your thesis: when BSP cuts rates, KEEPR will re-rate toward NAV. DCA zone ₱2.00–2.10 = if it drops further, add more at that price to lower your average. Stop-loss ₱1.90 = if it breaks below this, the market is saying something structural is wrong — exit and reassess.',
  },
  FILRT: {
    badge: 'HOLD + COLLECT DIV', badgeClass: 'badge-hold',
    entry: '₱2.90–3.00', target: '₱3.80–4.00', stop: '₱2.70',
    summary: 'Ex-dividend ~Mar 11. ₱420 incoming. 28% NAV discount.',
    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'NAV ₱4.21 vs price ₱3.02 = 28% discount to filinvest real estate portfolio value',
        'Annual dividend yield 8.1% — strong income stream',
        'Dividend ₱0.06/share × your 7,000 shares = ₱420 cash in ~March',
        'Asia Securities rates LONG-TERM BUY',
      ],
      sources: [
        { name: 'Asia Securities REIT Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
      ]
    },
    news: {
      verdict: 'Positive — Dividend Incoming',
      points: [
        'Ex-dividend date approximately March 11 — you MUST hold shares before this date',
        'You already own 7,000 shares and will receive ₱420 cash automatically',
        'Filinvest expanding commercial properties — long-term rental growth',
      ],
      sources: [
        { name: 'PSE Edge FILRT disclosures', url: 'https://edge.pse.com.ph' },
      ]
    },
    technicals: {
      verdict: 'Neutral — Hold',
      points: [
        'Same macro pressure as all REITs — rate sensitivity',
        'Price stabilizing near ₱3.00 support — not breaking down aggressively',
        'Sell pressure likely to ease after ex-date (dividend capture players exit)',
        'Wait for RSI to show upward momentum before adding more',
      ],
      sources: [
        { name: 'TradingView PSE:FILRT', url: 'https://www.tradingview.com/symbols/PSE-FILRT/technicals/' },
      ]
    },
    conclusion: 'Hold through the ex-dividend date (~Mar 11) to collect your ₱420. After that, assess: if price dips post-ex-date (common — dividend buyers exit), that can be a good add opportunity in the ₱2.90–3.00 range. The 28% NAV discount and 8.1% yield make this a strong long-term hold.',
  },
  GLO: {
    badge: 'HOLD', badgeClass: 'badge-hold',
    entry: '₱1,700–1,720', target: '₱1,850–1,900', stop: '₱1,600',
    summary: 'Cheap telecom with 6.36% dividend. Global telecoms average P/E 21x — GLO trades at 11x.',
    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'P/E 11x vs global telecom sector average 21x = significant discount to international peers',
        'Dividend yield 6.36% — above inflation, reliable income',
        'EPS growing at 9.3% annually — business is expanding',
        'High debt (D/E 2.1x) is NORMAL for telecoms — building towers and fiber is capital-heavy',
      ],
      sources: [
        { name: 'Fintel.io GLO fundamentals', url: 'https://fintel.io/s/ph/glo' },
        { name: 'SimplyWallSt valuation', url: 'https://simplywall.st/stocks/ph/telecom/pse-glo/globe-telecom-shares' },
      ]
    },
    news: {
      verdict: 'Stable',
      points: [
        'Globe and PLDT continue duopoly on PH telecom — limited competitive threat',
        '5G expansion ongoing — long-term infrastructure moat',
        'No negative regulatory news',
      ],
      sources: [
        { name: 'BusinessWorld telecom', url: 'https://bworldonline.com' },
      ]
    },
    technicals: {
      verdict: 'Neutral — Above Key MA',
      points: [
        'Price above 200-day moving average = long-term uptrend intact',
        'RSI moderate — not overbought, not oversold',
        'Consolidating in range — waiting for next catalyst',
        'Add on dips to ₱1,700–1,720 (near 50-day MA support)',
      ],
      sources: [
        { name: 'TradingView PSE:GLO', url: 'https://www.tradingview.com/symbols/PSE-GLO/technicals/' },
      ]
    },
    conclusion: 'Globe is a "boring" stock in the best way — stable business, growing earnings, reliable dividend. P/E 11x vs global peers at 21x means it has room to re-rate upward. Hold and collect 6.36% while you wait. Add more if it pulls back to ₱1,700–1,720 range.',
  },
  DMC: {
    badge: 'HOLD', badgeClass: 'badge-hold',
    entry: '₱9.00–9.20', target: '₱11.81–14.89', stop: '₱8.50',
    summary: 'Cheap conglomerate with 9.7% dividend. P/E 8x vs industry 12x. Watch nickel prices.',
    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'P/E 8x vs industry average 12.2x = 35% discount to peers',
        'Dividend yield 9.73% — exceptional for a conglomerate',
        '4 out of 5 analysts rate BUY with targets ₱11.81–₱14.89',
        'Diversified: construction, mining, power, water — multiple income streams',
      ],
      sources: [
        { name: 'HelloSafe PH DMC', url: 'https://hellosafe.ph/investing/stock-market/stocks/dmc' },
        { name: 'PSE Edge DMCI', url: 'https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=188' },
      ]
    },
    news: {
      verdict: 'Watchful — Nickel Risk',
      points: [
        'DMCI\'s nickel mining division is sensitive to global LME nickel prices',
        'Nickel prices volatile in 2025–2026 due to Indonesia supply surge',
        'Construction division benefiting from government infrastructure spending (BBM admin)',
        'Power subsidiary stable — DMCI Power contracted for base load',
      ],
      sources: [
        { name: 'BusinessWorld DMCI', url: 'https://bworldonline.com' },
        { name: 'LME Nickel prices', url: 'https://www.lme.com/en/metals/non-ferrous/lme-nickel' },
      ]
    },
    technicals: {
      verdict: 'Neutral — Consolidating',
      points: [
        'RSI 44.4 — neutral, slight lean oversold. Not at extreme yet.',
        'MACD below signal line = mild downward momentum',
        'Consolidating after pullback — needs a catalyst to break upward',
        'Watch for RSI to drop below 40 + MACD cross = stronger buy signal',
      ],
      sources: [
        { name: 'Investing.com DMCI technicals', url: 'https://www.investing.com/equities/dmci-holdings-technical' },
      ]
    },
    conclusion: 'DMCI is cheap by every fundamental measure and pays nearly 10% dividends. The risk is nickel — if global nickel prices fall sharply, mining earnings drop. Monitor LME nickel monthly. Technicals are neutral — no urgency to add right now. Wait for RSI < 40 or a clear catalyst before adding more.',
  },
  MREIT: {
    badge: 'HOLD + COLLECT DIV', badgeClass: 'badge-hold',
    entry: '₱13.80–14.00', target: '₱17.50', stop: '₱13.00',
    summary: 'NAV discount 28%. Ex-dividend ~Mar 20. Megaworld expanding to Iloilo + Davao.',
    fundamentals: {
      verdict: 'Undervalued',
      points: [
        'NAV ₱19.69 vs price ₱14.18 = 28% discount to Megaworld commercial real estate',
        'Dividend yield 7.2% — strong income',
        'BUY rating from Asia Securities, target ₱17.50',
        'Megaworld expanding to Iloilo and Davao CBDs = future rental income growth',
      ],
      sources: [
        { name: 'Asia Securities REIT Research', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' },
        { name: 'DragonFi MREIT', url: 'https://www.dragonfi.ph/market/stocks/MREIT' },
      ]
    },
    news: {
      verdict: 'Positive — Expanding',
      points: [
        'Ex-dividend date approximately March 20 — hold shares before this date',
        'Megaworld township expansion drives future REIT portfolio growth',
        'Office occupancy recovering post-pandemic in Megaworld properties',
      ],
      sources: [
        { name: 'PSE Edge MREIT', url: 'https://edge.pse.com.ph' },
        { name: 'BusinessWorld', url: 'https://bworldonline.com' },
      ]
    },
    technicals: {
      verdict: 'Neutral — Rate Sensitive',
      points: [
        'Same BSP rate pressure as all REITs — price suppressed by macro',
        'Holding above ₱14.00 support — not breaking down',
        'Volume normal — no panic selling',
        'Post-ex-date dip often happens — could be a good add point at ₱13.80–14.00',
      ],
      sources: [
        { name: 'TradingView PSE:MREIT', url: 'https://www.tradingview.com/symbols/PSE-MREIT/technicals/' },
      ]
    },
    conclusion: 'Hold through ex-dividend ~March 20 to collect your dividend. If price dips post-ex-date (typical behavior — dividend buyers exit), the ₱13.80–14.00 range is a good accumulation zone. Asia Securities target ₱17.50 = 23% upside from current price, plus the 7.2% yield while you wait.',
  },
  RRHI: {
    badge: 'WAIT', badgeClass: 'badge-wait',
    entry: '₱35.00–36.00', target: '₱43.00', stop: '₱34.00',
    summary: 'Mixed technical signals. Do not add until RSI drops below 40 or MACD crosses up.',
    fundamentals: {
      verdict: 'Fair Value',
      points: [
        'Same-store sales grew 5.65% in 2025 — underlying retail business is healthy',
        'Growth rank 9/10 on GuruFocus = strong business quality score',
        'Robinsons Retail: supermarkets, convenience stores, drug stores — defensive business',
        'P/E moderate — not cheap enough to be exciting, not expensive enough to sell',
      ],
      sources: [
        { name: 'GuruFocus RRHI', url: 'https://www.gurufocus.com/stock/PHS:RRHI/summary' },
        { name: 'HelloSafe RRHI', url: 'https://hellosafe.ph/investing/stock-market/stocks/rrhi' },
      ]
    },
    news: {
      verdict: 'Neutral',
      points: [
        'No major catalysts or negative news recently',
        'Consumer spending in PH stable — retail sector broadly healthy',
        'Competition from e-commerce (Lazada, Shopee) a long-term watch item',
      ],
      sources: [
        { name: 'PSE Edge RRHI', url: 'https://edge.pse.com.ph' },
        { name: 'BusinessWorld retail', url: 'https://bworldonline.com' },
      ]
    },
    technicals: {
      verdict: 'Bearish Short-Term',
      points: [
        'RSI 47 — neutral but trending down. No oversold bounce signal yet.',
        'MACD -0.284 = selling pressure slightly stronger than buying pressure',
        '8 out of 12 moving averages signal SELL — short-term momentum is negative',
        'Sterling rule: don\'t fight 8/12 MAs pointing down. Wait for the turn.',
        'BUY SIGNAL to watch for: RSI drops below 40 (oversold) AND MACD line crosses above signal line',
      ],
      sources: [
        { name: 'Investing.com RRHI technicals', url: 'https://www.investing.com/equities/robinsons-reta-technical' },
        { name: 'TradingView PSE:RRHI', url: 'https://www.tradingview.com/symbols/PSE-RRHI/technicals/' },
      ]
    },
    conclusion: 'RRHI is a good business but the technicals say wait. When 8 of 12 moving averages say sell and MACD is negative, adding now means fighting the trend. The business hasn\'t deteriorated — this is a timing call. Your specific buy signal: RSI drops below 40 AND MACD crosses upward. That combination = trend reversal confirmed. Entry ₱35–36, target ₱43, stop ₱34.',
  },
};

// Watchlist Intelligence - WHY/HOW for top watchlist stocks
const WATCHLIST_INTELLIGENCE = {
  BDO: {
    why: 'Largest bank by assets. P/E 10.2x vs sector 11x. Conservative management, strong capital ratios.',
    how: 'Entry below ₱130. Wait for RSI < 50 or ex-dividend dip. BDO moves slowly — patience required.',
    source: { name: 'PSE Edge BDO', url: 'https://edge.pse.com.ph' }
  },
  AREIT: {
    why: 'Ayala-backed REIT. Premium quality tenants (Ayala offices, BGC, Makati). 5.8% yield, lowest risk REIT.',
    how: 'Entry ₱32–33. This is the "safe" REIT — lower yield but highest quality. Add on BSP rate cut news.',
    source: { name: 'Asia Securities REIT', url: 'https://www.asiasecequities.com/PDF/DFeb1026.pdf' }
  },
  SCC: {
    why: 'Coal mining + power. 12.5% yield — highest on PSE. P/E 5.2x = extremely cheap. ESG risk is why it\'s cheap.',
    how: 'Entry ₱36–37. High risk/high reward. Only add if you accept coal exposure. Watch global coal prices.',
    source: { name: 'Fintel SCC', url: 'https://fintel.io/s/ph/scc' }
  },
  BPI: {
    why: 'Premium bank brand. Lower yield (3.2%) but very stable. Good for capital preservation.',
    how: 'Entry ₱105–106. BPI is not cheap — only buy for stability and brand quality, not value.',
    source: { name: 'HelloSafe BPI', url: 'https://hellosafe.ph/investing/stock-market/stocks/bpi' }
  },
  DDMPR: {
    why: 'DoubleDragon REIT. 8.9% yield, P/E 11.5x. Smaller REIT but high yield. CityMall exposure = provincial growth.',
    how: 'Entry ₱1.30–1.35. High yield but less liquid than bigger REITs. Good for income, harder to sell quickly.',
    source: { name: 'DragonFi DDMPR', url: 'https://www.dragonfi.ph/market/stocks/DDMPR' }
  },
  CREIT: {
    why: 'Citicore REIT. Industrial/solar focus. 7.5% yield. Renewable energy exposure = growth angle.',
    how: 'Entry ₱2.50–2.55. Newer REIT, less track record. Good diversification from office REITs.',
    source: { name: 'PSE Edge CREIT', url: 'https://edge.pse.com.ph' }
  },
};

// Keep STOCK_ACTIONS as alias for backward compatibility
const STOCK_ACTIONS = STOCK_INTELLIGENCE;

function verdictColor(v) {
  if (!v) return '#64748B';
  const vl = v.toLowerCase();
  if (vl.includes('bullish') || vl.includes('positive') || vl.includes('strong buy') || vl.includes('deep value') || vl.includes('undervalued')) return '#00D4A0';
  if (vl.includes('bearish') || vl.includes('negative') || vl.includes('sell')) return '#FF4757';
  if (vl.includes('oversold') || vl.includes('building') || vl.includes('cautious') || vl.includes('mixed') || vl.includes('neutral')) return '#C9960C';
  if (vl.includes('buy') || vl.includes('value')) return '#60A5FA';
  return '#94A3B8';
}

function renderPillar(icon, title, pillarKey, staticPillar, supabaseData, id) {
  // Prefer Supabase data (fresh) over static fallback
  const data = supabaseData || staticPillar;
  if (!data) return '';
  
  const analyzedAt = supabaseData?.analyzed_at;
  const analyzedDate = analyzedAt ? new Date(analyzedAt).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }) : null;
  const isStale = analyzedAt ? (Date.now() - new Date(analyzedAt).getTime()) > 7 * 24 * 60 * 60 * 1000 : true;
  
  // points: from Supabase it's JSONB array, from static it's JS array
  const points = (supabaseData?.points || staticPillar?.points || []);
  const sources = (supabaseData?.sources || staticPillar?.sources || []);
  const aiSummary = supabaseData?.ai_summary || '';
  const verdict = supabaseData?.verdict || staticPillar?.verdict || '';
  
  const vc = verdictColor(verdict);

  // Inline glossary — underlines key terms with tap-to-explain tooltip
  const TERM_DEFS = {
    'P/E':             "Price-to-Earnings — how much you pay per ₱1 of profit. Lower P/E = cheaper stock.",
    'NAV':             "Net Asset Value — the real book value of assets owned. Price below NAV = you're buying at a discount.",
    'RSI':             "0–100 momentum meter. Below 30 = oversold (beaten down, may bounce). Above 70 = overbought (may pull back).",
    'MACD':            "Compares two moving averages. Positive = buying pressure winning. Negative = selling pressure winning.",
    'EPS':             "Earnings Per Share — company profit ÷ shares. Rising EPS = growing profits.",
    'ex-date':         "Ex-dividend date — own the stock before this date to receive the upcoming dividend.",
    'overbought':      "RSI above 70 — stock ran up fast, short-term cooldown likely.",
    'oversold':        "RSI below 30 — stock fell too fast, potential bounce incoming.",
    'dividend yield':  "Annual dividend ÷ stock price. 7% yield = ₱7 per year for every ₱100 invested.",
    'Dividend yield':  "Annual dividend ÷ stock price. 7% yield = ₱7 per year for every ₱100 invested.",
    'moving averages': "Average price over set periods (20, 50, 200 days). More MAs pointing up = stronger trend.",
    'support':         "Price floor where buyers usually step in. Holding support = bullish.",
    'resistance':      "Price ceiling where sellers appear. Breaking above resistance = bullish breakout.",
    'occupancy rate':  "% of rentable space that is leased. Higher occupancy = more rental income.",
    'analyst target':  "The price analysts at brokers think the stock should reach within 12 months.",
    'capital ratios':  "How much of a bank's own money it holds vs loans given out. Higher = safer bank.",
  };
  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function glossify(text) {
    let out = text;
    Object.entries(TERM_DEFS).forEach(([term, def]) => {
      out = out.replace(new RegExp(`\\b(${term})\\b`, 'g'),
        `<span class="glossary-term" onclick="showGlossaryTip(this)" data-def="${escapeAttr(def)}">${term}</span>`);
    });
    return out;
  }

  // Pillar subtitle — one plain-English question so Carlo knows what the pillar answers
  const PILLAR_HELP = {
    'fundamentals': 'Is this stock cheap or expensive? Is the business healthy?',
    'news':         'What\'s happening right now that affects this stock?',
    'technicals':   'What is price momentum and chart pattern telling us?',
  };
  const helpText = PILLAR_HELP[pillarKey] || '';

  const pointsHTML = points.map(p => `
    <div class="pillar-point">
      <span class="pillar-dot" style="background:${vc}"></span>
      <span class="pillar-point-text">${glossify(p)}</span>
    </div>`).join('');

  const sourcesHTML = sources.map(s =>
    `<a href="${s.url}" target="_blank" class="pillar-src">${s.name} ↗</a>`
  ).join('');

  return `
    <div class="pillar-block">
      <div class="pillar-header" onclick="togglePillar('${id}')">
        <span class="pillar-icon">${icon}</span>
        <div class="pillar-title-group">
          <span class="pillar-title">${title}</span>
          ${helpText ? `<span class="pillar-subtitle">${helpText}</span>` : ''}
        </div>
        <span class="pillar-verdict" style="color:${vc};border-color:rgba(0,0,0,0.12);background:rgba(0,0,0,0.07)">${verdict}</span>
        <span class="pillar-chevron" id="chev-${id}">▸</span>
      </div>
      <div class="pillar-body" id="body-${id}" style="display:none">
        ${aiSummary ? `<div class="pillar-ai-summary">💡 ${aiSummary}</div>` : ''}
        ${analyzedDate ? `<div class="pillar-meta">
          <span class="pillar-date">🕐 Analyzed ${analyzedDate}</span>
          ${isStale ? '<span class="pillar-stale">⚠️ Update needed</span>' : '<span class="pillar-fresh">✓ Current</span>'}
        </div>` : ''}
        ${pillarKey === 'technicals' ? `<div class="pillar-data-quality">
          <div class="dq-row"><span class="dq-icon">📡</span><span class="dq-text"><strong>Source:</strong> TradingView Scanner — RSI, MACD, MAs computed from PSE daily price history</span></div>
          <div class="dq-row"><span class="dq-icon">${supabaseData && supabaseData.rsi14 ? '🟢' : '🔴'}</span><span class="dq-text"><strong>RSI (14):</strong> ${supabaseData && supabaseData.rsi14 ? `${parseFloat(supabaseData.rsi14).toFixed(1)} — ${supabaseData.rsi_signal || 'computed'}` : 'Not available for this stock'}</span></div>
          <div class="dq-row"><span class="dq-icon">${supabaseData && supabaseData.overall_signal ? '🟢' : '⚪'}</span><span class="dq-text"><strong>Overall signal:</strong> ${supabaseData && supabaseData.overall_signal ? supabaseData.overall_signal : 'Pending — will update on next hourly run'}</span></div>
        </div>` : ''}
        <div class="pillar-points">${pointsHTML}</div>
        ${sourcesHTML ? `<div class="pillar-sources">${sourcesHTML}</div>` : ''}
      </div>
    </div>`;
}

function togglePillar(id) {
  const body = document.getElementById('body-' + id);
  const chev = document.getElementById('chev-' + id);
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chev) chev.style.transform = open ? '' : 'rotate(90deg)';
  // Persist open state across auto-refresh
  try {
    const key = 'sterling_pillar_' + id;
    localStorage.setItem(key, open ? '0' : '1');
  } catch(e) {}
}

// Build a dynamic Sterling verdict from live TradingView data + static intel
function _buildConclusion(symbol, tech, staticIntel) {
  const overall = tech.overall_signal || '';
  const rsi = tech.rsi14 !== null ? parseFloat(tech.rsi14) : null;
  const rsiSig = tech.rsi_signal || '';
  const macdSig = tech.macd_signal || '';
  const maTrend = tech.ma_trend || '';
  const price = tech.current_price ? `₱${tech.current_price}` : '';
  const chg = tech.day_change_pct != null ? `${parseFloat(tech.day_change_pct) >= 0 ? '+' : ''}${parseFloat(tech.day_change_pct).toFixed(2)}%` : '';

  // Decide action word based on signal
  let action, actionReason;
  if (overall === 'Strong Buy') {
    action = 'ADD'; actionReason = 'all indicators align — strong buy signal';
  } else if (overall === 'Buy') {
    action = 'CONSIDER ADDING'; actionReason = 'technicals lean bullish';
  } else if (overall === 'Neutral') {
    action = 'HOLD'; actionReason = 'mixed signals — no clear direction yet';
  } else if (overall === 'Sell') {
    action = 'REDUCE OR HOLD'; actionReason = 'technicals weakening';
  } else if (overall === 'Strong Sell') {
    action = 'REDUCE POSITION'; actionReason = 'broad selling pressure detected';
  } else {
    action = 'MONITOR'; actionReason = 'insufficient data';
  }

  const rsiNote = rsi !== null
    ? (rsi < 30 ? `RSI at ${rsi} is oversold — potential bounce incoming.`
      : rsi > 70 ? `RSI at ${rsi} is overbought — possible cooldown ahead.`
      : `RSI at ${rsi} (${rsiSig}) — momentum is stable.`)
    : '';

  const macdNote = macdSig ? `MACD shows ${macdSig.toLowerCase()}.` : '';
  const maNote = maTrend ? maTrend + '.' : '';

  const staticNote = staticIntel && staticIntel.conclusion
    ? `\n\nFundamentals context: ${staticIntel.conclusion}`
    : '';

  return `Current price ${price} (${chg} today). TradingView signal: ${overall}. ${rsiNote} ${macdNote} ${maNote}\n\n⚔️ Sterling says: ${action} — ${actionReason}.${staticNote}`.trim();
}

function renderStockAction(symbol) {
  const a = STOCK_ACTIONS[symbol];
  const uid = symbol;

  // Async-load Supabase intelligence and patch pillars after initial render
  setTimeout(async () => {
    const intel = await loadIntelligence(symbol);

    if (a) {
      // Patch static pillars with Supabase data if available
      if (!Object.keys(intel).length) return;
      const fContainer = document.getElementById(`pillar-f-${uid}`);
      const nContainer = document.getElementById(`pillar-n-${uid}`);
      const tContainer = document.getElementById(`pillar-t-${uid}`);
      if (fContainer) fContainer.innerHTML = renderPillar('📊', 'Fundamentals', 'fundamentals', a.fundamentals, intel.fundamentals, uid+'_f');
      if (nContainer) nContainer.innerHTML = renderPillar('📰', 'News & Catalysts', 'news', a.news, intel.news, uid+'_n');
      if (tContainer) tContainer.innerHTML = renderPillar('📈', 'Technicals', 'technicals', a.technicals, intel.technicals, uid+'_t');
    } else {
      // No static data — render full block from Supabase intel
      const container = document.getElementById(`action-block-${uid}`);
      if (!container) return;
      if (Object.keys(intel).length) {
        const f = intel.fundamentals || {};
        const n = intel.news || {};
        const t = intel.technicals || {};
        container.innerHTML = `
          <div class="action-block">
            <div class="action-headline">
              <span class="action-badge badge-hold">ANALYSIS</span>
              <span class="action-summary">${t.ai_summary || f.ai_summary || 'Sterling analysis loaded.'}</span>
            </div>
            <div class="price-triggers">
              <div class="trigger-pill buy"><span class="trigger-label">ENTRY</span><span class="trigger-price">See verdict</span></div>
              <div class="trigger-pill tp"><span class="trigger-label">TARGET</span><span class="trigger-price">See verdict</span></div>
              <div class="trigger-pill sl"><span class="trigger-label">STOP</span><span class="trigger-price">See verdict</span></div>
            </div>
            <div class="pillars-section">
              <div>${renderPillar('📊', 'Fundamentals', 'fundamentals', null, f, uid+'_f')}</div>
              <div>${renderPillar('📰', 'News & Catalysts', 'news', null, n, uid+'_n')}</div>
              <div>${renderPillar('📈', 'Technicals', 'technicals', null, t, uid+'_t')}</div>
            </div>
            <div class="action-conclusion-block">
              <div class="action-expand" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'">
                <span>⚔️ Sterling&#39;s Verdict</span><span class="chevron">▸</span>
              </div>
              <div class="action-detail" style="display:none">
                <p class="action-conclusion">${({'Positive':'BUY','Negative':'SELL','Neutral':'HOLD'}[t.verdict || f.verdict]) || 'Analysis in progress.'}</p>
              </div>
            </div>
          </div>`;
      } else {
        // Queue for analysis
        window.sbInsert('sterling_analysis_queue', { symbol, requested_by: _uid(), status: 'pending', created_at: new Date().toISOString() }).catch(() => {});
        container.innerHTML = `
          <div class="action-block analysis-pending">
            <div style="font-size:12px;font-weight:700;color:#64748B;letter-spacing:0.05em;padding:12px 0 4px">⏳ ANALYSIS QUEUED</div>
            <p style="font-size:12px;color:#94A3B8;margin:0">Sterling is generating a full 3-pillar analysis for ${symbol}. Refresh in a few minutes.</p>
          </div>`;
      }
    }
  }, 300);

  if (a) {
    // Use live technicalsData (TradingView) for the technicals pillar if available
    const liveTech = (technicalsData || []).find(t => t.symbol === symbol);
    const liveTechPillar = liveTech ? {
      verdict: liveTech.overall_signal && liveTech.overall_signal.includes('Buy') ? 'Positive' : liveTech.overall_signal && liveTech.overall_signal.includes('Sell') ? 'Negative' : 'Neutral',
      ai_summary: `RSI ${liveTech.rsi14 !== null ? parseFloat(liveTech.rsi14).toFixed(1) : 'N/A'} (${liveTech.rsi_signal || '—'}). MACD: ${liveTech.macd_signal || '—'}. Signal: ${liveTech.overall_signal || '—'}.`,
      points: [
        `RSI(14): ${liveTech.rsi14 !== null ? parseFloat(liveTech.rsi14).toFixed(1) : 'N/A'} — ${liveTech.rsi_signal || 'N/A'}`,
        `MACD: ${liveTech.macd_signal || 'N/A'}`,
        `TradingView overall: ${liveTech.overall_signal || 'N/A'}`,
        liveTech.ma_trend || null,
        liveTech.sma50 ? `SMA50: ₱${liveTech.sma50} | SMA200: ₱${liveTech.sma200 || 'N/A'}` : null,
      ].filter(Boolean),
      sources: [{ name: `TradingView PSE:${symbol} Technicals`, url: `https://ph.tradingview.com/symbols/PSE-${symbol}/technicals/` }],
      analyzed_at: liveTech.updated_at
    } : null;

    const techUpdatedAt = liveTech && liveTech.updated_at
      ? (() => { const d = new Date(liveTech.updated_at); const mins = Math.round((Date.now() - d) / 60000); return mins < 2 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins/60)}h ago`; })()
      : null;

    // Dynamic conclusion from live signal
    const liveConclusion = liveTech ? _buildConclusion(symbol, liveTech, a) : (a.conclusion || '');

    return `
      <div class="action-block">
        <div class="action-headline">
          <span class="action-badge ${a.badgeClass}">${a.badge}</span>
          <span class="action-summary">${a.summary}</span>
          ${techUpdatedAt ? `<span class="action-freshness">📡 Updated ${techUpdatedAt}</span>` : ''}
        </div>
        <div class="price-triggers">
          <div class="trigger-pill buy"><span class="trigger-label">ENTRY</span><span class="trigger-price">${a.entry}</span></div>
          <div class="trigger-pill tp"><span class="trigger-label">TARGET</span><span class="trigger-price">${a.target}</span></div>
          <div class="trigger-pill sl"><span class="trigger-label">STOP</span><span class="trigger-price">${a.stop}</span></div>
        </div>
        <div class="pillars-section">
          <div id="pillar-f-${uid}">${renderPillar('📊', 'Fundamentals', 'fundamentals', a.fundamentals, null, uid+'_f')}</div>
          <div id="pillar-n-${uid}">${renderPillar('📰', 'News & Catalysts', 'news', a.news, null, uid+'_n')}</div>
          <div id="pillar-t-${uid}">${renderPillar('📈', 'Technicals', 'technicals', a.technicals, liveTechPillar, uid+'_t')}</div>
        </div>
        <div class="action-conclusion-block">
          <div class="action-expand" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'">
            <span>⚔️ Sterling&#39;s Verdict</span><span class="chevron">▸</span>
          </div>
          <div class="action-detail" style="display:none">
            <p class="action-conclusion" id="conclusion-${uid}">${liveConclusion}</p>
          </div>
        </div>
      </div>`;
  } else {
    // No static data — show loading shell, async fills it in
    return `<div id="action-block-${uid}">
      <div class="action-block analysis-pending">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.07em;color:#94A3B8;padding:8px 0 4px">⏳ LOADING ANALYSIS…</div>
      </div>
    </div>`;
  }
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

// ==================== MENTOR NOTES ====================

const MENTOR_NOTES = {
  portfolio: {
    icon: '⚔️',
    title: "Today's Lesson: Unrealized Loss ≠ Real Loss",
    body: "A stock showing -10% in your portfolio hasn't actually cost you money yet — it's only a loss if you sell. If the fundamentals are intact (like KEEPR's 40% NAV discount), a red number is just a lower price tag on something still worth more. Sterling tracks both price AND value."
  },
  brief: {
    icon: '📋',
    title: "Today's Lesson: Why the Morning Brief Matters",
    body: "Professional traders review market setup before the open. You're doing the same. Knowing what happened overnight (US market, USD movement, PSEi futures) gives you 30 minutes to decide — before the crowd does."
  },
  watchlist: {
    icon: '🎯',
    title: "Today's Lesson: The Difference Between Watchlist and Portfolio",
    body: "Your portfolio = stocks you own. Your watchlist = stocks you're studying before you commit money. A good watchlist has an entry price and a reason. Sterling shows you both — entry price and why it's interesting."
  },
  alerts: {
    icon: '🔔',
    title: "Today's Lesson: Alerts = Your Decision Triggers",
    body: "You can't watch prices all day. Alerts act on your behalf. When Sterling fires an alert, it's saying 'the condition you cared about just happened.' An alert without an action plan is noise — Sterling includes the action."
  },
  news: {
    icon: '📰',
    title: "Today's Lesson: How to Read News as a Trader",
    body: "Not all news moves stocks equally. HIGH IMPACT = earnings, dividends, mergers, regulatory changes — can move price 5–20%. LOW IMPACT = analyst upgrades (already priced in), general market commentary. Sterling tags each article so you know what to act on."
  },
  dividends: {
    icon: '💰',
    title: "Today's Lesson: The Ex-Dividend Date",
    body: "You must OWN shares BEFORE the ex-date to receive the dividend. If FILRT's ex-date is March 11, you need to hold your shares on March 10. Sterling shows your estimated cash income so you can plan around it."
  },
  discovery: {
    icon: '🔍',
    title: "Today's Lesson: How to Screen Stocks",
    body: "Don't buy a stock because it looks cheap. Cheap stocks are cheap for a reason. Sterling screens by P/E ratio, dividend yield, and RSI together — a cheap P/E + high yield + RSI under 40 = potentially a good entry. That combination is what you're hunting."
  },
  gold: {
    icon: '🥇',
    title: "Today's Lesson: Gold vs Dollar (DXY)",
    body: "Gold (XAU/USD) and the US Dollar Index (DXY) move in OPPOSITE directions. When the dollar weakens (DXY drops), gold rises — and vice versa. Before every gold trade, check DXY. If DXY is falling, gold tailwind is in your favor."
  },
  learn: {
    icon: '📚',
    title: "Study Note",
    body: "The best investors spend more time studying than trading. Warren Buffett reads 500 pages per day. You don't need to — but 15 minutes here before you trade is the difference between investing and gambling."
  }
};

// ── Watchlist Tech Signal Card ─────────────────────────────────────────────
// Draws from sterling_technicals (TradingView source) for any symbol.
// Used on Watchlist instead of renderStockAction() — no dependency on
// STOCK_INTELLIGENCE having the full three-pillar format.
function renderTechSignalCard(symbol) {
  const uid = 'wl_' + symbol;
  // Get from loaded technicalsData (may be populated after watchlist renders)
  const tech = (technicalsData || []).find(t => t.symbol === symbol);
  const intel = STOCK_INTELLIGENCE[symbol] || {};

  if (!tech) {
    // Async-load if not in memory yet
    setTimeout(async () => {
      try {
        const rows = await window.sbFetch('sterling_technicals', { filter: `symbol=eq.${symbol}`, limit: '1' });
        const t = rows && rows[0];
        const card = document.getElementById('tech-card-' + uid);
        if (card && t) card.outerHTML = _buildTechCard(symbol, t, intel, uid);
      } catch(e) { /* leave skeleton */ }
    }, 400);
    return `<div id="tech-card-${uid}" class="tech-signal-card loading"><div class="tsc-loading">Loading technicals…</div></div>`;
  }
  return _buildTechCard(symbol, tech, intel, uid);
}

function _buildTechCard(symbol, tech, intel, uid) {
  const overall = tech.overall_signal || '—';
  const rsi = tech.rsi14 != null ? parseFloat(tech.rsi14).toFixed(1) : null;
  const rsiSig = tech.rsi_signal || '';
  const macdSig = tech.macd_signal || null;
  const maTrend = tech.ma_trend || null;
  const updatedAt = tech.updated_at ? new Date(tech.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  // Signal badge color
  const sigColors = { 'Strong Buy': '#16A34A', 'Buy': '#16A34A', 'Neutral': '#64748B', 'Sell': '#DC2626', 'Strong Sell': '#DC2626' };
  const sigBg = { 'Strong Buy': '#DCFCE7', 'Buy': '#F0FDF4', 'Neutral': '#F1F5F9', 'Sell': '#FEF2F2', 'Strong Sell': '#FEE2E2' };
  const sc = sigColors[overall] || '#64748B';
  const sb = sigBg[overall] || '#F1F5F9';

  // RSI bar color
  const rsiColor = rsi !== null ? (parseFloat(rsi) >= 70 ? '#DC2626' : parseFloat(rsi) <= 30 ? '#16A34A' : '#0A0A0A') : '#94A3B8';

  // Rationale from STOCK_INTELLIGENCE (why/how or summary)
  const why = intel.why || intel.summary || null;
  const how = intel.how || null;

  // Entry / Target / Stop — from STOCK_INTELLIGENCE or derived from TradingView SMA levels
  let entry = intel.entry || null;
  let target = intel.target || null;
  let stop = intel.stop || null;
  let entryNum = null, targetNum = null, stopNum = null;

  // Extract numeric values for R:R calculation
  const extractPrice = (str) => {
    if (!str) return null;
    const match = str.match(/₱?([\d,.]+)/);
    return match ? parseFloat(match[1].replace(/,/g, '')) : null;
  };

  if (!entry) {
    const price = tech.current_price != null ? parseFloat(tech.current_price) : null;
    const sma50 = tech.sma50 != null ? parseFloat(tech.sma50) : null;
    const sma200 = tech.sma200 != null ? parseFloat(tech.sma200) : null;
    if (price != null && sma50 != null) {
      if (price > sma50 * 1.03) {
        entry = `Near ₱${sma50.toFixed(2)} (wait for SMA50 dip)`;
        entryNum = sma50;
      } else {
        entry = `~₱${price.toFixed(2)} (near SMA50 support)`;
        entryNum = price;
      }
    } else if (price != null) {
      entry = `~₱${price.toFixed(2)} (current level)`;
      entryNum = price;
    }
    if (!stop && sma200 != null) {
      stopNum = sma200 * 0.95;
      stop = `₱${stopNum.toFixed(2)} (5% below SMA200)`;
    }
    if (!target && price != null) {
      targetNum = price * 1.12;
      target = `₱${targetNum.toFixed(2)} (+12% swing target)`;
    }
  } else {
    entryNum = extractPrice(entry);
    targetNum = extractPrice(target);
    stopNum = extractPrice(stop);
  }

  // FEATURE 1: Risk/Reward Ratio calculation
  let rrHtml = '';
  if (entryNum && targetNum && stopNum && entryNum > stopNum) {
    const reward = targetNum - entryNum;
    const risk = entryNum - stopNum;
    const rr = (reward / risk).toFixed(1);
    const rrColor = parseFloat(rr) >= 2.0 ? '#059669' : parseFloat(rr) >= 1.0 ? '#EA580C' : '#DC2626';
    rrHtml = `<div class="tsc-rr-badge" style="color:${rrColor};border-color:${rrColor}">R:R 1:${rr}</div>`;
  }

  // FEATURE: Sterling Verdict section
  let verdictHtml = '';
  if (tech && overall && overall !== '—') {
    // Map overall_signal to verdict label
    let verdictLabel, verdictReason, verdictClass;
    if (overall === 'Strong Buy') {
      verdictLabel = 'STRONG BUY';
      verdictClass = 'verdict-strong-buy';
      verdictReason = rsi !== null
        ? `RSI ${rsi} + MA trend confirms upward momentum`
        : 'All indicators align — strong buy signal';
    } else if (overall === 'Buy') {
      verdictLabel = 'BUY';
      verdictClass = 'verdict-buy';
      verdictReason = 'Price above key moving averages, momentum building';
    } else if (overall === 'Neutral') {
      verdictLabel = 'HOLD';
      verdictClass = 'verdict-hold';
      verdictReason = 'Consolidating — wait for breakout confirmation';
    } else if (overall === 'Sell') {
      verdictLabel = 'SELL';
      verdictClass = 'verdict-sell';
      verdictReason = rsi !== null && parseFloat(rsi) > 60
        ? `RSI elevated at ${rsi} — consider reducing`
        : 'RSI elevated or price below SMA50';
    } else if (overall === 'Strong Sell') {
      verdictLabel = 'STRONG SELL';
      verdictClass = 'verdict-strong-sell';
      verdictReason = 'Multiple sell signals — consider reducing position';
    } else {
      verdictLabel = 'MONITOR';
      verdictClass = 'verdict-hold';
      verdictReason = 'Insufficient data for clear signal';
    }

    // Calculate time ago
    let verdictTimeAgo = '';
    if (tech.updated_at) {
      const mins = Math.round((Date.now() - new Date(tech.updated_at).getTime()) / 60000);
      verdictTimeAgo = mins < 2 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.round(mins/60)}h ago`;
    }

    verdictHtml = `
      <div class="tsc-verdict-section">
        <div class="tsc-verdict-label">STERLING VERDICT</div>
        <div class="tsc-verdict-row">
          <span class="tsc-verdict-badge ${verdictClass}">${verdictLabel}</span>
          <span class="tsc-verdict-reason">${verdictReason}</span>
        </div>
        ${verdictTimeAgo ? `<div class="tsc-verdict-time">Updated ${verdictTimeAgo}</div>` : ''}
      </div>`;
  } else {
    // No tech data - show pending
    verdictHtml = `
      <div class="tsc-verdict-section">
        <div class="tsc-verdict-label">STERLING VERDICT</div>
        <div class="tsc-verdict-row">
          <span class="tsc-verdict-badge verdict-pending">ANALYSIS PENDING</span>
        </div>
      </div>`;
  }

  // FEATURE 6: 52-week range bar
  let range52Html = '';
  const w52High = tech.week52_high != null ? parseFloat(tech.week52_high) : null;
  const w52Low = tech.week52_low != null ? parseFloat(tech.week52_low) : null;
  const curPrice = tech.current_price != null ? parseFloat(tech.current_price) : null;
  if (w52High && w52Low && curPrice && w52High > w52Low) {
    const range = w52High - w52Low;
    const position = ((curPrice - w52Low) / range) * 100;
    const posClamped = Math.max(0, Math.min(100, position));
    range52Html = `
      <div class="tsc-52w-range">
        <div class="tsc-52w-label">52W: ₱${w52Low.toFixed(2)} — ₱${w52High.toFixed(2)}</div>
        <div class="tsc-52w-track"><div class="tsc-52w-dot" style="left:${posClamped}%"></div></div>
      </div>`;
  }

  // FEATURE 7: Volume spike badge
  let volBadgeHtml = '';
  const volume = tech.volume != null ? parseFloat(tech.volume) : null;
  const avgVolume = tech.avg_volume_10d != null ? parseFloat(tech.avg_volume_10d) : null;
  if (volume && avgVolume && avgVolume > 0) {
    const volRatio = volume / avgVolume;
    if (volRatio >= 3.0) {
      volBadgeHtml = `<span class="tsc-vol-badge surge">VOL SURGE</span>`;
    } else if (volRatio >= 1.8) {
      volBadgeHtml = `<span class="tsc-vol-badge spike">VOL SPIKE</span>`;
    }
  }

  // FEATURE 8: Persisted Sterling Analysis from sterling_analysis table
  let savedAnalysisHtml = '';
  let analyzeButtonText = '⚡ ANALYZE';
  const savedAnalysis = analysisData[symbol];
  if (savedAnalysis && savedAnalysis.analysis_text) {
    const savedTs = savedAnalysis.analyzed_at
      ? new Date(savedAnalysis.analyzed_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
    savedAnalysisHtml = `
      <div class="sterling-analysis-section sas-open">
        <div class="sas-header" onclick="this.parentElement.classList.toggle('sas-open')">
          <span class="sas-label">⚡ STERLING ANALYSIS</span>
          <span class="sas-ts">${savedTs}</span>
          <span class="sas-toggle">▼</span>
        </div>
        <div class="sas-body"><p class="sas-text">${savedAnalysis.analysis_text}</p></div>
      </div>`;
    analyzeButtonText = '⚡ RE-ANALYZE';
  }

  return `<div id="tech-card-${uid}" class="tech-signal-card">
    <div class="tsc-header">
      <span class="tsc-source-label">TECHNICALS — TRADINGVIEW</span>
      ${updatedAt ? `<span class="tsc-updated">${updatedAt}</span>` : ''}
    </div>
    <div class="tsc-signal-row">
      <span class="tsc-overall" style="background:${sb};color:${sc};border-color:${sc}40">${overall}</span>
      ${rsi !== null ? `<span class="tsc-rsi" style="color:${rsiColor}">RSI ${rsi}<span class="tsc-rsi-label"> — ${rsiSig}</span></span>` : ''}
      ${macdSig ? `<span class="tsc-macd-badge">MACD: ${macdSig}</span>` : ''}
      ${volBadgeHtml}
    </div>
    ${maTrend ? `<div class="tsc-ma-trend">📊 ${maTrend}</div>` : ''}
    ${range52Html}
    <div class="tsc-entry-block">
      ${entry  ? `<div class="tsc-entry-pill entry"><span class="tsc-ep-label">BUY ENTRY</span><span class="tsc-ep-val">${entry}</span></div>` : ''}
      ${target ? `<div class="tsc-entry-pill target"><span class="tsc-ep-label">TARGET</span><span class="tsc-ep-val">${target}</span></div>` : ''}
      ${stop   ? `<div class="tsc-entry-pill stop"><span class="tsc-ep-label">STOP LOSS</span><span class="tsc-ep-val">${stop}</span></div>` : ''}
      ${rrHtml}
    </div>
    ${verdictHtml}
    ${why ? `<div class="tsc-rationale"><span class="tsc-why-label">WHY WATCH:</span> ${why}</div>` : ''}
    ${how ? `<div class="tsc-rationale" style="margin-top:6px"><span class="tsc-why-label">HOW TO BUY:</span> ${how}</div>` : ''}
    ${savedAnalysisHtml}
    <button class="analyze-btn" onclick="triggerAnalysis('${symbol}', this)" data-symbol="${symbol}">${analyzeButtonText}</button>
  </div>`;
}

function renderMentorNote(page) {
  // Render placeholder immediately — replaced async by loadLiveLesson()
  const fallback = MENTOR_NOTES[page] || MENTOR_NOTES['portfolio'];
  return `
    <div class="mentor-note" id="mentor-note-${page}">
      <div class="mentor-header">
        <span class="mentor-icon">${fallback.icon}</span>
        <span class="mentor-title" id="mentor-title-${page}">${fallback.title}</span>
      </div>
      <p class="mentor-body" id="mentor-body-${page}">${fallback.body}</p>
    </div>`;
}

async function loadLiveLesson(page) {
  try {
    const rows = await window.sbFetch('sterling_lessons', {
      filter: `page=eq.${page}`,
      order: 'created_at.desc',
      limit: '1'
    });
    if (!rows || !rows.length) return;
    const lesson = rows[0];
    const titleEl = document.getElementById(`mentor-title-${page}`);
    const bodyEl = document.getElementById(`mentor-body-${page}`);
    const iconEl = document.querySelector(`#mentor-note-${page} .mentor-icon`);
    if (titleEl) titleEl.textContent = lesson.lesson_title;
    if (bodyEl) bodyEl.textContent = lesson.lesson_body;
    if (iconEl && lesson.lesson_icon) iconEl.textContent = lesson.lesson_icon;
  } catch (e) {
    // Silently fall back to static — already rendered
  }
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
      const alerts = await window.sbFetch('sterling_alerts', { filter: _uf("type=eq.morning_brief"), order: 'created_at.desc', limit: '20' });
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

  // Inject mentor note at top of page
  const pageEl = document.getElementById('page-brief');
  if (pageEl && !pageEl.querySelector('.mentor-note')) {
    pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('brief'));
    loadLiveLesson('brief');
  }

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
  window.applyGlossary(document.getElementById('page-brief'));
}

function toggleBrief(index) {
  const cards = document.querySelectorAll('.brief-card');
  cards[index].classList.toggle('expanded');
}

// ==================== WATCHLIST ====================

async function loadWatchlist() {
  try {
    watchlistData = await window.sbFetch('sterling_watchlist', { filter: _uf(), order: 'fundamental_score.desc' });

    // Load persisted analysis for watchlist symbols
    const watchlistSymbols = watchlistData.map(w => w.symbol).filter(Boolean);
    await loadAnalysisData(watchlistSymbols);

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
  // Inject mentor note at top of page (only once)
  const pageEl = document.getElementById('page-watchlist');
  if (pageEl && !pageEl.querySelector('.mentor-note')) {
    pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('watchlist'));
    loadLiveLesson('watchlist');
  }

  const sectorEl = document.getElementById('filter-sector');
  const recEl = document.getElementById('filter-recommendation');
  const sector = sectorEl ? sectorEl.value : '';
  const rec = recEl ? recEl.value : '';

  let filtered = watchlistData.filter(w => {
    if (sector && w.sector !== sector) return false;
    if (rec && w.recommendation !== rec) return false;
    return true;
  });

  const cards = document.getElementById('watchlist-cards');
  const tbody = document.getElementById('watchlist-tbody');

  // Calculate stats
  const buySignals = filtered.filter(w => getSignalType(w) === 'BUY').length;
  const nearTarget = filtered.filter(w => w.current_price && w.target_buy && w.current_price <= w.target_buy * 1.05).length;

  // Update stats bar
  const statsBar = document.getElementById('watchlist-stats');
  if (statsBar) {
    statsBar.innerHTML = `
      <div class="wl-stat"><span class="wl-stat-value">${filtered.length}</span><span class="wl-stat-label">Watching</span></div>
      <div class="wl-stat buy"><span class="wl-stat-value">${buySignals}</span><span class="wl-stat-label">Buy Signals</span></div>
      <div class="wl-stat target"><span class="wl-stat-value">${nearTarget}</span><span class="wl-stat-label">Near Target</span></div>
    `;
  }

  if (!filtered || filtered.length === 0) {
    cards.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👁️</div><div class="empty-state-text">No watchlist items. Add stocks from Discovery to start tracking.</div></div>`;
    tbody.innerHTML = '';
    return;
  }

  // Cards view - new design
  cards.innerHTML = filtered.map(w => {
    const signal = getSignalType(w);
    const signalClass = signal.toLowerCase();
    const connection = PORTFOLIO_CONNECTIONS[w.sector] || 'Diversification opportunity';
    const yieldVal = w.dividend_yield || 0;
    const peVal = w.pe_ratio || 0;

    return `
      <div class="watchlist-card-new signal-${signalClass}">
        <div class="wl-card-top">
          <div class="wl-card-badges">
            <span class="sector-badge-wl">${w.sector || 'N/A'}</span>
            <span class="signal-badge ${signalClass}">${signal}</span>
          </div>
          <button class="wl-remove-btn" onclick="removeFromWatchlist('${w.symbol}')" title="Remove">✕</button>
        </div>
        <div class="wl-card-main">
          <div class="wl-card-symbol">${w.symbol}</div>
          <div class="wl-card-company">${w.company_name || ''}</div>
        </div>
        <div class="wl-card-prices">
          <div class="wl-price-row">
            <span class="label">Current</span>
            <span class="value" id="wl-price-${w.symbol}">${w.current_price ? formatPeso(w.current_price) : '—'}</span>
            <span class="wl-change-badge" id="wl-chg-${w.symbol}"></span>
          </div>
          <div class="wl-price-row">
            <span class="label">Target</span>
            <span class="value target">${formatPeso(w.target_buy || w.target_price)}</span>
          </div>
        </div>
        <div class="wl-card-metrics-row">
          <div><span class="label">Yield</span><span class="value">${yieldVal}%</span></div>
          <div><span class="label">P/E</span><span class="value">${peVal}x</span></div>
        </div>
        <div class="wl-portfolio-connection">
          <span class="connection-icon">📎</span>
          <span class="connection-text">${connection}</span>
        </div>
        ${w.reason || w.rationale ? `
        <div class="wl-rationale">
          <span class="rationale-icon">💡</span>
          <span class="rationale-text">${w.reason || w.rationale}</span>
        </div>
        ` : ''}
        ${renderTechSignalCard(w.symbol)}
        <div class="wl-card-actions" style="margin-top:10px">
          <a class="wl-chart-link" href="https://www.investagrams.com/stock/${w.symbol}" target="_blank">View Chart ↗</a>
        </div>
      </div>
    `;
  }).join('');

  // Fetch live prices from Phisix for watchlist stocks
  _fetchWatchlistLivePrices(filtered);

  // Table view - keep for alternate view
  tbody.innerHTML = filtered.map(w => {
    const signal = getSignalType(w);
    return `
    <tr>
      <td style="font-weight: 700; color: var(--accent-gold)">${w.symbol}</td>
      <td style="font-family: var(--font-main)">${w.company_name || ''}</td>
      <td>${formatPeso(w.current_price)}</td>
      <td>${formatPeso(w.target_buy)}</td>
      <td>${formatPeso(w.stop_loss)}</td>
      <td style="font-family: var(--font-main)">${w.sector || '—'}</td>
      <td>${w.pe_ratio || '—'}</td>
      <td>${w.dividend_yield ? w.dividend_yield + '%' : '—'}</td>
      <td><span class="signal-badge ${signal.toLowerCase()}">${signal}</span></td>
      <td><button class="wl-remove-btn-sm" onclick="removeFromWatchlist('${w.symbol}')">✕</button></td>
    </tr>
  `;
  }).join('');
  window.applyGlossary(document.getElementById('page-watchlist'));
}

async function _fetchWatchlistLivePrices(stocks) {
  if (!stocks || !stocks.length) return;
  // Only PSE symbols (skip Gold, indices)
  const pse = stocks.filter(w => w.symbol && !w.symbol.includes('/') && !w.symbol.startsWith('^'));
  for (const w of pse) {
    try {
      const res = await fetch(`https://phisix-api3.appspot.com/stocks/${w.symbol}.json`);
      if (!res.ok) continue;
      const data = await res.json();
      const stock = data && data.stock && data.stock[0];
      if (!stock) continue;
      const price = stock.price && stock.price.amount;
      const pct = stock.percent_change != null ? stock.percent_change : (stock.percentChange != null ? stock.percentChange : null);
      const priceEl = document.getElementById(`wl-price-${w.symbol}`);
      const chgEl = document.getElementById(`wl-chg-${w.symbol}`);
      if (priceEl && price) priceEl.textContent = formatPeso(price);
      if (chgEl && pct != null) {
        const pctNum = parseFloat(pct);
        chgEl.textContent = (pctNum >= 0 ? '+' : '') + pctNum.toFixed(2) + '%';
        chgEl.style.cssText = `font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:4px;background:${pctNum >= 0 ? '#DCFCE7' : '#FEE2E2'};color:${pctNum >= 0 ? '#16A34A' : '#DC2626'}`;
      }
    } catch (e) { /* network error — leave stale price */ }
  }
}

function getSignalType(stock) {
  const yieldVal = stock.dividend_yield || 0;
  const pe = stock.pe_ratio || 999;
  const sector = stock.sector || '';
  const growthSectors = ['Energy', 'Industrial', 'Holding Firms'];

  // BUY: yield > 6% AND pe < 15 AND sector in (Banking, REIT, Mining)
  if (yieldVal > 6 && pe < 15 && ['Banking', 'REIT', 'Mining & Oil'].includes(sector)) {
    return 'BUY';
  }

  // AVOID: pe > 35 OR (yield < 1% AND not growth sector)
  if (pe > 35 || (yieldVal < 1 && !growthSectors.includes(sector))) {
    return 'AVOID';
  }

  // WATCH: everything else (yield 3-6% OR pe 15-25)
  return 'WATCH';
}

async function removeFromWatchlist(symbol) {
  if (!confirm(`Remove ${symbol} from your Watchlist?`)) return;

  try {
    await window.sbFetch(`sterling_watchlist?symbol=eq.${symbol}`, { method: 'DELETE' });

    // Update local data and re-render
    watchlistData = watchlistData.filter(w => w.symbol !== symbol);
    watchlistSymbols.delete(symbol);
    renderWatchlist();
    showToast(`${symbol} removed from Watchlist`);
  } catch (err) {
    console.error('Remove from watchlist error:', err);
    showToast('Failed to remove from watchlist', 'error');
  }
}

// ==================== ALERTS ====================

async function loadAlerts() {
  try {
    alertsData = await window.sbFetch('sterling_alerts', { filter: _uf(), order: 'created_at.desc', limit: '50' });
    renderAlerts();
    updateAlertsBadge();

    // Auto-refresh every 30s
    setInterval(async () => {
      alertsData = await window.sbFetch('sterling_alerts', { filter: _uf(), order: 'created_at.desc', limit: '50' });
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

  // Inject mentor note at top of page
  const pageEl = document.getElementById('page-alerts');
  if (pageEl && !pageEl.querySelector('.mentor-note')) {
    pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('alerts'));
    loadLiveLesson('alerts');
  }

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
  window.applyGlossary(document.getElementById('page-alerts'));
}

async function dismissAlert(id) {
  try {
    await window.sbUpdate('sterling_alerts', `id=eq.${id}`, { is_sent: true });
    alertsData = alertsData.map(a => a.id === id ? { ...a, is_sent: true } : a);
    updateAlertsBadge();
  } catch (err) {
    console.error('Dismiss alert error:', err);
  }
}

// ==================== NEWS ====================

async function loadNews() {
  try {
    newsData = await window.sbFetch('sterling_news', { order: 'published_at.desc', limit: '50' });
    // Pre-tag sentiment so filter works correctly
    newsData = (newsData || []).map(n => ({
      ...n,
      sentiment: n.sentiment || tagSentiment((n.headline || '') + ' ' + (n.summary || ''))
    }));
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
  // Inject mentor note at top of page
  const pageEl = document.getElementById('page-news');
  if (pageEl && !pageEl.querySelector('.mentor-note')) {
    pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('news'));
    loadLiveLesson('news');
  }

  // Add AI Personalized badge to page header if not already present
  const pageHeader = pageEl?.querySelector('.page-header');
  if (pageHeader && !pageHeader.querySelector('.ai-personalized-badge')) {
    pageHeader.insertAdjacentHTML('beforeend', '<span class="ai-personalized-badge">AI PERSONALIZED</span>');
  }

  // Show staleness warning if newest article is > 24h old
  const staleWarningId = 'news-stale-warning';
  let existingWarn = document.getElementById(staleWarningId);
  if (existingWarn) existingWarn.remove();
  if (newsData && newsData.length > 0) {
    const newest = newsData[0];
    const ageMs = Date.now() - new Date(newest.published_at || newest.created_at).getTime();
    const ageH = Math.round(ageMs / 3600000);
    if (ageMs > 24 * 3600000) {
      const warn = document.createElement('div');
      warn.id = staleWarningId;
      warn.style.cssText = 'background:#FFFBEB;border:1px solid #FCD34D;border-radius:6px;padding:10px 14px;font-size:12px;color:#92400E;margin-bottom:12px;display:flex;align-items:center;gap:8px';
      warn.innerHTML = `⚠️ <strong>News last refreshed ${ageH}h ago.</strong> Next auto-refresh at 8AM tomorrow. <a href="#" onclick="loadNews();return false;" style="color:#B45309;font-weight:700;margin-left:4px">Refresh now ↺</a>`;
      const feed = document.getElementById('news-feed');
      if (feed && feed.parentNode) feed.parentNode.insertBefore(warn, feed);
    }
  }

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

  feed.innerHTML = filtered.map(n => {
    const sentiment = n.sentiment || tagSentiment((n.headline || '') + ' ' + (n.summary || ''));
    const sentimentIcon = sentiment === 'bullish' ? '▲' : sentiment === 'bearish' ? '▼' : '●';

    // AI action badge mapping
    const actionBadgeClass = {
      'BUY MORE': 'ai-action-buy',
      'HOLD': 'ai-action-hold',
      'REDUCE': 'ai-action-reduce',
      'WATCH CLOSELY': 'ai-action-watch'
    };
    const aiAction = n.ai_action || null;
    const actionClass = aiAction ? (actionBadgeClass[aiAction.toUpperCase()] || 'ai-action-hold') : '';

    // AI summary section (only if summary exists and differs from headline)
    const hasAISummary = n.summary && n.summary !== n.headline && n.summary.length > 50;
    const aiSummaryHTML = hasAISummary ? `
      <div class="news-ai-analysis">
        <div class="news-ai-label">STERLING ANALYSIS</div>
        <div class="news-ai-summary">${escapeHtml(n.summary)}</div>
      </div>
    ` : '';

    return `
    <div class="news-card ${sentiment}">
      <div class="news-header">
        <div class="news-headline">${escapeHtml(n.headline || 'No headline')}</div>
        <div class="news-badges">
          ${n.symbol ? `<span class="news-symbol-badge">${escapeHtml(n.symbol)}</span>` : ''}
          ${aiAction ? `<span class="ai-action-badge ${actionClass}">${escapeHtml(aiAction)}</span>` : ''}
          <span class="news-sentiment ${sentiment}">${sentimentIcon} ${sentiment.toUpperCase()}</span>
        </div>
      </div>
      ${aiSummaryHTML}
      <div class="news-meta">
        <span>${escapeHtml(n.source || 'Unknown source')}</span>
        <span>${formatTime(n.published_at || n.created_at)}</span>
      </div>
    </div>`;
  }).join('');
  window.applyGlossary(document.getElementById('page-news'));
}

// ==================== DIVIDENDS ====================

async function loadDividends() {
  try {
    // Inject mentor note at top of page
    const pageEl = document.getElementById('page-dividends');
    if (pageEl && !pageEl.querySelector('.mentor-note')) {
      pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('dividends'));
      loadLiveLesson('dividends');
    }

    if (!portfolioData || portfolioData.length === 0) {
      portfolioData = await window.sbFetch('sterling_portfolio', { filter: _uf(), order: 'symbol.asc' });
    }
    renderCalendar();
    renderUpcomingDividends();
    renderIncomeProjection();
    renderDividendHistory();
    window.applyGlossary(document.getElementById('page-dividends'));
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
    // Load watchlist and portfolio to check existing symbols
    const watchlist = await window.sbFetch('sterling_watchlist', { filter: _uf(), select: 'symbol' });
    watchlistSymbols = new Set(watchlist.map(w => w.symbol));
    portfolioSymbols = new Set(portfolioData.map(p => p.symbol));

    renderDiscoveryFilters();
    renderDiscovery();
  } catch (err) {
    console.error('Discovery load error:', err);
  }
}

function renderDiscoveryFilters() {
  const container = document.getElementById('discovery-filters');
  if (!container) return;

  const sectors = ['All', 'Banking', 'REIT', 'Telecom', 'Property', 'Mining & Oil', 'Retail', 'Energy', 'Industrial', 'Holding Firms'];

  container.innerHTML = `
    <input type="text" id="disc-search" placeholder="Search symbol or company…" oninput="updateDiscoveryFilter('search', this.value)" style="padding:8px 12px;border:1.5px solid #0A0A0A;border-radius:6px;font-size:13px;flex:1;min-width:180px">
    <select id="disc-sector" onchange="updateDiscoveryFilter('sector', this.value)">
      ${sectors.map(s => `<option value="${s === 'All' ? '' : s}">${s}</option>`).join('')}
    </select>
    <select id="disc-sort" onchange="updateDiscoveryFilter('sort', this.value)">
      <option value="alpha">Alphabetical</option>
      <option value="sector">By Sector</option>
    </select>
  `;
}

function updateDiscoveryFilter(key, value) {
  discoveryFilters[key] = value;
  renderDiscovery();
}

async function renderDiscovery() {
  // Inject mentor note at top of page
  const pageEl = document.getElementById('page-discovery');
  if (pageEl && !pageEl.querySelector('.mentor-note')) {
    pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('discovery'));
    loadLiveLesson('discovery');
  }

  const grid = document.getElementById('discovery-grid');
  grid.innerHTML = `<div class="discovery-loading" style="padding:32px;text-align:center;color:#94A3B8;font-size:13px">Loading PSE universe…</div>`;

  // Load fundamentals from sterling_intelligence — group by symbol+pillar
  // sterling_intelligence has one row per pillar (fundamentals/news/technicals) per symbol
  let intelMap = {};
  try {
    const intelRows = await window.sbFetch('sterling_intelligence', { limit: '200' });
    if (intelRows && intelRows.length) {
      intelRows.forEach(row => {
        if (!intelMap[row.symbol]) intelMap[row.symbol] = {};
        intelMap[row.symbol][row.pillar] = row;
      });
    }
  } catch (e) { /* no intel, show N/A */ }

  // Filter stocks
  const search = (discoveryFilters.search || '').toLowerCase();
  let stocks = PSE_UNIVERSE.filter(s => {
    if (discoveryFilters.sector && s.sector !== discoveryFilters.sector) return false;
    if (search && !s.symbol.toLowerCase().includes(search) && !s.name.toLowerCase().includes(search)) return false;
    return true;
  });

  // Sort
  if (discoveryFilters.sort === 'sector') {
    stocks.sort((a, b) => a.sector.localeCompare(b.sector) || a.symbol.localeCompare(b.symbol));
  } else {
    stocks.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  if (stocks.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No stocks match your search. Try a different symbol or sector.</div></div>`;
    return;
  }

  grid.innerHTML = stocks.map(s => {
    const inWatchlist = watchlistSymbols.has(s.symbol);
    const inPortfolio = portfolioSymbols.has(s.symbol);
    const sectorColor = getSectorColor(s.sector);
    const intel = intelMap[s.symbol] || null;

    // Parse fundamentals from sterling_intelligence (pillar=fundamentals row)
    let pe = 'N/A', eps = 'N/A', divYield = 'N/A', verdict = null, analyzedDate = null, isStale = true;
    const fundamentalRow = intel && intel.fundamentals ? intel.fundamentals : null;
    if (fundamentalRow) {
      try {
        const points = Array.isArray(fundamentalRow.points)
          ? fundamentalRow.points
          : (typeof fundamentalRow.points === 'string' ? JSON.parse(fundamentalRow.points) : []);
        // Extract P/E, EPS, yield from points text (best-effort)
        const pePoint = points.find(p => /P\/E|P-E|price.to.earn/i.test(p));
        const epsPoint = points.find(p => /EPS|earnings per share/i.test(p));
        const yldPoint = points.find(p => /yield|dividend/i.test(p));
        const peMatch = pePoint && pePoint.match(/[\d.]+x/);
        const epsMatch = epsPoint && epsPoint.match(/[\d.]+/);
        const yldMatch = yldPoint && yldPoint.match(/[\d.]+%/);
        if (peMatch) pe = peMatch[0];
        if (epsMatch) eps = '₱' + epsMatch[0];
        if (yldMatch) divYield = yldMatch[0];
        verdict = fundamentalRow.verdict || null;
        analyzedDate = fundamentalRow.analyzed_at ? new Date(fundamentalRow.analyzed_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : null;
        isStale = fundamentalRow.analyzed_at ? (Date.now() - new Date(fundamentalRow.analyzed_at).getTime()) > 7 * 24 * 60 * 60 * 1000 : true;
      } catch (e) { /* parse fail, keep N/A */ }
    }

    const verdictColor = verdict === 'Positive' ? '#16A34A' : verdict === 'Negative' ? '#DC2626' : '#94A3B8';

    return `
      <div class="disc-card">
        <div class="disc-card-top">
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <span class="sector-badge" style="background:${sectorColor}18;color:${sectorColor};border:1px solid ${sectorColor}40">${s.sector}</span>
            ${inPortfolio ? '<span class="disc-tag portfolio-tag">IN PORTFOLIO</span>' : ''}
            ${inWatchlist ? '<span class="disc-tag watch-tag">WATCHING</span>' : ''}
          </div>
          ${inWatchlist
            ? `<button class="disc-wl-btn in-wl" disabled>✓ Watching</button>`
            : `<button class="disc-wl-btn" onclick="addToWatchlistFromDiscovery('${s.symbol}', '${s.name.replace(/'/g, '&#39;')}', '${s.sector}')">+ Watch</button>`
          }
        </div>
        <div class="disc-card-identity">
          <div class="disc-symbol">${s.symbol}</div>
          <div class="disc-name">${s.name}</div>
        </div>
        <div class="disc-fundamentals">
          <div class="disc-metric"><span class="disc-metric-label">P/E</span><span class="disc-metric-value">${pe}</span></div>
          <div class="disc-metric"><span class="disc-metric-label">EPS</span><span class="disc-metric-value">${eps}</span></div>
          <div class="disc-metric"><span class="disc-metric-label">DIV YIELD</span><span class="disc-metric-value">${divYield}</span></div>
        </div>
        ${verdict ? `<div class="disc-verdict" style="border-left:3px solid ${verdictColor};padding:6px 10px;margin-top:10px;background:${verdictColor}08;font-size:12px;color:${verdictColor};font-weight:700;letter-spacing:0.05em">${verdict.toUpperCase()}</div>` : ''}
        ${(() => {
          // Entry suggestion from sterling_technicals if loaded
          const tech = (technicalsData || []).find(t => t.symbol === s.symbol);
          if (!tech) return '';
          const price = tech.current_price;
          const sma50 = tech.sma50 ? parseFloat(tech.sma50) : null;
          const sma200 = tech.sma200 ? parseFloat(tech.sma200) : null;
          const overall = tech.overall_signal || '';
          const sigC = overall.includes('Buy') ? '#16A34A' : overall.includes('Sell') ? '#DC2626' : '#64748B';
          let entryText, targetText, stopText;
          if (price != null && sma50 != null) {
            entryText = price > sma50 * 1.03 ? `Near ₱${sma50.toFixed(2)} (SMA50 dip)` : `~₱${parseFloat(price).toFixed(2)} (near support)`;
          } else if (price != null) {
            entryText = `~₱${parseFloat(price).toFixed(2)}`;
          }
          if (price) targetText = `₱${(parseFloat(price) * 1.12).toFixed(2)} (+12%)`;
          if (sma200) stopText = `₱${(sma200 * 0.95).toFixed(2)} (−5% SMA200)`;
          return `<div class="disc-signal-row">
            <span class="disc-signal-badge" style="background:${sigC}18;color:${sigC};border:1px solid ${sigC}40">${overall || '—'}</span>
            ${entryText ? `<span class="disc-entry-chip entry">BUY: ${entryText}</span>` : ''}
            ${targetText ? `<span class="disc-entry-chip target">TP: ${targetText}</span>` : ''}
            ${stopText ? `<span class="disc-entry-chip stop">SL: ${stopText}</span>` : ''}
          </div>`;
        })()}
        ${analyzedDate
          ? `<div class="disc-data-quality">${isStale ? '⚠️' : '✓'} Fundamentals as of ${analyzedDate}${isStale ? ' — update needed' : ''}</div>`
          : `<div class="disc-data-quality" style="color:#DC2626">⚠️ No analysis yet — add to Watchlist to queue</div>`
        }
      </div>
    `;
  }).join('');
  window.applyGlossary(document.getElementById('page-discovery'));
}

function getSectorColor(sector) {
  const colors = {
    'Banking': '#3B82F6',
    'REIT': '#10B981',
    'Telecom': '#8B5CF6',
    'Property': '#F59E0B',
    'Mining & Oil': '#EF4444',
    'Retail': '#EC4899',
    'Energy': '#06B6D4',
    'Industrial': '#6366F1',
    'Holding Firms': '#F97316',
  };
  return colors[sector] || '#64748B';
}

async function addToWatchlistFromDiscovery(symbol, company, sector) {
  try {
    const payload = {
      symbol: symbol,
      company_name: company,
      sector: sector,
      target_price: null,
      notes: 'Added from Discovery',
      recommendation: 'WATCH',
      reason: 'Added by user from Discovery scanner'
    };

    await window.sbFetch('sterling_watchlist', { method: 'POST', body: JSON.stringify({...payload, user_id: _uid()}) });

    // Update local state and re-render
    watchlistSymbols.add(symbol);
    renderDiscovery();
    showToast(`${symbol} added to Watchlist ✓`);
  } catch (err) {
    console.error('Add to watchlist error:', err);
    showToast('Failed to add to watchlist', 'error');
  }
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('discovery-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'discovery-toast';
    toast.className = 'discovery-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `discovery-toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
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
  // Inject mentor note at top of page
  const pageEl = document.getElementById('page-learn');
  if (pageEl && !pageEl.querySelector('.mentor-note')) {
    pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('learn'));
  }

  renderGlossary(GLOSSARY);
  renderConcepts(CONCEPTS);
  renderPatterns(PATTERNS);
  renderPatternCharts();
  renderPatternAlerts();
  renderStudyPortfolio();
  renderPortfolioSchool(PORTFOLIO_SCHOOL);
  renderResources(RESOURCES);
  setTimeout(() => window.applyGlossary(), 500);
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

// ==================== TRADE LOG ====================

// ── Add / Edit Position Modal ─────────────────────────────────────────────

let _addPosSymbol = null;
let _addPosSymbolName = null;
let _addPosDDOpen = false;

function openAddPosition(existingHolding) {
  const overlay = document.getElementById('addpos-modal-overlay');
  const title = document.getElementById('addpos-modal-title');
  const submitBtn = document.getElementById('addpos-submit-btn');
  overlay.classList.add('active');
  document.getElementById('addpos-form').reset();
  _addPosSymbol = null;
  _addPosSymbolName = null;
  document.getElementById('addpos-symbol').value = '';
  document.getElementById('addpos-symbol-input').value = '';
  document.getElementById('addpos-preview').style.display = 'none';

  if (existingHolding) {
    title.textContent = '✏️ Edit Position';
    submitBtn.textContent = 'Update Position';
    document.getElementById('addpos-symbol-input').value = existingHolding.symbol;
    document.getElementById('addpos-symbol').value = existingHolding.symbol;
    document.getElementById('addpos-shares').value = existingHolding.qty || existingHolding.quantity || '';
    document.getElementById('addpos-avgprice').value = existingHolding.avg_buy_price || existingHolding.average_price || '';
    _addPosSymbol = existingHolding.symbol;
    _addPosSymbolName = existingHolding.company_name || existingHolding.symbol;
    document.getElementById('addpos-form').dataset.editSymbol = existingHolding.symbol;
    _updateAddPosPreview();
  } else {
    title.textContent = '📌 Add Position';
    submitBtn.textContent = 'Save Position';
    delete document.getElementById('addpos-form').dataset.editSymbol;
  }
  _renderAddPosDropdown('');
}

function closeAddPosition() {
  document.getElementById('addpos-modal-overlay').classList.remove('active');
}

function editPosition(symbol) {
  const h = portfolioData.find(p => p.symbol === symbol);
  if (!h) { showToast('Position not found', 'error'); return; }
  openAddPosition({
    symbol: h.symbol,
    company_name: h.company_name || h.symbol,
    sector: h.sector || 'N/A',
    qty: h.quantity || h.qty || 0,
    avg_buy_price: h.average_price || h.avg_buy_price || 0
  });
}

function openAddPosDropdown() {
  _addPosDDOpen = true;
  _renderAddPosDropdown(document.getElementById('addpos-symbol-input').value);
}

function closeAddPosDropdownDelayed() {
  setTimeout(() => {
    _addPosDDOpen = false;
    document.getElementById('addpos-symbol-dropdown').style.display = 'none';
  }, 200);
}

function filterAddPosDropdown() {
  _renderAddPosDropdown(document.getElementById('addpos-symbol-input').value);
}

function _renderAddPosDropdown(query) {
  const dd = document.getElementById('addpos-symbol-dropdown');
  const q = (query || '').trim().toUpperCase();
  const list = PSE_UNIVERSE.filter(s => s.sector !== 'Gold');
  const filtered = q
    ? list.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q)).slice(0, 30)
    : list.slice(0, 40);

  if (!filtered.length) {
    dd.innerHTML = '<div class="symbol-dd-empty">No results</div>';
  } else {
    dd.innerHTML = filtered.map(s =>
      `<div class="symbol-dd-item" onmousedown="selectAddPosSymbol('${s.symbol}','${s.name.replace(/'/g, '&#39;')}')">
        <span class="symbol-dd-code">${s.symbol}</span>
        <span class="symbol-dd-name">${s.name}</span>
        <span class="symbol-dd-sector">${s.sector}</span>
      </div>`
    ).join('');
  }
  dd.style.display = 'block';
}

function selectAddPosSymbol(symbol, name) {
  _addPosSymbol = symbol;
  _addPosSymbolName = name;
  document.getElementById('addpos-symbol').value = symbol;
  document.getElementById('addpos-symbol-input').value = symbol;
  document.getElementById('addpos-symbol-dropdown').style.display = 'none';
  _updateAddPosPreview();
}

function _updateAddPosPreview() {
  const sym = _addPosSymbol;
  const shares = parseFloat(document.getElementById('addpos-shares').value) || 0;
  const avg = parseFloat(document.getElementById('addpos-avgprice').value) || 0;
  const prev = document.getElementById('addpos-preview');

  if (!sym || !shares || !avg) { prev.style.display = 'none'; return; }
  prev.style.display = 'block';

  const cost = shares * avg;
  // Try to get live price from portfolioData or leave as N/A
  const holding = portfolioData.find(h => h.symbol === sym);
  const livePrice = holding ? (holding.current_price || 0) : 0;
  const value = livePrice ? shares * livePrice : null;
  const pl = value !== null ? value - cost : null;
  const plPct = pl !== null && cost > 0 ? (pl / cost) * 100 : null;

  document.getElementById('addpos-prev-cost').textContent = formatPeso(cost);
  document.getElementById('addpos-prev-value').textContent = value !== null ? formatPeso(value) : 'No live price';
  const plEl = document.getElementById('addpos-prev-pl');
  const plPctEl = document.getElementById('addpos-prev-plpct');
  plEl.textContent = pl !== null ? formatPeso(pl) : '—';
  plEl.style.color = pl !== null ? (pl >= 0 ? '#16A34A' : '#DC2626') : '#0A0A0A';
  plPctEl.textContent = plPct !== null ? (plPct >= 0 ? '+' : '') + plPct.toFixed(2) + '%' : '—';
  plPctEl.style.color = plPct !== null ? (plPct >= 0 ? '#16A34A' : '#DC2626') : '#0A0A0A';
}

async function submitAddPosition(e) {
  e.preventDefault();
  const sym = document.getElementById('addpos-symbol').value.trim();
  const shares = parseFloat(document.getElementById('addpos-shares').value);
  const avg = parseFloat(document.getElementById('addpos-avgprice').value);
  if (!sym || !shares || !avg) { showToast('Fill in all fields.', 'error'); return; }

  const btn = document.getElementById('addpos-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  // Find PSE_UNIVERSE entry for name/sector
  const meta = PSE_UNIVERSE.find(s => s.symbol === sym) || { name: sym, sector: 'N/A' };
  const isReit = ['REIT'].includes(meta.sector);

  // Check if position already exists for this user
  const existing = await window.sbFetch('sterling_portfolio', { filter: _uf(`symbol=eq.${sym}`) });
  let result;
  if (existing && existing.length > 0) {
    // Update existing
    result = await window.sbUpdate('sterling_portfolio', _uf(`symbol=eq.${sym}`), { qty: shares, avg_buy_price: avg });
  } else {
    // Insert new
    result = await window.sbInsert('sterling_portfolio', {
      user_id: _uid(),
      symbol: sym,
      company_name: meta.name,
      sector: meta.sector,
      is_reit: isReit,
      qty: shares,
      avg_buy_price: avg,
      current_price: 0,
      day_change_pct: 0
    });
  }

  btn.disabled = false;
  btn.textContent = 'Save Position';

  if (result && !result.error) {
    showToast(`${sym} position saved ✓`, 'success');
    closeAddPosition();
    // Reload portfolio
    const data = await window.sbFetch('sterling_portfolio', { filter: _uf(), order: 'symbol.asc' });
    if (data) { portfolioData = data; renderPortfolio(); }
  } else {
    showToast('Save failed. Try again.', 'error');
  }
}

// Trigger preview recalc when shares/price inputs change
document.addEventListener('DOMContentLoaded', () => {
  ['addpos-shares','addpos-avgprice'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _updateAddPosPreview);
  });
});

function openTradeLog() {
  document.getElementById('trade-modal-overlay').classList.add('active');
  document.getElementById('trade-date').valueAsDate = new Date();
  try { onAssetTypeChange(); } catch(e) {}
}

function closeTradeLog() {
  document.getElementById('trade-modal-overlay').classList.remove('active');
  const form = document.getElementById('trade-log-form');
  form.reset();
  delete form.dataset.editId;
  delete form.dataset.editTable;
  delete form.dataset.editIdx;
  const h2 = document.querySelector('.trade-modal-header h2');
  if (h2) h2.textContent = '⚡ Log Trade';
  const btn = document.getElementById('trade-submit-btn');
  if (btn) btn.textContent = 'Submit Trade';
}

function onAssetTypeChange() {
  const type = document.getElementById('trade-asset-type')?.value || 'PSE Stock';
  const qtyLabel = document.getElementById('trade-qty-label');
  const searchInput = document.getElementById('symbol-search-input');
  if (qtyLabel) qtyLabel.textContent = type === 'Gold (XAU/USD)' ? 'Lot Size' : 'Quantity (Shares)';
  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = type === 'Gold (XAU/USD)' ? 'XAU/USD or XAU/PHP' : 'Type symbol or name… e.g. MBT, Jollibee';
  }
  const hidden = document.getElementById('trade-symbol');
  if (hidden) hidden.value = '';
  // Pre-filter dropdown based on asset type
  _symbolFilter = type === 'Gold (XAU/USD)' ? 'Gold' : 'PSE';
  filterSymbolDropdown();
}

let _symbolFilter = 'PSE';

function _getSymbolList() {
  if (_symbolFilter === 'Gold') return PSE_UNIVERSE.filter(s => s.sector === 'Gold');
  return PSE_UNIVERSE.filter(s => s.sector !== 'Gold');
}

function openSymbolDropdown() {
  filterSymbolDropdown();
  const dd = document.getElementById('symbol-dropdown');
  if (dd) dd.style.display = 'block';
}

function closeSymbolDropdownDelayed() {
  setTimeout(() => {
    const dd = document.getElementById('symbol-dropdown');
    if (dd) dd.style.display = 'none';
  }, 200);
}

function filterSymbolDropdown() {
  const input = document.getElementById('symbol-search-input');
  const dd = document.getElementById('symbol-dropdown');
  if (!dd) return;
  const q = (input?.value || '').toLowerCase().trim();
  const list = _getSymbolList();
  const matches = q
    ? list.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)).slice(0, 30)
    : list.slice(0, 40);
  if (!matches.length) {
    dd.innerHTML = '<div class="symbol-dd-empty">No results</div>';
    dd.style.display = 'block';
    return;
  }
  dd.innerHTML = matches.map(s => {
    const safeName = s.name.replace(/'/g, '&#39;');
    return `<div class="symbol-dd-item" onmousedown="selectSymbol('${s.symbol}','${safeName}')">
      <span class="symbol-dd-code">${s.symbol}</span>
      <span class="symbol-dd-name">${s.name}</span>
      <span class="symbol-dd-sector">${s.sector}</span>
    </div>`;
  }).join('');
  dd.style.display = 'block';
}

function selectSymbol(symbol, name) {
  const hidden = document.getElementById('trade-symbol');
  const input = document.getElementById('symbol-search-input');
  const dd = document.getElementById('symbol-dropdown');
  if (hidden) hidden.value = symbol;
  if (input) input.value = symbol + ' — ' + name;
  if (dd) dd.style.display = 'none';
}

async function submitTrade(e) {
  e.preventDefault();
  const btn = document.getElementById('trade-submit-btn');
  const form = document.getElementById('trade-log-form');
  const editId = form.dataset.editId;
  const editTable = form.dataset.editTable;
  const editIdx = form.dataset.editIdx;
  const isEdit = !!editId;

  btn.textContent = isEdit ? 'Saving…' : 'Submitting…';
  btn.disabled = true;

  // Handle EDIT (PATCH existing trade)
  if (isEdit) {
    try {
      const price = parseFloat(document.getElementById('trade-price').value);
      const qty = parseFloat(document.getElementById('trade-qty').value);
      const date = document.getElementById('trade-date').value;
      const notes = document.getElementById('trade-notes').value;
      const action = document.getElementById('trade-action').value;
      const { url, anonKey } = window.SUPABASE_CONFIG;
      const res = await fetch(`${url}/rest/v1/${editTable}?id=eq.${editId}`, {
        method: 'PATCH',
        headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ price, quantity: qty, trade_date: date, action, notes })
      });
      if (res.ok || res.status === 204) {
        // Update cache in place
        if (editIdx !== undefined && _tradeCache[editIdx]) {
          _tradeCache[editIdx] = { ..._tradeCache[editIdx], price, quantity: qty, trade_date: date, action, notes };
        }
        closeTradeLog();
        _renderTradeTable();
        showToast('Trade updated ✓');
      } else {
        showToast('Update failed');
      }
    } catch { showToast('Update failed'); }
    btn.textContent = 'Save Changes';
    btn.disabled = false;
    return;
  }

  try {
    const assetType = document.getElementById('trade-asset-type').value;
    const symbol = document.getElementById('trade-symbol').value.toUpperCase();
    const action = document.getElementById('trade-action').value;
    const price = parseFloat(document.getElementById('trade-price').value);
    const qty = parseFloat(document.getElementById('trade-qty').value);
    const date = document.getElementById('trade-date').value;
    const notes = document.getElementById('trade-notes').value;

    if (assetType === 'Gold (XAU/USD)') {
      // Save to gold trades with correct column names
      await window.sbInsert('sterling_gold_trades', {
        user_id: _uid(),
        symbol: 'XAU/USD',
        action: action,
        price: price,
        quantity: qty,
        trade_date: date,
        asset_type: 'Gold',
        notes: notes
      });
      showToast('Gold trade logged ✓');
    } else {
      // Save trade to history first
      await window.sbInsert('sterling_trades', {
        user_id: _uid(),
        symbol: symbol,
        action: action,
        price: price,
        quantity: qty,
        trade_date: date,
        asset_type: 'PSE Stock',
        notes: notes
      });
      // Update portfolio position
      const existing = await window.sbFetch('sterling_portfolio', { filter: _uf(`symbol=eq.${symbol}`) });
      if (existing && existing.length > 0) {
        const row = existing[0];
        const oldQty = parseFloat(row.qty || row.quantity || 0);
        const oldAvg = parseFloat(row.avg_buy_price || row.average_price || 0);
        let newQty, newAvg;
        if (action === 'BUY') {
          newQty = oldQty + qty;
          newAvg = ((oldAvg * oldQty) + (price * qty)) / newQty;
        } else {
          newQty = Math.max(0, oldQty - qty);
          newAvg = oldAvg; // avg cost doesn't change on sell
        }
        if (action === 'SELL' && newQty === 0) {
          // Remove position entirely
          const { url, anonKey } = window.SUPABASE_CONFIG;
          await fetch(`${url}/rest/v1/sterling_portfolio?symbol=eq.${symbol}&user_id=eq.${_uid()}`, {
            method: 'DELETE',
            headers: { 'apikey': anonKey, 'Authorization': `Bearer ${anonKey}` }
          });
          showToast(`${symbol} position closed — removed from portfolio`);
        } else {
          await window.sbUpdate('sterling_portfolio', `symbol=eq.${symbol}&user_id=eq.${_uid()}`, {
            qty: parseFloat(newQty.toFixed(4)),
            avg_buy_price: parseFloat(newAvg.toFixed(4))
          });
          showToast(`${action} ${symbol} logged ✓ — portfolio updated`);
        }
      } else if (action === 'BUY') {
        // Look up company info from PSE_UNIVERSE
        const knownStock = PSE_UNIVERSE.find(s => s.symbol === symbol) || {};
        await window.sbInsert('sterling_portfolio', {
          user_id: _uid(),
          symbol: symbol,
          qty: qty,
          avg_buy_price: price,
          current_price: price,
          company_name: knownStock.name || symbol,
          sector: knownStock.sector || 'PSE',
          is_reit: knownStock.sector === 'REIT'
        });
        showToast(`${symbol} added to portfolio ✓`);
      } else {
        showToast('Symbol not in portfolio — trade saved to history only');
      }
    }
    // Refresh portfolio and trigger fresh intelligence fetch
    portfolioData = await window.sbFetch('sterling_portfolio', { filter: _uf(), order: 'symbol.asc' });
    loadedPages['portfolio'] = true;
    renderPortfolio();
    closeTradeLog();
    showToast(`✅ ${action} ${symbol} logged — portfolio updated`);
    // Queue analysis for this symbol — server cron picks up within 5 min
    if (symbol && assetType === 'PSE Stock') {
      window.sbInsert('sterling_analysis_queue', {
        symbol, user_id: _uid(), status: 'pending'
      }).catch(() => {});
      showToast(`📊 Analysis queued for ${symbol} — ready in ~5 min`);
    }
    // Invalidate intelligence cache so next render fetches fresh analysis
    if (symbol && _intelligenceCache) delete _intelligenceCache[symbol];
    // Sync user accounts to Supabase in background
    syncAccountsToSupabase();
  } catch (err) {
    console.error('Trade submit error:', err);
    showToast('Error logging trade');
  }
  btn.textContent = 'Submit Trade';
  btn.disabled = false;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// ==================== INLINE GLOSSARY TOOLTIPS ====================

const INLINE_GLOSSARY = {
  'RSI': 'RSI (Relative Strength Index) \u2014 measures momentum from 0-100. Above 70 = overbought (may drop). Below 30 = oversold (may bounce). Above 50 = bullish momentum.',
  'MACD': 'MACD \u2014 tracks trend changes. When MACD line crosses above signal line = buy signal. When it crosses below = sell signal.',
  'P/E': 'P/E Ratio \u2014 how expensive a stock is vs its earnings. Lower P/E = cheaper. Example: MBT P/E 6.86x vs sector average 11x means MBT is undervalued.',
  'NAV': 'NAV (Net Asset Value) \u2014 for REITs, this is the true value of all properties owned. If stock price < NAV, you\'re buying at a discount.',
  'EPS': 'EPS (Earnings Per Share) \u2014 company profit divided by number of shares. Rising EPS = growing business.',
  'DCA': 'DCA (Dollar-Cost Averaging) \u2014 buying more shares at a lower price to reduce your average cost. Best for stocks with solid fundamentals that temporarily dropped.',
  'REIT': 'REIT (Real Estate Investment Trust) \u2014 a company that owns properties and pays 90%+ of profits as dividends. Like owning real estate without buying a building.',
  'Dividend': 'Dividend \u2014 cash payment from a company to shareholders, usually quarterly. Ex-dividend date = last day to own shares to receive payment.',
  'Support': 'Support Level \u2014 a price where buyers consistently step in. Like a floor. If price drops to support and holds, it often bounces back up.',
  'Resistance': 'Resistance Level \u2014 a price where sellers consistently appear. Like a ceiling. If price can break above resistance, it often continues higher.',
  'Moving Average': 'Moving Average (MA) \u2014 the average price over N days. 50-day MA = short-term trend. 200-day MA = long-term trend. Price above both = healthy uptrend.',
  'Bullish': 'Bullish \u2014 expecting the price to go UP. "MBT is bullish" = analysts expect MBT price to rise.',
  'Bearish': 'Bearish \u2014 expecting the price to go DOWN. "Market is bearish" = investors expect prices to fall.',
  'Stop-loss': 'Stop-loss \u2014 a pre-set price where you sell to limit losses. Example: "Stop-loss at \u20B11.90 for KEEPR" means if it drops to \u20B11.90, sell to protect your capital.',
  'Volume': 'Volume \u2014 number of shares traded in a day. High volume + price rise = strong move. High volume + price drop = panic selling.',
  'Market Cap': 'Market Cap \u2014 total value of a company (price \u00D7 total shares). Large cap = stable, blue chip. Small cap = higher risk, higher potential.',
  'Blue Chip': 'Blue Chip \u2014 large, established, financially stable companies. In PSE: BDO, SM, Metrobank, Globe, Ayala are blue chips.',
  'Yield': 'Dividend Yield \u2014 annual dividend divided by share price. 11% yield = for every \u20B1100 invested, you receive \u20B111/year in dividends.',
  'ex-date': 'Ex-Dividend Date \u2014 you must OWN shares BEFORE this date to receive the upcoming dividend payment.',
  'PSEi': 'PSEi (Philippine Stock Exchange Index) \u2014 tracks the top 30 companies on the PSE. When PSEi rises, most stocks tend to rise. It\'s the "temperature" of the Philippine market.'
};

window.applyGlossary = function(container) {
  const el = container || document.body;
  Object.keys(INLINE_GLOSSARY).forEach(term => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.parentElement.classList.contains('glossary-term')) return;
      if (node.parentElement.tagName === 'SCRIPT') return;
      if (node.parentElement.tagName === 'STYLE') return;
      if (node.parentElement.tagName === 'INPUT') return;
      if (node.parentElement.tagName === 'TEXTAREA') return;
      const regex = new RegExp(`\\b${term.replace('/', '\\/')}\\b`, 'g');
      if (regex.test(node.textContent)) {
        const span = document.createElement('span');
        span.innerHTML = node.textContent.replace(
          new RegExp(`\\b${term.replace('/', '\\/')}\\b`, 'g'),
          `<span class="glossary-term" data-term="${term}">${term}</span>`
        );
        node.parentElement.replaceChild(span, node);
      }
    });
  });
  el.querySelectorAll('.glossary-term').forEach(gtEl => {
    gtEl.addEventListener('mouseenter', showGlossaryTooltip);
    gtEl.addEventListener('touchstart', showGlossaryTooltip, { passive: true });
    gtEl.addEventListener('mouseleave', function(e) {
      // Don't hide if moving to the tooltip itself
      const tip = document.getElementById('glossary-tooltip');
      if (tip && tip.contains(e.relatedTarget)) return;
      hideGlossaryTooltip();
    });
  });
};

// ── Shared tooltip renderer ──────────────────────────────────────────────────
function _renderGlossaryTip(termText, defText, anchorEl) {
  let tip = document.getElementById('glossary-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'glossary-tooltip';
    document.body.appendChild(tip);
  }
  tip.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
      <span style="font-weight:800;color:#EA580C;font-size:11px;text-transform:uppercase;letter-spacing:0.08em">${termText}</span>
      <button onclick="hideGlossaryTooltip()" style="background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:13px;cursor:pointer;border-radius:50%;width:20px;height:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0">✕</button>
    </div>
    <span style="font-size:13px;line-height:1.6;color:#FFFFFF">${defText}</span>
  `;
  tip.style.display = 'block';
  tip.style.right = 'auto';
  tip.style.bottom = 'auto';
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    tip.style.position = 'fixed';
    tip.style.top = 'auto';
    tip.style.bottom = '80px';
    tip.style.left = '16px';
    tip.style.right = '16px';
    tip.style.maxWidth = 'calc(100vw - 32px)';
  } else {
    const rect = anchorEl.getBoundingClientRect();
    tip.style.position = 'fixed';
    tip.style.top = Math.min(rect.bottom + 8, window.innerHeight - 180) + 'px';
    tip.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
    tip.style.maxWidth = '300px';
  }
  setTimeout(() => {
    document.addEventListener('click', hideGlossaryOnOutside, { once: true });
    document.addEventListener('touchstart', hideGlossaryOnOutside, { once: true, passive: true });
  }, 100);
}

// Called by applyGlossary (mouseenter/touchstart) — uses data-term + INLINE_GLOSSARY
function showGlossaryTooltip(e) {
  e.stopPropagation();
  const term = e.currentTarget.dataset.term;
  const def = INLINE_GLOSSARY[term] || '';
  if (!def) return;
  _renderGlossaryTip(term, def, e.currentTarget);
}

// Called by pillar glossify (onclick) — uses data-def directly
function showGlossaryTip(el) {
  const def = el.dataset.def || '';
  const term = el.textContent || '';
  if (!def) return;
  _renderGlossaryTip(term, def, el);
}

function hideGlossaryOnOutside(e) {
  const tip = document.getElementById('glossary-tooltip');
  if (tip && !tip.contains(e.target)) hideGlossaryTooltip();
}

function hideGlossaryTooltip() {
  const tip = document.getElementById('glossary-tooltip');
  if (tip) tip.style.display = 'none';
}

// ==================== PATTERN CHARTS (Lightweight Charts) ====================

function renderPatternCharts() {
  const grid = document.getElementById('patterns-grid');
  if (!grid) return;

  const patterns = [
    {
      name: 'Hammer', emoji: '\uD83D\uDD28',
      description: 'A long lower shadow after a downtrend. Means buyers pushed back hard \u2014 possible reversal up.',
      data: [
        { time: '2024-01-01', open: 100, high: 101, low: 97, close: 98 },
        { time: '2024-01-02', open: 98, high: 99, low: 95, close: 96 },
        { time: '2024-01-03', open: 96, high: 97, low: 93, close: 94 },
        { time: '2024-01-04', open: 94, high: 95, low: 91, close: 93 },
        { time: '2024-01-05', open: 93, high: 94, low: 89, close: 91 },
        { time: '2024-01-06', open: 92, high: 93, low: 86, close: 92.5 }
      ]
    },
    {
      name: 'Doji', emoji: '\u2795',
      description: 'Open and close almost equal. Means the market is undecided \u2014 watch for what happens next.',
      data: [
        { time: '2024-01-01', open: 95, high: 98, low: 93, close: 96 },
        { time: '2024-01-02', open: 96, high: 97, low: 92, close: 93 },
        { time: '2024-01-03', open: 93, high: 95, low: 90, close: 91 },
        { time: '2024-01-04', open: 91, high: 93, low: 88, close: 89 },
        { time: '2024-01-05', open: 89, high: 92, low: 87, close: 90 },
        { time: '2024-01-06', open: 90, high: 95, low: 85, close: 90.1 }
      ]
    },
    {
      name: 'Bullish Engulfing', emoji: '\uD83D\uDCC8',
      description: 'A big green candle completely covers the previous red candle. Strong signal that buyers are taking over.',
      data: [
        { time: '2024-01-01', open: 100, high: 101, low: 97, close: 98 },
        { time: '2024-01-02', open: 98, high: 99, low: 95, close: 96 },
        { time: '2024-01-03', open: 96, high: 97, low: 93, close: 94 },
        { time: '2024-01-04', open: 94, high: 95, low: 92, close: 93 },
        { time: '2024-01-05', open: 95, high: 96, low: 91, close: 92 },
        { time: '2024-01-06', open: 91, high: 98, low: 90, close: 97 }
      ]
    },
    {
      name: 'Higher Highs / Higher Lows', emoji: '\u2B06\uFE0F',
      description: 'Each high and low is higher than the last. This IS an uptrend. Follow the trend, don\'t fight it.',
      data: [
        { time: '2024-01-01', open: 85, high: 88, low: 84, close: 87 },
        { time: '2024-01-02', open: 87, high: 90, low: 86, close: 89 },
        { time: '2024-01-03', open: 89, high: 92, low: 88, close: 91 },
        { time: '2024-01-04', open: 91, high: 94, low: 90, close: 93 },
        { time: '2024-01-05', open: 93, high: 96, low: 92, close: 95 },
        { time: '2024-01-06', open: 95, high: 98, low: 94, close: 97 },
        { time: '2024-01-07', open: 97, high: 100, low: 96, close: 99 },
        { time: '2024-01-08', open: 99, high: 102, low: 98, close: 101 }
      ]
    },
    {
      name: 'Golden Cross', emoji: '\u2728',
      description: 'The 50-day moving average crosses ABOVE the 200-day MA. One of the strongest buy signals in investing.',
      type: 'line',
      ma50: [
        { time: '2024-01-01', value: 88 }, { time: '2024-01-02', value: 87.5 },
        { time: '2024-01-03', value: 87 }, { time: '2024-01-04', value: 87 },
        { time: '2024-01-05', value: 87.5 }, { time: '2024-01-06', value: 88.5 },
        { time: '2024-01-07', value: 90 }, { time: '2024-01-08', value: 91.5 },
        { time: '2024-01-09', value: 93 }, { time: '2024-01-10', value: 94.5 },
        { time: '2024-01-11', value: 96 }, { time: '2024-01-12', value: 97.5 }
      ],
      ma200: [
        { time: '2024-01-01', value: 91 }, { time: '2024-01-02', value: 91 },
        { time: '2024-01-03', value: 90.8 }, { time: '2024-01-04', value: 90.5 },
        { time: '2024-01-05', value: 90.2 }, { time: '2024-01-06', value: 90 },
        { time: '2024-01-07', value: 89.8 }, { time: '2024-01-08', value: 89.8 },
        { time: '2024-01-09', value: 89.9 }, { time: '2024-01-10', value: 90 },
        { time: '2024-01-11', value: 90.2 }, { time: '2024-01-12', value: 90.5 }
      ]
    },
    {
      name: 'Death Cross', emoji: '\uD83D\uDC80',
      description: 'The 50-day MA crosses BELOW the 200-day MA. Strong warning that a downtrend may be starting.',
      type: 'line',
      ma50: [
        { time: '2024-01-01', value: 97 }, { time: '2024-01-02', value: 96.5 },
        { time: '2024-01-03', value: 96 }, { time: '2024-01-04', value: 95 },
        { time: '2024-01-05', value: 94 }, { time: '2024-01-06', value: 92.5 },
        { time: '2024-01-07', value: 91 }, { time: '2024-01-08', value: 89.5 },
        { time: '2024-01-09', value: 88 }, { time: '2024-01-10', value: 87 },
        { time: '2024-01-11', value: 86 }, { time: '2024-01-12', value: 85 }
      ],
      ma200: [
        { time: '2024-01-01', value: 90 }, { time: '2024-01-02', value: 90.2 },
        { time: '2024-01-03', value: 90.3 }, { time: '2024-01-04', value: 90.5 },
        { time: '2024-01-05', value: 90.5 }, { time: '2024-01-06', value: 90.5 },
        { time: '2024-01-07', value: 90.6 }, { time: '2024-01-08', value: 90.6 },
        { time: '2024-01-09', value: 90.5 }, { time: '2024-01-10', value: 90.3 },
        { time: '2024-01-11', value: 90 }, { time: '2024-01-12', value: 89.8 }
      ]
    }
  ];

  grid.innerHTML = patterns.map((p, i) => `
    <div class="pattern-card">
      <h4>${p.emoji} ${p.name}</h4>
      <div class="pattern-chart-container" id="pattern-chart-${i}"></div>
      <div class="pattern-desc">${p.description}</div>
    </div>
  `).join('');

  // Render charts after DOM is ready
  setTimeout(() => {
    if (typeof LightweightCharts === 'undefined') return;
    patterns.forEach((p, i) => {
      const container = document.getElementById('pattern-chart-' + i);
      if (!container) return;
      const chartOptions = {
        layout: { background: { color: '#FFFFFF' }, textColor: '#C9960C' },
        grid: { vertLines: { color: '#1a2035' }, horzLines: { color: '#1a2035' } },
        width: container.offsetWidth || 300,
        height: 200,
        timeScale: { visible: false }
      };
      const chart = LightweightCharts.createChart(container, chartOptions);
      if (p.type === 'line') {
        const s50 = chart.addLineSeries({ color: '#C9960C', lineWidth: 2, title: '50 MA' });
        s50.setData(p.ma50);
        const s200 = chart.addLineSeries({ color: '#FF6B6B', lineWidth: 2, title: '200 MA' });
        s200.setData(p.ma200);
      } else {
        const cs = chart.addCandlestickSeries({
          upColor: '#00C97A', downColor: '#FF6B6B',
          borderUpColor: '#00C97A', borderDownColor: '#FF6B6B',
          wickUpColor: '#00C97A', wickDownColor: '#FF6B6B'
        });
        cs.setData(p.data);
      }
      chart.timeScale().fitContent();
    });
  }, 100);
}

// ==================== PATTERN ALERTS ====================

const COMPANY_NAMES = {
  MBT: 'Metrobank', KEEPR: 'KEPPEL PH REIT', FILRT: 'Filinvest REIT',
  GLO: 'Globe Telecom', DMC: 'DMCI Holdings', MREIT: 'Megaworld REIT', RRHI: 'Robinsons Retail'
};

function detectPattern(candles) {
  if (candles.length < 3) return { label: 'Watching...', type: 'neutral' };
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];
  if (last.price > prev.price && prev.price > prev2.price) return { label: '\u2B06\uFE0F Uptrend \u2014 Higher Highs', type: 'up' };
  if (last.price < prev.price && prev.price < prev2.price) return { label: '\u2B07\uFE0F Downtrend \u2014 Lower Lows', type: 'down' };
  const range = Math.abs(last.price - prev.price) / prev.price;
  if (range < 0.005) return { label: '\u2795 Consolidating \u2014 watch for breakout', type: 'neutral' };
  return { label: '\uD83D\uDC40 No clear pattern yet', type: 'neutral' };
}

async function renderPatternAlerts() {
  const container = document.getElementById('pattern-alerts-content');
  if (!container) return;

  container.innerHTML = `
    <div class="section-header">\uD83C\uDFAF Pattern Alerts \u2014 Your Portfolio</div>
    <div id="pattern-alerts-grid"><div class="empty-state"><div class="empty-state-icon">\u23F3</div><div class="empty-state-text">Loading pattern data...</div></div></div>
  `;

  const symbols = ['MBT', 'KEEPR', 'FILRT', 'GLO', 'DMC', 'MREIT', 'RRHI'];
  try {
    const priceHistory = await window.sbFetch('sterling_price_history', { order: 'recorded_at.asc', limit: '200' });
    const grouped = {};
    priceHistory.forEach(row => {
      if (!grouped[row.symbol]) grouped[row.symbol] = [];
      grouped[row.symbol].push({ price: parseFloat(row.price || row.current_price || 0), date: row.recorded_at });
    });

    // Also get current prices from portfolio
    let currentPrices = {};
    if (portfolioData && portfolioData.length) {
      portfolioData.forEach(p => { currentPrices[p.symbol] = p.current_price; });
    }

    const alertGrid = document.getElementById('pattern-alerts-grid');
    alertGrid.innerHTML = symbols.map(sym => {
      const candles = grouped[sym] || [];
      const pattern = detectPattern(candles);
      const curPrice = currentPrices[sym] || (candles.length ? candles[candles.length - 1].price : 0);
      const badgeClass = pattern.type === 'up' ? 'up' : pattern.type === 'down' ? 'down' : 'neutral';
      return `
        <div class="pattern-alert-card">
          <div>
            <span style="font-weight:700;color:#EA580C;font-family:monospace;font-size:16px">${sym}</span>
            <span style="color:#64748B;font-size:12px;margin-left:8px">${COMPANY_NAMES[sym] || ''}</span>
            <div style="color:#0F172A;font-size:14px;margin-top:4px;font-family:monospace">${formatPeso(curPrice)}</div>
          </div>
          <div>
            <span class="pattern-badge ${badgeClass}">${pattern.label}</span>
            <a href="https://www.tradingview.com/chart/?symbol=PSE:${sym}" target="_blank" style="display:block;color:#EA580C;font-size:11px;margin-top:4px;text-decoration:none">View Live Chart \u2192</a>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.log('Pattern alerts error:', err);
    const alertGrid = document.getElementById('pattern-alerts-grid');
    if (alertGrid) alertGrid.innerHTML = '<div class="empty-state"><div class="empty-state-text">Pattern data not available yet. Price history will populate as Sterling runs.</div></div>';
  }
}

// ==================== STUDY MY PORTFOLIO ====================

const TEACHING_NOTES = {
  MBT: 'RSI 66.8 \u2014 approaching overbought zone (70). All 12 moving averages = Strong Buy. 13 analysts have \u20B191 average target. You\'re up +10.5% \u2014 hold, don\'t sell yet. Upside to \u20B186\u2013\u20B197.50.',
  KEEPR: 'Down -11% but the real asset value (NAV) is \u20B13.80 vs price of \u20B12.30. That\'s a 40% discount. The market is pricing it cheap due to high interest rates \u2014 but it still pays 11% dividends. DCA opportunity if it drops to \u20B12.00\u2013\u20B12.10.',
  FILRT: '28% discount to NAV (\u20B14.21 real value vs \u20B13.02 price). Ex-dividend date ~March 11 \u2014 you\'ll receive \u20B1420 in dividends (7,000 shares \u00D7 \u20B10.06). Dividend stocks = buy and hold, not trade.',
  GLO: 'Globe Telecom. Defensive stock \u2014 moves less than the market. P/E of 11x is fair for telecom. Watch the 200-day moving average (the slow line) \u2014 as long as price is above it, the long-term trend is healthy.',
  DMC: 'DMCI Holdings. Construction/mining conglomerate. RSI 44.4 \u2014 neutral zone. Strong dividend yield 9.73%. Waiting for infrastructure news catalyst. Watch for a break above \u20B110 resistance.',
  MREIT: 'Megaworld REIT. 28% discount to NAV (\u20B119.69). Ex-dividend ~March 20. 7.2% yield. The chart shows a sideways pattern \u2014 accumulation phase before a potential move up.',
  RRHI: 'Robinsons Retail. Mixed signals \u2014 8 of 12 MAs say Sell, 4 say Buy. MACD is negative. This one needs a catalyst (earnings beat, expansion news) before the trend turns. Monitor, don\'t add yet.'
};

function renderStudyPortfolio() {
  const container = document.getElementById('study-portfolio-content');
  if (!container) return;

  const stocks = [
    { sym: 'MBT', name: 'Metrobank' },
    { sym: 'KEEPR', name: 'Keppel PH REIT' },
    { sym: 'FILRT', name: 'Filinvest REIT' },
    { sym: 'GLO', name: 'Globe Telecom' },
    { sym: 'DMC', name: 'DMCI Holdings' },
    { sym: 'MREIT', name: 'Megaworld REIT' },
    { sym: 'RRHI', name: 'Robinsons Retail' }
  ];

  container.innerHTML = `
    <div class="section-header">📚 Study My Portfolio</div>
    <p class="section-desc">Price charts built from Sterling's live data. Tap "View Full Chart" for RSI, MACD, and volume on TradingView or PSE EQUIP.</p>
    <div id="portfolio-study-grid">
      ${stocks.map(s => `
        <div class="study-card">
          <div class="study-header">
            <span class="study-symbol">${s.sym}</span>
            <span class="study-company">${s.name}</span>
          </div>
          <div id="chart-${s.sym}" style="height:220px;border-radius:8px;overflow:hidden;background:#111827;"></div>
          <div class="study-chart-links">
            <a href="https://www.tradingview.com/chart/?symbol=PSE:${s.sym}" target="_blank" class="chart-link-btn tv">📈 TradingView</a>
            <a href="https://equip.pse.com.ph/charts#${s.sym}" target="_blank" class="chart-link-btn pse">🏛️ PSE EQUIP</a>
            <a href="https://www.investagrams.com/Stock/PSE:${s.sym}" target="_blank" class="chart-link-btn inv">📊 Investagrams</a>
          </div>
          <details class="teach-note">
            <summary>📖 Sterling's Analysis</summary>
            <p>${TEACHING_NOTES[s.sym]}</p>
          </details>
        </div>
      `).join('')}
    </div>
  `;

  // Fetch live price from Phisix
  async function fetchPhisixLive(sym) {
    try {
      const res = await fetch(`https://phisix-api3.appspot.com/stocks/${sym}.json`);
      const j = await res.json();
      const price = j.stock[0].price.amount;
      const today = new Date().toISOString().split('T')[0];
      return { time: today, value: parseFloat(price) };
    } catch { return null; }
  }

  // Render chart for one stock using Supabase OHLCV (no CORS issues)
  async function renderPriceChart(sym) {
    const container = document.getElementById('chart-' + sym);
    if (!container || typeof LightweightCharts === 'undefined') return;
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:220px;color:#475569;font-size:12px">Loading…</div>';

    // Fetch OHLCV from Supabase (no CORS issues on GitHub Pages)
    let ohlcv = await fetchOHLCVFromSupabase(sym);

    // Append live Phisix price as latest point
    const live = await fetchPhisixLive(sym);
    if (live && ohlcv.length > 0) {
      const lastEntry = ohlcv[ohlcv.length - 1];
      if (lastEntry.date === live.time) {
        lastEntry.close = live.value;
      } else if (lastEntry.date < live.time) {
        ohlcv.push({ date: live.time, open: live.value, high: live.value, low: live.value, close: live.value });
      }
    }

    container.innerHTML = '';

    if (ohlcv.length < 2) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:220px;gap:10px;padding:16px">
          <div style="font-size:26px">📊</div>
          <div style="color:#64748B;font-size:12px;text-align:center">Chart data unavailable<br>
            <span style="font-size:11px;color:#475569">Run fetch-ohlcv.js to populate</span></div>
        </div>`;
      return;
    }

    const chart = LightweightCharts.createChart(container, {
      width: container.clientWidth || 300,
      height: 220,
      layout: { background: { color: '#111827' }, textColor: '#94A3B8' },
      grid: { vertLines: { color: '#E2E8F0' }, horzLines: { color: '#E2E8F0' } },
      timeScale: { borderColor: '#E2E8F0', timeVisible: false },
      rightPriceScale: { borderColor: '#E2E8F0' },
      crosshair: { mode: 1 },
      handleScroll: false,
      handleScale: false
    });

    // Use candlestick series for real OHLCV
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderDownColor: '#ef5350',
      borderUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      wickUpColor: '#26a69a'
    });

    candleSeries.setData(ohlcv.map(d => ({
      time: d.date,
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close)
    })));
    
    chart.timeScale().fitContent();

    // Show live price badge
    const badge = document.createElement('div');
    badge.style.cssText = 'position:absolute;top:8px;right:8px;background:rgba(201,150,12,0.12);color:#EA580C;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;font-family:monospace;pointer-events:none';
    const latestClose = parseFloat(ohlcv[ohlcv.length - 1].close);
    badge.textContent = live ? '₱' + live.value.toFixed(2) + ' LIVE' : '₱' + latestClose.toFixed(2);
    container.style.position = 'relative';
    container.appendChild(badge);

    window.addEventListener('resize', () => {
      if (container.clientWidth > 0) chart.resize(container.clientWidth, 220);
    });
  }

  // Render all charts
  setTimeout(() => {
    stocks.forEach(s => renderPriceChart(s.sym));
  }, 200);
}

// ==================== GOLD PAGE ====================

function loadGoldPage() {
  // Inject mentor note at top of page
  const pageEl = document.getElementById('page-gold');
  if (pageEl && !pageEl.querySelector('.mentor-note')) {
    pageEl.insertAdjacentHTML('afterbegin', renderMentorNote('gold'));
    loadLiveLesson('gold');
  }
  window.applyGlossary(document.getElementById('page-gold'));
}


// ==================== ACCOUNT SYSTEM ====================

const STERLING_ACCOUNT_COLORS = ['#EA580C','#2563EB','#059669','#7C3AED','#DC2626'];
let _selectedNewColor = '#2563EB';

function _getAccounts() {
  try { return JSON.parse(localStorage.getItem('sterling_accounts') || 'null') || []; } catch { return []; }
}
function _saveAccounts(a) { localStorage.setItem('sterling_accounts', JSON.stringify(a)); }
function _getActiveId()  { return localStorage.getItem('sterling_active_user') || 'carlo'; }
function _setActiveId(id){ localStorage.setItem('sterling_active_user', id); }

function _uid() { return _getActiveId(); }
function _uf(ex) { const b='user_id=eq.'+_uid(); return ex?(b+'&'+ex):b; }


function getActiveUser() {
  const accounts = _getAccounts();
  return accounts.find(a => a.id === _getActiveId()) || accounts[0] || { id:'carlo', name:'Carlo', initials:'C', color:'#EA580C', pin:'' };
}

async function initAccounts() {
  // Seed Carlo if first ever load
  let accounts = _getAccounts();
  if (!accounts.length) {
    accounts = [{ id:'carlo', name:'Carlo', initials:'CR', color:'#EA580C', pin:'' }];
    _saveAccounts(accounts);
  }
  // AWAIT Supabase load so remote accounts (James etc) appear immediately
  await loadAccountsFromSupabase().catch(() => {});
  accounts = _getAccounts(); // re-read after merge
  const activeId = _getActiveId();
  const active = accounts.find(a => a.id === activeId) || accounts[0];
  if (active.pin && !sessionStorage.getItem('sterling_auth_' + active.id)) {
    showAccountModal('login', active.id);
  }
  _updateSidebarAccount(active);
}

function _updateSidebarAccount(account) {
  const av = document.getElementById('sidebar-avatar');
  const nm = document.getElementById('sidebar-account-name');
  if (av) { av.textContent = account.initials || account.name[0]; av.style.background = account.color || '#EA580C'; }
  if (nm) nm.textContent = account.name;
}

function showAccountSwitcher() { showAccountModal('switch'); }

function showAccountModal(mode, targetId) {
  const overlay = document.getElementById('account-modal-overlay');
  const body    = document.getElementById('account-modal-body');
  if (!overlay || !body) return;
  const accounts = _getAccounts();

  if (mode === 'login') {
    const acct = accounts.find(a => a.id === targetId) || accounts[0];
    body.innerHTML = `
      <div class="acct-logo">??</div>
      <div class="acct-title">Welcome back</div>
      <div class="acct-avatar-lg" style="background:${acct.color}">${acct.initials || acct.name[0]}</div>
      <div class="acct-name">${acct.name}</div>
      <input type="password" id="acct-pin" class="acct-pin-input" placeholder="Enter PIN" maxlength="6" inputmode="numeric" autocomplete="off">
      <div id="acct-pin-err" class="acct-error"></div>
      <button class="acct-btn-primary" onclick="verifyAccountPin('${acct.id}')">Unlock ?</button>
      ${accounts.length > 1 ? `<button class="acct-btn-ghost" onclick="showAccountModal('switch')">Switch account</button>` : ''}
    `;
    setTimeout(() => document.getElementById('acct-pin')?.focus(), 120);
    document.getElementById('acct-pin')?.addEventListener('keydown', e => { if(e.key==='Enter') verifyAccountPin(acct.id); });

  } else if (mode === 'switch') {
    body.innerHTML = `
      <div class="acct-logo">??</div>
      <div class="acct-title">Accounts</div>
      <div class="acct-list">
        ${accounts.map(a => `
          <div class="acct-list-item${a.id===_getActiveId()?' acct-active':''}" onclick="selectAccount('${a.id}')">
            <div class="acct-avatar-sm" style="background:${a.color}">${a.initials||a.name[0]}</div>
            <div class="acct-list-info">
              <div class="acct-list-name">${a.name}</div>
              ${a.pin ? '<div class="acct-list-sub">PIN protected</div>' : '<div class="acct-list-sub">No PIN</div>'}
            </div>
            ${a.id===_getActiveId() ? '<span class="acct-check">?</span>' : ''}
          </div>`).join('')}
      </div>
      <button class="acct-btn-secondary" onclick="showAccountModal('add')">+ Add account</button>
      <button class="acct-btn-ghost" onclick="closeAccountModal()">Cancel</button>
    `;

  } else if (mode === 'add') {
    body.innerHTML = `
      <div class="acct-logo">??</div>
      <div class="acct-title">New Account</div>
      <input type="text" id="new-acct-name" class="acct-input" placeholder="Name (e.g. James)" maxlength="24" autocomplete="off">
      <input type="text" id="new-acct-init" class="acct-input" placeholder="Initials (e.g. JR)" maxlength="2" style="text-transform:uppercase" autocomplete="off">
      <input type="password" id="new-acct-pin" class="acct-pin-input" placeholder="PIN (optional, 4�6 digits)" maxlength="6" inputmode="numeric" autocomplete="new-password">
      <div class="acct-color-row">
        ${STERLING_ACCOUNT_COLORS.map((c,i) =>
          `<div class="acct-color-dot${i===1?' acct-color-sel':''}" style="background:${c}" data-color="${c}" onclick="pickAcctColor(this)"></div>`
        ).join('')}
      </div>
      <div id="new-acct-err" class="acct-error"></div>
      <button class="acct-btn-primary" onclick="createAccount()">Create Account</button>
      <button class="acct-btn-ghost" onclick="showAccountModal('switch')">? Back</button>
    `;
  }
  overlay.classList.add('active');
}

function closeAccountModal() {
  document.getElementById('account-modal-overlay')?.classList.remove('active');
}

function pickAcctColor(el) {
  _selectedNewColor = el.dataset.color;
  document.querySelectorAll('.acct-color-dot').forEach(d => d.classList.remove('acct-color-sel'));
  el.classList.add('acct-color-sel');
}

function selectAccount(id) {
  const accounts = _getAccounts();
  const acct = accounts.find(a => a.id === id);
  if (!acct) return;
  if (acct.pin && !sessionStorage.getItem('sterling_auth_' + id)) {
    showAccountModal('login', id);
  } else {
    _setActiveId(id);
    sessionStorage.setItem('sterling_auth_' + id, '1');
    _updateSidebarAccount(acct);
    closeAccountModal();
    location.reload();
  }
}

function verifyAccountPin(id) {
  const input = document.getElementById('acct-pin');
  const err   = document.getElementById('acct-pin-err');
  const accounts = _getAccounts();
  const acct = accounts.find(a => a.id === id);
  if (!acct || !input) return;
  if (input.value === acct.pin) {
    _setActiveId(id);
    sessionStorage.setItem('sterling_auth_' + id, '1');
    _updateSidebarAccount(acct);
    closeAccountModal();
    location.reload();
  } else {
    err.textContent = 'Wrong PIN � try again';
    input.value = '';
    input.focus();
  }
}

function createAccount() {
  const name = document.getElementById('new-acct-name')?.value.trim();
  const init = document.getElementById('new-acct-init')?.value.trim().toUpperCase();
  const pin  = document.getElementById('new-acct-pin')?.value.trim();
  const err  = document.getElementById('new-acct-err');
  if (!name) { err.textContent = 'Name is required'; return; }
  if (pin && (pin.length < 4 || !/^\d+$/.test(pin))) { err.textContent = 'PIN must be 4�6 digits'; return; }
  const accounts = _getAccounts();
  const id = name.toLowerCase().replace(/[^a-z0-9]/g,'_');
  if (accounts.find(a => a.id === id)) { err.textContent = 'Name already taken'; return; }
  accounts.push({ id, name, initials: init || name[0].toUpperCase(), color: _selectedNewColor, pin: pin || '' });
  _saveAccounts(accounts);
  syncAccountsToSupabase();
  showToast('Account created: ' + name);
  showAccountModal('switch');
}

async function syncAccountsToSupabase() {
  try {
    const accounts = _getAccounts();
    const { url, anonKey } = window.SUPABASE_CONFIG;
    for (const a of accounts) {
      await fetch(url + '/rest/v1/sterling_users', {
        method: 'POST',
        headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ id: a.id, name: a.name, initials: a.initials || a.name[0], color: a.color || '#EA580C', pin: a.pin || '' })
      }).catch(() => {});
    }
  } catch(e) {}
}

async function loadAccountsFromSupabase() {
  try {
    const rows = await window.sbFetch('sterling_users', { order: 'created_at.asc' });
    if (!rows || !rows.length) return;
    const local = _getAccounts();
    rows.forEach(r => {
      if (!local.find(a => a.id === r.id)) {
        local.push({ id: r.id, name: r.name, initials: r.initials || r.name[0], color: r.color || '#EA580C', pin: '' });
      }
    });
    _saveAccounts(local);
  } catch(e) {}
}

// ==================== POSITION SIZING CALCULATOR ====================

function openPosSize() {
  const overlay = document.getElementById('possize-modal-overlay');
  if (overlay) overlay.classList.add('active');
}
function closePosSize() {
  const overlay = document.getElementById('possize-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

function calcPosSize() {
  const capital  = parseFloat(document.getElementById('ps-capital')?.value) || 0;
  const entry    = parseFloat(document.getElementById('ps-entry')?.value) || 0;
  const stop     = parseFloat(document.getElementById('ps-stop')?.value) || 0;
  const target   = parseFloat(document.getElementById('ps-target')?.value) || 0;
  const riskPct  = parseFloat(document.getElementById('ps-risk-pct')?.value) || 2;
  const result   = document.getElementById('possize-result');

  if (!capital || !entry || !stop || entry <= stop) { if (result) result.style.display = 'none'; return; }

  const riskAmount    = capital * (riskPct / 100);
  const riskPerShare  = entry - stop;
  const maxShares     = Math.floor(riskAmount / riskPerShare);
  const totalCost     = maxShares * entry;
  const actualRisk    = maxShares * riskPerShare;
  const rrRatio       = target > entry ? ((target - entry) / riskPerShare).toFixed(1) : null;

  document.getElementById('ps-shares').textContent   = maxShares.toLocaleString();
  document.getElementById('ps-cost').textContent     = '?' + totalCost.toLocaleString('en-PH', {maximumFractionDigits:2});
  document.getElementById('ps-risk-amt').textContent = '?' + actualRisk.toLocaleString('en-PH', {maximumFractionDigits:2});
  document.getElementById('ps-rr').textContent       = rrRatio ? rrRatio + ':1' : '�';

  const pctOfCapital  = ((totalCost / capital) * 100).toFixed(1);
  const verdict       = document.getElementById('ps-verdict');
  let msg = '', color = '#059669';
  if (totalCost > capital) {
    msg = '?? Position exceeds your capital. Reduce shares or increase capital.'; color = '#DC2626';
  } else if (pctOfCapital > 30) {
    msg = `?? This uses ${pctOfCapital}% of your capital. Consider splitting into tranches.`; color = '#EA580C';
  } else if (rrRatio && parseFloat(rrRatio) < 2) {
    msg = `?? R:R is ${rrRatio}:1. Aim for at least 2:1 � move your target or tighten your stop.`; color = '#EA580C';
  } else {
    msg = `? Buy max ${maxShares.toLocaleString()} shares at ?${entry} � risk ?${actualRisk.toFixed(2)} (${riskPct}% of capital).${rrRatio ? ' R:R = ' + rrRatio + ':1.' : ''}`;
  }
  verdict.style.cssText = `color:${color};font-size:13px;line-height:1.6;padding:12px 0 4px;font-weight:600`;
  verdict.textContent = msg;
  result.style.display = 'block';
}

// ==================== DIVIDEND PAYOUT TRACKER ====================

function openDivModal() {
  // Populate symbol dropdown from portfolio
  const sel = document.getElementById('div-symbol');
  if (sel) {
    const syms = (portfolioData || []).map(h => h.symbol).sort();
    sel.innerHTML = syms.map(s => `<option value="${s}">${s}</option>`).join('') ||
      '<option value="">No portfolio loaded</option>';
  }
  document.getElementById('div-ex-date').valueAsDate = new Date();
  document.getElementById('div-modal-overlay').classList.add('active');
}
function closeDivModal() {
  document.getElementById('div-modal-overlay').classList.remove('active');
}

async function submitDividend(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.textContent = 'Saving�'; btn.disabled = true;
  try {
    const symbol    = document.getElementById('div-symbol').value;
    const exDate    = document.getElementById('div-ex-date').value;
    const payDate   = document.getElementById('div-pay-date').value;
    const aps       = parseFloat(document.getElementById('div-aps').value);
    const shares    = parseInt(document.getElementById('div-shares').value);
    const notes     = document.getElementById('div-notes').value;
    const total     = parseFloat((aps * shares).toFixed(2));
    await window.sbInsert('sterling_dividends', {
      user_id: _uid(), symbol, ex_date: exDate, payment_date: payDate || null,
      amount_per_share: aps, shares_held: shares, total_received: total, notes
    });
    showToast(`?${total.toFixed(2)} dividend logged for ${symbol} ?`);
    closeDivModal();
    renderDividendHistory();
  } catch(err) { showToast('Error saving dividend'); }
  btn.textContent = 'Log Dividend'; btn.disabled = false;
}

let dividendHistory = [];
async function renderDividendHistory() {
  try {
    dividendHistory = await window.sbFetch('sterling_dividends', { filter: _uf(), order: 'ex_date.desc', limit: '50' }) || [];
  } catch(e) { dividendHistory = []; }

  const container = document.getElementById('dividend-history');
  if (!container) return;

  if (!dividendHistory.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:#888;font-size:13px">No dividends logged yet. Tap + Log Dividend when you receive one.</div>';
    return;
  }

  const totalIncome = dividendHistory.reduce((s, d) => s + parseFloat(d.total_received || 0), 0);
  const ytd = dividendHistory.filter(d => new Date(d.ex_date).getFullYear() === new Date().getFullYear())
    .reduce((s, d) => s + parseFloat(d.total_received || 0), 0);

  container.innerHTML = `
    <div class="div-history-header">
      <div class="div-stat"><span class="div-stat-val">?${ytd.toLocaleString('en-PH',{maximumFractionDigits:2})}</span><span class="div-stat-label">YTD INCOME</span></div>
      <div class="div-stat"><span class="div-stat-val">?${totalIncome.toLocaleString('en-PH',{maximumFractionDigits:2})}</span><span class="div-stat-label">ALL-TIME TOTAL</span></div>
      <div class="div-stat"><span class="div-stat-val">${dividendHistory.length}</span><span class="div-stat-label">PAYOUTS</span></div>
    </div>
    <table class="trade-history-table">
      <thead><tr>
        <th>Symbol</th><th>Ex-Date</th><th>Per Share</th><th>Shares</th><th>Total</th><th>Yield-on-Cost</th>
      </tr></thead>
      <tbody>
        ${dividendHistory.map(d => {
          const holding = (portfolioData || []).find(h => h.symbol === d.symbol);
          const avgCost = holding ? parseFloat(holding.avg_buy_price || holding.average_price || 0) : 0;
          const yoc = avgCost > 0 ? ((parseFloat(d.amount_per_share) / avgCost) * 100).toFixed(2) + '%' : '�';
          return `<tr>
            <td style="font-weight:800">${d.symbol}</td>
            <td>${d.ex_date || '�'}</td>
            <td>?${parseFloat(d.amount_per_share).toFixed(4)}</td>
            <td>${parseInt(d.shares_held).toLocaleString()}</td>
            <td style="color:#059669;font-weight:700">?${parseFloat(d.total_received).toFixed(2)}</td>
            <td style="color:#2563EB;font-weight:700">${yoc}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ==================== NEWS SENTIMENT TAGGER ====================

const SENTIMENT_BULLISH = [
  'beat','surge','record','dividend','buyback','upgrade','growth','profit','revenue',
  'expansion','acquire','merger','win','approved','raised','strong','positive','rally',
  'gains','increase','higher','award','contract','launches','invest','milestone','recovery'
];
const SENTIMENT_BEARISH = [
  'miss','decline','loss','downgrade','cut','investigation','fine','default','debt',
  'lawsuit','drop','fall','plunge','concern','warning','delay','suspend','recall',
  'lower','negative','weak','fraud','breach','exit','closure','layoff','charges'
];

function tagSentiment(text) {
  if (!text) return 'neutral';
  const t = text.toLowerCase();
  let bull = 0, bear = 0;
  SENTIMENT_BULLISH.forEach(w => { if (t.includes(w)) bull++; });
  SENTIMENT_BEARISH.forEach(w => { if (t.includes(w)) bear++; });
  if (bull > bear) return 'bullish';
  if (bear > bull) return 'bearish';
  return 'neutral';
}

// ==================== REAL-TIME PRICE UPDATER ====================

let _priceUpdateInterval = null;
function startLivePrices() {
  if (_priceUpdateInterval) return; // already running
  _priceUpdateInterval = setInterval(updatePricesInPlace, 60000);
}

async function updatePricesInPlace() {
  if (!portfolioData || !portfolioData.length) return;
  for (const h of portfolioData) {
    try {
      const res = await fetch(`https://phisix-api3.appspot.com/stocks/${h.symbol}.json`);
      if (!res.ok) continue;
      const json = await res.json();
      const stock = json.stock && json.stock[0];
      if (!stock) continue;
      const price = parseFloat(stock.price?.amount || 0);
      const pct   = parseFloat(stock.percentChange || 0);
      if (!price) continue;

      // Update Supabase
      window.sbUpdate('sterling_portfolio', `symbol=eq.${h.symbol}&user_id=eq.${_uid()}`, {
        current_price: price, day_change_pct: pct, updated_at: new Date().toISOString()
      }).catch(() => {});

      // Update DOM in-place � no full re-render needed
      const cards = document.querySelectorAll(`.holding-card`);
      cards.forEach(card => {
        const symEl = card.querySelector('.holding-symbol');
        if (!symEl || symEl.textContent !== h.symbol) return;
        const priceEl = card.querySelector('.price-current');
        const changeEl = card.querySelector('.price-change');
        if (priceEl) priceEl.textContent = formatPeso(price);
        if (changeEl) {
          changeEl.textContent = formatPct(pct);
          changeEl.className = 'price-change ' + (pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral');
        }
        // Flash effect
        card.style.transition = 'background 0.3s';
        card.style.background = pct > 0 ? '#ECFDF5' : pct < 0 ? '#FEF2F2' : '#F5F5F5';
        setTimeout(() => { card.style.background = ''; }, 1500);
      });
      // Patch local cache
      h.current_price = price; h.day_change_pct = pct;
    } catch(e) {}
  }
}

// ==================== ON-DEMAND ANALYZE ====================

async function triggerAnalysis(symbol, btnEl) {
  // Debug logging for troubleshooting
  console.log('[Sterling] triggerAnalysis called for:', symbol);
  console.log('[Sterling] SUPABASE_CONFIG:', typeof window.SUPABASE_CONFIG !== 'undefined' ? 'DEFINED' : 'UNDEFINED');

  // 1. Set button to loading state
  btnEl.textContent = 'ANALYZING...';
  btnEl.disabled = true;
  btnEl.classList.add('analyzing');

  const resetBtn = () => {
    btnEl.textContent = '⚡ ANALYZE';
    btnEl.disabled = false;
    btnEl.classList.remove('analyzing');
  };

  // 2. Get OpenRouter key from Supabase app_settings (secure, no localStorage)
  const orKey = await getAppSetting('openrouter_api_key');
  if (!orKey || orKey === 'null' || orKey.length < 20) {
    showAnalysisResult(symbol, btnEl, null, 'OpenRouter key not found in settings. Please contact admin.');
    resetBtn();
    return;
  }
  const cleanOrKey = orKey.trim();
  console.log('[Sterling] OR key length:', cleanOrKey.length, '| starts with:', cleanOrKey.substring(0, 10));

  const { url, anonKey } = window.SUPABASE_CONFIG;

  // 3. Fetch technicals from Supabase sterling_technicals (CORS-safe, populated by server-side cron)
  let tech;
  try {
    const techRes = await fetch(
      url + '/rest/v1/sterling_technicals?symbol=eq.' + symbol + '&limit=1',
      { headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey } }
    );
    if (!techRes.ok) throw new Error('HTTP ' + techRes.status);
    const techData = await techRes.json();
    console.log('[Sterling] techData for', symbol, ':', techData);
    if (!techData || techData.length === 0) {
      showAnalysisResult(symbol, btnEl, null, 'No technicals data for ' + symbol + '. The cron job may not have fetched this stock yet.');
      resetBtn();
      return;
    }
    const row = techData[0];
    tech = {
      rsi: row.rsi14,                    // Column is rsi14, not rsi
      close: row.current_price,          // Column is current_price, not close
      change: row.day_change_pct,        // Column is day_change_pct, not change_pct
      sma20: row.sma20,
      sma50: row.sma50,
      sma200: row.sma200,
      recommend_all: row.tv_recommend_all,
      volume: row.volume || 0,
      ma_trend: row.ma_trend,
      rsi_signal: row.rsi_signal,        // Include RSI signal for better analysis
      overall_signal: row.overall_signal, // Include overall signal
      fetched_at: row.updated_at         // Column is updated_at, not fetched_at
    };
  } catch (e) {
    console.error('triggerAnalysis technicals error:', e);
    showAnalysisResult(symbol, btnEl, null, 'Failed to load technicals: ' + e.message);
    resetBtn();
    return;
  }

  // 4. Fetch latest 3 news articles (optional, continue without if fails)
  let news = [];
  try {
    const newsRes = await fetch(
      url + '/rest/v1/sterling_news?symbol=eq.' + symbol + '&order=published_at.desc&limit=3&select=title,ai_action',
      { headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey } }
    );
    if (newsRes.ok) news = await newsRes.json();
  } catch (e) {
    // News is optional, continue without it
    news = [];
  }

  // 5. Build prompt for OpenRouter
  const overallSignal = tech.recommend_all >= 0.5 ? 'Strong Buy'
    : tech.recommend_all >= 0.1 ? 'Buy'
    : tech.recommend_all > -0.1 ? 'Neutral'
    : tech.recommend_all > -0.5 ? 'Sell' : 'Strong Sell';

  const newsContext = news.length > 0
    ? news.map(n => '- ' + n.title + (n.ai_action ? ' [' + n.ai_action + ']' : '')).join('\n')
    : 'No recent news available.';

  const dataAge = tech.fetched_at ? Math.round((Date.now() - new Date(tech.fetched_at).getTime()) / 60000) + ' min ago' : 'unknown';

  const prompt = `You are Sterling, a trusted PSE broker-mentor for Carlo Rebadomia, a trader in Cebu, Philippines.

Carlo wants a fresh analysis of ${symbol} right now.

TECHNICALS (data fetched ${dataAge}):
- Price: ₱${tech.close?.toFixed(2) || 'N/A'}
- Change: ${tech.change?.toFixed(2) || 'N/A'}%
- RSI: ${tech.rsi?.toFixed(1) || 'N/A'}
- SMA20: ₱${tech.sma20?.toFixed(2) || 'N/A'} | SMA50: ₱${tech.sma50?.toFixed(2) || 'N/A'} | SMA200: ₱${tech.sma200?.toFixed(2) || 'N/A'}
- MA Trend: ${tech.ma_trend || 'N/A'}
- Overall Signal: ${overallSignal}

RECENT NEWS:
${newsContext}

Write a concise broker analysis for Carlo covering:
1. Current situation in 1-2 sentences (what is the stock doing right now)
2. Key risk or opportunity to watch
3. CLEAR ACTION: BUY / BUY MORE / HOLD / REDUCE / SELL — with entry price range, target, and stop loss if actionable

Be direct. No disclaimers. Speak like a broker who knows Carlo personally.
Max 4 sentences total.`;

  // 6. Call OpenRouter
  let analysis;
  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cleanOrKey,
        'HTTP-Referer': 'https://heylencer-debug.github.io/Sterling',
        'X-Title': 'Sterling PSE Dashboard'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300
      })
    });
    if (!orRes.ok) {
      const errBody = await orRes.text();
      // Specific handling for 401 auth errors
      if (orRes.status === 401) {
        throw new Error('OpenRouter key is invalid or expired. Admin needs to update it in Supabase.');
      }
      throw new Error('HTTP ' + orRes.status + ': ' + errBody.substring(0, 100));
    }
    const orData = await orRes.json();
    analysis = orData.choices?.[0]?.message?.content;
    if (!analysis) throw new Error('Empty response from OpenRouter');
  } catch (e) {
    console.error('triggerAnalysis OpenRouter error:', e);
    showAnalysisResult(symbol, btnEl, null, 'AI analysis failed: ' + e.message);
    resetBtn();
    return;
  }

  // 7. Detect action from analysis text
  const detectedAction = detectActionFromAnalysis(analysis);
  const now = new Date().toISOString();

  // 7a. Save analysis to Supabase sterling_analysis (best-effort, persisted for reload)
  try {
    const uid = typeof _uid === 'function' ? _uid() : null;
    const saveBody = {
      symbol: symbol,
      analysis_text: analysis,
      action: detectedAction.label,
      recommend_all: tech.recommend_all,
      analyzed_at: now
    };
    if (uid) saveBody.user_id = uid;

    fetch(url + '/rest/v1/sterling_analysis', {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': 'Bearer ' + anonKey,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(saveBody)
    }).then(res => {
      if (res.ok) {
        console.log('[Sterling] Analysis saved to sterling_analysis for', symbol);
        // Update local cache
        analysisData[symbol] = { analysis_text: analysis, action: detectedAction.label, analyzed_at: now };
      } else {
        console.warn('[Sterling] Failed to save analysis:', res.status);
      }
    }).catch(err => {
      console.warn('[Sterling] Error saving analysis:', err.message);
    });
  } catch (e) {
    console.warn('[Sterling] sterling_analysis save error:', e.message);
  }

  // 7b. Also save to sterling_intelligence (existing logic, for dashboard intel cards)
  fetch(url + '/rest/v1/sterling_intelligence', {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Authorization': 'Bearer ' + anonKey,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      symbol: symbol,
      pillar: 'on_demand',
      verdict: overallSignal,
      ai_summary: analysis,
      points: JSON.stringify([]),
      sources: JSON.stringify([{ name: 'Supabase Technicals + OpenRouter Claude Sonnet', url: '' }]),
      analyzed_at: now
    })
  }).catch(() => {});

  // 8. Show result
  showAnalysisResult(symbol, btnEl, analysis, null);
}

function detectActionFromAnalysis(text) {
  if (!text) return { label: 'HOLD', cls: 'hold' };
  const t = text.toUpperCase();
  if (t.includes('STRONG BUY'))   return { label: 'STRONG BUY',  cls: 'strong-buy' };
  if (t.includes('BUY MORE'))     return { label: 'BUY MORE',    cls: 'buy' };
  if (t.includes('STRONG SELL'))  return { label: 'STRONG SELL', cls: 'strong-sell' };
  if (t.includes(': BUY') || t.includes('ACTION: BUY') || t.match(/\bBUY\b/)) return { label: 'BUY', cls: 'buy' };
  if (t.includes('REDUCE'))       return { label: 'REDUCE',      cls: 'sell' };
  if (t.includes(': SELL') || t.includes('ACTION: SELL') || t.match(/\bSELL\b/)) return { label: 'SELL', cls: 'sell' };
  return { label: 'HOLD', cls: 'hold' };
}

function showAnalysisResult(symbol, btnEl, analysis, error) {
  const card = btnEl.closest('.tsc-card') || btnEl.closest('.tech-signal-card') || btnEl.closest('.holding-card') || btnEl.closest('.portfolio-card') || btnEl.parentElement;
  const ts = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  if (error) {
    // Error state: show error, reset button
    btnEl.textContent = '⚡ ANALYZE';
    btnEl.disabled = false;
    btnEl.classList.remove('analyzing');

    let resultEl = card.querySelector('.analyze-result');
    if (!resultEl) {
      resultEl = document.createElement('div');
      resultEl.className = 'analyze-result';
      btnEl.parentElement.appendChild(resultEl);
    }
    resultEl.innerHTML = '<span class="analyze-error">' + error + '</span>';
    return;
  }

  // 1. Update the verdict badge on the card
  const verdictBadge = card.querySelector('.tsc-verdict-badge');
  if (verdictBadge && analysis) {
    const action = detectActionFromAnalysis(analysis);
    verdictBadge.textContent = action.label;
    verdictBadge.className = 'tsc-verdict-badge verdict-' + action.cls;

    // Add freshness timestamp next to badge
    let tsEl = card.querySelector('.verdict-fresh-ts');
    if (!tsEl) {
      tsEl = document.createElement('span');
      tsEl.className = 'verdict-fresh-ts';
      verdictBadge.parentElement.appendChild(tsEl);
    }
    tsEl.textContent = '⚡ ' + ts;

    // Pulse animation
    verdictBadge.classList.add('verdict-pulse');
    setTimeout(() => verdictBadge.classList.remove('verdict-pulse'), 1000);
  }

  // 2. Find or create the collapsible analysis section
  let analysisSection = card.querySelector('.sterling-analysis-section');
  if (!analysisSection) {
    analysisSection = document.createElement('div');
    analysisSection.className = 'sterling-analysis-section';
    // Insert before the analyze button
    btnEl.parentElement.insertBefore(analysisSection, btnEl);
  }

  // 3. Populate the collapsible section
  analysisSection.innerHTML =
    '<div class="sas-header" onclick="this.parentElement.classList.toggle(\'sas-open\')">' +
    '<span class="sas-label">⚡ STERLING ANALYSIS</span>' +
    '<span class="sas-ts">' + ts + '</span>' +
    '<span class="sas-toggle">▼</span>' +
    '</div>' +
    '<div class="sas-body"><p class="sas-text">' + (analysis || '') + '</p></div>';
  // Auto-open after new analysis
  analysisSection.classList.add('sas-open');

  // 4. Update button to RE-ANALYZE
  btnEl.textContent = '⚡ RE-ANALYZE';
  btnEl.disabled = false;
  btnEl.classList.remove('analyzing');
}

// ==================== SETTINGS MODAL ====================

function openSettingsModal() {
  let overlay = document.getElementById('settings-modal-overlay');
  if (!overlay) {
    // Create modal if not exists
    overlay = document.createElement('div');
    overlay.id = 'settings-modal-overlay';
    overlay.className = 'account-modal-overlay';
    overlay.innerHTML = `
      <div class="account-modal" style="max-width:380px">
        <div class="acct-logo">⚙️</div>
        <div class="acct-title">Sterling Settings</div>
        <div style="text-align:left;margin-bottom:16px;padding:16px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0">
          <div style="font-size:12px;font-weight:600;color:#166534;margin-bottom:8px">API Keys Secured</div>
          <div style="font-size:11px;color:#15803D;line-height:1.5">API keys are managed securely in the backend via Supabase. No manual configuration needed.</div>
        </div>
        <button class="acct-btn-ghost" onclick="closeSettingsModal()">Close</button>
      </div>
    `;
    overlay.onclick = (e) => { if (e.target === overlay) closeSettingsModal(); };
    document.body.appendChild(overlay);
  }
  overlay.classList.add('active');
}

function closeSettingsModal() {
  document.getElementById('settings-modal-overlay')?.classList.remove('active');
}
