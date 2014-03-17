// anandp
// this module used to kill all process of a group
// 
var debug = require('./debugAdder.js');

function killChildrenOfProcess(pid, cb) {
  var exec = require('child_process').exec;
  var child = exec("kill -- -$( ps opgid="+pid+" | tr -d ' ' )", cb);
  debug.addForChildProcess(child, "child killer");
}

module.exports = killChildrenOfProcess;