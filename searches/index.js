'use strict';

const findDeviceStatus = require('./find_device_status');
const findOtpReverseStatus = require('./find_otp_reverse_status');
const findMessageStatus = require('./find_message_status');
const findWabaConversations = require('./find_waba_conversations');

module.exports = {
  [findDeviceStatus.key]: findDeviceStatus,
  [findOtpReverseStatus.key]: findOtpReverseStatus,
  [findMessageStatus.key]: findMessageStatus,
  [findWabaConversations.key]: findWabaConversations,
};
