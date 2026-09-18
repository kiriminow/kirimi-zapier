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
