'use strict';

const sendMessage = require('./send_message');
const sendMessageFast = require('./send_message_fast');
const broadcastMessage = require('./broadcast_message');
const sendWabaTemplate = require('./send_waba_template');
const replyWabaMessage = require('./reply_waba_message');
const sendOtp = require('./send_otp');
const verifyOtp = require('./verify_otp');
const saveContact = require('./save_contact');
const sendMessageFile = require('./send_message_file');
const saveContactsBulk = require('./save_contacts_bulk');
const createOtpReverse = require('./create_otp_reverse');
const syncWabaTemplates = require('./sync_waba_templates');
const sendWabaOtp = require('./send_waba_otp');
const verifyWabaOtp = require('./verify_waba_otp');

module.exports = {
  [sendMessage.key]: sendMessage,
  [sendMessageFast.key]: sendMessageFast,
  [broadcastMessage.key]: broadcastMessage,
  [sendWabaTemplate.key]: sendWabaTemplate,
  [replyWabaMessage.key]: replyWabaMessage,
  [sendOtp.key]: sendOtp,
  [verifyOtp.key]: verifyOtp,
  [saveContact.key]: saveContact,
  [sendMessageFile.key]: sendMessageFile,
  [saveContactsBulk.key]: saveContactsBulk,
  [createOtpReverse.key]: createOtpReverse,
  [syncWabaTemplates.key]: syncWabaTemplates,
  [sendWabaOtp.key]: sendWabaOtp,
  [verifyWabaOtp.key]: verifyWabaOtp,
};
