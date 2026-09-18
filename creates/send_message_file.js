'use strict';

const https = require('https');
const FormData = require('form-data');
const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { shapeCreateResult } = require('../lib/util');

const downloadStream = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        response.pause();
        resolve({
          stream: response,
          length: Number(response.headers['content-length']) || undefined,
        });
      })
      .on('error', reject);
  });

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const download = await downloadStream(input.file);
  const fileName = input.file_name || 'file';

  const form = new FormData();
  form.append('user_code', bundle.authData.user_code);
  form.append('secret', bundle.authData.secret);
  form.append('device_id', input.device_id);
  form.append('receiver', input.receiver);
  form.append('file', download.stream, {
    filename: fileName,
    knownLength: download.length,
  });
  if (input.file_name) form.append('fileName', input.file_name);
  if (input.message) form.append('message', input.message);
  if (input.quoted_message_id) {
    form.append('quotedMessageId', input.quoted_message_id);
  }
  download.stream.resume();

  const response = await z.request({
    url: `${BASE_URL}/v1/send-message-file`,
    method: 'POST',
    body: form,
  });

  return shapeCreateResult(response);
};

module.exports = {
  key: 'send_message_file',
  noun: 'Message',
  display: {
    label: 'Send Message with File',
    description:
      'Creates a WhatsApp message that carries an uploaded file, up to 50 MB.',
    hidden: true,
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
        key: 'file',
        label: 'File',
        type: 'file',
        required: true,
        helpText:
          'File to deliver. Images, videos, audio, and documents up to 50 MB are supported.',
      },
      {
        key: 'file_name',
        label: 'File name',
        type: 'string',
        required: false,
        helpText:
          'Name given to the file inside WhatsApp, including the extension, for example report.pdf.',
      },
      {
        key: 'message',
        label: 'Caption',
        type: 'text',
        required: false,
        helpText: 'Text delivered together with the file as its caption.',
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
