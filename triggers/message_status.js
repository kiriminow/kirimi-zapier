'use strict';

const { EVENT_SOURCES } = require('../lib/events');
const { buildHookTrigger } = require('./hook');

const source = EVENT_SOURCES.message_status;

module.exports = buildHookTrigger({
  key: source.triggerKey,
  noun: 'Message',
  label: source.label,
  description: source.description,
  events: source.events,
  scope: source.scope,
  sample: {
    id: '01J8Z2W4K6Z8Q5R1V0M3N7P2TB',
    event: 'message.sent',
    created_at: '2026-01-31T08:15:42+07:00',
    device_id: 'D-2J3IG',
    to: '6281234567890',
    message_id: '3EB0C767D097B7C7C030',
    status: 'sent',
    message: 'Message sent successfully (queue: 120ms)',
  },
});
