var spawn = require('child_process').spawn;
var fs = require('./fs');
var createDomain = require('domain').create;
var children  = [];

// Launch Services
var runnableServiceCommands = process.env.RUNNABLE_SERVICE_CMDS || "";

runnableServiceCommands.split(';').forEach(launchService);

function launchService (commandLine) {
  if (commandLine) {
    var domain = createDomain();
    domain.on('error', handleError);
    domain.bind(runCommand)(commandLine);
  }
}

function handleError (err) {
  console.error('runnableServiceCommands error');
  // console.error('commandLine: ' + commandLine);
  console.error(err.stack);
  // domain.members.forEach(cleanup);
}

function cleanup (stream) {
  if (typeof stream.destroy === 'function') {
    stream.destroy();
  }
  if (typeof stream.kill === 'function') {
    stream.kill();
  }
}

function runCommand (commandLine) {
  var commandArray = commandLine.trim().split(" ");
  var out = fs.openSync("/var/log/" +
    commandArray.join("_").replace(/\//g, '_') +
    ".log", 'a' );
  var err = fs.openSync("/var/log/" +
    commandArray.join("_").replace(/\//g, '_') +
    ".log", 'a' );
  var binary = commandArray.shift();
  var binaryArgs = commandArray;
  var proc = spawn(binary, binaryArgs, {detached: true, stdio: [ 'ignore', out, err ]});
  proc.unref();
  proc.on("exit", console.log.bind(console, "Exited:", commandLine));
  proc.on("SIGTERM", console.log.bind(console, "SIGTERM:", commandLine));
  children.push(proc);
}