'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zapier = require('zapier-platform-core');
const App = require('../index');
const { AUTH, intercept } = require('./helpers');
const { signPayload } = require('../lib/events');

const appTester = zapier.createAppTester(App);

const MESSAGE = {
  event: 'message',
  deviceId: 'D-2J3IG',
  msgId: '3EB0C767D097B7C7C030',
  from: '6281234567890',
  message: 'Hello',
  isFromMe: false,
  isFromGroup: false,
  messageType: 'text',
  datetime_wib: '2026-01-31 08:15:42',
};

const signedBundle = (payload, overrides = {}) => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const content = JSON.stringify(payload);
  return {
    inputData: { device_id: 'D-2J3IG', only_incoming: true },
    authData: AUTH,
    subscribeData: { id: 'SUB-1', secret: 'S3CR3T' },
    cleanedRequest: payload,
    rawRequest: {
      content,
      headers: {
        'x-kirimi-timestamp': timestamp,
        'x-kirimi-signature': signPayload('S3CR3T', timestamp, content),
      },
    },
    ...overrides,
  };
};

test('subscribe registers the hook url with the device and events', async () => {
  const captured = intercept('/v1/webhook/subscribe', {
    success: true,
    data: { id: 'SUB-1', secret: 'S3CR3T', target_url: 'https://hooks.zapier.com/x' },
    message: 'OK',
  });

  const subscribeData = await appTester(App.triggers.new_message.operation.performSubscribe, {
    authData: AUTH,
    inputData: { device_id: 'D-2J3IG' },
    targetUrl: 'https://hooks.zapier.com/hooks/catch/1/abc/',
  });

  assert.equal(captured[0].target_url, 'https://hooks.zapier.com/hooks/catch/1/abc/');
  assert.deepEqual(captured[0].events, ['message']);
  assert.equal(captured[0].device_id, 'D-2J3IG');
  assert.equal(captured[0].label, 'zapier');
  assert.equal(captured[0].user_code, AUTH.user_code);
  assert.equal(subscribeData.id, 'SUB-1');
});

test('subscribe for waba sends waba_id instead of device_id', async () => {
  const captured = intercept('/v1/webhook/subscribe', {
    success: true,
    data: { id: 'SUB-2', secret: 'S3CR3T' },
    message: 'OK',
  });

  await appTester(App.triggers.new_waba_message.operation.performSubscribe, {
    authData: AUTH,
    inputData: { waba_id: 'WABA-1' },
    targetUrl: 'https://hooks.zapier.com/hooks/catch/1/abc/',
  });

  assert.equal(captured[0].waba_id, 'WABA-1');
  assert.equal(captured[0].device_id, undefined);
});

test('unsubscribe sends the subscription id back', async () => {
  const captured = intercept('/v1/webhook/unsubscribe', {
    success: true,
    data: { id: 'SUB-1', status: 'revoked' },
    message: 'OK',
  });

  await appTester(App.triggers.new_message.operation.performUnsubscribe, {
    authData: AUTH,
    subscribeData: { id: 'SUB-1', secret: 'S3CR3T' },
  });

  assert.equal(captured[0].id, 'SUB-1');
});

test('perform normalizes a signed delivery', async () => {
  const results = await appTester(
    App.triggers.new_message.operation.perform,
    signedBundle(MESSAGE),
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].id, '3EB0C767D097B7C7C030');
  assert.equal(results[0].created_at, '2026-01-31T08:15:42+07:00');
  assert.equal(results[0].device_id, 'D-2J3IG');
  assert.equal(results[0].from, '6281234567890');
  assert.equal(results[0].message_id, '3EB0C767D097B7C7C030');
  assert.equal(results[0].event, 'message');
});

test('perform rejects a forged signature', async () => {
  const bundle = signedBundle(MESSAGE);
  bundle.rawRequest.headers['x-kirimi-signature'] = 'sha256=deadbeef';

  await assert.rejects(
    () => appTester(App.triggers.new_message.operation.perform, bundle),
    /signature did not match/,
  );
});

test('perform rejects an unsigned delivery when a secret exists', async () => {
  const bundle = signedBundle(MESSAGE);
  delete bundle.rawRequest.headers['x-kirimi-signature'];

  await assert.rejects(
    () => appTester(App.triggers.new_message.operation.perform, bundle),
    /unsigned delivery/,
  );
});

test('perform rejects a stale signature', async () => {
  const payload = MESSAGE;
  const content = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000) - 3600);
  const bundle = {
    inputData: { device_id: 'D-2J3IG' },
    authData: AUTH,
    subscribeData: { id: 'SUB-1', secret: 'S3CR3T' },
    cleanedRequest: payload,
    rawRequest: {
      content,
      headers: {
        'x-kirimi-timestamp': timestamp,
        'x-kirimi-signature': signPayload('S3CR3T', timestamp, content),
      },
    },
  };

  await assert.rejects(
    () => appTester(App.triggers.new_message.operation.perform, bundle),
    /stale signature/,
  );
});

test('perform skips the signature check when zapier hides the raw request', async () => {
  const results = await appTester(App.triggers.new_message.operation.perform, {
    inputData: { device_id: 'D-2J3IG' },
    authData: AUTH,
    cleanedRequest: MESSAGE,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].message, 'Hello');
});

test('perform ignores messages the device sent itself', async () => {
  const results = await appTester(
    App.triggers.new_message.operation.perform,
    signedBundle({ ...MESSAGE, isFromMe: true }),
  );

  assert.deepEqual(results, []);
});

test('perform keeps outgoing messages when the filter is off', async () => {
  const bundle = signedBundle({ ...MESSAGE, isFromMe: true });
  bundle.inputData.only_incoming = false;

  const results = await appTester(App.triggers.new_message.operation.perform, bundle);

  assert.equal(results.length, 1);
  assert.equal(results[0].from_me, true);
});

test('perform derives the status of a sent message', async () => {
  const results = await appTester(
    App.triggers.message_status.operation.perform,
    signedBundle({
      event: 'message.sent',
      deviceId: 'D-2J3IG',
      msgId: '3EB0C767D097B7C7C030',
      to: '6281234567890',
      message: 'Message sent successfully (queue: 120ms)',
      datetime_wib: '2026-01-31 08:15:42',
    }),
  );

  assert.equal(results[0].event, 'message.sent');
  assert.equal(results[0].status, 'sent');
  assert.equal(results[0].to, '6281234567890');
});

test('perform falls back to a stable id when the payload has none', async () => {
  const payload = {
    event: 'message.failed',
    deviceId: 'D-2J3IG',
    to: '6281234567890',
    error: 'not on whatsapp',
    datetime_wib: '2026-01-31 08:15:42',
  };

  const first = await appTester(App.triggers.message_status.operation.perform, signedBundle(payload));
  const second = await appTester(App.triggers.message_status.operation.perform, signedBundle(payload));

  assert.equal(first[0].status, 'failed');
  assert.equal(first[0].id, second[0].id);
  assert.match(first[0].id, /^message\.failed-/);
});

test('performList maps the recent events feed', async () => {
  const captured = intercept('/v1/webhook/events', {
    success: true,
    data: { items: [MESSAGE] },
    message: 'OK',
  });

  const results = await appTester(App.triggers.new_message.operation.performList, {
    authData: AUTH,
    inputData: { device_id: 'D-2J3IG' },
  });

  assert.equal(captured[0].device_id, 'D-2J3IG');
  assert.deepEqual(captured[0].events, ['message']);
  assert.equal(captured[0].limit, 20);
  assert.equal(results.length, 1);
  assert.equal(results[0].created_at, '2026-01-31T08:15:42+07:00');
});

test('the hook payload carries every key the polling sample promises', async () => {
  intercept('/v1/webhook/events', {
    success: true,
    data: { items: [MESSAGE] },
    message: 'OK',
  });

  const hook = await appTester(App.triggers.new_message.operation.perform, signedBundle(MESSAGE));
  const poll = await appTester(App.triggers.new_message.operation.performList, {
    authData: AUTH,
    inputData: { device_id: 'D-2J3IG' },
  });

  for (const key of Object.keys(poll[0])) {
    assert.ok(key in hook[0], `hook payload is missing the polling key ${key}`);
  }
});

test('the hook payload carries every key the static sample promises', () => {
  for (const trigger of Object.values(App.triggers)) {
    const perform = trigger.operation.perform;

    assert.equal(typeof trigger.operation.sample, 'object', `${trigger.key} sample`);
    assert.equal(trigger.operation.type, 'hook', `${trigger.key} type`);
    assert.equal(typeof perform, 'function', `${trigger.key} perform`);
  }
});

test('every trigger registers and cleans up its subscription', () => {
  for (const trigger of Object.values(App.triggers)) {
    assert.equal(typeof trigger.operation.performSubscribe, 'function', `${trigger.key} subscribe`);
    assert.equal(typeof trigger.operation.performUnsubscribe, 'function', `${trigger.key} unsubscribe`);
    assert.equal(typeof trigger.operation.performList, 'function', `${trigger.key} performList`);
  }
});
