var spawn = require('child_process').spawn;
var fs = require('fs');
var createDomain = require('domain').create;

// Launch Services
var runnableServiceCommands = process.env.RUNNABLE_SERVICE_CMDS || "";

runnableServiceCommands.split(';').forEach(function (commandLine) {
  if (commandLine) {
    var domain = createDomain();
    domain.on('error', function (err) {
      console.error('runnableServiceCommands error');
      console.error('commandLine: ' + commandLine);
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
    domain.run(function () {
      var commandArray = commandLine.trim().split(" ");
      var log = fs.createWriteStream("/var/log/" +
        commandArray.join("_").replace(/\//g, '_') +
        ".log", { flags: 'a' });
      domain.add(log);
      var binary = commandArray.shift();
      var binaryArgs = commandArray;
      var proc = spawn(binary, binaryArgs);
      domain.add(proc);
      proc.stdout.pipe(log);
      proc.stderr.pipe(log);
    });
  }
});