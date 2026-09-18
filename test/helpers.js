'use strict';

const nock = require('nock');
const { BASE_URL } = require('../lib/constants');

const AUTH = { user_code: 'U-TEST', secret: 'S-TEST' };

const DEFAULT_ENVELOPE = {
  success: true,
  data: { message_id: 'MID-1' },
  message: 'OK',
};

const intercept = (path, envelope = DEFAULT_ENVELOPE, status = 200) => {
  const captured = [];

  nock(BASE_URL)
    .post(path, (body) => {
      captured.push(body);
      return true;
    })
    .reply(status, envelope);

  return captured;
};

const lastBody = (captured) => {
  if (captured.length === 0) {
    throw new Error('No request was captured.');
  }
  return captured[captured.length - 1];
};

const messageOf = (error) => {
  try {
    const parsed = JSON.parse(error.message);
    return typeof parsed.message === 'string' ? parsed.message : error.message;
  } catch (parseError) {
    return error.message;
  }
};

module.exports = { AUTH, DEFAULT_ENVELOPE, intercept, lastBody, messageOf };
