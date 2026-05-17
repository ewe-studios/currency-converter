const { TIMEOUTS, CURRENCY_COUNTRY_MAP } = require('../config');
const cheerio = require('cheerio');

let currentPage = null;
let currentSendCurrency = null;

function reset() {
  currentPage = null;
  currentSendCurrency = null;
}

module.exports = {
  name: 'Ria',
  reset,

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    if (currentPage !== page) {
      const url = 'https://www.riamoneytransfer.com/en-us/rates-conversion/';
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
      await dismissCookieBanner(page);
      await page.locator('#currencyFrom').waitFor({ timeout: 5000 });
      currentPage = page;
      currentSendCurrency = null;
    }

    // Change receive currency first
    const recvCombobox = page.locator('#currency-selector-currencyTo').first();
    await recvCombobox.waitFor({ timeout: 5000 }).catch(() => {});
    if (await recvCombobox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await recvCombobox.click();
      const option = page.locator('[role="option"]').filter({ hasText: receiveCurrency }).first();
      await option.waitFor({ timeout: 5000 });
      await option.click();
    }

    // Change send currency only if different
    if (sendCurrency !== currentSendCurrency) {
      const sendCombobox = page.locator('#currency-selector-currencyFrom').first();
      if (await sendCombobox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sendCombobox.click();
        const option = page.locator('[role="option"]').filter({ hasText: sendCurrency }).first();
        await option.waitFor({ timeout: 5000 });
        await option.click();
      }
      currentSendCurrency = sendCurrency;
    }

    // Fill send amount
    const amountInput = page.locator('#currencyFrom').first();
    await amountInput.click({ clickCount: 3 });
    await amountInput.fill(String(sendAmount));

    // Wait for .result to show BOTH currencies — prevents reading stale previous pair rate
    await page.waitForFunction(({ send, recv }) => {
      const el = document.querySelector('.result');
      return el && el.textContent.includes(send) && el.textContent.includes(recv);
    }, { send: sendCurrency, recv: receiveCurrency }, { timeout: 10000 }).catch(() => {});

    // Render delay for React to finish updating
    await page.waitForTimeout(1000);

    // Extract via live DOM read — React state, not static HTML attributes
    const amounts = await page.evaluate(() => {
      const resultEl = document.querySelector('.result');
      const resultText = resultEl?.textContent?.trim() || '';
      const currencyToInput = document.querySelector('#currencyTo');
      const inputValue = currencyToInput?.value || null;
      return { resultText, inputValue };
    });

    // Priority 1: .result text "1.00000 USD = 0.85427 EUR"
    if (amounts.resultText) {
      const m = amounts.resultText.match(
        new RegExp(`[\\d.,]+\\s+${sendCurrency}\\s*=?\\s*([\\d.,]+)\\s*${receiveCurrency}`, 'i')
      );
      if (m) {
        const exchangeRate = parseFloat(m[1].replace(/,/g, ''));
        if (exchangeRate > 0.001 && exchangeRate < 1000000) {
          return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
        }
      }
    }

    // Priority 2: #currencyTo input value (live DOM, not cheerio attr)
    if (amounts.inputValue) {
      const rate = parseFloat(amounts.inputValue.replace(/,/g, ''));
      if (rate > 0.001 && rate < 1000000) {
        return { exchangeRate: rate, receiveAmount: rate * sendAmount, fee: null };
      }
    }

    return { exchangeRate: null, receiveAmount: null, fee: null };
  },
};

async function dismissCookieBanner(page) {
  try {
    const selectors = [
      '#onetrust-accept-btn-handler',
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
