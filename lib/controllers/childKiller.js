// anandp
// this module used to kill all process of a group
// 

function killChildrenOfProcess(pid, cb) {
  var exec = require('child_process').exec;
  exec("kill -- -$( ps opgid="+pid+" | tr -d ' ' )", cb);
}

module.exports = killChildrenOfProcess;