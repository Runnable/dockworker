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

var termsock = shoe(function (remote) {
  var domain = createDomain();
  domain.add(remote);
  domain.on('error', function (err) {
    console.error('termsock error');
    console.error(err.stack);
    domain.members.forEach(function (stream) {
      stream.destroy && stream.destroy();
    });
  });
  domain.run(function () {
    connectionCount++;
    var mx = MuxDemux();
    domain.add(mx);
    var ts = mx.createStream('pty');
    domain.add(ts);
    var ds = mx.createStream('dnode');
    domain.add(ds);

    var term = pty.spawn('bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: serviceSrcDir,
      env: process.env
    });
    domain.add(term);
    term.pipe(ts).pipe(term);

    var d = dnode({
      resize: function (x, y) {
        term.resize(x, y);
      }
    });
    domain.add(d);
    d.pipe(ds).pipe(d);

    remote.pipe(mx).pipe(remote);
    remote._destroy = remote.destroy;
    remote.destroy = function () {
      disconnected();
      remote._destroy();
    }
  });

});

termsock.install(server, '/terminal');

var logsock = shoe(function (remote) {
  var domain = createDomain();
  domain.add(remote);
  domain.on('error', function (err) {
    console.error('logsock error');
    console.error(err.stack);
    domain.members.forEach(function (stream) {
      if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
      if (typeof stream.kill === 'function') {
        stream.kill();
      }
    });
  });
  connectionCount++;
  domain.run(function () {
    var tail = spawn('tail', ['-f', '/var/log/app.log']);
    domain.add(tail);
    tail.stdout.pipe(remote, { end: false });
    remote._destroy = remote.destroy;
    remote.destroy = function () {
      disconnected();
      remote._destroy();
    }
  });
});

logsock.install(server, '/log');

server.listen(15000);

module.exports.connectionInfo = function () {
  return {
    connectionCount: connectionCount,
    lastConnect: lastConnect
  };
};