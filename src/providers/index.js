const wise = require('./wise');
const remitly = require('./remitly');
const worldremit = require('./worldremit');
const westernUnion = require('./western-union');
const xoom = require('./xoom');
const moneygram = require('./moneygram');
const taptapSend = require('./taptap-send');
const ria = require('./ria');
const pandaRemit = require('./panda-remit');
const sendwave = require('./sendwave');
const transfergo = require('./transfergo');

const PROVIDERS = {
  'Wise': wise,
  'Remitly': remitly,
  'WorldRemit': worldremit,
  'Western Union': westernUnion,
  'Xoom': xoom,
  'MoneyGram': moneygram,
  'Taptap Send': taptapSend,
  'Ria': ria,
  'Panda Remit': pandaRemit,
  'Sendwave': sendwave,
  'TransferGo': transfergo,
};

function getProvider(name) {
  return PROVIDERS[name] || null;
}

module.exports = { PROVIDERS, getProvider };
