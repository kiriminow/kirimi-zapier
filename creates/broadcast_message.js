'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { compact, shapeCreateResult, toBoolean } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/broadcast-message`,
    method: 'POST',
    body: compact({
      device_id: input.device_id,
      label: input.label,
      numbers: input.numbers,
      message: input.message,
      delay: input.delay,
      delayMin: input.delay_min,
      delayMax: input.delay_max,
      media_url: input.media_url,
      fileName: input.file_name,
      started_at: input.started_at,
      enableTypingEffect: toBoolean(input.enable_typing_effect),
      typingSpeedMs: input.typing_speed_ms,
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'broadcast_message',
  noun: 'Broadcast',
  display: {
    label: 'Broadcast Message',
    description:
      'Creates a broadcast that sends one WhatsApp message to many recipients.',
  },
  operation: {
    inputFields: [
      deviceField(),
      {
        key: 'label',
        label: 'Broadcast label',
        type: 'string',
        required: true,
        helpText:
          'Name for this broadcast so you can recognize it later. Up to 100 characters.',
      },
      {
        key: 'numbers',
        label: 'Recipient numbers',
        type: 'string',
        list: true,
        required: true,
        helpText:
          'Phone numbers with the country code and no plus sign. A broadcast accepts up to 1000 numbers.',
      },
      {
        key: 'message',
        label: 'Message',
        type: 'text',
        required: true,
        helpText:
          'Text to deliver to every recipient. When you attach media, this text is sent as the caption.',
      },
      {
        key: 'delay',
        label: 'Delay between messages in seconds',
        type: 'integer',
        required: false,
        helpText:
          'Pause between each delivery. Kirimi keeps the value between 30 and 3600 seconds.',
      },
      {
        key: 'delay_min',
        label: 'Random delay from in seconds',
        type: 'integer',
        required: false,
        helpText:
          'Lower bound of a random pause between deliveries. Use it together with the random delay upper bound.',
      },
      {
        key: 'delay_max',
        label: 'Random delay to in seconds',
        type: 'integer',
        required: false,
        helpText:
          'Upper bound of a random pause between deliveries. Use it together with the random delay lower bound.',
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
        key: 'started_at',
        label: 'Start at',
        type: 'datetime',
        required: false,
        helpText:
          'Date and time to start the broadcast. Leave it empty to start as soon as the Zap runs.',
      },
      {
        key: 'enable_typing_effect',
        label: 'Show typing indicator',
        type: 'boolean',
        required: false,
        helpText:
          'Shows the typing indicator on the device before each message is delivered.',
      },
      {
        key: 'typing_speed_ms',
        label: 'Typing speed in milliseconds',
        type: 'integer',
        required: false,
        helpText:
          'How long the typing indicator runs before sending. Allowed range is 100 to 800.',
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
