const { TIMEOUTS } = require('../config');

module.exports = {
  name: 'Western Union',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const url = 'https://www.westernunion.com/sg/en/currency-converter.html';

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(4000);

    try {
      const cookieBtn = page.locator('button:has-text("Accept"), button:has-text("I Accept"), #onetrust-accept-btn-handler');
      if (await cookieBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await cookieBtn.first().click();
        await page.waitForTimeout(500);
      }
    } catch {}

    try {
      const fromSelect = page.locator('select, [role="listbox"], [data-testid*="from"], [id*="from"], [id*="source"]').first();
      if (await fromSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fromSelect.selectOption({ label: sendCurrency }).catch(() => {});
      }

      const toSelect = page.locator('select, [role="listbox"], [data-testid*="to"], [id*="to"], [id*="target"]').nth(1);
      if (await toSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await toSelect.selectOption({ label: receiveCurrency }).catch(() => {});
      }

      const amountInput = page.locator('input[type="text"], input[type="number"]').first();
      if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await amountInput.fill(String(sendAmount));
        await page.waitForTimeout(2000);
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

    const anyRateMatch = bodyText.match(
      new RegExp(`${sendCurrency}[^\\d]*([\\d.,]+)[^\\d]*${receiveCurrency}`, 'i')
    );
    if (anyRateMatch) {
      const exchangeRate = parseFloat(anyRateMatch[1].replace(/,/g, ''));
      return {
        exchangeRate,
        receiveAmount: exchangeRate * sendAmount,
        fee: null,
      };
    }

    return { exchangeRate: null, receiveAmount: null, fee: null };
  },
};
