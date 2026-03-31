#!/usr/bin/env node
/**
 * Sterling — Unified Daily Analysis Runner
 *
 * Usage:
 *   node run-analysis.js pre-market    — before 9:30AM: technicals + AI morning brief
 *   node run-analysis.js midday        — 12:00PM lunch: prices + technicals + intelligence + full analysis
 *   node run-analysis.js eod           — after 3:30PM: full pipeline + EOD report
 *   node run-analysis.js all           — run everything (same as EOD but also includes morning analysis)
 *
 * Each session runs the right scripts in sequence. Results are printed to console
 * and (for morning/EOD) sent to Telegram.
 */

const { execSync } = require('child_process');
const path = require('path');

const DIR = __dirname;
const NODE = process.execPath;

const SESSIONS = {
  'pre-market': {
    label: 'Pre-Market Analysis (before 9:30AM)',
    steps: [
      { script: 'fetch-technicals-tv.js', desc: 'Fetch TradingView technicals' },
      { script: 'morning-analysis.js',    desc: 'AI morning brief + Telegram' },
    ]
  },
  midday: {
    label: 'Mid-Day Analysis (12:00PM)',
    steps: [
      { script: 'fetch-prices.js',        desc: 'Refresh live prices' },
      { script: 'fetch-technicals-tv.js',  desc: 'Update technicals' },
      { script: 'technicals-updater.js',   desc: 'Calculate RSI/MACD from OHLCV' },
      { script: 'refresh-intelligence.js', desc: 'Refresh intelligence signals' },
      { script: 'full-analysis.js',        desc: 'Full analysis (all symbols)', args: ['ALL'] },
    ]
  },
  eod: {
    label: 'End-of-Day Analysis (after 3:30PM)',
    steps: [
      { script: 'fetch-prices.js',         desc: 'Final closing prices' },
      { script: 'fetch-ohlcv.js',          desc: 'Update OHLCV candles' },
      { script: 'fetch-technicals-tv.js',  desc: 'End-of-day technicals' },
      { script: 'technicals-updater.js',   desc: 'Final RSI/MACD' },
      { script: 'fetch-news.js',           desc: 'Fetch latest news' },
      { script: 'refresh-intelligence.js', desc: 'Refresh intelligence signals' },
      { script: 'full-analysis.js',        desc: 'Full analysis (all symbols)', args: ['ALL'] },
      { script: 'eod-report.js',           desc: 'EOD report + Telegram' },
    ]
  },
  all: {
    label: 'Full Pipeline (all scripts)',
    steps: [
      { script: 'fetch-prices.js',         desc: 'Refresh live prices' },
      { script: 'fetch-ohlcv.js',          desc: 'Update OHLCV candles' },
      { script: 'fetch-technicals-tv.js',  desc: 'Fetch TradingView technicals' },
      { script: 'technicals-updater.js',   desc: 'Calculate RSI/MACD from OHLCV' },
      { script: 'fetch-news.js',           desc: 'Fetch latest news' },
      { script: 'refresh-intelligence.js', desc: 'Refresh intelligence signals' },
      { script: 'morning-analysis.js',     desc: 'AI morning brief + Telegram' },
      { script: 'full-analysis.js',        desc: 'Full analysis (all symbols)', args: ['ALL'] },
      { script: 'eod-report.js',           desc: 'EOD report + Telegram' },
    ]
  }
};

// ── Main ─────────────────────────────────────────────────────────────────────

const session = (process.argv[2] || '').toLowerCase();

if (!SESSIONS[session]) {
  console.log(`
Sterling — Daily Analysis Runner

Usage:
  node run-analysis.js <session>

Sessions:
  pre-market   Before 9:30AM — technicals + AI morning brief
  midday       12:00PM       — prices + technicals + intelligence + full analysis
  eod          After 3:30PM  — full pipeline + EOD report + Telegram
  all          Run everything
`);
  process.exit(0);
}

const { label, steps } = SESSIONS[session];

console.log(`\n${'═'.repeat(60)}`);
console.log(`  STERLING — ${label}`);
console.log(`  ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'full', timeStyle: 'short' })}`);
console.log(`${'═'.repeat(60)}\n`);

let passed = 0, failed = 0;

for (let i = 0; i < steps.length; i++) {
  const { script, desc, args } = steps[i];
  const num = `[${i + 1}/${steps.length}]`;
  console.log(`${num} ${desc} (${script})...`);

  try {
    const argsStr = args ? ' ' + args.join(' ') : '';
    execSync(`"${NODE}" "${path.join(DIR, script)}"${argsStr}`, {
      cwd: DIR,
      stdio: 'inherit',
      timeout: 10 * 60 * 1000, // 10 min per script
      env: { ...process.env }
    });
    console.log(`${num} DONE\n`);
    passed++;
  } catch (err) {
    console.error(`${num} FAILED — ${err.message}\n`);
    failed++;
    // Continue to next step; don't abort the whole pipeline
  }
}

console.log(`${'═'.repeat(60)}`);
console.log(`  COMPLETE: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
