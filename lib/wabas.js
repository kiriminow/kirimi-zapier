'use strict';

const { BASE_URL } = require('./constants');
const { isPlainObject, unwrapData } = require('./util');

const listFromPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!isPlainObject(payload)) {
    return [];
  }
  return Array.isArray(payload.items) ? payload.items : [];
};

const toChoices = (payload) =>
  listFromPayload(payload)
    .filter(isPlainObject)
    .map((item) => {
      const id = item.waba_id === undefined ? '' : String(item.waba_id);
      const name = item.name || item.display_phone_number || id;
      const label = item.display_phone_number && item.name
        ? `${item.name} (${item.display_phone_number})`
        : String(name);
      return { id, label };
    })
    .filter((choice) => choice.id !== '');

const wabaChoices = async (z) => {
  const response = await z.request({
    url: `${BASE_URL}/v1/waba/accounts`,
    method: 'POST',
    body: {},
  });

  return { results: toChoices(unwrapData(response)) };
};

const wabaField = (options = {}) => {
  const {
    key = 'waba_id',
    label = 'WABA account',
    required = true,
    helpText = 'The WhatsApp Business API account that performs the request. Accounts come from the Kirimi dashboard.',
  } = options;

  return {
    key,
    label,
    type: 'string',
    required,
    choices: { perform: wabaChoices },
    helpText,
  };
};

module.exports = { toChoices, wabaChoices, wabaField };
