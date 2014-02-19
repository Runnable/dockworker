var shoe = require('shoe');
var server = require('../server');
var createDomain = require('domain').create;
var connector = require('../controllers/connector');

function termHandler(remote) {
  var domain = createDomain();
  domain.add(remote);
  domain.on('error', termError.bind({ domain: domain }));
  domain.run(connector.bind(null, 'bash', [], remote));
}
function termError(err) {
  console.error('termsock error');
  console.error(err.stack);
  this.domain.members.forEach(cleanup);
}
function cleanup(stream) {
  if (typeof stream.destroy === 'function') {
    stream.destroy();
  }
  if (typeof stream.kill === 'function') {
    stream.kill();
  }
}

var termSock = shoe(termHandler);
termSock.install(server, '/streams/terminal');