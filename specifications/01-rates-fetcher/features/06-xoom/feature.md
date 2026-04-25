---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/06-xoom"
this_file: "specifications/01-rates-fetcher/features/06-xoom/feature.md"

feature: "Xoom Provider"
description: "Scraper for Xoom (xoom.com) — transfer page with countryCode parameter for rate display"
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

# Xoom Provider

## Overview

Xoom (a PayPal service) provides money transfer services. They have no dedicated currency converter page — rates are displayed on the transfer page by setting the send currency in the URL path and the receive country via `countryCode` query parameter. They show multiple rates for different delivery methods (bank deposit, cash pickup).

## Provider Details

- **Name**: Xoom
- **Base URL**: https://www.xoom.com
- **Transfer URL Pattern**: `https://www.xoom.com/en-us/{sendCurrency}/send-money/transfer?countryCode={receiveCountryCode}`
- **Pairs in CSV**: 35
- **Send currencies**: AUD, CAD, EUR, GBP, USD
- **Receive currencies**: GHS, INR, KES, MXN, NGN, PHP, PKR

## Scraping Strategy

### Priority 1: Static Page Read

**URL Pattern**: `https://www.xoom.com/en-us/{sendCurrency}/send-money/transfer?countryCode={receiveCountryCode}`

- `{sendCurrency}`: lowercase send currency (e.g., `usd`)
- `{receiveCountryCode}`: 2-letter country code from `CURRENCY_COUNTRY_MAP`

**Example**: `https://www.xoom.com/en-us/usd/send-money/transfer?countryCode=NG`

**Page Structure**:
- Transfer calculator showing available delivery methods
- Each method displays its own exchange rate
- Common methods: Bank Deposit, Cash Pickup, Door Delivery, Mobile Wallet
- Rate format: "1 USD = X,XXX.XXXX NGN"

**Extraction Approach**:
1. Navigate to URL, wait 4s
2. Get body text
3. Regex match: `1\s+{FROM}\s*=\s*([\d.,]+)\s*{TO}`
4. Use the first/primary rate (typically bank deposit)
5. Calculate receiveAmount

### Priority 2: Interactive Fallback

If the page requires login or doesn't show rates on the initial load:
1. Navigate to URL
2. Wait for calculator widget to load
3. Fill in send amount
4. Wait for rate display
5. Extract rate from text

## Architecture

### File Structure

```
src/providers/xoom.js
```

### Component Details

- **Module**: `src/providers/xoom.js`
- **Exports**: `{ name: 'Xoom', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS, CURRENCY_COUNTRY_MAP)
- **Strategy**: Static transfer URL → read rate from page text

### URL Construction

```javascript
const receiveCountry = CURRENCY_COUNTRY_MAP[receiveCurrency];
const currency = sendCurrency.toLowerCase();
const url = `https://www.xoom.com/en-us/${currency}/send-money/transfer?countryCode=${receiveCountry.code}`;
```

### Multiple Rate Handling

Xoom displays separate rates per delivery method. The scraper should:
- Capture the bank deposit rate (typically first/largest)
- Log if multiple rates found
- Use the most favorable rate for the sender

### PayPal Integration

Xoom is owned by PayPal and may redirect to PayPal login. The scraper should:
- Handle login redirects gracefully
- Return null if login required
- Not attempt to log in

## Tasks

- [ ] Task 1: Implement URL construction using CURRENCY_COUNTRY_MAP
- [ ] Task 2: Implement regex rate extraction from transfer page
- [ ] Task 3: Handle multiple delivery method rates (pick primary)
- [ ] Task 4: Handle PayPal login redirect (return null gracefully)
- [ ] Task 5: Test with multiple pairs (USD→NGN, GBP→INR, EUR→MXN)
- [ ] Task 6: Handle edge cases (unsupported country, login wall, timeout)

## Testing

### Test Cases

1. **Rate extraction — bank deposit**
   - Given: `xoom.com/en-us/usd/send-money/transfer?countryCode=NG`
   - When: `fetchRate(page, 'USD', 'NGN', 1000)`
   - Then: Returns bank deposit rate

2. **URL construction — PHP currency**
   - Given: sendCurrency=EUR, receiveCurrency=PHP
   - When: URL constructed
   - Then: `https://www.xoom.com/en-us/eur/send-money/transfer?countryCode=PH`

3. **Login wall handled**
   - Given: Page redirects to PayPal login
   - When: `fetchRate` called
   - Then: Returns null without error

## Success Criteria

- [ ] All tasks completed
- [ ] Rate extraction works for tested pairs
- [ ] Login redirects handled gracefully
- [ ] No crashes on unsupported corridors

---

_Created: 2026-04-25_
