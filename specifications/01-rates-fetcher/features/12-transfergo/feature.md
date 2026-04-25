---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/12-transfergo"
this_file: "specifications/01-rates-fetcher/features/12-transfergo/feature.md"

feature: "TransferGo Provider"
description: "Scraper for TransferGo (transfergo.com) — currency converter page with calculator form"
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

# TransferGo Provider

## Overview

TransferGo is a European-focused remittance provider with only 5 currency pairs (EUR→INR, EUR→NGN, GBP→INR, GBP→NGN, PLN→NGN). They have a calculator form on the homepage and a dedicated currency converter page.

## Provider Details

- **Name**: TransferGo
- **Base URL**: https://www.transfergo.com
- **Converter URL**: `https://www.transfergo.com/currency-converter` or homepage
- **Pairs in CSV**: 5 (smallest provider)
- **Send currencies**: EUR, GBP, PLN
- **Receive currencies**: INR, NGN

## Scraping Strategy

### Priority 1: Static Converter Page

**URL**: `https://www.transfergo.com/currency-converter`

Some rate information may be displayed on the page.

### Priority 2: Interactive Calculator (Primary Method)

**Page Structure**:
- "Send from" currency selector
- "Receiver gets" currency selector
- Amount input fields
- Real-time exchange rate display (e.g., "GBP 1 = NGN 2030.28232")
- Transfer fee information
- Receiver amount calculation

**Interaction Flow**:
1. Navigate to converter page or homepage
2. Wait 4s
3. Dismiss cookie consent
4. Find "Send from" selector → select sendCurrency
5. Find "Receiver gets" selector → select receiveCurrency
6. Fill send amount
7. Wait for calculation
8. Extract rate from text matching `{FROM} 1 = {rate} {TO}`

### Send Currency Grouping Optimization

CSV pairs are grouped by send currency (EUR→*, GBP→*, PLN→*, etc.). Provider tracks `currentPage` and `currentSendCurrency` at module level:
- Skips page navigation when already on the correct page (`currentPage` matches requested currency)
- Only clicks the send currency dropdown when `currentSendCurrency` differs from the requested send currency
- Saves ~5s per pair within the same send-currency group by avoiding redundant dropdown clicks

## Architecture

### File Structure

```
src/providers/transfergo.js
```

### Component Details

- **Module**: `src/providers/transfergo.js`
- **Exports**: `{ name: 'TransferGo', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS)
- **Strategy**: Static converter page → interactive calculator

## Tasks

- [ ] Task 1: Implement converter page navigation
- [ ] Task 2: Implement interactive calculator interaction
- [ ] Task 3: Add cookie consent dismissal
- [ ] Task 4: Add currency selector interaction
- [ ] Task 5: Test with all 5 pairs
- [ ] Task 6: Handle edge cases

## Success Criteria

- [ ] All tasks completed
- [ ] All 5 pairs successfully scraped
- [ ] Graceful fallback

---

_Created: 2026-04-25_
