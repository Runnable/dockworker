require('./lib/controllers/dockCleaner');
require('./lib/controllers/serviceCommands');
require('./lib/app');
require('./lib/server').listen(15000);
var childKiller = require('./lib/controllers/childKiller.js');

process.on('SIGTERM', function() {
	childKiller(process.pid, function() {
		process.exit();
	});
});