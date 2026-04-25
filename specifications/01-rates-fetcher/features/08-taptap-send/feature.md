---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/08-taptap-send"
this_file: "specifications/01-rates-fetcher/features/08-taptap-send/feature.md"

feature: "Taptap Send Provider"
description: "Scraper for Taptap Send (taptapsend.com) — homepage calculator widget"
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

# Taptap Send Provider

## Overview

Taptap Send is a mobile-first remittance provider with 49 currency pairs. Their homepage features a calculator widget showing send/receive amounts. No dedicated currency converter page — rates are displayed interactively on the homepage.

## Provider Details

- **Name**: Taptap Send
- **Base URL**: https://www.taptapsend.com/
- **Calculator URL**: `https://www.taptapsend.com/` (homepage)
- **Pairs in CSV**: 49
- **Send currencies**: AED, AUD, CAD, EUR, GBP, PLN, USD
- **Receive currencies**: GHS, INR, KES, MXN, NGN, PHP, PKR

## Scraping Strategy

### Priority 1: Static Page Read

Navigate to `https://www.taptapsend.com/` and read the page. Some default rates may be displayed.

### Priority 2: Interactive Calculator (Primary Method)

**Page Structure**:
- Homepage calculator with "You send" / "They get" fields
- Country/currency selectors
- Real-time rate display
- May show fees or promotional offers

**Interaction Flow**:
1. Navigate to homepage, wait 4s
2. Dismiss cookie consent
3. Find send country/currency selector → select sendCurrency
4. Find receive country/currency selector → select receiveCurrency
5. Fill amount → wait for calculation
6. Extract rate from body text
7. Extract fee if displayed

## Architecture

### File Structure

```
src/providers/taptap-send.js
```

### Component Details

- **Module**: `src/providers/taptap-send.js`
- **Exports**: `{ name: 'Taptap Send', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS)
- **Strategy**: Static page read → interactive homepage calculator

### Send Currency Grouping Optimization

CSV pairs are grouped by send currency (AED→*, AUD→*, CAD→*, etc.). Provider tracks `currentPage` and `currentOriginCurrency` at module level:
- Skips page navigation when already on the correct page (`currentPage` matches requested currency)
- Only clicks the send/origin dropdown when `currentOriginCurrency` differs from the requested send currency
- Saves ~5s per pair within the same send-currency group by avoiding redundant dropdown clicks

### Cookie/Consent Handling

Taptap Send may show cookie banner — dismiss before interacting.

## Tasks

- [ ] Task 1: Implement homepage navigation and static rate extraction
- [ ] Task 2: Implement interactive calculator interaction
- [ ] Task 3: Add cookie consent dismissal
- [ ] Task 4: Add country/currency selector interaction
- [ ] Task 5: Test with multiple pairs (USD→NGN, GBP→INR, EUR→GHS)
- [ ] Task 6: Handle edge cases

## Success Criteria

- [ ] All tasks completed
- [ ] Rate extraction works for tested pairs
- [ ] Graceful fallback on any issue

---

_Created: 2026-04-25_
