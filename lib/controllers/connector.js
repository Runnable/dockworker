var emitStream = require('emit-stream');
var JSONStream = require('JSONStream');
var processStopper = require('../models/processStopper');
var serviceSrcDir = process.env.RUNNABLE_USER_DIR || '/root';
var pty = require('pty.js');
var MuxDemux = require('mux-demux');
var tail = require('./fileTail.js');
var terminalLogDir = process.env.RUNNABLE_TERMLOG_DIR || '/.terminalLog';
var fs = require('fs');
var childKiller = require('./childKiller.js');
var debug = require('./debugAdder.js');

function connect(command, args, remote) {
  var muxDemux, terminalStream, clientEventsStream, clientEvents,
    terminal, terminalLogStream, cols = 80, rows = 30;
  setupStreams();
  setupCleanup();

  function setupStreams () {
    muxDemux = new MuxDemux();
    clientEventsStream = muxDemux.createStream('clientEvents');
    terminalStream = muxDemux.createStream('terminal');
    terminalLogStream = muxDemux.createStream('terminalLog');
    // This var takes bash commands and saves them to a file
    process.env.PROMPT_COMMAND = 'history | cut -c 8- > ' + terminalLogDir;
    terminal = pty.spawn(command, args, {
      name: 'xterm-color',
      cols: cols,
      rows: rows,
      cwd: serviceSrcDir,
      env: process.env
    });

    debug.addForStream(terminal, "terminal");
    debug.addForStream(terminalStream, "terminalStream");
    debug.addForStream(remote, "remote");
    debug.addForStream(terminalLogStream, "terminalLog");
    debug.addForStream(clientEventsStream, "clientEventsStream");

    terminal.pipe(terminalStream).pipe(terminal);
    terminal.on('end', function() {
        muxDemux.end();
        childKiller(terminal.pid);
      });
    clientEvents = emitStream
      .fromStream(clientEventsStream
        .pipe(JSONStream.parse([true])));
    clientEvents.on('resize', function (x, y) {
      terminal.resize(x, y);
    });
    clientEvents.on('ping', function () {
      processStopper.startTimeout();
    });
    clientEvents.on('enableLog', function () {
      tail.enable();
    });
    debug.addForStream(clientEvents, "clientEvents");

    remote.pipe(muxDemux).pipe(remote);
    // create and tail -f terminal command log file
    tail.begin(terminalLogDir, terminalLogStream, terminal.pid);
  }

  function setupCleanup () {
    var orginalDestroy = remote.destroy;
    remote.destroy = disconnect;
    function disconnect() {
      if (tail) {
        tail.stop();
      }
      remote.destroy = orginalDestroy;
      if (terminalStream) {
        terminalStream.destroy();
      }
      clientEventsStream.destroy();
      muxDemux.destroy();
      if (terminal) {
        terminal.kill();
      }
      remote.destroy();
    }
  }
}

module.exports = connect;
