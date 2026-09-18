'use strict';

const { BASE_URL } = require('./lib/constants');
const { unwrapData } = require('./lib/util');

const authentication = {
  type: 'custom',
  fields: [
    {
      key: 'user_code',
      label: 'User Code',
      type: 'string',
      required: true,
      helpText:
        'Open the [Kirimi dashboard](https://kirimi.id) and copy the User Code shown in your API credentials.',
    },
    {
      key: 'secret',
      label: 'Secret',
      type: 'string',
      required: true,
      helpText:
        'Copy the Secret that sits next to your User Code in the [Kirimi dashboard](https://kirimi.id). It is sent with every request, so keep it private.',
    },
  ],
  test: async (z, bundle) => {
    const response = await z.request({
      url: `${BASE_URL}/v1/user-info`,
      method: 'POST',
      body: {
        user_code: bundle.authData.user_code,
        secret: bundle.authData.secret,
      },
    });

    return unwrapData(response) || {};
  },
  connectionLabel: (z, bundle) => {
    const data =
      bundle.inputData && typeof bundle.inputData === 'object'
        ? bundle.inputData
        : {};
    const name =
      data.name ||
      data.nama ||
      data.username ||
      data.email ||
      data.phone ||
      data.phone_number;

    return name || bundle.authData.user_code;
  },
};

module.exports = authentication;
