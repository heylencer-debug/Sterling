# STERLING — fetch-news.js FIX TASK (BMAD Dev Story)
> Agent: claude | Priority: URGENT
> File: C:\Users\Carl Rebadomia\.openclaw\workspace\sterling\fetch-news.js
> Push via: node push-file.js (in knightwatch) — NOT needed here, this is a backend script

---

## ROOT CAUSE ANALYSIS

The cron job for `fetch-news.js` times out (10-min cron limit) because:

1. **Per-call timeout is 45s** — `req.setTimeout(45000)` in `callGemini()`
2. **Two Grok calls per symbol** — one for news, one for ex-div date
3. **7+ symbols × 2 calls × 45s max = 630s potential = 10.5 minutes** — exceeds cron limit
4. **No overall script timeout** — if Grok hangs, process never exits
5. **No retry or skip logic** — one slow stock blocks all the rest

---

## FIXES REQUIRED

### Fix 1 — Reduce per-call timeout: 45s → 15s
In `callGemini()`, find:
```js
req.setTimeout(45000, () => { req.destroy(); resolve(null); });
```
Replace with:
```js
req.setTimeout(15000, () => { req.destroy(); resolve(null); });
```

### Fix 2 — Add per-symbol timeout wrapper (30s max per stock)
Replace the per-symbol block in `fetchNews()`:

Find:
```js
for (const symbol of symbols) {
  try {
    process.stdout.write(`  🔍 ${symbol}: Searching with Gemini...`);
    const articles = await fetchAndAnalyzeStock(symbol);
    ...
    // Fetch and store ex-dividend date
    const exDate = await fetchExDividendDate(symbol);
    ...
  } catch (e) {
    console.log(` ❌ ${e.message}`);
  }
  // Rate limit: ~2s between stocks
  await new Promise(r => setTimeout(r, 2000));
}
```

Replace with:
```js
for (const symbol of symbols) {
  const symbolTimer = Date.now();
  try {
    process.stdout.write(`  🔍 ${symbol}: fetching...`);

    // Wrap entire per-symbol work in a 30s timeout
    const result = await Promise.race([
      processSymbol(symbol),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SYMBOL_TIMEOUT')), 30000)
      )
    ]);

    if (result) {
      totalInserted += result.count;
      console.log(` ✅ ${result.count} articles — ${(Date.now() - symbolTimer)}ms`);
    }
  } catch (e) {
    if (e.message === 'SYMBOL_TIMEOUT') {
      console.log(` ⏱️ TIMEOUT (30s) — skipping ${symbol}`);
    } else {
      console.log(` ❌ ${e.message}`);
    }
  }

  // Rate limit: 1s between stocks
  await new Promise(r => setTimeout(r, 1000));
}
```

### Fix 3 — Extract processSymbol() helper function
Add this function before the `fetchNews()` function:

```js
async function processSymbol(symbol) {
  const articles = await fetchAndAnalyzeStock(symbol);

  if (articles.length === 0) {
    console.log(` ⚠️ No articles — skipping`);
    return { count: 0 };
  }

  await clearOldNews(symbol);
  for (const article of articles) {
    await insertNews(article);
  }
  process.stdout.write(` (news ok)`);

  // Ex-div: best-effort only, don't let it block
  try {
    const exDate = await Promise.race([
      fetchExDividendDate(symbol),
      new Promise(resolve => setTimeout(() => resolve(null), 12000))
    ]);
    if (exDate) {
      await updateExDivDate(symbol, exDate);
      process.stdout.write(` 📅 ${exDate}`);
    }
  } catch (e) {
    // ex-div failure is non-fatal
  }

  return { count: articles.length, headline: articles[0]?.headline };
}
```

### Fix 4 — Add overall script timeout (8 minutes hard limit)
At the TOP of the `fetchNews()` function, add:

```js
async function fetchNews() {
  // Hard stop after 8 minutes (cron limit is 10min)
  const scriptTimeout = setTimeout(() => {
    console.log('\n⏱️ HARD TIMEOUT — 8 min script limit reached. Exiting cleanly.');
    process.exit(0);
  }, 8 * 60 * 1000);

  // Ensure timeout doesn't keep process alive
  scriptTimeout.unref();

  const manilaStr = ...  // existing code continues
```

### Fix 5 — Add per-run timing log
At the end of `fetchNews()`, before the closing brace:
```js
const elapsed = Math.round((Date.now() - startTime) / 1000);
console.log(`\n⏱️ Total time: ${elapsed}s`);
clearTimeout(scriptTimeout);
```

And add `const startTime = Date.now();` right after `scriptTimeout.unref();`.

---

## ALSO FIX — log inconsistency

At the top of `fetchNews()`, find:
```js
console.log(`Model: ${MODEL} via OpenRouter\n`);
```
Replace with:
```js
console.log(`Model: grok-4-latest via xAI API\n`);
```
(The script actually calls api.x.ai directly with GROK_KEY, not OpenRouter)

---

## AFTER ALL FIXES

1. Test run:
```
node fetch-news.js
```
Expected: completes in under 3 minutes, shows timing per symbol, no hanging

2. No GitHub push needed — this is a backend script, not the dashboard

3. Notify Carlo:
```
node -e "require('child_process').spawnSync(process.execPath,['C:\\\\Users\\\\Carl Rebadomia\\\\AppData\\\\Roaming\\\\npm\\\\node_modules\\\\openclaw\\\\openclaw.mjs','system','event','--text','fetch-news.js fixed: per-call timeout 15s, per-symbol cap 30s, 8min hard limit. No more hanging cron jobs.','--mode','now'],{stdio:'inherit'})"
```

---

## IMPORTANT RULES
- Read fetch-news.js FULLY before editing
- Surgical edits only — do NOT rewrite the whole file
- PowerShell: no && — use workdir param or separate exec calls
- Do NOT change the Grok API key, Supabase keys, or model name
- After fixes, the script must remain runnable as: node fetch-news.js
