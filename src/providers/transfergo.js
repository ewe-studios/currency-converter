const { TIMEOUTS } = require('../config');

let currentPage = null;
let currentSendCurrency = null;

function reset() {
  currentPage = null;
  currentSendCurrency = null;
}

module.exports = {
  name: 'TransferGo',
  reset,

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const converterUrl = 'https://www.transfergo.com/currency-converter';
    const needsNav = currentPage !== page || !page.url().includes('currency-converter');

    if (needsNav) {
      await page.goto(converterUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
      await dismissOverlays(page);
      await page.locator('input.currency-converter-calculator__currency-amount').first().waitFor({ timeout: 5000 });
      currentPage = page;
      currentSendCurrency = null;
    } else {
      await dismissOverlays(page);
    }

    // Select receive currency first
    await selectCurrency(page, 1, receiveCurrency);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Select send currency only if different
    if (sendCurrency !== currentSendCurrency) {
      await selectCurrency(page, 0, sendCurrency);
      currentSendCurrency = sendCurrency;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Fill send amount via native setter
    await page.evaluate((val) => {
      const inputs = document.querySelectorAll('input.currency-converter-calculator__currency-amount');
      if (inputs[0]) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(inputs[0], val);
        inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, String(sendAmount));

    // Wait for receive amount to populate
    await page.waitForTimeout(2000);

    const amounts = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input.currency-converter-calculator__currency-amount');
      return Array.from(inputs).map(i => i.value.replace(/[\s,]/g, ''));
    });

    if (amounts.length >= 2 && amounts[0] && amounts[1]) {
      const sendVal = parseFloat(amounts[0]);
      const recvAmt = parseFloat(amounts[1]);
      if (recvAmt > 0 && sendVal > 0) {
        const exchangeRate = recvAmt / sendVal;
        if (exchangeRate > 0.001 && exchangeRate < 1000000) {
          return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
        }
      }
    }

    // Fallback: extract rate from page text
    const bodyText = await page.textContent('body');
    const rateMatch = bodyText.match(
      new RegExp(`1\\s+${sendCurrency}\\s*=\\s*([\\d.,]+)\\s*${receiveCurrency}`, 'i')
    );
    if (rateMatch) {
      const exchangeRate = parseFloat(rateMatch[1].replace(/,/g, ''));
      if (exchangeRate > 0) {
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }

    return { exchangeRate: null, receiveAmount: null, fee: null };
  },
};

async function dismissOverlays(page) {
  // Wait for CMP banner to appear, then remove it
  await page.evaluate(() => {
    const cmp = document.getElementById('cmpwrapper');
    if (cmp) cmp.remove();
    document.querySelectorAll('[class*="overlay"], [class*="cookie"], [class*="consent"]').forEach(el => {
      if (el.offsetParent !== null && el.getBoundingClientRect().width > window.innerWidth * 0.5) {
        el.remove();
      }
    });
  });
  // If CMP reloads, wait and remove again
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const cmp = document.getElementById('cmpwrapper');
    if (cmp) cmp.remove();
  });
}

async function selectCurrency(page, buttonIndex, currencyCode) {
  try {
    // Dismiss CMP overlay that may have appeared
    await page.evaluate(() => {
      const cmp = document.getElementById('cmpwrapper');
      if (cmp) cmp.remove();
    });

    const allBtns = page.locator('.currency-converter-calculator__currency-button');
    const btn = allBtns.nth(buttonIndex);
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.locator('.currency-converter-calculator__currencies-options--open').first().waitFor({ timeout: 3000 });

      await page.evaluate((code) => {
        const openListbox = document.querySelector('.currency-converter-calculator__currencies-options--open');
        if (!openListbox) return;
        const options = Array.from(openListbox.querySelectorAll('.currency-converter-calculator__currencies-option'));
        for (const opt of options) {
          if (opt.textContent.includes(code)) { opt.click(); return; }
        }
      }, currencyCode.toUpperCase());
    }
  } catch {}
}
