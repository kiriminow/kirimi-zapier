'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { compact, normalizePlaceholders, rawJsonBody, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const method = input.method || 'whatsapp';
  const customMessage = normalizePlaceholders(input.custom_message, 'otp');

  if (method === 'device' && !input.device_id) {
    throw new z.errors.Error(
      'Pick the device that sends the OTP, or switch the method to WhatsApp (Kirimi).',
      'MissingDevice',
      400,
    );
  }

  if (method === 'device' && !/{{otp}}/.test(customMessage || '')) {
    throw new z.errors.Error(
      'Add [otp] to the custom message so the code has a place to appear. Zapier removes curly braces, so use square brackets.',
      'MissingOtpPlaceholder',
      400,
    );
  }

  if (method === 'waba_user') {
    if (!input.waba_id || !input.template_name) {
      throw new z.errors.Error(
        'The WABA ID and an approved authentication template are required for your own WABA.',
        'MissingWabaDetails',
        400,
      );
    }
  }

  const response = await z.request({
    url: `${BASE_URL}/v2/otp/send`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawJsonBody({
      user_code: bundle.authData.user_code,
      secret: bundle.authData.secret,
      method,
      phone: input.phone,
      app_name: input.app_name,
      device_id: input.device_id,
      waba_id: input.waba_id,
      template_name: input.template_name,
      custom_message: customMessage,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'send_otp',
  noun: 'OTP',
  display: {
    label: 'Send OTP',
    description: 'Creates a one-time password and sends it to a phone number.',
  },
  operation: {
    inputFields: [
      {
        key: 'phone',
        label: 'Recipient number',
        type: 'string',
        required: true,
        helpText:
          'Phone number that receives the OTP, with the country code and no plus sign.',
      },
      {
        key: 'method',
        label: 'Delivery method',
        type: 'string',
        required: true,
        default: 'whatsapp',
        choices: {
          whatsapp: 'WhatsApp (billed by Kirimi)',
          device: 'Your own device',
          waba_user: 'Your own WABA',
        },
        helpText:
          'WhatsApp is billed by Kirimi per delivered OTP. Your own device and your own WABA are free but need extra fields.',
      },
      {
        key: 'app_name',
        label: 'App name in the message',
        type: 'string',
        required: false,
        helpText:
          'Brand name shown to the recipient inside the OTP message. Kirimi uses Kirimi.id by default.',
      },
      deviceField({
        required: false,
        helpText:
          'Device that sends the OTP. Required when the delivery method is Your own device.',
      }),
      {
        key: 'waba_id',
        label: 'WABA ID',
        type: 'string',
        required: false,
        helpText:
          'WhatsApp Business Account ID. Required when the delivery method is Your own WABA.',
      },
      {
        key: 'template_name',
        label: 'Authentication template name',
        type: 'string',
        required: false,
        helpText:
          'Approved AUTHENTICATION template inside that WABA. Required when the delivery method is Your own WABA.',
      },
      {
        key: 'custom_message',
        label: 'Custom message',
        type: 'text',
        required: false,
        helpText:
          'Template for the OTP text, required when the delivery method is Your own device. Put the placeholder [otp] where the code should appear, because Zapier strips curly braces from typed text.',
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
