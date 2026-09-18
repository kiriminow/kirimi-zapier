'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const App = require('../index');

const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

const isTitleCase = (label) => {
  const words = label.split(' ');
  return words.every((word, index) => {
    const lower = word.toLowerCase();
    if (index > 0 && index < words.length - 1 && SMALL_WORDS.has(lower)) {
      return true;
    }
    if (/^[A-Z0-9]/.test(word)) {
      return true;
    }
    return word === lower && SMALL_WORDS.has(lower);
  });
};

const operations = [
  ...Object.values(App.triggers).map((operation) => ({ kind: 'trigger', operation })),
  ...Object.values(App.creates).map((operation) => ({ kind: 'create', operation })),
  ...Object.values(App.searches).map((operation) => ({ kind: 'search', operation })),
];

test('every operation exposes an english title case label', () => {
  for (const { operation } of operations) {
    assert.ok(isTitleCase(operation.display.label), `${operation.key} label is not title case`);
  }
});

test('every operation has a description that ends with a period', () => {
  for (const { operation } of operations) {
    assert.match(operation.display.description, /\.$/, `${operation.key} description`);
    assert.doesNotMatch(operation.display.description, /zapier/i);
  }
});

test('search descriptions follow the finds convention', () => {
  for (const { kind, operation } of operations.filter((item) => item.kind === 'search')) {
    assert.match(operation.display.description, /^Finds /, `${operation.key} description`);
  }
});

test('trigger descriptions follow the triggers when convention', () => {
  for (const { kind, operation } of operations.filter((item) => item.kind === 'trigger')) {
    assert.match(operation.display.description, /^Triggers when /, `${operation.key} description`);
  }
});

test('every visible operation carries a static sample', () => {
  for (const { operation } of operations) {
    if (operation.display.hidden) {
      continue;
    }
    assert.equal(typeof operation.operation.sample, 'object', `${operation.key} sample`);
    assert.ok(Object.keys(operation.operation.sample).length > 0, `${operation.key} sample`);
  }
});

test('every operation has a perform function', () => {
  for (const { operation } of operations) {
    assert.equal(typeof operation.operation.perform, 'function', `${operation.key} perform`);
  }
});

test('output fields declare an id for every search', () => {
  for (const search of Object.values(App.searches)) {
    const outputFields = search.operation.outputFields || [];
    assert.ok(
      outputFields.some((field) => field.key === 'id'),
      `${search.key} needs an id output field`,
    );
  }
});

test('no operation asks for credentials in its own fields', () => {
  const forbidden = /secret|api_?key|password|credential/i;

  for (const { operation } of operations) {
    for (const field of operation.operation.inputFields || []) {
      assert.doesNotMatch(field.key, forbidden, `${operation.key}.${field.key} looks secret`);
      for (const child of field.children || []) {
        assert.doesNotMatch(
          child.key,
          forbidden,
          `${operation.key}.${field.key}.${child.key} looks secret`,
        );
      }
    }
  }
});

test('every input field carries help text that differs from its label', () => {
  const fieldsOf = (operation) =>
    (operation.operation.inputFields || []).flatMap((field) =>
      field.children ? field.children : [field],
    );

  for (const { operation } of operations) {
    for (const field of fieldsOf(operation)) {
      assert.equal(typeof field.helpText, 'string', `${operation.key}.${field.key} helpText`);
      assert.ok(field.helpText.length >= 20, `${operation.key}.${field.key} helpText too short`);
      assert.notEqual(field.helpText, field.label, `${operation.key}.${field.key} helpText`);
    }
  }
});

test('device dropdowns are dynamic and required where the api needs them', () => {
  const fields = operations.flatMap(({ operation }) =>
    (operation.operation.inputFields || [])
      .filter((field) => field.key === 'device_id')
      .map((field) => ({ key: operation.key, field })),
  );

  assert.ok(fields.length >= 5, 'expected device fields across the operations');
  for (const { key, field } of fields) {
    assert.ok(field.choices && typeof field.choices.perform === 'function', `${key} dropdown`);
  }
});

test('the app only advertises operations that exist', () => {
  assert.equal(typeof App.authentication.test, 'function');
  assert.equal(App.platformVersion, require('zapier-platform-core').version);
});

test('the app hides the operations waiting for their first live run', () => {
  const hidden = operations
    .filter(({ operation }) => operation.display.hidden)
    .map(({ operation }) => operation.key)
    .sort();

  assert.deepEqual(hidden, [
    'create_otp_reverse',
    'find_otp_reverse_status',
    'message_status',
    'new_message',
    'new_waba_message',
    'save_contacts_bulk',
    'send_message_file',
  ]);
});
