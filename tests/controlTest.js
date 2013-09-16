var request = require('request');
require('..');

describe('Control', function (){
  describe('start', function (){
    it('should not already be running', function (done){
      request({
        url: 'http://localhost:15000/api/running',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (body.running === true) {
          done(new Error('already running'));
        } else {
          done();
        }
      });
    })
    it('should not error out', function (done){
      request({
        url: 'http://localhost:15000/api/start',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode === 500) {
          done(new Error(body.message));
        } else {
          done();
        }
      });
    })
    it('should be running', function (done){
      request({
        url: 'http://localhost:15000/api/running',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (body.running !== true) {
          done(new Error('not running'));
        } else {
          done();
        }
      });
    })
  })
  describe('restart', function (){
    it('should not error out', function (done){
      request({
        url: 'http://localhost:15000/api/restart',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode === 500) {
          done(new Error(body.message));
        } else {
          done();
        }
      });
    })
    it('should be running', function (done){
      request({
        url: 'http://localhost:15000/api/running',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (body.running !== true) {
          done(new Error('not running'));
        } else {
          done();
        }
      });
    })
  })
  describe('stop', function (){
    it('should be running', function (done){
      request({
        url: 'http://localhost:15000/api/running',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (body.running !== true) {
          done(new Error('not running'));
        } else {
          done();
        }
      });
    })
    it('should not error out', function (done){
      request({
        url: 'http://localhost:15000/api/stop',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode === 500) {
          done(new Error(body.message));
        } else {
          done();
        }
      });
    })
    it('should be stopped', function (done){
      request({
        url: 'http://localhost:15000/api/running',
        json: {}
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (body.running === true) {
          done(new Error('still running'));
        } else {
          done();
        }
      });
    })
  })
})