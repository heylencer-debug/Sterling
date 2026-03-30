/**
 * Sterling — Dynamic Lesson Generator
 * Generates fresh, context-aware trading lessons for each page
 * Runs hourly via cron, saves to sterling_lessons table
 * App fetches latest lesson from Supabase on every load
 */

const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const PAGES = [
  {
    page: 'portfolio',
    icon: '💼',
    context: 'User is looking at their stock portfolio with unrealized gains/losses, current prices, and signals.'
  },
  {
    page: 'watchlist',
    icon: '👁️',
    context: 'User is monitoring stocks they want to buy but have not yet. Focus on entry timing and patience.'
  },
  {
    page: 'news',
    icon: '📰',
    context: 'User is reading market news. Teach them how to filter signal from noise in financial media.'
  },
  {
    page: 'alerts',
    icon: '🔔',
    context: 'User is managing price alerts. Teach them about decision triggers and not reacting emotionally.'
  },
  {
    page: 'discovery',
    icon: '🔍',
    context: 'User is screening PSE stocks. Teach them about stock selection criteria and fundamental filters.'
  },
  {
    page: 'dividends',
    icon: '💰',
    context: 'User is tracking dividend income. Teach them about yield-on-cost, ex-dates, and compounding income.'
  },
  {
    page: 'gold',
    icon: '🪙',
    context: 'User is tracking gold trades (XAU/USD, XAU/PHP). Teach them about safe haven assets and macro correlation.'
  },
  {
    page: 'brief',
    icon: '📊',
    context: 'User is reading the morning market brief. Teach them about pre-market preparation and mental readiness.'
  },
];

// Get current market context from Supabase
async function getMarketContext() {
  return new Promise((resolve) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/sterling_technicals?select=symbol,rsi,signal,price&order=updated_at.desc&limit=7`);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch { resolve([]); }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// Generate a lesson using OpenRouter (fast model)
async function generateLesson(pageConfig, marketContext) {
  const techSummary = Array.isArray(marketContext) && marketContext.length > 0
    ? marketContext.map(t => `${t.symbol}: RSI ${t.rsi || 'N/A'}, Signal ${t.signal || 'N/A'}`).join(', ')
    : 'PSE market — general trading day';

  const prompt = `You are Sterling, a PSE stock trading mentor for Filipino retail investors.

Current market snapshot: ${techSummary}

Generate ONE short, punchy trading lesson for a user currently viewing their ${pageConfig.page} page.
Context: ${pageConfig.context}

Requirements:
- Title: 8-12 words, start with "Today's Lesson:" 
- Body: 2-3 sentences max. Plain English. No jargon without explanation.
- Must be actionable — end with something the user can DO or NOTICE today
- Make it relevant to Philippine stocks (PSE) when possible
- Tone: confident mentor, not academic

Respond ONLY in this JSON format (no markdown, no extra text):
{"title": "Today's Lesson: ...", "body": "...", "topic": "one-word topic like RSI/Dividends/Patience/etc"}`;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });

    const req = https.request({
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://heylencer-debug.github.io/Sterling',
        'X-Title': 'Sterling PSE Dashboard',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          const text = json.choices?.[0]?.message?.content || '';
          // Strip markdown code fences if present
          const cleaned = text.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
          const lesson = JSON.parse(cleaned);
          resolve(lesson);
        } catch (e) {
          // Fallback lesson if AI fails
          resolve({
            title: `Today's Lesson: The Market Rewards Patience`,
            body: `Most retail investors lose money by trading too often. The best PSE traders check their portfolio daily but only act on strong signals. Today, resist the urge to react to every price move.`,
            topic: 'Patience'
          });
        }
      });
    });
    req.on('error', () => resolve({
      title: `Today's Lesson: Read the Trend, Not the Tick`,
      body: `A single price movement means nothing. A series of higher highs and higher lows is a trend. Before acting on any signal, zoom out to the weekly chart and ask: what is the broader direction?`,
      topic: 'Trend'
    }));
    req.write(body);
    req.end();
  });
}

// Save lesson to Supabase
async function saveLesson(pageConfig, lesson) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      page: pageConfig.page,
      lesson_title: lesson.title,
      lesson_body: lesson.body,
      lesson_icon: pageConfig.icon,
      topic: lesson.topic,
      user_id: 'carlo',
    });

    const req = https.request({
      hostname: new URL(SUPABASE_URL).hostname,
      path: '/rest/v1/sterling_lessons',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('[Sterling] 📚 Generating fresh lessons for all pages...');
  const marketContext = await getMarketContext();
  console.log(`[Sterling] Market context loaded: ${marketContext.length} symbols`);

  for (const pageConfig of PAGES) {
    try {
      const lesson = await generateLesson(pageConfig, marketContext);
      const saved = await saveLesson(pageConfig, lesson);
      console.log(`[Sterling] ✅ ${pageConfig.page}: "${lesson.title}" (${saved.status || 'saved'})`);
    } catch (e) {
      console.error(`[Sterling] ❌ ${pageConfig.page}: ${e.message}`);
    }
  }
  console.log('[Sterling] 📚 All lessons generated.');
}

run().catch(console.error);
