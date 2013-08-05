var fs = require('fs');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var express = require('express');
var webStreams = require('./webStreams');
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

var theApp = {
  cmd: startCmd,
  args: startArgs,
  options: {
    cwd: serviceSrcDir,
    detached: true,
    env: process.env
  },
  log: applog,
  child: null,
  start: function (cb) {
    this.restart.apply(this, arguments);
  },
  restart: function (cb) {
    this.stop(function (err) {
      if (err) {
        return cb(err);
      }
      var child = spawn(this.cmd, this.args, this.options);
      child.stdout.pipe(applog, { end: false });
      child.stderr.pipe(applog, { end: false });
      this.child = child;

      child.on('exit', function () {
        this.child = null;
      }.bind(this));

      if (cb) {
        cb();
      }
    }.bind(this));
  },
  stop: function (cb) {
    var child = this.child;
    if (!child) {
      if (cb) {
        process.nextTick(cb);
      }
      return;
    }

    exec('/bin/kill -TERM -- -' + child.pid, function (err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
      this.child = null;
    }.bind(this));
  }
};

app.get('/api/start', function (req, res) {
  var domain = createDomain();
  domain.on('error', function (err) {
    console.error('api/start error');
    console.error(err.stack);
    res.json(500, { message: 'error starting application' });
  });
  domain.run(function () {
    theApp.start(domain.intercept(function () {
      res.json(200, { message: 'application started successfully' });
    }));
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
    theApp.stop(domain.intercept(function () {
      res.json(200, { message: 'application stopped successfully' });
    }));
  });
});

app.get('/api/restart', function (req, res) {
  var domain = createDomain();
  domain.on('error', function (err) {
    console.error('api/start error');
    console.error(err.stack);
    res.json(500, { message: 'error restarting application' });
  });
  domain.run(function () {
    theApp.restart(domain.intercept(function () {
      res.json(200, { message: 'application restarted successfully' });
    }));
  });
});

app.get('/api/running', function (req, res) {
  res.json(200, { running: !!theApp.child});
});

app.get('/api/connection', function (req, res) {
  res.json(200, webStreams.connectionInfo());
});

app.get('/api/envs', function (req, res) {
  res.json(200, process.env);
});

app.post('/api/envs', function (req, res) {
  req.pipe(concat(function (body) {
    try {
      var body = JSON.parse(body);
      if (typeof body.key === 'string' && body.key.length) {
        if (typof body.value === 'string') {
          process.env[body.key] = body.value;
          res.send(204);
        } else {
          delete process.env[body.key];
          res.send(204);
        }
      } else {
        res.send(406, 'bad key');
      }
    } catch (err) {
      console.error(err);
      res.send(500, err.message);
    }
  }));
});

server.on('request', function (req, res) {
  if (/^\/api\//.test(req.url)) {
    app(req, res);
  }
});