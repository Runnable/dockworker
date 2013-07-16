var Terminal = require('tty.js/static/term');
var shoe = require('shoe');


window.start = function () {
  onConnect(shoe('http://localhost:15000/log'));
};

function onConnect (stream) {
  var term = new Terminal(80, 24, function (data) {});
  window.term = term;
  term.open();
  stream.on('data', function (data) {
    term.write(data.replace(/\r?\n/g, '\r\n'));
  });
  term.end = function () {
    console.log('END');
  };

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
  }
  window.onresize = function (event) {
    resize();
  }
}