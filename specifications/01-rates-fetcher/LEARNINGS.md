# Learnings

## Provider Research (2026-04-25)

### Static vs Interactive Pages
- Many providers offer both a static currency converter page (rate in URL) and an interactive calculator
- Static pages are faster and less prone to bot detection
- Interactive pages are needed as fallback when static pages don't exist or fail

### Anti-Bot Measures
- MoneyGram returns 403 on direct HTTP requests — requires full Playwright browser
- Some providers may use Cloudflare or similar protection
- Realistic user-agent and viewport settings help avoid detection

### URL Patterns Discovered
- Wise: `/gb/currency-converter/{from}-to-{to}-rate` (static) and `/gb/send-money/` (interactive)
- Remitly: `/{fromCountryCode}/en/{toCountrySlug}` and `/us/en/currency-converter/{from}-to-{to}-rate`
- Western Union: `/sg/en/currency-converter.html` (user-provided)
- Xoom: `/en-us/{currency}/send-money/transfer?countryCode={CC}` (user-provided)
- WorldRemit: `/en/currency-converter` (interactive widget)
- Panda Remit: `/en/{country}/{from}-{to}-converter?amount=N`
- TransferGo: `/currency-converter` or homepage calculator

### Rate Text Patterns
- Most providers display rates as "1 USD = X NGN" format
- Xoom shows separate rates for bank deposit vs cash pickup
- Some sites embed rate data in JavaScript variables or API responses

---

_Last Updated: 2026-04-25_
