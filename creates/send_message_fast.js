'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { compact, shapeCreateResult } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/send-message-fast`,
    method: 'POST',
    body: compact({
      device_id: input.device_id,
      receiver: input.receiver,
      message: input.message,
      media_url: input.media_url,
      fileName: input.file_name,
      quotedMessageId: input.quoted_message_id,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'send_message_fast',
  noun: 'Message',
  display: {
    label: 'Send Message Fast',
    description:
      'Creates a WhatsApp message and delivers it right away, without the typing indicator.',
  },
  operation: {
    inputFields: [
      deviceField(),
      {
        key: 'receiver',
        label: 'Recipient number',
        type: 'string',
        required: true,
        helpText:
          'Phone number with the country code and no plus sign, for example 6281234567890.',
      },
      {
        key: 'message',
        label: 'Message',
        type: 'text',
        required: true,
        helpText:
          'Text to deliver. When you attach media, this text is sent as the caption.',
      },
      {
        key: 'media_url',
        label: 'Media URL',
        type: 'string',
        required: false,
        helpText:
          'Public link to an image, video, or document that WhatsApp downloads and attaches.',
      },
      {
        key: 'file_name',
        label: 'Media file name',
        type: 'string',
        required: false,
        helpText:
          'Name given to the attached media inside WhatsApp, including the extension.',
      },
      {
        key: 'quoted_message_id',
        label: 'Quoted message ID',
        type: 'string',
        required: false,
        helpText:
          'ID of an earlier message to quote, so the reply shows up in the same thread.',
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
