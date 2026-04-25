const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function loadProviderPairs(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const byProvider = {};
  for (const row of records) {
    const key = row.provider_name;
    if (!byProvider[key]) {
      byProvider[key] = {
        name: row.provider_name,
        url: row.provider_url,
        pairs: [],
      };
    }
    byProvider[key].pairs.push({
      sendCurrency: row.send_currency,
      receiveCurrency: row.receive_currency,
    });
  }

  return byProvider;
}

module.exports = { loadProviderPairs };
