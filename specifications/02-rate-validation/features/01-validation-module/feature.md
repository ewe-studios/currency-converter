# Feature: Validation Module

## Description

Create a validation module that checks extracted rates against market reference bounds and flags anomalies. Integrated into the scraper engine, it runs after each `fetchRate()` call.

## Requirements

- File: `src/validator.js`
- Exports `validateRate(result, options)` function
- Options: `{ strict: boolean, report: boolean }`
- Returns validation status: `"valid"`, `"suspect"`, or `"invalid"`
- Writes validation report entries when `report: true`

## Validation Stages

### Stage 1: Bounds Check

Compare `result.exchangeRate` against `getBounds(sendCurrency, receiveCurrency)`:

- If within bounds → `"valid"`
- If outside bounds but within 2x the tolerance → `"suspect"` (trigger retry with fresh page)
- If outside 2x tolerance or null/zero → `"invalid"` (set exchangeRate to null, record error)

### Stage 2: Sanity Checks (always run)

Regardless of bounds check, also verify:

- `exchangeRate` is a finite positive number
- `exchangeRate` is not equal to `sendAmount` (common parsing bug where receive amount is mistaken for rate)
- `exchangeRate` is not within 1% of another currency pair's rate for the same provider (scrambled rate detection)
- `exchangeRate` order of magnitude is correct (e.g., NGN rates should be ~1000s, not ~1s or ~100000s)

### Stage 3: Cross-Provider Consistency (only on `--all` runs)

After all providers complete for a given pair:

- Calculate median rate across all successful providers
- Flag any provider rate deviating > 20% from the median
- These are written to the validation report but do not change the individual rate status

## Output

Validation results are attached to each rate record:

```json
{
  "provider": "Ria",
  "sendCurrency": "USD",
  "receiveCurrency": "NGN",
  "exchangeRate": 1550.0,
  "receiveAmount": 1550000,
  "fee": null,
  "timestamp": "2026-05-16T10:00:00Z",
  "success": true,
  "validation": {
    "status": "valid",
    "deviationFromMid": 2.3,
    "boundsMin": 1162.5,
    "boundsMax": 1937.5
  }
}
```

Suspect/invalid records include:

```json
{
  "validation": {
    "status": "suspect",
    "deviationFromMid": 215.6,
    "boundsMin": 1162.5,
    "boundsMax": 1937.5,
    "retryAttempted": true,
    "retrySucceeded": false
  }
}
```

## Validation Report

`output/validation-report.json`:

```json
{
  "generatedAt": "2026-05-16T10:00:00Z",
  "totalRates": 363,
  "validRates": 293,
  "suspectRates": 40,
  "invalidRates": 30,
  "nullRates": 99,
  "byProvider": {
    "Ria": { "valid": 2, "suspect": 40, "invalid": 0, "null": 7 },
    ...
  },
  "anomalies": [
    {
      "provider": "Ria",
      "pair": "USD/NGN",
      "extractedRate": 49200,
      "expectedMid": 1550,
      "deviation": 3077.4,
      "status": "invalid"
    }
  ],
  "crossProvider": [
    {
      "pair": "USD/NGN",
      "median": 1545.0,
      "providers": {
        "Wise": { "rate": 1540.0, "deviation": 0.3 },
        "Ria": { "rate": 49200, "deviation": 3085.0, "flagged": true }
      }
    }
  ]
}
```

## Integration Points

- `src/scraper.js`: Call `validateRate()` after each `fetchRate()`, retry if suspect
- `src/index.js`: Generate validation report at end of run
- `src/output.js`: Include validation fields in NDJSON/JSON/CSV output

## Tasks

- [ ] Create `src/validator.js` with bounds checking and sanity validation
- [ ] Add `validateRate()` call in `src/scraper.js` after `fetchRate()`
- [ ] Implement retry logic for suspect rates (one retry with fresh page)
- [ ] Add cross-provider consistency check (runs after all providers complete)
- [ ] Generate `output/validation-report.json` at end of run
- [ ] Add validation fields to output format (NDJSON, JSON, CSV)
- [ ] Add `--strict` CLI flag that rejects suspect rates (sets to null instead)
- [ ] Write unit tests for validation logic with edge cases

## Verification

- Running with known bad data flags it as suspect/invalid
- Valid rates from all providers pass bounds check
- Cross-provider report identifies Ria as outlier for USD/NGN
- Validation report generates with correct counts
- `--strict` mode converts suspect rates to null

---

_Created: 2026-05-16_
