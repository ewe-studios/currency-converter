const { chromium } = require('playwright');
const { BROWSER_OPTIONS, CONTEXT_OPTIONS } = require('../../src/config');
const { scrape } = require('../../src/scraper');
const { PROVIDERS } = require('../../src/providers');

module.exports = async ({ test, assert, assertEqual }) => {
  await test('scrape returns results for mock provider', async () => {
    const original = PROVIDERS['Mock'];
    PROVIDERS['Mock'] = {
      name: 'Mock',
      async fetchRate(page) {
        return { exchangeRate: 1550, receiveAmount: 1550000, fee: 5 };
      },
    };

    try {
      const pairs = {
        Mock: {
          name: 'Mock',
          url: '',
          pairs: [
            { sendCurrency: 'USD', receiveCurrency: 'NGN' },
          ],
        },
      };

      const results = await scrape(pairs);
      assertEqual(results.length, 1);
      assertEqual(results[0].exchangeRate, 1550);
      assertEqual(results[0].success, true);
      assertEqual(results[0].validation.status, 'valid');
    } finally {
      delete PROVIDERS['Mock'];
    }
  });

  await test('scrape handles provider failure gracefully', async () => {
    PROVIDERS['MockFail'] = {
      name: 'MockFail',
      async fetchRate() {
        throw new Error('Simulated failure');
      },
    };

    try {
      const pairs = {
        MockFail: {
          name: 'MockFail',
          url: '',
          pairs: [{ sendCurrency: 'USD', receiveCurrency: 'NGN' }],
        },
      };

      const results = await scrape(pairs);
      assertEqual(results.length, 1);
      assertEqual(results[0].success, false);
      assert(results[0].error, 'Should have error message');
    } finally {
      delete PROVIDERS['MockFail'];
    }
  });

  await test('scrape processes multiple pairs sequentially', async () => {
    let callCount = 0;
    PROVIDERS['MockMulti'] = {
      name: 'MockMulti',
      async fetchRate(page, sendCurrency, receiveCurrency) {
        callCount++;
        const rates = { 'USD-NGN': 1550, 'USD-GHS': 15 };
        const key = `${sendCurrency}-${receiveCurrency}`;
        return { exchangeRate: rates[key], receiveAmount: rates[key] * 1000, fee: null };
      },
    };

    try {
      const pairs = {
        MockMulti: {
          name: 'MockMulti',
          url: '',
          pairs: [
            { sendCurrency: 'USD', receiveCurrency: 'NGN' },
            { sendCurrency: 'USD', receiveCurrency: 'GHS' },
          ],
        },
      };

      const results = await scrape(pairs);
      assertEqual(results.length, 2);
      assertEqual(results[0].exchangeRate, 1550);
      assertEqual(results[1].exchangeRate, 15);
      assertEqual(results[0].validation.status, 'valid');
      assertEqual(results[1].validation.status, 'valid');
    } finally {
      delete PROVIDERS['MockMulti'];
    }
  });
};
