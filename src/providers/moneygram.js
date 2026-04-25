const { TIMEOUTS, CURRENCY_COUNTRY_MAP } = require('../config');

module.exports = {
  name: 'MoneyGram',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const fromCountry = CURRENCY_COUNTRY_MAP[sendCurrency];
    const toCountry = CURRENCY_COUNTRY_MAP[receiveCurrency];
    if (!fromCountry || !toCountry) {
      return { exchangeRate: null, receiveAmount: null, fee: null };
    }

    const url = `https://www.moneygram.com/mgo/${fromCountry.code.toLowerCase()}/en/`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(4000);

    try {
      const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("I Accept"), #onetrust-accept-btn-handler');
      if (await cookieBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await cookieBtn.first().click();
        await page.waitForTimeout(500);
      }
    } catch {}

    const bodyText = await page.textContent('body');

    const rateMatch = bodyText.match(
      new RegExp(`1\\s+${sendCurrency}\\s*=\\s*([\\d.,]+)\\s*${receiveCurrency}`, 'i')
    );

    if (rateMatch) {
      const exchangeRate = parseFloat(rateMatch[1].replace(/,/g, ''));
      return {
        exchangeRate,
        receiveAmount: exchangeRate * sendAmount,
        fee: null,
      };
    }

    return { exchangeRate: null, receiveAmount: null, fee: null };
  },
};
