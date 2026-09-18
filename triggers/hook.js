'use strict';

const { BASE_URL } = require('../lib/constants');
const { deviceField } = require('../lib/devices');
const { normalizeEvent, outputFields, verifyDelivery } = require('../lib/events');
const { compact } = require('../lib/util');

const wabaField = () => ({
  key: 'waba_id',
  label: 'WABA ID',
  type: 'string',
  required: true,
  helpText:
    'WhatsApp Business Account ID from the Kirimi dashboard. This is not the device ID.',
});

const onlyIncomingField = () => ({
  key: 'only_incoming',
  label: 'Only messages from your customers',
  type: 'boolean',
  required: false,
  default: 'true',
  helpText:
    'Leave this on to ignore messages you sent yourself from the device. Turn it off to trigger on every message.',
});

const scopeInputFields = (scope) =>
  scope === 'waba'
    ? [wabaField()]
    : [deviceField(), onlyIncomingField()];

const scopeBody = (scope, bundle) =>
  scope === 'waba'
    ? { waba_id: bundle.inputData.waba_id }
    : { device_id: bundle.inputData.device_id };

const isOnlyIncoming = (bundle) => {
  const value = bundle.inputData.only_incoming;
  if (value === undefined || value === null || value === '') {
    return true;
  }
  return value === true || value === 'true' || value === 1 || value === '1';
};

const buildHookTrigger = ({ key, noun, label, description, events, scope, sample }) => ({
  key,
  noun,
  display: {
    label,
    description,
    hidden: true,
  },
  operation: {
    type: 'hook',
    inputFields: scopeInputFields(scope),
    performSubscribe: async (z, bundle) => {
      const response = await z.request({
        url: `${BASE_URL}/v1/webhook/subscribe`,
        method: 'POST',
        body: compact({
          target_url: bundle.targetUrl,
          events,
          label: 'zapier',
          ...scopeBody(scope, bundle),
        }),
      });

      return response.data.data;
    },
    performUnsubscribe: async (z, bundle) => {
      await z.request({
        url: `${BASE_URL}/v1/webhook/unsubscribe`,
        method: 'POST',
        body: { id: bundle.subscribeData.id },
      });

      return {};
    },
    perform: (z, bundle) => {
      verifyDelivery(z, bundle);

      const event = normalizeEvent(bundle, bundle.cleanedRequest);
      if (scope !== 'waba' && isOnlyIncoming(bundle) && event.from_me) {
        return [];
      }

      return [event];
    },
    performList: async (z, bundle) => {
      const response = await z.request({
        url: `${BASE_URL}/v1/webhook/events`,
        method: 'POST',
        body: compact({
          ...scopeBody(scope, bundle),
          events,
          limit: 20,
        }),
      });

      const items = (response.data.data && response.data.data.items) || [];
      return items.map((item) => normalizeEvent(bundle, item));
    },
    outputFields,
    sample,
  },
});

module.exports = { buildHookTrigger };
