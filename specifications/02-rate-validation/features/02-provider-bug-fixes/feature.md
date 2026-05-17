# Feature: Provider Bug Fixes

## Description

Fix extraction bugs in four providers (Ria, Remitly, Taptap Send, TransferGo) that cause systematic rate anomalies. Each provider has a distinct root cause requiring targeted fixes.

## Ria (40 anomalies, rates scrambled across pairs)

### Root Cause Analysis

Ria uses a single page session with currency dropdowns that change between pairs. The `.result` element text pattern `1.00000 USD = 0.85427 EUR` is being extracted incorrectly because:

1. The React state update race condition — the `.result` element may still show the previous pair's rate when we read it
2. The `#currencyTo` attribute value fallback (`$('#currencyTo').attr('value')`) reads stale DOM state, not the live calculated value
3. The regex `[\d.,]+\s+${sendCurrency}\s*=?\s*([\d.,]+)\s*${receiveCurrency}` can match the wrong part of the page if the currencies appear in multiple places

### Fixes

- After changing currencies, wait for `.result` text to include BOTH the new send AND receive currency before extracting
- Replace the `#currencyTo` attribute fallback with a live `page.evaluate()` that reads the input's current value property
- Add a 1-second minimum render delay after the React update check
- If extracted rate fails validation, retry with a full page reload (not just currency change)

## Remitly (14 anomalies, 100x-1,000,000x too high)

### Root Cause Analysis

Remitly's rate extraction picks up numbers from the page that are not the exchange rate:

1. The "Special rate" / "Everyday rate" div text may contain multiple numbers (fees, amounts) and the regex grabs the wrong one
2. The receiveAmount section might parse a formatted number with wrong decimal placement (e.g., "1,234.56" parsed as 123456)
3. The fallback body text regex matches any occurrence of `1 USD = X PHP` pattern, including in footnotes or promotional text

### Fixes

- Tighten the rate regex to match only the first number after `= ` in the rate div
- Validate that the extracted rate's order of magnitude matches the expected pair before returning
- Add a secondary confirmation step: if the rate from the "Special rate" div doesn't match the receive amount divided by send amount, use the receive amount calculation instead
- Remove the body text fallback entirely — it is too unreliable for Remitly's page structure

## Taptap Send (7 anomalies, AED rates match USD rates)

### Root Cause Analysis

The `selectCurrency()` function uses `page.evaluate()` to find and select currency options by text. When switching from USD to AED as the send currency:

1. The `<select>` element's option text may contain both the currency code and country name (e.g., "AED - UAE Dirham"), and the `.includes(code)` check may match "AED" in a USD option if the country name contains similar text
2. More likely: the `page.selectOption()` call silently fails when the option value doesn't match what the React component expects, leaving the currency unchanged
3. The `currentOriginCurrency` state variable may get out of sync with the actual page state

### Fixes

- Replace `page.selectOption()` with a click-based approach: open the dropdown, find the option element by exact text match, and click it
- After selecting, verify the displayed currency actually changed by reading the current selection via `page.evaluate()`
- If the currency didn't change, retry with a page reload
- Reset `currentOriginCurrency` to null if a page reload occurs

## TransferGo (5 anomalies, rates 70-94% below market for NGN/INR)

### Root Cause Analysis

TransferGo's calculator uses React state that may not update properly:

1. The currency selection dropdowns use class-based state management; clicking an option may not trigger the rate recalculation
2. The receive amount input may show a placeholder or default value instead of the calculated amount
3. The CSS selectors `currency-converter-calculator__currency-amount` may match multiple inputs, causing the wrong values to be read

### Fixes

- After selecting currencies and filling the amount, wait for the rate display to change by tracking the previous value and polling until it differs
- Read the exchange rate directly from the rate display element rather than computing from send/receive amounts
- Add a `page.evaluate()` that triggers the React input setter on both the send AND receive inputs to force recalculation
- Verify the calculated rate matches `receiveAmount / sendAmount` within 1% before returning

## Tasks

- [ ] Fix Ria: add dual-currency render wait, replace `#currencyTo` attr fallback with live evaluate, add 1s render delay
- [ ] Fix Remitly: tighten rate regex, add magnitude validation, add receive amount confirmation, remove body fallback
- [ ] Fix Taptap Send: replace selectOption with click-based selection, verify currency actually changed
- [ ] Fix TransferGo: add rate change polling, read rate from display element, trigger React input setters on both inputs
- [ ] Add integration tests for each provider fix using mock HTML responses
- [ ] Run full scrape and verify anomalies are resolved

## Verification

- Ria: USD/NGN rate ~1550 (not scrambled values like 49200 or 0.003)
- Remitly: all rates within market bounds (no 100x+ outliers)
- Taptap Send: AED/NGN rate ~1.5x lower than USD/NGN (not identical)
- TransferGo: EUR/NGN and GBP/NGN within 15% of market rate
- All four providers pass validation bounds check for > 90% of pairs

---

_Created: 2026-05-16_
