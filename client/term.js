var shoe = require('shoe');
var dnode = require('dnode');
var MuxDemux = require('mux-demux');
var Terminal = require('tty.js/static/term');
var remoteResize;

window.start = function () {
  var stream = shoe('http://localhost:15000/terminal');
  stream.pipe(MuxDemux(function (stream) {
    if (stream.meta === 'pty') {
      onPty(stream);
    }
    if (stream.meta === 'dnode') {
      onDnode(stream);
    }
  })).pipe(stream);
};

function onPty (stream) {
  var term = new Terminal(80, 30, function (data) {
    stream.write(data);
  });
  term.open();
  stream.pipe(term);
  term.end = term.destroy;

  var interval = setInterval(resize,500);
  setTimeout(function () {
    clearInterval(interval);
  }, 2000);
  
  function resize () {
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
  window.onresize = function (event) {
    resize();
  }
}

function onDnode (stream) {
  var d = dnode();
  d.on('remote', function (remote) {
    remoteResize = function (x, y) {
      remote.resize(x, y);
    }
  });
  stream.pipe(d).pipe(stream);
}