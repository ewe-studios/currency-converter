const { TIMEOUTS } = require('../config');
const cheerio = require('cheerio');

const SEND_COUNTRY_MAP = {
  CAD: 'Canada',
  EUR: 'Germany',
  GBP: 'United Kingdom',
  USD: 'United States',
};

const RECEIVE_COUNTRY_MAP = {
  GHS: 'Ghana',
  INR: 'India',
  KES: 'Kenya',
  MXN: 'Mexico',
  NGN: 'Nigeria',
  PHP: 'Philippines',
  PKR: 'Pakistan',
};

module.exports = {
  name: 'Sendwave',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const sendCountry = SEND_COUNTRY_MAP[sendCurrency];
    const receiveCountry = RECEIVE_COUNTRY_MAP[receiveCurrency];
    if (!sendCountry || !receiveCountry) {
      return { exchangeRate: null, receiveAmount: null, fee: null };
    }

    await page.goto('https://www.sendwave.com/en/', { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(3000);

    await dismissCookieBanner(page);

    // Wait for calculator inputs to render
    await page.locator('input[type="decimal"]').first().waitFor({ timeout: 5000 });

    // Select send currency
    const sendOk = await selectCountry(page, sendCountry, 'send');
    if (!sendOk) {
      return { exchangeRate: null, receiveAmount: null, fee: null };
    }

    // Select receive currency
    const recvOk = await selectCountry(page, receiveCountry, 'receive');
    if (!recvOk) {
      return { exchangeRate: null, receiveAmount: null, fee: null };
    }

    // Wait for rate to update
    await page.waitForTimeout(2000);

    // Try to read rate from body text first
    const bodyText = await page.evaluate(() => document.body.innerText);
    const rateRegex = new RegExp(`1\\s+${sendCurrency}\\s*=\\s*([\\d.,]+)\\s*${receiveCurrency}`, 'i');
    const rateMatch = bodyText.match(rateRegex);

    if (rateMatch) {
      const exchangeRate = parseFloat(rateMatch[1].replace(/,/g, ''));
      if (exchangeRate > 0) {
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }

    // Fallback: read receive amount from calculator input
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input[type="decimal"]')).map(i => i.value);
    });

    if (inputs.length >= 2 && inputs[1]) {
      const recvAmt = parseFloat(inputs[1].replace(/,/g, ''));
      if (recvAmt > 0) {
        const exchangeRate = recvAmt / sendAmount;
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }

    return { exchangeRate: null, receiveAmount: null, fee: null };
  },
};

async function selectCountry(page, countryName, side) {
  const selector = side === 'send'
    ? '[data-testid="exchange-calculator-send-country-select"]'
    : '[data-testid="exchange-calculator-receive-country-select"]';

  const btn = page.locator(selector).first();
  if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
    return false;
  }

  await btn.click();
  await page.waitForTimeout(1000);

  const searchInput = page.locator('input.MuiAutocomplete-input, input[role="combobox"]').last();
  if (!(await searchInput.isVisible({ timeout: 2000 }).catch(() => false))) {
    return false;
  }

  await searchInput.click();
  await searchInput.fill(countryName);
  await page.waitForTimeout(1000);

  const option = page.locator(`li.MuiAutocomplete-option`).filter({ hasText: countryName }).first();
  if (!(await option.isVisible({ timeout: 2000 }).catch(() => false))) {
    return false;
  }

  await option.click();
  await page.waitForTimeout(1000);

  // The select button shows the currency code (e.g. "EUR"), not the country name
  const btnText = await btn.textContent().catch(() => '');
  const expectedCode = side === 'send'
    ? Object.entries(SEND_COUNTRY_MAP).find(([, v]) => v === countryName)?.[0]
    : Object.entries(RECEIVE_COUNTRY_MAP).find(([, v]) => v === countryName)?.[0];

  if (expectedCode && !btnText.includes(expectedCode)) {
    return false;
  }

  return true;
}

async function dismissCookieBanner(page) {
  try {
    const selectors = ['#onetrust-accept-btn-handler', '.osano-cm-accept-all'];
    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
        break;
      }
    }
  } catch {}
}
