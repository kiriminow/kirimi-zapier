'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { compact, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/save-contacts-bulk`,
    method: 'POST',
    body: compact({
      contacts: input.contacts,
      device_id: input.device_id,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'save_contacts_bulk',
  noun: 'Contact',
  display: {
    label: 'Save Contacts in Bulk',
    description:
      'Creates several contacts at once inside the phone book of a WhatsApp device.',
    hidden: true,
  },
  operation: {
    inputFields: [
      {
        key: 'contacts',
        label: 'Contacts',
        required: true,
        children: [
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
              'Phone number with the country code and no plus sign, for example 6281234567890. Up to 1000 contacts per run are accepted.',
          },
        ],
      },
      deviceField({
        required: false,
        helpText:
          'Device whose phone book receives the contacts. Leave it empty to use your default device.',
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
