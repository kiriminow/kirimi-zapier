'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { compact, normalizePlaceholders, rawJsonBody, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const customMessage = normalizePlaceholders(input.custom_message, 'token', 'phone');

  if (
    customMessage &&
    !(/{{token}}/.test(customMessage) && /{{phone}}/.test(customMessage))
  ) {
    throw new z.errors.Error(
      'Add both [token] and [phone] to the custom message. Zapier removes curly braces, so use square brackets.',
      'MissingPlaceholder',
      400,
    );
  }

  const response = await z.request({
    url: `${BASE_URL}/v2/otp-reverse/create`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawJsonBody({
      user_code: bundle.authData.user_code,
      secret: bundle.authData.secret,
      phone: input.phone,
      device_id: input.device_id,
      app_name: input.app_name,
      callback_url: input.callback_url,
      custom_message: customMessage,
      success_message: input.success_message,
      failure_message: input.failure_message,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'create_otp_reverse',
  noun: 'Verification',
  display: {
    label: 'Create Reverse OTP',
    description:
      'Creates a verification that asks the customer to send a token back to your device.',
    hidden: true,
  },
  operation: {
    inputFields: [
      {
        key: 'phone',
        label: 'Customer number',
        type: 'string',
        required: true,
        helpText:
          'Number to verify, with the country code and no plus sign, for example 6281234567890.',
      },
      deviceField({
        helpText:
          'Device that acts as the bot and reads the token the customer sends back.',
      }),
      {
        key: 'app_name',
        label: 'App name in the message',
        type: 'string',
        required: false,
        helpText:
          'Brand name shown to the customer inside the verification message. Kirimi.id is used by default.',
      },
      {
        key: 'callback_url',
        label: 'Callback URL',
        type: 'string',
        required: false,
        helpText:
          'HTTPS URL notified when the verification finishes. The request carries the x-kirimi-event header.',
      },
      {
        key: 'custom_message',
        label: 'Custom message',
        type: 'text',
        required: false,
        helpText:
          'Template for the verification message. Must contain both [token] and [phone], written with square brackets because Zapier strips curly braces.',
      },
      {
        key: 'success_message',
        label: 'Success message',
        type: 'text',
        required: false,
        helpText: 'Reply sent to the customer when the token matches.',
      },
      {
        key: 'failure_message',
        label: 'Failure message',
        type: 'text',
        required: false,
        helpText: 'Reply sent to the customer when the token does not match.',
      },
    ],
    perform,
    sample: {
      id: '01H2X4Z9K7M3Q8V1',
      success: true,
      message: 'OK',
      token: '01H2X4Z9K7M3Q8V1',
    },
  },
};
