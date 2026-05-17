const { TIMEOUTS } = require('../config');

let currentPage = null;
let currentOriginCurrency = null;

function reset() {
  currentPage = null;
  currentOriginCurrency = null;
}

module.exports = {
  name: 'Taptap Send',
  reset,

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    if (currentPage !== page) {
      await page.goto('https://www.taptapsend.com/', { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
      await dismissCookieBanner(page);
      await page.locator('#origin-amount').waitFor({ timeout: 5000 });
      // Wait for select options to populate (they load async after domcontentloaded)
      await page.waitForFunction(() => {
        const sel = document.getElementById('origin-currency');
        return sel && sel.options && sel.options.length > 5;
      }, { timeout: 5000 }).catch(() => {});
      currentPage = page;
      currentOriginCurrency = null;
    }

    // Change origin currency if different
    if (sendCurrency !== currentOriginCurrency) {
      const changed = await selectCurrencyBySelect(page, '#origin-currency', sendCurrency);
      if (!changed) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        currentOriginCurrency = null;
        return { exchangeRate: null, receiveAmount: null, fee: null };
      }
      currentOriginCurrency = sendCurrency;
    }

    // Always change destination currency
    await selectCurrencyBySelect(page, '#destination-currency', receiveCurrency);

    // Fill send amount via native input setter
    await page.evaluate((val) => {
      const input = document.getElementById('origin-amount');
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, val);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, String(sendAmount));

    // Wait for destination amount to populate
    await page.waitForFunction(() => {
      const dest = document.getElementById('destination-amount');
      return dest && dest.value && parseFloat(dest.value.replace(/,/g, '')) > 0;
    }, { timeout: 5000 }).catch(() => {});

    // Read live values via JS
    const amounts = await page.evaluate(() => {
      const origin = document.getElementById('origin-amount');
      const dest = document.getElementById('destination-amount');
      return {
        origin: origin?.value,
        dest: dest?.value,
      };
    });

    if (amounts.dest && parseFloat(amounts.dest) > 0) {
      const recvAmt = parseFloat(amounts.dest.replace(/,/g, ''));
      const exchangeRate = recvAmt / sendAmount;
      if (exchangeRate > 0.001 && exchangeRate < 1000000) {
        return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
      }
    }

    // Fallback: read rate from #fxRateText
    const rateText = await page.locator('#fxRateText').textContent().catch(() => '');
    const rateMatch = rateText.match(
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

async function dismissCookieBanner(page) {
  try {
    const selectors = ['#onetrust-accept-btn-handler', 'button:has-text("Accept")'];
    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        break;
      }
    }
  } catch {}
}

async function selectCurrencyBySelect(page, selectId, currencyCode) {
  try {
    const optionValue = await page.evaluate(({ selector, code }) => {
      const options = Array.from(document.querySelectorAll(selector + ' option'));
      for (const opt of options) {
        if (opt.value.includes(code)) {
          return opt.value;
        }
      }
      return null;
    }, { selector: selectId, code: currencyCode });

    if (!optionValue) {
      return false;
    }

    await page.selectOption(selectId, optionValue);
    await page.waitForTimeout(800);
    return true;
  } catch {
    return false;
  }
}
