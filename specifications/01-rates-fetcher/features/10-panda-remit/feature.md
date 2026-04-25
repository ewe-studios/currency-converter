---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/10-panda-remit"
this_file: "specifications/01-rates-fetcher/features/10-panda-remit/feature.md"

feature: "Panda Remit Provider"
description: "Scraper for Panda Remit (pandaremit.com) — parameterized currency converter URL"
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

# Panda Remit Provider

## Overview

Panda Remit is a remittance provider with 25 currency pairs. They have a parameterized converter URL pattern with amount, from-to currency pair, and country path. Shows exchange rate, fees, and promotional offers for new customers.

## Provider Details

- **Name**: Panda Remit
- **Base URL**: https://www.pandaremit.com
- **Converter URL Pattern**: `https://www.pandaremit.com/en/{country}/{from}-{to}-converter?amount={amount}`
- **Pairs in CSV**: 25
- **Send currencies**: AUD, CAD, EUR, GBP, USD
- **Receive currencies**: GHS, INR, MXN, PHP, PKR

## Scraping Strategy

### Priority 1: Static Converter URL

**URL Pattern**: `https://www.pandaremit.com/en/aus/china/aud-cny-converter?amount=1000`

Adapted for our pairs:
- `{country}`: Country path for send currency (e.g., `aus` for Australia, `us` for US)
- `{from}-{to}`: Currency pair (e.g., `usd-ngn`)
- `?amount=`: Send amount

**Example**: `https://www.pandaremit.com/en/us/usd-to-ngn-converter?amount=1000`

**Page Structure**:
- Real-time exchange rate display
- Transaction fees
- "Limited-time offer" messaging for new customers
- Amount recipient will receive

### Priority 2: Interactive Fallback

Navigate to the homepage and use the calculator if the parameterized URL fails.

## Architecture

### File Structure

```
src/providers/panda-remit.js
```

### Component Details

- **Module**: `src/providers/panda-remit.js`
- **Exports**: `{ name: 'Panda Remit', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS, CURRENCY_COUNTRY_MAP)
- **Strategy**: Static parameterized URL → homepage calculator fallback

### URL Construction

```javascript
const countrySlug = CURRENCY_COUNTRY_MAP[sendCurrency].slug.substring(0, 3); // e.g., 'aus', 'usa'
const url = `https://www.pandaremit.com/en/${countrySlug}/${sendCurrency.toLowerCase()}-${receiveCurrency.toLowerCase()}-converter?amount=${sendAmount}`;
```

Note: May need to map country slugs (aus, uk, usa, etc.) manually.

## Tasks

- [ ] Task 1: Implement parameterized URL construction
- [ ] Task 2: Implement rate extraction from converter page
- [ ] Task 3: Implement homepage calculator fallback
- [ ] Task 4: Add cookie consent dismissal
- [ ] Task 5: Test with multiple pairs (USD→NGN, GBP→INR, AUD→GHS)
- [ ] Task 6: Handle edge cases

## Success Criteria

- [ ] All tasks completed
- [ ] Rate extraction works for tested pairs
- [ ] Graceful fallback on any issue

---

_Created: 2026-04-25_
