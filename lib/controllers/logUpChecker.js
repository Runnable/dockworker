var ShoeClient = require('../ShoeClient');
var MuxDemux = require('mux-demux');
var command = require('../models/command');
var testCmd = "echo runnable test";
var debug = require('./debugAdder.js');

// check if log stream is responsive.
// send an echo test command to terminal stream and create timeout error if unreachable
function checkLogUp (cb) {
  var stream = new ShoeClient('ws://localhost:15000/streams/log');
  var muxDemux = new MuxDemux(onStream);
  debug.addForStream(stream, "logUpChecker stream");

  stream.pipe(muxDemux).pipe(stream);
  function onStream(stream) {
    if (stream.meta === 'terminal') {
      onTerminal(stream);
    }
  }
  function onTerminal(stream) {
    var timeout = setTimeout(timeoutError, 1000);
    var err;
    stream.on('data', function (data) {
      // grab output of echo command
      var output = data.split("\r\n")[0];
      if ((testCmd === output) && !err) {
        clearTimeout(timeout);
        cb();
      }
    });
    stream.write(testCmd+'\n');
    function timeoutError () {
      err = new Error('timeout');
      cb(err);
    }
  }
}

module.exports = checkLogUp;