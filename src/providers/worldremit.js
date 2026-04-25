const { TIMEOUTS } = require('../config');

module.exports = {
  name: 'WorldRemit',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const url = 'https://www.worldremit.com/en/currency-converter';

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(3000);

    try {
      const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("Got it"), [data-testid="cookie-accept"]');
      if (await cookieBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await cookieBtn.first().click();
        await page.waitForTimeout(500);
      }
    } catch {}

    const sendInput = page.locator('input[type="text"], input[type="number"]').first();
    if (await sendInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await sendInput.fill(String(sendAmount));
    }

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
