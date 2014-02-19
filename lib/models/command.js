var build = require('./build');
var startCommand = process.env.RUNNABLE_START_CMD || 'date && sleep 1000';
var buildCommand = process.env.RUNNABLE_BUILD_CMD || '';

function getStartCommand () {
  return startCommand;
}

function getBuildCommand () {
  return buildCommand;
}

function setStartCommand (command) {
  startCommand = command;
}

function setBuildCommand (command) {
  buildCommand = command;
}

module.exports = {
  getStartCommand: getStartCommand,
  getBuildCommand: getBuildCommand,
  setStartCommand: setStartCommand,
  setBuildCommand: setBuildCommand
};