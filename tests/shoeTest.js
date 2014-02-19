var ShoeClient = require('../lib/ShoeClient');
var MuxDemux = require('mux-demux');
var request = require('request');

describe('Streams', function () {
  describe('terminal', function () {
    it('should run echo', function (done) {
      var stream = new ShoeClient('ws://localhost:15000/streams/terminal');
      var muxDemux = new MuxDemux(onStream);
      stream.pipe(muxDemux).pipe(stream);
      function onStream(stream) {
        if (stream.meta === 'terminal') {
          onTerminal(stream);
        }
      }
      function onTerminal(stream) {
        stream.on('data', function (data) {
          if (/npm start\r\n/.test(data)) {
            done();
          }
        });
        stream.write('echo $RUNNABLE_START_CMD\n');
      }
    });
    it('should have web down', function (done) {
      request('http://localhost:15000/api/checkWebUp', function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode !== 500) {
          done(new Error());
        } else {
          done();
        }
      });
    });
  });
});