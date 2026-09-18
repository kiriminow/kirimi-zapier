'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zapier = require('zapier-platform-core');
const App = require('../index');
const { AUTH, intercept } = require('./helpers');

const appTester = zapier.createAppTester(App);

test('authentication test unwraps the envelope and injects credentials', async () => {
  const captured = intercept('/v1/user-info', {
    success: true,
    data: { name: 'Kirimi Account', email: 'ops@kirimi.id' },
    message: 'OK',
  });

  const result = await appTester(App.authentication.test, {
    authData: AUTH,
  });

  assert.equal(captured[0].user_code, AUTH.user_code);
  assert.equal(captured[0].secret, AUTH.secret);
  assert.equal(result.name, 'Kirimi Account');
});

test('connection label prefers the account name', () => {
  const label = App.authentication.connectionLabel(null, {
    authData: { ...AUTH, user_code: 'U-123' },
    inputData: { name: 'Kirimi Account', user_code: 'U-123' },
  });

  assert.equal(label, 'Kirimi Account');
});

test('connection label falls back to the user code', () => {
  const label = App.authentication.connectionLabel(null, {
    authData: { ...AUTH, user_code: 'U-123' },
    inputData: {},
  });

  assert.equal(label, 'U-123');
});

test('auth fields are the only place holding the secret', () => {
  const keys = App.authentication.fields.map((field) => field.key);

  assert.deepEqual(keys, ['user_code', 'secret']);
  for (const field of App.authentication.fields) {
    assert.match(field.helpText, /\[.+\]\(https:\/\/.+\).*/, `${field.key} needs a link`);
  }
});
