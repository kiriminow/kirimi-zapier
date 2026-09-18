'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { compact, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/save-contact`,
    method: 'POST',
    body: compact({
      nama: input.nama,
      nomor: input.nomor,
      device_id: input.device_id,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'save_contact',
  noun: 'Contact',
  display: {
    label: 'Save Contact',
    description: 'Creates a contact inside the phone book of a WhatsApp device.',
  },
  operation: {
    inputFields: [
      {
        key: 'nama',
        label: 'Contact name',
        type: 'string',
        required: true,
        helpText: 'Name stored in the phone book of the device.',
      },
      {
        key: 'nomor',
        label: 'Contact number',
        type: 'string',
        required: true,
        helpText:
          'Phone number stored in the phone book, with the country code and no plus sign.',
      },
      deviceField({
        required: false,
        helpText:
          'Device whose phone book receives the contact. Leave it empty to use your default device.',
      }),
    ],
    perform,
    sample: {
      id: '64f0c1a2e4b0d3f1a2b3c4d5',
      success: true,
      message: 'OK',
    },
  },
};
