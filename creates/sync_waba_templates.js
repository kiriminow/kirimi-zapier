'use strict';

const { BASE_URL } = require('../lib/constants');
const { wabaField } = require('../lib/wabas');
const { compact, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/waba/templates/sync`,
    method: 'POST',
    body: compact({ waba_id: input.waba_id }),
  });

  const result = shapeCreateResult(response);
  return result.waba_id ? { ...result, id: String(result.waba_id) } : result;
};

module.exports = {
  key: 'sync_waba_templates',
  noun: 'Template Sync',
  display: {
    label: 'Sync WABA Templates',
    description:
      'Creates a fresh copy of the message templates of a WhatsApp Business API account from Meta.',
    hidden: true,
  },
  operation: {
    inputFields: [
      wabaField({
        helpText:
          'The WhatsApp Business API account whose templates are refreshed from Meta.',
      }),
    ],
    perform,
    sample: {
      id: '123456789012345',
      success: true,
      message: 'Sinkronisasi template berhasil',
      waba_id: '123456789012345',
      synced_count: 2,
      templates: [
        { name: 'order_update', category: 'UTILITY', language: 'id', status: 'APPROVED' },
        { name: 'otp_login', category: 'AUTHENTICATION', language: 'id', status: 'APPROVED' },
      ],
    },
  },
};
