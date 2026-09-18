'use strict';

const isPlainObject = (value) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const compact = (input) =>
  Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );

const toBoolean = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value === 'true' || value === '1' || value === 1;
};

const parseJsonInput = (z, value, label) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new z.errors.Error(`${label} must be valid JSON.`, 'InvalidJson', 400);
  }
};

const normalizePlaceholders = (value, ...names) => {
  if (typeof value !== 'string') {
    return value;
  }
  return names.reduce(
    (text, name) => text.replace(new RegExp(`\\[${name}\\]`, 'g'), `{{${name}}}`),
    value,
  );
};

const rawJsonBody = (payload) => JSON.stringify(compact(payload));

const unwrapData = (response) => {  if (!isPlainObject(response.data)) {
    return null;
  }
  return response.data.data === undefined ? null : response.data.data;
};

const ID_KEYS = [
  'id',
  'message_id',
  'messageId',
  'otp_id',
  'broadcast_id',
  'device_id',
  'ref',
  'token',
];

const deriveId = (payload, fallback) => {
  if (isPlainObject(payload)) {
    for (const key of ID_KEYS) {
      const value = payload[key];
      if (typeof value === 'string' && value !== '') {
        return value;
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }
  }
  if (typeof payload === 'string' && payload !== '') {
    return payload;
  }
  return fallback;
};

const shapeCreateResult = (response) => {
  const envelope = isPlainObject(response.data) ? response.data : {};
  const payload = envelope.data;
  const result = {
    id: deriveId(payload, `${Date.now()}`),
    success: envelope.success !== false,
    message: typeof envelope.message === 'string' ? envelope.message : '',
  };

  if (isPlainObject(payload)) {
    Object.assign(result, payload, { id: result.id });
  } else if (payload !== undefined && payload !== null) {
    result.data = payload;
  }

  return result;
};

module.exports = {
  compact,
  deriveId,
  isPlainObject,
  normalizePlaceholders,
  parseJsonInput,
  rawJsonBody,
  shapeCreateResult,
  toBoolean,
  unwrapData,
};
