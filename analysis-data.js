// sterling/analysis-data.js
// Last updated: 2026-03-02
// Sources: Investing.com, HelloSafe PH, Asia Securities, PSE Edge

module.exports = {
  stocks: {
    MBT: {
      company: 'Metropolitan Bank & Trust Co',
      sector: 'Banking',
      currentPrice: 75.80,
      // TECHNICALS (from Investing.com, 2026-03-02)
      technical: {
        rsi14: 66.8,
        rsiSignal: 'Buy', // RSI 66.8 — approaching overbought but still Buy territory
        macd: 0.81,
        macdSignal: 'Buy',
        ma20: 75.31,
        ma50: 73.85,
        ma100: 72.97,
        ma200: 72.70,
        allMAsignal: 'Strong Buy', // ALL 12 moving averages say Buy
        overallSignal: 'Strong Buy',
        support1: 73.95,
        support2: 72.70, // 200-day MA = strong support
        resistance1: 76.57,
        resistance2: 78.00,
        // Pattern notes
        pattern: 'Trading ABOVE all moving averages (5, 10, 20, 50, 100, 200-day). This is textbook uptrend.'
      },
      // FUNDAMENTALS (from HelloSafe, Investing.com)
      fundamental: {
        pe: 6.86,
        sectorAvgPE: 11.0,
        dividendYield: 6.78,
        eps: 10.76,
        epsGrowthYoY: 18,
        roe: 12.5,
        bookValue: 68.50,
        priceToBook: 1.10,
        debtEquity: 0.85,
      },
      // ANALYST CONSENSUS
      analyst: {
        consensusRating: 'Strong Buy',
        numberOfAnalysts: 13,
        buyRatings: 8,
        targetPriceLow: 86.0,
        targetPriceAvg: 91.0,
        targetPriceHigh: 97.50,
        targetPrice2026End: 110.70,
        source: 'Investing.com consensus, HelloSafe PH',
        lastUpdated: '2026-03-02'
      },
      // STERLING'S RECOMMENDATION
      recommendation: {
        action: 'HOLD — Consider Adding on Dips',
        conviction: 'HIGH',
        rationale: `MBT is the strongest position in your portfolio right now.
ALL 13 moving averages say BUY. RSI at 66.8 — strong but not yet overbought.
You bought at P69.70, it's now P75.80 — you're up +8.75% (P6,930).
13 analysts have a consensus target of P91, with high target at P97.50.
That's +27% more upside from current price.
The stock is above all its moving averages and broke through its 200-day MA — that's a major bullish signal.
MBT's P/E is 6.86x vs banking sector average 11x — it's CHEAP relative to peers.
Dividend yield: 6.78% — you get paid while you wait for the price to rise.`,
        action_detail: `DO NOT take profit yet. This stock has room to run to P86-97.
HOLD all 1,100 shares. If it dips to P73-74 (near 50-day MA support), that's a BUY, not a panic.
Only consider partial profit-taking if it hits P86+ (first analyst target).
Stop-loss: P69 (below your buy price — shouldn't need it given the uptrend).`,
        entry_zone: 'P73-75 (add more)',
        stop_loss: 'P69.00',
        take_profit_1: 'P86.00 (first analyst target — sell 30%)',
        take_profit_2: 'P97.50 (full analyst target — sell remaining)'
      }
    },

    KEEPR: {
      company: 'Keppel Philippines Properties REIT',
      sector: 'REIT',
      currentPrice: 2.30,
      technical: {
        rsi14: 35, // estimated — near oversold
        rsiSignal: 'Weak / Near Oversold',
        macd: -0.02,
        macdSignal: 'Sell',
        ma20: 2.30,
        ma50: 2.45,
        ma100: 2.55,
        ma200: 2.60,
        allMAsignal: 'Sell', // price below 50-day MA
        overallSignal: 'Weak',
        support1: 2.20,
        support2: 2.10,
        resistance1: 2.50,
        resistance2: 2.70,
        pattern: 'Trading BELOW 50-day MA. Price has been grinding down. No reversal signal yet.'
      },
      fundamental: {
        pe: 12.5,
        sectorAvgPE: 14.0,
        dividendYield: 11.0, // HIGH yield — the main reason to hold
        nav: 3.80, // Net Asset Value per share
        discountToNav: 39.5, // trading at 40% discount to NAV
        occupancyRate: 94,
        distributableIncomeTrend: 'Stable',
      },
      analyst: {
        consensusRating: 'Long-Term Buy',
        targetPrice: 3.80, // NAV convergence target
        source: 'Asia Securities, DragonFi research',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD — Do Not Panic Sell',
        conviction: 'MEDIUM',
        rationale: `KEEPR is your worst performer at -11.54% but DO NOT SELL based on price alone.
Here's what actually matters: KEEPR's NAV (what the properties are actually worth) is P3.80 per share.
You're buying it at P2.30. That's a 40% DISCOUNT to its true value.
Dividend yield at current price: 11% annually. On 11,000 shares x dividend = ~P28,600/year in dividends.
Occupancy is 94% — the underlying business is healthy.
The price is down because of general market sentiment on REITs, NOT because KEEPR broke.
BSP is expected to cut rates in H2 2026 — when that happens, REIT prices typically RALLY.`,
        action_detail: `HOLD all 11,000 shares. Collect the dividends (11% yield is exceptional).
Do NOT average down yet — wait for RSI to drop below 30 (oversold) as a better entry signal.
The stock needs a catalyst (BSP rate cut, strong earnings) to move higher.
Stop-loss: P1.90 — if it breaks below this, then reassess the thesis.
Target: P3.00 (30% upside) then P3.80 (NAV convergence, 65% upside).`,
        entry_zone: 'Not now. Wait for RSI < 30 or rate cut news',
        stop_loss: 'P1.90 (thesis broken below this)',
        take_profit_1: 'P3.00',
        take_profit_2: 'P3.80 (NAV — 65% upside)'
      }
    },

    FILRT: {
      company: 'FilRealty REIT Corp',
      sector: 'REIT',
      currentPrice: 3.02,
      technical: {
        rsi14: 40,
        rsiSignal: 'Neutral / Slightly Weak',
        macd: 0.01,
        macdSignal: 'Neutral',
        ma20: 3.05,
        ma50: 3.10,
        ma100: 3.15,
        ma200: 3.20,
        allMAsignal: 'Neutral',
        overallSignal: 'Neutral',
        support1: 2.90,
        support2: 2.75,
        resistance1: 3.20,
        resistance2: 3.40,
        pattern: 'Flat/consolidating. No strong trend either way.'
      },
      fundamental: {
        pe: 10.5,
        sectorAvgPE: 14.0,
        dividendYield: 8.1,
        nav: 4.21,
        discountToNav: 28.3,
        nextExDate: '2026-03-11', // from PSE Edge
        dividendPerShare: 0.06,
        quarterlyDividend: true
      },
      analyst: {
        consensusRating: 'Long-Term Buy',
        targetPrice: 4.21,
        source: 'Asia Securities',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD — Dividend Coming',
        conviction: 'MEDIUM-HIGH',
        rationale: `FILRT is flat — you're down 4.43% in price but you're about to receive a dividend.
Ex-dividend date: approximately March 11, 2026.
At 7,000 shares x P0.06 dividend = P420 cash into your account.
Annual yield at current price: 8.1% — that's better than a bank time deposit.
Trading at 28% discount to NAV of P4.21 — long-term upside when market re-rates REITs.`,
        action_detail: `HOLD through the ex-dividend date (March 11). Do NOT sell before then — you'd forfeit P420.
After collecting the dividend, reassess.
If BSP cuts rates in H2 2026, target P3.50 (accumulation zone now).`,
        entry_zone: 'P2.80-3.00 (if it dips)',
        stop_loss: 'P2.60',
        take_profit_1: 'P3.50',
        take_profit_2: 'P4.21 (NAV convergence)'
      }
    },

    GLO: {
      company: 'Globe Telecom Inc',
      sector: 'Telecoms',
      currentPrice: 1689,
      technical: {
        rsi14: 45,
        rsiSignal: 'Neutral',
        macd: 5.2,
        macdSignal: 'Neutral',
        ma20: 1670,
        ma50: 1650,
        ma100: 1620,
        ma200: 1600,
        allMAsignal: 'Neutral-Bullish',
        overallSignal: 'Neutral-Bullish',
        support1: 1650,
        support2: 1600,
        resistance1: 1750,
        resistance2: 1850,
        pattern: 'Above 200-day MA (P1,600). Support at P1,650. Testing resistance at P1,750.'
      },
      fundamental: {
        pe: 11.0, // Verified: GF Value/Fintel (range 10.92-12.44x)
        sectorAvgPE: 15.0,
        dividendYield: 3.6,
        eps: 116.5,
        debtEquity: 2.1, // HIGH debt — telecom companies borrow heavily for infrastructure
        revenueGrowth: 4.2,
        arpu: 'stable'
      },
      analyst: {
        consensusRating: 'Hold / Accumulate',
        targetPrice: 1900,
        source: 'General analyst consensus',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD',
        conviction: 'MEDIUM',
        rationale: `GLO is your best % gainer at +2.05% P&L on a small position (only 10 shares).
It's above its 200-day MA — the long-term trend is intact.
Globe maintained 5G expansion and dividend guidance for 2026.
High debt is a concern (debt-to-equity 2.1x) but normal for telecoms — they borrow to build towers.
With only 10 shares, this is more of a dividend play for you.`,
        action_detail: `HOLD. Not worth adding significantly due to high share price per unit.
Focus on the annual dividend instead.
If it drops to P1,600-1,650 support zone, that's an add opportunity.`,
        entry_zone: 'P1,600-1,650 (add on dip)',
        stop_loss: 'P1,520',
        take_profit_1: 'P1,850',
        take_profit_2: 'P2,000'
      }
    },

    DMC: {
      company: 'DMCI Holdings Inc',
      sector: 'Holding/Mining/Construction',
      currentPrice: 9.65,
      technical: {
        rsi14: 42,
        rsiSignal: 'Neutral',
        macd: -0.05,
        macdSignal: 'Neutral-Weak',
        ma20: 9.70,
        ma50: 9.80,
        ma100: 9.90,
        ma200: 10.10,
        allMAsignal: 'Neutral-Weak',
        overallSignal: 'Neutral-Weak',
        support1: 9.20,
        support2: 8.80,
        resistance1: 10.00,
        resistance2: 10.50,
        pattern: 'Below 50-day MA. Needs close above P10 to show recovery.'
      },
      fundamental: {
        pe: 8.0, // Verified: HelloSafe PH / Simply Wall St (range 7.97-9.1x)
        sectorAvgPE: 10.0,
        dividendYield: 9.73, // Verified: HelloSafe PH
        eps: 1.29,
        roe: 15.2,
        businessSegments: ['Construction', 'Mining (Nickel)', 'Real Estate', 'Power', 'Water'],
        nickelPriceExposure: true, // DMC mines nickel — commodity price affects earnings
      },
      analyst: {
        consensusRating: 'Hold / Accumulate',
        targetPrice: 11.50,
        source: 'General consensus',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD — Watch Nickel Prices',
        conviction: 'MEDIUM',
        rationale: `DMC is down 4.17% from your buy price. The fundamentals are actually solid.
P/E of 7.5x is cheap. Dividend yield 8.5% is strong.
DMCI is a conglomerate — construction, nickel mining, real estate, power.
Key risk: nickel commodity price. If global nickel prices drop, DMC earnings get hurt.
Key catalyst: infrastructure spending in Philippines 2026 (BBM's Build Better More program).`,
        action_detail: `HOLD at current levels. The stock needs to close above P10 to show bullish momentum.
Watch nickel spot price on Trading Economics — that's the biggest swing factor for DMC.
If nickel prices rise + PSE sentiment improves, DMC can reach P11.50.`,
        entry_zone: 'P9.00-9.30 (add on dip)',
        stop_loss: 'P8.50',
        take_profit_1: 'P10.50',
        take_profit_2: 'P11.50'
      }
    },

    MREIT: {
      company: 'Megaworld REIT Inc',
      sector: 'REIT',
      currentPrice: 14.18,
      technical: {
        rsi14: 38,
        rsiSignal: 'Neutral-Weak',
        macd: -0.08,
        macdSignal: 'Neutral',
        ma20: 14.20,
        ma50: 14.50,
        ma100: 14.80,
        ma200: 15.10,
        allMAsignal: 'Neutral',
        overallSignal: 'Neutral',
        support1: 13.50,
        support2: 13.00,
        resistance1: 15.00,
        resistance2: 16.00,
        pattern: 'Near 20-day MA. Flat/consolidating. Needs catalyst to move.'
      },
      fundamental: {
        pe: 11.8,
        sectorAvgPE: 14.0,
        dividendYield: 7.2,
        nav: 19.69,
        discountToNav: 28.0,
        nextExDate: '2026-03-20',
        occupancyFocus: 'Office properties in BGC, Eastwood, Iloilo, Davao',
      },
      analyst: {
        consensusRating: 'Buy',
        targetPrice: 17.50,
        source: 'Asia Securities',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD — Income Play',
        conviction: 'MEDIUM-HIGH',
        rationale: `MREIT is essentially flat — you're up only P0 in P&L but collecting 7.2% dividend.
Ex-dividend approximately March 20. Hold through that date.
NAV is P19.69 — you're buying P19.69 worth of real estate for P14.18. That's a 28% discount.
Megaworld is expanding into Iloilo and Davao CBDs — new properties = higher income = higher dividends.`,
        action_detail: `HOLD for income. Dividend yield 7.2% beats inflation.
Target: P17.50 when market re-rates REITs (rate cut catalyst).
Add more at P13.50 if it dips.`,
        entry_zone: 'P13.50 (add on dip)',
        stop_loss: 'P12.50',
        take_profit_1: 'P17.50',
        take_profit_2: 'P19.69 (NAV)'
      }
    },

    RRHI: {
      company: 'Robinsons Retail Holdings Inc',
      sector: 'Retail',
      currentPrice: 37.20,
      technical: {
        rsi14: 44,
        rsiSignal: 'Neutral',
        macd: 0.12,
        macdSignal: 'Neutral',
        ma20: 37.47,
        ma50: 37.80,
        ma100: 38.20,
        ma200: 38.50,
        allMAsignal: 'Neutral',
        overallSignal: 'Neutral',
        support1: 35.50,
        support2: 34.00,
        resistance1: 40.00,
        resistance2: 42.00,
        pattern: 'Trading near 20-day MA. Flat.'
      },
      fundamental: {
        pe: 18.5,
        sectorAvgPE: 16.0,
        dividendYield: 3.6,
        eps: 2.01,
        sameStoreSalesGrowth: 3.2,
        consumerSpendingRisk: 'Moderate — food inflation denting retail spending',
      },
      analyst: {
        consensusRating: 'Hold',
        targetPrice: 42.00,
        source: 'General consensus',
        lastUpdated: '2026-03-02'
      },
      recommendation: {
        action: 'HOLD',
        conviction: 'MEDIUM',
        rationale: `RRHI is slightly up (+2.25%) for you. The business is sound but retail faces headwinds.
Same-store sales growth of 3.2% is below analyst estimates of 4%.
Philippine consumer spending is slowing slightly due to food inflation.
The stock has a higher P/E (18.5x) than your other holdings — meaning you're paying more per peso of earnings.
It's not a great buy at this level, but it's stable enough to hold.`,
        action_detail: `HOLD your 500 shares. This is a defensive position.
Don't add more at current P/E levels — there are better-value stocks (MBT, DMC).
If it dips to P35 support, then consider adding.`,
        entry_zone: 'P35.00-36.00 (add on dip)',
        stop_loss: 'P33.00',
        take_profit_1: 'P40.00',
        take_profit_2: 'P42.00'
      }
    }
  },

  // DISCOVERY PICKS WITH REAL ANALYSIS
  watchlistAnalysis: {
    BDO: {
      company: 'BDO Unibank Inc',
      sector: 'Banking',
      currentPrice: 134.50,
      pe: 9.2,
      sectorAvgPE: 11.0,
      dividendYield: 3.8,
      rsi: 48,
      overallSignal: 'Accumulate',
      targetBuy: 127.78,
      stopLoss: 118.00,
      target1: 150.00,
      target2: 165.00,
      reason: `BDO is the Philippines' largest bank by assets. P/E of 9.2x vs sector avg 11x = 16% cheaper than peers. Strong loan growth, expanding digital banking. RSI neutral. Good entry on dips below P130.`
    },
    SCC: {
      company: 'Semirara Mining and Power Corp',
      sector: 'Mining/Energy',
      currentPrice: 27.60,
      pe: 4.5,
      dividendYield: 12.5, // one of highest yielders on PSE
      rsi: 45,
      overallSignal: 'Accumulate',
      targetBuy: 26.22,
      stopLoss: 23.00,
      target1: 32.00,
      target2: 38.00,
      reason: `SCC has PE of 4.5x — extremely cheap. Dividend yield of 12.5% is one of the highest on PSE. Semirara is the Philippines' primary domestic coal producer + power generation. Commodity stock — tied to coal prices.`
    }
  },

  // RESOURCE DIRECTORY
  resources: {
    technical: [
      { name: 'Investing.com PSE Technical', url: 'https://www.investing.com/equities/{symbol}-technical', description: 'RSI, MACD, Moving Averages, pivot levels for any PSE stock' },
      { name: 'TradingView PSE', url: 'https://www.tradingview.com/symbols/PSE-{SYMBOL}/technicals/', description: 'Interactive charts, indicators, community analysis' },
      { name: 'PSE EQUIP', url: 'https://equip.pse.com.ph', description: 'Official PSE charting with Refinitiv fundamentals, free' },
      { name: 'Investagrams', url: 'https://www.investagrams.com/Stock/{SYMBOL}', description: 'PH trading community, chart patterns, technical ideas' },
    ],
    fundamental: [
      { name: 'PSE Edge', url: 'https://edge.pse.com.ph', description: 'Official disclosures: earnings, dividends, material info' },
      { name: 'HelloSafe PH', url: 'https://hellosafe.ph/investing/stock-market/stocks/{slug}', description: 'Analyst targets, PE, EPS, fundamentals aggregated' },
      { name: 'Simply Wall St', url: 'https://simplywall.st/stocks/ph', description: 'Visual fundamental analysis, fair value snowflake chart' },
      { name: 'DragonFi', url: 'https://www.dragonfi.ph/market/stocks/{SYMBOL}', description: 'Your own broker — real-time data + research' },
    ],
    news: [
      { name: 'BusinessWorld', url: 'https://www.bworldonline.com', description: 'PH financial newspaper of record' },
      { name: 'Inquirer Business', url: 'https://business.inquirer.net', description: 'Business and markets news' },
      { name: 'Trading Economics PH', url: 'https://tradingeconomics.com/philippines/stock-market', description: 'PSEi forecast, macro data, BSP policy' },
    ],
    learning: [
      { name: 'PSE Academy', url: 'https://www.pseacademy.com.ph', description: 'Official PSE learning platform — free courses' },
      { name: 'r/phinvest', url: 'https://www.reddit.com/r/phinvest/', description: 'Philippine investing community, real discussions' },
      { name: 'r/phstock', url: 'https://www.reddit.com/r/phstock/', description: 'PSE-specific stock discussions' },
    ]
  },

  // Slugs for URL building
  slugs: {
    MBT: 'metropolitan-b',
    BDO: 'bdo-unibank',
    GLO: 'globe-telecom',
    DMC: 'dmci-holdings',
    RRHI: 'robinsons-retail-holdings',
    FILRT: 'filinvest-reit-corp',
    KEEPR: 'keppel-philippines-properties',
    MREIT: 'megaworld-reit',
    SCC: 'semirara-mining-and-power'
  }
};

