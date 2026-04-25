---
workspace_name: "rates-fetcher"
spec_directory: "specifications/01-rates-fetcher"
feature_directory: "specifications/01-rates-fetcher/features/04-worldremit"
this_file: "specifications/01-rates-fetcher/features/04-worldremit/feature.md"

feature: "WorldRemit Provider"
description: "Scraper for WorldRemit (worldremit.com) — interactive currency converter calculator with dropdown selection by text match"
status: completed
priority: high
created: 2026-04-25
last_updated: 2026-04-25
author: "Main Agent"

depends_on: ["01-scraper-engine"]

tasks:
  completed: 7
  uncompleted: 0
  total: 7
  completion_percentage: 100
---

# WorldRemit Provider

## Overview

WorldRemit offers currency conversion for 42 currency pairs. The converter at `/en/currency-converter` has an interactive calculator widget using MUI (Material UI) Autocomplete components for currency selection.

## Provider Details

- **Name**: WorldRemit
- **Base URL**: https://www.worldremit.com
- **Converter URL**: `https://www.worldremit.com/en/currency-converter`
- **Pairs in CSV**: 42
- **Send currencies**: AUD, CAD, EUR, GBP, PLN, USD
- **Receive currencies**: GHS, INR, KES, MXN, NGN, PHP, PKR

## Page Structure (Verified)

The calculator uses MUI Autocomplete with this structure:

```
[data-testid="calculator-v2-send-country-select"]     → Button showing current send currency (e.g. "GBP")
  → opens popup containing:
    #calculator-v2-send-country-search-input           → Search input (type="text", autocomplete)
    #calculator-v2-send-country-search-input-listbox   → <ul role="listbox"> with <li role="option"> items

[data-testid="calculator-v2-receive-country-select"]   → Button showing current receive currency (e.g. "PHP")
  → opens popup containing:
    #calculator-v2-receive-country-search-input        → Search input
    #calculator-v2-receive-country-search-input-listbox → <ul role="listbox"> with <li role="option"> items

input[aria-label="pricing-calculator-input-label"]     → Calculator inputs (2 visible)
  → [0]: Send amount (editable)
  → [1]: Receive amount (read-only, auto-calculated)
```

**Both dropdowns have 48+ items and support search/filter.** The send dropdown has 48 countries (developed nations only), the receive dropdown has ~90 countries.

## Scraping Strategy

### Interactive Calculator (Only Approach)

WorldRemit's converter does NOT support URL parameters for currency pairs.

**Interaction Flow**:
1. Navigate to converter page (once per provider session)
2. Wait 300ms for page load
3. Dismiss cookie consent (`#onetrust-accept-btn-handler`) — scroll to top, scrollIntoViewIfNeeded, click
4. Wait 200ms
5. **Select send currency** (only if changed from previous pair):
   - Click `[data-testid="calculator-v2-send-country-select"]`
   - Wait 500ms for listbox to render
   - Find `<li role="option">` whose text includes the currency code (e.g. "AUD")
   - Click it via `page.evaluate()` (element.click())
   - Wait 2000ms for rate to update
6. **Select receive currency** (every pair):
   - Click `[data-testid="calculator-v2-receive-country-select"]`
   - Wait 500ms for listbox to render
   - Find `<li role="option">` whose text includes the currency code (e.g. "GHS")
   - Click it via `page.evaluate()` (element.click())
   - Wait 2000ms for rate to update
7. **Set send amount**:
   - Fill first `input[aria-label="pricing-calculator-input-label"]` with sendAmount
   - Wait 2000ms for calculation
8. **Read receive amount**:
   - Use `page.evaluate()` to read `element.value` from both pricing-calculator-input-label inputs
   - Calculate rate: receiveAmount / sendAmount

**Data Extraction**:
- **Exchange rate**: `recvAmt / sendAmt` from calculator inputs via `page.evaluate()`
- **Receive amount**: Value of second pricing-calculator-input-label input
- **Fee**: Not extractable (returns null)

**Fallback**: If input values are invalid, regex-scan body text for `1 {sendCurrency} = {rate} {receiveCurrency}`.

## Currency Selection — Critical Implementation Details

### Selection Method: Find LI by text, click via JS

The MUI Autocomplete listbox IDs are dynamic and change when the send currency changes. IDs **cannot be cached**. The correct approach:

```javascript
// Open dropdown, find matching LI by text content, click it
await page.locator(buttonSelector).first().click();
await page.waitForTimeout(500);

await page.evaluate((code) => {
  const listboxes = document.querySelectorAll('[role="listbox"]');
  for (const lb of listboxes) {
    if (lb.offsetParent !== null && lb.children.length > 0) {
      const items = Array.from(lb.querySelectorAll('li'));
      const match = items.find(li => li.textContent.trim().includes(code));
      if (match) { match.click(); return true; }
    }
  }
  return false;
}, currencyCode);

await page.waitForTimeout(2000);
```

### Send Currency Grouping Optimization

The CSV pairs are grouped by send currency (AUD→*, CAD→*, EUR→*, etc.). The provider tracks `currentSendCurrency` at module level and only clicks the send dropdown when the currency changes. This saves ~5s per pair within the same send group.

### Why Search/Type Approach Failed

Early attempts used `input.fill()` + typing to filter the listbox. This failed because:
- Send dropdown: listbox disappears entirely after typing a search term
- Receive dropdown: search works but Playwright couldn't click filtered items (display:none)
- Solution: skip search entirely, find the correct LI by text match from the full list and click it

### React Input Value Access

React-managed inputs do NOT expose their current value via cheerio `attr('value')`. Must use `page.evaluate()` to read `element.value` directly from the DOM.

## Cookie/Consent Handling

WorldRemit uses OneTrust:
- Button: `#onetrust-accept-btn-handler`
- Must `scrollTo(0, 0)` before waiting (button may be cut off at viewport top)
- Must `scrollIntoViewIfNeeded()` before clicking
- Must `scrollTo(0, 0)` after clicking (calculator inputs may be off-screen)

## Viewport

- Width: 600, Height: 1000 (larger than default to prevent cookie banner cutoff)

## Architecture

### File Structure

```
src/providers/worldremit.js
```

### Component Details

- **Module**: `src/providers/worldremit.js`
- **Exports**: `{ name: 'WorldRemit', fetchRate(page, sendCurrency, receiveCurrency, sendAmount) }`
- **Dependencies**: `../config` (TIMEOUTS)
- **State**: `currentSendCurrency` (module-level, for grouping optimization)
- **Strategy**: Interactive calculator only (no static URL support)

### Key Selectors

| Purpose | Selector |
|---------|----------|
| Send currency button | `[data-testid="calculator-v2-send-country-select"]` |
| Send currency listbox | `#calculator-v2-send-country-search-input-listbox` |
| Receive currency button | `[data-testid="calculator-v2-receive-country-select"]` |
| Receive currency listbox | `#calculator-v2-receive-country-search-input-listbox` |
| Calculator inputs | `input[aria-label="pricing-calculator-input-label"]` |
| Cookie accept | `#onetrust-accept-btn-handler` |

### Listbox Item Structure

```html
<li tabindex="-1" role="option" id="calculator-v2-{send|receive}-country-search-input-option-{N}" data-option-index="{N}" aria-disabled="false" aria-selected="false" class="MuiAutocomplete-option ...">
  <div>
    <img data-testid="country-flag-{cc}" alt="{cc} flag" ... />
    <p>{COUNTRY_NAME}</p>
    <p><b>{CURRENCY_CODE}</b></p>
  </div>
</li>
```

## Verified Rates (2026-04-25)

| Send | Receive | Rate |
|------|---------|------|
| AUD | GHS | 7.92917 |
| AUD | INR | 67.899 |
| AUD | KES | 93.059 |
| AUD | MXN | 12.174 |
| AUD | NGN | 1014.426 |
| AUD | PHP | 43.35 |
| AUD | PKR | 207.385 |
| GBP | PHP | 82.069 |
| USD | INR | 93.883 |
| EUR | KES | 150.044 |
| CAD | NGN | 979.342 |
| PLN | MXN | 4.7532 |

All 42 pairs verified in headless mode: **42/42 successful, 0 failed**.

## Tasks

- [x] Task 1: Implement interactive currency selection via listbox text matching
- [x] Task 2: Click options via page.evaluate() (Playwright locator can't see display:none items)
- [x] Task 3: Read rate from calculator input values via page.evaluate() (React state)
- [x] Task 4: Add cookie consent dismissal with scroll handling
- [x] Task 5: Add send currency grouping optimization (skip redundant clicks)
- [x] Task 6: Verify viewport 600x1000 for cookie banner visibility
- [x] Task 7: Test all 42 pairs headless — all pass

## Testing

### Test Cases

1. **Rate extraction — AUD→GHS**
   - Given: Calculator loaded, AUD→GHS, amount=1000
   - When: fetchRate completes
   - Then: Returns exchangeRate ≈ 7.93

2. **Send currency grouping**
   - Given: AUD→GHS just completed, next pair is AUD→INR
   - When: fetchRate(AUD, INR) called
   - Then: Send dropdown is NOT clicked (already on AUD)

3. **Edge case — unsupported corridor**
   - Given: Currency not in dropdown listbox
   - When: fetchRate called
   - Then: Returns null values gracefully

## Success Criteria

- [x] All tasks completed
- [x] Interactive calculator works for all 42 pairs
- [x] Send currency grouping optimization reduces redundant clicks
- [x] Cookie banner handled correctly
- [x] No crashes on any pair

---

_Created: 2026-04-25_
