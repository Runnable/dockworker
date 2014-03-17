require('./lib/controllers/dockCleaner');
require('./lib/controllers/serviceCommands');
require('./lib/app');
require('./lib/server').listen(15000);
var childKiller = require('./lib/controllers/childKiller.js');
var debug = require('./lib/controllers/debugAdder.js');
debug.addForProcess(process, "main process");
process.on('SIGTERM', function() {
	childKiller(process.pid, function() {
		process.exit();
	});
});