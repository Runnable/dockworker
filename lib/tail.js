var Writable = require('stream').Writable;

var tail = module.exports = new Writable();

tail.buffer = [];

tail._write = function (chunk, enc, next) {
  var data = chunk.toString().replace(/([^\r])\n/g, '$1\r\n');
  tail.buffer.push(data);
  if (tail.buffer.length > 100) {
    tail.buffer.unshift();
  }
  tail.emit('data', data);
  next();
}