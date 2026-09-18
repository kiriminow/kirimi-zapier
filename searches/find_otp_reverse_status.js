'use strict';

const { BASE_URL } = require('../lib/constants');
const { compact, isPlainObject, unwrapData } = require('../lib/util');

const perform = async (z, bundle) => {
  const { verification_token: verificationToken } = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v2/otp-reverse/status`,
    method: 'POST',
    body: compact({ token: verificationToken }),
  });

  const payload = unwrapData(response);
  if (!isPlainObject(payload)) {
    return [];
  }

  return [{ ...payload, id: String(payload.token || verificationToken) }];
};

module.exports = {
  key: 'find_otp_reverse_status',
  noun: 'Verification',
  display: {
    label: 'Find Reverse OTP Status',
    description:
      'Finds the status of a reverse OTP verification created earlier.',
    hidden: true,
  },
  operation: {
    inputFields: [
      {
        key: 'verification_token',
        label: 'Verification token',
        type: 'string',
        required: true,
        helpText:
          'Token returned when the reverse OTP was created. It stays valid for 10 minutes.',
      },
    ],
    perform,
    sample: {
      id: '01H2X4Z9K7M3Q8V1',
    },
    outputFields: [
      { key: 'id', label: 'Verification token', type: 'string', required: true },
      { key: 'status', label: 'Verification status', type: 'string' },
      { key: 'phone', label: 'Customer number', type: 'string' },
    ],
  },
};
