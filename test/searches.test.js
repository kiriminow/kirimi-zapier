'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zapier = require('zapier-platform-core');
const App = require('../index');
const { AUTH, intercept } = require('./helpers');

const appTester = zapier.createAppTester(App);

test('device status returns a single match with a stable id', async () => {
  intercept('/v1/device-status-enhanced', {
    success: true,
    data: { device_id: 'D-1', name: 'Sales', status: 'connected', connected: true },
    message: 'OK',
  });

  const results = await appTester(App.searches.find_device_status.operation.perform, {
    authData: AUTH,
    inputData: { device_id: 'D-1' },
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'D-1');
  assert.equal(results[0].status, 'connected');
});

test('device status returns an empty array when nothing is found', async () => {
  intercept('/v1/device-status-enhanced', {
    success: true,
    data: null,
    message: 'OK',
  });

  const results = await appTester(App.searches.find_device_status.operation.perform, {
    authData: AUTH,
    inputData: { device_id: 'D-404' },
  });

  assert.deepEqual(results, []);
});

test('reverse otp status searches by token', async () => {
  const captured = intercept('/v2/otp-reverse/status', {
    success: true,
    data: { token: 'TKN-1', status: 'verified', phone: '628111' },
    message: 'OK',
  });

  const results = await appTester(App.searches.find_otp_reverse_status.operation.perform, {
    authData: AUTH,
    inputData: { verification_token: 'TKN-1' },
  });

  assert.equal(captured[0].token, 'TKN-1');
  assert.equal(results[0].id, 'TKN-1');
  assert.equal(results[0].status, 'verified');
});

test('device choices map the list payload into dropdown choices', async () => {
  intercept('/v1/list-devices', {
    success: true,
    data: {
      items: [
        { device_id: 'D-1', name: 'Sales' },
        { device_id: 'D-2', phone: '628111' },
      ],
    },
    message: 'OK',
  });

  const { results } = await appTester(require('../lib/devices').deviceChoices, {});

  assert.deepEqual(results, [
    { id: 'D-1', label: 'Sales' },
    { id: 'D-2', label: '628111' },
  ]);
});

test('device choices tolerate an unexpected payload', async () => {
  intercept('/v1/list-devices', { success: true, data: null, message: 'OK' });

  const { results } = await appTester(require('../lib/devices').deviceChoices, {});

  assert.deepEqual(results, []);
});

test('message status searches by device and client message id', async () => {
  const captured = intercept('/v1/message-status', {
    success: true,
    data: {
      clientMsgId: 'order-1001',
      state: 'sent',
      message_id: 'MID-9',
      created_at: '2026-11-05T09:30:00.000Z',
      sent_at: '2026-11-05T09:30:02.000Z',
      delivered_at: null,
      read_at: null,
      error_message: null,
    },
    message: 'OK',
  });

  const results = await appTester(App.searches.find_message_status.operation.perform, {
    authData: AUTH,
    inputData: { device_id: 'D-1', client_msg_id: 'order-1001' },
  });

  assert.equal(captured[0].device_id, 'D-1');
  assert.equal(captured[0].clientMsgId, 'order-1001');
  assert.equal(results[0].id, 'MID-9');
  assert.equal(results[0].state, 'sent');
});

test('message status returns an empty array when the message is unknown', async () => {
  intercept(
    '/v1/message-status',
    { success: false, data: null, message: 'No message found for this clientMsgId' },
    404,
  );

  const results = await appTester(App.searches.find_message_status.operation.perform, {
    authData: AUTH,
    inputData: { device_id: 'D-1', client_msg_id: 'nope' },
  });

  assert.deepEqual(results, []);
});

test('message status surfaces authentication failures', async () => {
  intercept('/v1/message-status', { success: false, data: null, message: 'Invalid secret' }, 401);

  await assert.rejects(
    () =>
      appTester(App.searches.find_message_status.operation.perform, {
        authData: AUTH,
        inputData: { device_id: 'D-1', client_msg_id: 'x' },
      }),
    /Invalid secret/,
  );
});

test('waba conversations map each item to its customer number', async () => {
  const captured = intercept('/v1/waba/conversations', {
    success: true,
    data: {
      items: [
        {
          phone_number: '6281234567890',
          last_inbound_at: '2026-11-05T09:30:00.000Z',
          inbound_count_24h: 3,
          window_expires_at: '2026-11-06T09:30:00.000Z',
        },
      ],
      page: 1,
      limit: 50,
      total: 1,
    },
    message: 'OK',
  });

  const results = await appTester(App.searches.find_waba_conversations.operation.perform, {
    authData: AUTH,
    inputData: { limit: 50, page: 1 },
  });

  assert.equal(captured[0].limit, 50);
  assert.equal(captured[0].page, 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, '6281234567890');
  assert.equal(results[0].inbound_count_24h, 3);
});

test('waba conversations return an empty array and surface errors', async () => {
  intercept('/v1/waba/conversations', { success: true, data: { items: [] }, message: 'OK' });
  const empty = await appTester(App.searches.find_waba_conversations.operation.perform, {
    authData: AUTH,
    inputData: {},
  });
  assert.deepEqual(empty, []);

  intercept('/v1/waba/conversations', { success: false, data: null, message: 'No WABA package' }, 403);
  await assert.rejects(
    () =>
      appTester(App.searches.find_waba_conversations.operation.perform, {
        authData: AUTH,
        inputData: {},
      }),
    /No WABA package/,
  );
});

test('waba choices map the accounts payload into dropdown choices', async () => {
  intercept('/v1/waba/accounts', {
    success: true,
    data: {
      items: [
        { waba_id: '111', name: 'Toko Budi', display_phone_number: '+62 812-1' },
        { waba_id: '222', name: null, display_phone_number: null },
      ],
    },
    message: 'OK',
  });

  const { results } = await appTester(require('../lib/wabas').wabaChoices, {});

  assert.deepEqual(results, [
    { id: '111', label: 'Toko Budi (+62 812-1)' },
    { id: '222', label: '222' },
  ]);
});
