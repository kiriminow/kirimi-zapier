'use strict';

const { BASE_URL } = require('../lib/constants');
const { compact, isPlainObject, unwrapData } = require('../lib/util');

const perform = async (z, bundle) => {
  const input = bundle.inputData;
  const response = await z.request({
    url: `${BASE_URL}/v1/waba/conversations`,
    method: 'POST',
    body: compact({
      limit: input.limit,
      page: input.page,
    }),
  });

  const payload = unwrapData(response);
  const items = isPlainObject(payload) && Array.isArray(payload.items) ? payload.items : [];

  return items
    .filter(isPlainObject)
    .map((item) => ({ ...item, id: String(item.phone_number) }));
};

module.exports = {
  key: 'find_waba_conversations',
  noun: 'Conversation',
  display: {
    label: 'Find WABA Conversations',
    description:
      'Finds customers who messaged your WhatsApp Business API accounts in the last 24 hours.',
    hidden: true,
  },
  operation: {
    inputFields: [
      {
        key: 'limit',
        label: 'Results per page',
        type: 'integer',
        required: false,
        helpText: 'How many conversations to return, from 1 to 200. Kirimi returns 50 by default.',
      },
      {
        key: 'page',
        label: 'Page',
        type: 'integer',
        required: false,
        helpText: 'Page number to return, starting at 1. Kirimi returns page 1 by default.',
      },
    ],
    perform,
    sample: {
      id: '6281234567890',
      phone_number: '6281234567890',
      last_inbound_at: '2026-11-05T09:30:00.000Z',
      inbound_count_24h: 3,
      window_expires_at: '2026-11-06T09:30:00.000Z',
    },
    outputFields: [
      { key: 'id', label: 'Customer number', type: 'string', required: true },
      { key: 'phone_number', label: 'Customer number', type: 'string' },
      { key: 'last_inbound_at', label: 'Last inbound message at', type: 'datetime' },
      { key: 'inbound_count_24h', label: 'Inbound messages in 24 hours', type: 'integer' },
      { key: 'window_expires_at', label: 'Reply window closes at', type: 'datetime' },
    ],
  },
};
