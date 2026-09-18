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
  const nested = payload.items || payload.devices || payload.data;
  return Array.isArray(nested) ? nested : [];
};

const toChoices = (payload) =>
  listFromPayload(payload)
    .filter(isPlainObject)
    .map((item) => {
      const id = item.device_id || item.id;
      const label =
        item.name ||
        item.device_name ||
        item.phone ||
        item.number ||
        item.device_id ||
        item.id;
      return { id: id === undefined ? '' : String(id), label: String(label) };
    })
    .filter((choice) => choice.id !== '');

const deviceChoices = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/v1/list-devices`,
    method: 'POST',
    body: { page: 1, limit: 50 },
  });

  return { results: toChoices(unwrapData(response)) };
};

const deviceField = (options = {}) => {
  const {
    key = 'device_id',
    label = 'Device',
    required = true,
    helpText = 'The connected WhatsApp device that performs the request. Devices come from the Kirimi dashboard.',
  } = options;

  return {
    key,
    label,
    type: 'string',
    required,
    choices: { perform: deviceChoices },
    helpText,
  };
};

module.exports = {
  deviceChoices,
  deviceField,
  toChoices,
};
