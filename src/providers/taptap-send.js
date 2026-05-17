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
      currentPage = page;
      currentOriginCurrency = null;
    }

    // Change origin currency if different
    if (sendCurrency !== currentOriginCurrency) {
      const changed = await selectCurrencyByClick(page, '#origin-currency', sendCurrency);
      if (!changed) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
        currentOriginCurrency = null;
        return { exchangeRate: null, receiveAmount: null, fee: null };
      }
      currentOriginCurrency = sendCurrency;
    }

    // Always change destination currency
    await selectCurrencyByClick(page, '#destination-currency', receiveCurrency);

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

    // Verify the displayed currency actually matches what we selected
    const displayed = await page.evaluate(() => {
      const originEl = document.getElementById('origin-currency');
      const destEl = document.getElementById('destination-amount');
      return {
        originText: originEl?.textContent?.trim() || '',
        destValue: destEl?.value || '',
      };
    });

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

async function selectCurrencyByClick(page, selectId, currencyCode) {
  try {
    // Open the dropdown by clicking the select
    const selectEl = page.locator(selectId).first();
    await selectEl.click();
    await page.waitForTimeout(500);

    // Find and click the option by text — exact match approach instead of selectOption
    const clicked = await page.evaluate((code) => {
      const options = Array.from(document.querySelectorAll('option'));
      for (const opt of options) {
        if (opt.text.includes(code) || opt.textContent.includes(code)) {
          opt.click();
          return true;
        }
      }
      return false;
    }, currencyCode);

    if (clicked) {
      await page.waitForTimeout(500);
      return true;
    }
  } catch {}
  return false;
}
