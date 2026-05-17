const { RATES, getBounds, hasPair } = require('../../src/market-rates');

module.exports = async ({ test, assert, assertEqual }) => {
  await test('has all 49 USD/AUD/CAD/EUR/GBP/PLN/AED -> GHS/INR/KES/MXN/NGN/PHP/PKR pairs', async () => {
    const sendCurrencies = ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'PLN'];
    const receiveCurrencies = ['GHS', 'INR', 'KES', 'MXN', 'NGN', 'PHP', 'PKR'];
    let count = 0;
    for (const send of sendCurrencies) {
      for (const recv of receiveCurrencies) {
        assert(hasPair(send, recv), `Should have ${send}-${recv}`);
        count++;
      }
    }
    assertEqual(count, 49);
  });

  await test('getBounds returns min < mid < max', async () => {
    const bounds = getBounds('USD', 'NGN');
    assert(bounds.min < bounds.mid, `min ${bounds.min} < mid ${bounds.mid}`);
    assert(bounds.max > bounds.mid, `max ${bounds.max} > mid ${bounds.mid}`);
    assertEqual(bounds.min, 1162.5);
    assertEqual(bounds.max, 1937.5);
    assertEqual(bounds.mid, 1550.0);
  });

  await test('NGN pairs have 25% tolerance (volatile)', async () => {
    for (const send of ['USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'PLN']) {
      const b = getBounds(send, 'NGN');
      assertEqual(b.tolerance, 0.25);
    }
  });

  await test('non-NGN pairs have 15% tolerance', async () => {
    for (const recv of ['GHS', 'INR', 'KES', 'MXN', 'PHP', 'PKR']) {
      const b = getBounds('USD', recv);
      assertEqual(b.tolerance, 0.15);
    }
  });

  await test('getBounds returns null for unsupported pair', async () => {
    assertEqual(getBounds('USD', 'CNY'), null);
  });

  await test('all rates are positive finite numbers', async () => {
    for (const [key, entry] of Object.entries(RATES)) {
      assert(typeof entry.mid === 'number', `${key}: mid should be number`);
      assert(entry.mid > 0, `${key}: mid should be positive`);
      assert(Number.isFinite(entry.mid), `${key}: mid should be finite`);
      assert(entry.tolerance > 0 && entry.tolerance < 1, `${key}: tolerance should be 0-1`);
    }
  });

  await test('USD->NGN rate is in thousands order of magnitude', async () => {
    const b = getBounds('USD', 'NGN');
    assert(b.mid > 500, `USD/NGN mid ${b.mid} should be > 500`);
    assert(b.mid < 5000, `USD/NGN mid ${b.mid} should be < 5000`);
  });

  await test('rates are internally consistent via USD cross-rates', async () => {
    // GBP/USD ~1.27, so GBP-NGN should be roughly 1.27 * USD-NGN
    const usdNgn = getBounds('USD', 'NGN');
    const gbpNgn = getBounds('GBP', 'NGN');
    const impliedGbpNgn = usdNgn.mid * 1.27;
    const deviation = Math.abs(gbpNgn.mid - impliedGbpNgn) / impliedGbpNgn;
    assert(deviation < 0.30, `GBP/NGN cross-rate deviation ${deviation.toFixed(2)} should be < 30%`);
  });
};
