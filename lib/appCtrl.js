var fs = require('fs');
var spawn = require('child_process').spawn;
var express = require('express');
var webStreams = require('./webstreams');
var server = require('./server');
var createDomain = require('domain').create;

var app = express();

// Launch user App

var serviceSrcDir = process.env.RUNNABLE_USER_DIR || "/root";
var startCommandArray = (process.env.RUNNABLE_START_CMD || "date").split(" ");
var startCmd = startCommandArray.shift();
var startArgs = startCommandArray;

var applog = fs.createWriteStream("/var/log/app.log", { flags: 'a' });
applog.on('error', function (err) {
  console.error('applog error');
  console.error(err.stack);
});

var theApp = null;
var isAppRunning = false;

function startApp(cb) {
  var domain = createDomain();
  domain.on('error', function (err) {
    console.error('startApp error');
    console.error(err.stack);
    if (typeof cb === 'function') {
      cb(err);
      cb = null;
    }
    domain.members.forEach(function (stream) {
      if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
      if (typeof stream.kill === 'function') {
        stream.kill();
      }
    });
    isAppRunning = false;
  });
  domain.run(function () {
    theApp = spawn(startCmd, startArgs, {
      cwd: serviceSrcDir,
      env: process.env
    });
    domain.add(theApp);
    theApp.on('exit', function (code, signal) {
      setTimeout(function () {
        theApp = null;
      }, 10);
      isAppRunning = false;
    });
    theApp.stdout.pipe(applog, { end: false });
    theApp.stderr.pipe(applog, { end: false });
    cb();
    cb = null;
    isAppRunning = true;
  });

}

function stopApp(cb) {
  var domain = createDomain();
  domain.on('error', function (err) {
    console.error('stopApp error');
    console.error(err.stack);
    if (typeof cb === 'function') {
      cb(err);
      cb = null;
    }
    domain.members.forEach(function (stream) {
      if (typeof stream.destroy === 'function') {
        stream.destroy();
      }
      if (typeof stream.kill === 'function') {
        stream.kill();
      }
    });
    isAppRunning = false;
  });
  domain.run(function () {
    if (theApp) {
      domain.add(theApp);
      theApp.on('exit', function (code, signal) {
        setTimeout(function () {
          theApp = null;
        }, 10);
        cb();
        cb = null;
        isAppRunning = false;
      });
      theApp.kill();
    } else {
      cb();
      cb = null;
    }
  });
}

app.get('/api/start', function (req, res) {
  var domain = createDomain();
  domain.on('error', function (err) {
    console.error('api/start error');
    console.error(err.stack);
    res.json(500, { message: 'error starting application' });
  });
  domain.run(function () {
    if (isAppRunning) {
      res.json(409, { message: 'application already started' });
    } else {
      startApp(domain.intercept(function () {
        res.json(200, { message: 'application started successfully' });
      }));
    }
  });
});

app.get('/api/stop', function (req, res) {
  var domain = createDomain();
  domain.on('error', function (err) {
    console.error('api/stop error');
    console.error(err.stack);
    res.json(500, { message: 'error stopping application' });
  });
  domain.run(function () {
    if (!isAppRunning) {
      res.json(409, { message: 'application already stopped' });
    } else {
      stopApp(domain.intercept(function () {
        res.json(200, { message: 'application stopped successfully' });
      }));
    }
  });
});

app.get('/api/running', function (req, res) {
  res.json(200, { running: isAppRunning });
});

app.get('/api/connection', function (req, res) {
  res.json(200, webStreams.connectionInfo());
});

server.on('request', function (req, res) {
  if (/^\/api\//.test(req.url)) {
    app(req, res);
  }
});