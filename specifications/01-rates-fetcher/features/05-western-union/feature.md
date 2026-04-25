---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/05-western-union"
this_file: "specifications/01-rates-fetcher/features/05-western-union/feature.md"

feature: "Western Union Provider"
description: "Scraper for Western Union (westernunion.com) — Singapore currency converter page with interactive form"
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

# Western Union Provider

## Overview

Western Union is one of the largest remittance providers with 49 currency pairs. They have a currency converter page at the Singapore locale (`/sg/en/currency-converter.html`) with interactive form elements for selecting currencies and entering amounts.

## Provider Details

- **Name**: Western Union
- **Base URL**: https://www.westernunion.com
- **Converter URL**: `https://www.westernunion.com/sg/en/currency-converter.html`
- **Pairs in CSV**: 49
- **Send currencies**: AED, AUD, CAD, EUR, GBP, PLN, USD
- **Receive currencies**: GHS, INR, KES, MXN, NGN, PHP, PKR

## Scraping Strategy

### Priority 1: Static Page Read

**URL**: `https://www.westernunion.com/sg/en/currency-converter.html`

Navigate and read the page. Some rate information may be displayed on the default page view without interaction.

**Extraction Approach**:
1. Navigate, wait 4s
2. Dismiss cookie consent
3. Get body text, regex match rate pattern

### Priority 2: Interactive Form (Fallback)

**Page Structure**:
- Currency converter form with:
  - "You send" amount input
  - From-currency selector
  - To-currency selector
  - Rate display (e.g., "1 USD = X NGN")
  - Possibly multiple delivery method options (bank deposit, cash pickup, mobile wallet)

**Interaction Flow**:
1. Navigate to converter page
2. Wait 4s for full render
3. Dismiss cookie/OneTrust banner
4. Locate currency selectors (may be styled dropdowns, not native `<select>` elements)
5. Select send currency (e.g., USD)
6. Select receive currency (e.g., NGN)
7. Fill amount field with sendAmount
8. Wait for rate recalculation (2s)
9. Extract rate from displayed text
10. Extract fee if shown

**Selectors to Try**:
- Currency dropdowns: `select`, `[role="listbox"]`, `[data-testid*="from"]`, `[data-testid*="to"]`
- Amount input: `input[type="text"]`, `input[type="number"]`
- Rate text: Search body text for `1 {FROM} = {rate} {TO}`

### Multiple Delivery Methods

Western Union may show different rates for different delivery methods:
- Bank Deposit
- Cash Pickup
- Mobile Wallet

The scraper should capture the primary/default rate (typically bank deposit).

## Architecture

### File Structure

```
src/providers/western-union.js
```

### Component Details

- **Module**: `src/providers/western-union.js`
- **Exports**: `{ name: 'Western Union', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS)
- **Strategy**: Static page read → interactive form fallback

### Cookie/Consent Handling

Western Union uses OneTrust:
- Selector: `#onetrust-accept-btn-handler` or `button:has-text("I Accept")`
- Dismiss before interacting with form

### Anti-Bot Considerations

- Western Union may employ aggressive bot detection
- May require longer wait times between interactions
- Consider adding small random delays

## Tasks

- [ ] Task 1: Implement static page navigation and rate extraction
- [ ] Task 2: Implement currency selector interaction
- [ ] Task 3: Implement amount input and rate calculation trigger
- [ ] Task 4: Add cookie consent dismissal (OneTrust)
- [ ] Task 5: Test with multiple pairs (USD→NGN, GBP→INR, EUR→GHS)
- [ ] Task 6: Handle edge cases (select not found, bot detection, timeout)

## Testing

### Test Cases

1. **Rate extraction — bank deposit**
   - Given: Converter page loaded, currencies set
   - When: `fetchRate(page, 'USD', 'NGN', 1000)`
   - Then: Returns valid exchangeRate

2. **Currency selection**
   - Given: Converter page with dropdown selectors
   - When: Currency selectors interacted with
   - Then: Rate updates to match selected pair

3. **Cookie banner dismissed**
   - Given: Cookie banner present
   - When: Scraper runs
   - Then: Form interaction is not blocked

## Success Criteria

- [ ] All tasks completed
- [ ] Rate extraction works for at least 5 tested pairs
- [ ] Cookie handling works
- [ ] Graceful degradation when selectors don't match

---

_Created: 2026-04-25_
