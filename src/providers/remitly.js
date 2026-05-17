const { TIMEOUTS, CURRENCY_COUNTRY_MAP } = require('../config');
const cheerio = require('cheerio');
const { getBounds } = require('../market-rates');

module.exports = {
  name: 'Remitly',

  async fetchRate(page, sendCurrency, receiveCurrency, sendAmount) {
    const fromCountry = CURRENCY_COUNTRY_MAP[sendCurrency];
    const toCountry = CURRENCY_COUNTRY_MAP[receiveCurrency];
    if (!fromCountry || !toCountry) {
      return { exchangeRate: null, receiveAmount: null, fee: null };
    }

    const countryCode = fromCountry.code.toLowerCase();
    const from = sendCurrency.toLowerCase();
    const to = receiveCurrency.toLowerCase();
    const converterUrl = `https://www.remitly.com/${countryCode}/en/currency-converter/${from}-to-${to}-rate`;

    await page.goto(converterUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.navigation });
    await page.waitForTimeout(1000);

    const html = await page.content();
    const $ = cheerio.load(html);

    if ($('h1').text().includes('404') || $('title').text().includes('404') || $('title').text().includes('Not Found')) {
      return { exchangeRate: null, receiveAmount: null, fee: null };
    }

    // 1. Rate from "Special rate" or "Everyday rate" div
    // Extract ONLY the first number after "1 SEND = X RECEIVE"
    const rateDiv = $('div').filter((_, el) => {
      const text = $(el).text().trim();
      return (text.includes('Special rate') || text.includes('Everyday rate')) &&
             text.includes(sendCurrency) && text.includes(receiveCurrency);
    }).first().text().trim();

    let extractedRate = null;
    if (rateDiv) {
      const rateMatch = rateDiv.match(
        new RegExp(`1\\s+${sendCurrency}\\s*=\\s*([\\d.,]+)`, 'i')
      );
      if (rateMatch) {
        extractedRate = parseFloat(rateMatch[1].replace(/,/g, ''));
      }
    }

    // 2. Receive amount confirmation: "They receive" / "You receive" section
    let confirmedRate = null;
    const receiveSection = $('div').filter((_, el) => {
      const text = $(el).text().trim();
      return text.includes('They receive') || text.includes('You receive');
    }).first();

    if (receiveSection.length) {
      const text = receiveSection.text();
      const match = text.match(new RegExp(`([\\d.,]+)\\s*${receiveCurrency}`, 'i'));
      if (match) {
        const recvAmt = parseFloat(match[1].replace(/,/g, ''));
        if (recvAmt > 0) {
          confirmedRate = recvAmt / sendAmount;
        }
      }
    }

    // Prefer confirmed rate from "They receive" if both exist
    if (confirmedRate && extractedRate) {
      const ratio = Math.max(confirmedRate, extractedRate) / Math.min(confirmedRate, extractedRate);
      extractedRate = ratio < 1.05 ? confirmedRate : extractedRate;
    } else if (confirmedRate) {
      extractedRate = confirmedRate;
    }

    if (extractedRate && extractedRate > 0) {
      const bounds = getBounds(sendCurrency, receiveCurrency);
      if (bounds) {
        const orderOfMag = Math.abs(Math.log10(extractedRate / bounds.mid));
        if (orderOfMag > 2) {
          return { exchangeRate: null, receiveAmount: null, fee: null };
        }
      }
      return { exchangeRate: extractedRate, receiveAmount: extractedRate * sendAmount, fee: null };
    }

    return { exchangeRate: null, receiveAmount: null, fee: null };
  },
};
