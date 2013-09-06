var express = require('express');
var app = module.exports = express();
var async = require('async');
var mw = require('./middleware');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

app.use(mw.json);

app.post('/create', mw.filePath, mw.fileAbsent, function (req, res, next) {
  // this should be a streaming path
  fs.writeFile(req.filePath, req.body.content, 'utf8', function (err) {
    if (err) {
      if (err.errno === 34) {
        next({ code: 403, message: 'path does not exist' }); 
      } else {
        next(err);
      }
    } else {
      res.json(201, { });
    }
  });
});

app.post('/read', mw.filePath, mw.fileExists, function (req, res, next) {
  // this should be a streaming path
  fs.readFile(req.filePath, 'utf8', req.domain.intercept(function (content) {
    res.json(201, content);
  }));
});

app.post('/update', mw.filePath, mw.fileExists, function (req, res, next) {
  // this should be a streaming path
  fs.writeFile(req.filePath, req.body.content, 'utf8', function (err) {
    if (err) {
      if (err.errno === 28) {
        next({ code: 403, message: 'cannot update contents of a directory'});
      } else {
        next(err);
      }
    } else {
      res.json(201, { });
    }
  });
});

app.post('/delete', mw.filePath, mw.fileExists, function (req, res, next) {
  fs.unlink(req.filePath, req.domain.intercept(function () {
    res.json(201, { });
  }));
});

app.post('/rename', mw.filePath, mw.newFilePath, mw.fileExists, mw.newFileAbsent, function (req, res, next) {
  fs.rename(req.filePath, req.newFilePath, req.domain.intercept(function () {
    res.json(201, { });
  }));
});

app.post('/move', mw.newFilePath, mw.fileExists, mw.newFileAbsent, function (req, res, next) {
  fs.rename(req.filePath, req.newFilePath, function (err) {
    if (err) {

      if (err.errno === 18) {
        next({ code: 403, message: 'cannot move path into itself'});
      } else if (err.errno === 34) {
        next({ code: 403, message: 'destination does not exist'});
      } else if (err.errno === 27) {
        next({ code: 403, message: 'destination is not a directory'});
      } else {
        next(err);
      }
    } else {
      res.json(201, { });
    }
  });
});

app.post('/readall', function (req, res, next) {
  // this should be a streaming path, tar
  // fstream, it even supports filters
  var domain = createDomain();
  domain.on('error', function (err) {
    res.json(500, { message: err.message });
  });
  domain.run(function () {
    req.pipe(concat(function (body) {
      body = JSON.parse(body);
      var files = [ ];
      var filePath = path.normalize('/' + body.dir);
      var ignores = body.ignores;
      var exts = body.exts;
      // findit -> filter -> async.map
      var read_directory = domain.bind(function (currPath, currVirtualPath, cb) {
        fs.readdir(currPath, domain.bind(function (err, diskFiles) {
          if (err) { cb({ code: 500, msg: 'error reading directory, are you root?'}); } else {
            // filer, map
            async.forEach(diskFiles, domain.bind(function (file, cb) {
              var virtualFile = path.normalize(currVirtualPath + '/' + file);
              var diskFile = path.normalize(currPath + '/' + file);
              var ignored = false;
              if (/^\./.test(file)) {
                ignored = true;
              } else {
                ignores.forEach(function (ignore) {
                  if (ignore.indexOf(virtualFile) !== -1) {
                    ignored = true;
                  }
                });
              }
              if (ignored) { cb(); } else {
                fs.stat(diskFile, domain.bind(function (err, stats) {
                  if (err) { cb({ code: 500, msg: 'error getting file stats' }); } else {
                    if (stats.isDirectory()) {
                      files.push({
                        name: file,
                        path: currVirtualPath,
                        dir: true
                      });
                      read_directory(diskFile, virtualFile, cb);
                    } else {
                      var getContent = false;
                      var fileExt = path.extname(diskFile);
                      if (fileExt) { fileExt = fileExt.toLowerCase(); }
                      exts.forEach( function (ext) {
                        if (ext === fileExt) {
                          getContent = true;
                        }
                      });
                      if (getContent) {
                        fs.readFile(diskFile, 'utf8', domain.bind(function (err, content) {
                          if (err) { cb({ code: 500, msg: 'error reading file from disk' }); } else {
                            files.push({
                              name: file,
                              path: currVirtualPath,
                              dir: false,
                              content: content
                            });
                            cb();
                          }
                        }));
                      } else {
                        files.push({
                          name: file,
                          path: currVirtualPath,
                          dir: false
                        });
                        cb();
                      }
                    }
                  }
                }));
              }
            }), domain.bind(function (err) {
              if (err) {
                cb({ code: 500, msg: 'error reading files from container'});
              } else {
                cb(null, files);
              }
            }));
          }
        }));
      });
      read_directory(filePath, '/', function (err, files) {
        if (err) { res.json(err.code, { message: err.msg }); } else {
          res.json(201, files);
        }
      });
    }));
  });
});

app.post('/mkdir', mw.filePath, mw.fileAbsent, function (req, res, next) {
  fs.mkdir(req.filePath, function (err) {
    if (err) {
      if (err.errno === 34) {
        next({ code: 403, message: 'path does not exist'});
      } else {
        next(err);
      }
    } else {
      res.json(201, { });
    }
  });
});

app.post('/readdir', function (req, res, next) {
  // this should be a streaming path
  var domain = createDomain();
  domain.on('error', function (err) {
    res.json(500, { message: err.message });
  });
  domain.run(function () {
    req.pipe(concat(function (body) {
      body = JSON.parse(body);
      var files = [ ];
      var filePath = '/' + body.dir + '/' + body.sub;
      var exts = body.exts;
      // series
      var read_directory = domain.bind(function (currPath, currVirtualPath, cb) {
        fs.readdir(currPath, domain.bind(function (err, diskFiles) {
          if (err) {
            if(err.errno === 34) { cb({ code: 404, msg: 'path not found'}); } else {
              if (err.errno === 27) { cb({ code: 403, msg: 'resource is not a path'}); } else {
                cb({ code: 500, msg: 'error reading directory, are you root?'});
              }
            }
          } else {
            // map
            async.forEach(diskFiles, domain.bind(function (file, cb) {
              var virtualFile = path(currVirtualPath + '/' + file);
              var diskFile = path.normalize(currPath + '/' + file);
              fs.stat(diskFile, domain.bind(function (err, stats) {
                if (err) { cb({ code: 500, msg: 'error getting file stats' }); } else {
                  if (stats.isDirectory()) {
                    files.push({
                      name: file,
                      path: currVirtualPath,
                      dir: true
                    });
                    cb();
                  } else {
                    var getContent = false;
                    var fileExt = path.extname(diskFile);
                    if (fileExt) { fileExt = fileExt.toLowerCase(); }
                    exts.forEach( function (ext) {
                      if (ext === fileExt) {
                        getContent = true;
                      }
                    });
                    if (!getContent) {
                      files.push({
                        name: file,
                        path: currVirtualPath,
                        dir: false
                      });
                      cb();
                    } else {
                      fs.readFile(diskFile, 'utf8', domain.bind(function (err, content) {
                        if (err) { cb({ code: 500, msg: 'error reading file from disk' }); } else {
                          files.push({
                            name: file,
                            path: currVirtualPath,
                            dir: false,
                            content: content
                          });
                          cb();
                        }
                      }));
                    }
                  }
                }
              }));
            }), domain.bind(function (err) {
              if (err) {
                cb({ code: 500, msg: 'error reading files from container'});
              } else {
                cb(null, files);
              }
            }));
          }
        }));
      });
      read_directory(filePath, subDir, function (err, files) {
        if (err) { res.json(err.code, { message: err.msg }); } else {
          res.json(201, files);
        }
      });
    }));
  });
});

app.post('/rmdir', mw.filePath, mw.fileExists, function (req, res, next) {
  if (req.body.recursive) {
    rimraf(req.filePath, req.domain.intercept(function () {
      res.json(201, {});
    }));
  } else {
    // when would this come up?
    fs.rmdir(req.filePath, function (err) {
      if (err) {
        if (err.errno === 53) {
          next({ code: 403, message: 'directory is not empty'});
        } else {
          next(err);
        }
      } else {
        res.json(201, {});
      }
    });
  }
});