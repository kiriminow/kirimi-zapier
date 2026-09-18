'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { compact, isPlainObject, unwrapData } = require('../lib/util');

const perform = async (z, bundle) => {
  const response = await z.request({
    url: `${BASE_URL}/v1/device-status-enhanced`,
    method: 'POST',
    body: compact({ device_id: bundle.inputData.device_id }),
  });

  const payload = unwrapData(response);
  if (!isPlainObject(payload)) {
    return [];
  }

  const id = payload.id || payload.device_id || bundle.inputData.device_id;
  return [{ ...payload, id: String(id) }];
};

module.exports = {
  key: 'find_device_status',
  noun: 'Device',
  display: {
    label: 'Find Device Status',
    description: 'Finds the connection status and details of a WhatsApp device.',
  },
  operation: {
    inputFields: [deviceField()],
    perform,
    sample: {
      id: 'D-2J3IG',
    },
    outputFields: [
      { key: 'id', label: 'Device ID', type: 'string', required: true },
      { key: 'name', label: 'Device name', type: 'string' },
      { key: 'phone', label: 'Device number', type: 'string' },
      { key: 'status', label: 'Connection status', type: 'string' },
      { key: 'connected', label: 'Connected', type: 'boolean' },
    ],
  },
};
