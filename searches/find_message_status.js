'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { compact, isPlainObject, unwrapData } = require('../lib/util');

const isNotFound = (error) => {
  try {
    return JSON.parse(error.message).status === 404;
  } catch (parseError) {
    return error.status === 404;
  }
};

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  let response;
  try {
    response = await z.request({
      url: `${BASE_URL}/v1/message-status`,
      method: 'POST',
      body: compact({
        device_id: input.device_id,
        clientMsgId: input.client_msg_id,
      }),
    });
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }

  const payload = unwrapData(response);
  if (!isPlainObject(payload)) {
    return [];
  }

  const id = payload.message_id || payload.clientMsgId || input.client_msg_id;
  return [{ ...payload, id: String(id) }];
};

module.exports = {
  key: 'find_message_status',
  noun: 'Message',
  display: {
    label: 'Find Message Status',
    description:
      'Finds the delivery status of a message sent earlier from a WhatsApp device.',
    hidden: true,
  },
  operation: {
    inputFields: [
      deviceField({
        helpText:
          'The device that sent the message. The status lookup only searches messages from this device.',
      }),
      {
        key: 'client_msg_id',
        label: 'Client message ID',
        type: 'string',
        required: true,
        helpText:
          'The client message ID or idempotency key used when the message was sent. Messages are kept for 7 days.',
      },
    ],
    perform,
    sample: {
      id: '3EB0A1B2C3D4E5F6A7B8',
      clientMsgId: 'order-1001',
      state: 'sent',
      message_id: '3EB0A1B2C3D4E5F6A7B8',
      created_at: '2026-11-05T09:30:00.000Z',
      sent_at: '2026-11-05T09:30:02.000Z',
      delivered_at: null,
      read_at: null,
      error_message: null,
    },
    outputFields: [
      { key: 'id', label: 'Message ID', type: 'string', required: true },
      { key: 'clientMsgId', label: 'Client message ID', type: 'string' },
      { key: 'state', label: 'State', type: 'string' },
      { key: 'message_id', label: 'WhatsApp message ID', type: 'string' },
      { key: 'created_at', label: 'Created at', type: 'datetime' },
      { key: 'sent_at', label: 'Sent at', type: 'datetime' },
      { key: 'delivered_at', label: 'Delivered at', type: 'datetime' },
      { key: 'read_at', label: 'Read at', type: 'datetime' },
      { key: 'error_message', label: 'Error message', type: 'string' },
    ],
  },
};
