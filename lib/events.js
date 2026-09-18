'use strict';

const crypto = require('crypto');
const { isPlainObject } = require('./util');

const EVENT_SOURCES = {
  message: {
    triggerKey: 'new_message',
    label: 'New Inbound Message',
    description: 'Triggers when a WhatsApp message arrives on a device.',
    events: ['message'],
    scope: 'device',
  },
  message_status: {
    triggerKey: 'message_status',
    label: 'Message Status Updated',
    description:
      'Triggers when a WhatsApp message you sent is delivered or fails to deliver.',
    events: ['message.sent', 'message.failed'],
    scope: 'device',
  },
  new_waba_message: {
    triggerKey: 'new_waba_message',
    label: 'New WABA Message',
    description:
      'Triggers when a WhatsApp Business API message arrives on a WABA account.',
    events: ['message'],
    scope: 'waba',
  },
};

const SIGNATURE_MAX_SKEW_SECONDS = 300;

const toIsoWib = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
};

const fingerprint = (payload) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 12);

const STATUS_BY_EVENT = {
  'message.sent': 'sent',
  'message.failed': 'failed',
};

const normalizeEvent = (bundle, raw) => {
  const payload = isPlainObject(raw) ? raw : {};
  const event = typeof payload.event === 'string' ? payload.event : 'message';
  const createdAt = payload.created_at || toIsoWib(payload.datetime_wib);
  const inputData = bundle.inputData || {};

  return {
    ...payload,
    id: String(payload.id || payload.msgId || `${event}-${fingerprint(payload)}`),
    event,
    created_at: createdAt,
    device_id: payload.deviceId || inputData.device_id,
    waba_id: payload.wabaId || inputData.waba_id,
    message_id: payload.msgId || payload.clientMsgId,
    status: payload.status || STATUS_BY_EVENT[event],
    from_me: payload.isFromMe,
    error_code: payload.errorCode,
  };
};

const signPayload = (secret, timestamp, body) =>
  `sha256=${crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')}`;

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyDelivery = (z, bundle) => {
  const subscription = bundle.subscribeData;
  const secret = subscription && subscription.secret;
  if (!secret || !bundle.rawRequest) {
    return;
  }

  const headers = bundle.rawRequest.headers || {};
  const signature = headers['x-kirimi-signature'];
  const timestamp = headers['x-kirimi-timestamp'];

  if (!signature || !timestamp) {
    throw new z.errors.Error(
      'Kirimi rejected an unsigned delivery. Reconnect the app to refresh the subscription.',
      'SignatureMissing',
      401,
    );
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > SIGNATURE_MAX_SKEW_SECONDS) {
    throw new z.errors.Error(
      'Kirimi rejected a delivery with a stale signature. Reconnect the app to refresh the subscription.',
      'SignatureExpired',
      401,
    );
  }

  const expected = signPayload(secret, timestamp, bundle.rawRequest.content || '');
  if (!safeEqual(signature, expected)) {
    throw new z.errors.Error(
      'Kirimi rejected a delivery whose signature did not match. Reconnect the app to refresh the subscription.',
      'SignatureMismatch',
      401,
    );
  }
};

const outputFields = [
  { key: 'id', label: 'Event ID', type: 'string', required: true },
  { key: 'event', label: 'Event', type: 'string', required: true },
  { key: 'created_at', label: 'Created at', type: 'datetime', required: true },
  { key: 'device_id', label: 'Device ID', type: 'string' },
  { key: 'waba_id', label: 'WABA ID', type: 'string' },
  { key: 'from', label: 'From', type: 'string' },
  { key: 'to', label: 'To', type: 'string' },
  { key: 'message', label: 'Message', type: 'string' },
  { key: 'message_id', label: 'Message ID', type: 'string' },
  { key: 'status', label: 'Status', type: 'string' },
  { key: 'from_me', label: 'Sent by you', type: 'boolean' },
  { key: 'message_type', label: 'Message type', type: 'string' },
  { key: 'media_url', label: 'Media URL', type: 'string' },
  { key: 'error', label: 'Error message', type: 'string' },
  { key: 'error_code', label: 'Error code', type: 'string' },
];

module.exports = {
  EVENT_SOURCES,
  normalizeEvent,
  outputFields,
  signPayload,
  toIsoWib,
  verifyDelivery,
};
