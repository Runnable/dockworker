// anandp
// this module used to track a file for changes
// It creates a file and then starts the tailing
// will terminate after process pid dies
// file =  path to file to track
// 
var spawn = require('child_process').spawn;
var tail = spawn('bash');
var isStarted = false;

function fileTail(file, stream, pid) {
  tail.stdin.write('echo "" > ' + file + ' \n');
  tail.stdin.write('tail --pid=' + pid + ' -f ' + file + ' \n');

  tail.stdout.on('data', function (data) {
    // ignore first lines since this will be init commands
    if (isStarted) {
      stream.write(data.toString());
    } else {
      isStarted = true;
    }
  });
}

// kill tail process on exit
function stop() {
  process.kill(tail);
}

module.exports.begin = fileTail;
module.exports.stop = stop;
