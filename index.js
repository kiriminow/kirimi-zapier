'use strict';

const authentication = require('./authentication');
const creates = require('./creates');
const searches = require('./searches');
const triggers = require('./triggers');
const { handleKirimiError } = require('./lib/errors');

const App = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,
  flags: {
    cleanInputData: false,
  },
  authentication,
  requestTemplate: {
    body: {
      user_code: '{{bundle.authData.user_code}}',
      secret: '{{bundle.authData.secret}}',
    },
  },
  afterResponse: [handleKirimiError],
  triggers,
  creates,
  searches,
};

module.exports = App;
