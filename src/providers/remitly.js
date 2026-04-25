const { TIMEOUTS, CURRENCY_COUNTRY_MAP } = require('../config');

module.exports = {
  name: 'Remitly',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const from = sendCurrency.toLowerCase();
    const to = receiveCurrency.toLowerCase();
    const fromCountry = CURRENCY_COUNTRY_MAP[sendCurrency];
    const toCountry = CURRENCY_COUNTRY_MAP[receiveCurrency];

    const countryUrl = fromCountry && toCountry
      ? `https://www.remitly.com/${fromCountry.code.toLowerCase()}/en/${toCountry.slug}`
      : null;
    const converterUrl = `https://www.remitly.com/us/en/currency-converter/${from}-to-${to}-rate`;

    const url = countryUrl || converterUrl;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(3000);

    let bodyText = await page.textContent('body');

    let rateMatch = bodyText.match(
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

    if (countryUrl) {
      await page.goto(converterUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
      await page.waitForTimeout(3000);
      bodyText = await page.textContent('body');

      rateMatch = bodyText.match(
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
    }

    return { exchangeRate: null, receiveAmount: null, fee: null };
  },
};
