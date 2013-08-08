var ecstatic = require('ecstatic');
var server = require('./server');
var opts = { 
  root: __dirname + '/../client', 
  baseDir: 'static'
};
var staticHandler = ecstatic(opts)
server.on('request', handleStatic);

function handleStatic (req, res) {
  if (/static/.test(req.url)) {
    staticHandler(req, res);
  }
}