var http = require('http');
var debug = require('./controllers/debugAdder.js');

var serv = http.createServer();
debug.addForHttp(serv);

module.exports = serv;