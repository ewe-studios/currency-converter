# Feature: Null Rate Reduction

## Description

Reduce the 99 null/empty rate records across MoneyGram (42), Panda Remit (33), and Sendwave (24) by improving their extraction strategies and adding fallback paths.

## MoneyGram (42 failures, AED/AUD send currencies)

### Root Cause

MoneyGram uses DataDome bot detection. When blocked, it shows a captcha page with no rate data. Additionally, AED and AUD send currencies may route to unsupported corridors.

### Fixes

- Increase retry attempts from 2 to 3 for MoneyGram specifically (set in scraper config)
- Add a longer backoff (10s) between retries to avoid triggering DataDome rate limits
- When the calculator returns empty inputs, detect this as "needs captcha" rather than "rate unavailable"
- If `discoverSupportedPairs` exists, verify the corridor is supported before attempting to fetch
- Add a fallback: try the moneygram.com API endpoint directly if the page is blocked (if one exists)

## Panda Remit (33 failures, multiple send currencies to GHS/INR/MXN/PKR)

### Root Cause

Panda Remit uses a custom `COUNTRY_MAP` in `panda-remit.js` that only supports specific corridors. When a requested pair isn't in the map, it returns null immediately without attempting to scrape.

### Fixes

- Expand the `COUNTRY_MAP` to cover the missing corridors:
  - EUR → GHS, INR, MXN, PKR (currently only supports GHS via fra/ghana)
  - GBP → GHS, INR, MXN, PKR (currently only supports GHS and PKR)
  - AUD → INR, MXN, PKR (currently only supports INR)
  - CAD → INR, MXN, PKR (currently only supports INR and MXN)
  - USD → GHS, INR, MXN, PKR (currently missing GHS and PKR)
- Verify each corridor by visiting the URL and checking for rate content
- For corridors that Panda Remit truly doesn't support, add them to the unsupported list so they're logged as "pair not supported" rather than silently returning null

## Sendwave (24 failures, CAD/EUR send to all receive currencies)

### Root Cause

Sendwave's homepage calculator uses MUI Autocomplete drawers. The `selectCountry()` function may fail to select CAD or EUR countries because:

1. The search input may not populate results quickly enough
2. The MUI drawer may close before the selection is confirmed
3. The data-testid selectors may have changed

### Fixes

- Add explicit wait after clicking the country select for the drawer to open
- Increase the wait time after typing in the search input from 500ms to 1000ms
- After clicking the option, verify the select button text updated to the selected country
- Add a fallback: if the drawer-based selection fails, try navigating directly to `sendwave.com/en/send-money/{sendCountry}-to-{receiveCountry}`
- Add error logging to capture the exact DOM state when selection fails

## Tasks

- [ ] MoneyGram: increase retries to 3, add 10s backoff, improve captcha detection
- [ ] Panda Remit: expand COUNTRY_MAP for missing corridors, verify each URL works
- [ ] Sendwave: fix MUI Autocomplete timing, add URL-based fallback, verify select text updates
- [ ] Update `Provider.csv` or add a supported-pairs registry for providers that don't support all advertised pairs
- [ ] Add logging to distinguish "pair not supported" from "extraction failed"

## Verification

- MoneyGram null rates reduced from 42 to < 20
- Panda Remit null rates reduced from 33 to < 10
- Sendwave null rates reduced from 24 to < 10
- Unsupported pairs explicitly logged, not silently returning null
- All three providers show progress in console during scraping

---

_Created: 2026-05-16_
