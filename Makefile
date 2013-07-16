build:
	@ ./node_modules/.bin/browserify ./client/term.js -d -o ./client/termBundle.js;
	@ ./node_modules/.bin/browserify ./client/log.js -o ./client/logBundle.js;
install:
	@npm install

.PHONY: install
.PHONY: build