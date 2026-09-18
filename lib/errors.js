'use strict';

const { isPlainObject } = require('./util');

const STATUS_FALLBACKS = {
  400: ['Kirimi rejected the request. Check the values mapped into this step.', 'InvalidRequest'],
  401: ['Kirimi rejected your credentials. Reconnect the app with a valid User Code and Secret.', 'AuthenticationFailed'],
  402: ['Your Kirimi balance is not enough for this request. Top up your balance and try again.', 'InsufficientBalance'],
  403: ['Your Kirimi package does not include this feature, or the subscription is inactive.', 'FeatureNotAvailable'],
  404: ['Kirimi could not find the resource you asked for.', 'NotFound'],
  502: ['Kirimi could not deliver to that phone number.', 'UndeliverableNumber'],
};

const handleKirimiError = (response, z) => {
  const envelope = isPlainObject(response.data) ? response.data : null;
  const apiMessage =
    envelope && typeof envelope.message === 'string' && envelope.message !== ''
      ? envelope.message
      : null;

  if (response.status === 429) {
    const retryAfter = Number(response.getHeader('retry-after'));
    throw new z.errors.ThrottledError(
      apiMessage || 'Kirimi rate limited this request.',
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60,
    );
  }

  if (response.status >= 400) {
    const fallback = STATUS_FALLBACKS[response.status];
    if (!fallback) {
      return response;
    }
    const [message, code] = fallback;
    throw new z.errors.Error(apiMessage || message, code, response.status);
  }

  if (envelope && envelope.success === false) {
    response.skipThrowForStatus = true;
    throw new z.errors.Error(
      apiMessage || 'Kirimi reported that the request failed.',
      'KirimiApiError',
      response.status,
    );
  }

  return response;
};

module.exports = { handleKirimiError };
