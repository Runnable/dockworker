var fs = require('fs');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

var serviceSrcDir = process.env.RUNNABLE_USER_DIR || "/root";
var startCommandArray = (process.env.RUNNABLE_START_CMD || "date").split(" ");
var startCmd = startCommandArray.shift();
var startArgs = startCommandArray;

var out = fs.openSync("/var/log/app.log", 'a' );
var err = fs.openSync("/var/log/app.log", 'a' );

var options = {
  cwd: serviceSrcDir,
  detached: true,
  stdio: [ 'ignore', out, err ],
  env: process.env
};

var app = module.exports = {
  start: restart,
  restart: restart,
  stop: stop,
  child: null
};

function noop () {}

function restart (cb) {
  stop(start);
  function start (err) {
    if (err) {
      cb(err);
    }
    app.child = spawn(startCmd, startArgs, options);
    app.child.unref();
    app.child.on('error', onError);
    app.child.once('exit', onExit);
    cb();
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
  app.child.once('exit', cb);
  app.child.kill();
}

  

