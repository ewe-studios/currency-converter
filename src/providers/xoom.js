const { TIMEOUTS, CURRENCY_COUNTRY_MAP } = require('../config');

module.exports = {
  name: 'Xoom',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const receiveCountry = CURRENCY_COUNTRY_MAP[receiveCurrency];
    if (!receiveCountry) {
      return { exchangeRate: null, receiveAmount: null, fee: null };
    }

    const currency = sendCurrency.toLowerCase();
    const url = `https://www.xoom.com/en-us/${currency}/send-money/transfer?countryCode=${receiveCountry.code}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(4000);

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
