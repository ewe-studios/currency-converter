const { chromium } = require('playwright');
const { BROWSER_OPTIONS, CONTEXT_OPTIONS, TIMEOUTS } = require('./config');

async function isBlocked(page) {
  const text = await page.evaluate(() => document.body.textContent || '');
  const blockedPatterns = [
    'temporarily restricted',
    'temporarily unavailable',
    'too many requests',
    'access denied',
    'unusual activity',
    'please try again later',
    'rate limit',
  ];
  for (const pattern of blockedPatterns) {
    if (text.toLowerCase().includes(pattern)) return true;
  }
  return false;
}

async function handleCaptcha(page) {
  const captchaFrame = page.frames().find(f => f.url().includes('captcha-delivery'));
  if (!captchaFrame) {
    console.log('  No captcha iframe found');
    return;
  }
  console.log('  Captcha iframe found');

  // Combine pointer events with gradual style.left animation
  const dragResult = await captchaFrame.evaluate(() => {
    const slider = document.querySelector('.slider');
    const mask = document.querySelector('.sliderMask');
    if (!slider || !mask) return { error: 'missing elements' };

    // Simulate the drag by setting left progressively
    const maxLeft = 220;
    const steps = 50;

    // Start with pointerdown
    slider.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerType: 'mouse',
      pointerId: 1, button: 0, buttons: 1, clientX: 0, clientY: 20, view: window
    }));

    // Gradually move right
    for (let i = 1; i <= steps; i++) {
      const left = (maxLeft * i) / steps;
      slider.style.left = left + 'px';
      if (mask) mask.style.left = left + 'px';

      // Dispatch pointermove with increasing clientX
      slider.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true, pointerType: 'mouse',
        pointerId: 1, button: 0, buttons: 1, clientX: left, clientY: 20, view: window
      }));
    }

    // Final pointerup at end position
    slider.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerType: 'mouse',
      pointerId: 1, button: 0, buttons: 0, clientX: maxLeft, clientY: 20, view: window
    }));

    return { done: true, finalLeft: slider.style.left };
  }).catch(e => `Error: ${e.message}`);
  console.log('  Drag result:', JSON.stringify(dragResult));

  await page.waitForTimeout(5000);
}

async function fetchWithRetry(page, fromCountry, toCountry, sendAmount, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n=== Attempt ${attempt}/${maxRetries} ===`);

    await page.goto(`https://www.moneygram.com/mgo/${fromCountry.code.toLowerCase()}/en/`, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(5000);

    // Dismiss cookie
    try {
      const btn = page.locator('#onetrust-accept-btn-handler').first();
      if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await btn.click(); await page.waitForTimeout(500);
      }
    } catch {}
    await page.waitForTimeout(2000);

    // Check if blocked
    if (await isBlocked(page)) {
      const delay = Math.pow(2, attempt) * 10000; // 20s, 40s, 80s
      console.log(`  BLOCKED — retrying in ${delay / 1000}s...`);
      if (attempt === maxRetries) return null;
      await page.waitForTimeout(delay);
      continue;
    }

    // Step 1: Select receive country
    const recvBtn = page.locator('button[aria-label="Country"]').last();
    if (await recvBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await recvBtn.click();
      await page.waitForTimeout(1500);
    }
    const countryOption = page.locator('[role="option"]').filter({ hasText: toCountry.name }).first();
    if (await countryOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await countryOption.click({ timeout: 5000 });
      await page.waitForTimeout(3000);
    }

    // Step 2: Click "Send money"
    const sendMoneyBtn = page.getByRole('button', { name: 'Send money' }).first();
    if (await sendMoneyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isDisabled = await sendMoneyBtn.isDisabled().catch(() => true);
      if (!isDisabled) {
        await sendMoneyBtn.click();
        try { await page.waitForNavigation({ timeout: 15000 }); } catch {}
        await page.waitForTimeout(3000);
      }
    }

    // Step 3: Check if blocked after navigation
    if (await isBlocked(page)) {
      const delay = Math.pow(2, attempt) * 10000;
      console.log(`  BLOCKED after nav — retrying in ${delay / 1000}s...`);
      if (attempt === maxRetries) return null;
      await page.waitForTimeout(delay);
      continue;
    }

    // Step 4: Handle captcha
    console.log('  Handling captcha...');
    await handleCaptcha(page);

    // Step 5: Calculator inputs
    console.log('  Current URL:', page.url());

    // Dump all visible inputs
    const allInputs = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      const result = [];
      inputs.forEach((inp, i) => {
        const style = window.getComputedStyle(inp);
        if (style.display !== 'none' && style.visibility !== 'hidden' && inp.offsetParent !== null) {
          result.push({
            index: i,
            type: inp.type,
            name: inp.name,
            placeholder: inp.placeholder,
            value: inp.value,
            ariaLabel: inp.getAttribute('aria-label'),
            class: inp.className,
            id: inp.id,
          });
        }
      });
      return result;
    });
    console.log(`  Found ${allInputs.length} visible inputs:`);
    allInputs.forEach(inp => console.log(`    ${inp.index}: type=${inp.type} name="${inp.name}" value="${inp.value}" placeholder="${inp.placeholder}" id="${inp.id}"`));

    const calcInputs = page.locator('input[type="text"]');
    const inpCount = await calcInputs.count();
    console.log(`  input[type="text"]: ${inpCount}`);

    // Dump visible buttons
    const buttons = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      const result = [];
      btns.forEach((btn, i) => {
        const style = window.getComputedStyle(btn);
        if (style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null) {
          result.push({
            index: i,
            text: btn.textContent?.trim().substring(0, 60),
            disabled: btn.disabled,
            class: btn.className?.substring(0, 60),
            id: btn.id,
          });
        }
      });
      return result;
    });
    console.log(`  Visible buttons (${buttons.length}):`);
    buttons.forEach(b => console.log(`    ${b.index}: "${b.text}" disabled=${b.disabled} id="${b.id}"`));

    if (inpCount >= 2) {
      await calcInputs.first().fill(String(sendAmount));
      await page.waitForTimeout(2000);

      try {
        const bankBtn = page.getByRole('button', { name: 'Bank account' }).first();
        if (await bankBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await bankBtn.click();
          await page.waitForTimeout(3000);
        }
      } catch {}

      const vals = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="text"]')).map(inp => inp.value);
      });
      console.log('  Values:', vals);

      if (vals.length >= 2 && vals[1] && parseFloat(vals[1].replace(/,/g, '')) > 0) {
        const recvAmt = parseFloat(vals[1].replace(/,/g, ''));
        const sendVal = parseFloat(vals[0].replace(/,/g, ''));
        if (recvAmt > 0 && sendVal > 0 && recvAmt !== sendVal) {
          const exchangeRate = recvAmt / sendVal;
          if (exchangeRate > 0.01 && exchangeRate < 100000) {
            return { exchangeRate, receiveAmount: exchangeRate * sendAmount, fee: null };
          }
        }
      }
    }

    console.log('  No rate extracted on this attempt');
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 10000;
      console.log(`  Waiting ${delay / 1000}s before retry...`);
      await page.waitForTimeout(delay);
    }
  }

  return null;
}

(async () => {
  const CURRENCY_COUNTRY_MAP = require('./config').CURRENCY_COUNTRY_MAP;

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext(CONTEXT_OPTIONS);
  const page = await ctx.newPage();

  const fromCurrency = 'USD';
  const toCurrency = 'PHP';
  const fromCountry = CURRENCY_COUNTRY_MAP[fromCurrency];
  const toCountry = CURRENCY_COUNTRY_MAP[toCurrency];
  const sendAmount = 1000;

  console.log(`Testing MoneyGram: ${fromCurrency} → ${toCurrency}, amount: ${sendAmount}`);

  const result = await fetchWithRetry(page, fromCountry, toCountry, sendAmount, 3);
  console.log('\nResult:', result);

  console.log('\nDone. Press Enter to close.');
  process.stdin.once('data', () => {});
  await page.waitForTimeout(120000);
  await browser.close();
})();
