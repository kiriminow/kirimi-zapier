'use strict';

const { BASE_URL } = require('../lib/constants');
const { compact, parseJsonInput, shapeCreateResult } = require('../lib/util');

const buildMessage = (z, input) => {
  const type = input.message_type || 'text';

  if (type === 'text') {
    if (!input.text) {
      throw new z.errors.Error(
        'Add the text you want to reply with.',
        'MissingText',
        400,
      );
    }
    return { type, text: input.text };
  }

  if (type === 'interactive') {
    const interactive = parseJsonInput(z, input.interactive, 'Interactive payload');
    if (!interactive) {
      throw new z.errors.Error(
        'Add the interactive payload you want to reply with.',
        'MissingInteractive',
        400,
      );
    }
    return { type, interactive };
  }

  if (!input.media_url) {
    throw new z.errors.Error(
      `Add the media URL of the ${type} you want to reply with.`,
      'MissingMediaUrl',
      400,
    );
  }

  return compact({
    type,
    media_url: input.media_url,
    caption: input.caption,
    filename: input.file_name,
  });
};

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/waba/messages/reply`,
    method: 'POST',
    body: compact({
      waba_id: input.waba_id,
      to: input.to,
      message: buildMessage(z, input),
    }),
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'reply_waba_message',
  noun: 'Reply',
  display: {
    label: 'Reply WABA Message',
    description:
      'Creates a free-form WhatsApp Business API reply inside an open conversation.',
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
          'The number that messaged you first. Replies only work within 24 hours of that message.',
      },
      {
        key: 'message_type',
        label: 'Reply type',
        type: 'string',
        required: true,
        default: 'text',
        choices: {
          text: 'Text',
          image: 'Image',
          document: 'Document',
          audio: 'Audio',
          video: 'Video',
          interactive: 'Interactive',
        },
        helpText:
          'Kind of content to send. Free-form replies are allowed only inside the 24 hour service window.',
      },
      {
        key: 'text',
        label: 'Reply text',
        type: 'text',
        required: false,
        helpText: 'Body of the reply. Required when the reply type is Text.',
      },
      {
        key: 'media_url',
        label: 'Media URL',
        type: 'string',
        required: false,
        helpText:
          'Public link to the media to send. Required for image, document, audio, and video replies.',
      },
      {
        key: 'caption',
        label: 'Media caption',
        type: 'text',
        required: false,
        helpText: 'Caption shown under an image, document, or video reply.',
      },
      {
        key: 'file_name',
        label: 'Document file name',
        type: 'string',
        required: false,
        helpText:
          'Name shown for a document reply, including the extension, for example invoice.pdf.',
      },
      {
        key: 'interactive',
        label: 'Interactive payload',
        type: 'text',
        required: false,
        helpText:
          'JSON object with the Meta interactive message, for example a list or button set.',
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
