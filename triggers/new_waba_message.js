'use strict';

const { EVENT_SOURCES } = require('../lib/events');
const { buildHookTrigger } = require('./hook');

const source = EVENT_SOURCES.new_waba_message;

module.exports = buildHookTrigger({
  key: source.triggerKey,
  noun: 'Message',
  label: source.label,
  description: source.description,
  events: source.events,
  scope: source.scope,
  sample: {
    id: '01J8Z2W4K6Z8Q5R1V0M3N7P2TB',
    event: 'message',
    created_at: '2026-01-31T08:15:42+07:00',
    waba_id: '123456789012345',
  },
});
