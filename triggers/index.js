'use strict';

const newMessage = require('./new_message');
const messageStatus = require('./message_status');
const newWabaMessage = require('./new_waba_message');

module.exports = {
  [newMessage.key]: newMessage,
  [messageStatus.key]: messageStatus,
  [newWabaMessage.key]: newWabaMessage,
};
