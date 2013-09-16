var request = require('request');
require('..');
var dir = '/';
var path = 'tmp'
var fileName = 'myCoolFile' + Date.now() + '.txt';
var newName = 'myCoolerFile' + Date.now() + '.txt';
var nonExisting = 'trololol.vb';
var content = 'this is really cool content';
var update = 'this is way cooler content';

describe('Files', function (){
  describe('create', function (){
    it('should not error the first time', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/create',
        json: {
          dir: dir,
          path: path,
          name: fileName,
          content: content
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode >= 300) {
          done(new Error(body.message));
        } else {
          done();
        }
      });
    })
    it('should error the second time', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/create',
        json: {
          dir: dir,
          path: path,
          name: fileName,
          content: content
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode <= 300) {
          done(new Error('should not have worked'));
        } else {
          done();
        }
      });
    })
  })
  describe('read', function (){
    it('should be cool', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/read',
        json: {
          dir: dir,
          path: path,
          name: fileName
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode >= 300) {
          done(new Error(body.message));
        } else if (body !== content) {
          done(new Error('not cool bro'));
        } else {
          done();
        }
      });
    })
  })
  describe('update', function (){
    it('should work for the existing file', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/update',
        json: {
          dir: dir,
          path: path,
          name: fileName,
          content: update
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode >= 300) {
          done(new Error(body.message));
        } else {
          done();
        }
      });
    })
    it('should have updated the existing file', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/read',
        json: {
          dir: dir,
          path: path,
          name: fileName
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode >= 300) {
          done(new Error(body.message));
        } else if (body !== update) {
          done(new Error('not cooler bro'));
        } else {
          done();
        }
      });
    })
    it('should should fail on a non-existing file', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/read',
        json: {
          dir: dir,
          path: path,
          name: nonExisting
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode <= 300) {
          done(new Error('should not have worked'));
        } else {
          done();
        }
      });
    })
  })
  describe('rename', function (){
    it('should fail a non-existing file', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/rename',
        json: {
          dir: dir,
          path: path,
          name: nonExisting,
          newName: newName
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode <= 300) {
          done(new Error('should not have worked'));
        } else {
          done();
        }
      });
    })
    it('should work on an existing file', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/rename',
        json: {
          dir: dir,
          path: path,
          name: fileName,
          newName: newName
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode >= 300) {
          done(new Error('should have worked'));
        } else {
          done();
        }
      });
    })
    it('should not exist in the old location', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/read',
        json: {
          dir: dir,
          path: path,
          name: fileName
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode <= 300) {
          done(new Error('should have failed'));
        } else {
          done();
        }
      });
    })
    it('should exist in the new location', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/read',
        json: {
          dir: dir,
          path: path,
          name: newName
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode >= 300) {
          done(new Error('should not have failed'));
        } else {
          done();
        }
      });
    })
  })
  describe('delete', function (){
    it('should error for non-existing files', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/delete',
        json: {
          dir: dir,
          path: path,
          name: nonExisting
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode <= 300) {
          done(new Error('should have failed'));
        } else {
          done();
        }
      });
    })
    it('should delte existing files', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/delete',
        json: {
          dir: dir,
          path: path,
          name: newName
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode >= 300) {
          done(new Error('should not have failed'));
        } else {
          done();
        }
      });
    })
    it('should have deleted the file', function (done){
      request.post({
        url: 'http://localhost:15000/api/files/read',
        json: {
          dir: dir,
          path: path,
          name: newName
        }
      }, function (err, res, body) {
        if (err) {
          done(err);
        } else if (res.statusCode <= 300) {
          done(new Error('should have failed'));
        } else {
          done();
        }
      });
    })
  })
})