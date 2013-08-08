build:
	@ ./node_modules/.bin/browserify ./client/term.js -d -o ./client/termBundle.js;
	@ ./node_modules/.bin/browserify ./client/log.js -d -o ./client/logBundle.js;
install:
	@npm install
npminstall:
	@docker -H 127.0.0.1:6000 run -b /home/vagrant/harbourmaster/node_modules/dockworker/:/dockworker runnable/base /bin/bash -c "cd dockworker && npm install"

.PHONY: install
.PHONY: build
.PHONY: npminstall
