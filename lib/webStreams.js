var spawn = require('child_process').spawn;
var shoe = require('shoe');
var pty = require('pty.js');
var dnode = require('dnode');
var MuxDemux = require('mux-demux');
var touch = require('touch');
var request = require('request');
var server = require('./server');
var createDomain = require('domain').create;
var tail = require('./tail');
var from = require('from');

var connectionCount = 0;
var serviceSrcDir = process.env.RUNNABLE_USER_DIR || "/root";
var deathTimer = setTimeout(doom, 1000 * 30);

function doom () {
  console.log('DOOM TIME', process.env.STOP_URL);

  if (process.env.STOP_URL) {
    request.post(process.env.STOP_URL, function (err, res, body) {
      if (err) {
        setTimeout(doom, 1000 * 5);
        console.error(err);
      } else {
        console.log('STOPPED');
      }
    });
  } else {
    console.error('NO STOP URL');
    process.exit(0);
  }
}

function connected () {
  connectionCount++;
  console.log('connected', connectionCount);
  clearTimeout(deathTimer);
}

function disconnected () {
  connectionCount--;
  console.log('disconnected', connectionCount);
  if (connectionCount === 0) {
    deathTimer = setTimeout(doom, 1000 * 5);
  }
}

function termHandler (remote) {
  var domain = createDomain();
  domain.add(remote);
  domain.on('error', termError.bind({
    domain: domain
  }));
  domain.run(connect.bind(null, 'bash', [], remote));
}

function connect (command, args, remote) {
  connected();
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
    resize: resize.bind({
      term: term
    })
  });
  d.pipe(ds).pipe(d);

  remote.pipe(mx).pipe(remote);

  // cleanup
  var destroy = remote.destroy;
  remote.destroy = disconnect;
  function disconnect () {
    disconnected();
    ts.destroy();
    ds.destroy();
    d.destroy();
    mx.destroy();
    term.kill();
    destroy.apply(remote, arguments);
    remote.destroy = destroy;
  }
}

function resize (x, y) {
  this.term.resize(x, y);
}

function termError (err) {
  console.error('termsock error');
  console.error(err.stack);
  this.domain.members.forEach(cleanup);
}

function cleanup (stream) {
  if (typeof stream.destroy === 'function') {
    stream.destroy();
  }
  if (typeof stream.kill === 'function') {
    stream.kill();
  }
}

// both for smooth transition
var termSock = shoe(termHandler);
termSock.install(server, '/streams/terminal');
termSock.on('log', console.log.bind(console, 'term'));

function logHandler (remote) {
  var domain = createDomain();
  domain.add(remote);
  domain.on('error', logError.bind({
    domain: domain
  }));
  domain.run(follow);
  function follow () {
    connected();
    var mx = MuxDemux();
    var ts = mx.createStream('pty');
    var fs = from(function getChunk (count, next) {
      if (tail.buffer.length > count) {
        fs.emit('data', tail.buffer[count]);
        next();
      } else {
        tail.once('data', function onTail (data) {
          fs.emit('data', data);
          next();
        });
      }
    });
    fs.pipe(ts);
    mx.pipe(remote);
    // cleanup
    var destroy = remote.destroy;
    remote.destroy = disconnect;
    function disconnect () {
      disconnected();
      ts.destroy();
      mx.destroy();
      fs.destroy();
      destroy.apply(remote, arguments);
      remote.destroy = destroy;
    }
  }
}

function logError (err) {
  console.error('logsock error');
  console.error(err.stack);
  this.domain.members.forEach(cleanup);
}

var logSock = shoe(logHandler);
logSock.install(server, '/streams/log');
logSock.on('log', console.log.bind(console, 'log'));
