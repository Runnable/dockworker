var ShoeClient = require('../ShoeClient');
var MuxDemux = require('mux-demux');
var command = require('../models/command');
var testPhrase = "runnable test"

// check if terminal is responsive.
// send an echo test command to terminal stream and create timeout error if unreachable
function checkTermUp (cb) {
  var stream = new ShoeClient('ws://localhost:15000/streams/terminal');
  var muxDemux = new MuxDemux(onStream);
  var startCmd = command.getStartCommand();
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
      var output = data.split("\r\n")[1];
      if ((testPhrase === output) && !err) {
        clearTimeout(timeout);
        cb();
      }
    });
    stream.write('echo '+testPhrase+'\n');
    function timeoutError () {
      err = new Error('timeout');
      cb(err);
    }
  }
}

module.exports = checkTermUp;