var spawn = require('child_process').spawn;
var shoe = require('shoe');
var pty = require('pty.js');
var dnode = require('dnode');
var MuxDemux = require('mux-demux');
var connectionCount = 0;
var lastConnect = Date.now();
var server = require('./server');
var createDomain = require('domain').create;

var serviceSrcDir = process.env.RUNNABLE_USER_DIR || "/root";

function disconnected () {
  connectionCount--;
  if (connectionCount === 0) {
    lastConnect = Date.now();
  }
}

function termHandler (remote) {
  var domain = createDomain();
  domain.add(remote);
  domain.on('error', termError);
  domain.run(connect.bind(null, 'bash', [], remote));
}

function connect (command, args, remote) {
  connectionCount++;
  var mx = MuxDemux();
  var ts = mx.createStream('pty');
  var ds = mx.createStream('dnode');

  var term = pty.spawn(command, args, {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: serviceSrcDir,
    env: process.env
  });
  term.pipe(ts).pipe(term);

  var d = dnode({
    resize: function (x, y) {
      term.resize(x, y);
    }
  });
  d.pipe(ds).pipe(d);

  remote.pipe(mx).pipe(remote);
  remote._destroy = remote.destroy;
  remote.destroy = function () {
    disconnected();
    remote._destroy();
  }
}

function termError (err) {
  console.error('termsock error');
  console.error(err.stack);
  domain.members.forEach(cleanup);
}

function cleanup (stream) {
  if (typeof stream.destroy === 'function') {
    stream.destroy();
  }
  if (typeof stream.kill === 'function') {
    stream.kill();
  }
}

shoe(termHandler).install(server, '/terminal');

function logHandler (remote) {
  var domain = createDomain();
  domain.add(remote);
  domain.on('error', logError);
  connectionCount++;
  domain.run(connect.bind(null, 'tail', ['-f', '/var/log/app.log'], remote));
}

function logError (err) {
  console.error('logsock error');
  console.error(err.stack);
  domain.members.forEach(cleanup);
}

shoe(logHandler).install(server, '/log');

function connectionInfo () {
  return {
    connectionCount: connectionCount,
    lastConnect: lastConnect
  };
}

module.exports.connectionInfo = connectionInfo;