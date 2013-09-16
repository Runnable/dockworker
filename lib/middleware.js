var createDomain = require('domain').create;
var concat = require('concat-stream');
var path = require('path');
var fs = require('./fs');

module.exports.domain = function domainMiddleware (req, res, next) {
  var domain = createDomain();
  domain.add(req);
  domain.add(res);
  domain.on('error', next);
  domain.run(next);
};

module.exports.error = function errorMiddleware (err, req, res, next) {
  if (process.env.NODE_ENV !== 'testing') {
    console.error(err);
  }
  res.json(err.code || 500, { message: err.message, stack: err.stack });
};

module.exports.cors = function corsMiddleware (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With');
  next();
};

module.exports.json = function jsonMiddleware (req, res, next) {
  req.pipe(concat(concatted));

  function concatted (body) {
    req.body = JSON.parse(body);
    next();
  }
};

module.exports.filePath = function filePathMiddleare (req, res, next) {
  if (req.body.dir == null ||
    req.body.path == null ||
    req.body.name == null) {
    next({
      code: 400,
      message: 'missing params'
    });
  } else {
    req.filePath = path.join('/', req.body.dir, req.body.path, req.body.name);
    next();
  }
};

module.exports.newFilePath = function newFilePathMiddleare (req, res, next) {
  if (req.body.dir == null ||
    req.body.path == null ||
    req.body.newName == null) {
    next({
      code: 400,
      message: 'missing params'
    });
  }
  req.newFilePath = path.join('/', req.body.dir, req.body.path, req.body.newName);
  next();
};

module.exports.fileAbsent = function fileAbsentMiddleware (req, res, next) {
  fs.exists(req.filePath, checkExistance);

  function checkExistance (exists) {
    if (exists) { 
      next({ code: 403, message: 'resource already exists' }); 
    } else {
      next();
    }
  }
};

module.exports.fileExists = function fileExistsMiddleware (req, res, next) {
  fs.exists(req.filePath, checkExistance);

  function checkExistance (exists) {
    if (!exists) { 
      next({ code: 403, message: 'resource does not exists' }); 
    } else {
      next();
    }
  }
};

module.exports.newFileAbsent = function newFileAbsentMiddleware (req, res, next) {
  fs.exists(req.newFilePath, checkExistance);

  function checkExistance (exists) {
    if (exists) { 
      next({ code: 403, message: 'destination resource already exists' }); 
    } else {
      next();
    }
  }
};
