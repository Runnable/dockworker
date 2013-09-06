mocha.setup({globals: ['start', 'term', 'pty']});
var hyperquest = require('hyperquest');
var concat = require('concat-stream');

describe('terminal', function (){
  it('should define start', function (){
    if (typeof window.start !== 'function') {
      throw new Error('start not defined');
    }
  });

  it('should start cleanly', function (){
    window.start('http://localhost:15000/streams/terminal');
  });

  it('should define term', function (done) {
    setTimeout(function () {
      if (window.term == null) {
        throw new Error('term not defined');
      } else {
        done();
      }
    }, 200);
  });

  it('should define pty', function (done) {
    setTimeout(function () {
      if (window.pty == null) {
        throw new Error('pty not defined');
      } else {
        done();
      }
    }, 200);
  });

  it('should echo some data', function (done) {
    pty.once('data', function (data) {
      if (!/echo foo\\r?\\nfoo/.test(JSON.stringify(data))) {
        console.error('BAD DATA',JSON.stringify(data));
        done(new Error('y u no foo'));
      }
      done();
    });
    pty.write('echo foo\n');
  });

  it('should be connected', function (done) {
    hyperquest
      .get({uri: 'http://localhost:15000/api/connection'})
      .pipe(concat(function (raw) {
        var data = JSON.parse(raw);
        if (data.connectionCount === 0) {
          done(new Error('not enough connections: ' + data.connectionCount));
        } else {
          done();
        }
      }));
  });
});