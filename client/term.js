var shoe = require('shoe');
var dnode = require('dnode');
var MuxDemux = require('mux-demux');
var Terminal = require('tty.js/static/term');
var remoteResize;
var minDelay = 500;
var delay = minDelay;
var increment = 500;
var maxDelay = 60 * 1000;

window.start = createStream;

function createStream () {
  var stream = shoe('/terminal');
  var muxDemux = MuxDemux(onStream);
  stream.on('error', console.error.bind(console));
  stream.on('end', onEnd);
  stream.pipe(muxDemux).pipe(stream);
}

function onStream (stream) {
  if (stream.meta === 'pty') {
    onPty(stream);
  }
  if (stream.meta === 'dnode') {
    onDnode(stream);
  }
}

function onPty (stream) {
  var term = new Terminal(80, 30, stream.write.bind(stream));
  term.open();
  stream.on('end', document.removeChild.bind(document.body, term.element));
  stream.pipe(term);
  term.end = term.destroy;
  var resizeTerm = resize.bind(null, term);
  resizeTerm();
  setTimeout(resizeTerm, 1000);
  window.onresize = resizeTerm;
}

function resize (term) {
  x = document.body.clientWidth / term.element.offsetWidth;
  y = document.body.clientHeight / term.element.offsetHeight;
  x = (x * term.cols) | 0;
  y = (y * term.rows) | 0;
  x -= 1;
  y -= 2;
  term.resize(x, y);
  if (typeof remoteResize === 'function') {
    remoteResize(x, y);
  }
}

function onDnode (stream) {
  var d = dnode();
  d.on('remote', onRemote);
  stream.pipe(d).pipe(stream);
}

function onRemote (remote) {
  remoteResize = remote.resize.bind(remote);
}

function onEnd () {
  setTimeout(createStream, delay);
  if (delay < maxDelay) {
    delay += increment;
  }
}