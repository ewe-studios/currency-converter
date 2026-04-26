# Learnings

## Provider Research (2026-04-25)

### Static vs Interactive Pages
- Many providers offer both a static currency converter page (rate in URL) and an interactive calculator
- Static pages are faster and less prone to bot detection
- Interactive pages are needed as fallback when static pages don't exist or fail

### Anti-Bot Measures
- MoneyGram returns 403 on direct HTTP requests — requires full Playwright browser
- Some providers may use Cloudflare or similar protection
- Realistic user-agent and viewport settings help avoid detection

### URL Patterns Discovered
- Wise: `/gb/currency-converter/{from}-to-{to}-rate` (static) and `/gb/send-money/` (interactive)
- Remitly: `/{fromCountryCode}/en/{toCountrySlug}` and `/us/en/currency-converter/{from}-to-{to}-rate`
- Western Union: `/sg/en/currency-converter.html` (user-provided)
- Xoom: `/en-us/{currency}/send-money/transfer?countryCode={CC}` (user-provided)
- WorldRemit: `/en/currency-converter` (interactive widget, no URL params)
- Panda Remit: `/en/{country}/{from}-{to}-converter?amount=N`
- TransferGo: `/currency-converter` or homepage calculator

### Rate Text Patterns
- Most providers display rates as "1 USD = X NGN" format
- Xoom shows separate rates for bank deposit vs cash pickup
- Some sites embed rate data in JavaScript variables or API responses

---

## Wait Time Optimization (2026-04-25)

### Problem: 29+ minute scrape time
The original codebase accumulated large `waitForTimeout` calls (10-20s per pair), making the full scrape take 29+ minutes.

### Solution: Element-specific waits with 3-5s caps
- Replaced all `waitForTimeout` > 500ms with `waitFor()` / `waitForSelector()` / `waitForFunction()` with 3-5s timeout caps
- Wise iterative sleep testing: 5000ms → 2000ms → 700ms → 300ms → 100ms → settled at **200ms**
- All providers now use 200ms minimum waits between dropdown interactions
- Max wait for any single operation: 5s (element-specific, not fixed sleep)
- WorldRemit needs 2000ms after currency selection for rate to recalculate (rate is fetched from server)

### Key Insight
`waitForTimeout` (fixed sleep) should never exceed 500ms except when waiting for a server-side calculation (e.g., WorldRemit rate update). Use `waitFor` with timeout caps instead.

---

## WorldRemit Deep Dive (2026-04-25)

### MUI Autocomplete Listbox Behavior
- **Send dropdown**: 48 options, listbox ID is `calculator-v2-send-country-search-input-listbox`
- **Receive dropdown**: ~90 options, listbox ID is `calculator-v2-receive-country-search-input-listbox`
- **Send currencies**: AUD, CAD, EUR, GBP, PLN, USD (only developed nations)
- **Receive currencies**: 56+ currencies including GHS, INR, KES, MXN, NGN, PHP, PKR
- **IDs change dynamically**: When the send currency changes, the receive listbox re-renders with new IDs. IDs **cannot be cached**.
- **Text matching approach**: Find `<li role="option">` whose `textContent` includes the currency code, click via `page.evaluate()`

### Why Search/Type Failed
- Typing into the send search input caused the listbox to disappear entirely
- Typing into the receive search input worked, but Playwright's locator couldn't click the filtered items (they were hidden with CSS)
- Solution: Skip search, find the LI by text match from the full listbox and click it

### React Input Values
- React-managed inputs do NOT expose their current value via cheerio `attr('value')`
- Must use `page.evaluate()` to read `element.value` directly from the DOM

### Cookie Banner (OneTrust)
- Button: `#onetrust-accept-btn-handler`
- Must `window.scrollTo(0, 0)` before waiting (button may be cut off at viewport top)
- Must `scrollIntoViewIfNeeded()` before clicking
- Must `scrollTo(0, 0)` after clicking (calculator inputs may be off-screen)
- Viewport must be at least 600x1000 for banner to be fully visible

### Send Currency Grouping Optimization
- CSV pairs are grouped by send currency (AUD→*, CAD→*, EUR→*, etc.)
- Provider tracks `currentSendCurrency` at module level
- Only clicks send dropdown when currency changes, saving ~5s per pair within the same group

---

## Output Architecture (2026-04-25)

### NDJSON Incremental Writes
- Initial implementation overwrote the entire output file after each batch
- Changed to `appendResults()` that appends new results to `rates.ndjson` and `rates.csv`
- Scraper calls `onBatch` callback with full accumulated results; index.js calculates delta and appends only new results
- Scraper cleans old output files at start of run
- Final write via `writeResults()` produces `rates.json` (pretty-printed summary) + final `rates.csv`

### Per-Provider Output
- `--all` mode: writes to `output/` root
- Single provider mode: writes to `output/{provider-slug}/`
- Multi-provider mode: splits results into `output/{provider-slug}/` per provider

---

## Remitly Pair Discovery (2026-04-25)

### Problem: discoverSupportedPairs only found 14 pairs
- The `discoverSupportedPairs()` function scraped the main page for supported pairs
- It only found 14 pairs, missing 7 USD pairs (USD/GHS, USD/KES, etc.)
- Result: 35 of 49 pairs were skipped with "not found on site"

### Solution: Remove pair discovery entirely
- Removed `discoverSupportedPairs` from Remitly provider
- Try all CSV pairs; 404 pages return null rate early
- Result: 7 USD pairs succeed, 42 report "not found" with error field populated

---

## Send Currency Grouping Optimization (2026-04-25)

### Problem
Interactive providers click both send and receive dropdowns for every pair, causing interface drift and redundant interactions. The send dropdown click is unnecessary when consecutive pairs share the same send currency.

### Solution
Track current send currency at module level; only click send dropdown when currency changes.

### Applied to
- **WorldRemit**: tracks `currentSendCurrency`, skips send dropdown click
- **Taptap Send**: tracks `currentPage` + `currentOriginCurrency`, skips navigation and origin dropdown
- **Ria**: tracks `currentPage` + `currentSendCurrency`, skips navigation and send dropdown
- **TransferGo**: tracks `currentPage` + `currentSendCurrency`, skips navigation and send dropdown

### How it works
- CSV pairs are naturally grouped by send currency (AUD→*, CAD→*, EUR→*, GBP→*, etc.)
- When the requested send currency matches the tracked value, the provider skips the send dropdown interaction entirely
- Saves ~5s per pair within each send-currency group
- Receive dropdown is still clicked for every pair (currencies always change)

---

## Browser Context (2026-04-25)

### Viewport Change
- Original: 1280x800
- Changed to: 600x1000 (wider than tall)
- Reason: WorldRemit cookie banner was cut off at viewport top, preventing click
- 600px width is sufficient for the calculator widget, 1000px height ensures all elements are visible

### One Context Per Provider
- Single browser instance, one context per provider
- Context is closed after all pairs for a provider complete
- Pages are reused within a provider (important for WorldRemit's send currency grouping)

---

## Western Union Deep Dive (2026-04-26)

### Dropdown Structure

The receiver currency dropdown (`#receiverCurrencyDrop`) contains `<a>` elements whose `href` attribute includes the pair URL pattern: `/{from}-to-{to}-rate.html`. Clicking the `<a>` navigates to a pair-specific page where the rate is immediately visible in `.fx-to` span.

### Href Link Click Strategy (Method 1)

1. Click `#receiverCurrencyDrop` to open dropdown
2. Find `a[href*="/{from}-to-{to}-rate.html"]` in the dropdown
3. Click the `<a>` — navigates to pair page
4. Wait 2s for rate, extract from `.fx-to` or body text

### Send Money Flow Fallback (Method 2)

When the currency is not in the converter dropdown, use:
`/web/send-money/start?ReceiveCountry={CC}&ISOCurrency={CUR}&SendAmount={N}&FundsOut=BA&FundsIn=undefined`

This may redirect to `/estimate-details` (React SPA). Rate extraction via HTML element selectors:
- `#exchangeRate` — "1.00 GBP = 15.0395 GHS" (UK-style)
- `#smoExchangeRate` — "1.00 GBP = 15.0395 Ghanaian Cedi (GHS)"
- `span.label_estimate_details_exchangeRate` — "1 AED = 3.0102 GHS" (estimate page)
- `.FIFOSelect_option-label-sub__m3NRy` — "Fees 7.50 AED, 1 AED = 3.0102 GHS" (payment method dropdown)

### Wait Times for Send Money Flow

- 5000ms after page load for redirect + rate rendering (React SPA)

### Verified

All 49 pairs: 49/49 successful headless.

---

## Remitly Page Reuse Bug (2026-04-26)

### Problem: All pairs returned the same wrong rate

The provider tracked `currentPage` and `currentSendCurrency` at module level, skipping navigation when the send currency matched. But Remitly has a unique URL per pair, so pairs sharing a send currency still needed fresh navigation.

### Solution

Remove `currentPage` / `currentSendCurrency` module-level state. Navigate every time with `page.goto(converterUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation })` followed by 1000ms wait.

---

## Panda Remit Timing Fix (2026-04-26)

### Problem: Rate data loads via API after DOM ready

Using `domcontentloaded` fired before the rate API completed. Changed to `networkidle` which waits for all network activity to settle. Added 500ms wait after navigation.

### EUR→PKR Support

Added `PKR: 'pakistan'` to EUR's COUNTRY_MAP — this pair was missing.

### Pair Discovery

AUD→GHS, CAD→GHS, EUR→MXN, GBP→MXN, USD→GHS return 404s on Panda's site — correctly blocked by COUNTRY_MAP. 15/25 pairs supported.

---

_Last Updated: 2026-04-26_
