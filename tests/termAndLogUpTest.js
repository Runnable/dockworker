var request = require('request');

describe('checkTermUp', function () {
  it('should respond 200', function (done) {
    request('http://localhost:15000/api/checkTermUp', function (err, res, body) {
      if (err) {
        done(err);
      } else if (res.statusCode !== 200) {
        done(new Error(res.body));
      } else {
        done();
      }
    });
  });
});