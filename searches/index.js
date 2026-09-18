'use strict';

const findDeviceStatus = require('./find_device_status');
const findOtpReverseStatus = require('./find_otp_reverse_status');

module.exports = {
  [findDeviceStatus.key]: findDeviceStatus,
  [findOtpReverseStatus.key]: findOtpReverseStatus,
};
