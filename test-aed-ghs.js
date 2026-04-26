const { chromium } = require('playwright');
const cheerio = require('cheerio');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.westernunion.com/ae/en/web/send-money/start?ReceiveCountry=GH&ISOCurrency=GHS&SendAmount=1000&FundsOut=BA&FundsIn=undefined', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  try { await page.click('#accept-recommended-btn-handler'); } catch {}
  await page.waitForTimeout(2000);

  const html = await page.content();
  const $ = cheerio.load(html);

  console.log('URL:', page.url());
  console.log('#exchangeRate:', $('#exchangeRate').text().trim());
  console.log('#smoExchangeRate:', $('#smoExchangeRate').text().trim());
  console.log('.exchange-rate:', $('.exchange-rate').text().trim());
  console.log('.smorevamp-amount-wrapper exists:', $('.smorevamp-amount-wrapper').length);

  const bodyText = $('body').text();
  if (bodyText.includes('register') || bodyText.includes('sign in') || bodyText.includes('login')) {
    console.log('Page seems to require login');
  }
  if (bodyText.includes('GHS') && bodyText.includes('AED')) {
    console.log('Page contains both GHS and AED');
  } else {
    console.log('Page does NOT contain both currencies');
  }

  $('*').each((i, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 5 && text.length < 200) {
      if (text.includes('GHS') || text.includes('AED')) {
        console.log('MATCH:', el.tagName, $(el).attr('id'), $(el).attr('class'), text.substring(0, 150));
      }
    }
  });

  await browser.close();
})();
