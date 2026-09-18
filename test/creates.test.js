'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zapier = require('zapier-platform-core');
const App = require('../index');
const { AUTH, intercept } = require('./helpers');

const appTester = zapier.createAppTester(App);

const perform = (key, bundle = {}) =>
  appTester(App.creates[key].operation.perform, {
    authData: AUTH,
    inputData: bundle.inputData || {},
  });

test('credentials travel in the request body, never in headers', async () => {
  let seenHeaders = null;
  const nock = require('nock');
  const { BASE_URL } = require('../lib/constants');

  nock(BASE_URL)
    .post('/v1/send-message')
    .reply(function reply() {
      seenHeaders = this.req.headers;
      return [200, { success: true, data: { message_id: 'MID-1' }, message: 'OK' }];
    });

  await perform('send_message', {
    inputData: {
      device_id: 'D-1',
      receiver: '6281234567890',
      message: 'Hello',
    },
  });

  assert.equal(seenHeaders.secret, undefined);
  assert.equal(seenHeaders.user_code, undefined);
  assert.equal(seenHeaders.authorization, undefined);
});

test('the shared sender drops blank optional fields', async () => {
  const captured = intercept('/v1/send-message');

  await perform('send_message', {
    inputData: {
      device_id: 'D-1',
      receiver: '6281234567890',
      message: 'Hello',
      media_url: '',
      file_name: '',
      enable_typing_effect: '',
      typing_speed_ms: '',
      quoted_message_id: '',
    },
  });

  assert.deepEqual(captured[0], {
    user_code: AUTH.user_code,
    secret: AUTH.secret,
    device_id: 'D-1',
    receiver: '6281234567890',
    message: 'Hello',
  });
});

test('the sender forwards typing options as the api expects them', async () => {
  const captured = intercept('/v1/send-message');

  await perform('send_message', {
    inputData: {
      device_id: 'D-1',
      receiver: '6281234567890',
      message: 'Hello',
      media_url: 'https://example.com/a.png',
      file_name: 'a.png',
      enable_typing_effect: true,
      typing_speed_ms: 500,
      quoted_message_id: 'MID-9',
    },
  });

  assert.equal(captured[0].enableTypingEffect, true);
  assert.equal(captured[0].typingSpeedMs, 500);
  assert.equal(captured[0].fileName, 'a.png');
  assert.equal(captured[0].quotedMessageId, 'MID-9');
  assert.equal(captured[0].media_url, 'https://example.com/a.png');
});

test('the fast sender never sends typing options', async () => {
  const captured = intercept('/v1/send-message-fast');

  await perform('send_message_fast', {
    inputData: {
      device_id: 'D-1',
      receiver: '6281234567890',
      message: 'Hello',
    },
  });

  assert.equal(captured[0].enableTypingEffect, undefined);
  assert.equal(captured[0].typingSpeedMs, undefined);
});

test('broadcast sends numbers as an array', async () => {
  const captured = intercept('/v1/broadcast-message');

  await perform('broadcast_message', {
    inputData: {
      device_id: 'D-1',
      label: 'Promo',
      numbers: ['628111', '628222'],
      message: 'Promo hari ini',
      delay: 60,
      started_at: '2026-01-01T08:00:00+07:00',
    },
  });

  assert.deepEqual(captured[0].numbers, ['628111', '628222']);
  assert.equal(captured[0].label, 'Promo');
  assert.equal(captured[0].delay, 60);
  assert.equal(captured[0].started_at, '2026-01-01T08:00:00+07:00');
});

test('template send parses the header and button json', async () => {
  const captured = intercept('/v1/waba/send-message');

  await perform('send_waba_template', {
    inputData: {
      waba_id: 'WABA-1',
      to: '6281234567890',
      template_name: 'order_update',
      variables: ['INV-1', 'Budi'],
      header: '{"type":"text","text":"Halo"}',
      buttons: '[{"type":"text","text":"Lacak"}]',
    },
  });

  assert.deepEqual(captured[0].header, { type: 'text', text: 'Halo' });
  assert.deepEqual(captured[0].buttons, [{ type: 'text', text: 'Lacak' }]);
  assert.deepEqual(captured[0].variables, ['INV-1', 'Budi']);
});

test('template send rejects broken json', async () => {
  await assert.rejects(
    () =>
      perform('send_waba_template', {
        inputData: {
          waba_id: 'WABA-1',
          to: '6281234567890',
          template_name: 'order_update',
          header: '{not json',
        },
      }),
    /Header must be valid JSON/,
  );
});

test('text replies keep the documented message shape', async () => {
  const captured = intercept('/v1/waba/messages/reply');

  await perform('reply_waba_message', {
    inputData: {
      waba_id: 'WABA-1',
      to: '6281234567890',
      message_type: 'text',
      text: 'Terima kasih',
    },
  });

  assert.deepEqual(captured[0].message, { type: 'text', text: 'Terima kasih' });
});

test('document replies carry the caption and filename', async () => {
  const captured = intercept('/v1/waba/messages/reply');

  await perform('reply_waba_message', {
    inputData: {
      waba_id: 'WABA-1',
      to: '6281234567890',
      message_type: 'document',
      media_url: 'https://example.com/invoice.pdf',
      caption: 'Invoice',
      file_name: 'invoice.pdf',
    },
  });

  assert.deepEqual(captured[0].message, {
    type: 'document',
    media_url: 'https://example.com/invoice.pdf',
    caption: 'Invoice',
    filename: 'invoice.pdf',
  });
});

test('document replies without media fail before the request', async () => {
  await assert.rejects(
    () =>
      perform('reply_waba_message', {
        inputData: {
          waba_id: 'WABA-1',
          to: '6281234567890',
          message_type: 'document',
        },
      }),
    /Add the media URL/,
  );
});

test('otp send defaults to the whatsapp method', async () => {
  const captured = intercept('/v2/otp/send');

  await perform('send_otp', {
    inputData: { phone: '6281234567890' },
  });

  assert.equal(captured[0].method, 'whatsapp');
  assert.equal(captured[0].phone, '6281234567890');
});

test('otp send needs a device for the device method', async () => {
  await assert.rejects(
    () => perform('send_otp', { inputData: { phone: '6281234567890', method: 'device' } }),
    /Pick the device/,
  );
});

test('otp send needs waba details for the waba_user method', async () => {
  await assert.rejects(
    () =>
      perform('send_otp', {
        inputData: { phone: '6281234567890', method: 'waba_user', waba_id: 'WABA-1' },
      }),
    /WABA ID and an approved authentication template/,
  );
});

test('otp send converts the bracketed placeholder for the api', async () => {
  const captured = intercept('/v2/otp/send');

  await perform('send_otp', {
    inputData: {
      phone: '6281234567890',
      method: 'device',
      device_id: 'D-1',
      custom_message: 'Kode OTP Anda [otp]',
    },
  });

  assert.equal(captured[0].device_id, 'D-1');
  assert.equal(captured[0].custom_message, 'Kode OTP Anda {{otp}}');
  assert.equal(captured[0].app_name, undefined);
});

test('otp send refuses a custom message without the placeholder', async () => {
  await assert.rejects(
    () =>
      perform('send_otp', {
        inputData: {
          phone: '6281234567890',
          method: 'device',
          device_id: 'D-1',
          custom_message: 'Kode OTP Anda',
        },
      }),
    /Add \[otp\] to the custom message/,
  );
});

test('otp verify sends the canonical otp_code field', async () => {
  const captured = intercept('/v2/otp/verify');

  await perform('verify_otp', {
    inputData: { phone: '6281234567890', otp_code: '123456' },
  });

  assert.equal(captured[0].otp_code, '123456');
});

test('save contact sends nama and nomor', async () => {
  const captured = intercept('/v1/save-contact');

  await perform('save_contact', {
    inputData: { nama: 'Budi', nomor: '6281234567890' },
  });

  assert.equal(captured[0].nama, 'Budi');
  assert.equal(captured[0].nomor, '6281234567890');
  assert.equal(captured[0].name, undefined);
  assert.equal(captured[0].phone, undefined);
});

test('bulk contact save sends a contacts array', async () => {
  const captured = intercept('/v1/save-contacts-bulk');

  await perform('save_contacts_bulk', {
    inputData: {
      contacts: [
        { nama: 'Budi', nomor: '628111' },
        { nama: 'Ani', nomor: '628222' },
      ],
    },
  });

  assert.deepEqual(captured[0].contacts, [
    { nama: 'Budi', nomor: '628111' },
    { nama: 'Ani', nomor: '628222' },
  ]);
});

test('reverse otp create sends the phone and callback', async () => {
  const captured = intercept('/v2/otp-reverse/create');

  await perform('create_otp_reverse', {
    inputData: {
      phone: '6281234567890',
      device_id: 'D-1',
      callback_url: 'https://example.com/hook',
      custom_message: 'Kirim [token] dari [phone]',
    },
  });

  assert.equal(captured[0].phone, '6281234567890');
  assert.equal(captured[0].device_id, 'D-1');
  assert.equal(captured[0].callback_url, 'https://example.com/hook');
  assert.equal(captured[0].custom_message, 'Kirim {{token}} dari {{phone}}');
});

test('reverse otp create refuses a partial placeholder', async () => {
  await assert.rejects(
    () =>
      perform('create_otp_reverse', {
        inputData: {
          phone: '6281234567890',
          device_id: 'D-1',
          custom_message: 'Kirim [token] saja',
        },
      }),
    /Add both \[token\] and \[phone\]/,
  );
});

test('create results always expose an id, success, and message', async () => {
  intercept('/v1/send-message', { success: true, data: null, message: 'Queued' });

  const result = await perform('send_message', {
    inputData: { device_id: 'D-1', receiver: '628111', message: 'Hi' },
  });

  assert.equal(result.success, true);
  assert.equal(result.message, 'Queued');
  assert.equal(typeof result.id, 'string');
  assert.ok(result.id.length > 0);
});

test('create results keep the payload fields and use its id', async () => {
  intercept('/v1/save-contact', {
    success: true,
    data: { id: 'CNT-9', nama: 'Budi', nomor: '628111' },
    message: 'Saved',
  });

  const result = await perform('save_contact', {
    inputData: { nama: 'Budi', nomor: '628111' },
  });

  assert.equal(result.id, 'CNT-9');
  assert.equal(result.nama, 'Budi');
  assert.equal(result.success, true);
});

test('scalar payloads are wrapped instead of dropped', async () => {
  intercept('/v1/save-contact', { success: true, data: 42, message: 'OK' });

  const result = await perform('save_contact', {
    inputData: { nama: 'Budi', nomor: '628111' },
  });

  assert.equal(result.data, 42);
  assert.equal(result.success, true);
});
