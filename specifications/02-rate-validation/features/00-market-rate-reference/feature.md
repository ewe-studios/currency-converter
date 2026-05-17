# Feature: Market Rate Reference Data

## Description

Create a reference data module with approximate mid-market exchange rates for all supported currency pairs. These rates serve as sanity bounds for the validation layer, not as exact values.

## Requirements

- File: `src/market-rates.js`
- Exports a map keyed by `${sendCurrency}-${receiveCurrency}` (e.g., `"USD-NGN"`)
- Each entry has: `mid` (approximate mid-market rate), `tolerance` (acceptable deviation, default 0.15)
- Rates should be within ~10% of actual market rates to be useful
- Volatile pairs (especially NGN) should have wider tolerance (0.25)
- Exports a `getBounds(sendCurrency, receiveCurrency)` helper that returns `{ min, max, mid }`
- No external API calls — self-contained data

## Supported Pairs

7 send currencies (AED, AUD, CAD, EUR, GBP, PLN, USD) × 7 receive currencies (GHS, INR, KES, MXN, NGN, PHP, PKR) = 49 pairs.

Approximate mid-market rates (1 unit of send = X units of receive), May 2026:

| Send | GHS | INR | KES | MXN | NGN | PHP | PKR |
|------|-----|-----|-----|-----|-----|-----|-----|
| USD | 15.0 | 85.5 | 130.0 | 19.5 | 1550.0 | 58.0 | 283.0 |
| GBP | 20.0 | 113.5 | 172.0 | 25.8 | 2050.0 | 76.8 | 375.0 |
| EUR | 17.0 | 96.5 | 147.0 | 22.0 | 1760.0 | 65.5 | 320.0 |
| CAD | 11.0 | 62.5 | 95.0 | 14.2 | 1130.0 | 42.5 | 207.0 |
| AUD | 9.5 | 54.5 | 83.0 | 12.3 | 980.0 | 36.8 | 180.0 |
| AED | 4.1 | 23.3 | 35.4 | 5.3 | 422.0 | 15.8 | 77.0 |
| PLN | 3.8 | 21.5 | 32.8 | 4.9 | 393.0 | 14.6 | 71.0 |

These are derived from USD cross-rates and should be verified against a live source during implementation.

## Tasks

- [ ] Create `src/market-rates.js` with rate data for all 49 pairs
- [ ] Export `MARKET_RATES` map and `getBounds(send, receive)` function
- [ ] Write unit tests verifying bounds are reasonable (min < mid < max, no inverted pairs)
- [ ] Add CLI flag or command to regenerate rates from a live source (e.g., Wise API)

## Verification

- `getBounds('USD', 'NGN')` returns min ~1317, max ~1782 (with 15% tolerance)
- `getBounds('USD', 'NGN')` with 25% tolerance: min ~1162, max ~1937
- `getBounds('USD', 'GHS')` returns min ~12.75, max ~17.25
- All 49 pairs present in the map
- No rate is zero, negative, or NaN

---

_Created: 2026-05-16_
