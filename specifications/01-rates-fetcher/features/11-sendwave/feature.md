---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/11-sendwave"
this_file: "specifications/01-rates-fetcher/features/11-sendwave/feature.md"

feature: "Sendwave Provider"
description: "Scraper for Sendwave (sendwave.com) — homepage calculator with send/receive fields"
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

# Sendwave Provider

## Overview

Sendwave is a mobile-first remittance provider with 28 currency pairs. Their homepage displays an exchange rate calculator with "You send" and "They get" fields. No dedicated currency converter page — rates are on the homepage.

## Provider Details

- **Name**: Sendwave
- **Base URL**: https://www.sendwave.com
- **Calculator URL**: `https://www.sendwave.com/en/` (homepage)
- **Pairs in CSV**: 28
- **Send currencies**: CAD, EUR, GBP, USD
- **Receive currencies**: GHS, INR, KES, MXN, NGN, PHP, PKR

## Scraping Strategy

### Priority 1: Static Page Read

Navigate to `https://www.sendwave.com/en/` and read body text for rate information.

### Priority 2: Interactive Calculator (Primary Method)

**Page Structure**:
- "You send" amount input
- "They get" amount output
- Exchange rate display
- Country/currency selectors

**Interaction Flow**:
1. Navigate to homepage, wait 4s
2. Dismiss cookie consent
3. Find send amount input → fill with sendAmount
4. Find send currency selector → select sendCurrency
5. Find receive currency selector → select receiveCurrency
6. Wait 3s for calculation
7. Extract rate from body text matching `1 {FROM} = {rate} {TO}`

## Architecture

### File Structure

```
src/providers/sendwave.js
```

### Component Details

- **Module**: `src/providers/sendwave.js`
- **Exports**: `{ name: 'Sendwave', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS)
- **Strategy**: Static page read → interactive homepage calculator

## Tasks

- [ ] Task 1: Implement homepage navigation and static rate extraction
- [ ] Task 2: Implement interactive calculator interaction
- [ ] Task 3: Add cookie consent dismissal
- [ ] Task 4: Add currency selector interaction
- [ ] Task 5: Test with multiple pairs (USD→NGN, GBP→INR, EUR→GHS)
- [ ] Task 6: Handle edge cases

## Success Criteria

- [ ] All tasks completed
- [ ] Rate extraction works for tested pairs
- [ ] Graceful fallback

---

_Created: 2026-04-25_
