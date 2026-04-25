---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/07-moneygram"
this_file: "specifications/01-rates-fetcher/features/07-moneygram/feature.md"

feature: "MoneyGram Provider"
description: "Scraper for MoneyGram (moneygram.com) — Playwright required due to 403 blocking on direct fetch"
status: pending
priority: high
created: 2026-04-25
last_updated: 2026-04-25
author: "Main Agent"

depends_on: ["01-scraper-engine"]

tasks:
  completed: 0
  uncompleted: 7
  total: 7
  completion_percentage: 0
---

# MoneyGram Provider

## Overview

MoneyGram is a major remittance provider with 49 currency pairs. Direct HTTP requests to MoneyGram are blocked with 403 status, making full Playwright browser automation mandatory. Their homepage features an interactive rate calculator.

## Provider Details

- **Name**: MoneyGram
- **Base URL**: https://www.moneygram.com
- **Homepage**: `https://www.moneygram.com/mgo/{countryCode}/en/`
- **Pairs in CSV**: 49
- **Send currencies**: AED, AUD, CAD, EUR, GBP, PLN, USD
- **Receive currencies**: GHS, INR, KES, MXN, NGN, PHP, PKR

## Scraping Strategy

### Priority 1: Static Page Read (Locale Homepage)

**URL Pattern**: `https://www.moneygram.com/mgo/{countryCode}/en/`

- `{countryCode}`: lowercase 2-letter code from CURRENCY_COUNTRY_MAP for the send currency

**Example**: `https://www.moneygram.com/mgo/us/en/`

**Extraction Approach**:
1. Navigate via Playwright, wait 4s
2. Dismiss cookie consent
3. Get body text, regex match rate pattern

### Priority 2: Interactive Calculator (Fallback)

**Page Structure**:
- Homepage calculator with "You send" / "They receive" fields
- Country/currency selectors
- Real-time rate display

**Interaction Flow**:
1. Navigate to locale homepage
2. Wait 4s for JS rendering
3. Dismiss cookie banner
4. Find "You send" amount input → fill with sendAmount
5. Find send country/currency selector → select sendCurrency
6. Find receive country/currency selector → select receiveCurrency
7. Wait 3s for rate calculation
8. Extract rate from body text matching `1 {FROM} = {rate} {TO}`
9. Extract fee from "Today's rate" or fee display text

## Architecture

### File Structure

```
src/providers/moneygram.js
```

### Component Details

- **Module**: `src/providers/moneygram.js`
- **Exports**: `{ name: 'MoneyGram', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS, CURRENCY_COUNTRY_MAP)
- **Strategy**: Static locale page → interactive calculator fallback

### Cookie/Consent Handling

MoneyGram may show cookie consent:
- Try: `button:has-text("Accept"), #onetrust-accept-btn-handler`
- Longer wait (4s) due to heavy JS rendering

### Anti-Bot Considerations

- 403 on direct HTTP fetch — requires full browser
- May use Cloudflare or Akamai protection
- Realistic user-agent is critical
- May need to wait longer for JS to render

## Tasks

- [ ] Task 1: Implement locale-based URL construction
- [ ] Task 2: Implement static page rate extraction
- [ ] Task 3: Implement interactive calculator interaction
- [ ] Task 4: Add cookie consent dismissal
- [ ] Task 5: Add longer wait times for JS rendering (4s+)
- [ ] Task 6: Test with multiple pairs (USD→NGN, EUR→MXN, GBP→INR)
- [ ] Task 7: Handle 403/Cloudflare challenges gracefully

## Testing

### Test Cases

1. **Rate extraction via Playwright**
   - Given: Full browser context
   - When: `fetchRate(page, 'USD', 'NGN', 1000)`
   - Then: Returns valid exchangeRate

2. **Direct fetch blocked (403)**
   - Given: Direct HTTP request
   - When: Fetching MoneyGram page
   - Then: Returns 403 (confirms Playwright requirement)

3. **JS rendering wait**
   - Given: Page with lazy-loaded calculator
   - When: Scraper runs with 4s wait
   - Then: Rate text is present in body

## Success Criteria

- [ ] All tasks completed
- [ ] Rate extraction works through full browser
- [ ] 403 blocking confirmed
- [ ] Graceful fallback on Cloudflare challenges

---

_Created: 2026-04-25_
