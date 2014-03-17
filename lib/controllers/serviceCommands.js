var spawn = require('child_process').spawn;
var fs = require('../shims/fs');
var createDomain = require('domain').create;
var children = [];
// Launch Services
var runnableServiceCommands = process.env.RUNNABLE_SERVICE_CMDS || '';
var debug = require('./debugAdder.js');

runnableServiceCommands.split(';').forEach(launchService);

function launchService(commandLine) {
  if (commandLine) {
    var domain = createDomain();
    domain.on('error', handleError);
    domain.bind(runCommand)(commandLine);
  }
}
function handleError(err) {
  console.error('runnableServiceCommands error');
  console.error(err.stack);
}
function runCommand(commandLine) {
  var commandArray = commandLine.trim().split(' ');
  var out = fs.openSync('/var/log/' + commandArray.join('_').replace(/\//g, '_') + '.log', 'a');
  var err = fs.openSync('/var/log/' + commandArray.join('_').replace(/\//g, '_') + '.log', 'a');
  var binary = commandArray.shift();
  var binaryArgs = commandArray;
  var proc = spawn(binary, binaryArgs, {
      detached: true,
      stdio: [
        'ignore',
        out,
        err
      ]
    });
  debug.addForChildProcess(proc, "proc");
  proc.unref();
  proc.on('exit', console.log.bind(console, 'Exited:', commandLine));
  proc.on('SIGTERM', console.log.bind(console, 'SIGTERM:', commandLine));
  children.push(proc);
}