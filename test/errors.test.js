'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zapier = require('zapier-platform-core');
const App = require('../index');
const { AUTH, intercept, messageOf } = require('./helpers');

const appTester = zapier.createAppTester(App);

const send = () =>
  appTester(App.creates.send_message.operation.perform, {
    authData: AUTH,
    inputData: {
      device_id: 'D-1',
      receiver: '6281234567890',
      message: 'Hello',
    },
  });

const rejectsWith = async (expected) => {
  const error = await send().then(
    () => null,
    (thrown) => thrown,
  );

  assert.ok(error, 'expected the request to fail');
  assert.match(messageOf(error), expected);
  return error;
};

test('a 400 keeps the api message', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: 'device_id not found' }, 400);

  await rejectsWith(/device_id not found/);
});

test('a 401 tells the user to reconnect', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: 'invalid secret' }, 401);

  await rejectsWith(/invalid secret/);
});

test('a 402 explains the balance problem', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: '' }, 402);

  await rejectsWith(/balance is not enough/);
});

test('a 403 explains the package problem', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: '' }, 403);

  await rejectsWith(/package does not include this feature/);
});

test('a 404 explains the missing resource', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: '' }, 404);

  await rejectsWith(/could not find the resource/);
});

test('a 502 reports the undeliverable number', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: '' }, 502);

  await rejectsWith(/could not deliver to that phone number/);
});

test('a 500 stays a retryable platform error', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: 'boom' }, 500);

  await send().then(
    () => assert.fail('expected the request to fail'),
    () => undefined,
  );
});

test('a 429 is throttled so zapier retries it', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: 'too many' }, 429);

  await send().then(
    () => assert.fail('expected the request to fail'),
    () => undefined,
  );
});

test('a 200 with success false is treated as a failure', async () => {
  intercept('/v1/send-message', { success: false, data: null, message: 'number is blocked' }, 200);

  await rejectsWith(/number is blocked/);
});

test('a 200 with success true resolves', async () => {
  intercept('/v1/send-message', { success: true, data: { message_id: 'MID-1' }, message: 'OK' });

  const result = await send();

  assert.equal(result.id, 'MID-1');
});
