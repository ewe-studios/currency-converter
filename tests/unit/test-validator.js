const { validateRate, attachValidation, sanityCheck, generateValidationReport } = require('../../src/validator');

module.exports = async ({ test, assert, assertEqual }) => {
  await test('valid rate within bounds', async () => {
    const result = {
      success: true, exchangeRate: 1550, sendAmount: 1000,
      sendCurrency: 'USD', receiveCurrency: 'NGN',
    };
    const v = validateRate(result);
    assertEqual(v.status, 'valid');
  });

  await test('suspect rate slightly outside bounds', async () => {
    const result = {
      success: true, exchangeRate: 1100, sendAmount: 1000,
      sendCurrency: 'USD', receiveCurrency: 'NGN',
    };
    const v = validateRate(result);
    assertEqual(v.status, 'suspect');
  });

  await test('invalid rate far outside bounds', async () => {
    const result = {
      success: true, exchangeRate: 49200, sendAmount: 1000,
      sendCurrency: 'USD', receiveCurrency: 'NGN',
    };
    const v = validateRate(result);
    assertEqual(v.status, 'invalid');
  });

  await test('null exchange rate is invalid', async () => {
    const result = {
      success: false, exchangeRate: null, sendAmount: 1000,
      sendCurrency: 'USD', receiveCurrency: 'NGN',
    };
    const v = validateRate(result);
    assertEqual(v.status, 'invalid');
  });

  await test('strict mode rejects suspect rates', async () => {
    const result = {
      success: true, exchangeRate: 1100, sendAmount: 1000,
      sendCurrency: 'USD', receiveCurrency: 'NGN',
    };
    const v = validateRate(result, { strict: true });
    assertEqual(v.status, 'invalid');
  });

  await test('sanity check catches rate equals sendAmount', async () => {
    const result = { exchangeRate: 1000, sendAmount: 1000, sendCurrency: 'USD', receiveCurrency: 'NGN' };
    const s = sanityCheck(result);
    assert(s, 'should detect rate equals sendAmount');
  });

  await test('sanity check catches rate = 1 for different currencies', async () => {
    const result = { exchangeRate: 1, sendAmount: 1000, sendCurrency: 'USD', receiveCurrency: 'NGN' };
    const s = sanityCheck(result);
    assert(s, 'should detect rate = 1 for different currencies');
  });

  await test('sanity check catches NGN rate too low', async () => {
    const result = { exchangeRate: 50, sendAmount: 1000, sendCurrency: 'USD', receiveCurrency: 'NGN' };
    const s = sanityCheck(result);
    assert(s, 'should detect NGN rate too low');
  });

  await test('sanity check catches negative rate', async () => {
    const result = { exchangeRate: -5, sendAmount: 1000, sendCurrency: 'USD', receiveCurrency: 'NGN' };
    const s = sanityCheck(result);
    assert(s, 'should detect negative rate');
  });

  await test('sanity check passes valid NGN rate', async () => {
    const result = { exchangeRate: 1550, sendAmount: 1000, sendCurrency: 'USD', receiveCurrency: 'NGN' };
    const s = sanityCheck(result);
    assertEqual(s, null);
  });

  await test('attachValidation adds validation fields', async () => {
    const result = { success: true, exchangeRate: 1550, sendAmount: 1000, sendCurrency: 'USD', receiveCurrency: 'NGN' };
    const v = validateRate(result);
    attachValidation(result, v);
    assert(result.validation, 'should have validation field');
    assertEqual(result.validation.status, 'valid');
    assert(typeof result.validation.deviationFromMid === 'number');
    assert(typeof result.validation.boundsMin === 'number');
    assert(typeof result.validation.boundsMax === 'number');
  });

  await test('generateValidationReport produces correct counts', async () => {
    const results = [
      { provider: 'Wise', sendCurrency: 'USD', receiveCurrency: 'NGN', success: true, exchangeRate: 1550, validation: { status: 'valid', deviationFromMid: 0 } },
      { provider: 'Ria', sendCurrency: 'USD', receiveCurrency: 'NGN', success: true, exchangeRate: 49200, validation: { status: 'invalid', reason: 'too high' } },
      { provider: 'Sendwave', sendCurrency: 'USD', receiveCurrency: 'NGN', success: false, exchangeRate: null, validation: null },
    ];
    const report = generateValidationReport(results);
    assertEqual(report.validRates, 1);
    assertEqual(report.suspectRates, 0);
    assertEqual(report.invalidRates, 1);
    assertEqual(report.nullRates, 1);
    assertEqual(report.byProvider['Wise'].valid, 1);
    assertEqual(report.byProvider['Ria'].invalid, 1);
    assertEqual(report.byProvider['Sendwave'].null, 1);
    assert(report.anomalies.length >= 1);
  });

  await test('unsupported pair returns suspect without strict, invalid with strict', async () => {
    const result = {
      success: true, exchangeRate: 7.2, sendAmount: 1000,
      sendCurrency: 'USD', receiveCurrency: 'JPY',
    };
    const v1 = validateRate(result);
    assertEqual(v1.status, 'suspect');
    const v2 = validateRate(result, { strict: true });
    assertEqual(v2.status, 'invalid');
  });

  await test('100x scaling error caught as invalid', async () => {
    const result = {
      success: true, exchangeRate: 155000, sendAmount: 1000,
      sendCurrency: 'USD', receiveCurrency: 'NGN',
    };
    const v = validateRate(result);
    assertEqual(v.status, 'invalid');
  });
};
