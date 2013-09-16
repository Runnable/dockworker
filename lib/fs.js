if (process.env.NODE_ENV === 'testing') {
  var Fs = require('fake-fs');
  var fs = new Fs();
  fs.mkdirSync('/var');
  fs.mkdirSync('/var/log');
  fs.writeFileSync('/var/log/app.log', 'LOG');
  fs.mkdirSync('/tmp');
  fs.openSync = function () {
  	return 'ignore';
  }
  module.exports = fs;
} else {
  module.exports = require('fs');
}