# Rates Fetcher

Scrapes live exchange rates from remittance providers using Playwright browser automation.

## Quick Start

```bash
# Install dependencies + Playwright browsers
npm install
npx playwright install chromium

# Scrape a single provider
npm run scrape:wise

# Scrape all providers
npm run scrape:all
```

## Usage

### CLI Options

| Flag | Description |
|---|---|
| `--all` | Scrape all providers from Provider.csv |
| `--fast` | Scrape all providers except Western Union and MoneyGram |
| `--slow` | Scrape Western Union and MoneyGram only |
| `--provider=Name` | Scrape a specific provider (case-insensitive) |
| `--providers=Name1,Name2` | Scrape multiple providers, comma-separated |
| `--pair=AUD/GHS` | Filter to a single currency pair |
| `--headful` | Open a visible browser window (default: headless) |

### Running Individual Providers

The easiest way is via npm scripts — each provider has one:

```bash
npm run scrape:wise          # Wise (49 pairs)
npm run scrape:remitly       # Remitly (49 pairs)
npm run scrape:worldremit    # WorldRemit (42 pairs)
npm run scrape:western-union # Western Union (49 pairs)
npm run scrape:xoom          # Xoom (35 pairs)
npm run scrape:taptap        # Taptap Send (49 pairs)
npm run scrape:ria           # Ria (42 pairs)
npm run scrape:panda         # Panda Remit (25 pairs)
npm run scrape:sendwave      # Sendwave (42 pairs)
npm run scrape:transfergo    # TransferGo (5 pairs)
npm run scrape:moneygram     # MoneyGram (49 pairs)
```

Or use the CLI flag directly (provider name is case-insensitive):

```bash
node src/index.js --provider=Wise
node src/index.js --provider=remitly         # case-insensitive
node src/index.js --provider="Western Union" # spaces need quotes
node src/index.js --provider="Panda Remit"   # spaces need quotes
```

Combine with `--headful` to watch the browser and debug:

```bash
node src/index.js --provider=Remitly --headful
node src/index.js --provider="WorldRemit" --headful
```

Filter to a single pair for quick testing:

```bash
node src/index.js --provider=Remitly --pair=EUR/GHS
node src/index.js --provider=Wise --pair=USD/NGN --headful
```

### Running Multiple Providers

```bash
# Comma-separated (no spaces around commas)
node src/index.js --providers=Wise,Remitly,WorldRemit

# With spaces in provider names, quote the whole argument
node src/index.js --providers="Western Union,MoneyGram"
```

### Running All Providers

```bash
npm run scrape:all           # all providers
node src/index.js --fast     # skip Western Union and MoneyGram
node src/index.js --slow     # only Western Union and MoneyGram
```

## Currency Pairs

Pairs are defined in `Provider.csv`. Each row specifies a provider, its base URL, and a send/receive currency pair.

| Column | Example |
|---|---|
| `provider_name` | `Wise` |
| `provider_url` | `https://wise.com` |
| `send_currency` | `AUD`, `EUR`, `GBP`, `USD`, etc. |
| `receive_currency` | `GHS`, `INR`, `KES`, `MXN`, `NGN`, `PHP`, `PKR` |

The scraper reads this file, groups pairs by provider, and processes them in CSV order. Pairs sharing a send currency are grouped to minimise redundant dropdown interactions on interactive providers.

To add a new pair, add a row to `Provider.csv` — no code changes required.

## Providers

| Provider | Method | Notes |
|---|---|---|
| Wise | Static HTML | Fastest, no dropdown interaction needed |
| Remitly | Static HTML | Dynamic country prefix based on send currency |
| WorldRemit | Interactive | MUI Autocomplete dropdowns, cookie consent |
| Western Union | Interactive | Country and currency selectors |
| Xoom | Interactive | Bank deposit / cash pickup modes |
| MoneyGram | Interactive | Anti-bot protection (403 on HTTP) |
| Taptap Send | Interactive | Origin/destination dropdowns |
| Ria | Interactive | Currency combobox selectors |
| Panda Remit | Interactive | Converter widget |
| Sendwave | Interactive | Country/currency selectors |
| TransferGo | Interactive | Custom currency selector |

Each provider module (`src/providers/*.js`) exports a `name` and `fetchRate(page, sendCurrency, receiveCurrency, sendAmount)` function. Some providers also implement `discoverSupportedPairs(page)` to pre-filter unsupported pairs.

## Output

### Directory Structure

```
output/                    # --all mode: all results here
  rates.ndjson             # Incremental results (appended per batch)
  rates.json               # Final pretty-printed summary
  rates.csv                # Final flat file
  <provider>.log           # Per-provider diagnostic log
  errors/                  # Screenshots for failed scrapes

output/<provider-slug>/    # Single-provider mode
  rates.ndjson
  rates.json
  rates.csv
  <provider>.log
```

### Output Modes

| Run | Output directory |
|---|---|
| `--all` | `output/` (root) |
| `--provider=Wise` | `output/wise/` |
| `--providers=Wise,Remitly` | `output/wise/` + `output/remitly/` |

### File Formats

**NDJSON** (`rates.ndjson`) — one JSON object per line, appended as each batch completes:
```json
{"provider":"Remitly","sendCurrency":"EUR","receiveCurrency":"GHS","sendAmount":1000,"exchangeRate":12.9864,"receiveAmount":12986.4,"fee":null,"timestamp":"2026-04-26T...","success":true,"error":null}
```

**CSV** (`rates.csv`) — header + rows:
```
provider,sendCurrency,receiveCurrency,sendAmount,exchangeRate,receiveAmount,fee,timestamp,success,error
Remitly,EUR,GHS,1000,12.9864,12986.4,,2026-04-26T...,true,
```

**JSON** (`rates.json`) — array of result objects, built from the NDJSON file:
```json
[
  {"provider":"Remitly","sendCurrency":"EUR","receiveCurrency":"GHS",...},
  {"provider":"Remitly","sendCurrency":"EUR","receiveCurrency":"INR",...}
]
```

**Log** (`<provider>.log`) — detailed diagnostics including failed attempts, error messages, and pair discovery results. The `error` field in CSV/NDJSON shows `unable to acquire` for failures; see the log file for the actual reason.

```
[2026-04-26T00:12:34.567Z] EUR→GHS: rate not found on page after 2 attempts
[2026-04-26T00:12:38.123Z] AUD→GHS: rate=7.9305
[2026-04-26T00:14:01.000Z] Done. 49 pairs processed.
```

**Error screenshots** (`output/errors/`) — PNG screenshots saved when a provider throws an unexpected error.

### Successful vs Failed Results

| Field | Success | Failure |
|---|---|---|
| `success` | `true` | `false` |
| `exchangeRate` | numeric | empty |
| `receiveAmount` | numeric | empty |
| `error` | empty | `unable to acquire` |

## Rate Validation

The scraper validates every extracted rate against reference mid-rates to catch extraction bugs (e.g., parsing a whole number as a per-unit rate).

### How It Works

`src/market-rates.js` defines a reference mid-rate and tolerance for each currency pair. `src/validator.js` classifies each rate into one of three categories:

| Status | Meaning |
|---|---|
| `valid` | Within tolerance of the reference mid-rate |
| `suspect` | Outside tolerance but within 2x tolerance — may be a real market shift or extraction error |
| `invalid` | Exceeds 2x tolerance — almost certainly an extraction bug |

NGN pairs use a wider tolerance (25%) due to higher volatility.

### Strict Mode

Pass `--strict` to reject suspect rates rather than accepting them:

```bash
node src/index.js --all --strict
```

### Validation Report

After every run, a `output/validation-report.json` file is generated with:

- Per-provider breakdown of valid/suspect/invalid/null rates
- Anomaly list with extracted rate, expected mid-rate, and deviation percentage
- Cross-provider comparison — flags providers whose rates deviate >20% from the pair median

```json
{
  "generatedAt": "2026-05-17T06:00:00.000Z",
  "totalRates": 500,
  "validRates": 480,
  "suspectRates": 15,
  "invalidRates": 3,
  "nullRates": 2,
  "byProvider": { "Wise": { "valid": 49, "suspect": 0, "invalid": 0, "null": 0 }, ... },
  "anomalies": [ ... ],
  "crossProvider": [ ... ]
}
```

## Cloudflare D1 API

Scraped rates can be persisted to a Cloudflare D1 SQLite database and queried via a serverless REST API.

### Setup

```bash
# 1. Create the D1 database
npx wrangler d1 create currency-rates
# Copy the database_id into api/wrangler.toml

# 2. Initialise the schema
npm run d1:init

# 3. Deploy the Worker
npx wrangler deploy
```

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/rates?provider=Wise&send=EUR&receive=GHS&limit=100` | Query rates with filters |
| `GET /api/latest?send=EUR&receive=GHS` | Most recent successful rate for a pair |
| `GET /api/providers` | List all providers with stored data |
| `GET /api/summary` | Per-provider success counts and last scrape time |
| `GET /api/validation?status=suspect` | Query validation results |

All responses include CORS headers for browser access.

### SQL Generation

Convert NDJSON output to SQL INSERT statements:

```bash
# Generate SQL for a specific provider
npm run generate-sql -- "Wise"

# Manually execute against D1
wrangler d1 execute currency-rates --remote --file=./output/insert-rates.sql
```

The SQL generator includes validation fields (`validation_status`, `deviation_from_mid`, `bounds_min`, `bounds_max`) from the rate validator.

## CI/CD Pipeline

A GitHub Actions workflow (`.github/workflows/scrape.yml`) runs daily at 06:00 UTC:

1. Installs Node.js, dependencies, and Playwright Chromium
2. Scrapes each provider **individually** with a 15-minute timeout per provider
3. Generates SQL from the NDJSON output
4. Pushes to D1 — successful providers are committed even if others fail
5. Runs in `--strict` validation mode

Trigger manually via the GitHub Actions "Run workflow" button. Required secrets:

| Secret | Description |
|---|---|
| `CF_API_TOKEN` | Cloudflare API token with D1 + Workers permissions |
| `CF_ACCOUNT_ID` | Cloudflare account ID |

## Configuration

`src/config.js` controls global settings:

| Setting | Default | Description |
|---|---|---|
| `SEND_AMOUNT` | `1000` | Default send amount for rate queries |
| `BROWSER_OPTIONS.headless` | `true` | Override with `--headful` |
| `CONTEXT_OPTIONS.userAgent` | Chrome 125 | Browser identity |
| `CONTEXT_OPTIONS.viewport` | 600x1000 | Browser window size |
| `TIMEOUTS.navigation` | 30000ms | Max page load time |
| `TIMEOUTS.betweenRequests` | 2000ms | Delay between currency pairs |

## Architecture

```
src/index.js            Entry point: parses args, loads CSV, calls scraper, runs validation
src/scraper.js          Orchestrates browser, iterates providers + pairs, validates rates
src/output.js           Writes rates.ndjson, rates.csv, rates.json, logs
src/csv-parser.js       Parses Provider.csv into provider/pair structure
src/config.js           Global settings (timeouts, browser options)
src/validator.js        Rate validation against market reference rates
src/market-rates.js     Reference mid-rates and tolerance bounds per pair
src/providers/          Individual provider scrapers
scripts/generate-sql.js Converts NDJSON output to SQL INSERTs for D1
api/src/index.ts        Cloudflare Worker REST API
api/wrangler.toml       Cloudflare Worker + D1 configuration
schema.sql              D1 database schema
.github/workflows/      GitHub Actions CI/CD pipeline
```

Provider modules reuse a single page per session and track the current send currency to skip redundant dropdown clicks when consecutive pairs share the same send currency.

## Testing

```bash
# Run all tests
npm test

# Test a single provider in the browser
node src/test-provider.js --provider=Remitly --pair=EUR/GHS
```

## Troubleshooting

**All pairs return "unable to acquire"**
- Run in headful mode (`--headful`) to see what the browser sees
- Check the provider log (`output/<slug>/<slug>.log`) for specific error messages
- Check `output/errors/` for saved screenshots

**Provider returns 403 or blocked**
- Some providers (e.g., MoneyGram) block headless detection. Use `--headful` as a workaround
- User-agent and viewport are configured in `src/config.js`

**Timeouts**
- Navigation timeout: 30s (configurable in `src/config.js`)
- Element wait timeout: varies by provider, typically 3-5s
- Between-requests delay: 2s to avoid rate limiting

**Provider-specific URL patterns**
- Remitly uses country-specific URL prefixes (`/us/en/`, `/gb/en/`, `/de/en/`, etc.) derived from the send currency's country code via `CURRENCY_COUNTRY_MAP`
- Other providers use their base URL from `Provider.csv` plus their own currency converter path
