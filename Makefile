build:
	@ ./node_modules/.bin/browserify ./lib/client.js -d -o ./public/bundle.js;
install:
	@npm install
npminstall:
	@docker -H 127.0.0.1:6000 run -v /home/vagrant/harbourmaster/node_modules/dockworker/:/dockworker runnable/node /bin/bash -c "cd dockworker && npm install"

.PHONY: install
.PHONY: build
.PHONY: npminstall
