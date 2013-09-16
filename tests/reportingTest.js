var request = require('request');
require('..');

describe('Reporters', function (){
  describe('running', function (){
    it('should return a boolean running attribute', function (done){
    	request({
        url: 'http://localhost:15000/api/running',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (typeof body.running !== 'boolean') {
          done(new Error('bad return value'));
        } else {
          done();
        }
      });
    })
  })
  describe('envs', function () {
    it('should return', function (done) {
      request({
        url: 'http://localhost:15000/api/envs',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
    })
  })
})