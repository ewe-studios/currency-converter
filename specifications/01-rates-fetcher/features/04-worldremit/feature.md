---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/04-worldremit"
this_file: "specifications/01-rates-fetcher/features/04-worldremit/feature.md"

feature: "WorldRemit Provider"
description: "Scraper for WorldRemit (worldremit.com) — interactive currency converter calculator"
status: pending
priority: high
created: 2026-04-25
last_updated: 2026-04-25
author: "Main Agent"

depends_on: ["01-scraper-engine"]

tasks:
  completed: 0
  uncompleted: 6
  total: 6
  completion_percentage: 0
---

# WorldRemit Provider

## Overview

WorldRemit offers currency conversion for 42 currency pairs. The converter is accessible at `/en/currency-converter` with an interactive calculator widget showing send/receive amounts, fees, and transfer time.

## Provider Details

- **Name**: WorldRemit
- **Base URL**: https://www.worldremit.com
- **Converter URL**: `https://www.worldremit.com/en/currency-converter`
- **Pairs in CSV**: 42
- **Send currencies**: AUD, CAD, EUR, GBP, PLN, USD
- **Receive currencies**: GHS, INR, KES, MXN, NGN, PHP, PKR

## Scraping Strategy

### Priority 1: Static Currency Converter Page (with URL params)

**URL Pattern**: `https://www.worldremit.com/en/currency-converter`

WorldRemit may support query parameters for currency selection. Try constructing URLs like:
`https://www.worldremit.com/en/currency-converter?from={FROM}&to={TO}&amount={AMOUNT}`

**Extraction Approach**:
1. Navigate to URL with params, wait 3s
2. Get body text
3. Regex match rate pattern

### Priority 2: Interactive Calculator (Fallback)

**URL**: `https://www.worldremit.com/en/currency-converter`

**Page Structure**:
- "You send" field with currency selector (shows flag + currency code)
- "They get" field with currency selector
- Receive method selector
- Fee display
- Transfer time indicator
- Total to pay field

**Interaction Flow**:
1. Navigate to currency converter page
2. Wait for page load + 3s
3. Dismiss cookie consent if present
4. Find send currency selector → select sendCurrency
5. Find receive currency selector → select receiveCurrency
6. Find amount input → fill with sendAmount
7. Wait for rate calculation (2-3s)
8. Extract rate from "1 FROM = X TO" text in page
9. Extract fee if displayed

**Selectors to Try**:
- Currency selectors: Look for dropdowns/buttons with currency codes
- Amount input: `input[type="text"]` or `input[type="number"]` near "You send"
- Rate text: Search body text for `1 {FROM} = {rate} {TO}` pattern

## Architecture

### File Structure

```
src/providers/worldremit.js
```

### Component Details

- **Module**: `src/providers/worldremit.js`
- **Exports**: `{ name: 'WorldRemit', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS)
- **Strategy**: Static URL with query params → interactive calculator fallback

### Cookie/Consent Handling

WorldRemit uses OneTrust or similar cookie banner:
- Try: `button:has-text("Accept"), #onetrust-accept-btn-handler`
- Catch errors if not present

## Tasks

- [ ] Task 1: Implement static URL with query parameters for currency pair
- [ ] Task 2: Implement regex rate extraction from static page
- [ ] Task 3: Implement interactive calculator interaction flow
- [ ] Task 4: Add cookie consent dismissal
- [ ] Task 5: Test with multiple pairs (GBP→PHP, EUR→NGN, USD→INR)
- [ ] Task 6: Handle edge cases and unsupported pairs

## Testing

### Test Cases

1. **Rate extraction — standard pair**
   - Given: Interactive calculator loaded
   - When: Currencies set to GBP→PHP, amount=1000
   - Then: Returns valid exchangeRate

2. **Fee extraction**
   - Given: Calculator shows fee
   - When: `fetchRate` completes
   - Then: Returns fee value (not null)

3. **Edge case — no rate displayed**
   - Given: Unsupported corridor
   - When: `fetchRate` called
   - Then: Returns null values gracefully

## Success Criteria

- [ ] All tasks completed
- [ ] Interactive calculator works for tested pairs
- [ ] No crashes on unsupported corridors

---

_Created: 2026-04-25_
