'use strict';

const { BASE_URL } = require('../lib/constants');
const { compact, parseJsonInput, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/waba/send-message`,
    method: 'POST',
    body: compact({
      waba_id: input.waba_id,
      to: input.to,
      template_name: input.template_name,
      variables: input.variables,
      header: parseJsonInput(z, input.header, 'Header'),
      buttons: parseJsonInput(z, input.buttons, 'Buttons'),
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'send_waba_template',
  noun: 'Template Message',
  display: {
    label: 'Send WABA Template Message',
    description:
      'Creates a WhatsApp Business API message from a Meta-approved template.',
  },
  operation: {
    inputFields: [
      {
        key: 'waba_id',
        label: 'WABA ID',
        type: 'string',
        required: true,
        helpText:
          'WhatsApp Business Account ID from the Kirimi dashboard. This is not the device ID.',
      },
      {
        key: 'to',
        label: 'Recipient number',
        type: 'string',
        required: true,
        helpText:
          'Phone number with the country code and no plus sign, for example 6281234567890.',
      },
      {
        key: 'template_name',
        label: 'Template name',
        type: 'string',
        required: true,
        helpText:
          'Name of a Meta-approved template inside that WABA account, for example order_update.',
      },
      {
        key: 'variables',
        label: 'Template variables',
        type: 'string',
        list: true,
        required: false,
        helpText:
          'Values that replace the template placeholders {{1}}, {{2}} and so on, in order.',
      },
      {
        key: 'header',
        label: 'Header component',
        type: 'text',
        required: false,
        helpText:
          'JSON object for a media or dynamic text header, for example {"type":"text","text":"Hello"}.',
      },
      {
        key: 'buttons',
        label: 'Button parameters',
        type: 'text',
        required: false,
        helpText:
          'JSON array with one entry per template button, for example [{"type":"text","text":"Open"}].',
      },
    ],
    perform,
    sample: {
      id: '64f0c1a2e4b0d3f1a2b3c4d5',
      success: true,
      message: 'OK',
    },
  },
};
