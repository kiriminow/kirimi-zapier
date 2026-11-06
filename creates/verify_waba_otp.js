'use strict';

const { BASE_URL } = require('../lib/constants');
const { wabaField } = require('../lib/wabas');
const { compact, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/waba/verify-otp`,
    method: 'POST',
    body: compact({
      waba_id: input.waba_id,
      to: input.to,
      otp_code: input.otp_code,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'verify_waba_otp',
  noun: 'WABA OTP',
  display: {
    label: 'Verify WABA OTP',
    description:
      'Creates a verification for a one-time password sent through your WhatsApp Business API account.',
    hidden: true,
  },
  operation: {
    inputFields: [
      wabaField({
        helpText:
          'The WhatsApp Business API account that sent the OTP.',
      }),
      {
        key: 'to',
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
      id: '1762334400000',
      success: true,
      message: 'OTP berhasil diverifikasi',
      verified: true,
      phone: '62812***',
      waba_id: '123456789012345',
      verified_at: '2026-11-05T09:31:00.000Z',
    },
  },
};
