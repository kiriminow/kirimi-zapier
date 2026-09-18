'use strict';

const { BASE_URL } = require('../lib/constants');
const { compact, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v2/otp/verify`,
    method: 'POST',
    body: compact({
      phone: input.phone,
      otp_code: input.otp_code,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'verify_otp',
  noun: 'OTP',
  display: {
    label: 'Verify OTP',
    description: 'Creates a verification for a one-time password sent earlier.',
  },
  operation: {
    inputFields: [
      {
        key: 'phone',
        label: 'Recipient number',
        type: 'string',
        required: true,
        helpText:
          'Phone number that received the OTP, with the country code and no plus sign.',
      },
      {
        key: 'otp_code',
        label: 'OTP code',
        type: 'string',
        required: true,
        helpText: 'The code the recipient typed, between 4 and 8 digits.',
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
