var express = require('express');
var middleware = require('../middleware');
var command = require('../models/command');
var webUpChecker = require('../controllers/webUpChecker');
var termUpChecker = require('../controllers/termUpChecker');
var logUpChecker = require('../controllers/logUpChecker');
var build = require('../models/build');
var exec = require('child_process').exec;
var app = module.exports = express();
var childKiller = require('../controllers/childKiller.js');

// Check if web ports are up.
app.get('/checkWebUp', function (req, res) {
  webUpChecker(req.domain.intercept(function () {
    res.send(200);
  }));
});

// Get service token
app.get('/servicesToken', function (req, res) {
  res.send(process.env.SERVICES_TOKEN);
});

// return process enviorment var's
app.get('/envs', function (req, res) {
  res.json(200, process.env);
});

// add env var to process and sets dirty bit to true.
app.post('/envs', middleware.json, function (req, res) {
  build.dirty = true;
  Object.keys(req.body).forEach(function (key) {
    if (key === 'RUNNABLE_START_CMD') {
      command.setStartCommand(req.body.RUNNABLE_START_CMD);
    }
    if (key === 'RUNNABLE_BUILD_CMD') {
      command.setBuildCommand(req.body.RUNNABLE_BUILD_CMD);
    }
    process.env[key] = req.body[key];
  });
  res.send(204);
});

// returns start command
app.get('/cmd', function (req, res) {
  res.json(200, command.getStartCommand());
});

// change start command
app.post('/cmd', middleware.json, function (req, res) {
  command.setStartCommand(req.body);
  res.send(204);
});

// returns build command
app.get('/buildCmd', function (req, res) {
  res.json(200, command.getBuildCommand());
});

// change build command and sets dirty to true
app.post('/buildCmd', middleware.json, function (req, res) {
  build.dirty = true;
  command.setBuildCommand(req.body);
  res.send(204);
});

// returns dirty status
app.get('/clean', function (req, res) {
  res.json(build.dirty);
});

// sets dirty bit to false
app.post('/clean', function (req, res) {
  build.dirty = false;
  res.send(204);
});

// executes run command passed into query
// ex: GET api/runcommand?command=date
// will run "date" command
app.get('/runcommand', function (req, res) {
  exec(req.query.command, function (err, stdout, stderr) {
    if (err) {
      console.log('ERR', err, req.query.command);
      res.send(500, err.message);
    } else if (stderr) {
      res.send(400, stderr);
    } else {
      res.send(200, stdout);
    }
  });
});

// check if terminal is up
app.get('/checkTermUp', function (req, res) {
  termUpChecker(req.domain.intercept(function (err) {
      res.send(200);
    }));
});

// check if logs are up
app.get('/checkLogUp', function (req, res) {
  logUpChecker(req.domain.intercept(function (err) {
      res.send(200);
    }));
});

// kill all children of this process
app.get('/processPurge', function (req, res) {
  childKiller(process.pid);
  res.send(200);
});