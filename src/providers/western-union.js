const { TIMEOUTS, CURRENCY_COUNTRY_MAP } = require('../config');
const cheerio = require('cheerio');

module.exports = {
  name: 'Western Union',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const fromCountry = CURRENCY_COUNTRY_MAP[sendCurrency];
    const toCountry = CURRENCY_COUNTRY_MAP[receiveCurrency];
    if (!fromCountry || !toCountry) {
      return { exchangeRate: null, receiveAmount: null, fee: null };
    }

    // Try method 1: currency converter page with dropdown
    const result1 = await tryConverterPage(page, sendCurrency, receiveCurrency, sendAmount, fromCountry);
    if (result1.exchangeRate) return result1;

    // Try method 2: send money flow as fallback
    return await trySendMoneyFlow(page, sendCurrency, receiveCurrency, sendAmount, fromCountry, toCountry);
  },
};

async function tryConverterPage(page, sendCurrency, receiveCurrency, sendAmount, fromCountry) {
  const countrySlug = fromCountry.code.toLowerCase();
  const url = `https://www.westernunion.com/${countrySlug}/en/currency-converter.html`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
  await page.waitForTimeout(200);

  await dismissCookieBanner(page);

  // Fill the send amount
  const amountInput = page.locator(`input[id="wu-input-${sendCurrency}"]`).first();
  await amountInput.waitFor({ timeout: 10000 });
  await amountInput.click({ clickCount: 3 });
  await amountInput.fill(String(sendAmount));

  // Open the receiver currency dropdown
  await page.locator('#receiverCurrencyDrop').first().click({ timeout: 10000 });
  await page.waitForTimeout(500);

  // Find and click the <a> element that matches our pair
  const targetLink = page.locator(`a[href*="/${sendCurrency.toLowerCase()}-to-${receiveCurrency.toLowerCase()}-rate.html"]`).first();
  if (!(await targetLink.isVisible({ timeout: 3000 }).catch(() => false))) {
    return { exchangeRate: null, receiveAmount: null, fee: null };
  }
  await targetLink.click({ timeout: 5000 });

  // Wait for rate to populate
  await page.waitForTimeout(2000);
  await page.waitForFunction((cur) => {
    const el = document.querySelector('.fx-to');
    return el && el.textContent.includes(cur);
  }, receiveCurrency, { timeout: 10000 }).catch(() => {});

  return extractRateFromConverter(page, sendCurrency, receiveCurrency, sendAmount);
}

async function trySendMoneyFlow(page, sendCurrency, receiveCurrency, sendAmount, fromCountry, toCountry) {
  const countrySlug = fromCountry.code.toLowerCase();
  const url = `https://www.westernunion.com/${countrySlug}/en/web/send-money/start` +
    `?ReceiveCountry=${toCountry.code}` +
    `&ISOCurrency=${receiveCurrency}` +
    `&SendAmount=${sendAmount}` +
    `&FundsOut=BA&FundsIn=undefined`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
  await page.waitForTimeout(200);
  await dismissCookieBanner(page);

  // Wait for redirect to /estimate-details or for rate to appear
  await page.waitForTimeout(5000);

  const html = await page.content();
  const $ = cheerio.load(html);

  // 1. #exchangeRate (GBP→GHS style): "1.00 GBP = 15.0395 GHS"
  const rateEl = $('#exchangeRate');
  if (rateEl.length) {
    const text = rateEl.text().trim();
    const parts = text.split('=');
    if (parts.length >= 2) {
      const rateNumber = parts[1].trim().split(/\s+/)[0].replace(/,/g, '');
      const exchangeRate = parseFloat(rateNumber);
      if (exchangeRate > 0.001 && exchangeRate < 1000000) {
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }
  }

  // 2. #smoExchangeRate: "1.00 GBP = 15.0395 Ghanaian Cedi (GHS)"
  const smoRateEl = $('#smoExchangeRate');
  if (smoRateEl.length) {
    const text = smoRateEl.text().trim();
    const parts = text.split('=');
    if (parts.length >= 2) {
      const rateNumber = parts[1].trim().split(/\s+/)[0].replace(/,/g, '');
      const exchangeRate = parseFloat(rateNumber);
      if (exchangeRate > 0.001 && exchangeRate < 1000000) {
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }
  }

  // 3. Estimate details page: "Estimated rate  1 AED = 3.0102 GHS"
  const estimatedRate = page.locator('span.label_estimate_details_exchangeRate, .TransactionDetails_stepLineItem__EiqH9').first();
  if (await estimatedRate.isVisible({ timeout: 2000 }).catch(() => false)) {
    const text = await estimatedRate.textContent();
    const match = text.match(new RegExp(`1\\s+${sendCurrency}\\s*=\\s*([\\d.,]+)\\s*${receiveCurrency}`, 'i'));
    if (match) {
      const exchangeRate = parseFloat(match[1].replace(/,/g, ''));
      if (exchangeRate > 0.001 && exchangeRate < 1000000) {
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }
  }

  // 4. Payment method dropdown: "Fees 7.50 AED, 1 AED = 3.0102 GHS"
  const payOptLabel = $('.FIFOSelect_option-label-sub__m3NRy').first();
  if (payOptLabel.length) {
    const text = payOptLabel.text().trim();
    const match = text.match(new RegExp(`1\\s+${sendCurrency}\\s*=\\s*([\\d.,]+)\\s*${receiveCurrency}`, 'i'));
    if (match) {
      const exchangeRate = parseFloat(match[1].replace(/,/g, ''));
      if (exchangeRate > 0.001 && exchangeRate < 1000000) {
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }
  }

  // 5. Fallback: scan body for "X SENDCURR = Y RECEIVCURR" pattern
  const bodyText = $('body').text();
  const rateMatch = bodyText.match(
    new RegExp(`1\\s+${sendCurrency}\\s*=\\s*([\\d.,]+)\\s*${receiveCurrency}`, 'i')
  );
  if (rateMatch) {
    const exchangeRate = parseFloat(rateMatch[1].replace(/,/g, ''));
    if (exchangeRate > 0.001 && exchangeRate < 1000000) {
      return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
    }
  }

  return { exchangeRate: null, receiveAmount: null, fee: null };
}

async function extractRateFromConverter(page, sendCurrency, receiveCurrency, sendAmount) {
  const html = await page.content();
  const $ = cheerio.load(html);

  // Look for .fx-to span
  const fxTo = $('.fx-to');
  for (let i = 0; i < fxTo.length; i++) {
    const text = $(fxTo[i]).text().trim();
    const match = text.match(new RegExp(`([\\d,]+\\.?\\d*)\\s*${receiveCurrency}`, 'i'));
    if (match) {
      const exchangeRate = parseFloat(match[1].replace(/,/g, ''));
      if (exchangeRate > 0.001 && exchangeRate < 1000000) {
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }
  }

  // Fallback: scan body text
  const bodyText = $('body').text();
  const rateMatch = bodyText.match(
    new RegExp(`1[.,]?0*\\s+${sendCurrency}\\s*[–=:]\\s*([\\d.,]+)\\s*${receiveCurrency}`, 'i')
  );
  if (rateMatch) {
    const exchangeRate = parseFloat(rateMatch[1].replace(/,/g, ''));
    if (exchangeRate > 0.001 && exchangeRate < 1000000) {
      return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
    }
  }

  return { exchangeRate: null, receiveAmount: null, fee: null };
}

async function dismissCookieBanner(page) {
  try {
    const selectors = [
      '#accept-recommended-btn-handler',
      '#onetrust-accept-btn-handler',
      'button:has-text("Allow All")',
      'button:has-text("Accept")',
    ];
    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        break;
      }
    }
  } catch {}
}
