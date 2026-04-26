---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/05-western-union"
this_file: "specifications/01-rates-fetcher/features/05-western-union/feature.md"

feature: "Western Union Provider"
description: "Scraper for Western Union (westernunion.com) — country-based currency converter with dropdown → href link navigation → send money flow fallback"
status: completed
priority: high
created: 2026-04-25
last_updated: 2026-04-26
author: "Main Agent"

depends_on: ["01-scraper-engine"]

tasks:
  completed: 8
  uncompleted: 0
  total: 8
  completion_percentage: 100
---

# Western Union Provider

## Overview

Western Union offers currency conversion for 49 currency pairs. The converter is at `{country}/en/currency-converter.html` with an interactive dropdown. A secondary "send money" flow serves as fallback when the converter dropdown lacks a currency.

## Provider Details

- **Name**: Western Union
- **Base URL**: https://www.westernunion.com
- **Converter URL**: `https://www.westernunion.com/{countrySlug}/en/currency-converter.html`
- **Pairs in CSV**: 49
- **Send currencies**: AED, AUD, CAD, EUR, GBP, PLN, USD
- **Receive currencies**: GHS, INR, KES, MXN, NGN, PHP, PKR

## Scraping Strategy

### Method 1: Currency Converter Page (dropdown → href link)

1. Navigate to converter page with `domcontentloaded` + 200ms
2. Dismiss cookie banner (OneTrust)
3. Fill send amount via `input[id="wu-input-{CURRENCY}"]`
4. Click `#receiverCurrencyDrop` to open the dropdown
5. Find the `<a>` element whose `href` matches `/{currency}-to-{currency}-rate.html`
6. Click the `<a>` link — this navigates to the pair-specific rate page
7. Wait 2000ms for rate to populate, then extract from `.fx-to` span or body text

### Method 2: Send Money Flow (fallback when converter dropdown lacks the currency)

**URL**: `https://www.westernunion.com/{countrySlug}/en/web/send-money/start?ReceiveCountry={CC}&ISOCurrency={CUR}&SendAmount={N}&FundsOut=BA&FundsIn=undefined`

The page may redirect to `/estimate-details`. Rate extraction via HTML element selectors:

1. `#exchangeRate` — contains "1.00 GBP = 15.0395 GHS"
2. `#smoExchangeRate` — contains "1.00 GBP = 15.0395 Ghanaian Cedi (GHS)"
3. `span.label_estimate_details_exchangeRate` — "Estimated rate  1 AED = 3.0102 GHS" (estimate-details page)
4. `.FIFOSelect_option-label-sub__m3NRy` — "Fees 7.50 AED, 1 AED = 3.0102 GHS" (payment method dropdown)
5. Fallback: regex scan body for `1 {sendCurrency} = {rate} {receiveCurrency}`

## Architecture

### File Structure

```
src/providers/western-union.js
```

### Component Details

- **Module**: `src/providers/western-union.js`
- **Exports**: `{ name: 'Western Union', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS, CURRENCY_COUNTRY_MAP)
- **Strategy**: Converter dropdown (href link click) → send money flow fallback

### Key Selectors (Converter)

| Purpose | Selector |
|---------|----------|
| Send amount input | `input[id="wu-input-{CURRENCY}"]` |
| Receiver dropdown trigger | `#receiverCurrencyDrop` |
| Dropdown items (links) | `a[href*="/{from}-to-{to}-rate.html"]` |
| Rate display | `.fx-to` |

### Key Selectors (Send Money)

| Purpose | Selector |
|---------|----------|
| Rate text (GBP→GHS style) | `#exchangeRate` |
| Rate text (Ghanaian Cedi style) | `#smoExchangeRate` |
| Estimate rate (AED→GHS style) | `span.label_estimate_details_exchangeRate` |
| Payment option rate | `.FIFOSelect_option-label-sub__m3NRy` |

### Cookie/Consent Handling

OneTrust banner:
- `#accept-recommended-btn-handler`
- `#onetrust-accept-btn-handler`
- `button:has-text("Allow All")`

## Verified Rates (2026-04-26)

All 49 pairs verified headless: **49/49 successful, 0 failed**.

## Tasks

- [x] Task 1: Implement currency converter page navigation
- [x] Task 2: Implement dropdown trigger click and href link matching
- [x] Task 3: Implement send money flow fallback with HTML element extraction
- [x] Task 4: Add cookie consent dismissal (OneTrust)
- [x] Task 5: Test with multiple pairs across all send currencies
- [x] Task 6: Handle unsupported pairs (currency not in dropdown)
- [x] Task 7: Handle AED→GHS via estimate-details page
- [x] Task 8: Verify all 49 pairs pass headless

## Testing

### Test Cases

1. **Converter dropdown — AED→INR**
   - Given: Converter page loaded, amount set
   - When: `fetchRate(page, 'AED', 'INR', 1000)`
   - Then: Returns valid exchangeRate via href link navigation

2. **Send money fallback — GBP→GHS**
   - Given: GHS not in converter dropdown
   - When: Falls through to send money flow
   - Then: Returns rate via `#exchangeRate` element

3. **Estimate details — AED→GHS**
   - Given: Redirects to /estimate-details
   - When: Rate extracted from `label_estimate_details_exchangeRate`
   - Then: Returns valid exchangeRate

4. **Edge case — currency not in dropdown**
   - Given: Pair not supported from that country
   - When: No matching href found
   - Then: Returns null via fallback

## Success Criteria

- [x] All tasks completed
- [x] Converter dropdown works for supported pairs
- [x] Send money fallback works for GHS pairs
- [x] All 49 pairs pass headless
- [x] Graceful null for truly unsupported corridors

---

_Created: 2026-04-25_
_Last Updated: 2026-04-26_
