'use strict';

const { BASE_URL } = require('../lib/constants');
const { wabaField } = require('../lib/wabas');
const { compact, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/waba/send-otp`,
    method: 'POST',
    body: compact({
      waba_id: input.waba_id,
      to: input.to,
      template_name: input.template_name,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'send_waba_otp',
  noun: 'WABA OTP',
  display: {
    label: 'Send WABA OTP',
    description:
      'Creates a one-time password and sends it through an authentication template of your WhatsApp Business API account.',
    hidden: true,
  },
  operation: {
    inputFields: [
      wabaField({
        helpText:
          'The WhatsApp Business API account that sends the OTP. Meta bills this account directly.',
      }),
      {
        key: 'to',
        label: 'Recipient number',
        type: 'string',
        required: true,
        helpText:
          'Phone number that receives the OTP, with the country code and no plus sign.',
      },
      {
        key: 'template_name',
        label: 'Authentication template name',
        type: 'string',
        required: true,
        helpText:
          'Name of an approved AUTHENTICATION template inside that WABA account, for example otp_login.',
      },
    ],
    perform,
    sample: {
      id: 'wamid.HBgLNjI4MTIzNDU2Nzg5',
      success: true,
      message: 'OTP terkirim via WABA',
      message_id: 'wamid.HBgLNjI4MTIzNDU2Nzg5',
      phone: '62812***',
      waba_id: '123456789012345',
      template_name: 'otp_login',
      send_method: 'waba_user',
      expires_in: 5,
      sent_at: '2026-11-05T09:30:00.000Z',
    },
  },
};
