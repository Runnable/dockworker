require('./lib/cleanup');
require('./lib/launchServices');
require('./lib/webStreams');
require('./lib/app');
require('./lib/server').listen(15000);

process.on('SIGTERM', process.exit);