# Learnings — Rate Validation & Provider Fixes (2026-05-16)

## Market Rate Validation (2026-05-16)

### Bounds Checking Works But Tolerance Matters

The previous bounds checks (`exchangeRate > 0.001 && exchangeRate < 1000000`) were far too loose — they let through rates like USD→NGN = 0.24 (should be ~1550) or USD→NGN = 37699 (should be ~1550).

New validation uses per-pair mid-market rates with 15% tolerance (25% for volatile NGN pairs). This catches:
- 100x–1,000,000x scaling errors (Remitly)
- Scrambled rates across pairs (Ria)
- Wrong currency rates appearing (Taptap Send USD→* returning AED rate of 17.25)
- Below-market rates (TransferGo NGN at 376 instead of 1596)

### Suspect vs Invalid Distinction

Three-tier validation:
- **valid**: within tolerance → pass through
- **suspect**: within 2× tolerance → retry once, flag if still suspect
- **invalid**: beyond 2× tolerance or sanity check failure → null out the rate

Sanity checks catch: rate equals sendAmount (common parsing bug), rate=1 for different currencies, NGN rates below 100 (order of magnitude), negative rates, non-finite numbers.

### Cross-Provider Comparison Useful on --all Runs

After all providers complete, calculate median rate per pair and flag outliers > 20% from median. This catches cases where a single provider is an outlier even if within tolerance.

---

## Ria Deep Dive (2026-05-16)

### Problem: 40 scrambled rates across pairs

**Root cause**: React state race condition. The `.result` element was being read before the rate updated to the new currency pair.

**Fix**: Wait for `.result` text to include BOTH send AND receive currency before extracting. Read via `page.evaluate()` for live DOM values instead of cheerio `attr('value')` which reads stale HTML attributes. Added 1s render delay.

**Result**: 41/42 success, 0 scrambled rates. Only PLN→GHS failed (3.13 vs expected ~3.8).

### CMP Overlay Issue After Page Reload

After `page.reload()`, the `#cmpwrapper` CMP overlay reappeared but wasn't dismissed, causing all subsequent currency selection clicks to fail with "intercepts pointer events". Adding CMP dismiss before each currency selection click fixed this.

---

## Remitly Deep Dive (2026-05-16)

### Problem: 14 scaling errors (100x–1,000,000x too high)

**Root cause**: The body text regex fallback matched promotional text and fee information, not the actual exchange rate. The "Special rate" div contained multiple numbers and the regex grabbed the wrong one.

**Fix**: Tightened regex to only match `1 SEND = X` pattern (first number after `= `). Added receive-amount confirmation step ("They receive" section) and compare — if both rates agree, use that; if they disagree wildly, use the one closer to market bounds. Added order-of-magnitude validation against market reference. Removed body text fallback entirely.

**Result**: 28 valid, 6 suspect, 0 invalid. No more scaling errors. 15 nulls are unsupported corridors (mostly PLN send).

---

## TransferGo Deep Dive (2026-05-16)

### Problem: Rates 70-94% below market for NGN/INR

**Root cause**: `#cmpwrapper` CMP overlay loads asynchronously after `domcontentloaded`. The provider dismissed it once at page load, but it reappeared on subsequent interactions and intercepted clicks on the currency selection buttons. The `page.reload()` on retry made this worse — page navigated away from the converter.

**Fix**: Dismiss `#cmpwrapper` immediately before each currency selection click, not just at page load. Removed page reload on retry — instead just `reset()` the tracking state and let `fetchRate` re-navigate if needed. Added URL check (`page.url().includes('currency-converter')`) to force fresh navigation.

**Result**: 5/5 success, 4 valid, 1 suspect. All rates within market bounds.

### Page Reload Breaks Stateful Provider

`page.reload()` after suspect rate detection was destroying the provider's page state. The provider tracks `currentPage` and `currentSendCurrency` at module level, but after reload the page is back to defaults while the tracking variables still think the right currency is selected. The `reset()` function clears these vars, forcing re-navigation.

---

## Taptap Send Deep Dive (2026-05-16 → 2026-05-17)

### Problem: 40/49 pairs failing with same rate (rate=17.25 for all pairs)

**Root cause 1**: Original code used `page.selectOption()` but the first attempted fix replaced it with `opt.click()` via `page.evaluate()`. Direct `<option>.click()` doesn't trigger Webflow's custom select change handling.

**Root cause 2**: The fix using `page.evaluate()` had a template literal bug: `` document.querySelectorAll(`${selectId} option`) `` — the `${selectId}` template literal was evaluated in the browser context (where `selectId` is undefined), not the Node.js context. Playwright stringifies the evaluate function, so JS template literals inside it don't have access to outer function variables. Must pass as an object argument instead.

**Root cause 3**: Select options load asynchronously after `domcontentloaded`. On initial page load, `#origin-currency` exists but has 0 options. Must wait for `sel.options.length > 5` before attempting selection.

**Fix**: Use `page.selectOption(selectId, optionValue)` where `optionValue` is found via `page.evaluate()` with object argument `{ selector, code }`. Wait for select options to populate after page load.

**Result**: 46/49 success (37 valid, 9 suspect, 3 null). The 3 nulls are legitimate:
- AED→GHS (rate=3, sanity check: GHS rate too low)
- PLN→GHS (rate=3.11, sanity check: GHS rate too low)
- CAD→NGN (rate=1000, sanity check: rate equals sendAmount)

---

## Sendwave Deep Dive (2026-05-16)

### Problem: 24 null rates for CAD/EUR send corridors

**Root cause**: The select button on Sendwave shows the currency code (e.g. "EUR"), not the country name (e.g. "Germany"). The verification check `btnText.includes(countryName)` always failed because we were looking for "Germany" in a button that says "EUR".

**Fix**: Map country name back to currency code and verify `btnText.includes(currencyCode)` instead. Also increased MUI Autocomplete wait times (500ms → 1000ms) for drawer open and results render.

**Result**: 25/28 success. Down from 24 nulls to 3 nulls.

---

## Panda Remit Deep Dive (2026-05-16)

### Problem: 33 null rates across multiple corridors

**Root cause**: The `COUNTRY_MAP` in `panda-remit.js` was missing several corridors that Panda Remit actually supports:
- USD→GHS and USD→PKR (supported but not in map)
- Also had EUR→PKR in the map but Panda doesn't actually support it (shows "0 PKR")

**Fix**: Added USD→GHS and USD→PKR to the map. Removed EUR→PKR (returns 0 on site).

**Result**: 17/25 success. 8 nulls are genuinely unsupported pairs.

### Unsupported Pairs Should Be Removed from Provider.csv

Pairs that return null because Panda Remit doesn't support them (AUD/GHS, AUD/MXN, CAD/GHS, CAD/PKR, EUR/MXN, EUR/PKR, GBP/MXN, GBP/PKR) should be removed from Provider.csv or the provider should have a `discoverSupportedPairs` function to pre-filter.

---

## Scraper Engine Changes (2026-05-16)

### Provider-Specific maxAttempts

MoneyGram now exports `maxAttempts: 3` (default is 2). The scraper reads this value per-provider.

### MoneyGram 10s Backoff

MoneyGram uses DataDome bot detection. The retry backoff was changed from 5s to 10s specifically for MoneyGram to avoid triggering rate limits.

### Removed Page Reload on Suspect Retry

Original code did `page.reload()` before retry, which broke stateful providers. Now just calls `provider.reset()` and lets the provider's `fetchRate` re-navigate if needed.

### --strict CLI Flag

Rejects suspect rates (sets to null) instead of flagging them. Useful for production runs where you want only high-confidence rates.

---

## Output Changes (2026-05-16)

### Validation Fields in CSV/NDJSON

Added columns: `validationStatus`, `deviationFromMid`, `boundsMin`, `boundsMax`. These are empty for null/failed records.

### Validation Report

`output/validation-report.json` contains:
- `totalRates`, `validRates`, `suspectRates`, `invalidRates`, `nullRates`
- `byProvider`: per-provider breakdown
- `anomalies`: list of all suspect/invalid records with deviation details
- `crossProvider`: cross-provider comparison with median rates

---

_Last Updated: 2026-05-17_
