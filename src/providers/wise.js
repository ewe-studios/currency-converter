const { TIMEOUTS } = require('../config');

module.exports = {
  name: 'Wise',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const from = sendCurrency.toLowerCase();
    const to = receiveCurrency.toLowerCase();
    const url = `https://wise.com/gb/currency-converter/${from}-to-${to}-rate?amount=${sendAmount}`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });

    await page.waitForTimeout(3000);

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

    const anyRateMatch = bodyText.match(
      new RegExp(`([\\d.,]+)\\s*${receiveCurrency}`, 'i')
    );
    if (anyRateMatch) {
      const receiveAmount = parseFloat(anyRateMatch[1].replace(/,/g, ''));
      return {
        exchangeRate: receiveAmount / sendAmount,
        receiveAmount,
        fee: null,
      };
    }

    return { exchangeRate: null, receiveAmount: null, fee: null };
  },
};
