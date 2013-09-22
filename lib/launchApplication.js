var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var tail = require('./tail');
var portscanner = require('portscanner')

var serviceSrcDir = process.env.RUNNABLE_USER_DIR || "/root";
var startCommandArray = (process.env.RUNNABLE_START_CMD || "date").split(" ");
var startCmd = startCommandArray.shift();
var startArgs = startCommandArray;

var options = {
  cwd: serviceSrcDir,
  detached: true,
  env: process.env
};

var app = module.exports = {
  start: restart,
  restart: restart,
  stop: stop,
  child: null,
  checkWebUp: checkWebUp
};

function noop () {}

function restart (cb) {
  stop(start);
  function start (err) {
    if (err) {
      cb(err);
    } else {
      app.child = spawn(startCmd, startArgs, options);
      app.child.unref();
      app.child.on('error', onError);
      app.child.once('exit', onExit);
      app.child.stdout.pipe(tail, {end: false});
      app.child.stderr.pipe(tail, {end: false});
      cb();
    }
  }
}

function onError (err) {
  console.error('child error', err);
  stop(noop);
}

function onExit () {
  app.child = null;
}

function stop (cb) {
  if (!app.child) {
    return process.nextTick(cb);
  }
  app.child.once('exit', wait);
  process.kill(-app.child.pid);
  function wait () {
    setTimeout(cb, 10);
  }
}

function checkWebUp (cb) {
  var timedout = false;
  var webTimeout = setTimeout(function webTimedout () {
    timedout = true;
    cb(new Error('timed out'));
  }, 5000);
  (function checkListening () {
    portscanner.checkPortStatus(process.env.WEB_PORT || 80, 'localhost', checkStatus);
    function checkStatus (err, status) {
      if (timedout) {
        console.error('timed out');
      } else if (err) {
        clearTimeout(webTimeout);
        cb(err);
      } else if (status === 'closed') {
        setTimeout(checkListening, 50);
      } else {
        clearTimeout(webTimeout);
        cb();
      }
    }
  })();
}