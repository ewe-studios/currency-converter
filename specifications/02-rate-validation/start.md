---
description: "Rate validation, anomaly detection, and provider bug fixes to address systematic data quality issues across 11 remittance providers"
status: "proposed"
priority: "critical"
created: 2026-05-16
author: "Main Agent"
metadata:
  version: "1.0"
  last_updated: 2026-05-16
  estimated_effort: "large"
  tags:
    - rate-validation
    - anomaly-detection
    - data-quality
    - bug-fix
    - nodejs
  skills: []
  tools:
    - Node.js
    - npm
    - Playwright
has_features: true
has_fundamentals: false
builds_on: "01-rates-fetcher"
related_specs: ["01-rates-fetcher"]
features:
  completed: 0
  uncompleted: 4
  total: 4
  completion_percentage: 0
---

# Overview

Add a post-extraction validation layer and fix provider-specific bugs to address systematic data quality issues identified in production rate fetching. The current scrapers extract rates but have no sanity checking against known market ranges, allowing wildly incorrect values to pass through silently.

## Problem Statement

Production data analysis of 363 provider quotes across 49 currency pairs revealed:

**Exchange Rate Anomalies (70 detected):**

| Provider | Anomalies | Max Deviation | Pattern |
|----------|-----------|---------------|---------|
| Ria | 40 | 2156% | Systematic data corruption — rates scrambled across pairs |
| Remitly | 14 | 1001997% | Decimal/unit scaling errors (100x-1,000,000x too high) |
| Taptap Send | 7 | 268% | AED rates match USD rates instead of AED rates |
| TransferGo | 5 | 99.80% | Rates 70-94% below market for NGN/INR corridors |
| Western Union | 2 | 7.90% | Minor deviations — likely legitimate |
| Xoom | 2 | 1.60% | Minor deviations — likely legitimate |

**Null/Empty Rates (99 records, 38 provider-currency combos):**

| Provider | Failures | Affected Send | Affected Receive |
|----------|----------|---------------|------------------|
| MoneyGram | 42 | AED, AUD | GHS, INR, KES, MXN, NGN, PHP, PKR |
| Panda Remit | 33 | AUD, CAD, EUR, GBP, USD | GHS, INR, MXN, PKR |
| Sendwave | 24 | CAD, EUR | GHS, INR, KES, MXN, NGN, PHP, PKR |

## Goals

1. Prevent anomalous rates from passing through unchecked — flag or reject rates outside reasonable market bounds
2. Fix provider-specific extraction bugs causing systematic errors in Ria, Remitly, Taptap Send, and TransferGo
3. Reduce null rate failures for MoneyGram, Panda Remit, and Sendwave where possible
4. Produce a validation report alongside the rate output so anomalies are visible at a glance

## Implementation Location

- Validation module: `src/validator.js`
- Market rate reference data: `src/market-rates.js`
- Provider fixes: `src/providers/ria.js`, `src/providers/remitly.js`, `src/providers/taptap-send.js`, `src/providers/transfergo.js`
- Validation report output: `output/validation-report.json`
- Integration: `src/scraper.js`, `src/index.js`

## Known Issues

- Current rate bounds checks (`exchangeRate > 0.001 && exchangeRate < 1000000`) are far too loose — a USD->NGN rate of 500000 would pass
- No cross-provider validation to detect scrambled or swapped rates
- Provider scrapers have no awareness of expected rate magnitudes
- React/state race conditions in interactive scrapers cause stale rate reads

### Resolved Issues

None yet.

## Language Stack

### Languages Used

| Language | Purpose | Skill Location |
|----------|---------|----------------|
| JavaScript (Node.js) | All implementation | `.agents/skills/javascript-clean-code/skill.md` |

### Mandatory Pre-Implementation Steps

1. Read existing spec at `specifications/01-rates-fetcher/requirements.md`
2. Read language skills — locate `.agents/skills/javascript-clean-code/skill.md`
3. Follow standards strictly

### JavaScript Requirements

- CommonJS modules (`require`/`module.exports`)
- Node.js 18+ (v25.3.0 available on this system)
- No TypeScript — plain JavaScript
- No unnecessary comments
- `npm test` must pass before any commit

---

## Architecture

### Validation Pipeline

Rates flow through a two-stage validation:

```
fetchRate() -> { exchangeRate, receiveAmount, fee }
     |
     v
Stage 1: Per-rate bounds check (validator.js)
     |
     +-- within bounds  -> mark "valid", pass through
     +-- out of bounds  -> mark "suspect", retry with fresh page
     +-- still bad      -> mark "invalid", set exchangeRate to null
     |
     v
Stage 2: Cross-provider consistency (optional, on --all runs)
     |
     +-- compare against median of all providers for same pair
     +-- flag outliers that deviate > 20% from median
     |
     v
Output: rates with validation status + validation-report.json
```

### Market Rate Reference

Store approximate mid-market rates for all supported currency pairs. These serve as sanity bounds, not exact values. Each entry defines:

- `mid`: approximate mid-market rate (send=1 unit of receive)
- `tolerance`: acceptable deviation percentage (default 15%)
- `min`: calculated lower bound (mid * (1 - tolerance))
- `max`: calculated upper bound (mid * (1 + tolerance))

Rates are derived from publicly available mid-market data (ECB, XE, or similar). They need periodic updates but don't need real-time accuracy — the tolerance absorbs normal market movement.

### Feature Index

| # | Feature | Description | Dependencies | Status |
|---|---------|-------------|--------------|--------|
| 0 | [market-rate-reference](./features/00-market-rate-reference/feature.md) | Market rate reference data with per-pair bounds | None | Pending |
| 1 | [validation-module](./features/01-validation-module/feature.md) | Rate validator with bounds checking and anomaly flagging | 0 | Pending |
| 2 | [provider-bug-fixes](./features/02-provider-bug-fixes/feature.md) | Fix extraction bugs in Ria, Remitly, Taptap Send, TransferGo | 1 | Pending |
| 3 | [null-rate-reduction](./features/03-null-rate-reduction/feature.md) | Reduce null rate failures for MoneyGram, Panda Remit, Sendwave | 1 | Pending |

Status Key: Pending | In Progress | Complete

---

## Success Criteria (Spec-Wide)

### Functionality
- All rates validated against market bounds before output
- Anomalous rates flagged in output with validation status field
- Validation report generated alongside rates output
- Ria anomalies reduced from 40 to < 5
- Remitly anomalies reduced from 14 to < 3
- Taptap Send AED anomaly eliminated
- TransferGo NGN/INR rates within market bounds
- Null rate failures reduced by at least 50%

### Data Quality
- No rate deviates > 20% from mid-market without being flagged
- No rate passes with a magnitude 10x+ off from expected
- Cross-provider comparison flags pairs where only one provider is an outlier

### Code Quality
- `npm test` passes with all tests green
- Validation module has unit tests covering edge cases
- Provider fixes verified with integration tests

---

_Created: 2026-05-16_
_Last Updated: 2026-05-16_
_Structure: Feature-based (has_features: true)_
