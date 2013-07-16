;(function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
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
},{"dnode":6,"mux-demux":17,"shoe":23,"tty.js/static/term":25}],2:[function(require,module,exports){
(function(process){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;
function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (x === xs[i]) return i;
    }
    return -1;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = indexOf(list, listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  if (arguments.length === 0) {
    this._events = {};
    return this;
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

})(require("__browserify_process"))
},{"__browserify_process":5}],3:[function(require,module,exports){
var events = require('events');
var util = require('util');

function Stream() {
  events.EventEmitter.call(this);
}
util.inherits(Stream, events.EventEmitter);
module.exports = Stream;
// Backwards-compat with node 0.4.x
Stream.Stream = Stream;

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once, and
  // only when all sources have ended.
  if (!dest._isStdio && (!options || options.end !== false)) {
    dest._pipeCount = dest._pipeCount || 0;
    dest._pipeCount++;

    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (this.listeners('error').length === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('end', cleanup);
    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('end', cleanup);
  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":2,"util":4}],4:[function(require,module,exports){
var events = require('events');

exports.isArray = isArray;
exports.isDate = function(obj){return Object.prototype.toString.call(obj) === '[object Date]'};
exports.isRegExp = function(obj){return Object.prototype.toString.call(obj) === '[object RegExp]'};


exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (typeof f !== 'string') {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(exports.inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j': return JSON.stringify(args[i++]);
      default:
        return x;
    }
  });
  for(var x = args[i]; i < len; x = args[++i]){
    if (x === null || typeof x !== 'object') {
      str += ' ' + x;
    } else {
      str += ' ' + exports.inspect(x);
    }
  }
  return str;
};

},{"events":2}],5:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],6:[function(require,module,exports){
var dnode = require('./lib/dnode');

module.exports = function (cons, opts) {
    return new dnode(cons, opts);
};

},{"./lib/dnode":7}],7:[function(require,module,exports){
(function(process){var protocol = require('dnode-protocol');
var Stream = require('stream');
var json = typeof JSON === 'object' ? JSON : require('jsonify');

module.exports = dnode;
dnode.prototype = {};
(function () { // browsers etc
    for (var key in Stream.prototype) {
        dnode.prototype[key] = Stream.prototype[key];
    }
})();

function dnode (cons, opts) {
    Stream.call(this);
    var self = this;
    
    self.opts = opts || {};
    
    self.cons = typeof cons === 'function'
        ? cons
        : function () { return cons || {} }
    ;
    
    self.readable = true;
    self.writable = true;
    
    process.nextTick(function () {
        if (self._ended) return;
        self.proto = self._createProto();
        self.proto.start();
        
        if (!self._handleQueue) return;
        for (var i = 0; i < self._handleQueue.length; i++) {
            self.handle(self._handleQueue[i]);
        }
    });
}

dnode.prototype._createProto = function () {
    var self = this;
    var proto = protocol(function (remote) {
        if (self._ended) return;
        
        var ref = self.cons.call(this, remote, self);
        if (typeof ref !== 'object') ref = this;
        
        self.emit('local', ref, self);
        
        return ref;
    }, self.opts.proto);
    
    proto.on('remote', function (remote) {
        self.emit('remote', remote, self);
        self.emit('ready'); // backwards compatability, deprecated
    });
    
    proto.on('request', function (req) {
        if (!self.readable) return;
        
        if (self.opts.emit === 'object') {
            self.emit('data', req);
        }
        else self.emit('data', json.stringify(req) + '\n');
    });
    
    proto.on('fail', function (err) {
        // errors that the remote end was responsible for
        self.emit('fail', err);
    });
    
    proto.on('error', function (err) {
        // errors that the local code was responsible for
        self.emit('error', err);
    });
    
    return proto;
};

dnode.prototype.write = function (buf) {
    if (this._ended) return;
    var self = this;
    var row;
    
    if (buf && typeof buf === 'object'
    && buf.constructor && buf.constructor.name === 'Buffer'
    && buf.length
    && typeof buf.slice === 'function') {
        // treat like a buffer
        if (!self._bufs) self._bufs = [];
        
        // treat like a buffer
        for (var i = 0, j = 0; i < buf.length; i++) {
            if (buf[i] === 0x0a) {
                self._bufs.push(buf.slice(j, i));
                
                var line = '';
                for (var k = 0; k < self._bufs.length; k++) {
                    line += String(self._bufs[k]);
                }
                
                try { row = json.parse(line) }
                catch (err) { return self.end() }
                
                j = i + 1;
                
                self.handle(row);
                self._bufs = [];
            }
        }
        
        if (j < buf.length) self._bufs.push(buf.slice(j, buf.length));
    }
    else if (buf && typeof buf === 'object') {
        // .isBuffer() without the Buffer
        // Use self to pipe JSONStream.parse() streams.
        self.handle(buf);
    }
    else {
        if (typeof buf !== 'string') buf = String(buf);
        if (!self._line) self._line = '';
        
        for (var i = 0; i < buf.length; i++) {
            if (buf.charCodeAt(i) === 0x0a) {
                try { row = json.parse(self._line) }
                catch (err) { return self.end() }
                
                self._line = '';
                self.handle(row);
            }
            else self._line += buf.charAt(i)
        }
    }
};

dnode.prototype.handle = function (row) {
    if (!this.proto) {
        if (!this._handleQueue) this._handleQueue = [];
        this._handleQueue.push(row);
    }
    else this.proto.handle(row);
};

dnode.prototype.end = function () {
    if (this._ended) return;
    this._ended = true;
    this.writable = false;
    this.readable = false;
    this.emit('end');
};

dnode.prototype.destroy = function () {
    this.end();
};

})(require("__browserify_process"))
},{"__browserify_process":5,"dnode-protocol":8,"jsonify":14,"stream":3}],8:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter;
var scrubber = require('./lib/scrub');
var objectKeys = require('./lib/keys');
var forEach = require('./lib/foreach');
var isEnumerable = require('./lib/is_enum');

module.exports = function (cons, opts) {
    return new Proto(cons, opts);
};

(function () { // browsers bleh
    for (var key in EventEmitter.prototype) {
        Proto.prototype[key] = EventEmitter.prototype[key];
    }
})();

function Proto (cons, opts) {
    var self = this;
    EventEmitter.call(self);
    if (!opts) opts = {};
    
    self.remote = {};
    self.callbacks = { local : [], remote : [] };
    self.wrap = opts.wrap;
    self.unwrap = opts.unwrap;
    
    self.scrubber = scrubber(self.callbacks.local);
    
    if (typeof cons === 'function') {
        self.instance = new cons(self.remote, self);
    }
    else self.instance = cons || {};
}

Proto.prototype.start = function () {
    this.request('methods', [ this.instance ]);
};

Proto.prototype.cull = function (id) {
    delete this.callbacks.remote[id];
    this.emit('request', {
        method : 'cull',
        arguments : [ id ]
    });
};

Proto.prototype.request = function (method, args) {
    var scrub = this.scrubber.scrub(args);
    
    this.emit('request', {
        method : method,
        arguments : scrub.arguments,
        callbacks : scrub.callbacks,
        links : scrub.links
    });
};

Proto.prototype.handle = function (req) {
    var self = this;
    var args = self.scrubber.unscrub(req, function (id) {
        if (self.callbacks.remote[id] === undefined) {
            // create a new function only if one hasn't already been created
            // for a particular id
            var cb = function () {
                self.request(id, [].slice.apply(arguments));
            };
            self.callbacks.remote[id] = self.wrap ? self.wrap(cb, id) : cb;
            return cb;
        }
        return self.unwrap
            ? self.unwrap(self.callbacks.remote[id], id)
            : self.callbacks.remote[id]
        ;
    });
    
    if (req.method === 'methods') {
        self.handleMethods(args[0]);
    }
    else if (req.method === 'cull') {
        forEach(args, function (id) {
            delete self.callbacks.local[id];
        });
    }
    else if (typeof req.method === 'string') {
        if (isEnumerable(self.instance, req.method)) {
            self.apply(self.instance[req.method], args);
        }
        else {
            self.emit('fail', new Error(
                'request for non-enumerable method: ' + req.method
            ));
        }
    }
    else if (typeof req.method == 'number') {
        var fn = self.callbacks.local[req.method];
        if (!fn) {
            self.emit('fail', new Error('no such method'));
        }
        else self.apply(fn, args);
    }
};

Proto.prototype.handleMethods = function (methods) {
    var self = this;
    if (typeof methods != 'object') {
        methods = {};
    }
    
    // copy since assignment discards the previous refs
    forEach(objectKeys(self.remote), function (key) {
        delete self.remote[key];
    });
    
    forEach(objectKeys(methods), function (key) {
        self.remote[key] = methods[key];
    });
    
    self.emit('remote', self.remote);
    self.emit('ready');
};

Proto.prototype.apply = function (f, args) {
    try { f.apply(undefined, args) }
    catch (err) { this.emit('error', err) }
};

},{"./lib/foreach":9,"./lib/is_enum":10,"./lib/keys":11,"./lib/scrub":12,"events":2}],9:[function(require,module,exports){
module.exports = function forEach (xs, f) {
    if (xs.forEach) return xs.forEach(f)
    for (var i = 0; i < xs.length; i++) {
        f.call(xs, xs[i], i);
    }
}

},{}],10:[function(require,module,exports){
var objectKeys = require('./keys');

module.exports = function (obj, key) {
    if (Object.prototype.propertyIsEnumerable) {
        return Object.prototype.propertyIsEnumerable.call(obj, key);
    }
    var keys = objectKeys(obj);
    for (var i = 0; i < keys.length; i++) {
        if (key === keys[i]) return true;
    }
    return false;
};

},{"./keys":11}],11:[function(require,module,exports){
module.exports = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) keys.push(key);
    return keys;
};

},{}],12:[function(require,module,exports){
var traverse = require('traverse');
var objectKeys = require('./keys');
var forEach = require('./foreach');

function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) if (xs[i] === x) return i;
    return -1;
}

// scrub callbacks out of requests in order to call them again later
module.exports = function (callbacks) {
    return new Scrubber(callbacks);
};

function Scrubber (callbacks) {
    this.callbacks = callbacks;
}

// Take the functions out and note them for future use
Scrubber.prototype.scrub = function (obj) {
    var self = this;
    var paths = {};
    var links = [];
    
    var args = traverse(obj).map(function (node) {
        if (typeof node === 'function') {
            var i = indexOf(self.callbacks, node);
            if (i >= 0 && !(i in paths)) {
                // Keep previous function IDs only for the first function
                // found. This is somewhat suboptimal but the alternatives
                // are worse.
                paths[i] = this.path;
            }
            else {
                var id = self.callbacks.length;
                self.callbacks.push(node);
                paths[id] = this.path;
            }
            
            this.update('[Function]');
        }
        else if (this.circular) {
            links.push({ from : this.circular.path, to : this.path });
            this.update('[Circular]');
        }
    });
    
    return {
        arguments : args,
        callbacks : paths,
        links : links
    };
};
 
// Replace callbacks. The supplied function should take a callback id and
// return a callback of its own.
Scrubber.prototype.unscrub = function (msg, f) {
    var args = msg.arguments || [];
    forEach(objectKeys(msg.callbacks || {}), function (sid) {
        var id = parseInt(sid, 10);
        var path = msg.callbacks[id];
        traverse.set(args, path, f(id));
    });
    
    forEach(msg.links || [], function (link) {
        var value = traverse.get(args, link.from);
        traverse.set(args, link.to, value);
    });
    
    return args;
};

},{"./foreach":9,"./keys":11,"traverse":13}],13:[function(require,module,exports){
var traverse = module.exports = function (obj) {
    return new Traverse(obj);
};

function Traverse (obj) {
    this.value = obj;
}

Traverse.prototype.get = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            node = undefined;
            break;
        }
        node = node[key];
    }
    return node;
};

Traverse.prototype.has = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            return false;
        }
        node = node[key];
    }
    return true;
};

Traverse.prototype.set = function (ps, value) {
    var node = this.value;
    for (var i = 0; i < ps.length - 1; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) node[key] = {};
        node = node[key];
    }
    node[ps[i]] = value;
    return value;
};

Traverse.prototype.map = function (cb) {
    return walk(this.value, cb, true);
};

Traverse.prototype.forEach = function (cb) {
    this.value = walk(this.value, cb, false);
    return this.value;
};

Traverse.prototype.reduce = function (cb, init) {
    var skip = arguments.length === 1;
    var acc = skip ? this.value : init;
    this.forEach(function (x) {
        if (!this.isRoot || !skip) {
            acc = cb.call(this, acc, x);
        }
    });
    return acc;
};

Traverse.prototype.paths = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.path); 
    });
    return acc;
};

Traverse.prototype.nodes = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.node);
    });
    return acc;
};

Traverse.prototype.clone = function () {
    var parents = [], nodes = [];
    
    return (function clone (src) {
        for (var i = 0; i < parents.length; i++) {
            if (parents[i] === src) {
                return nodes[i];
            }
        }
        
        if (typeof src === 'object' && src !== null) {
            var dst = copy(src);
            
            parents.push(src);
            nodes.push(dst);
            
            forEach(objectKeys(src), function (key) {
                dst[key] = clone(src[key]);
            });
            
            parents.pop();
            nodes.pop();
            return dst;
        }
        else {
            return src;
        }
    })(this.value);
};

function walk (root, cb, immutable) {
    var path = [];
    var parents = [];
    var alive = true;
    
    return (function walker (node_) {
        var node = immutable ? copy(node_) : node_;
        var modifiers = {};
        
        var keepGoing = true;
        
        var state = {
            node : node,
            node_ : node_,
            path : [].concat(path),
            parent : parents[parents.length - 1],
            parents : parents,
            key : path.slice(-1)[0],
            isRoot : path.length === 0,
            level : path.length,
            circular : null,
            update : function (x, stopHere) {
                if (!state.isRoot) {
                    state.parent.node[state.key] = x;
                }
                state.node = x;
                if (stopHere) keepGoing = false;
            },
            'delete' : function (stopHere) {
                delete state.parent.node[state.key];
                if (stopHere) keepGoing = false;
            },
            remove : function (stopHere) {
                if (isArray(state.parent.node)) {
                    state.parent.node.splice(state.key, 1);
                }
                else {
                    delete state.parent.node[state.key];
                }
                if (stopHere) keepGoing = false;
            },
            keys : null,
            before : function (f) { modifiers.before = f },
            after : function (f) { modifiers.after = f },
            pre : function (f) { modifiers.pre = f },
            post : function (f) { modifiers.post = f },
            stop : function () { alive = false },
            block : function () { keepGoing = false }
        };
        
        if (!alive) return state;
        
        function updateState() {
            if (typeof state.node === 'object' && state.node !== null) {
                if (!state.keys || state.node_ !== state.node) {
                    state.keys = objectKeys(state.node)
                }
                
                state.isLeaf = state.keys.length == 0;
                
                for (var i = 0; i < parents.length; i++) {
                    if (parents[i].node_ === node_) {
                        state.circular = parents[i];
                        break;
                    }
                }
            }
            else {
                state.isLeaf = true;
                state.keys = null;
            }
            
            state.notLeaf = !state.isLeaf;
            state.notRoot = !state.isRoot;
        }
        
        updateState();
        
        // use return values to update if defined
        var ret = cb.call(state, state.node);
        if (ret !== undefined && state.update) state.update(ret);
        
        if (modifiers.before) modifiers.before.call(state, state.node);
        
        if (!keepGoing) return state;
        
        if (typeof state.node == 'object'
        && state.node !== null && !state.circular) {
            parents.push(state);
            
            updateState();
            
            forEach(state.keys, function (key, i) {
                path.push(key);
                
                if (modifiers.pre) modifiers.pre.call(state, state.node[key], key);
                
                var child = walker(state.node[key]);
                if (immutable && Object.hasOwnProperty.call(state.node, key)) {
                    state.node[key] = child.node;
                }
                
                child.isLast = i == state.keys.length - 1;
                child.isFirst = i == 0;
                
                if (modifiers.post) modifiers.post.call(state, child);
                
                path.pop();
            });
            parents.pop();
        }
        
        if (modifiers.after) modifiers.after.call(state, state.node);
        
        return state;
    })(root).node;
}

function copy (src) {
    if (typeof src === 'object' && src !== null) {
        var dst;
        
        if (isArray(src)) {
            dst = [];
        }
        else if (isDate(src)) {
            dst = new Date(src);
        }
        else if (isRegExp(src)) {
            dst = new RegExp(src);
        }
        else if (isError(src)) {
            dst = { message: src.message };
        }
        else if (isBoolean(src)) {
            dst = new Boolean(src);
        }
        else if (isNumber(src)) {
            dst = new Number(src);
        }
        else if (isString(src)) {
            dst = new String(src);
        }
        else if (Object.create && Object.getPrototypeOf) {
            dst = Object.create(Object.getPrototypeOf(src));
        }
        else if (src.constructor === Object) {
            dst = {};
        }
        else {
            var proto =
                (src.constructor && src.constructor.prototype)
                || src.__proto__
                || {}
            ;
            var T = function () {};
            T.prototype = proto;
            dst = new T;
        }
        
        forEach(objectKeys(src), function (key) {
            dst[key] = src[key];
        });
        return dst;
    }
    else return src;
}

var objectKeys = Object.keys || function keys (obj) {
    var res = [];
    for (var key in obj) res.push(key)
    return res;
};

function toS (obj) { return Object.prototype.toString.call(obj) }
function isDate (obj) { return toS(obj) === '[object Date]' }
function isRegExp (obj) { return toS(obj) === '[object RegExp]' }
function isError (obj) { return toS(obj) === '[object Error]' }
function isBoolean (obj) { return toS(obj) === '[object Boolean]' }
function isNumber (obj) { return toS(obj) === '[object Number]' }
function isString (obj) { return toS(obj) === '[object String]' }

var isArray = Array.isArray || function isArray (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

forEach(objectKeys(Traverse.prototype), function (key) {
    traverse[key] = function (obj) {
        var args = [].slice.call(arguments, 1);
        var t = new Traverse(obj);
        return t[key].apply(t, args);
    };
});

},{}],14:[function(require,module,exports){
exports.parse = require('./lib/parse');
exports.stringify = require('./lib/stringify');

},{"./lib/parse":15,"./lib/stringify":16}],15:[function(require,module,exports){
var at, // The index of the current character
    ch, // The current character
    escapee = {
        '"':  '"',
        '\\': '\\',
        '/':  '/',
        b:    '\b',
        f:    '\f',
        n:    '\n',
        r:    '\r',
        t:    '\t'
    },
    text,

    error = function (m) {
        // Call error when something is wrong.
        throw {
            name:    'SyntaxError',
            message: m,
            at:      at,
            text:    text
        };
    },
    
    next = function (c) {
        // If a c parameter is provided, verify that it matches the current character.
        if (c && c !== ch) {
            error("Expected '" + c + "' instead of '" + ch + "'");
        }
        
        // Get the next character. When there are no more characters,
        // return the empty string.
        
        ch = text.charAt(at);
        at += 1;
        return ch;
    },
    
    number = function () {
        // Parse a number value.
        var number,
            string = '';
        
        if (ch === '-') {
            string = '-';
            next('-');
        }
        while (ch >= '0' && ch <= '9') {
            string += ch;
            next();
        }
        if (ch === '.') {
            string += '.';
            while (next() && ch >= '0' && ch <= '9') {
                string += ch;
            }
        }
        if (ch === 'e' || ch === 'E') {
            string += ch;
            next();
            if (ch === '-' || ch === '+') {
                string += ch;
                next();
            }
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
        }
        number = +string;
        if (!isFinite(number)) {
            error("Bad number");
        } else {
            return number;
        }
    },
    
    string = function () {
        // Parse a string value.
        var hex,
            i,
            string = '',
            uffff;
        
        // When parsing for string values, we must look for " and \ characters.
        if (ch === '"') {
            while (next()) {
                if (ch === '"') {
                    next();
                    return string;
                } else if (ch === '\\') {
                    next();
                    if (ch === 'u') {
                        uffff = 0;
                        for (i = 0; i < 4; i += 1) {
                            hex = parseInt(next(), 16);
                            if (!isFinite(hex)) {
                                break;
                            }
                            uffff = uffff * 16 + hex;
                        }
                        string += String.fromCharCode(uffff);
                    } else if (typeof escapee[ch] === 'string') {
                        string += escapee[ch];
                    } else {
                        break;
                    }
                } else {
                    string += ch;
                }
            }
        }
        error("Bad string");
    },

    white = function () {

// Skip whitespace.

        while (ch && ch <= ' ') {
            next();
        }
    },

    word = function () {

// true, false, or null.

        switch (ch) {
        case 't':
            next('t');
            next('r');
            next('u');
            next('e');
            return true;
        case 'f':
            next('f');
            next('a');
            next('l');
            next('s');
            next('e');
            return false;
        case 'n':
            next('n');
            next('u');
            next('l');
            next('l');
            return null;
        }
        error("Unexpected '" + ch + "'");
    },

    value,  // Place holder for the value function.

    array = function () {

// Parse an array value.

        var array = [];

        if (ch === '[') {
            next('[');
            white();
            if (ch === ']') {
                next(']');
                return array;   // empty array
            }
            while (ch) {
                array.push(value());
                white();
                if (ch === ']') {
                    next(']');
                    return array;
                }
                next(',');
                white();
            }
        }
        error("Bad array");
    },

    object = function () {

// Parse an object value.

        var key,
            object = {};

        if (ch === '{') {
            next('{');
            white();
            if (ch === '}') {
                next('}');
                return object;   // empty object
            }
            while (ch) {
                key = string();
                white();
                next(':');
                if (Object.hasOwnProperty.call(object, key)) {
                    error('Duplicate key "' + key + '"');
                }
                object[key] = value();
                white();
                if (ch === '}') {
                    next('}');
                    return object;
                }
                next(',');
                white();
            }
        }
        error("Bad object");
    };

value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

    white();
    switch (ch) {
    case '{':
        return object();
    case '[':
        return array();
    case '"':
        return string();
    case '-':
        return number();
    default:
        return ch >= '0' && ch <= '9' ? number() : word();
    }
};

// Return the json_parse function. It will have access to all of the above
// functions and variables.

module.exports = function (source, reviver) {
    var result;
    
    text = source;
    at = 0;
    ch = ' ';
    result = value();
    white();
    if (ch) {
        error("Syntax error");
    }

    // If there is a reviver function, we recursively walk the new structure,
    // passing each name/value pair to the reviver function for possible
    // transformation, starting with a temporary root object that holds the result
    // in an empty key. If there is not a reviver function, we simply return the
    // result.

    return typeof reviver === 'function' ? (function walk(holder, key) {
        var k, v, value = holder[key];
        if (value && typeof value === 'object') {
            for (k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                    v = walk(value, k);
                    if (v !== undefined) {
                        value[k] = v;
                    } else {
                        delete value[k];
                    }
                }
            }
        }
        return reviver.call(holder, key, value);
    }({'': result}, '')) : result;
};

},{}],16:[function(require,module,exports){
var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    gap,
    indent,
    meta = {    // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    },
    rep;

function quote(string) {
    // If the string contains no control characters, no quote characters, and no
    // backslash characters, then we can safely slap some quotes around it.
    // Otherwise we must also replace the offending characters with safe escape
    // sequences.
    
    escapable.lastIndex = 0;
    return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
        var c = meta[a];
        return typeof c === 'string' ? c :
            '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"' : '"' + string + '"';
}

function str(key, holder) {
    // Produce a string from holder[key].
    var i,          // The loop counter.
        k,          // The member key.
        v,          // The member value.
        length,
        mind = gap,
        partial,
        value = holder[key];
    
    // If the value has a toJSON method, call it to obtain a replacement value.
    if (value && typeof value === 'object' &&
            typeof value.toJSON === 'function') {
        value = value.toJSON(key);
    }
    
    // If we were called with a replacer function, then call the replacer to
    // obtain a replacement value.
    if (typeof rep === 'function') {
        value = rep.call(holder, key, value);
    }
    
    // What happens next depends on the value's type.
    switch (typeof value) {
        case 'string':
            return quote(value);
        
        case 'number':
            // JSON numbers must be finite. Encode non-finite numbers as null.
            return isFinite(value) ? String(value) : 'null';
        
        case 'boolean':
        case 'null':
            // If the value is a boolean or null, convert it to a string. Note:
            // typeof null does not produce 'null'. The case is included here in
            // the remote chance that this gets fixed someday.
            return String(value);
            
        case 'object':
            if (!value) return 'null';
            gap += indent;
            partial = [];
            
            // Array.isArray
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }
                
                // Join all of the elements together, separated with commas, and
                // wrap them in brackets.
                v = partial.length === 0 ? '[]' : gap ?
                    '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                    '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }
            
            // If the replacer is an array, use it to select the members to be
            // stringified.
            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            else {
                // Otherwise, iterate through all of the keys in the object.
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            
        // Join all of the member texts together, separated with commas,
        // and wrap them in braces.

        v = partial.length === 0 ? '{}' : gap ?
            '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
            '{' + partial.join(',') + '}';
        gap = mind;
        return v;
    }
}

module.exports = function (value, replacer, space) {
    var i;
    gap = '';
    indent = '';
    
    // If the space parameter is a number, make an indent string containing that
    // many spaces.
    if (typeof space === 'number') {
        for (i = 0; i < space; i += 1) {
            indent += ' ';
        }
    }
    // If the space parameter is a string, it will be used as the indent string.
    else if (typeof space === 'string') {
        indent = space;
    }

    // If there is a replacer, it must be a function or an array.
    // Otherwise, throw an error.
    rep = replacer;
    if (replacer && typeof replacer !== 'function'
    && (typeof replacer !== 'object' || typeof replacer.length !== 'number')) {
        throw new Error('JSON.stringify');
    }
    
    // Make a fake root object containing our value under the key of ''.
    // Return the result of stringifying the value.
    return str('', {'': value});
};

},{}],17:[function(require,module,exports){
var inject = require('./inject')
var serializer = require('stream-serializer')

module.exports = inject(function (stream, opts) {
  return serializer(opts && opts.wrapper) (stream)
})

},{"./inject":18,"stream-serializer":20}],18:[function(require,module,exports){
'use strict';

var through = require('through')
  , extend = require('xtend')
  , duplex = require('duplex')

module.exports = function (wrap) {

function MuxDemux (opts, onConnection) {
  if('function' === typeof opts)
    onConnection = opts, opts = null
  opts = opts || {}

  function createID() {
    return (
      Math.random().toString(16).slice(2) +
      Math.random().toString(16).slice(2)
    )
  }

  var streams = {}, streamCount = 0
  var md = duplex()//.resume()

  md.on('_data', function (data) {
    if(!(Array.isArray(data)
      && 'string' === typeof data[0]
      && '__proto__' !== data[0]
      && 'string' === typeof data[1]
      && '__proto__' !== data[1]
    )) return
    var id = data.shift()
    var event = data[0]
    var s = streams[id]
    if(!s) {
      if(event == 'close')
        return
      if(event != 'new')
        return outer.emit('unknown', id)
      md.emit('connection', createStream(id, data[1].meta, data[1].opts))
    }
    else if (event === 'pause')
      s.paused = true
    else if (event === 'resume') {
      var p = s.paused
      s.paused = false
      if(p) s.emit('drain')
    }
    else if (event === 'error') {
      var error = data[1]
      if (typeof error === 'string') {
        s.emit('error', new Error(error))
      } else if (typeof error.message === 'string') {
        var e = new Error(error.message)
        extend(e, error)
        s.emit('error', e)
      } else {
        s.emit('error', error)
      }
    }
    else {
      s.emit.apply(s, data)
    }
  })
  .on('_end', function () {
    destroyAll()
    md._end()
  })

  function destroyAll (_err) {
    md.removeListener('end', destroyAll)
    md.removeListener('error', destroyAll)
    md.removeListener('close', destroyAll)
    var err = _err || new Error ('unexpected disconnection')
    for (var i in streams) {
      var s = streams[i]
      s.destroyed = true
      if (opts.error !== true) {
        s.end()
      } else {
        s.emit('error', err)
        s.destroy()
      }
    }
  }

  //end the stream once sub-streams have ended.
  //(waits for them to close, like on a tcp server)

  function createStream(id, meta, opts) {
    streamCount ++
    var s = through(function (data) {
      if(!this.writable) {
        var err = Error('stream is not writable: ' + id)
        err.stream = this
        return outer.emit("error", err)
      }
      md._data([s.id, 'data', data])
    }, function () {
      md._data([s.id, 'end'])
      if (this.readable && !opts.allowHalfOpen && !this.ended) {
        this.emit("end")
      }
    })
    s.pause = function () {
      md._data([s.id, 'pause'])
    }
    s.resume = function () {
      md._data([s.id, 'resume'])
    }
    s.error = function (message) {
      md._data([s.id, 'error', message])
    }
    s.once('close', function () {
      delete streams[id]
      streamCount --
      md._data([s.id, 'close'])
      if(streamCount === 0)
        md.emit('zero')
    })
    s.writable = opts.writable
    s.readable = opts.readable
    streams[s.id = id] = s
    s.meta = meta
    return s
  }

  var outer = wrap(md, opts)

  if(md !== outer) {
    md.on('connection', function (stream) {
      outer.emit('connection', stream)
    })
  }

  outer.close = function (cb) {
    md.once('zero', function () {
      md._end()
      if(cb) cb()
    })
    return this
  }

  if(onConnection)
    outer.on('connection', onConnection)

  outer.on('connection', function (stream) {
    //if mux-demux recieves a stream but there is nothing to handle it,
    //then return an error to the other side.
    //still trying to think of the best error message.
    if(outer.listeners('connection').length === 1)
      stream.error('remote end lacks connection listener ' 
        + outer.listeners('connection').length)
  })

  var pipe = outer.pipe
  outer.pipe = function (dest, opts) {
    pipe.call(outer, dest, opts)
    md.on('end', destroyAll)
    md.on('close', destroyAll)
    md.on('error', destroyAll)
    return dest
  }

  outer.createStream = function (meta, opts) {
    opts = opts || {}
    if (!opts.writable && !opts.readable)
      opts.readable = opts.writable = true
    var s = createStream(createID(), meta, opts)
    var _opts = {writable: opts.readable, readable: opts.writable}
    md._data([s.id, 'new', {meta: meta, opts: _opts}])
    return s
  }
  outer.createWriteStream = function (meta) {
    return outer.createStream(meta, {writable: true, readable: false})
  }
  outer.createReadStream = function (meta) {
    return outer.createStream(meta, {writable: false, readable: true})
  }

  return outer
}

  return MuxDemux
} //inject


},{"duplex":19,"through":21,"xtend":22}],19:[function(require,module,exports){
(function(process){var Stream = require('stream')

module.exports = function (write, end) {
  var stream = new Stream() 
  var buffer = [], ended = false, destroyed = false, emitEnd
  stream.writable = stream.readable = true
  stream.paused = false
  stream._paused = false
  stream.buffer = buffer
  
  stream
    .on('pause', function () {
      stream._paused = true
    })
    .on('drain', function () {
      stream._paused = false
    })
   
  function destroySoon () {
    process.nextTick(stream.destroy.bind(stream))
  }

  if(write)
    stream.on('_data', write)
  if(end)
    stream.on('_end', end)

  //destroy the stream once both ends are over
  //but do it in nextTick, so that other listeners
  //on end have time to respond
  stream.once('end', function () { 
    stream.readable = false
    if(!stream.writable) {
      process.nextTick(function () {
        stream.destroy()
      })
    }
  })

  stream.once('_end', function () { 
    stream.writable = false
    if(!stream.readable)
      stream.destroy()
  })

  // this is the default write method,
  // if you overide it, you are resposible
  // for pause state.

  
  stream._data = function (data) {
    if(!stream.paused && !buffer.length)
      stream.emit('data', data)
    else 
      buffer.push(data)
    return !(stream.paused || buffer.length)
  }

  stream._end = function (data) { 
    if(data) stream._data(data)
    if(emitEnd) return
    emitEnd = true
    //destroy is handled above.
    stream.drain()
  }

  stream.write = function (data) {
    stream.emit('_data', data)
    return !stream._paused
  }

  stream.end = function () {
    stream.writable = false
    if(stream.ended) return
    stream.ended = true
    stream.emit('_end')
  }

  stream.drain = function () {
    if(!buffer.length && !emitEnd) return
    //if the stream is paused after just before emitEnd()
    //end should be buffered.
    while(!stream.paused) {
      if(buffer.length) {
        stream.emit('data', buffer.shift())
        if(buffer.length == 0) {
          stream.emit('_drain')
        }
      }
      else if(emitEnd && stream.readable) {
        stream.readable = false
        stream.emit('end')
        return
      } else {
        //if the buffer has emptied. emit drain.
        return true
      }
    }
  }
  var started = false
  stream.resume = function () {
    //this is where I need pauseRead, and pauseWrite.
    //here the reading side is unpaused,
    //but the writing side may still be paused.
    //the whole buffer might not empity at once.
    //it might pause again.
    //the stream should never emit data inbetween pause()...resume()
    //and write should return !buffer.length
    started = true
    stream.paused = false
    stream.drain() //will emit drain if buffer empties.
    return stream
  }

  stream.destroy = function () {
    if(destroyed) return
    destroyed = ended = true     
    buffer.length = 0
    stream.emit('close')
  }
  var pauseCalled = false
  stream.pause = function () {
    started = true
    stream.paused = true
    stream.emit('_pause')
    return stream
  }
  stream._pause = function () {
    if(!stream._paused) {
      stream._paused = true
      stream.emit('pause')
    }
    return this
  }
  stream.paused = true
  process.nextTick(function () {
    //unless the user manually paused
    if(started) return
    stream.resume()
  })
 
  return stream
}


})(require("__browserify_process"))
},{"__browserify_process":5,"stream":3}],20:[function(require,module,exports){

var EventEmitter = require('events').EventEmitter

exports = module.exports = function (wrapper) {

  if('function' == typeof wrapper)
    return wrapper
  
  return exports[wrapper] || exports.json
}

exports.json = function (stream) {

  var write = stream.write
  var soFar = ''

  function parse (line) {
    var js
    try {
      js = JSON.parse(line)
      //ignore lines of whitespace...
    } catch (err) { 
      return stream.emit('error', err)
      //return console.error('invalid JSON', line)
    }
    if(js !== undefined)
      write.call(stream, js)
  }

  function onData (data) {
    var lines = (soFar + data).split('\n')
    soFar = lines.pop()
    while(lines.length) {
      parse(lines.shift())
    }
  }

  stream.write = onData
  
  var end = stream.end

  stream.end = function (data) {
    if(data)
      stream.write(data)
    //if there is any left over...
    if(soFar) {
      parse(soFar)
    }
    return end.call(stream)
  }

  stream.emit = function (event, data) {

    if(event == 'data') {
      data = JSON.stringify(data) + '\n'
    }
    //since all stream events only use one argument, this is okay...
    EventEmitter.prototype.emit.call(stream, event, data)
  }

  return stream
//  return es.pipeline(es.split(), es.parse(), stream, es.stringify())
}

exports.raw = function (stream) {
  return stream
}


},{"events":2}],21:[function(require,module,exports){
(function(process){var Stream = require('stream')

// through
//
// a stream that does nothing but re-emit the input.
// useful for aggregating a series of changing but not ending streams into one stream)

exports = module.exports = through
through.through = through

//create a readable writable stream.

function through (write, end, opts) {
  write = write || function (data) { this.queue(data) }
  end = end || function () { this.queue(null) }

  var ended = false, destroyed = false, buffer = [], _ended = false
  var stream = new Stream()
  stream.readable = stream.writable = true
  stream.paused = false

//  stream.autoPause   = !(opts && opts.autoPause   === false)
  stream.autoDestroy = !(opts && opts.autoDestroy === false)

  stream.write = function (data) {
    write.call(this, data)
    return !stream.paused
  }

  function drain() {
    while(buffer.length && !stream.paused) {
      var data = buffer.shift()
      if(null === data)
        return stream.emit('end')
      else
        stream.emit('data', data)
    }
  }

  stream.queue = stream.push = function (data) {
//    console.error(ended)
    if(_ended) return stream
    if(data == null) _ended = true
    buffer.push(data)
    drain()
    return stream
  }

  //this will be registered as the first 'end' listener
  //must call destroy next tick, to make sure we're after any
  //stream piped from here.
  //this is only a problem if end is not emitted synchronously.
  //a nicer way to do this is to make sure this is the last listener for 'end'

  stream.on('end', function () {
    stream.readable = false
    if(!stream.writable && stream.autoDestroy)
      process.nextTick(function () {
        stream.destroy()
      })
  })

  function _end () {
    stream.writable = false
    end.call(stream)
    if(!stream.readable && stream.autoDestroy)
      stream.destroy()
  }

  stream.end = function (data) {
    if(ended) return
    ended = true
    if(arguments.length) stream.write(data)
    _end() // will emit or queue
    return stream
  }

  stream.destroy = function () {
    if(destroyed) return
    destroyed = true
    ended = true
    buffer.length = 0
    stream.writable = stream.readable = false
    stream.emit('close')
    return stream
  }

  stream.pause = function () {
    if(stream.paused) return
    stream.paused = true
    return stream
  }

  stream.resume = function () {
    if(stream.paused) {
      stream.paused = false
      stream.emit('resume')
    }
    drain()
    //may have become paused again,
    //as drain emits 'data'.
    if(!stream.paused)
      stream.emit('drain')
    return stream
  }
  return stream
}


})(require("__browserify_process"))
},{"__browserify_process":5,"stream":3}],22:[function(require,module,exports){
module.exports = extend

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i],
            keys = Object.keys(source)

        for (var j = 0; j < keys.length; j++) {
            var name = keys[j]
            target[name] = source[name]
        }
    }

    return target
}
},{}],23:[function(require,module,exports){
var Stream = require('stream');
var sockjs = require('sockjs-client');

module.exports = function (uri, cb) {
    if (/^\/\/[^\/]+\//.test(uri)) {
        uri = window.location.protocol + uri;
    }
    else if (!/^https?:\/\//.test(uri)) {
        uri = window.location.protocol + '//'
            + window.location.host
            + (/^\//.test(uri) ? uri : '/' + uri)
        ;
    }
    
    var stream = new Stream;
    stream.readable = true;
    stream.writable = true;
    
    var ready = false;
    var buffer = [];
    
    var sock = sockjs(uri);
    stream.sock = sock;
    
    stream.write = function (msg) {
        if (!ready || buffer.length) buffer.push(msg)
        else sock.send(msg)
    };
    
    stream.end = function (msg) {
        if (msg !== undefined) stream.write(msg);
        if (!ready) {
            stream._ended = true;
            return;
        }
        stream.writable = false;
        sock.close();
    };
    
    stream.destroy = function () {
        stream._ended = true;
        stream.writable = stream.readable = false;
        buffer.length = 0
        sock.close();
    };
    
    sock.onopen = function () {
        if (typeof cb === 'function') cb();
        ready = true;
        for (var i = 0; i < buffer.length; i++) {
            sock.send(buffer[i]);
        }
        buffer = [];
        stream.emit('connect');
        if (stream._ended) stream.end();
    };
    
    sock.onmessage = function (e) {
        stream.emit('data', e.data);
    };
    
    sock.onclose = function () {
        stream.emit('end');
        stream.writable = false;
        stream.readable = false;
    };
    
    return stream;
};

},{"sockjs-client":24,"stream":3}],24:[function(require,module,exports){
(function(){/* SockJS client, version 0.3.1.7.ga67f.dirty, http://sockjs.org, MIT License

Copyright (c) 2011-2012 VMware, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

// JSON2 by Douglas Crockford (minified).
var JSON;JSON||(JSON={}),function(){function str(a,b){var c,d,e,f,g=gap,h,i=b[a];i&&typeof i=="object"&&typeof i.toJSON=="function"&&(i=i.toJSON(a)),typeof rep=="function"&&(i=rep.call(b,a,i));switch(typeof i){case"string":return quote(i);case"number":return isFinite(i)?String(i):"null";case"boolean":case"null":return String(i);case"object":if(!i)return"null";gap+=indent,h=[];if(Object.prototype.toString.apply(i)==="[object Array]"){f=i.length;for(c=0;c<f;c+=1)h[c]=str(c,i)||"null";e=h.length===0?"[]":gap?"[\n"+gap+h.join(",\n"+gap)+"\n"+g+"]":"["+h.join(",")+"]",gap=g;return e}if(rep&&typeof rep=="object"){f=rep.length;for(c=0;c<f;c+=1)typeof rep[c]=="string"&&(d=rep[c],e=str(d,i),e&&h.push(quote(d)+(gap?": ":":")+e))}else for(d in i)Object.prototype.hasOwnProperty.call(i,d)&&(e=str(d,i),e&&h.push(quote(d)+(gap?": ":":")+e));e=h.length===0?"{}":gap?"{\n"+gap+h.join(",\n"+gap)+"\n"+g+"}":"{"+h.join(",")+"}",gap=g;return e}}function quote(a){escapable.lastIndex=0;return escapable.test(a)?'"'+a.replace(escapable,function(a){var b=meta[a];return typeof b=="string"?b:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+a+'"'}function f(a){return a<10?"0"+a:a}"use strict",typeof Date.prototype.toJSON!="function"&&(Date.prototype.toJSON=function(a){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(a){return this.valueOf()});var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","\t":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;typeof JSON.stringify!="function"&&(JSON.stringify=function(a,b,c){var d;gap="",indent="";if(typeof c=="number")for(d=0;d<c;d+=1)indent+=" ";else typeof c=="string"&&(indent=c);rep=b;if(!b||typeof b=="function"||typeof b=="object"&&typeof b.length=="number")return str("",{"":a});throw new Error("JSON.stringify")}),typeof JSON.parse!="function"&&(JSON.parse=function(text,reviver){function walk(a,b){var c,d,e=a[b];if(e&&typeof e=="object")for(c in e)Object.prototype.hasOwnProperty.call(e,c)&&(d=walk(e,c),d!==undefined?e[c]=d:delete e[c]);return reviver.call(a,b,e)}var j;text=String(text),cx.lastIndex=0,cx.test(text)&&(text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)}));if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,""))){j=eval("("+text+")");return typeof reviver=="function"?walk({"":j},""):j}throw new SyntaxError("JSON.parse")})}()


//     [*] Including lib/index.js
// Public object
var SockJS = (function(){
              var _document = document;
              var _window = window;
              var utils = {};


//         [*] Including lib/reventtarget.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

/* Simplified implementation of DOM2 EventTarget.
 *   http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-EventTarget
 */
var REventTarget = function() {};
REventTarget.prototype.addEventListener = function (eventType, listener) {
    if(!this._listeners) {
         this._listeners = {};
    }
    if(!(eventType in this._listeners)) {
        this._listeners[eventType] = [];
    }
    var arr = this._listeners[eventType];
    if(utils.arrIndexOf(arr, listener) === -1) {
        arr.push(listener);
    }
    return;
};

REventTarget.prototype.removeEventListener = function (eventType, listener) {
    if(!(this._listeners && (eventType in this._listeners))) {
        return;
    }
    var arr = this._listeners[eventType];
    var idx = utils.arrIndexOf(arr, listener);
    if (idx !== -1) {
        if(arr.length > 1) {
            this._listeners[eventType] = arr.slice(0, idx).concat( arr.slice(idx+1) );
        } else {
            delete this._listeners[eventType];
        }
        return;
    }
    return;
};

REventTarget.prototype.dispatchEvent = function (event) {
    var t = event.type;
    var args = Array.prototype.slice.call(arguments, 0);
    if (this['on'+t]) {
        this['on'+t].apply(this, args);
    }
    if (this._listeners && t in this._listeners) {
        for(var i=0; i < this._listeners[t].length; i++) {
            this._listeners[t][i].apply(this, args);
        }
    }
};
//         [*] End of lib/reventtarget.js


//         [*] Including lib/simpleevent.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var SimpleEvent = function(type, obj) {
    this.type = type;
    if (typeof obj !== 'undefined') {
        for(var k in obj) {
            if (!obj.hasOwnProperty(k)) continue;
            this[k] = obj[k];
        }
    }
};

SimpleEvent.prototype.toString = function() {
    var r = [];
    for(var k in this) {
        if (!this.hasOwnProperty(k)) continue;
        var v = this[k];
        if (typeof v === 'function') v = '[function]';
        r.push(k + '=' + v);
    }
    return 'SimpleEvent(' + r.join(', ') + ')';
};
//         [*] End of lib/simpleevent.js


//         [*] Including lib/eventemitter.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var EventEmitter = function(events) {
    this.events = events || [];
};
EventEmitter.prototype.emit = function(type) {
    var that = this;
    var args = Array.prototype.slice.call(arguments, 1);
    if (!that.nuked && that['on'+type]) {
        that['on'+type].apply(that, args);
    }
    if (utils.arrIndexOf(that.events, type) === -1) {
        utils.log('Event ' + JSON.stringify(type) +
                  ' not listed ' + JSON.stringify(that.events) +
                  ' in ' + that);
    }
};

EventEmitter.prototype.nuke = function(type) {
    var that = this;
    that.nuked = true;
    for(var i=0; i<that.events.length; i++) {
        delete that[that.events[i]];
    }
};
//         [*] End of lib/eventemitter.js


//         [*] Including lib/utils.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var random_string_chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
utils.random_string = function(length, max) {
    max = max || random_string_chars.length;
    var i, ret = [];
    for(i=0; i < length; i++) {
        ret.push( random_string_chars.substr(Math.floor(Math.random() * max),1) );
    }
    return ret.join('');
};
utils.random_number = function(max) {
    return Math.floor(Math.random() * max);
};
utils.random_number_string = function(max) {
    var t = (''+(max - 1)).length;
    var p = Array(t+1).join('0');
    return (p + utils.random_number(max)).slice(-t);
};

// Assuming that url looks like: http://asdasd:111/asd
utils.getOrigin = function(url) {
    url += '/';
    var parts = url.split('/').slice(0, 3);
    return parts.join('/');
};

utils.isSameOriginUrl = function(url_a, url_b) {
    // location.origin would do, but it's not always available.
    if (!url_b) url_b = _window.location.href;

    return (url_a.split('/').slice(0,3).join('/')
                ===
            url_b.split('/').slice(0,3).join('/'));
};

utils.getParentDomain = function(url) {
    // ipv4 ip address
    if (/^[0-9.]*$/.test(url)) return url;
    // ipv6 ip address
    if (/^\[/.test(url)) return url;
    // no dots
    if (!(/[.]/.test(url))) return url;

    var parts = url.split('.').slice(1);
    return parts.join('.');
};

utils.objectExtend = function(dst, src) {
    for(var k in src) {
        if (src.hasOwnProperty(k)) {
            dst[k] = src[k];
        }
    }
    return dst;
};

var WPrefix = '_jp';

utils.polluteGlobalNamespace = function() {
    if (!(WPrefix in _window)) {
        _window[WPrefix] = {};
    }
};

utils.closeFrame = function (code, reason) {
    return 'c'+JSON.stringify([code, reason]);
};

utils.userSetCode = function (code) {
    return code === 1000 || (code >= 3000 && code <= 4999);
};

// See: http://www.erg.abdn.ac.uk/~gerrit/dccp/notes/ccid2/rto_estimator/
// and RFC 2988.
utils.countRTO = function (rtt) {
    var rto;
    if (rtt > 100) {
        rto = 3 * rtt; // rto > 300msec
    } else {
        rto = rtt + 200; // 200msec < rto <= 300msec
    }
    return rto;
}

utils.log = function() {
    if (_window.console && console.log && console.log.apply) {
        console.log.apply(console, arguments);
    }
};

utils.bind = function(fun, that) {
    if (fun.bind) {
        return fun.bind(that);
    } else {
        return function() {
            return fun.apply(that, arguments);
        };
    }
};

utils.flatUrl = function(url) {
    return url.indexOf('?') === -1 && url.indexOf('#') === -1;
};

utils.amendUrl = function(url) {
    var dl = _document.location;
    if (!url) {
        throw new Error('Wrong url for SockJS');
    }
    if (!utils.flatUrl(url)) {
        throw new Error('Only basic urls are supported in SockJS');
    }

    //  '//abc' --> 'http://abc'
    if (url.indexOf('//') === 0) {
        url = dl.protocol + url;
    }
    // '/abc' --> 'http://localhost:80/abc'
    if (url.indexOf('/') === 0) {
        url = dl.protocol + '//' + dl.host + url;
    }
    // strip trailing slashes
    url = url.replace(/[/]+$/,'');
    return url;
};

// IE doesn't support [].indexOf.
utils.arrIndexOf = function(arr, obj){
    for(var i=0; i < arr.length; i++){
        if(arr[i] === obj){
            return i;
        }
    }
    return -1;
};

utils.arrSkip = function(arr, obj) {
    var idx = utils.arrIndexOf(arr, obj);
    if (idx === -1) {
        return arr.slice();
    } else {
        var dst = arr.slice(0, idx);
        return dst.concat(arr.slice(idx+1));
    }
};

// Via: https://gist.github.com/1133122/2121c601c5549155483f50be3da5305e83b8c5df
utils.isArray = Array.isArray || function(value) {
    return {}.toString.call(value).indexOf('Array') >= 0
};

utils.delay = function(t, fun) {
    if(typeof t === 'function') {
        fun = t;
        t = 0;
    }
    return setTimeout(fun, t);
};


// Chars worth escaping, as defined by Douglas Crockford:
//   https://github.com/douglascrockford/JSON-js/blob/47a9882cddeb1e8529e07af9736218075372b8ac/json2.js#L196
var json_escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    json_lookup = {
"\u0000":"\\u0000","\u0001":"\\u0001","\u0002":"\\u0002","\u0003":"\\u0003",
"\u0004":"\\u0004","\u0005":"\\u0005","\u0006":"\\u0006","\u0007":"\\u0007",
"\b":"\\b","\t":"\\t","\n":"\\n","\u000b":"\\u000b","\f":"\\f","\r":"\\r",
"\u000e":"\\u000e","\u000f":"\\u000f","\u0010":"\\u0010","\u0011":"\\u0011",
"\u0012":"\\u0012","\u0013":"\\u0013","\u0014":"\\u0014","\u0015":"\\u0015",
"\u0016":"\\u0016","\u0017":"\\u0017","\u0018":"\\u0018","\u0019":"\\u0019",
"\u001a":"\\u001a","\u001b":"\\u001b","\u001c":"\\u001c","\u001d":"\\u001d",
"\u001e":"\\u001e","\u001f":"\\u001f","\"":"\\\"","\\":"\\\\",
"\u007f":"\\u007f","\u0080":"\\u0080","\u0081":"\\u0081","\u0082":"\\u0082",
"\u0083":"\\u0083","\u0084":"\\u0084","\u0085":"\\u0085","\u0086":"\\u0086",
"\u0087":"\\u0087","\u0088":"\\u0088","\u0089":"\\u0089","\u008a":"\\u008a",
"\u008b":"\\u008b","\u008c":"\\u008c","\u008d":"\\u008d","\u008e":"\\u008e",
"\u008f":"\\u008f","\u0090":"\\u0090","\u0091":"\\u0091","\u0092":"\\u0092",
"\u0093":"\\u0093","\u0094":"\\u0094","\u0095":"\\u0095","\u0096":"\\u0096",
"\u0097":"\\u0097","\u0098":"\\u0098","\u0099":"\\u0099","\u009a":"\\u009a",
"\u009b":"\\u009b","\u009c":"\\u009c","\u009d":"\\u009d","\u009e":"\\u009e",
"\u009f":"\\u009f","\u00ad":"\\u00ad","\u0600":"\\u0600","\u0601":"\\u0601",
"\u0602":"\\u0602","\u0603":"\\u0603","\u0604":"\\u0604","\u070f":"\\u070f",
"\u17b4":"\\u17b4","\u17b5":"\\u17b5","\u200c":"\\u200c","\u200d":"\\u200d",
"\u200e":"\\u200e","\u200f":"\\u200f","\u2028":"\\u2028","\u2029":"\\u2029",
"\u202a":"\\u202a","\u202b":"\\u202b","\u202c":"\\u202c","\u202d":"\\u202d",
"\u202e":"\\u202e","\u202f":"\\u202f","\u2060":"\\u2060","\u2061":"\\u2061",
"\u2062":"\\u2062","\u2063":"\\u2063","\u2064":"\\u2064","\u2065":"\\u2065",
"\u2066":"\\u2066","\u2067":"\\u2067","\u2068":"\\u2068","\u2069":"\\u2069",
"\u206a":"\\u206a","\u206b":"\\u206b","\u206c":"\\u206c","\u206d":"\\u206d",
"\u206e":"\\u206e","\u206f":"\\u206f","\ufeff":"\\ufeff","\ufff0":"\\ufff0",
"\ufff1":"\\ufff1","\ufff2":"\\ufff2","\ufff3":"\\ufff3","\ufff4":"\\ufff4",
"\ufff5":"\\ufff5","\ufff6":"\\ufff6","\ufff7":"\\ufff7","\ufff8":"\\ufff8",
"\ufff9":"\\ufff9","\ufffa":"\\ufffa","\ufffb":"\\ufffb","\ufffc":"\\ufffc",
"\ufffd":"\\ufffd","\ufffe":"\\ufffe","\uffff":"\\uffff"};

// Some extra characters that Chrome gets wrong, and substitutes with
// something else on the wire.
var extra_escapable = /[\x00-\x1f\ud800-\udfff\ufffe\uffff\u0300-\u0333\u033d-\u0346\u034a-\u034c\u0350-\u0352\u0357-\u0358\u035c-\u0362\u0374\u037e\u0387\u0591-\u05af\u05c4\u0610-\u0617\u0653-\u0654\u0657-\u065b\u065d-\u065e\u06df-\u06e2\u06eb-\u06ec\u0730\u0732-\u0733\u0735-\u0736\u073a\u073d\u073f-\u0741\u0743\u0745\u0747\u07eb-\u07f1\u0951\u0958-\u095f\u09dc-\u09dd\u09df\u0a33\u0a36\u0a59-\u0a5b\u0a5e\u0b5c-\u0b5d\u0e38-\u0e39\u0f43\u0f4d\u0f52\u0f57\u0f5c\u0f69\u0f72-\u0f76\u0f78\u0f80-\u0f83\u0f93\u0f9d\u0fa2\u0fa7\u0fac\u0fb9\u1939-\u193a\u1a17\u1b6b\u1cda-\u1cdb\u1dc0-\u1dcf\u1dfc\u1dfe\u1f71\u1f73\u1f75\u1f77\u1f79\u1f7b\u1f7d\u1fbb\u1fbe\u1fc9\u1fcb\u1fd3\u1fdb\u1fe3\u1feb\u1fee-\u1fef\u1ff9\u1ffb\u1ffd\u2000-\u2001\u20d0-\u20d1\u20d4-\u20d7\u20e7-\u20e9\u2126\u212a-\u212b\u2329-\u232a\u2adc\u302b-\u302c\uaab2-\uaab3\uf900-\ufa0d\ufa10\ufa12\ufa15-\ufa1e\ufa20\ufa22\ufa25-\ufa26\ufa2a-\ufa2d\ufa30-\ufa6d\ufa70-\ufad9\ufb1d\ufb1f\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40-\ufb41\ufb43-\ufb44\ufb46-\ufb4e\ufff0-\uffff]/g,
    extra_lookup;

// JSON Quote string. Use native implementation when possible.
var JSONQuote = (JSON && JSON.stringify) || function(string) {
    json_escapable.lastIndex = 0;
    if (json_escapable.test(string)) {
        string = string.replace(json_escapable, function(a) {
            return json_lookup[a];
        });
    }
    return '"' + string + '"';
};

// This may be quite slow, so let's delay until user actually uses bad
// characters.
var unroll_lookup = function(escapable) {
    var i;
    var unrolled = {}
    var c = []
    for(i=0; i<65536; i++) {
        c.push( String.fromCharCode(i) );
    }
    escapable.lastIndex = 0;
    c.join('').replace(escapable, function (a) {
        unrolled[ a ] = '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        return '';
    });
    escapable.lastIndex = 0;
    return unrolled;
};

// Quote string, also taking care of unicode characters that browsers
// often break. Especially, take care of unicode surrogates:
//    http://en.wikipedia.org/wiki/Mapping_of_Unicode_characters#Surrogates
utils.quote = function(string) {
    var quoted = JSONQuote(string);

    // In most cases this should be very fast and good enough.
    extra_escapable.lastIndex = 0;
    if(!extra_escapable.test(quoted)) {
        return quoted;
    }

    if(!extra_lookup) extra_lookup = unroll_lookup(extra_escapable);

    return quoted.replace(extra_escapable, function(a) {
        return extra_lookup[a];
    });
}

var _all_protocols = ['websocket',
                      'xdr-streaming',
                      'xhr-streaming',
                      'iframe-eventsource',
                      'iframe-htmlfile',
                      'xdr-polling',
                      'xhr-polling',
                      'iframe-xhr-polling',
                      'jsonp-polling'];

utils.probeProtocols = function() {
    var probed = {};
    for(var i=0; i<_all_protocols.length; i++) {
        var protocol = _all_protocols[i];
        // User can have a typo in protocol name.
        probed[protocol] = SockJS[protocol] &&
                           SockJS[protocol].enabled();
    }
    return probed;
};

utils.detectProtocols = function(probed, protocols_whitelist, info) {
    var pe = {},
        protocols = [];
    if (!protocols_whitelist) protocols_whitelist = _all_protocols;
    for(var i=0; i<protocols_whitelist.length; i++) {
        var protocol = protocols_whitelist[i];
        pe[protocol] = probed[protocol];
    }
    var maybe_push = function(protos) {
        var proto = protos.shift();
        if (pe[proto]) {
            protocols.push(proto);
        } else {
            if (protos.length > 0) {
                maybe_push(protos);
            }
        }
    }

    // 1. Websocket
    if (info.websocket !== false) {
        maybe_push(['websocket']);
    }

    // 2. Streaming
    if (pe['xhr-streaming'] && !info.null_origin) {
        protocols.push('xhr-streaming');
    } else {
        if (pe['xdr-streaming'] && !info.cookie_needed && !info.null_origin) {
            protocols.push('xdr-streaming');
        } else {
            maybe_push(['iframe-eventsource',
                        'iframe-htmlfile']);
        }
    }

    // 3. Polling
    if (pe['xhr-polling'] && !info.null_origin) {
        protocols.push('xhr-polling');
    } else {
        if (pe['xdr-polling'] && !info.cookie_needed && !info.null_origin) {
            protocols.push('xdr-polling');
        } else {
            maybe_push(['iframe-xhr-polling',
                        'jsonp-polling']);
        }
    }
    return protocols;
}
//         [*] End of lib/utils.js


//         [*] Including lib/dom.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

// May be used by htmlfile jsonp and transports.
var MPrefix = '_sockjs_global';
utils.createHook = function() {
    var window_id = 'a' + utils.random_string(8);
    if (!(MPrefix in _window)) {
        var map = {};
        _window[MPrefix] = function(window_id) {
            if (!(window_id in map)) {
                map[window_id] = {
                    id: window_id,
                    del: function() {delete map[window_id];}
                };
            }
            return map[window_id];
        }
    }
    return _window[MPrefix](window_id);
};



utils.attachMessage = function(listener) {
    utils.attachEvent('message', listener);
};
utils.attachEvent = function(event, listener) {
    if (typeof _window.addEventListener !== 'undefined') {
        _window.addEventListener(event, listener, false);
    } else {
        // IE quirks.
        // According to: http://stevesouders.com/misc/test-postmessage.php
        // the message gets delivered only to 'document', not 'window'.
        _document.attachEvent("on" + event, listener);
        // I get 'window' for ie8.
        _window.attachEvent("on" + event, listener);
    }
};

utils.detachMessage = function(listener) {
    utils.detachEvent('message', listener);
};
utils.detachEvent = function(event, listener) {
    if (typeof _window.addEventListener !== 'undefined') {
        _window.removeEventListener(event, listener, false);
    } else {
        _document.detachEvent("on" + event, listener);
        _window.detachEvent("on" + event, listener);
    }
};


var on_unload = {};
// Things registered after beforeunload are to be called immediately.
var after_unload = false;

var trigger_unload_callbacks = function() {
    for(var ref in on_unload) {
        on_unload[ref]();
        delete on_unload[ref];
    };
};

var unload_triggered = function() {
    if(after_unload) return;
    after_unload = true;
    trigger_unload_callbacks();
};

// Onbeforeunload alone is not reliable. We could use only 'unload'
// but it's not working in opera within an iframe. Let's use both.
utils.attachEvent('beforeunload', unload_triggered);
utils.attachEvent('unload', unload_triggered);

utils.unload_add = function(listener) {
    var ref = utils.random_string(8);
    on_unload[ref] = listener;
    if (after_unload) {
        utils.delay(trigger_unload_callbacks);
    }
    return ref;
};
utils.unload_del = function(ref) {
    if (ref in on_unload)
        delete on_unload[ref];
};


utils.createIframe = function (iframe_url, error_callback) {
    var iframe = _document.createElement('iframe');
    var tref, unload_ref;
    var unattach = function() {
        clearTimeout(tref);
        // Explorer had problems with that.
        try {iframe.onload = null;} catch (x) {}
        iframe.onerror = null;
    };
    var cleanup = function() {
        if (iframe) {
            unattach();
            // This timeout makes chrome fire onbeforeunload event
            // within iframe. Without the timeout it goes straight to
            // onunload.
            setTimeout(function() {
                if(iframe) {
                    iframe.parentNode.removeChild(iframe);
                }
                iframe = null;
            }, 0);
            utils.unload_del(unload_ref);
        }
    };
    var onerror = function(r) {
        if (iframe) {
            cleanup();
            error_callback(r);
        }
    };
    var post = function(msg, origin) {
        try {
            // When the iframe is not loaded, IE raises an exception
            // on 'contentWindow'.
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(msg, origin);
            }
        } catch (x) {};
    };

    iframe.src = iframe_url;
    iframe.style.display = 'none';
    iframe.style.position = 'absolute';
    iframe.onerror = function(){onerror('onerror');};
    iframe.onload = function() {
        // `onload` is triggered before scripts on the iframe are
        // executed. Give it few seconds to actually load stuff.
        clearTimeout(tref);
        tref = setTimeout(function(){onerror('onload timeout');}, 2000);
    };
    _document.body.appendChild(iframe);
    tref = setTimeout(function(){onerror('timeout');}, 15000);
    unload_ref = utils.unload_add(cleanup);
    return {
        post: post,
        cleanup: cleanup,
        loaded: unattach
    };
};

utils.createHtmlfile = function (iframe_url, error_callback) {
    var doc = new ActiveXObject('htmlfile');
    var tref, unload_ref;
    var iframe;
    var unattach = function() {
        clearTimeout(tref);
    };
    var cleanup = function() {
        if (doc) {
            unattach();
            utils.unload_del(unload_ref);
            iframe.parentNode.removeChild(iframe);
            iframe = doc = null;
            CollectGarbage();
        }
    };
    var onerror = function(r)  {
        if (doc) {
            cleanup();
            error_callback(r);
        }
    };
    var post = function(msg, origin) {
        try {
            // When the iframe is not loaded, IE raises an exception
            // on 'contentWindow'.
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage(msg, origin);
            }
        } catch (x) {};
    };

    doc.open();
    doc.write('<html><s' + 'cript>' +
              'document.domain="' + document.domain + '";' +
              '</s' + 'cript></html>');
    doc.close();
    doc.parentWindow[WPrefix] = _window[WPrefix];
    var c = doc.createElement('div');
    doc.body.appendChild(c);
    iframe = doc.createElement('iframe');
    c.appendChild(iframe);
    iframe.src = iframe_url;
    tref = setTimeout(function(){onerror('timeout');}, 15000);
    unload_ref = utils.unload_add(cleanup);
    return {
        post: post,
        cleanup: cleanup,
        loaded: unattach
    };
};
//         [*] End of lib/dom.js


//         [*] Including lib/dom2.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var AbstractXHRObject = function(){};
AbstractXHRObject.prototype = new EventEmitter(['chunk', 'finish']);

AbstractXHRObject.prototype._start = function(method, url, payload, opts) {
    var that = this;

    try {
        that.xhr = new XMLHttpRequest();
    } catch(x) {};

    if (!that.xhr) {
        try {
            that.xhr = new _window.ActiveXObject('Microsoft.XMLHTTP');
        } catch(x) {};
    }
    if (_window.ActiveXObject || _window.XDomainRequest) {
        // IE8 caches even POSTs
        url += ((url.indexOf('?') === -1) ? '?' : '&') + 't='+(+new Date);
    }

    // Explorer tends to keep connection open, even after the
    // tab gets closed: http://bugs.jquery.com/ticket/5280
    that.unload_ref = utils.unload_add(function(){that._cleanup(true);});
    try {
        that.xhr.open(method, url, true);
    } catch(e) {
        // IE raises an exception on wrong port.
        that.emit('finish', 0, '');
        that._cleanup();
        return;
    };

    if (!opts || !opts.no_credentials) {
        // Mozilla docs says https://developer.mozilla.org/en/XMLHttpRequest :
        // "This never affects same-site requests."
        that.xhr.withCredentials = 'true';
    }
    if (opts && opts.headers) {
        for(var key in opts.headers) {
            that.xhr.setRequestHeader(key, opts.headers[key]);
        }
    }

    that.xhr.onreadystatechange = function() {
        if (that.xhr) {
            var x = that.xhr;
            switch (x.readyState) {
            case 3:
                // IE doesn't like peeking into responseText or status
                // on Microsoft.XMLHTTP and readystate=3
                try {
                    var status = x.status;
                    var text = x.responseText;
                } catch (x) {};
                // IE does return readystate == 3 for 404 answers.
                if (text && text.length > 0) {
                    that.emit('chunk', status, text);
                }
                break;
            case 4:
                that.emit('finish', x.status, x.responseText);
                that._cleanup(false);
                break;
            }
        }
    };
    that.xhr.send(payload);
};

AbstractXHRObject.prototype._cleanup = function(abort) {
    var that = this;
    if (!that.xhr) return;
    utils.unload_del(that.unload_ref);

    // IE needs this field to be a function
    that.xhr.onreadystatechange = function(){};

    if (abort) {
        try {
            that.xhr.abort();
        } catch(x) {};
    }
    that.unload_ref = that.xhr = null;
};

AbstractXHRObject.prototype.close = function() {
    var that = this;
    that.nuke();
    that._cleanup(true);
};

var XHRCorsObject = utils.XHRCorsObject = function() {
    var that = this, args = arguments;
    utils.delay(function(){that._start.apply(that, args);});
};
XHRCorsObject.prototype = new AbstractXHRObject();

var XHRLocalObject = utils.XHRLocalObject = function(method, url, payload) {
    var that = this;
    utils.delay(function(){
        that._start(method, url, payload, {
            no_credentials: true
        });
    });
};
XHRLocalObject.prototype = new AbstractXHRObject();



// References:
//   http://ajaxian.com/archives/100-line-ajax-wrapper
//   http://msdn.microsoft.com/en-us/library/cc288060(v=VS.85).aspx
var XDRObject = utils.XDRObject = function(method, url, payload) {
    var that = this;
    utils.delay(function(){that._start(method, url, payload);});
};
XDRObject.prototype = new EventEmitter(['chunk', 'finish']);
XDRObject.prototype._start = function(method, url, payload) {
    var that = this;
    var xdr = new XDomainRequest();
    // IE caches even POSTs
    url += ((url.indexOf('?') === -1) ? '?' : '&') + 't='+(+new Date);

    var onerror = xdr.ontimeout = xdr.onerror = function() {
        that.emit('finish', 0, '');
        that._cleanup(false);
    };
    xdr.onprogress = function() {
        that.emit('chunk', 200, xdr.responseText);
    };
    xdr.onload = function() {
        that.emit('finish', 200, xdr.responseText);
        that._cleanup(false);
    };
    that.xdr = xdr;
    that.unload_ref = utils.unload_add(function(){that._cleanup(true);});
    try {
        // Fails with AccessDenied if port number is bogus
        that.xdr.open(method, url);
        that.xdr.send(payload);
    } catch(x) {
        onerror();
    }
};

XDRObject.prototype._cleanup = function(abort) {
    var that = this;
    if (!that.xdr) return;
    utils.unload_del(that.unload_ref);

    that.xdr.ontimeout = that.xdr.onerror = that.xdr.onprogress =
        that.xdr.onload = null;
    if (abort) {
        try {
            that.xdr.abort();
        } catch(x) {};
    }
    that.unload_ref = that.xdr = null;
};

XDRObject.prototype.close = function() {
    var that = this;
    that.nuke();
    that._cleanup(true);
};

// 1. Is natively via XHR
// 2. Is natively via XDR
// 3. Nope, but postMessage is there so it should work via the Iframe.
// 4. Nope, sorry.
utils.isXHRCorsCapable = function() {
    if (_window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest()) {
        return 1;
    }
    // XDomainRequest doesn't work if page is served from file://
    if (_window.XDomainRequest && _document.domain) {
        return 2;
    }
    if (IframeTransport.enabled()) {
        return 3;
    }
    return 4;
};
//         [*] End of lib/dom2.js


//         [*] Including lib/sockjs.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var SockJS = function(url, dep_protocols_whitelist, options) {
    if (this === window) {
        // makes `new` optional
        return new SockJS(url, dep_protocols_whitelist, options);
    }
    
    var that = this, protocols_whitelist;
    that._options = {devel: false, debug: false, protocols_whitelist: [],
                     info: undefined, rtt: undefined};
    if (options) {
        utils.objectExtend(that._options, options);
    }
    that._base_url = utils.amendUrl(url);
    that._server = that._options.server || utils.random_number_string(1000);
    if (that._options.protocols_whitelist &&
        that._options.protocols_whitelist.length) {
        protocols_whitelist = that._options.protocols_whitelist;
    } else {
        // Deprecated API
        if (typeof dep_protocols_whitelist === 'string' &&
            dep_protocols_whitelist.length > 0) {
            protocols_whitelist = [dep_protocols_whitelist];
        } else if (utils.isArray(dep_protocols_whitelist)) {
            protocols_whitelist = dep_protocols_whitelist
        } else {
            protocols_whitelist = null;
        }
        if (protocols_whitelist) {
            that._debug('Deprecated API: Use "protocols_whitelist" option ' +
                        'instead of supplying protocol list as a second ' +
                        'parameter to SockJS constructor.');
        }
    }
    that._protocols = [];
    that.protocol = null;
    that.readyState = SockJS.CONNECTING;
    that._ir = createInfoReceiver(that._base_url);
    that._ir.onfinish = function(info, rtt) {
        that._ir = null;
        if (info) {
            if (that._options.info) {
                // Override if user supplies the option
                info = utils.objectExtend(info, that._options.info);
            }
            if (that._options.rtt) {
                rtt = that._options.rtt;
            }
            that._applyInfo(info, rtt, protocols_whitelist);
            that._didClose();
        } else {
            that._didClose(1002, 'Can\'t connect to server', true);
        }
    };
};
// Inheritance
SockJS.prototype = new REventTarget();

SockJS.version = "0.3.1.7.ga67f.dirty";

SockJS.CONNECTING = 0;
SockJS.OPEN = 1;
SockJS.CLOSING = 2;
SockJS.CLOSED = 3;

SockJS.prototype._debug = function() {
    if (this._options.debug)
        utils.log.apply(utils, arguments);
};

SockJS.prototype._dispatchOpen = function() {
    var that = this;
    if (that.readyState === SockJS.CONNECTING) {
        if (that._transport_tref) {
            clearTimeout(that._transport_tref);
            that._transport_tref = null;
        }
        that.readyState = SockJS.OPEN;
        that.dispatchEvent(new SimpleEvent("open"));
    } else {
        // The server might have been restarted, and lost track of our
        // connection.
        that._didClose(1006, "Server lost session");
    }
};

SockJS.prototype._dispatchMessage = function(data) {
    var that = this;
    if (that.readyState !== SockJS.OPEN)
            return;
    that.dispatchEvent(new SimpleEvent("message", {data: data}));
};

SockJS.prototype._dispatchHeartbeat = function(data) {
    var that = this;
    if (that.readyState !== SockJS.OPEN)
        return;
    that.dispatchEvent(new SimpleEvent('heartbeat', {}));
};

SockJS.prototype._didClose = function(code, reason, force) {
    var that = this;
    if (that.readyState !== SockJS.CONNECTING &&
        that.readyState !== SockJS.OPEN &&
        that.readyState !== SockJS.CLOSING)
            throw new Error('INVALID_STATE_ERR');
    if (that._ir) {
        that._ir.nuke();
        that._ir = null;
    }

    if (that._transport) {
        that._transport.doCleanup();
        that._transport = null;
    }

    var close_event = new SimpleEvent("close", {
        code: code,
        reason: reason,
        wasClean: utils.userSetCode(code)});

    if (!utils.userSetCode(code) &&
        that.readyState === SockJS.CONNECTING && !force) {
        if (that._try_next_protocol(close_event)) {
            return;
        }
        close_event = new SimpleEvent("close", {code: 2000,
                                                reason: "All transports failed",
                                                wasClean: false,
                                                last_event: close_event});
    }
    that.readyState = SockJS.CLOSED;

    utils.delay(function() {
                   that.dispatchEvent(close_event);
                });
};

SockJS.prototype._didMessage = function(data) {
    var that = this;
    var type = data.slice(0, 1);
    switch(type) {
    case 'o':
        that._dispatchOpen();
        break;
    case 'a':
        var payload = JSON.parse(data.slice(1) || '[]');
        for(var i=0; i < payload.length; i++){
            that._dispatchMessage(payload[i]);
        }
        break;
    case 'm':
        var payload = JSON.parse(data.slice(1) || 'null');
        that._dispatchMessage(payload);
        break;
    case 'c':
        var payload = JSON.parse(data.slice(1) || '[]');
        that._didClose(payload[0], payload[1]);
        break;
    case 'h':
        that._dispatchHeartbeat();
        break;
    }
};

SockJS.prototype._try_next_protocol = function(close_event) {
    var that = this;
    if (that.protocol) {
        that._debug('Closed transport:', that.protocol, ''+close_event);
        that.protocol = null;
    }
    if (that._transport_tref) {
        clearTimeout(that._transport_tref);
        that._transport_tref = null;
    }

    while(1) {
        var protocol = that.protocol = that._protocols.shift();
        if (!protocol) {
            return false;
        }
        // Some protocols require access to `body`, what if were in
        // the `head`?
        if (SockJS[protocol] &&
            SockJS[protocol].need_body === true &&
            (!_document.body ||
             (typeof _document.readyState !== 'undefined'
              && _document.readyState !== 'complete'))) {
            that._protocols.unshift(protocol);
            that.protocol = 'waiting-for-load';
            utils.attachEvent('load', function(){
                that._try_next_protocol();
            });
            return true;
        }

        if (!SockJS[protocol] ||
              !SockJS[protocol].enabled(that._options)) {
            that._debug('Skipping transport:', protocol);
        } else {
            var roundTrips = SockJS[protocol].roundTrips || 1;
            var to = ((that._options.rto || 0) * roundTrips) || 5000;
            that._transport_tref = utils.delay(to, function() {
                if (that.readyState === SockJS.CONNECTING) {
                    // I can't understand how it is possible to run
                    // this timer, when the state is CLOSED, but
                    // apparently in IE everythin is possible.
                    that._didClose(2007, "Transport timeouted");
                }
            });

            var connid = utils.random_string(8);
            var trans_url = that._base_url + '/' + that._server + '/' + connid;
            that._debug('Opening transport:', protocol, ' url:'+trans_url,
                        ' RTO:'+that._options.rto);
            that._transport = new SockJS[protocol](that, trans_url,
                                                   that._base_url);
            return true;
        }
    }
};

SockJS.prototype.close = function(code, reason) {
    var that = this;
    if (code && !utils.userSetCode(code))
        throw new Error("INVALID_ACCESS_ERR");
    if(that.readyState !== SockJS.CONNECTING &&
       that.readyState !== SockJS.OPEN) {
        return false;
    }
    that.readyState = SockJS.CLOSING;
    that._didClose(code || 1000, reason || "Normal closure");
    return true;
};

SockJS.prototype.send = function(data) {
    var that = this;
    if (that.readyState === SockJS.CONNECTING)
        throw new Error('INVALID_STATE_ERR');
    if (that.readyState === SockJS.OPEN) {
        that._transport.doSend(utils.quote('' + data));
    }
    return true;
};

SockJS.prototype._applyInfo = function(info, rtt, protocols_whitelist) {
    var that = this;
    that._options.info = info;
    that._options.rtt = rtt;
    that._options.rto = utils.countRTO(rtt);
    that._options.info.null_origin = !_document.domain;
    var probed = utils.probeProtocols();
    that._protocols = utils.detectProtocols(probed, protocols_whitelist, info);
};
//         [*] End of lib/sockjs.js


//         [*] Including lib/trans-websocket.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var WebSocketTransport = SockJS.websocket = function(ri, trans_url) {
    var that = this;
    var url = trans_url + '/websocket';
    if (url.slice(0, 5) === 'https') {
        url = 'wss' + url.slice(5);
    } else {
        url = 'ws' + url.slice(4);
    }
    that.ri = ri;
    that.url = url;
    var Constructor = _window.WebSocket || _window.MozWebSocket;

    that.ws = new Constructor(that.url);
    that.ws.onmessage = function(e) {
        that.ri._didMessage(e.data);
    };
    // Firefox has an interesting bug. If a websocket connection is
    // created after onbeforeunload, it stays alive even when user
    // navigates away from the page. In such situation let's lie -
    // let's not open the ws connection at all. See:
    // https://github.com/sockjs/sockjs-client/issues/28
    // https://bugzilla.mozilla.org/show_bug.cgi?id=696085
    that.unload_ref = utils.unload_add(function(){that.ws.close()});
    that.ws.onclose = function() {
        that.ri._didMessage(utils.closeFrame(1006, "WebSocket connection broken"));
    };
};

WebSocketTransport.prototype.doSend = function(data) {
    this.ws.send('[' + data + ']');
};

WebSocketTransport.prototype.doCleanup = function() {
    var that = this;
    var ws = that.ws;
    if (ws) {
        ws.onmessage = ws.onclose = null;
        ws.close();
        utils.unload_del(that.unload_ref);
        that.unload_ref = that.ri = that.ws = null;
    }
};

WebSocketTransport.enabled = function() {
    return !!(_window.WebSocket || _window.MozWebSocket);
};

// In theory, ws should require 1 round trip. But in chrome, this is
// not very stable over SSL. Most likely a ws connection requires a
// separate SSL connection, in which case 2 round trips are an
// absolute minumum.
WebSocketTransport.roundTrips = 2;
//         [*] End of lib/trans-websocket.js


//         [*] Including lib/trans-sender.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var BufferedSender = function() {};
BufferedSender.prototype.send_constructor = function(sender) {
    var that = this;
    that.send_buffer = [];
    that.sender = sender;
};
BufferedSender.prototype.doSend = function(message) {
    var that = this;
    that.send_buffer.push(message);
    if (!that.send_stop) {
        that.send_schedule();
    }
};

// For polling transports in a situation when in the message callback,
// new message is being send. If the sending connection was started
// before receiving one, it is possible to saturate the network and
// timeout due to the lack of receiving socket. To avoid that we delay
// sending messages by some small time, in order to let receiving
// connection be started beforehand. This is only a halfmeasure and
// does not fix the big problem, but it does make the tests go more
// stable on slow networks.
BufferedSender.prototype.send_schedule_wait = function() {
    var that = this;
    var tref;
    that.send_stop = function() {
        that.send_stop = null;
        clearTimeout(tref);
    };
    tref = utils.delay(25, function() {
        that.send_stop = null;
        that.send_schedule();
    });
};

BufferedSender.prototype.send_schedule = function() {
    var that = this;
    if (that.send_buffer.length > 0) {
        var payload = '[' + that.send_buffer.join(',') + ']';
        that.send_stop = that.sender(that.trans_url,
                                     payload,
                                     function() {
                                         that.send_stop = null;
                                         that.send_schedule_wait();
                                     });
        that.send_buffer = [];
    }
};

BufferedSender.prototype.send_destructor = function() {
    var that = this;
    if (that._send_stop) {
        that._send_stop();
    }
    that._send_stop = null;
};

var jsonPGenericSender = function(url, payload, callback) {
    var that = this;

    if (!('_send_form' in that)) {
        var form = that._send_form = _document.createElement('form');
        var area = that._send_area = _document.createElement('textarea');
        area.name = 'd';
        form.style.display = 'none';
        form.style.position = 'absolute';
        form.method = 'POST';
        form.enctype = 'application/x-www-form-urlencoded';
        form.acceptCharset = "UTF-8";
        form.appendChild(area);
        _document.body.appendChild(form);
    }
    var form = that._send_form;
    var area = that._send_area;
    var id = 'a' + utils.random_string(8);
    form.target = id;
    form.action = url + '/jsonp_send?i=' + id;

    var iframe;
    try {
        // ie6 dynamic iframes with target="" support (thanks Chris Lambacher)
        iframe = _document.createElement('<iframe name="'+ id +'">');
    } catch(x) {
        iframe = _document.createElement('iframe');
        iframe.name = id;
    }
    iframe.id = id;
    form.appendChild(iframe);
    iframe.style.display = 'none';

    try {
        area.value = payload;
    } catch(e) {
        utils.log('Your browser is seriously broken. Go home! ' + e.message);
    }
    form.submit();

    var completed = function(e) {
        if (!iframe.onerror) return;
        iframe.onreadystatechange = iframe.onerror = iframe.onload = null;
        // Opera mini doesn't like if we GC iframe
        // immediately, thus this timeout.
        utils.delay(500, function() {
                       iframe.parentNode.removeChild(iframe);
                       iframe = null;
                   });
        area.value = '';
        callback();
    };
    iframe.onerror = iframe.onload = completed;
    iframe.onreadystatechange = function(e) {
        if (iframe.readyState == 'complete') completed();
    };
    return completed;
};

var createAjaxSender = function(AjaxObject) {
    return function(url, payload, callback) {
        var xo = new AjaxObject('POST', url + '/xhr_send', payload);
        xo.onfinish = function(status, text) {
            callback(status);
        };
        return function(abort_reason) {
            callback(0, abort_reason);
        };
    };
};
//         [*] End of lib/trans-sender.js


//         [*] Including lib/trans-jsonp-receiver.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

// Parts derived from Socket.io:
//    https://github.com/LearnBoost/socket.io/blob/0.6.17/lib/socket.io/transports/jsonp-polling.js
// and jQuery-JSONP:
//    https://code.google.com/p/jquery-jsonp/source/browse/trunk/core/jquery.jsonp.js
var jsonPGenericReceiver = function(url, callback) {
    var tref;
    var script = _document.createElement('script');
    var script2;  // Opera synchronous load trick.
    var close_script = function(frame) {
        if (script2) {
            script2.parentNode.removeChild(script2);
            script2 = null;
        }
        if (script) {
            clearTimeout(tref);
            script.parentNode.removeChild(script);
            script.onreadystatechange = script.onerror =
                script.onload = script.onclick = null;
            script = null;
            callback(frame);
            callback = null;
        }
    };

    // IE9 fires 'error' event after orsc or before, in random order.
    var loaded_okay = false;
    var error_timer = null;

    script.id = 'a' + utils.random_string(8);
    script.src = url;
    script.type = 'text/javascript';
    script.charset = 'UTF-8';
    script.onerror = function(e) {
        if (!error_timer) {
            // Delay firing close_script.
            error_timer = setTimeout(function() {
                if (!loaded_okay) {
                    close_script(utils.closeFrame(
                        1006,
                        "JSONP script loaded abnormally (onerror)"));
                }
            }, 1000);
        }
    };
    script.onload = function(e) {
        close_script(utils.closeFrame(1006, "JSONP script loaded abnormally (onload)"));
    };

    script.onreadystatechange = function(e) {
        if (/loaded|closed/.test(script.readyState)) {
            if (script && script.htmlFor && script.onclick) {
                loaded_okay = true;
                try {
                    // In IE, actually execute the script.
                    script.onclick();
                } catch (x) {}
            }
            if (script) {
                close_script(utils.closeFrame(1006, "JSONP script loaded abnormally (onreadystatechange)"));
            }
        }
    };
    // IE: event/htmlFor/onclick trick.
    // One can't rely on proper order for onreadystatechange. In order to
    // make sure, set a 'htmlFor' and 'event' properties, so that
    // script code will be installed as 'onclick' handler for the
    // script object. Later, onreadystatechange, manually execute this
    // code. FF and Chrome doesn't work with 'event' and 'htmlFor'
    // set. For reference see:
    //   http://jaubourg.net/2010/07/loading-script-as-onclick-handler-of.html
    // Also, read on that about script ordering:
    //   http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
    if (typeof script.async === 'undefined' && _document.attachEvent) {
        // According to mozilla docs, in recent browsers script.async defaults
        // to 'true', so we may use it to detect a good browser:
        // https://developer.mozilla.org/en/HTML/Element/script
        if (!/opera/i.test(navigator.userAgent)) {
            // Naively assume we're in IE
            try {
                script.htmlFor = script.id;
                script.event = "onclick";
            } catch (x) {}
            script.async = true;
        } else {
            // Opera, second sync script hack
            script2 = _document.createElement('script');
            script2.text = "try{var a = document.getElementById('"+script.id+"'); if(a)a.onerror();}catch(x){};";
            script.async = script2.async = false;
        }
    }
    if (typeof script.async !== 'undefined') {
        script.async = true;
    }

    // Fallback mostly for Konqueror - stupid timer, 35 seconds shall be plenty.
    tref = setTimeout(function() {
                          close_script(utils.closeFrame(1006, "JSONP script loaded abnormally (timeout)"));
                      }, 35000);

    var head = _document.getElementsByTagName('head')[0];
    head.insertBefore(script, head.firstChild);
    if (script2) {
        head.insertBefore(script2, head.firstChild);
    }
    return close_script;
};
//         [*] End of lib/trans-jsonp-receiver.js


//         [*] Including lib/trans-jsonp-polling.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

// The simplest and most robust transport, using the well-know cross
// domain hack - JSONP. This transport is quite inefficient - one
// mssage could use up to one http request. But at least it works almost
// everywhere.
// Known limitations:
//   o you will get a spinning cursor
//   o for Konqueror a dumb timer is needed to detect errors


var JsonPTransport = SockJS['jsonp-polling'] = function(ri, trans_url) {
    utils.polluteGlobalNamespace();
    var that = this;
    that.ri = ri;
    that.trans_url = trans_url;
    that.send_constructor(jsonPGenericSender);
    that._schedule_recv();
};

// Inheritnace
JsonPTransport.prototype = new BufferedSender();

JsonPTransport.prototype._schedule_recv = function() {
    var that = this;
    var callback = function(data) {
        that._recv_stop = null;
        if (data) {
            // no data - heartbeat;
            if (!that._is_closing) {
                that.ri._didMessage(data);
            }
        }
        // The message can be a close message, and change is_closing state.
        if (!that._is_closing) {
            that._schedule_recv();
        }
    };
    that._recv_stop = jsonPReceiverWrapper(that.trans_url + '/jsonp',
                                           jsonPGenericReceiver, callback);
};

JsonPTransport.enabled = function() {
    return true;
};

JsonPTransport.need_body = true;


JsonPTransport.prototype.doCleanup = function() {
    var that = this;
    that._is_closing = true;
    if (that._recv_stop) {
        that._recv_stop();
    }
    that.ri = that._recv_stop = null;
    that.send_destructor();
};


// Abstract away code that handles global namespace pollution.
var jsonPReceiverWrapper = function(url, constructReceiver, user_callback) {
    var id = 'a' + utils.random_string(6);
    var url_id = url + '?c=' + escape(WPrefix + '.' + id);
    // Callback will be called exactly once.
    var callback = function(frame) {
        delete _window[WPrefix][id];
        user_callback(frame);
    };

    var close_script = constructReceiver(url_id, callback);
    _window[WPrefix][id] = close_script;
    var stop = function() {
        if (_window[WPrefix][id]) {
            _window[WPrefix][id](utils.closeFrame(1000, "JSONP user aborted read"));
        }
    };
    return stop;
};
//         [*] End of lib/trans-jsonp-polling.js


//         [*] Including lib/trans-xhr.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var AjaxBasedTransport = function() {};
AjaxBasedTransport.prototype = new BufferedSender();

AjaxBasedTransport.prototype.run = function(ri, trans_url,
                                            url_suffix, Receiver, AjaxObject) {
    var that = this;
    that.ri = ri;
    that.trans_url = trans_url;
    that.send_constructor(createAjaxSender(AjaxObject));
    that.poll = new Polling(ri, Receiver,
                            trans_url + url_suffix, AjaxObject);
};

AjaxBasedTransport.prototype.doCleanup = function() {
    var that = this;
    if (that.poll) {
        that.poll.abort();
        that.poll = null;
    }
};

// xhr-streaming
var XhrStreamingTransport = SockJS['xhr-streaming'] = function(ri, trans_url) {
    this.run(ri, trans_url, '/xhr_streaming', XhrReceiver, utils.XHRCorsObject);
};

XhrStreamingTransport.prototype = new AjaxBasedTransport();

XhrStreamingTransport.enabled = function() {
    // Support for CORS Ajax aka Ajax2? Opera 12 claims CORS but
    // doesn't do streaming.
    return (_window.XMLHttpRequest &&
            'withCredentials' in new XMLHttpRequest() &&
            (!/opera/i.test(navigator.userAgent)));
};
XhrStreamingTransport.roundTrips = 2; // preflight, ajax

// Safari gets confused when a streaming ajax request is started
// before onload. This causes the load indicator to spin indefinetely.
XhrStreamingTransport.need_body = true;


// According to:
//   http://stackoverflow.com/questions/1641507/detect-browser-support-for-cross-domain-xmlhttprequests
//   http://hacks.mozilla.org/2009/07/cross-site-xmlhttprequest-with-cors/


// xdr-streaming
var XdrStreamingTransport = SockJS['xdr-streaming'] = function(ri, trans_url) {
    this.run(ri, trans_url, '/xhr_streaming', XhrReceiver, utils.XDRObject);
};

XdrStreamingTransport.prototype = new AjaxBasedTransport();

XdrStreamingTransport.enabled = function() {
    return !!_window.XDomainRequest;
};
XdrStreamingTransport.roundTrips = 2; // preflight, ajax



// xhr-polling
var XhrPollingTransport = SockJS['xhr-polling'] = function(ri, trans_url) {
    this.run(ri, trans_url, '/xhr', XhrReceiver, utils.XHRCorsObject);
};

XhrPollingTransport.prototype = new AjaxBasedTransport();

XhrPollingTransport.enabled = XhrStreamingTransport.enabled;
XhrPollingTransport.roundTrips = 2; // preflight, ajax


// xdr-polling
var XdrPollingTransport = SockJS['xdr-polling'] = function(ri, trans_url) {
    this.run(ri, trans_url, '/xhr', XhrReceiver, utils.XDRObject);
};

XdrPollingTransport.prototype = new AjaxBasedTransport();

XdrPollingTransport.enabled = XdrStreamingTransport.enabled;
XdrPollingTransport.roundTrips = 2; // preflight, ajax
//         [*] End of lib/trans-xhr.js


//         [*] Including lib/trans-iframe.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

// Few cool transports do work only for same-origin. In order to make
// them working cross-domain we shall use iframe, served form the
// remote domain. New browsers, have capabilities to communicate with
// cross domain iframe, using postMessage(). In IE it was implemented
// from IE 8+, but of course, IE got some details wrong:
//    http://msdn.microsoft.com/en-us/library/cc197015(v=VS.85).aspx
//    http://stevesouders.com/misc/test-postmessage.php

var IframeTransport = function() {};

IframeTransport.prototype.i_constructor = function(ri, trans_url, base_url) {
    var that = this;
    that.ri = ri;
    that.origin = utils.getOrigin(base_url);
    that.base_url = base_url;
    that.trans_url = trans_url;

    var iframe_url = base_url + '/iframe.html';
    if (that.ri._options.devel) {
        iframe_url += '?t=' + (+new Date);
    }
    that.window_id = utils.random_string(8);
    iframe_url += '#' + that.window_id;

    that.iframeObj = utils.createIframe(iframe_url, function(r) {
                                            that.ri._didClose(1006, "Unable to load an iframe (" + r + ")");
                                        });

    that.onmessage_cb = utils.bind(that.onmessage, that);
    utils.attachMessage(that.onmessage_cb);
};

IframeTransport.prototype.doCleanup = function() {
    var that = this;
    if (that.iframeObj) {
        utils.detachMessage(that.onmessage_cb);
        try {
            // When the iframe is not loaded, IE raises an exception
            // on 'contentWindow'.
            if (that.iframeObj.iframe.contentWindow) {
                that.postMessage('c');
            }
        } catch (x) {}
        that.iframeObj.cleanup();
        that.iframeObj = null;
        that.onmessage_cb = that.iframeObj = null;
    }
};

IframeTransport.prototype.onmessage = function(e) {
    var that = this;
    if (e.origin !== that.origin) return;
    var window_id = e.data.slice(0, 8);
    var type = e.data.slice(8, 9);
    var data = e.data.slice(9);

    if (window_id !== that.window_id) return;

    switch(type) {
    case 's':
        that.iframeObj.loaded();
        that.postMessage('s', JSON.stringify([SockJS.version, that.protocol, that.trans_url, that.base_url]));
        break;
    case 't':
        that.ri._didMessage(data);
        break;
    }
};

IframeTransport.prototype.postMessage = function(type, data) {
    var that = this;
    that.iframeObj.post(that.window_id + type + (data || ''), that.origin);
};

IframeTransport.prototype.doSend = function (message) {
    this.postMessage('m', message);
};

IframeTransport.enabled = function() {
    // postMessage misbehaves in konqueror 4.6.5 - the messages are delivered with
    // huge delay, or not at all.
    var konqueror = navigator && navigator.userAgent && navigator.userAgent.indexOf('Konqueror') !== -1;
    return ((typeof _window.postMessage === 'function' ||
            typeof _window.postMessage === 'object') && (!konqueror));
};
//         [*] End of lib/trans-iframe.js


//         [*] Including lib/trans-iframe-within.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var curr_window_id;

var postMessage = function (type, data) {
    if(parent !== _window) {
        parent.postMessage(curr_window_id + type + (data || ''), '*');
    } else {
        utils.log("Can't postMessage, no parent window.", type, data);
    }
};

var FacadeJS = function() {};
FacadeJS.prototype._didClose = function (code, reason) {
    postMessage('t', utils.closeFrame(code, reason));
};
FacadeJS.prototype._didMessage = function (frame) {
    postMessage('t', frame);
};
FacadeJS.prototype._doSend = function (data) {
    this._transport.doSend(data);
};
FacadeJS.prototype._doCleanup = function () {
    this._transport.doCleanup();
};

utils.parent_origin = undefined;

SockJS.bootstrap_iframe = function() {
    var facade;
    curr_window_id = _document.location.hash.slice(1);
    var onMessage = function(e) {
        if(e.source !== parent) return;
        if(typeof utils.parent_origin === 'undefined')
            utils.parent_origin = e.origin;
        if (e.origin !== utils.parent_origin) return;

        var window_id = e.data.slice(0, 8);
        var type = e.data.slice(8, 9);
        var data = e.data.slice(9);
        if (window_id !== curr_window_id) return;
        switch(type) {
        case 's':
            var p = JSON.parse(data);
            var version = p[0];
            var protocol = p[1];
            var trans_url = p[2];
            var base_url = p[3];
            if (version !== SockJS.version) {
                utils.log("Incompatibile SockJS! Main site uses:" +
                          " \"" + version + "\", the iframe:" +
                          " \"" + SockJS.version + "\".");
            }
            if (!utils.flatUrl(trans_url) || !utils.flatUrl(base_url)) {
                utils.log("Only basic urls are supported in SockJS");
                return;
            }

            if (!utils.isSameOriginUrl(trans_url) ||
                !utils.isSameOriginUrl(base_url)) {
                utils.log("Can't connect to different domain from within an " +
                          "iframe. (" + JSON.stringify([_window.location.href, trans_url, base_url]) +
                          ")");
                return;
            }
            facade = new FacadeJS();
            facade._transport = new FacadeJS[protocol](facade, trans_url, base_url);
            break;
        case 'm':
            facade._doSend(data);
            break;
        case 'c':
            if (facade)
                facade._doCleanup();
            facade = null;
            break;
        }
    };

    // alert('test ticker');
    // facade = new FacadeJS();
    // facade._transport = new FacadeJS['w-iframe-xhr-polling'](facade, 'http://host.com:9999/ticker/12/basd');

    utils.attachMessage(onMessage);

    // Start
    postMessage('s');
};
//         [*] End of lib/trans-iframe-within.js


//         [*] Including lib/info.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var InfoReceiver = function(base_url, AjaxObject) {
    var that = this;
    utils.delay(function(){that.doXhr(base_url, AjaxObject);});
};

InfoReceiver.prototype = new EventEmitter(['finish']);

InfoReceiver.prototype.doXhr = function(base_url, AjaxObject) {
    var that = this;
    var t0 = (new Date()).getTime();
    var xo = new AjaxObject('GET', base_url + '/info');

    var tref = utils.delay(8000,
                           function(){xo.ontimeout();});

    xo.onfinish = function(status, text) {
        clearTimeout(tref);
        tref = null;
        if (status === 200) {
            var rtt = (new Date()).getTime() - t0;
            var info = JSON.parse(text);
            if (typeof info !== 'object') info = {};
            that.emit('finish', info, rtt);
        } else {
            that.emit('finish');
        }
    };
    xo.ontimeout = function() {
        xo.close();
        that.emit('finish');
    };
};

var InfoReceiverIframe = function(base_url) {
    var that = this;
    var go = function() {
        var ifr = new IframeTransport();
        ifr.protocol = 'w-iframe-info-receiver';
        var fun = function(r) {
            if (typeof r === 'string' && r.substr(0,1) === 'm') {
                var d = JSON.parse(r.substr(1));
                var info = d[0], rtt = d[1];
                that.emit('finish', info, rtt);
            } else {
                that.emit('finish');
            }
            ifr.doCleanup();
            ifr = null;
        };
        var mock_ri = {
            _options: {},
            _didClose: fun,
            _didMessage: fun
        };
        ifr.i_constructor(mock_ri, base_url, base_url);
    }
    if(!_document.body) {
        utils.attachEvent('load', go);
    } else {
        go();
    }
};
InfoReceiverIframe.prototype = new EventEmitter(['finish']);


var InfoReceiverFake = function() {
    // It may not be possible to do cross domain AJAX to get the info
    // data, for example for IE7. But we want to run JSONP, so let's
    // fake the response, with rtt=2s (rto=6s).
    var that = this;
    utils.delay(function() {
        that.emit('finish', {}, 2000);
    });
};
InfoReceiverFake.prototype = new EventEmitter(['finish']);

var createInfoReceiver = function(base_url) {
    if (utils.isSameOriginUrl(base_url)) {
        // If, for some reason, we have SockJS locally - there's no
        // need to start up the complex machinery. Just use ajax.
        return new InfoReceiver(base_url, utils.XHRLocalObject);
    }
    switch (utils.isXHRCorsCapable()) {
    case 1:
        return new InfoReceiver(base_url, utils.XHRCorsObject);
    case 2:
        return new InfoReceiver(base_url, utils.XDRObject);
    case 3:
        // Opera
        return new InfoReceiverIframe(base_url);
    default:
        // IE 7
        return new InfoReceiverFake();
    };
};


var WInfoReceiverIframe = FacadeJS['w-iframe-info-receiver'] = function(ri, _trans_url, base_url) {
    var ir = new InfoReceiver(base_url, utils.XHRLocalObject);
    ir.onfinish = function(info, rtt) {
        ri._didMessage('m'+JSON.stringify([info, rtt]));
        ri._didClose();
    }
};
WInfoReceiverIframe.prototype.doCleanup = function() {};
//         [*] End of lib/info.js


//         [*] Including lib/trans-iframe-eventsource.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var EventSourceIframeTransport = SockJS['iframe-eventsource'] = function () {
    var that = this;
    that.protocol = 'w-iframe-eventsource';
    that.i_constructor.apply(that, arguments);
};

EventSourceIframeTransport.prototype = new IframeTransport();

EventSourceIframeTransport.enabled = function () {
    return ('EventSource' in _window) && IframeTransport.enabled();
};

EventSourceIframeTransport.need_body = true;
EventSourceIframeTransport.roundTrips = 3; // html, javascript, eventsource


// w-iframe-eventsource
var EventSourceTransport = FacadeJS['w-iframe-eventsource'] = function(ri, trans_url) {
    this.run(ri, trans_url, '/eventsource', EventSourceReceiver, utils.XHRLocalObject);
}
EventSourceTransport.prototype = new AjaxBasedTransport();
//         [*] End of lib/trans-iframe-eventsource.js


//         [*] Including lib/trans-iframe-xhr-polling.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var XhrPollingIframeTransport = SockJS['iframe-xhr-polling'] = function () {
    var that = this;
    that.protocol = 'w-iframe-xhr-polling';
    that.i_constructor.apply(that, arguments);
};

XhrPollingIframeTransport.prototype = new IframeTransport();

XhrPollingIframeTransport.enabled = function () {
    return _window.XMLHttpRequest && IframeTransport.enabled();
};

XhrPollingIframeTransport.need_body = true;
XhrPollingIframeTransport.roundTrips = 3; // html, javascript, xhr


// w-iframe-xhr-polling
var XhrPollingITransport = FacadeJS['w-iframe-xhr-polling'] = function(ri, trans_url) {
    this.run(ri, trans_url, '/xhr', XhrReceiver, utils.XHRLocalObject);
};

XhrPollingITransport.prototype = new AjaxBasedTransport();
//         [*] End of lib/trans-iframe-xhr-polling.js


//         [*] Including lib/trans-iframe-htmlfile.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

// This transport generally works in any browser, but will cause a
// spinning cursor to appear in any browser other than IE.
// We may test this transport in all browsers - why not, but in
// production it should be only run in IE.

var HtmlFileIframeTransport = SockJS['iframe-htmlfile'] = function () {
    var that = this;
    that.protocol = 'w-iframe-htmlfile';
    that.i_constructor.apply(that, arguments);
};

// Inheritance.
HtmlFileIframeTransport.prototype = new IframeTransport();

HtmlFileIframeTransport.enabled = function() {
    return IframeTransport.enabled();
};

HtmlFileIframeTransport.need_body = true;
HtmlFileIframeTransport.roundTrips = 3; // html, javascript, htmlfile


// w-iframe-htmlfile
var HtmlFileTransport = FacadeJS['w-iframe-htmlfile'] = function(ri, trans_url) {
    this.run(ri, trans_url, '/htmlfile', HtmlfileReceiver, utils.XHRLocalObject);
};
HtmlFileTransport.prototype = new AjaxBasedTransport();
//         [*] End of lib/trans-iframe-htmlfile.js


//         [*] Including lib/trans-polling.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var Polling = function(ri, Receiver, recv_url, AjaxObject) {
    var that = this;
    that.ri = ri;
    that.Receiver = Receiver;
    that.recv_url = recv_url;
    that.AjaxObject = AjaxObject;
    that._scheduleRecv();
};

Polling.prototype._scheduleRecv = function() {
    var that = this;
    var poll = that.poll = new that.Receiver(that.recv_url, that.AjaxObject);
    var msg_counter = 0;
    poll.onmessage = function(e) {
        msg_counter += 1;
        that.ri._didMessage(e.data);
    };
    poll.onclose = function(e) {
        that.poll = poll = poll.onmessage = poll.onclose = null;
        if (!that.poll_is_closing) {
            if (e.reason === 'permanent') {
                that.ri._didClose(1006, 'Polling error (' + e.reason + ')');
            } else {
                that._scheduleRecv();
            }
        }
    };
};

Polling.prototype.abort = function() {
    var that = this;
    that.poll_is_closing = true;
    if (that.poll) {
        that.poll.abort();
    }
};
//         [*] End of lib/trans-polling.js


//         [*] Including lib/trans-receiver-eventsource.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var EventSourceReceiver = function(url) {
    var that = this;
    var es = new EventSource(url);
    es.onmessage = function(e) {
        that.dispatchEvent(new SimpleEvent('message',
                                           {'data': unescape(e.data)}));
    };
    that.es_close = es.onerror = function(e, abort_reason) {
        // ES on reconnection has readyState = 0 or 1.
        // on network error it's CLOSED = 2
        var reason = abort_reason ? 'user' :
            (es.readyState !== 2 ? 'network' : 'permanent');
        that.es_close = es.onmessage = es.onerror = null;
        // EventSource reconnects automatically.
        es.close();
        es = null;
        // Safari and chrome < 15 crash if we close window before
        // waiting for ES cleanup. See:
        //   https://code.google.com/p/chromium/issues/detail?id=89155
        utils.delay(200, function() {
                        that.dispatchEvent(new SimpleEvent('close', {reason: reason}));
                    });
    };
};

EventSourceReceiver.prototype = new REventTarget();

EventSourceReceiver.prototype.abort = function() {
    var that = this;
    if (that.es_close) {
        that.es_close({}, true);
    }
};
//         [*] End of lib/trans-receiver-eventsource.js


//         [*] Including lib/trans-receiver-htmlfile.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var _is_ie_htmlfile_capable;
var isIeHtmlfileCapable = function() {
    if (_is_ie_htmlfile_capable === undefined) {
        if ('ActiveXObject' in _window) {
            try {
                _is_ie_htmlfile_capable = !!new ActiveXObject('htmlfile');
            } catch (x) {}
        } else {
            _is_ie_htmlfile_capable = false;
        }
    }
    return _is_ie_htmlfile_capable;
};


var HtmlfileReceiver = function(url) {
    var that = this;
    utils.polluteGlobalNamespace();

    that.id = 'a' + utils.random_string(6, 26);
    url += ((url.indexOf('?') === -1) ? '?' : '&') +
        'c=' + escape(WPrefix + '.' + that.id);

    var constructor = isIeHtmlfileCapable() ?
        utils.createHtmlfile : utils.createIframe;

    var iframeObj;
    _window[WPrefix][that.id] = {
        start: function () {
            iframeObj.loaded();
        },
        message: function (data) {
            that.dispatchEvent(new SimpleEvent('message', {'data': data}));
        },
        stop: function () {
            that.iframe_close({}, 'network');
        }
    };
    that.iframe_close = function(e, abort_reason) {
        iframeObj.cleanup();
        that.iframe_close = iframeObj = null;
        delete _window[WPrefix][that.id];
        that.dispatchEvent(new SimpleEvent('close', {reason: abort_reason}));
    };
    iframeObj = constructor(url, function(e) {
                                that.iframe_close({}, 'permanent');
                            });
};

HtmlfileReceiver.prototype = new REventTarget();

HtmlfileReceiver.prototype.abort = function() {
    var that = this;
    if (that.iframe_close) {
        that.iframe_close({}, 'user');
    }
};
//         [*] End of lib/trans-receiver-htmlfile.js


//         [*] Including lib/trans-receiver-xhr.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

var XhrReceiver = function(url, AjaxObject) {
    var that = this;
    var buf_pos = 0;

    that.xo = new AjaxObject('POST', url, null);
    that.xo.onchunk = function(status, text) {
        if (status !== 200) return;
        while (1) {
            var buf = text.slice(buf_pos);
            var p = buf.indexOf('\n');
            if (p === -1) break;
            buf_pos += p+1;
            var msg = buf.slice(0, p);
            that.dispatchEvent(new SimpleEvent('message', {data: msg}));
        }
    };
    that.xo.onfinish = function(status, text) {
        that.xo.onchunk(status, text);
        that.xo = null;
        var reason = status === 200 ? 'network' : 'permanent';
        that.dispatchEvent(new SimpleEvent('close', {reason: reason}));
    }
};

XhrReceiver.prototype = new REventTarget();

XhrReceiver.prototype.abort = function() {
    var that = this;
    if (that.xo) {
        that.xo.close();
        that.dispatchEvent(new SimpleEvent('close', {reason: 'user'}));
        that.xo = null;
    }
};
//         [*] End of lib/trans-receiver-xhr.js


//         [*] Including lib/test-hooks.js
/*
 * ***** BEGIN LICENSE BLOCK *****
 * Copyright (c) 2011-2012 VMware, Inc.
 *
 * For the license see COPYING.
 * ***** END LICENSE BLOCK *****
 */

// For testing
SockJS.getUtils = function(){
    return utils;
};

SockJS.getIframeTransport = function(){
    return IframeTransport;
};
//         [*] End of lib/test-hooks.js

                  return SockJS;
          })();
if ('_sockjs_onload' in window) setTimeout(_sockjs_onload, 1);

// AMD compliance
if (typeof define === 'function' && define.amd) {
    define('sockjs', [], function(){return SockJS;});
}

if (typeof module === 'object' && module && module.exports) {
    module.exports = SockJS;
}
//     [*] End of lib/index.js

// [*] End of lib/all.js


})()
},{}],25:[function(require,module,exports){
(function(global){/**
 * tty.js - an xterm emulator
 *
 * Copyright (c) 2012-2013, Christopher Jeffrey (https://github.com/chjj/tty.js)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Originally forked from (with the author's permission):
 *   Fabrice Bellard's javascript vt100 for jslinux:
 *   http://bellard.org/jslinux/
 *   Copyright (c) 2011 Fabrice Bellard
 *   The original design remains. The terminal itself
 *   has been extended to include xterm CSI codes, among
 *   other features.
 */

;(function() {

/**
 * Terminal Emulation References:
 *   http://vt100.net/
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.txt
 *   http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
 *   http://invisible-island.net/vttest/
 *   http://www.inwap.com/pdp10/ansicode.txt
 *   http://linux.die.net/man/4/console_codes
 *   http://linux.die.net/man/7/urxvt
 */

'use strict';

/**
 * Shared
 */

var window = this
  , document = this.document;

/**
 * EventEmitter
 */

function EventEmitter() {
  this._events = this._events || {};
}

EventEmitter.prototype.addListener = function(type, listener) {
  this._events[type] = this._events[type] || [];
  this._events[type].push(listener);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.removeListener = function(type, listener) {
  if (!this._events[type]) return;

  var obj = this._events[type]
    , i = obj.length;

  while (i--) {
    if (obj[i] === listener || obj[i].listener === listener) {
      obj.splice(i, 1);
      return;
    }
  }
};

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners = function(type) {
  if (this._events[type]) delete this._events[type];
};

EventEmitter.prototype.once = function(type, listener) {
  function on() {
    var args = Array.prototype.slice.call(arguments);
    this.removeListener(type, on);
    return listener.apply(this, args);
  }
  on.listener = listener;
  return this.on(type, on);
};

EventEmitter.prototype.emit = function(type) {
  if (!this._events[type]) return;

  var args = Array.prototype.slice.call(arguments, 1)
    , obj = this._events[type]
    , l = obj.length
    , i = 0;

  for (; i < l; i++) {
    obj[i].apply(this, args);
  }
};

EventEmitter.prototype.listeners = function(type) {
  return this._events[type] = this._events[type] || [];
};

/**
 * States
 */

var normal = 0
  , escaped = 1
  , csi = 2
  , osc = 3
  , charset = 4
  , dcs = 5
  , ignore = 6;

/**
 * Terminal
 */

function Terminal(cols, rows, handler) {
  EventEmitter.call(this);

  var options;
  if (typeof cols === 'object') {
    options = cols;
    cols = options.cols;
    rows = options.rows;
    handler = options.handler;
  }
  this._options = options || {};

  this.cols = cols || Terminal.geometry[0];
  this.rows = rows || Terminal.geometry[1];

  if (handler) {
    this.on('data', handler);
  }

  this.ybase = 0;
  this.ydisp = 0;
  this.x = 0;
  this.y = 0;
  this.cursorState = 0;
  this.cursorHidden = false;
  this.convertEol = false;
  this.state = 0;
  this.queue = '';
  this.scrollTop = 0;
  this.scrollBottom = this.rows - 1;

  // modes
  this.applicationKeypad = false;
  this.applicationCursor = false;
  this.originMode = false;
  this.insertMode = false;
  this.wraparoundMode = false;
  this.normal = null;

  // charset
  this.charset = null;
  this.gcharset = null;
  this.glevel = 0;
  this.charsets = [null];

  // mouse properties
  this.decLocator;
  this.x10Mouse;
  this.vt200Mouse;
  this.vt300Mouse;
  this.normalMouse;
  this.mouseEvents;
  this.sendFocus;
  this.utfMouse;
  this.sgrMouse;
  this.urxvtMouse;

  // misc
  this.element;
  this.children;
  this.refreshStart;
  this.refreshEnd;
  this.savedX;
  this.savedY;
  this.savedCols;

  // stream
  this.readable = true;
  this.writable = true;

  this.defAttr = (257 << 9) | 256;
  this.curAttr = this.defAttr;

  this.params = [];
  this.currentParam = 0;
  this.prefix = '';
  this.postfix = '';

  this.lines = [];
  var i = this.rows;
  while (i--) {
    this.lines.push(this.blankLine());
  }

  this.tabs;
  this.setupStops();
}

inherits(Terminal, EventEmitter);

/**
 * Colors
 */

// Colors 0-15
Terminal.colors = [
  // dark:
  '#2e3436',
  '#cc0000',
  '#4e9a06',
  '#c4a000',
  '#3465a4',
  '#75507b',
  '#06989a',
  '#d3d7cf',
  // bright:
  '#555753',
  '#ef2929',
  '#8ae234',
  '#fce94f',
  '#729fcf',
  '#ad7fa8',
  '#34e2e2',
  '#eeeeec'
];

// Colors 16-255
// Much thanks to TooTallNate for writing this.
Terminal.colors = (function() {
  var colors = Terminal.colors
    , r = [0x00, 0x5f, 0x87, 0xaf, 0xd7, 0xff]
    , i;

  // 16-231
  i = 0;
  for (; i < 216; i++) {
    out(r[(i / 36) % 6 | 0], r[(i / 6) % 6 | 0], r[i % 6]);
  }

  // 232-255 (grey)
  i = 0;
  for (; i < 24; i++) {
    r = 8 + i * 10;
    out(r, r, r);
  }

  function out(r, g, b) {
    colors.push('#' + hex(r) + hex(g) + hex(b));
  }

  function hex(c) {
    c = c.toString(16);
    return c.length < 2 ? '0' + c : c;
  }

  return colors;
})();

// Default BG/FG
Terminal.defaultColors = {
  bg: '#000000',
  fg: '#f0f0f0'
};

Terminal.colors[256] = Terminal.defaultColors.bg;
Terminal.colors[257] = Terminal.defaultColors.fg;

/**
 * Options
 */

Terminal.termName = 'xterm';
Terminal.geometry = [80, 24];
Terminal.cursorBlink = true;
Terminal.visualBell = false;
Terminal.popOnBell = false;
Terminal.scrollback = 1000;
Terminal.screenKeys = false;
Terminal.programFeatures = false;
Terminal.debug = false;

/**
 * Focused Terminal
 */

Terminal.focus = null;

Terminal.prototype.focus = function() {
  if (Terminal.focus === this) return;
  if (Terminal.focus) {
    Terminal.focus.cursorState = 0;
    Terminal.focus.refresh(Terminal.focus.y, Terminal.focus.y);
    if (Terminal.focus.sendFocus) Terminal.focus.send('\x1b[O');
  }
  Terminal.focus = this;
  if (this.sendFocus) this.send('\x1b[I');
  this.showCursor();
};

/**
 * Global Events for key handling
 */

Terminal.bindKeys = function() {
  if (Terminal.focus) return;

  // We could put an "if (Terminal.focus)" check
  // here, but it shouldn't be necessary.
  on(document, 'keydown', function(ev) {
    return Terminal.focus.keyDown(ev);
  }, true);

  on(document, 'keypress', function(ev) {
    return Terminal.focus.keyPress(ev);
  }, true);
};

/**
 * Open Terminal
 */

Terminal.prototype.open = function() {
  var self = this
    , i = 0
    , div;

  this.element = document.createElement('div');
  this.element.className = 'terminal';
  this.children = [];

  for (; i < this.rows; i++) {
    div = document.createElement('div');
    this.element.appendChild(div);
    this.children.push(div);
  }

  document.body.appendChild(this.element);

  this.refresh(0, this.rows - 1);

  Terminal.bindKeys();
  this.focus();

  this.startBlink();

  on(this.element, 'mousedown', function() {
    self.focus();
  });

  // This probably shouldn't work,
  // ... but it does. Firefox's paste
  // event seems to only work for textareas?
  on(this.element, 'mousedown', function(ev) {
    var button = ev.button != null
      ? +ev.button
      : ev.which != null
        ? ev.which - 1
        : null;

    // Does IE9 do this?
    if (~navigator.userAgent.indexOf('MSIE')) {
      button = button === 1 ? 0 : button === 4 ? 1 : button;
    }

    if (button !== 2) return;

    self.element.contentEditable = 'true';
    setTimeout(function() {
      self.element.contentEditable = 'inherit'; // 'false';
    }, 1);
  }, true);

  on(this.element, 'paste', function(ev) {
    if (ev.clipboardData) {
      self.send(ev.clipboardData.getData('text/plain'));
    } else if (window.clipboardData) {
      self.send(window.clipboardData.getData('Text'));
    }
    // Not necessary. Do it anyway for good measure.
    self.element.contentEditable = 'inherit';
    return cancel(ev);
  });

  this.bindMouse();

  // XXX - hack, move this somewhere else.
  if (Terminal.brokenBold == null) {
    Terminal.brokenBold = isBoldBroken();
  }

  // sync default bg/fg colors
  this.element.style.backgroundColor = Terminal.defaultColors.bg;
  this.element.style.color = Terminal.defaultColors.fg;

  //this.emit('open');
};

// XTerm mouse events
// http://invisible-island.net/xterm/ctlseqs/ctlseqs.html#Mouse%20Tracking
// To better understand these
// the xterm code is very helpful:
// Relevant files:
//   button.c, charproc.c, misc.c
// Relevant functions in xterm/button.c:
//   BtnCode, EmitButtonCode, EditorButton, SendMousePosition
Terminal.prototype.bindMouse = function() {
  var el = this.element
    , self = this
    , pressed = 32;

  var wheelEvent = 'onmousewheel' in window
    ? 'mousewheel'
    : 'DOMMouseScroll';

  // mouseup, mousedown, mousewheel
  // left click: ^[[M 3<^[[M#3<
  // mousewheel up: ^[[M`3>
  function sendButton(ev) {
    var button
      , pos;

    // get the xterm-style button
    button = getButton(ev);

    // get mouse coordinates
    pos = getCoords(ev);
    if (!pos) return;

    sendEvent(button, pos);

    switch (ev.type) {
      case 'mousedown':
        pressed = button;
        break;
      case 'mouseup':
        // keep it at the left
        // button, just in case.
        pressed = 32;
        break;
      case wheelEvent:
        // nothing. don't
        // interfere with
        // `pressed`.
        break;
    }
  }

  // motion example of a left click:
  // ^[[M 3<^[[M@4<^[[M@5<^[[M@6<^[[M@7<^[[M#7<
  function sendMove(ev) {
    var button = pressed
      , pos;

    pos = getCoords(ev);
    if (!pos) return;

    // buttons marked as motions
    // are incremented by 32
    button += 32;

    sendEvent(button, pos);
  }

  // encode button and
  // position to characters
  function encode(data, ch) {
    if (!self.utfMouse) {
      if (ch === 255) return data.push(0);
      if (ch > 127) ch = 127;
      data.push(ch);
    } else {
      if (ch === 2047) return data.push(0);
      if (ch < 127) {
        data.push(ch);
      } else {
        if (ch > 2047) ch = 2047;
        data.push(0xC0 | (ch >> 6));
        data.push(0x80 | (ch & 0x3F));
      }
    }
  }

  // send a mouse event:
  // regular/utf8: ^[[M Cb Cx Cy
  // urxvt: ^[[ Cb ; Cx ; Cy M
  // sgr: ^[[ Cb ; Cx ; Cy M/m
  // vt300: ^[[ 24(1/3/5)~ [ Cx , Cy ] \r
  // locator: CSI P e ; P b ; P r ; P c ; P p & w
  function sendEvent(button, pos) {
    // self.emit('mouse', {
    //   x: pos.x - 32,
    //   y: pos.x - 32,
    //   button: button
    // });

    if (self.vt300Mouse) {
      // NOTE: Unstable.
      // http://www.vt100.net/docs/vt3xx-gp/chapter15.html
      button &= 3;
      pos.x -= 32;
      pos.y -= 32;
      var data = '\x1b[24';
      if (button === 0) data += '1';
      else if (button === 1) data += '3';
      else if (button === 2) data += '5';
      else if (button === 3) return;
      else data += '0';
      data += '~[' + pos.x + ',' + pos.y + ']\r';
      self.send(data);
      return;
    }

    if (self.decLocator) {
      // NOTE: Unstable.
      button &= 3;
      pos.x -= 32;
      pos.y -= 32;
      if (button === 0) button = 2;
      else if (button === 1) button = 4;
      else if (button === 2) button = 6;
      else if (button === 3) button = 3;
      self.send('\x1b['
        + button
        + ';'
        + (button === 3 ? 4 : 0)
        + ';'
        + pos.y
        + ';'
        + pos.x
        + ';'
        + (pos.page || 0)
        + '&w');
      return;
    }

    if (self.urxvtMouse) {
      pos.x -= 32;
      pos.y -= 32;
      pos.x++;
      pos.y++;
      self.send('\x1b[' + button + ';' + pos.x + ';' + pos.y + 'M');
      return;
    }

    if (self.sgrMouse) {
      pos.x -= 32;
      pos.y -= 32;
      self.send('\x1b[<'
        + ((button & 3) === 3 ? button & ~3 : button)
        + ';'
        + pos.x
        + ';'
        + pos.y
        + ((button & 3) === 3 ? 'm' : 'M'));
      return;
    }

    var data = [];

    encode(data, button);
    encode(data, pos.x);
    encode(data, pos.y);

    self.send('\x1b[M' + String.fromCharCode.apply(String, data));
  }

  function getButton(ev) {
    var button
      , shift
      , meta
      , ctrl
      , mod;

    // two low bits:
    // 0 = left
    // 1 = middle
    // 2 = right
    // 3 = release
    // wheel up/down:
    // 1, and 2 - with 64 added
    switch (ev.type) {
      case 'mousedown':
        button = ev.button != null
          ? +ev.button
          : ev.which != null
            ? ev.which - 1
            : null;

        if (~navigator.userAgent.indexOf('MSIE')) {
          button = button === 1 ? 0 : button === 4 ? 1 : button;
        }
        break;
      case 'mouseup':
        button = 3;
        break;
      case 'DOMMouseScroll':
        button = ev.detail < 0
          ? 64
          : 65;
        break;
      case 'mousewheel':
        button = ev.wheelDeltaY > 0
          ? 64
          : 65;
        break;
    }

    // next three bits are the modifiers:
    // 4 = shift, 8 = meta, 16 = control
    shift = ev.shiftKey ? 4 : 0;
    meta = ev.metaKey ? 8 : 0;
    ctrl = ev.ctrlKey ? 16 : 0;
    mod = shift | meta | ctrl;

    // no mods
    if (self.vt200Mouse) {
      // ctrl only
      mod &= ctrl;
    } else if (!self.normalMouse) {
      mod = 0;
    }

    // increment to SP
    button = (32 + (mod << 2)) + button;

    return button;
  }

  // mouse coordinates measured in cols/rows
  function getCoords(ev) {
    var x, y, w, h, el;

    // ignore browsers without pageX for now
    if (ev.pageX == null) return;

    x = ev.pageX;
    y = ev.pageY;
    el = self.element;

    // should probably check offsetParent
    // but this is more portable
    while (el !== document.documentElement) {
      x -= el.offsetLeft;
      y -= el.offsetTop;
      el = el.parentNode;
    }

    // convert to cols/rows
    w = self.element.clientWidth;
    h = self.element.clientHeight;
    x = ((x / w) * self.cols) | 0;
    y = ((y / h) * self.rows) | 0;

    // be sure to avoid sending
    // bad positions to the program
    if (x < 0) x = 0;
    if (x > self.cols) x = self.cols;
    if (y < 0) y = 0;
    if (y > self.rows) y = self.rows;

    // xterm sends raw bytes and
    // starts at 32 (SP) for each.
    x += 32;
    y += 32;

    return {
      x: x,
      y: y,
      down: ev.type === 'mousedown',
      up: ev.type === 'mouseup',
      wheel: ev.type === wheelEvent,
      move: ev.type === 'mousemove'
    };
  }

  on(el, 'mousedown', function(ev) {
    if (!self.mouseEvents) return;

    // send the button
    sendButton(ev);

    // ensure focus
    self.focus();

    // fix for odd bug
    if (self.vt200Mouse) {
      sendButton({ __proto__: ev, type: 'mouseup' });
      return cancel(ev);
    }

    // bind events
    if (self.normalMouse) on(document, 'mousemove', sendMove);

    // x10 compatibility mode can't send button releases
    if (!self.x10Mouse) {
      on(document, 'mouseup', function up(ev) {
        sendButton(ev);
        if (self.normalMouse) off(document, 'mousemove', sendMove);
        off(document, 'mouseup', up);
        return cancel(ev);
      });
    }

    return cancel(ev);
  });

  on(el, wheelEvent, function(ev) {
    if (!self.mouseEvents) return;
    if (self.x10Mouse
        || self.vt300Mouse
        || self.decLocator) return;
    sendButton(ev);
    return cancel(ev);
  });

  // allow mousewheel scrolling in
  // the shell for example
  on(el, wheelEvent, function(ev) {
    if (self.mouseEvents) return;
    if (self.applicationKeypad) return;
    if (ev.type === 'DOMMouseScroll') {
      self.scrollDisp(ev.detail < 0 ? -5 : 5);
    } else {
      self.scrollDisp(ev.wheelDeltaY > 0 ? -5 : 5);
    }
    return cancel(ev);
  });
};

/**
 * Destroy Terminal
 */

Terminal.prototype.destroy = function() {
  this.readable = false;
  this.writable = false;
  this._events = {};
  this.handler = function() {};
  this.write = function() {};
  //this.emit('close');
};

/**
 * Rendering Engine
 */

// In the screen buffer, each character
// is stored as a an array with a character
// and a 32-bit integer.
// First value: a utf-16 character.
// Second value:
// Next 9 bits: background color (0-511).
// Next 9 bits: foreground color (0-511).
// Next 14 bits: a mask for misc. flags:
//   1=bold, 2=underline, 4=inverse

Terminal.prototype.refresh = function(start, end) {
  var x
    , y
    , i
    , line
    , out
    , ch
    , width
    , data
    , attr
    , fgColor
    , bgColor
    , flags
    , row
    , parent;

  if (end - start >= this.rows / 2) {
    parent = this.element.parentNode;
    if (parent) parent.removeChild(this.element);
  }

  width = this.cols;
  y = start;

  // if (end > this.lines.length) {
  //   end = this.lines.length;
  // }

  for (; y <= end; y++) {
    row = y + this.ydisp;

    line = this.lines[row];
    out = '';

    if (y === this.y
        && this.cursorState
        && this.ydisp === this.ybase
        && !this.cursorHidden) {
      x = this.x;
    } else {
      x = -1;
    }

    attr = this.defAttr;
    i = 0;

    for (; i < width; i++) {
      data = line[i][0];
      ch = line[i][1];

      if (i === x) data = -1;

      if (data !== attr) {
        if (attr !== this.defAttr) {
          out += '</span>';
        }
        if (data !== this.defAttr) {
          if (data === -1) {
            out += '<span class="reverse-video">';
          } else {
            out += '<span style="';

            bgColor = data & 0x1ff;
            fgColor = (data >> 9) & 0x1ff;
            flags = data >> 18;

            if (flags & 1) {
              if (!Terminal.brokenBold) {
                out += 'font-weight:bold;';
              }
              // see: XTerm*boldColors
              if (fgColor < 8) fgColor += 8;
            }

            if (flags & 2) {
              out += 'text-decoration:underline;';
            }

            if (bgColor !== 256) {
              out += 'background-color:'
                + Terminal.colors[bgColor]
                + ';';
            }

            if (fgColor !== 257) {
              out += 'color:'
                + Terminal.colors[fgColor]
                + ';';
            }

            out += '">';
          }
        }
      }

      switch (ch) {
        case '&':
          out += '&amp;';
          break;
        case '<':
          out += '&lt;';
          break;
        case '>':
          out += '&gt;';
          break;
        default:
          if (ch <= ' ') {
            out += '&nbsp;';
          } else {
            out += ch;
          }
          break;
      }

      attr = data;
    }

    if (attr !== this.defAttr) {
      out += '</span>';
    }

    this.children[y].innerHTML = out;
  }

  if (parent) parent.appendChild(this.element);
};

Terminal.prototype.cursorBlink = function() {
  if (Terminal.focus !== this) return;
  this.cursorState ^= 1;
  this.refresh(this.y, this.y);
};

Terminal.prototype.showCursor = function() {
  if (!this.cursorState) {
    this.cursorState = 1;
    this.refresh(this.y, this.y);
  } else {
    // Temporarily disabled:
    // this.refreshBlink();
  }
};

Terminal.prototype.startBlink = function() {
  if (!Terminal.cursorBlink) return;
  var self = this;
  this._blinker = function() {
    self.cursorBlink();
  };
  this._blink = setInterval(this._blinker, 500);
};

Terminal.prototype.refreshBlink = function() {
  if (!Terminal.cursorBlink) return;
  clearInterval(this._blink);
  this._blink = setInterval(this._blinker, 500);
};

Terminal.prototype.scroll = function() {
  var row;

  if (++this.ybase === Terminal.scrollback) {
    this.ybase = this.ybase / 2 | 0;
    this.lines = this.lines.slice(-(this.ybase + this.rows) + 1);
  }

  this.ydisp = this.ybase;

  // last line
  row = this.ybase + this.rows - 1;

  // subtract the bottom scroll region
  row -= this.rows - 1 - this.scrollBottom;

  if (row === this.lines.length) {
    // potential optimization:
    // pushing is faster than splicing
    // when they amount to the same
    // behavior.
    this.lines.push(this.blankLine());
  } else {
    // add our new line
    this.lines.splice(row, 0, this.blankLine());
  }

  if (this.scrollTop !== 0) {
    if (this.ybase !== 0) {
      this.ybase--;
      this.ydisp = this.ybase;
    }
    this.lines.splice(this.ybase + this.scrollTop, 1);
  }

  // this.maxRange();
  this.updateRange(this.scrollTop);
  this.updateRange(this.scrollBottom);
};

Terminal.prototype.scrollDisp = function(disp) {
  this.ydisp += disp;

  if (this.ydisp > this.ybase) {
    this.ydisp = this.ybase;
  } else if (this.ydisp < 0) {
    this.ydisp = 0;
  }

  this.refresh(0, this.rows - 1);
};

Terminal.prototype.write = function(data) {
  var l = data.length
    , i = 0
    , cs
    , ch;

  this.refreshStart = this.y;
  this.refreshEnd = this.y;

  if (this.ybase !== this.ydisp) {
    this.ydisp = this.ybase;
    this.maxRange();
  }

  // this.log(JSON.stringify(data.replace(/\x1b/g, '^[')));

  for (; i < l; i++) {
    ch = data[i];
    switch (this.state) {
      case normal:
        switch (ch) {
          // '\0'
          // case '\0':
          // case '\200':
          //   break;

          // '\a'
          case '\x07':
            this.bell();
            break;

          // '\n', '\v', '\f'
          case '\n':
          case '\x0b':
          case '\x0c':
            if (this.convertEol) {
              this.x = 0;
            }
            this.y++;
            if (this.y > this.scrollBottom) {
              this.y--;
              this.scroll();
            }
            break;

          // '\r'
          case '\r':
            this.x = 0;
            break;

          // '\b'
          case '\x08':
            if (this.x > 0) {
              this.x--;
            }
            break;

          // '\t'
          case '\t':
            this.x = this.nextStop();
            break;

          // shift out
          case '\x0e':
            this.setgLevel(1);
            break;

          // shift in
          case '\x0f':
            this.setgLevel(0);
            break;

          // '\e'
          case '\x1b':
            this.state = escaped;
            break;

          default:
            // ' '
            if (ch >= ' ') {
              if (this.charset && this.charset[ch]) {
                ch = this.charset[ch];
              }
              if (this.x >= this.cols) {
                this.x = 0;
                this.y++;
                if (this.y > this.scrollBottom) {
                  this.y--;
                  this.scroll();
                }
              }
              this.lines[this.y + this.ybase][this.x] = [this.curAttr, ch];
              this.x++;
              this.updateRange(this.y);
            }
            break;
        }
        break;
      case escaped:
        switch (ch) {
          // ESC [ Control Sequence Introducer ( CSI is 0x9b).
          case '[':
            this.params = [];
            this.currentParam = 0;
            this.state = csi;
            break;

          // ESC ] Operating System Command ( OSC is 0x9d).
          case ']':
            this.params = [];
            this.currentParam = 0;
            this.state = osc;
            break;

          // ESC P Device Control String ( DCS is 0x90).
          case 'P':
            this.params = [];
            this.currentParam = 0;
            this.state = dcs;
            break;

          // ESC _ Application Program Command ( APC is 0x9f).
          case '_':
            this.state = ignore;
            break;

          // ESC ^ Privacy Message ( PM is 0x9e).
          case '^':
            this.state = ignore;
            break;

          // ESC c Full Reset (RIS).
          case 'c':
            this.reset();
            break;

          // ESC E Next Line ( NEL is 0x85).
          // ESC D Index ( IND is 0x84).
          case 'E':
            this.x = 0;
            ;
          case 'D':
            this.index();
            break;

          // ESC M Reverse Index ( RI is 0x8d).
          case 'M':
            this.reverseIndex();
            break;

          // ESC % Select default/utf-8 character set.
          // @ = default, G = utf-8
          case '%':
            //this.charset = null;
            this.setgLevel(0);
            this.setgCharset(0, Terminal.charsets.US);
            this.state = normal;
            i++;
            break;

          // ESC (,),*,+,-,. Designate G0-G2 Character Set.
          case '(': // <-- this seems to get all the attention
          case ')':
          case '*':
          case '+':
          case '-':
          case '.':
            switch (ch) {
              case '(':
                this.gcharset = 0;
                break;
              case ')':
                this.gcharset = 1;
                break;
              case '*':
                this.gcharset = 2;
                break;
              case '+':
                this.gcharset = 3;
                break;
              case '-':
                this.gcharset = 1;
                break;
              case '.':
                this.gcharset = 2;
                break;
            }
            this.state = charset;
            break;

          // Designate G3 Character Set (VT300).
          // A = ISO Latin-1 Supplemental.
          // Not implemented.
          case '/':
            this.gcharset = 3;
            this.state = charset;
            i--;
            break;

          // ESC N
          // Single Shift Select of G2 Character Set
          // ( SS2 is 0x8e). This affects next character only.
          case 'N':
            break;
          // ESC O
          // Single Shift Select of G3 Character Set
          // ( SS3 is 0x8f). This affects next character only.
          case 'O':
            break;
          // ESC n
          // Invoke the G2 Character Set as GL (LS2).
          case 'n':
            this.setgLevel(2);
            break;
          // ESC o
          // Invoke the G3 Character Set as GL (LS3).
          case 'o':
            this.setgLevel(3);
            break;
          // ESC |
          // Invoke the G3 Character Set as GR (LS3R).
          case '|':
            this.setgLevel(3);
            break;
          // ESC }
          // Invoke the G2 Character Set as GR (LS2R).
          case '}':
            this.setgLevel(2);
            break;
          // ESC ~
          // Invoke the G1 Character Set as GR (LS1R).
          case '~':
            this.setgLevel(1);
            break;

          // ESC 7 Save Cursor (DECSC).
          case '7':
            this.saveCursor();
            this.state = normal;
            break;

          // ESC 8 Restore Cursor (DECRC).
          case '8':
            this.restoreCursor();
            this.state = normal;
            break;

          // ESC # 3 DEC line height/width
          case '#':
            this.state = normal;
            i++;
            break;

          // ESC H Tab Set (HTS is 0x88).
          case 'H':
            this.tabSet();
            break;

          // ESC = Application Keypad (DECPAM).
          case '=':
            this.log('Serial port requested application keypad.');
            this.applicationKeypad = true;
            this.state = normal;
            break;

          // ESC > Normal Keypad (DECPNM).
          case '>':
            this.log('Switching back to normal keypad.');
            this.applicationKeypad = false;
            this.state = normal;
            break;

          default:
            this.state = normal;
            this.error('Unknown ESC control: %s.', ch);
            break;
        }
        break;

      case charset:
        switch (ch) {
          case '0': // DEC Special Character and Line Drawing Set.
            cs = Terminal.charsets.SCLD;
            break;
          case 'A': // UK
            cs = Terminal.charsets.UK;
            break;
          case 'B': // United States (USASCII).
            cs = Terminal.charsets.US;
            break;
          case '4': // Dutch
            cs = Terminal.charsets.Dutch;
            break;
          case 'C': // Finnish
          case '5':
            cs = Terminal.charsets.Finnish;
            break;
          case 'R': // French
            cs = Terminal.charsets.French;
            break;
          case 'Q': // FrenchCanadian
            cs = Terminal.charsets.FrenchCanadian;
            break;
          case 'K': // German
            cs = Terminal.charsets.German;
            break;
          case 'Y': // Italian
            cs = Terminal.charsets.Italian;
            break;
          case 'E': // NorwegianDanish
          case '6':
            cs = Terminal.charsets.NorwegianDanish;
            break;
          case 'Z': // Spanish
            cs = Terminal.charsets.Spanish;
            break;
          case 'H': // Swedish
          case '7':
            cs = Terminal.charsets.Swedish;
            break;
          case '=': // Swiss
            cs = Terminal.charsets.Swiss;
            break;
          case '/': // ISOLatin (actually /A)
            cs = Terminal.charsets.ISOLatin;
            i++;
            break;
          default: // Default
            cs = Terminal.charsets.US;
            break;
        }
        this.setgCharset(this.gcharset, cs);
        this.gcharset = null;
        this.state = normal;
        break;

      case osc:
        // OSC Ps ; Pt ST
        // OSC Ps ; Pt BEL
        //   Set Text Parameters.
        if (ch === '\x1b' || ch === '\x07') {
          if (ch === '\x1b') i++;

          this.params.push(this.currentParam);

          switch (this.params[0]) {
            case 0:
            case 1:
            case 2:
              if (this.params[1]) {
                this.title = this.params[1];
                this.handleTitle(this.title);
              }
              break;
            case 3:
              // set X property
              break;
            case 4:
            case 5:
              // change dynamic colors
              break;
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
            case 19:
              // change dynamic ui colors
              break;
            case 46:
              // change log file
              break;
            case 50:
              // dynamic font
              break;
            case 51:
              // emacs shell
              break;
            case 52:
              // manipulate selection data
              break;
            case 104:
            case 105:
            case 110:
            case 111:
            case 112:
            case 113:
            case 114:
            case 115:
            case 116:
            case 117:
            case 118:
              // reset colors
              break;
          }

          this.params = [];
          this.currentParam = 0;
          this.state = normal;
        } else {
          if (!this.params.length) {
            if (ch >= '0' && ch <= '9') {
              this.currentParam =
                this.currentParam * 10 + ch.charCodeAt(0) - 48;
            } else if (ch === ';') {
              this.params.push(this.currentParam);
              this.currentParam = '';
            }
          } else {
            this.currentParam += ch;
          }
        }
        break;

      case csi:
        // '?', '>', '!'
        if (ch === '?' || ch === '>' || ch === '!') {
          this.prefix = ch;
          break;
        }

        // 0 - 9
        if (ch >= '0' && ch <= '9') {
          this.currentParam = this.currentParam * 10 + ch.charCodeAt(0) - 48;
          break;
        }

        // '$', '"', ' ', '\''
        if (ch === '$' || ch === '"' || ch === ' ' || ch === '\'') {
          this.postfix = ch;
          break;
        }

        this.params.push(this.currentParam);
        this.currentParam = 0;

        // ';'
        if (ch === ';') break;

        this.state = normal;

        switch (ch) {
          // CSI Ps A
          // Cursor Up Ps Times (default = 1) (CUU).
          case 'A':
            this.cursorUp(this.params);
            break;

          // CSI Ps B
          // Cursor Down Ps Times (default = 1) (CUD).
          case 'B':
            this.cursorDown(this.params);
            break;

          // CSI Ps C
          // Cursor Forward Ps Times (default = 1) (CUF).
          case 'C':
            this.cursorForward(this.params);
            break;

          // CSI Ps D
          // Cursor Backward Ps Times (default = 1) (CUB).
          case 'D':
            this.cursorBackward(this.params);
            break;

          // CSI Ps ; Ps H
          // Cursor Position [row;column] (default = [1,1]) (CUP).
          case 'H':
            this.cursorPos(this.params);
            break;

          // CSI Ps J  Erase in Display (ED).
          case 'J':
            this.eraseInDisplay(this.params);
            break;

          // CSI Ps K  Erase in Line (EL).
          case 'K':
            this.eraseInLine(this.params);
            break;

          // CSI Pm m  Character Attributes (SGR).
          case 'm':
            this.charAttributes(this.params);
            break;

          // CSI Ps n  Device Status Report (DSR).
          case 'n':
            this.deviceStatus(this.params);
            break;

          /**
           * Additions
           */

          // CSI Ps @
          // Insert Ps (Blank) Character(s) (default = 1) (ICH).
          case '@':
            this.insertChars(this.params);
            break;

          // CSI Ps E
          // Cursor Next Line Ps Times (default = 1) (CNL).
          case 'E':
            this.cursorNextLine(this.params);
            break;

          // CSI Ps F
          // Cursor Preceding Line Ps Times (default = 1) (CNL).
          case 'F':
            this.cursorPrecedingLine(this.params);
            break;

          // CSI Ps G
          // Cursor Character Absolute  [column] (default = [row,1]) (CHA).
          case 'G':
            this.cursorCharAbsolute(this.params);
            break;

          // CSI Ps L
          // Insert Ps Line(s) (default = 1) (IL).
          case 'L':
            this.insertLines(this.params);
            break;

          // CSI Ps M
          // Delete Ps Line(s) (default = 1) (DL).
          case 'M':
            this.deleteLines(this.params);
            break;

          // CSI Ps P
          // Delete Ps Character(s) (default = 1) (DCH).
          case 'P':
            this.deleteChars(this.params);
            break;

          // CSI Ps X
          // Erase Ps Character(s) (default = 1) (ECH).
          case 'X':
            this.eraseChars(this.params);
            break;

          // CSI Pm `  Character Position Absolute
          //   [column] (default = [row,1]) (HPA).
          case '`':
            this.charPosAbsolute(this.params);
            break;

          // 141 61 a * HPR -
          // Horizontal Position Relative
          case 'a':
            this.HPositionRelative(this.params);
            break;

          // CSI P s c
          // Send Device Attributes (Primary DA).
          // CSI > P s c
          // Send Device Attributes (Secondary DA)
          case 'c':
            this.sendDeviceAttributes(this.params);
            break;

          // CSI Pm d
          // Line Position Absolute  [row] (default = [1,column]) (VPA).
          case 'd':
            this.linePosAbsolute(this.params);
            break;

          // 145 65 e * VPR - Vertical Position Relative
          case 'e':
            this.VPositionRelative(this.params);
            break;

          // CSI Ps ; Ps f
          //   Horizontal and Vertical Position [row;column] (default =
          //   [1,1]) (HVP).
          case 'f':
            this.HVPosition(this.params);
            break;

          // CSI Pm h  Set Mode (SM).
          // CSI ? Pm h - mouse escape codes, cursor escape codes
          case 'h':
            this.setMode(this.params);
            break;

          // CSI Pm l  Reset Mode (RM).
          // CSI ? Pm l
          case 'l':
            this.resetMode(this.params);
            break;

          // CSI Ps ; Ps r
          //   Set Scrolling Region [top;bottom] (default = full size of win-
          //   dow) (DECSTBM).
          // CSI ? Pm r
          case 'r':
            this.setScrollRegion(this.params);
            break;

          // CSI s
          //   Save cursor (ANSI.SYS).
          case 's':
            this.saveCursor(this.params);
            break;

          // CSI u
          //   Restore cursor (ANSI.SYS).
          case 'u':
            this.restoreCursor(this.params);
            break;

          /**
           * Lesser Used
           */

          // CSI Ps I
          // Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
          case 'I':
            this.cursorForwardTab(this.params);
            break;

          // CSI Ps S  Scroll up Ps lines (default = 1) (SU).
          case 'S':
            this.scrollUp(this.params);
            break;

          // CSI Ps T  Scroll down Ps lines (default = 1) (SD).
          // CSI Ps ; Ps ; Ps ; Ps ; Ps T
          // CSI > Ps; Ps T
          case 'T':
            // if (this.prefix === '>') {
            //   this.resetTitleModes(this.params);
            //   break;
            // }
            // if (this.params.length > 2) {
            //   this.initMouseTracking(this.params);
            //   break;
            // }
            if (this.params.length < 2 && !this.prefix) {
              this.scrollDown(this.params);
            }
            break;

          // CSI Ps Z
          // Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
          case 'Z':
            this.cursorBackwardTab(this.params);
            break;

          // CSI Ps b  Repeat the preceding graphic character Ps times (REP).
          case 'b':
            this.repeatPrecedingCharacter(this.params);
            break;

          // CSI Ps g  Tab Clear (TBC).
          case 'g':
            this.tabClear(this.params);
            break;

          // CSI Pm i  Media Copy (MC).
          // CSI ? Pm i
          // case 'i':
          //   this.mediaCopy(this.params);
          //   break;

          // CSI Pm m  Character Attributes (SGR).
          // CSI > Ps; Ps m
          // case 'm': // duplicate
          //   if (this.prefix === '>') {
          //     this.setResources(this.params);
          //   } else {
          //     this.charAttributes(this.params);
          //   }
          //   break;

          // CSI Ps n  Device Status Report (DSR).
          // CSI > Ps n
          // case 'n': // duplicate
          //   if (this.prefix === '>') {
          //     this.disableModifiers(this.params);
          //   } else {
          //     this.deviceStatus(this.params);
          //   }
          //   break;

          // CSI > Ps p  Set pointer mode.
          // CSI ! p   Soft terminal reset (DECSTR).
          // CSI Ps$ p
          //   Request ANSI mode (DECRQM).
          // CSI ? Ps$ p
          //   Request DEC private mode (DECRQM).
          // CSI Ps ; Ps " p
          case 'p':
            switch (this.prefix) {
              // case '>':
              //   this.setPointerMode(this.params);
              //   break;
              case '!':
                this.softReset(this.params);
                break;
              // case '?':
              //   if (this.postfix === '$') {
              //     this.requestPrivateMode(this.params);
              //   }
              //   break;
              // default:
              //   if (this.postfix === '"') {
              //     this.setConformanceLevel(this.params);
              //   } else if (this.postfix === '$') {
              //     this.requestAnsiMode(this.params);
              //   }
              //   break;
            }
            break;

          // CSI Ps q  Load LEDs (DECLL).
          // CSI Ps SP q
          // CSI Ps " q
          // case 'q':
          //   if (this.postfix === ' ') {
          //     this.setCursorStyle(this.params);
          //     break;
          //   }
          //   if (this.postfix === '"') {
          //     this.setCharProtectionAttr(this.params);
          //     break;
          //   }
          //   this.loadLEDs(this.params);
          //   break;

          // CSI Ps ; Ps r
          //   Set Scrolling Region [top;bottom] (default = full size of win-
          //   dow) (DECSTBM).
          // CSI ? Pm r
          // CSI Pt; Pl; Pb; Pr; Ps$ r
          // case 'r': // duplicate
          //   if (this.prefix === '?') {
          //     this.restorePrivateValues(this.params);
          //   } else if (this.postfix === '$') {
          //     this.setAttrInRectangle(this.params);
          //   } else {
          //     this.setScrollRegion(this.params);
          //   }
          //   break;

          // CSI s     Save cursor (ANSI.SYS).
          // CSI ? Pm s
          // case 's': // duplicate
          //   if (this.prefix === '?') {
          //     this.savePrivateValues(this.params);
          //   } else {
          //     this.saveCursor(this.params);
          //   }
          //   break;

          // CSI Ps ; Ps ; Ps t
          // CSI Pt; Pl; Pb; Pr; Ps$ t
          // CSI > Ps; Ps t
          // CSI Ps SP t
          // case 't':
          //   if (this.postfix === '$') {
          //     this.reverseAttrInRectangle(this.params);
          //   } else if (this.postfix === ' ') {
          //     this.setWarningBellVolume(this.params);
          //   } else {
          //     if (this.prefix === '>') {
          //       this.setTitleModeFeature(this.params);
          //     } else {
          //       this.manipulateWindow(this.params);
          //     }
          //   }
          //   break;

          // CSI u     Restore cursor (ANSI.SYS).
          // CSI Ps SP u
          // case 'u': // duplicate
          //   if (this.postfix === ' ') {
          //     this.setMarginBellVolume(this.params);
          //   } else {
          //     this.restoreCursor(this.params);
          //   }
          //   break;

          // CSI Pt; Pl; Pb; Pr; Pp; Pt; Pl; Pp$ v
          // case 'v':
          //   if (this.postfix === '$') {
          //     this.copyRectagle(this.params);
          //   }
          //   break;

          // CSI Pt ; Pl ; Pb ; Pr ' w
          // case 'w':
          //   if (this.postfix === '\'') {
          //     this.enableFilterRectangle(this.params);
          //   }
          //   break;

          // CSI Ps x  Request Terminal Parameters (DECREQTPARM).
          // CSI Ps x  Select Attribute Change Extent (DECSACE).
          // CSI Pc; Pt; Pl; Pb; Pr$ x
          // case 'x':
          //   if (this.postfix === '$') {
          //     this.fillRectangle(this.params);
          //   } else {
          //     this.requestParameters(this.params);
          //     //this.__(this.params);
          //   }
          //   break;

          // CSI Ps ; Pu ' z
          // CSI Pt; Pl; Pb; Pr$ z
          // case 'z':
          //   if (this.postfix === '\'') {
          //     this.enableLocatorReporting(this.params);
          //   } else if (this.postfix === '$') {
          //     this.eraseRectangle(this.params);
          //   }
          //   break;

          // CSI Pm ' {
          // CSI Pt; Pl; Pb; Pr$ {
          // case '{':
          //   if (this.postfix === '\'') {
          //     this.setLocatorEvents(this.params);
          //   } else if (this.postfix === '$') {
          //     this.selectiveEraseRectangle(this.params);
          //   }
          //   break;

          // CSI Ps ' |
          // case '|':
          //   if (this.postfix === '\'') {
          //     this.requestLocatorPosition(this.params);
          //   }
          //   break;

          // CSI P m SP }
          // Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
          // case '}':
          //   if (this.postfix === ' ') {
          //     this.insertColumns(this.params);
          //   }
          //   break;

          // CSI P m SP ~
          // Delete P s Column(s) (default = 1) (DECDC), VT420 and up
          // case '~':
          //   if (this.postfix === ' ') {
          //     this.deleteColumns(this.params);
          //   }
          //   break;

          default:
            this.error('Unknown CSI code: %s.', ch);
            break;
        }

        this.prefix = '';
        this.postfix = '';
        break;

      case dcs:
        if (ch === '\x1b' || ch === '\x07') {
          if (ch === '\x1b') i++;

          switch (this.prefix) {
            // User-Defined Keys (DECUDK).
            case '':
              break;

            // Request Status String (DECRQSS).
            // test: echo -e '\eP$q"p\e\\'
            case '$q':
              var pt = this.currentParam
                , valid = false;

              switch (pt) {
                // DECSCA
                case '"q':
                  pt = '0"q';
                  break;

                // DECSCL
                case '"p':
                  pt = '61"p';
                  break;

                // DECSTBM
                case 'r':
                  pt = ''
                    + (this.scrollTop + 1)
                    + ';'
                    + (this.scrollBottom + 1)
                    + 'r';
                  break;

                // SGR
                case 'm':
                  pt = '0m';
                  break;

                default:
                  this.error('Unknown DCS Pt: %s.', pt);
                  pt = '';
                  break;
              }

              this.send('\x1bP' + +valid + '$r' + pt + '\x1b\\');
              break;

            // Set Termcap/Terminfo Data (xterm, experimental).
            case '+p':
              break;

            // Request Termcap/Terminfo String (xterm, experimental)
            // Regular xterm does not even respond to this sequence.
            // This can cause a small glitch in vim.
            // test: echo -ne '\eP+q6b64\e\\'
            case '+q':
              var pt = this.currentParam
                , valid = false;

              this.send('\x1bP' + +valid + '+r' + pt + '\x1b\\');
              break;

            default:
              this.error('Unknown DCS prefix: %s.', this.prefix);
              break;
          }

          this.currentParam = 0;
          this.prefix = '';
          this.state = normal;
        } else if (!this.currentParam) {
          if (!this.prefix && ch !== '$' && ch !== '+') {
            this.currentParam = ch;
          } else if (this.prefix.length === 2) {
            this.currentParam = ch;
          } else {
            this.prefix += ch;
          }
        } else {
          this.currentParam += ch;
        }
        break;

      case ignore:
        // For PM and APC.
        if (ch === '\x1b' || ch === '\x07') {
          if (ch === '\x1b') i++;
          this.state = normal;
        }
        break;
    }
  }

  this.updateRange(this.y);
  this.refresh(this.refreshStart, this.refreshEnd);
};

Terminal.prototype.writeln = function(data) {
  this.write(data + '\r\n');
};

Terminal.prototype.keyDown = function(ev) {
  var key;

  switch (ev.keyCode) {
    // backspace
    case 8:
      if (ev.shiftKey) {
        key = '\x08'; // ^H
        break;
      }
      key = '\x7f'; // ^?
      break;
    // tab
    case 9:
      if (ev.shiftKey) {
        key = '\x1b[Z';
        break;
      }
      key = '\t';
      break;
    // return/enter
    case 13:
      key = '\r';
      break;
    // escape
    case 27:
      key = '\x1b';
      break;
    // left-arrow
    case 37:
      if (this.applicationCursor) {
        key = '\x1bOD'; // SS3 as ^[O for 7-bit
        //key = '\x8fD'; // SS3 as 0x8f for 8-bit
        break;
      }
      key = '\x1b[D';
      break;
    // right-arrow
    case 39:
      if (this.applicationCursor) {
        key = '\x1bOC';
        break;
      }
      key = '\x1b[C';
      break;
    // up-arrow
    case 38:
      if (this.applicationCursor) {
        key = '\x1bOA';
        break;
      }
      if (ev.ctrlKey) {
        this.scrollDisp(-1);
        return cancel(ev);
      } else {
        key = '\x1b[A';
      }
      break;
    // down-arrow
    case 40:
      if (this.applicationCursor) {
        key = '\x1bOB';
        break;
      }
      if (ev.ctrlKey) {
        this.scrollDisp(1);
        return cancel(ev);
      } else {
        key = '\x1b[B';
      }
      break;
    // delete
    case 46:
      key = '\x1b[3~';
      break;
    // insert
    case 45:
      key = '\x1b[2~';
      break;
    // home
    case 36:
      if (this.applicationKeypad) {
        key = '\x1bOH';
        break;
      }
      key = '\x1bOH';
      break;
    // end
    case 35:
      if (this.applicationKeypad) {
        key = '\x1bOF';
        break;
      }
      key = '\x1bOF';
      break;
    // page up
    case 33:
      if (ev.shiftKey) {
        this.scrollDisp(-(this.rows - 1));
        return cancel(ev);
      } else {
        key = '\x1b[5~';
      }
      break;
    // page down
    case 34:
      if (ev.shiftKey) {
        this.scrollDisp(this.rows - 1);
        return cancel(ev);
      } else {
        key = '\x1b[6~';
      }
      break;
    // F1
    case 112:
      key = '\x1bOP';
      break;
    // F2
    case 113:
      key = '\x1bOQ';
      break;
    // F3
    case 114:
      key = '\x1bOR';
      break;
    // F4
    case 115:
      key = '\x1bOS';
      break;
    // F5
    case 116:
      key = '\x1b[15~';
      break;
    // F6
    case 117:
      key = '\x1b[17~';
      break;
    // F7
    case 118:
      key = '\x1b[18~';
      break;
    // F8
    case 119:
      key = '\x1b[19~';
      break;
    // F9
    case 120:
      key = '\x1b[20~';
      break;
    // F10
    case 121:
      key = '\x1b[21~';
      break;
    // F11
    case 122:
      key = '\x1b[23~';
      break;
    // F12
    case 123:
      key = '\x1b[24~';
      break;
    default:
      // a-z and space
      if (ev.ctrlKey) {
        if (ev.keyCode >= 65 && ev.keyCode <= 90) {
          key = String.fromCharCode(ev.keyCode - 64);
        } else if (ev.keyCode === 32) {
          // NUL
          key = String.fromCharCode(0);
        } else if (ev.keyCode >= 51 && ev.keyCode <= 55) {
          // escape, file sep, group sep, record sep, unit sep
          key = String.fromCharCode(ev.keyCode - 51 + 27);
        } else if (ev.keyCode === 56) {
          // delete
          key = String.fromCharCode(127);
        } else if (ev.keyCode === 219) {
          // ^[ - escape
          key = String.fromCharCode(27);
        } else if (ev.keyCode === 221) {
          // ^] - group sep
          key = String.fromCharCode(29);
        }
      } else if ((!isMac && ev.altKey) || (isMac && ev.metaKey)) {
        if (ev.keyCode >= 65 && ev.keyCode <= 90) {
          key = '\x1b' + String.fromCharCode(ev.keyCode + 32);
        } else if (ev.keyCode === 192) {
          key = '\x1b`';
        } else if (ev.keyCode >= 48 && ev.keyCode <= 57) {
          key = '\x1b' + (ev.keyCode - 48);
        }
      }
      break;
  }

  this.emit('keydown', ev);

  if (key) {
    this.emit('key', key, ev);

    this.showCursor();
    this.handler(key);

    return cancel(ev);
  }

  return true;
};

Terminal.prototype.setgLevel = function(g) {
  this.glevel = g;
  this.charset = this.charsets[g];
};

Terminal.prototype.setgCharset = function(g, charset) {
  this.charsets[g] = charset;
  if (this.glevel === g) {
    this.charset = charset;
  }
};

Terminal.prototype.keyPress = function(ev) {
  var key;

  cancel(ev);

  if (ev.charCode) {
    key = ev.charCode;
  } else if (ev.which == null) {
    key = ev.keyCode;
  } else if (ev.which !== 0 && ev.charCode !== 0) {
    key = ev.which;
  } else {
    return false;
  }

  if (!key || ev.ctrlKey || ev.altKey || ev.metaKey) return false;

  key = String.fromCharCode(key);

  this.emit('keypress', key, ev);
  this.emit('key', key, ev);

  this.showCursor();
  this.handler(key);

  return false;
};

Terminal.prototype.send = function(data) {
  var self = this;

  if (!this.queue) {
    setTimeout(function() {
      self.handler(self.queue);
      self.queue = '';
    }, 1);
  }

  this.queue += data;
};

Terminal.prototype.bell = function() {
  if (!Terminal.visualBell) return;
  var self = this;
  this.element.style.borderColor = 'white';
  setTimeout(function() {
    self.element.style.borderColor = '';
  }, 10);
  if (Terminal.popOnBell) this.focus();
};

Terminal.prototype.log = function() {
  if (!Terminal.debug) return;
  if (!window.console || !window.console.log) return;
  var args = Array.prototype.slice.call(arguments);
  window.console.log.apply(window.console, args);
};

Terminal.prototype.error = function() {
  if (!Terminal.debug) return;
  if (!window.console || !window.console.error) return;
  var args = Array.prototype.slice.call(arguments);
  window.console.error.apply(window.console, args);
};

Terminal.prototype.resize = function(x, y) {
  var line
    , el
    , i
    , j
    , ch;

  if (x < 1) x = 1;
  if (y < 1) y = 1;

  // resize cols
  j = this.cols;
  if (j < x) {
    ch = [this.defAttr, ' '];
    i = this.lines.length;
    while (i--) {
      while (this.lines[i].length < x) {
        this.lines[i].push(ch);
      }
    }
  } else if (j > x) {
    i = this.lines.length;
    while (i--) {
      while (this.lines[i].length > x) {
        this.lines[i].pop();
      }
    }
  }
  this.setupStops(j);
  this.cols = x;

  // resize rows
  j = this.rows;
  if (j < y) {
    el = this.element;
    while (j++ < y) {
      if (this.lines.length < y + this.ybase) {
        this.lines.push(this.blankLine());
      }
      if (this.children.length < y) {
        line = document.createElement('div');
        el.appendChild(line);
        this.children.push(line);
      }
    }
  } else if (j > y) {
    while (j-- > y) {
      if (this.lines.length > y + this.ybase) {
        this.lines.pop();
      }
      if (this.children.length > y) {
        el = this.children.pop();
        if (!el) continue;
        el.parentNode.removeChild(el);
      }
    }
  }
  this.rows = y;

  // make sure the cursor stays on screen
  if (this.y >= y) this.y = y - 1;
  if (this.x >= x) this.x = x - 1;

  this.scrollTop = 0;
  this.scrollBottom = y - 1;

  this.refresh(0, this.rows - 1);

  // it's a real nightmare trying
  // to resize the original
  // screen buffer. just set it
  // to null for now.
  this.normal = null;
};

Terminal.prototype.updateRange = function(y) {
  if (y < this.refreshStart) this.refreshStart = y;
  if (y > this.refreshEnd) this.refreshEnd = y;
  // if (y > this.refreshEnd) {
  //   this.refreshEnd = y;
  //   if (y > this.rows - 1) {
  //     this.refreshEnd = this.rows - 1;
  //   }
  // }
};

Terminal.prototype.maxRange = function() {
  this.refreshStart = 0;
  this.refreshEnd = this.rows - 1;
};

Terminal.prototype.setupStops = function(i) {
  if (i != null) {
    if (!this.tabs[i]) {
      i = this.prevStop(i);
    }
  } else {
    this.tabs = {};
    i = 0;
  }

  for (; i < this.cols; i += 8) {
    this.tabs[i] = true;
  }
};

Terminal.prototype.prevStop = function(x) {
  if (x == null) x = this.x;
  while (!this.tabs[--x] && x > 0);
  return x >= this.cols
    ? this.cols - 1
    : x < 0 ? 0 : x;
};

Terminal.prototype.nextStop = function(x) {
  if (x == null) x = this.x;
  while (!this.tabs[++x] && x < this.cols);
  return x >= this.cols
    ? this.cols - 1
    : x < 0 ? 0 : x;
};

Terminal.prototype.eraseRight = function(x, y) {
  var line = this.lines[this.ybase + y]
    , ch = [this.curAttr, ' ']; // xterm

  for (; x < this.cols; x++) {
    line[x] = ch;
  }

  this.updateRange(y);
};

Terminal.prototype.eraseLeft = function(x, y) {
  var line = this.lines[this.ybase + y]
    , ch = [this.curAttr, ' ']; // xterm

  x++;
  while (x--) line[x] = ch;

  this.updateRange(y);
};

Terminal.prototype.eraseLine = function(y) {
  this.eraseRight(0, y);
};

Terminal.prototype.blankLine = function(cur) {
  var attr = cur
    ? this.curAttr
    : this.defAttr;

  var ch = [attr, ' ']
    , line = []
    , i = 0;

  for (; i < this.cols; i++) {
    line[i] = ch;
  }

  return line;
};

Terminal.prototype.ch = function(cur) {
  return cur
    ? [this.curAttr, ' ']
    : [this.defAttr, ' '];
};

Terminal.prototype.is = function(term) {
  var name = this.termName || Terminal.termName;
  return (name + '').indexOf(term) === 0;
};

Terminal.prototype.handler = function(data) {
  this.emit('data', data);
};

Terminal.prototype.handleTitle = function(title) {
  this.emit('title', title);
};

/**
 * ESC
 */

// ESC D Index (IND is 0x84).
Terminal.prototype.index = function() {
  this.y++;
  if (this.y > this.scrollBottom) {
    this.y--;
    this.scroll();
  }
  this.state = normal;
};

// ESC M Reverse Index (RI is 0x8d).
Terminal.prototype.reverseIndex = function() {
  var j;
  this.y--;
  if (this.y < this.scrollTop) {
    this.y++;
    // possibly move the code below to term.reverseScroll();
    // test: echo -ne '\e[1;1H\e[44m\eM\e[0m'
    // blankLine(true) is xterm/linux behavior
    this.lines.splice(this.y + this.ybase, 0, this.blankLine(true));
    j = this.rows - 1 - this.scrollBottom;
    this.lines.splice(this.rows - 1 + this.ybase - j + 1, 1);
    // this.maxRange();
    this.updateRange(this.scrollTop);
    this.updateRange(this.scrollBottom);
  }
  this.state = normal;
};

// ESC c Full Reset (RIS).
Terminal.prototype.reset = function() {
  Terminal.call(this, this.cols, this.rows);
  this.refresh(0, this.rows - 1);
};

// ESC H Tab Set (HTS is 0x88).
Terminal.prototype.tabSet = function() {
  this.tabs[this.x] = true;
  this.state = normal;
};

/**
 * CSI
 */

// CSI Ps A
// Cursor Up Ps Times (default = 1) (CUU).
Terminal.prototype.cursorUp = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.y -= param;
  if (this.y < 0) this.y = 0;
};

// CSI Ps B
// Cursor Down Ps Times (default = 1) (CUD).
Terminal.prototype.cursorDown = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.y += param;
  if (this.y >= this.rows) {
    this.y = this.rows - 1;
  }
};

// CSI Ps C
// Cursor Forward Ps Times (default = 1) (CUF).
Terminal.prototype.cursorForward = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.x += param;
  if (this.x >= this.cols) {
    this.x = this.cols - 1;
  }
};

// CSI Ps D
// Cursor Backward Ps Times (default = 1) (CUB).
Terminal.prototype.cursorBackward = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.x -= param;
  if (this.x < 0) this.x = 0;
};

// CSI Ps ; Ps H
// Cursor Position [row;column] (default = [1,1]) (CUP).
Terminal.prototype.cursorPos = function(params) {
  var row, col;

  row = params[0] - 1;

  if (params.length >= 2) {
    col = params[1] - 1;
  } else {
    col = 0;
  }

  if (row < 0) {
    row = 0;
  } else if (row >= this.rows) {
    row = this.rows - 1;
  }

  if (col < 0) {
    col = 0;
  } else if (col >= this.cols) {
    col = this.cols - 1;
  }

  this.x = col;
  this.y = row;
};

// CSI Ps J  Erase in Display (ED).
//     Ps = 0  -> Erase Below (default).
//     Ps = 1  -> Erase Above.
//     Ps = 2  -> Erase All.
//     Ps = 3  -> Erase Saved Lines (xterm).
// CSI ? Ps J
//   Erase in Display (DECSED).
//     Ps = 0  -> Selective Erase Below (default).
//     Ps = 1  -> Selective Erase Above.
//     Ps = 2  -> Selective Erase All.
Terminal.prototype.eraseInDisplay = function(params) {
  var j;
  switch (params[0]) {
    case 0:
      this.eraseRight(this.x, this.y);
      j = this.y + 1;
      for (; j < this.rows; j++) {
        this.eraseLine(j);
      }
      break;
    case 1:
      this.eraseLeft(this.x, this.y);
      j = this.y;
      while (j--) {
        this.eraseLine(j);
      }
      break;
    case 2:
      j = this.rows;
      while (j--) this.eraseLine(j);
      break;
    case 3:
      ; // no saved lines
      break;
  }
};

// CSI Ps K  Erase in Line (EL).
//     Ps = 0  -> Erase to Right (default).
//     Ps = 1  -> Erase to Left.
//     Ps = 2  -> Erase All.
// CSI ? Ps K
//   Erase in Line (DECSEL).
//     Ps = 0  -> Selective Erase to Right (default).
//     Ps = 1  -> Selective Erase to Left.
//     Ps = 2  -> Selective Erase All.
Terminal.prototype.eraseInLine = function(params) {
  switch (params[0]) {
    case 0:
      this.eraseRight(this.x, this.y);
      break;
    case 1:
      this.eraseLeft(this.x, this.y);
      break;
    case 2:
      this.eraseLine(this.y);
      break;
  }
};

// CSI Pm m  Character Attributes (SGR).
//     Ps = 0  -> Normal (default).
//     Ps = 1  -> Bold.
//     Ps = 4  -> Underlined.
//     Ps = 5  -> Blink (appears as Bold).
//     Ps = 7  -> Inverse.
//     Ps = 8  -> Invisible, i.e., hidden (VT300).
//     Ps = 2 2  -> Normal (neither bold nor faint).
//     Ps = 2 4  -> Not underlined.
//     Ps = 2 5  -> Steady (not blinking).
//     Ps = 2 7  -> Positive (not inverse).
//     Ps = 2 8  -> Visible, i.e., not hidden (VT300).
//     Ps = 3 0  -> Set foreground color to Black.
//     Ps = 3 1  -> Set foreground color to Red.
//     Ps = 3 2  -> Set foreground color to Green.
//     Ps = 3 3  -> Set foreground color to Yellow.
//     Ps = 3 4  -> Set foreground color to Blue.
//     Ps = 3 5  -> Set foreground color to Magenta.
//     Ps = 3 6  -> Set foreground color to Cyan.
//     Ps = 3 7  -> Set foreground color to White.
//     Ps = 3 9  -> Set foreground color to default (original).
//     Ps = 4 0  -> Set background color to Black.
//     Ps = 4 1  -> Set background color to Red.
//     Ps = 4 2  -> Set background color to Green.
//     Ps = 4 3  -> Set background color to Yellow.
//     Ps = 4 4  -> Set background color to Blue.
//     Ps = 4 5  -> Set background color to Magenta.
//     Ps = 4 6  -> Set background color to Cyan.
//     Ps = 4 7  -> Set background color to White.
//     Ps = 4 9  -> Set background color to default (original).

//   If 16-color support is compiled, the following apply.  Assume
//   that xterm's resources are set so that the ISO color codes are
//   the first 8 of a set of 16.  Then the aixterm colors are the
//   bright versions of the ISO colors:
//     Ps = 9 0  -> Set foreground color to Black.
//     Ps = 9 1  -> Set foreground color to Red.
//     Ps = 9 2  -> Set foreground color to Green.
//     Ps = 9 3  -> Set foreground color to Yellow.
//     Ps = 9 4  -> Set foreground color to Blue.
//     Ps = 9 5  -> Set foreground color to Magenta.
//     Ps = 9 6  -> Set foreground color to Cyan.
//     Ps = 9 7  -> Set foreground color to White.
//     Ps = 1 0 0  -> Set background color to Black.
//     Ps = 1 0 1  -> Set background color to Red.
//     Ps = 1 0 2  -> Set background color to Green.
//     Ps = 1 0 3  -> Set background color to Yellow.
//     Ps = 1 0 4  -> Set background color to Blue.
//     Ps = 1 0 5  -> Set background color to Magenta.
//     Ps = 1 0 6  -> Set background color to Cyan.
//     Ps = 1 0 7  -> Set background color to White.

//   If xterm is compiled with the 16-color support disabled, it
//   supports the following, from rxvt:
//     Ps = 1 0 0  -> Set foreground and background color to
//     default.

//   If 88- or 256-color support is compiled, the following apply.
//     Ps = 3 8  ; 5  ; Ps -> Set foreground color to the second
//     Ps.
//     Ps = 4 8  ; 5  ; Ps -> Set background color to the second
//     Ps.
Terminal.prototype.charAttributes = function(params) {
  var l = params.length
    , i = 0
    , bg
    , fg
    , p;

  for (; i < l; i++) {
    p = params[i];
    if (p >= 30 && p <= 37) {
      // fg color 8
      this.curAttr = (this.curAttr & ~(0x1ff << 9)) | ((p - 30) << 9);
    } else if (p >= 40 && p <= 47) {
      // bg color 8
      this.curAttr = (this.curAttr & ~0x1ff) | (p - 40);
    } else if (p >= 90 && p <= 97) {
      // fg color 16
      p += 8;
      this.curAttr = (this.curAttr & ~(0x1ff << 9)) | ((p - 90) << 9);
    } else if (p >= 100 && p <= 107) {
      // bg color 16
      p += 8;
      this.curAttr = (this.curAttr & ~0x1ff) | (p - 100);
    } else if (p === 0) {
      // default
      this.curAttr = this.defAttr;
    } else if (p === 1) {
      // bold text
      this.curAttr = this.curAttr | (1 << 18);
    } else if (p === 4) {
      // underlined text
      this.curAttr = this.curAttr | (2 << 18);
    } else if (p === 7 || p === 27) {
      // inverse and positive
      // test with: echo -e '\e[31m\e[42mhello\e[7mworld\e[27mhi\e[m'
      if (p === 7) {
        if ((this.curAttr >> 18) & 4) continue;
        this.curAttr = this.curAttr | (4 << 18);
      } else if (p === 27) {
        if (~(this.curAttr >> 18) & 4) continue;
        this.curAttr = this.curAttr & ~(4 << 18);
      }

      bg = this.curAttr & 0x1ff;
      fg = (this.curAttr >> 9) & 0x1ff;

      this.curAttr = (this.curAttr & ~0x3ffff) | ((bg << 9) | fg);
    } else if (p === 22) {
      // not bold
      this.curAttr = this.curAttr & ~(1 << 18);
    } else if (p === 24) {
      // not underlined
      this.curAttr = this.curAttr & ~(2 << 18);
    } else if (p === 39) {
      // reset fg
      this.curAttr = this.curAttr & ~(0x1ff << 9);
      this.curAttr = this.curAttr | (((this.defAttr >> 9) & 0x1ff) << 9);
    } else if (p === 49) {
      // reset bg
      this.curAttr = this.curAttr & ~0x1ff;
      this.curAttr = this.curAttr | (this.defAttr & 0x1ff);
    } else if (p === 38) {
      // fg color 256
      if (params[i+1] !== 5) continue;
      i += 2;
      p = params[i] & 0xff;
      // convert 88 colors to 256
      // if (this.is('rxvt-unicode') && p < 88) p = p * 2.9090 | 0;
      this.curAttr = (this.curAttr & ~(0x1ff << 9)) | (p << 9);
    } else if (p === 48) {
      // bg color 256
      if (params[i+1] !== 5) continue;
      i += 2;
      p = params[i] & 0xff;
      // convert 88 colors to 256
      // if (this.is('rxvt-unicode') && p < 88) p = p * 2.9090 | 0;
      this.curAttr = (this.curAttr & ~0x1ff) | p;
    }
  }
};

// CSI Ps n  Device Status Report (DSR).
//     Ps = 5  -> Status Report.  Result (``OK'') is
//   CSI 0 n
//     Ps = 6  -> Report Cursor Position (CPR) [row;column].
//   Result is
//   CSI r ; c R
// CSI ? Ps n
//   Device Status Report (DSR, DEC-specific).
//     Ps = 6  -> Report Cursor Position (CPR) [row;column] as CSI
//     ? r ; c R (assumes page is zero).
//     Ps = 1 5  -> Report Printer status as CSI ? 1 0  n  (ready).
//     or CSI ? 1 1  n  (not ready).
//     Ps = 2 5  -> Report UDK status as CSI ? 2 0  n  (unlocked)
//     or CSI ? 2 1  n  (locked).
//     Ps = 2 6  -> Report Keyboard status as
//   CSI ? 2 7  ;  1  ;  0  ;  0  n  (North American).
//   The last two parameters apply to VT400 & up, and denote key-
//   board ready and LK01 respectively.
//     Ps = 5 3  -> Report Locator status as
//   CSI ? 5 3  n  Locator available, if compiled-in, or
//   CSI ? 5 0  n  No Locator, if not.
Terminal.prototype.deviceStatus = function(params) {
  if (!this.prefix) {
    switch (params[0]) {
      case 5:
        // status report
        this.send('\x1b[0n');
        break;
      case 6:
        // cursor position
        this.send('\x1b['
          + (this.y + 1)
          + ';'
          + (this.x + 1)
          + 'R');
        break;
    }
  } else if (this.prefix === '?') {
    // modern xterm doesnt seem to
    // respond to any of these except ?6, 6, and 5
    switch (params[0]) {
      case 6:
        // cursor position
        this.send('\x1b[?'
          + (this.y + 1)
          + ';'
          + (this.x + 1)
          + 'R');
        break;
      case 15:
        // no printer
        // this.send('\x1b[?11n');
        break;
      case 25:
        // dont support user defined keys
        // this.send('\x1b[?21n');
        break;
      case 26:
        // north american keyboard
        // this.send('\x1b[?27;1;0;0n');
        break;
      case 53:
        // no dec locator/mouse
        // this.send('\x1b[?50n');
        break;
    }
  }
};

/**
 * Additions
 */

// CSI Ps @
// Insert Ps (Blank) Character(s) (default = 1) (ICH).
Terminal.prototype.insertChars = function(params) {
  var param, row, j, ch;

  param = params[0];
  if (param < 1) param = 1;

  row = this.y + this.ybase;
  j = this.x;
  ch = [this.curAttr, ' ']; // xterm

  while (param-- && j < this.cols) {
    this.lines[row].splice(j++, 0, ch);
    this.lines[row].pop();
  }
};

// CSI Ps E
// Cursor Next Line Ps Times (default = 1) (CNL).
// same as CSI Ps B ?
Terminal.prototype.cursorNextLine = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.y += param;
  if (this.y >= this.rows) {
    this.y = this.rows - 1;
  }
  this.x = 0;
};

// CSI Ps F
// Cursor Preceding Line Ps Times (default = 1) (CNL).
// reuse CSI Ps A ?
Terminal.prototype.cursorPrecedingLine = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.y -= param;
  if (this.y < 0) this.y = 0;
  this.x = 0;
};

// CSI Ps G
// Cursor Character Absolute  [column] (default = [row,1]) (CHA).
Terminal.prototype.cursorCharAbsolute = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.x = param - 1;
};

// CSI Ps L
// Insert Ps Line(s) (default = 1) (IL).
Terminal.prototype.insertLines = function(params) {
  var param, row, j;

  param = params[0];
  if (param < 1) param = 1;
  row = this.y + this.ybase;

  j = this.rows - 1 - this.scrollBottom;
  j = this.rows - 1 + this.ybase - j + 1;

  while (param--) {
    // test: echo -e '\e[44m\e[1L\e[0m'
    // blankLine(true) - xterm/linux behavior
    this.lines.splice(row, 0, this.blankLine(true));
    this.lines.splice(j, 1);
  }

  // this.maxRange();
  this.updateRange(this.y);
  this.updateRange(this.scrollBottom);
};

// CSI Ps M
// Delete Ps Line(s) (default = 1) (DL).
Terminal.prototype.deleteLines = function(params) {
  var param, row, j;

  param = params[0];
  if (param < 1) param = 1;
  row = this.y + this.ybase;

  j = this.rows - 1 - this.scrollBottom;
  j = this.rows - 1 + this.ybase - j;

  while (param--) {
    // test: echo -e '\e[44m\e[1M\e[0m'
    // blankLine(true) - xterm/linux behavior
    this.lines.splice(j + 1, 0, this.blankLine(true));
    this.lines.splice(row, 1);
  }

  // this.maxRange();
  this.updateRange(this.y);
  this.updateRange(this.scrollBottom);
};

// CSI Ps P
// Delete Ps Character(s) (default = 1) (DCH).
Terminal.prototype.deleteChars = function(params) {
  var param, row, ch;

  param = params[0];
  if (param < 1) param = 1;

  row = this.y + this.ybase;
  ch = [this.curAttr, ' ']; // xterm

  while (param--) {
    this.lines[row].splice(this.x, 1);
    this.lines[row].push(ch);
  }
};

// CSI Ps X
// Erase Ps Character(s) (default = 1) (ECH).
Terminal.prototype.eraseChars = function(params) {
  var param, row, j, ch;

  param = params[0];
  if (param < 1) param = 1;

  row = this.y + this.ybase;
  j = this.x;
  ch = [this.curAttr, ' ']; // xterm

  while (param-- && j < this.cols) {
    this.lines[row][j++] = ch;
  }
};

// CSI Pm `  Character Position Absolute
//   [column] (default = [row,1]) (HPA).
Terminal.prototype.charPosAbsolute = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.x = param - 1;
  if (this.x >= this.cols) {
    this.x = this.cols - 1;
  }
};

// 141 61 a * HPR -
// Horizontal Position Relative
// reuse CSI Ps C ?
Terminal.prototype.HPositionRelative = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.x += param;
  if (this.x >= this.cols) {
    this.x = this.cols - 1;
  }
};

// CSI Ps c  Send Device Attributes (Primary DA).
//     Ps = 0  or omitted -> request attributes from terminal.  The
//     response depends on the decTerminalID resource setting.
//     -> CSI ? 1 ; 2 c  (``VT100 with Advanced Video Option'')
//     -> CSI ? 1 ; 0 c  (``VT101 with No Options'')
//     -> CSI ? 6 c  (``VT102'')
//     -> CSI ? 6 0 ; 1 ; 2 ; 6 ; 8 ; 9 ; 1 5 ; c  (``VT220'')
//   The VT100-style response parameters do not mean anything by
//   themselves.  VT220 parameters do, telling the host what fea-
//   tures the terminal supports:
//     Ps = 1  -> 132-columns.
//     Ps = 2  -> Printer.
//     Ps = 6  -> Selective erase.
//     Ps = 8  -> User-defined keys.
//     Ps = 9  -> National replacement character sets.
//     Ps = 1 5  -> Technical characters.
//     Ps = 2 2  -> ANSI color, e.g., VT525.
//     Ps = 2 9  -> ANSI text locator (i.e., DEC Locator mode).
// CSI > Ps c
//   Send Device Attributes (Secondary DA).
//     Ps = 0  or omitted -> request the terminal's identification
//     code.  The response depends on the decTerminalID resource set-
//     ting.  It should apply only to VT220 and up, but xterm extends
//     this to VT100.
//     -> CSI  > Pp ; Pv ; Pc c
//   where Pp denotes the terminal type
//     Pp = 0  -> ``VT100''.
//     Pp = 1  -> ``VT220''.
//   and Pv is the firmware version (for xterm, this was originally
//   the XFree86 patch number, starting with 95).  In a DEC termi-
//   nal, Pc indicates the ROM cartridge registration number and is
//   always zero.
// More information:
//   xterm/charproc.c - line 2012, for more information.
//   vim responds with ^[[?0c or ^[[?1c after the terminal's response (?)
Terminal.prototype.sendDeviceAttributes = function(params) {
  if (params[0] > 0) return;

  if (!this.prefix) {
    if (this.is('xterm')
        || this.is('rxvt-unicode')
        || this.is('screen')) {
      this.send('\x1b[?1;2c');
    } else if (this.is('linux')) {
      this.send('\x1b[?6c');
    }
  } else if (this.prefix === '>') {
    // xterm and urxvt
    // seem to spit this
    // out around ~370 times (?).
    if (this.is('xterm')) {
      this.send('\x1b[>0;276;0c');
    } else if (this.is('rxvt-unicode')) {
      this.send('\x1b[>85;95;0c');
    } else if (this.is('linux')) {
      // not supported by linux console.
      // linux console echoes parameters.
      this.send(params[0] + 'c');
    } else if (this.is('screen')) {
      this.send('\x1b[>83;40003;0c');
    }
  }
};

// CSI Pm d
// Line Position Absolute  [row] (default = [1,column]) (VPA).
Terminal.prototype.linePosAbsolute = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.y = param - 1;
  if (this.y >= this.rows) {
    this.y = this.rows - 1;
  }
};

// 145 65 e * VPR - Vertical Position Relative
// reuse CSI Ps B ?
Terminal.prototype.VPositionRelative = function(params) {
  var param = params[0];
  if (param < 1) param = 1;
  this.y += param;
  if (this.y >= this.rows) {
    this.y = this.rows - 1;
  }
};

// CSI Ps ; Ps f
//   Horizontal and Vertical Position [row;column] (default =
//   [1,1]) (HVP).
Terminal.prototype.HVPosition = function(params) {
  if (params[0] < 1) params[0] = 1;
  if (params[1] < 1) params[1] = 1;

  this.y = params[0] - 1;
  if (this.y >= this.rows) {
    this.y = this.rows - 1;
  }

  this.x = params[1] - 1;
  if (this.x >= this.cols) {
    this.x = this.cols - 1;
  }
};

// CSI Pm h  Set Mode (SM).
//     Ps = 2  -> Keyboard Action Mode (AM).
//     Ps = 4  -> Insert Mode (IRM).
//     Ps = 1 2  -> Send/receive (SRM).
//     Ps = 2 0  -> Automatic Newline (LNM).
// CSI ? Pm h
//   DEC Private Mode Set (DECSET).
//     Ps = 1  -> Application Cursor Keys (DECCKM).
//     Ps = 2  -> Designate USASCII for character sets G0-G3
//     (DECANM), and set VT100 mode.
//     Ps = 3  -> 132 Column Mode (DECCOLM).
//     Ps = 4  -> Smooth (Slow) Scroll (DECSCLM).
//     Ps = 5  -> Reverse Video (DECSCNM).
//     Ps = 6  -> Origin Mode (DECOM).
//     Ps = 7  -> Wraparound Mode (DECAWM).
//     Ps = 8  -> Auto-repeat Keys (DECARM).
//     Ps = 9  -> Send Mouse X & Y on button press.  See the sec-
//     tion Mouse Tracking.
//     Ps = 1 0  -> Show toolbar (rxvt).
//     Ps = 1 2  -> Start Blinking Cursor (att610).
//     Ps = 1 8  -> Print form feed (DECPFF).
//     Ps = 1 9  -> Set print extent to full screen (DECPEX).
//     Ps = 2 5  -> Show Cursor (DECTCEM).
//     Ps = 3 0  -> Show scrollbar (rxvt).
//     Ps = 3 5  -> Enable font-shifting functions (rxvt).
//     Ps = 3 8  -> Enter Tektronix Mode (DECTEK).
//     Ps = 4 0  -> Allow 80 -> 132 Mode.
//     Ps = 4 1  -> more(1) fix (see curses resource).
//     Ps = 4 2  -> Enable Nation Replacement Character sets (DECN-
//     RCM).
//     Ps = 4 4  -> Turn On Margin Bell.
//     Ps = 4 5  -> Reverse-wraparound Mode.
//     Ps = 4 6  -> Start Logging.  This is normally disabled by a
//     compile-time option.
//     Ps = 4 7  -> Use Alternate Screen Buffer.  (This may be dis-
//     abled by the titeInhibit resource).
//     Ps = 6 6  -> Application keypad (DECNKM).
//     Ps = 6 7  -> Backarrow key sends backspace (DECBKM).
//     Ps = 1 0 0 0  -> Send Mouse X & Y on button press and
//     release.  See the section Mouse Tracking.
//     Ps = 1 0 0 1  -> Use Hilite Mouse Tracking.
//     Ps = 1 0 0 2  -> Use Cell Motion Mouse Tracking.
//     Ps = 1 0 0 3  -> Use All Motion Mouse Tracking.
//     Ps = 1 0 0 4  -> Send FocusIn/FocusOut events.
//     Ps = 1 0 0 5  -> Enable Extended Mouse Mode.
//     Ps = 1 0 1 0  -> Scroll to bottom on tty output (rxvt).
//     Ps = 1 0 1 1  -> Scroll to bottom on key press (rxvt).
//     Ps = 1 0 3 4  -> Interpret "meta" key, sets eighth bit.
//     (enables the eightBitInput resource).
//     Ps = 1 0 3 5  -> Enable special modifiers for Alt and Num-
//     Lock keys.  (This enables the numLock resource).
//     Ps = 1 0 3 6  -> Send ESC   when Meta modifies a key.  (This
//     enables the metaSendsEscape resource).
//     Ps = 1 0 3 7  -> Send DEL from the editing-keypad Delete
//     key.
//     Ps = 1 0 3 9  -> Send ESC  when Alt modifies a key.  (This
//     enables the altSendsEscape resource).
//     Ps = 1 0 4 0  -> Keep selection even if not highlighted.
//     (This enables the keepSelection resource).
//     Ps = 1 0 4 1  -> Use the CLIPBOARD selection.  (This enables
//     the selectToClipboard resource).
//     Ps = 1 0 4 2  -> Enable Urgency window manager hint when
//     Control-G is received.  (This enables the bellIsUrgent
//     resource).
//     Ps = 1 0 4 3  -> Enable raising of the window when Control-G
//     is received.  (enables the popOnBell resource).
//     Ps = 1 0 4 7  -> Use Alternate Screen Buffer.  (This may be
//     disabled by the titeInhibit resource).
//     Ps = 1 0 4 8  -> Save cursor as in DECSC.  (This may be dis-
//     abled by the titeInhibit resource).
//     Ps = 1 0 4 9  -> Save cursor as in DECSC and use Alternate
//     Screen Buffer, clearing it first.  (This may be disabled by
//     the titeInhibit resource).  This combines the effects of the 1
//     0 4 7  and 1 0 4 8  modes.  Use this with terminfo-based
//     applications rather than the 4 7  mode.
//     Ps = 1 0 5 0  -> Set terminfo/termcap function-key mode.
//     Ps = 1 0 5 1  -> Set Sun function-key mode.
//     Ps = 1 0 5 2  -> Set HP function-key mode.
//     Ps = 1 0 5 3  -> Set SCO function-key mode.
//     Ps = 1 0 6 0  -> Set legacy keyboard emulation (X11R6).
//     Ps = 1 0 6 1  -> Set VT220 keyboard emulation.
//     Ps = 2 0 0 4  -> Set bracketed paste mode.
// Modes:
//   http://vt100.net/docs/vt220-rm/chapter4.html
Terminal.prototype.setMode = function(params) {
  if (typeof params === 'object') {
    var l = params.length
      , i = 0;

    for (; i < l; i++) {
      this.setMode(params[i]);
    }

    return;
  }

  if (!this.prefix) {
    switch (params) {
      case 4:
        this.insertMode = true;
        break;
      case 20:
        //this.convertEol = true;
        break;
    }
  } else if (this.prefix === '?') {
    switch (params) {
      case 1:
        this.applicationCursor = true;
        break;
      case 2:
        this.setgCharset(0, Terminal.charsets.US);
        this.setgCharset(1, Terminal.charsets.US);
        this.setgCharset(2, Terminal.charsets.US);
        this.setgCharset(3, Terminal.charsets.US);
        // set VT100 mode here
        break;
      case 3: // 132 col mode
        this.savedCols = this.cols;
        this.resize(132, this.rows);
        break;
      case 6:
        this.originMode = true;
        break;
      case 7:
        this.wraparoundMode = true;
        break;
      case 12:
        // this.cursorBlink = true;
        break;
      case 9: // X10 Mouse
        // no release, no motion, no wheel, no modifiers.
      case 1000: // vt200 mouse
        // no motion.
        // no modifiers, except control on the wheel.
      case 1002: // button event mouse
      case 1003: // any event mouse
        // any event - sends motion events,
        // even if there is no button held down.
        this.x10Mouse = params === 9;
        this.vt200Mouse = params === 1000;
        this.normalMouse = params > 1000;
        this.mouseEvents = true;
        this.element.style.cursor = 'default';
        this.log('Binding to mouse events.');
        break;
      case 1004: // send focusin/focusout events
        // focusin: ^[[I
        // focusout: ^[[O
        this.sendFocus = true;
        break;
      case 1005: // utf8 ext mode mouse
        this.utfMouse = true;
        // for wide terminals
        // simply encodes large values as utf8 characters
        break;
      case 1006: // sgr ext mode mouse
        this.sgrMouse = true;
        // for wide terminals
        // does not add 32 to fields
        // press: ^[[<b;x;yM
        // release: ^[[<b;x;ym
        break;
      case 1015: // urxvt ext mode mouse
        this.urxvtMouse = true;
        // for wide terminals
        // numbers for fields
        // press: ^[[b;x;yM
        // motion: ^[[b;x;yT
        break;
      case 25: // show cursor
        this.cursorHidden = false;
        break;
      case 1049: // alt screen buffer cursor
        //this.saveCursor();
        ; // FALL-THROUGH
      case 47: // alt screen buffer
      case 1047: // alt screen buffer
        if (!this.normal) {
          var normal = {
            lines: this.lines,
            ybase: this.ybase,
            ydisp: this.ydisp,
            x: this.x,
            y: this.y,
            scrollTop: this.scrollTop,
            scrollBottom: this.scrollBottom,
            tabs: this.tabs
            // XXX save charset(s) here?
            // charset: this.charset,
            // glevel: this.glevel,
            // charsets: this.charsets
          };
          this.reset();
          this.normal = normal;
          this.showCursor();
        }
        break;
    }
  }
};

// CSI Pm l  Reset Mode (RM).
//     Ps = 2  -> Keyboard Action Mode (AM).
//     Ps = 4  -> Replace Mode (IRM).
//     Ps = 1 2  -> Send/receive (SRM).
//     Ps = 2 0  -> Normal Linefeed (LNM).
// CSI ? Pm l
//   DEC Private Mode Reset (DECRST).
//     Ps = 1  -> Normal Cursor Keys (DECCKM).
//     Ps = 2  -> Designate VT52 mode (DECANM).
//     Ps = 3  -> 80 Column Mode (DECCOLM).
//     Ps = 4  -> Jump (Fast) Scroll (DECSCLM).
//     Ps = 5  -> Normal Video (DECSCNM).
//     Ps = 6  -> Normal Cursor Mode (DECOM).
//     Ps = 7  -> No Wraparound Mode (DECAWM).
//     Ps = 8  -> No Auto-repeat Keys (DECARM).
//     Ps = 9  -> Don't send Mouse X & Y on button press.
//     Ps = 1 0  -> Hide toolbar (rxvt).
//     Ps = 1 2  -> Stop Blinking Cursor (att610).
//     Ps = 1 8  -> Don't print form feed (DECPFF).
//     Ps = 1 9  -> Limit print to scrolling region (DECPEX).
//     Ps = 2 5  -> Hide Cursor (DECTCEM).
//     Ps = 3 0  -> Don't show scrollbar (rxvt).
//     Ps = 3 5  -> Disable font-shifting functions (rxvt).
//     Ps = 4 0  -> Disallow 80 -> 132 Mode.
//     Ps = 4 1  -> No more(1) fix (see curses resource).
//     Ps = 4 2  -> Disable Nation Replacement Character sets (DEC-
//     NRCM).
//     Ps = 4 4  -> Turn Off Margin Bell.
//     Ps = 4 5  -> No Reverse-wraparound Mode.
//     Ps = 4 6  -> Stop Logging.  (This is normally disabled by a
//     compile-time option).
//     Ps = 4 7  -> Use Normal Screen Buffer.
//     Ps = 6 6  -> Numeric keypad (DECNKM).
//     Ps = 6 7  -> Backarrow key sends delete (DECBKM).
//     Ps = 1 0 0 0  -> Don't send Mouse X & Y on button press and
//     release.  See the section Mouse Tracking.
//     Ps = 1 0 0 1  -> Don't use Hilite Mouse Tracking.
//     Ps = 1 0 0 2  -> Don't use Cell Motion Mouse Tracking.
//     Ps = 1 0 0 3  -> Don't use All Motion Mouse Tracking.
//     Ps = 1 0 0 4  -> Don't send FocusIn/FocusOut events.
//     Ps = 1 0 0 5  -> Disable Extended Mouse Mode.
//     Ps = 1 0 1 0  -> Don't scroll to bottom on tty output
//     (rxvt).
//     Ps = 1 0 1 1  -> Don't scroll to bottom on key press (rxvt).
//     Ps = 1 0 3 4  -> Don't interpret "meta" key.  (This disables
//     the eightBitInput resource).
//     Ps = 1 0 3 5  -> Disable special modifiers for Alt and Num-
//     Lock keys.  (This disables the numLock resource).
//     Ps = 1 0 3 6  -> Don't send ESC  when Meta modifies a key.
//     (This disables the metaSendsEscape resource).
//     Ps = 1 0 3 7  -> Send VT220 Remove from the editing-keypad
//     Delete key.
//     Ps = 1 0 3 9  -> Don't send ESC  when Alt modifies a key.
//     (This disables the altSendsEscape resource).
//     Ps = 1 0 4 0  -> Do not keep selection when not highlighted.
//     (This disables the keepSelection resource).
//     Ps = 1 0 4 1  -> Use the PRIMARY selection.  (This disables
//     the selectToClipboard resource).
//     Ps = 1 0 4 2  -> Disable Urgency window manager hint when
//     Control-G is received.  (This disables the bellIsUrgent
//     resource).
//     Ps = 1 0 4 3  -> Disable raising of the window when Control-
//     G is received.  (This disables the popOnBell resource).
//     Ps = 1 0 4 7  -> Use Normal Screen Buffer, clearing screen
//     first if in the Alternate Screen.  (This may be disabled by
//     the titeInhibit resource).
//     Ps = 1 0 4 8  -> Restore cursor as in DECRC.  (This may be
//     disabled by the titeInhibit resource).
//     Ps = 1 0 4 9  -> Use Normal Screen Buffer and restore cursor
//     as in DECRC.  (This may be disabled by the titeInhibit
//     resource).  This combines the effects of the 1 0 4 7  and 1 0
//     4 8  modes.  Use this with terminfo-based applications rather
//     than the 4 7  mode.
//     Ps = 1 0 5 0  -> Reset terminfo/termcap function-key mode.
//     Ps = 1 0 5 1  -> Reset Sun function-key mode.
//     Ps = 1 0 5 2  -> Reset HP function-key mode.
//     Ps = 1 0 5 3  -> Reset SCO function-key mode.
//     Ps = 1 0 6 0  -> Reset legacy keyboard emulation (X11R6).
//     Ps = 1 0 6 1  -> Reset keyboard emulation to Sun/PC style.
//     Ps = 2 0 0 4  -> Reset bracketed paste mode.
Terminal.prototype.resetMode = function(params) {
  if (typeof params === 'object') {
    var l = params.length
      , i = 0;

    for (; i < l; i++) {
      this.resetMode(params[i]);
    }

    return;
  }

  if (!this.prefix) {
    switch (params) {
      case 4:
        this.insertMode = false;
        break;
      case 20:
        //this.convertEol = false;
        break;
    }
  } else if (this.prefix === '?') {
    switch (params) {
      case 1:
        this.applicationCursor = false;
        break;
      case 3:
        if (this.cols === 132 && this.savedCols) {
          this.resize(this.savedCols, this.rows);
        }
        delete this.savedCols;
        break;
      case 6:
        this.originMode = false;
        break;
      case 7:
        this.wraparoundMode = false;
        break;
      case 12:
        // this.cursorBlink = false;
        break;
      case 9: // X10 Mouse
      case 1000: // vt200 mouse
      case 1002: // button event mouse
      case 1003: // any event mouse
        this.x10Mouse = false;
        this.vt200Mouse = false;
        this.normalMouse = false;
        this.mouseEvents = false;
        this.element.style.cursor = '';
        break;
      case 1004: // send focusin/focusout events
        this.sendFocus = false;
        break;
      case 1005: // utf8 ext mode mouse
        this.utfMouse = false;
        break;
      case 1006: // sgr ext mode mouse
        this.sgrMouse = false;
        break;
      case 1015: // urxvt ext mode mouse
        this.urxvtMouse = false;
        break;
      case 25: // hide cursor
        this.cursorHidden = true;
        break;
      case 1049: // alt screen buffer cursor
        ; // FALL-THROUGH
      case 47: // normal screen buffer
      case 1047: // normal screen buffer - clearing it first
        if (this.normal) {
          this.lines = this.normal.lines;
          this.ybase = this.normal.ybase;
          this.ydisp = this.normal.ydisp;
          this.x = this.normal.x;
          this.y = this.normal.y;
          this.scrollTop = this.normal.scrollTop;
          this.scrollBottom = this.normal.scrollBottom;
          this.tabs = this.normal.tabs;
          this.normal = null;
          // if (params === 1049) {
          //   this.x = this.savedX;
          //   this.y = this.savedY;
          // }
          this.refresh(0, this.rows - 1);
          this.showCursor();
        }
        break;
    }
  }
};

// CSI Ps ; Ps r
//   Set Scrolling Region [top;bottom] (default = full size of win-
//   dow) (DECSTBM).
// CSI ? Pm r
Terminal.prototype.setScrollRegion = function(params) {
  if (this.prefix) return;
  this.scrollTop = (params[0] || 1) - 1;
  this.scrollBottom = (params[1] || this.rows) - 1;
  this.x = 0;
  this.y = 0;
};

// CSI s
//   Save cursor (ANSI.SYS).
Terminal.prototype.saveCursor = function(params) {
  this.savedX = this.x;
  this.savedY = this.y;
};

// CSI u
//   Restore cursor (ANSI.SYS).
Terminal.prototype.restoreCursor = function(params) {
  this.x = this.savedX || 0;
  this.y = this.savedY || 0;
};

/**
 * Lesser Used
 */

// CSI Ps I
//   Cursor Forward Tabulation Ps tab stops (default = 1) (CHT).
Terminal.prototype.cursorForwardTab = function(params) {
  var param = params[0] || 1;
  while (param--) {
    this.x = this.nextStop();
  }
};

// CSI Ps S  Scroll up Ps lines (default = 1) (SU).
Terminal.prototype.scrollUp = function(params) {
  var param = params[0] || 1;
  while (param--) {
    this.lines.splice(this.ybase + this.scrollTop, 1);
    this.lines.splice(this.ybase + this.scrollBottom, 0, this.blankLine());
  }
  // this.maxRange();
  this.updateRange(this.scrollTop);
  this.updateRange(this.scrollBottom);
};

// CSI Ps T  Scroll down Ps lines (default = 1) (SD).
Terminal.prototype.scrollDown = function(params) {
  var param = params[0] || 1;
  while (param--) {
    this.lines.splice(this.ybase + this.scrollBottom, 1);
    this.lines.splice(this.ybase + this.scrollTop, 0, this.blankLine());
  }
  // this.maxRange();
  this.updateRange(this.scrollTop);
  this.updateRange(this.scrollBottom);
};

// CSI Ps ; Ps ; Ps ; Ps ; Ps T
//   Initiate highlight mouse tracking.  Parameters are
//   [func;startx;starty;firstrow;lastrow].  See the section Mouse
//   Tracking.
Terminal.prototype.initMouseTracking = function(params) {
  // Relevant: DECSET 1001
};

// CSI > Ps; Ps T
//   Reset one or more features of the title modes to the default
//   value.  Normally, "reset" disables the feature.  It is possi-
//   ble to disable the ability to reset features by compiling a
//   different default for the title modes into xterm.
//     Ps = 0  -> Do not set window/icon labels using hexadecimal.
//     Ps = 1  -> Do not query window/icon labels using hexadeci-
//     mal.
//     Ps = 2  -> Do not set window/icon labels using UTF-8.
//     Ps = 3  -> Do not query window/icon labels using UTF-8.
//   (See discussion of "Title Modes").
Terminal.prototype.resetTitleModes = function(params) {
  ;
};

// CSI Ps Z  Cursor Backward Tabulation Ps tab stops (default = 1) (CBT).
Terminal.prototype.cursorBackwardTab = function(params) {
  var param = params[0] || 1;
  while (param--) {
    this.x = this.prevStop();
  }
};

// CSI Ps b  Repeat the preceding graphic character Ps times (REP).
Terminal.prototype.repeatPrecedingCharacter = function(params) {
  var param = params[0] || 1
    , line = this.lines[this.ybase + this.y]
    , ch = line[this.x - 1] || [this.defAttr, ' '];

  while (param--) line[this.x++] = ch;
};

// CSI Ps g  Tab Clear (TBC).
//     Ps = 0  -> Clear Current Column (default).
//     Ps = 3  -> Clear All.
// Potentially:
//   Ps = 2  -> Clear Stops on Line.
//   http://vt100.net/annarbor/aaa-ug/section6.html
Terminal.prototype.tabClear = function(params) {
  var param = params[0];
  if (param <= 0) {
    delete this.tabs[this.x];
  } else if (param === 3) {
    this.tabs = {};
  }
};

// CSI Pm i  Media Copy (MC).
//     Ps = 0  -> Print screen (default).
//     Ps = 4  -> Turn off printer controller mode.
//     Ps = 5  -> Turn on printer controller mode.
// CSI ? Pm i
//   Media Copy (MC, DEC-specific).
//     Ps = 1  -> Print line containing cursor.
//     Ps = 4  -> Turn off autoprint mode.
//     Ps = 5  -> Turn on autoprint mode.
//     Ps = 1  0  -> Print composed display, ignores DECPEX.
//     Ps = 1  1  -> Print all pages.
Terminal.prototype.mediaCopy = function(params) {
  ;
};

// CSI > Ps; Ps m
//   Set or reset resource-values used by xterm to decide whether
//   to construct escape sequences holding information about the
//   modifiers pressed with a given key.  The first parameter iden-
//   tifies the resource to set/reset.  The second parameter is the
//   value to assign to the resource.  If the second parameter is
//   omitted, the resource is reset to its initial value.
//     Ps = 1  -> modifyCursorKeys.
//     Ps = 2  -> modifyFunctionKeys.
//     Ps = 4  -> modifyOtherKeys.
//   If no parameters are given, all resources are reset to their
//   initial values.
Terminal.prototype.setResources = function(params) {
  ;
};

// CSI > Ps n
//   Disable modifiers which may be enabled via the CSI > Ps; Ps m
//   sequence.  This corresponds to a resource value of "-1", which
//   cannot be set with the other sequence.  The parameter identi-
//   fies the resource to be disabled:
//     Ps = 1  -> modifyCursorKeys.
//     Ps = 2  -> modifyFunctionKeys.
//     Ps = 4  -> modifyOtherKeys.
//   If the parameter is omitted, modifyFunctionKeys is disabled.
//   When modifyFunctionKeys is disabled, xterm uses the modifier
//   keys to make an extended sequence of functions rather than
//   adding a parameter to each function key to denote the modi-
//   fiers.
Terminal.prototype.disableModifiers = function(params) {
  ;
};

// CSI > Ps p
//   Set resource value pointerMode.  This is used by xterm to
//   decide whether to hide the pointer cursor as the user types.
//   Valid values for the parameter:
//     Ps = 0  -> never hide the pointer.
//     Ps = 1  -> hide if the mouse tracking mode is not enabled.
//     Ps = 2  -> always hide the pointer.  If no parameter is
//     given, xterm uses the default, which is 1 .
Terminal.prototype.setPointerMode = function(params) {
  ;
};

// CSI ! p   Soft terminal reset (DECSTR).
// http://vt100.net/docs/vt220-rm/table4-10.html
Terminal.prototype.softReset = function(params) {
  this.cursorHidden = false;
  this.insertMode = false;
  this.originMode = false;
  this.wraparoundMode = false; // autowrap
  this.applicationKeypad = false; // ?
  this.applicationCursor = false;
  this.scrollTop = 0;
  this.scrollBottom = this.rows - 1;
  this.curAttr = this.defAttr;
  this.x = this.y = 0; // ?
  this.charset = null;
  this.glevel = 0; // ??
  this.charsets = [null]; // ??
};

// CSI Ps$ p
//   Request ANSI mode (DECRQM).  For VT300 and up, reply is
//     CSI Ps; Pm$ y
//   where Ps is the mode number as in RM, and Pm is the mode
//   value:
//     0 - not recognized
//     1 - set
//     2 - reset
//     3 - permanently set
//     4 - permanently reset
Terminal.prototype.requestAnsiMode = function(params) {
  ;
};

// CSI ? Ps$ p
//   Request DEC private mode (DECRQM).  For VT300 and up, reply is
//     CSI ? Ps; Pm$ p
//   where Ps is the mode number as in DECSET, Pm is the mode value
//   as in the ANSI DECRQM.
Terminal.prototype.requestPrivateMode = function(params) {
  ;
};

// CSI Ps ; Ps " p
//   Set conformance level (DECSCL).  Valid values for the first
//   parameter:
//     Ps = 6 1  -> VT100.
//     Ps = 6 2  -> VT200.
//     Ps = 6 3  -> VT300.
//   Valid values for the second parameter:
//     Ps = 0  -> 8-bit controls.
//     Ps = 1  -> 7-bit controls (always set for VT100).
//     Ps = 2  -> 8-bit controls.
Terminal.prototype.setConformanceLevel = function(params) {
  ;
};

// CSI Ps q  Load LEDs (DECLL).
//     Ps = 0  -> Clear all LEDS (default).
//     Ps = 1  -> Light Num Lock.
//     Ps = 2  -> Light Caps Lock.
//     Ps = 3  -> Light Scroll Lock.
//     Ps = 2  1  -> Extinguish Num Lock.
//     Ps = 2  2  -> Extinguish Caps Lock.
//     Ps = 2  3  -> Extinguish Scroll Lock.
Terminal.prototype.loadLEDs = function(params) {
  ;
};

// CSI Ps SP q
//   Set cursor style (DECSCUSR, VT520).
//     Ps = 0  -> blinking block.
//     Ps = 1  -> blinking block (default).
//     Ps = 2  -> steady block.
//     Ps = 3  -> blinking underline.
//     Ps = 4  -> steady underline.
Terminal.prototype.setCursorStyle = function(params) {
  ;
};

// CSI Ps " q
//   Select character protection attribute (DECSCA).  Valid values
//   for the parameter:
//     Ps = 0  -> DECSED and DECSEL can erase (default).
//     Ps = 1  -> DECSED and DECSEL cannot erase.
//     Ps = 2  -> DECSED and DECSEL can erase.
Terminal.prototype.setCharProtectionAttr = function(params) {
  ;
};

// CSI ? Pm r
//   Restore DEC Private Mode Values.  The value of Ps previously
//   saved is restored.  Ps values are the same as for DECSET.
Terminal.prototype.restorePrivateValues = function(params) {
  ;
};

// CSI Pt; Pl; Pb; Pr; Ps$ r
//   Change Attributes in Rectangular Area (DECCARA), VT400 and up.
//     Pt; Pl; Pb; Pr denotes the rectangle.
//     Ps denotes the SGR attributes to change: 0, 1, 4, 5, 7.
// NOTE: xterm doesn't enable this code by default.
Terminal.prototype.setAttrInRectangle = function(params) {
  var t = params[0]
    , l = params[1]
    , b = params[2]
    , r = params[3]
    , attr = params[4];

  var line
    , i;

  for (; t < b + 1; t++) {
    line = this.lines[this.ybase + t];
    for (i = l; i < r; i++) {
      line[i] = [attr, line[i][1]];
    }
  }

  // this.maxRange();
  this.updateRange(params[0]);
  this.updateRange(params[2]);
};

// CSI ? Pm s
//   Save DEC Private Mode Values.  Ps values are the same as for
//   DECSET.
Terminal.prototype.savePrivateValues = function(params) {
  ;
};

// CSI Ps ; Ps ; Ps t
//   Window manipulation (from dtterm, as well as extensions).
//   These controls may be disabled using the allowWindowOps
//   resource.  Valid values for the first (and any additional
//   parameters) are:
//     Ps = 1  -> De-iconify window.
//     Ps = 2  -> Iconify window.
//     Ps = 3  ;  x ;  y -> Move window to [x, y].
//     Ps = 4  ;  height ;  width -> Resize the xterm window to
//     height and width in pixels.
//     Ps = 5  -> Raise the xterm window to the front of the stack-
//     ing order.
//     Ps = 6  -> Lower the xterm window to the bottom of the
//     stacking order.
//     Ps = 7  -> Refresh the xterm window.
//     Ps = 8  ;  height ;  width -> Resize the text area to
//     [height;width] in characters.
//     Ps = 9  ;  0  -> Restore maximized window.
//     Ps = 9  ;  1  -> Maximize window (i.e., resize to screen
//     size).
//     Ps = 1 0  ;  0  -> Undo full-screen mode.
//     Ps = 1 0  ;  1  -> Change to full-screen.
//     Ps = 1 1  -> Report xterm window state.  If the xterm window
//     is open (non-iconified), it returns CSI 1 t .  If the xterm
//     window is iconified, it returns CSI 2 t .
//     Ps = 1 3  -> Report xterm window position.  Result is CSI 3
//     ; x ; y t
//     Ps = 1 4  -> Report xterm window in pixels.  Result is CSI
//     4  ;  height ;  width t
//     Ps = 1 8  -> Report the size of the text area in characters.
//     Result is CSI  8  ;  height ;  width t
//     Ps = 1 9  -> Report the size of the screen in characters.
//     Result is CSI  9  ;  height ;  width t
//     Ps = 2 0  -> Report xterm window's icon label.  Result is
//     OSC  L  label ST
//     Ps = 2 1  -> Report xterm window's title.  Result is OSC  l
//     label ST
//     Ps = 2 2  ;  0  -> Save xterm icon and window title on
//     stack.
//     Ps = 2 2  ;  1  -> Save xterm icon title on stack.
//     Ps = 2 2  ;  2  -> Save xterm window title on stack.
//     Ps = 2 3  ;  0  -> Restore xterm icon and window title from
//     stack.
//     Ps = 2 3  ;  1  -> Restore xterm icon title from stack.
//     Ps = 2 3  ;  2  -> Restore xterm window title from stack.
//     Ps >= 2 4  -> Resize to Ps lines (DECSLPP).
Terminal.prototype.manipulateWindow = function(params) {
  ;
};

// CSI Pt; Pl; Pb; Pr; Ps$ t
//   Reverse Attributes in Rectangular Area (DECRARA), VT400 and
//   up.
//     Pt; Pl; Pb; Pr denotes the rectangle.
//     Ps denotes the attributes to reverse, i.e.,  1, 4, 5, 7.
// NOTE: xterm doesn't enable this code by default.
Terminal.prototype.reverseAttrInRectangle = function(params) {
  ;
};

// CSI > Ps; Ps t
//   Set one or more features of the title modes.  Each parameter
//   enables a single feature.
//     Ps = 0  -> Set window/icon labels using hexadecimal.
//     Ps = 1  -> Query window/icon labels using hexadecimal.
//     Ps = 2  -> Set window/icon labels using UTF-8.
//     Ps = 3  -> Query window/icon labels using UTF-8.  (See dis-
//     cussion of "Title Modes")
Terminal.prototype.setTitleModeFeature = function(params) {
  ;
};

// CSI Ps SP t
//   Set warning-bell volume (DECSWBV, VT520).
//     Ps = 0  or 1  -> off.
//     Ps = 2 , 3  or 4  -> low.
//     Ps = 5 , 6 , 7 , or 8  -> high.
Terminal.prototype.setWarningBellVolume = function(params) {
  ;
};

// CSI Ps SP u
//   Set margin-bell volume (DECSMBV, VT520).
//     Ps = 1  -> off.
//     Ps = 2 , 3  or 4  -> low.
//     Ps = 0 , 5 , 6 , 7 , or 8  -> high.
Terminal.prototype.setMarginBellVolume = function(params) {
  ;
};

// CSI Pt; Pl; Pb; Pr; Pp; Pt; Pl; Pp$ v
//   Copy Rectangular Area (DECCRA, VT400 and up).
//     Pt; Pl; Pb; Pr denotes the rectangle.
//     Pp denotes the source page.
//     Pt; Pl denotes the target location.
//     Pp denotes the target page.
// NOTE: xterm doesn't enable this code by default.
Terminal.prototype.copyRectangle = function(params) {
  ;
};

// CSI Pt ; Pl ; Pb ; Pr ' w
//   Enable Filter Rectangle (DECEFR), VT420 and up.
//   Parameters are [top;left;bottom;right].
//   Defines the coordinates of a filter rectangle and activates
//   it.  Anytime the locator is detected outside of the filter
//   rectangle, an outside rectangle event is generated and the
//   rectangle is disabled.  Filter rectangles are always treated
//   as "one-shot" events.  Any parameters that are omitted default
//   to the current locator position.  If all parameters are omit-
//   ted, any locator motion will be reported.  DECELR always can-
//   cels any prevous rectangle definition.
Terminal.prototype.enableFilterRectangle = function(params) {
  ;
};

// CSI Ps x  Request Terminal Parameters (DECREQTPARM).
//   if Ps is a "0" (default) or "1", and xterm is emulating VT100,
//   the control sequence elicits a response of the same form whose
//   parameters describe the terminal:
//     Ps -> the given Ps incremented by 2.
//     Pn = 1  <- no parity.
//     Pn = 1  <- eight bits.
//     Pn = 1  <- 2  8  transmit 38.4k baud.
//     Pn = 1  <- 2  8  receive 38.4k baud.
//     Pn = 1  <- clock multiplier.
//     Pn = 0  <- STP flags.
Terminal.prototype.requestParameters = function(params) {
  ;
};

// CSI Ps x  Select Attribute Change Extent (DECSACE).
//     Ps = 0  -> from start to end position, wrapped.
//     Ps = 1  -> from start to end position, wrapped.
//     Ps = 2  -> rectangle (exact).
Terminal.prototype.selectChangeExtent = function(params) {
  ;
};

// CSI Pc; Pt; Pl; Pb; Pr$ x
//   Fill Rectangular Area (DECFRA), VT420 and up.
//     Pc is the character to use.
//     Pt; Pl; Pb; Pr denotes the rectangle.
// NOTE: xterm doesn't enable this code by default.
Terminal.prototype.fillRectangle = function(params) {
  var ch = params[0]
    , t = params[1]
    , l = params[2]
    , b = params[3]
    , r = params[4];

  var line
    , i;

  for (; t < b + 1; t++) {
    line = this.lines[this.ybase + t];
    for (i = l; i < r; i++) {
      line[i] = [line[i][0], String.fromCharCode(ch)];
    }
  }

  // this.maxRange();
  this.updateRange(params[1]);
  this.updateRange(params[3]);
};

// CSI Ps ; Pu ' z
//   Enable Locator Reporting (DECELR).
//   Valid values for the first parameter:
//     Ps = 0  -> Locator disabled (default).
//     Ps = 1  -> Locator enabled.
//     Ps = 2  -> Locator enabled for one report, then disabled.
//   The second parameter specifies the coordinate unit for locator
//   reports.
//   Valid values for the second parameter:
//     Pu = 0  <- or omitted -> default to character cells.
//     Pu = 1  <- device physical pixels.
//     Pu = 2  <- character cells.
Terminal.prototype.enableLocatorReporting = function(params) {
  var val = params[0] > 0;
  //this.mouseEvents = val;
  //this.decLocator = val;
};

// CSI Pt; Pl; Pb; Pr$ z
//   Erase Rectangular Area (DECERA), VT400 and up.
//     Pt; Pl; Pb; Pr denotes the rectangle.
// NOTE: xterm doesn't enable this code by default.
Terminal.prototype.eraseRectangle = function(params) {
  var t = params[0]
    , l = params[1]
    , b = params[2]
    , r = params[3];

  var line
    , i
    , ch;

  ch = [this.curAttr, ' ']; // xterm?

  for (; t < b + 1; t++) {
    line = this.lines[this.ybase + t];
    for (i = l; i < r; i++) {
      line[i] = ch;
    }
  }

  // this.maxRange();
  this.updateRange(params[0]);
  this.updateRange(params[2]);
};

// CSI Pm ' {
//   Select Locator Events (DECSLE).
//   Valid values for the first (and any additional parameters)
//   are:
//     Ps = 0  -> only respond to explicit host requests (DECRQLP).
//                (This is default).  It also cancels any filter
//   rectangle.
//     Ps = 1  -> report button down transitions.
//     Ps = 2  -> do not report button down transitions.
//     Ps = 3  -> report button up transitions.
//     Ps = 4  -> do not report button up transitions.
Terminal.prototype.setLocatorEvents = function(params) {
  ;
};

// CSI Pt; Pl; Pb; Pr$ {
//   Selective Erase Rectangular Area (DECSERA), VT400 and up.
//     Pt; Pl; Pb; Pr denotes the rectangle.
Terminal.prototype.selectiveEraseRectangle = function(params) {
  ;
};

// CSI Ps ' |
//   Request Locator Position (DECRQLP).
//   Valid values for the parameter are:
//     Ps = 0 , 1 or omitted -> transmit a single DECLRP locator
//     report.

//   If Locator Reporting has been enabled by a DECELR, xterm will
//   respond with a DECLRP Locator Report.  This report is also
//   generated on button up and down events if they have been
//   enabled with a DECSLE, or when the locator is detected outside
//   of a filter rectangle, if filter rectangles have been enabled
//   with a DECEFR.

//     -> CSI Pe ; Pb ; Pr ; Pc ; Pp &  w

//   Parameters are [event;button;row;column;page].
//   Valid values for the event:
//     Pe = 0  -> locator unavailable - no other parameters sent.
//     Pe = 1  -> request - xterm received a DECRQLP.
//     Pe = 2  -> left button down.
//     Pe = 3  -> left button up.
//     Pe = 4  -> middle button down.
//     Pe = 5  -> middle button up.
//     Pe = 6  -> right button down.
//     Pe = 7  -> right button up.
//     Pe = 8  -> M4 button down.
//     Pe = 9  -> M4 button up.
//     Pe = 1 0  -> locator outside filter rectangle.
//   ``button'' parameter is a bitmask indicating which buttons are
//     pressed:
//     Pb = 0  <- no buttons down.
//     Pb & 1  <- right button down.
//     Pb & 2  <- middle button down.
//     Pb & 4  <- left button down.
//     Pb & 8  <- M4 button down.
//   ``row'' and ``column'' parameters are the coordinates of the
//     locator position in the xterm window, encoded as ASCII deci-
//     mal.
//   The ``page'' parameter is not used by xterm, and will be omit-
//   ted.
Terminal.prototype.requestLocatorPosition = function(params) {
  ;
};

// CSI P m SP }
// Insert P s Column(s) (default = 1) (DECIC), VT420 and up.
// NOTE: xterm doesn't enable this code by default.
Terminal.prototype.insertColumns = function() {
  var param = params[0]
    , l = this.ybase + this.rows
    , ch = [this.curAttr, ' '] // xterm?
    , i;

  while (param--) {
    for (i = this.ybase; i < l; i++) {
      this.lines[i].splice(this.x + 1, 0, ch);
      this.lines[i].pop();
    }
  }

  this.maxRange();
};

// CSI P m SP ~
// Delete P s Column(s) (default = 1) (DECDC), VT420 and up
// NOTE: xterm doesn't enable this code by default.
Terminal.prototype.deleteColumns = function() {
  var param = params[0]
    , l = this.ybase + this.rows
    , ch = [this.curAttr, ' '] // xterm?
    , i;

  while (param--) {
    for (i = this.ybase; i < l; i++) {
      this.lines[i].splice(this.x, 1);
      this.lines[i].push(ch);
    }
  }

  this.maxRange();
};

/**
 * Character Sets
 */

Terminal.charsets = {};

// DEC Special Character and Line Drawing Set.
// http://vt100.net/docs/vt102-ug/table5-13.html
// A lot of curses apps use this if they see TERM=xterm.
// testing: echo -e '\e(0a\e(B'
// The xterm output sometimes seems to conflict with the
// reference above. xterm seems in line with the reference
// when running vttest however.
// The table below now uses xterm's output from vttest.
Terminal.charsets.SCLD = { // (0
  '`': '\u25c6', // '◆'
  'a': '\u2592', // '▒'
  'b': '\u0009', // '\t'
  'c': '\u000c', // '\f'
  'd': '\u000d', // '\r'
  'e': '\u000a', // '\n'
  'f': '\u00b0', // '°'
  'g': '\u00b1', // '±'
  'h': '\u2424', // '\u2424' (NL)
  'i': '\u000b', // '\v'
  'j': '\u2518', // '┘'
  'k': '\u2510', // '┐'
  'l': '\u250c', // '┌'
  'm': '\u2514', // '└'
  'n': '\u253c', // '┼'
  'o': '\u23ba', // '⎺'
  'p': '\u23bb', // '⎻'
  'q': '\u2500', // '─'
  'r': '\u23bc', // '⎼'
  's': '\u23bd', // '⎽'
  't': '\u251c', // '├'
  'u': '\u2524', // '┤'
  'v': '\u2534', // '┴'
  'w': '\u252c', // '┬'
  'x': '\u2502', // '│'
  'y': '\u2264', // '≤'
  'z': '\u2265', // '≥'
  '{': '\u03c0', // 'π'
  '|': '\u2260', // '≠'
  '}': '\u00a3', // '£'
  '~': '\u00b7'  // '·'
};

Terminal.charsets.UK = null; // (A
Terminal.charsets.US = null; // (B (USASCII)
Terminal.charsets.Dutch = null; // (4
Terminal.charsets.Finnish = null; // (C or (5
Terminal.charsets.French = null; // (R
Terminal.charsets.FrenchCanadian = null; // (Q
Terminal.charsets.German = null; // (K
Terminal.charsets.Italian = null; // (Y
Terminal.charsets.NorwegianDanish = null; // (E or (6
Terminal.charsets.Spanish = null; // (Z
Terminal.charsets.Swedish = null; // (H or (7
Terminal.charsets.Swiss = null; // (=
Terminal.charsets.ISOLatin = null; // /A

/**
 * Helpers
 */

function on(el, type, handler, capture) {
  el.addEventListener(type, handler, capture || false);
}

function off(el, type, handler, capture) {
  el.removeEventListener(type, handler, capture || false);
}

function cancel(ev) {
  if (ev.preventDefault) ev.preventDefault();
  ev.returnValue = false;
  if (ev.stopPropagation) ev.stopPropagation();
  ev.cancelBubble = true;
  return false;
}

function inherits(child, parent) {
  function f() {
    this.constructor = child;
  }
  f.prototype = parent.prototype;
  child.prototype = new f;
}

var isMac = ~navigator.userAgent.indexOf('Mac');

// if bold is broken, we can't
// use it in the terminal.
function isBoldBroken() {
  var el = document.createElement('span');
  el.innerHTML = 'hello world';
  document.body.appendChild(el);
  var w1 = el.scrollWidth;
  el.style.fontWeight = 'bold';
  var w2 = el.scrollWidth;
  document.body.removeChild(el);
  return w1 !== w2;
}

var String = this.String;
var setTimeout = this.setTimeout;
var setInterval = this.setInterval;

/**
 * Expose
 */

Terminal.EventEmitter = EventEmitter;
Terminal.isMac = isMac;
Terminal.inherits = inherits;
Terminal.on = on;
Terminal.off = off;
Terminal.cancel = cancel;

if (typeof module !== 'undefined') {
  module.exports = Terminal;
} else {
  this.Terminal = Terminal;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());

})(self)
},{}]},{},[1])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9jbGllbnQvdGVybS5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLWJ1aWx0aW5zL2J1aWx0aW4vZXZlbnRzLmpzIiwiL1VzZXJzL2h0aWxmb3JkL2RvY2t3b3JrZXIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItYnVpbHRpbnMvYnVpbHRpbi9zdHJlYW0uanMiLCIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1idWlsdGlucy9idWlsdGluL3V0aWwuanMiLCIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvaW5zZXJ0LW1vZHVsZS1nbG9iYWxzL25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9ub2RlX21vZHVsZXMvZG5vZGUvYnJvd3Nlci5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9kbm9kZS9saWIvZG5vZGUuanMiLCIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9ub2RlX21vZHVsZXMvZG5vZGUvbm9kZV9tb2R1bGVzL2Rub2RlLXByb3RvY29sL2luZGV4LmpzIiwiL1VzZXJzL2h0aWxmb3JkL2RvY2t3b3JrZXIvbm9kZV9tb2R1bGVzL2Rub2RlL25vZGVfbW9kdWxlcy9kbm9kZS1wcm90b2NvbC9saWIvZm9yZWFjaC5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9kbm9kZS9ub2RlX21vZHVsZXMvZG5vZGUtcHJvdG9jb2wvbGliL2lzX2VudW0uanMiLCIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9ub2RlX21vZHVsZXMvZG5vZGUvbm9kZV9tb2R1bGVzL2Rub2RlLXByb3RvY29sL2xpYi9rZXlzLmpzIiwiL1VzZXJzL2h0aWxmb3JkL2RvY2t3b3JrZXIvbm9kZV9tb2R1bGVzL2Rub2RlL25vZGVfbW9kdWxlcy9kbm9kZS1wcm90b2NvbC9saWIvc2NydWIuanMiLCIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9ub2RlX21vZHVsZXMvZG5vZGUvbm9kZV9tb2R1bGVzL2Rub2RlLXByb3RvY29sL25vZGVfbW9kdWxlcy90cmF2ZXJzZS9pbmRleC5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9kbm9kZS9ub2RlX21vZHVsZXMvanNvbmlmeS9pbmRleC5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9kbm9kZS9ub2RlX21vZHVsZXMvanNvbmlmeS9saWIvcGFyc2UuanMiLCIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9ub2RlX21vZHVsZXMvZG5vZGUvbm9kZV9tb2R1bGVzL2pzb25pZnkvbGliL3N0cmluZ2lmeS5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9tdXgtZGVtdXgvaW5kZXguanMiLCIvVXNlcnMvaHRpbGZvcmQvZG9ja3dvcmtlci9ub2RlX21vZHVsZXMvbXV4LWRlbXV4L2luamVjdC5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9tdXgtZGVtdXgvbm9kZV9tb2R1bGVzL2R1cGxleC9pbmRleC5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9tdXgtZGVtdXgvbm9kZV9tb2R1bGVzL3N0cmVhbS1zZXJpYWxpemVyL2luZGV4LmpzIiwiL1VzZXJzL2h0aWxmb3JkL2RvY2t3b3JrZXIvbm9kZV9tb2R1bGVzL211eC1kZW11eC9ub2RlX21vZHVsZXMvdGhyb3VnaC9pbmRleC5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9tdXgtZGVtdXgvbm9kZV9tb2R1bGVzL3h0ZW5kL2luZGV4LmpzIiwiL1VzZXJzL2h0aWxmb3JkL2RvY2t3b3JrZXIvbm9kZV9tb2R1bGVzL3Nob2UvYnJvd3Nlci5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy9zaG9lL25vZGVfbW9kdWxlcy9zb2NranMtY2xpZW50L3NvY2tqcy5qcyIsIi9Vc2Vycy9odGlsZm9yZC9kb2Nrd29ya2VyL25vZGVfbW9kdWxlcy90dHkuanMvc3RhdGljL3Rlcm0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0VEE7QUFDQTtBQUNBOztBQ0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcHhFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbInZhciBzaG9lID0gcmVxdWlyZSgnc2hvZScpO1xudmFyIGRub2RlID0gcmVxdWlyZSgnZG5vZGUnKTtcbnZhciBNdXhEZW11eCA9IHJlcXVpcmUoJ211eC1kZW11eCcpO1xudmFyIFRlcm1pbmFsID0gcmVxdWlyZSgndHR5LmpzL3N0YXRpYy90ZXJtJyk7XG52YXIgcmVtb3RlUmVzaXplO1xuXG53aW5kb3cuc3RhcnQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdHJlYW0gPSBzaG9lKCdodHRwOi8vbG9jYWxob3N0OjE1MDAwL3Rlcm1pbmFsJyk7XG4gIHN0cmVhbS5waXBlKE11eERlbXV4KGZ1bmN0aW9uIChzdHJlYW0pIHtcbiAgICBpZiAoc3RyZWFtLm1ldGEgPT09ICdwdHknKSB7XG4gICAgICBvblB0eShzdHJlYW0pO1xuICAgIH1cbiAgICBpZiAoc3RyZWFtLm1ldGEgPT09ICdkbm9kZScpIHtcbiAgICAgIG9uRG5vZGUoc3RyZWFtKTtcbiAgICB9XG4gIH0pKS5waXBlKHN0cmVhbSk7XG59O1xuXG5mdW5jdGlvbiBvblB0eSAoc3RyZWFtKSB7XG4gIHZhciB0ZXJtID0gbmV3IFRlcm1pbmFsKDgwLCAzMCwgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICBzdHJlYW0ud3JpdGUoZGF0YSk7XG4gIH0pO1xuICB0ZXJtLm9wZW4oKTtcbiAgc3RyZWFtLnBpcGUodGVybSk7XG4gIHRlcm0uZW5kID0gdGVybS5kZXN0cm95O1xuXG4gIHZhciBpbnRlcnZhbCA9IHNldEludGVydmFsKHJlc2l6ZSw1MDApO1xuICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgfSwgMjAwMCk7XG4gIGZ1bmN0aW9uIHJlc2l6ZSAoKSB7XG4gICAgeCA9IGRvY3VtZW50LmJvZHkuY2xpZW50V2lkdGggLyB0ZXJtLmVsZW1lbnQub2Zmc2V0V2lkdGg7XG4gICAgeSA9IGRvY3VtZW50LmJvZHkuY2xpZW50SGVpZ2h0IC8gdGVybS5lbGVtZW50Lm9mZnNldEhlaWdodDtcbiAgICB4ID0gKHggKiB0ZXJtLmNvbHMpIHwgMDtcbiAgICB5ID0gKHkgKiB0ZXJtLnJvd3MpIHwgMDtcbiAgICB4IC09IDE7XG4gICAgeSAtPSAyO1xuICAgIHRlcm0ucmVzaXplKHgsIHkpO1xuICAgIGlmICh0eXBlb2YgcmVtb3RlUmVzaXplID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZW1vdGVSZXNpemUoeCwgeSk7XG4gICAgfVxuICB9XG4gIHdpbmRvdy5vbnJlc2l6ZSA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIHJlc2l6ZSgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG9uRG5vZGUgKHN0cmVhbSkge1xuICB2YXIgZCA9IGRub2RlKCk7XG4gIGQub24oJ3JlbW90ZScsIGZ1bmN0aW9uIChyZW1vdGUpIHtcbiAgICByZW1vdGVSZXNpemUgPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgICAgcmVtb3RlLnJlc2l6ZSh4LCB5KTtcbiAgICB9XG4gIH0pO1xuICBzdHJlYW0ucGlwZShkKS5waXBlKHN0cmVhbSk7XG59IiwiKGZ1bmN0aW9uKHByb2Nlc3Mpe2lmICghcHJvY2Vzcy5FdmVudEVtaXR0ZXIpIHByb2Nlc3MuRXZlbnRFbWl0dGVyID0gZnVuY3Rpb24gKCkge307XG5cbnZhciBFdmVudEVtaXR0ZXIgPSBleHBvcnRzLkV2ZW50RW1pdHRlciA9IHByb2Nlc3MuRXZlbnRFbWl0dGVyO1xudmFyIGlzQXJyYXkgPSB0eXBlb2YgQXJyYXkuaXNBcnJheSA9PT0gJ2Z1bmN0aW9uJ1xuICAgID8gQXJyYXkuaXNBcnJheVxuICAgIDogZnVuY3Rpb24gKHhzKSB7XG4gICAgICAgIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoeHMpID09PSAnW29iamVjdCBBcnJheV0nXG4gICAgfVxuO1xuZnVuY3Rpb24gaW5kZXhPZiAoeHMsIHgpIHtcbiAgICBpZiAoeHMuaW5kZXhPZikgcmV0dXJuIHhzLmluZGV4T2YoeCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoeCA9PT0geHNbaV0pIHJldHVybiBpO1xuICAgIH1cbiAgICByZXR1cm4gLTE7XG59XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW5cbi8vIDEwIGxpc3RlbmVycyBhcmUgYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaFxuLy8gaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG4vL1xuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbnZhciBkZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCF0aGlzLl9ldmVudHMpIHRoaXMuX2V2ZW50cyA9IHt9O1xuICB0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzID0gbjtcbn07XG5cblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNBcnJheSh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSlcbiAgICB7XG4gICAgICBpZiAoYXJndW1lbnRzWzFdIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgYXJndW1lbnRzWzFdOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5jYXVnaHQsIHVuc3BlY2lmaWVkICdlcnJvcicgZXZlbnQuXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGlmICghdGhpcy5fZXZlbnRzKSByZXR1cm4gZmFsc2U7XG4gIHZhciBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBpZiAoIWhhbmRsZXIpIHJldHVybiBmYWxzZTtcblxuICBpZiAodHlwZW9mIGhhbmRsZXIgPT0gJ2Z1bmN0aW9uJykge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuXG4gIH0gZWxzZSBpZiAoaXNBcnJheShoYW5kbGVyKSkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIHZhciBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBsaXN0ZW5lcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59O1xuXG4vLyBFdmVudEVtaXR0ZXIgaXMgZGVmaW5lZCBpbiBzcmMvbm9kZV9ldmVudHMuY2Ncbi8vIEV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCgpIGlzIGFsc28gZGVmaW5lZCB0aGVyZS5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mIGxpc3RlbmVyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdhZGRMaXN0ZW5lciBvbmx5IHRha2VzIGluc3RhbmNlcyBvZiBGdW5jdGlvbicpO1xuICB9XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT0gXCJuZXdMaXN0ZW5lcnNcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJzXCIuXG4gIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pIHtcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgfSBlbHNlIGlmIChpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcblxuICAgIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gICAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgICB2YXIgbTtcbiAgICAgIGlmICh0aGlzLl9ldmVudHMubWF4TGlzdGVuZXJzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbSA9IHRoaXMuX2V2ZW50cy5tYXhMaXN0ZW5lcnM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtID0gZGVmYXVsdE1heExpc3RlbmVycztcbiAgICAgIH1cblxuICAgICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYub24odHlwZSwgZnVuY3Rpb24gZygpIHtcbiAgICBzZWxmLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH0pO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICgnZnVuY3Rpb24nICE9PSB0eXBlb2YgbGlzdGVuZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlbW92ZUxpc3RlbmVyIG9ubHkgdGFrZXMgaW5zdGFuY2VzIG9mIEZ1bmN0aW9uJyk7XG4gIH1cblxuICAvLyBkb2VzIG5vdCB1c2UgbGlzdGVuZXJzKCksIHNvIG5vIHNpZGUgZWZmZWN0IG9mIGNyZWF0aW5nIF9ldmVudHNbdHlwZV1cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSkgcmV0dXJuIHRoaXM7XG5cbiAgdmFyIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzQXJyYXkobGlzdCkpIHtcbiAgICB2YXIgaSA9IGluZGV4T2YobGlzdCwgbGlzdGVuZXIpO1xuICAgIGlmIChpIDwgMCkgcmV0dXJuIHRoaXM7XG4gICAgbGlzdC5zcGxpY2UoaSwgMSk7XG4gICAgaWYgKGxpc3QubGVuZ3RoID09IDApXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICB9IGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSA9PT0gbGlzdGVuZXIpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGRvZXMgbm90IHVzZSBsaXN0ZW5lcnMoKSwgc28gbm8gc2lkZSBlZmZlY3Qgb2YgY3JlYXRpbmcgX2V2ZW50c1t0eXBlXVxuICBpZiAodHlwZSAmJiB0aGlzLl9ldmVudHMgJiYgdGhpcy5fZXZlbnRzW3R5cGVdKSB0aGlzLl9ldmVudHNbdHlwZV0gPSBudWxsO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAoIXRoaXMuX2V2ZW50cykgdGhpcy5fZXZlbnRzID0ge307XG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSB0aGlzLl9ldmVudHNbdHlwZV0gPSBbXTtcbiAgaWYgKCFpc0FycmF5KHRoaXMuX2V2ZW50c1t0eXBlXSkpIHtcbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgfVxuICByZXR1cm4gdGhpcy5fZXZlbnRzW3R5cGVdO1xufTtcblxufSkocmVxdWlyZShcIl9fYnJvd3NlcmlmeV9wcm9jZXNzXCIpKSIsInZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcbnZhciB1dGlsID0gcmVxdWlyZSgndXRpbCcpO1xuXG5mdW5jdGlvbiBTdHJlYW0oKSB7XG4gIGV2ZW50cy5FdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbn1cbnV0aWwuaW5oZXJpdHMoU3RyZWFtLCBldmVudHMuRXZlbnRFbWl0dGVyKTtcbm1vZHVsZS5leHBvcnRzID0gU3RyZWFtO1xuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC40LnhcblN0cmVhbS5TdHJlYW0gPSBTdHJlYW07XG5cblN0cmVhbS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uKGRlc3QsIG9wdGlvbnMpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXM7XG5cbiAgZnVuY3Rpb24gb25kYXRhKGNodW5rKSB7XG4gICAgaWYgKGRlc3Qud3JpdGFibGUpIHtcbiAgICAgIGlmIChmYWxzZSA9PT0gZGVzdC53cml0ZShjaHVuaykgJiYgc291cmNlLnBhdXNlKSB7XG4gICAgICAgIHNvdXJjZS5wYXVzZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHNvdXJjZS5vbignZGF0YScsIG9uZGF0YSk7XG5cbiAgZnVuY3Rpb24gb25kcmFpbigpIHtcbiAgICBpZiAoc291cmNlLnJlYWRhYmxlICYmIHNvdXJjZS5yZXN1bWUpIHtcbiAgICAgIHNvdXJjZS5yZXN1bWUoKTtcbiAgICB9XG4gIH1cblxuICBkZXN0Lm9uKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gIC8vIElmIHRoZSAnZW5kJyBvcHRpb24gaXMgbm90IHN1cHBsaWVkLCBkZXN0LmVuZCgpIHdpbGwgYmUgY2FsbGVkIHdoZW5cbiAgLy8gc291cmNlIGdldHMgdGhlICdlbmQnIG9yICdjbG9zZScgZXZlbnRzLiAgT25seSBkZXN0LmVuZCgpIG9uY2UsIGFuZFxuICAvLyBvbmx5IHdoZW4gYWxsIHNvdXJjZXMgaGF2ZSBlbmRlZC5cbiAgaWYgKCFkZXN0Ll9pc1N0ZGlvICYmICghb3B0aW9ucyB8fCBvcHRpb25zLmVuZCAhPT0gZmFsc2UpKSB7XG4gICAgZGVzdC5fcGlwZUNvdW50ID0gZGVzdC5fcGlwZUNvdW50IHx8IDA7XG4gICAgZGVzdC5fcGlwZUNvdW50Kys7XG5cbiAgICBzb3VyY2Uub24oJ2VuZCcsIG9uZW5kKTtcbiAgICBzb3VyY2Uub24oJ2Nsb3NlJywgb25jbG9zZSk7XG4gIH1cblxuICB2YXIgZGlkT25FbmQgPSBmYWxzZTtcbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgaWYgKGRpZE9uRW5kKSByZXR1cm47XG4gICAgZGlkT25FbmQgPSB0cnVlO1xuXG4gICAgZGVzdC5fcGlwZUNvdW50LS07XG5cbiAgICAvLyByZW1vdmUgdGhlIGxpc3RlbmVyc1xuICAgIGNsZWFudXAoKTtcblxuICAgIGlmIChkZXN0Ll9waXBlQ291bnQgPiAwKSB7XG4gICAgICAvLyB3YWl0aW5nIGZvciBvdGhlciBpbmNvbWluZyBzdHJlYW1zIHRvIGVuZC5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBkZXN0LmVuZCgpO1xuICB9XG5cblxuICBmdW5jdGlvbiBvbmNsb3NlKCkge1xuICAgIGlmIChkaWRPbkVuZCkgcmV0dXJuO1xuICAgIGRpZE9uRW5kID0gdHJ1ZTtcblxuICAgIGRlc3QuX3BpcGVDb3VudC0tO1xuXG4gICAgLy8gcmVtb3ZlIHRoZSBsaXN0ZW5lcnNcbiAgICBjbGVhbnVwKCk7XG5cbiAgICBpZiAoZGVzdC5fcGlwZUNvdW50ID4gMCkge1xuICAgICAgLy8gd2FpdGluZyBmb3Igb3RoZXIgaW5jb21pbmcgc3RyZWFtcyB0byBlbmQuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZGVzdC5kZXN0cm95KCk7XG4gIH1cblxuICAvLyBkb24ndCBsZWF2ZSBkYW5nbGluZyBwaXBlcyB3aGVuIHRoZXJlIGFyZSBlcnJvcnMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBjbGVhbnVwKCk7XG4gICAgaWYgKHRoaXMubGlzdGVuZXJzKCdlcnJvcicpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCBzdHJlYW0gZXJyb3IgaW4gcGlwZS5cbiAgICB9XG4gIH1cblxuICBzb3VyY2Uub24oJ2Vycm9yJywgb25lcnJvcik7XG4gIGRlc3Qub24oJ2Vycm9yJywgb25lcnJvcik7XG5cbiAgLy8gcmVtb3ZlIGFsbCB0aGUgZXZlbnQgbGlzdGVuZXJzIHRoYXQgd2VyZSBhZGRlZC5cbiAgZnVuY3Rpb24gY2xlYW51cCgpIHtcbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2RhdGEnLCBvbmRhdGEpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2RyYWluJywgb25kcmFpbik7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIG9uZW5kKTtcbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcblxuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignZW5kJywgY2xlYW51cCk7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIGNsZWFudXApO1xuXG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZW5kJywgY2xlYW51cCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBjbGVhbnVwKTtcbiAgfVxuXG4gIHNvdXJjZS5vbignZW5kJywgY2xlYW51cCk7XG4gIHNvdXJjZS5vbignY2xvc2UnLCBjbGVhbnVwKTtcblxuICBkZXN0Lm9uKCdlbmQnLCBjbGVhbnVwKTtcbiAgZGVzdC5vbignY2xvc2UnLCBjbGVhbnVwKTtcblxuICBkZXN0LmVtaXQoJ3BpcGUnLCBzb3VyY2UpO1xuXG4gIC8vIEFsbG93IGZvciB1bml4LWxpa2UgdXNhZ2U6IEEucGlwZShCKS5waXBlKEMpXG4gIHJldHVybiBkZXN0O1xufTtcbiIsInZhciBldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcblxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcbmV4cG9ydHMuaXNEYXRlID0gZnVuY3Rpb24ob2JqKXtyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IERhdGVdJ307XG5leHBvcnRzLmlzUmVnRXhwID0gZnVuY3Rpb24ob2JqKXtyZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IFJlZ0V4cF0nfTtcblxuXG5leHBvcnRzLnByaW50ID0gZnVuY3Rpb24gKCkge307XG5leHBvcnRzLnB1dHMgPSBmdW5jdGlvbiAoKSB7fTtcbmV4cG9ydHMuZGVidWcgPSBmdW5jdGlvbigpIHt9O1xuXG5leHBvcnRzLmluc3BlY3QgPSBmdW5jdGlvbihvYmosIHNob3dIaWRkZW4sIGRlcHRoLCBjb2xvcnMpIHtcbiAgdmFyIHNlZW4gPSBbXTtcblxuICB2YXIgc3R5bGl6ZSA9IGZ1bmN0aW9uKHN0ciwgc3R5bGVUeXBlKSB7XG4gICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9BTlNJX2VzY2FwZV9jb2RlI2dyYXBoaWNzXG4gICAgdmFyIHN0eWxlcyA9XG4gICAgICAgIHsgJ2JvbGQnIDogWzEsIDIyXSxcbiAgICAgICAgICAnaXRhbGljJyA6IFszLCAyM10sXG4gICAgICAgICAgJ3VuZGVybGluZScgOiBbNCwgMjRdLFxuICAgICAgICAgICdpbnZlcnNlJyA6IFs3LCAyN10sXG4gICAgICAgICAgJ3doaXRlJyA6IFszNywgMzldLFxuICAgICAgICAgICdncmV5JyA6IFs5MCwgMzldLFxuICAgICAgICAgICdibGFjaycgOiBbMzAsIDM5XSxcbiAgICAgICAgICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgICAgICAgICAnY3lhbicgOiBbMzYsIDM5XSxcbiAgICAgICAgICAnZ3JlZW4nIDogWzMyLCAzOV0sXG4gICAgICAgICAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICAgICAgICAgJ3JlZCcgOiBbMzEsIDM5XSxcbiAgICAgICAgICAneWVsbG93JyA6IFszMywgMzldIH07XG5cbiAgICB2YXIgc3R5bGUgPVxuICAgICAgICB7ICdzcGVjaWFsJzogJ2N5YW4nLFxuICAgICAgICAgICdudW1iZXInOiAnYmx1ZScsXG4gICAgICAgICAgJ2Jvb2xlYW4nOiAneWVsbG93JyxcbiAgICAgICAgICAndW5kZWZpbmVkJzogJ2dyZXknLFxuICAgICAgICAgICdudWxsJzogJ2JvbGQnLFxuICAgICAgICAgICdzdHJpbmcnOiAnZ3JlZW4nLFxuICAgICAgICAgICdkYXRlJzogJ21hZ2VudGEnLFxuICAgICAgICAgIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICAgICAgICAgJ3JlZ2V4cCc6ICdyZWQnIH1bc3R5bGVUeXBlXTtcblxuICAgIGlmIChzdHlsZSkge1xuICAgICAgcmV0dXJuICdcXDAzM1snICsgc3R5bGVzW3N0eWxlXVswXSArICdtJyArIHN0ciArXG4gICAgICAgICAgICAgJ1xcMDMzWycgKyBzdHlsZXNbc3R5bGVdWzFdICsgJ20nO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgfTtcbiAgaWYgKCEgY29sb3JzKSB7XG4gICAgc3R5bGl6ZSA9IGZ1bmN0aW9uKHN0ciwgc3R5bGVUeXBlKSB7IHJldHVybiBzdHI7IH07XG4gIH1cblxuICBmdW5jdGlvbiBmb3JtYXQodmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAgIC8vIFByb3ZpZGUgYSBob29rIGZvciB1c2VyLXNwZWNpZmllZCBpbnNwZWN0IGZ1bmN0aW9ucy5cbiAgICAvLyBDaGVjayB0aGF0IHZhbHVlIGlzIGFuIG9iamVjdCB3aXRoIGFuIGluc3BlY3QgZnVuY3Rpb24gb24gaXRcbiAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlLmluc3BlY3QgPT09ICdmdW5jdGlvbicgJiZcbiAgICAgICAgLy8gRmlsdGVyIG91dCB0aGUgdXRpbCBtb2R1bGUsIGl0J3MgaW5zcGVjdCBmdW5jdGlvbiBpcyBzcGVjaWFsXG4gICAgICAgIHZhbHVlICE9PSBleHBvcnRzICYmXG4gICAgICAgIC8vIEFsc28gZmlsdGVyIG91dCBhbnkgcHJvdG90eXBlIG9iamVjdHMgdXNpbmcgdGhlIGNpcmN1bGFyIGNoZWNrLlxuICAgICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgICByZXR1cm4gdmFsdWUuaW5zcGVjdChyZWN1cnNlVGltZXMpO1xuICAgIH1cblxuICAgIC8vIFByaW1pdGl2ZSB0eXBlcyBjYW5ub3QgaGF2ZSBwcm9wZXJ0aWVzXG4gICAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICAgIGNhc2UgJ3VuZGVmaW5lZCc6XG4gICAgICAgIHJldHVybiBzdHlsaXplKCd1bmRlZmluZWQnLCAndW5kZWZpbmVkJyk7XG5cbiAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgIHZhciBzaW1wbGUgPSAnXFwnJyArIEpTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC9eXCJ8XCIkL2csICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgICAgIHJldHVybiBzdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuXG4gICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAnbnVtYmVyJyk7XG5cbiAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAnYm9vbGVhbicpO1xuICAgIH1cbiAgICAvLyBGb3Igc29tZSByZWFzb24gdHlwZW9mIG51bGwgaXMgXCJvYmplY3RcIiwgc28gc3BlY2lhbCBjYXNlIGhlcmUuXG4gICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gc3R5bGl6ZSgnbnVsbCcsICdudWxsJyk7XG4gICAgfVxuXG4gICAgLy8gTG9vayB1cCB0aGUga2V5cyBvZiB0aGUgb2JqZWN0LlxuICAgIHZhciB2aXNpYmxlX2tleXMgPSBPYmplY3Rfa2V5cyh2YWx1ZSk7XG4gICAgdmFyIGtleXMgPSBzaG93SGlkZGVuID8gT2JqZWN0X2dldE93blByb3BlcnR5TmFtZXModmFsdWUpIDogdmlzaWJsZV9rZXlzO1xuXG4gICAgLy8gRnVuY3Rpb25zIHdpdGhvdXQgcHJvcGVydGllcyBjYW4gYmUgc2hvcnRjdXR0ZWQuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyAmJiBrZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAncmVnZXhwJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgbmFtZSA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgICByZXR1cm4gc3R5bGl6ZSgnW0Z1bmN0aW9uJyArIG5hbWUgKyAnXScsICdzcGVjaWFsJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRGF0ZXMgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZFxuICAgIGlmIChpc0RhdGUodmFsdWUpICYmIGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gc3R5bGl6ZSh2YWx1ZS50b1VUQ1N0cmluZygpLCAnZGF0ZScpO1xuICAgIH1cblxuICAgIHZhciBiYXNlLCB0eXBlLCBicmFjZXM7XG4gICAgLy8gRGV0ZXJtaW5lIHRoZSBvYmplY3QgdHlwZVxuICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgdHlwZSA9ICdBcnJheSc7XG4gICAgICBicmFjZXMgPSBbJ1snLCAnXSddO1xuICAgIH0gZWxzZSB7XG4gICAgICB0eXBlID0gJ09iamVjdCc7XG4gICAgICBicmFjZXMgPSBbJ3snLCAnfSddO1xuICAgIH1cblxuICAgIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHZhciBuID0gdmFsdWUubmFtZSA/ICc6ICcgKyB2YWx1ZS5uYW1lIDogJyc7XG4gICAgICBiYXNlID0gKGlzUmVnRXhwKHZhbHVlKSkgPyAnICcgKyB2YWx1ZSA6ICcgW0Z1bmN0aW9uJyArIG4gKyAnXSc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJhc2UgPSAnJztcbiAgICB9XG5cbiAgICAvLyBNYWtlIGRhdGVzIHdpdGggcHJvcGVydGllcyBmaXJzdCBzYXkgdGhlIGRhdGVcbiAgICBpZiAoaXNEYXRlKHZhbHVlKSkge1xuICAgICAgYmFzZSA9ICcgJyArIHZhbHVlLnRvVVRDU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gYnJhY2VzWzBdICsgYmFzZSArIGJyYWNlc1sxXTtcbiAgICB9XG5cbiAgICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgICByZXR1cm4gc3R5bGl6ZSgnJyArIHZhbHVlLCAncmVnZXhwJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHNlZW4ucHVzaCh2YWx1ZSk7XG5cbiAgICB2YXIgb3V0cHV0ID0ga2V5cy5tYXAoZnVuY3Rpb24oa2V5KSB7XG4gICAgICB2YXIgbmFtZSwgc3RyO1xuICAgICAgaWYgKHZhbHVlLl9fbG9va3VwR2V0dGVyX18pIHtcbiAgICAgICAgaWYgKHZhbHVlLl9fbG9va3VwR2V0dGVyX18oa2V5KSkge1xuICAgICAgICAgIGlmICh2YWx1ZS5fX2xvb2t1cFNldHRlcl9fKGtleSkpIHtcbiAgICAgICAgICAgIHN0ciA9IHN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0ciA9IHN0eWxpemUoJ1tHZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHZhbHVlLl9fbG9va3VwU2V0dGVyX18oa2V5KSkge1xuICAgICAgICAgICAgc3RyID0gc3R5bGl6ZSgnW1NldHRlcl0nLCAnc3BlY2lhbCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHZpc2libGVfa2V5cy5pbmRleE9mKGtleSkgPCAwKSB7XG4gICAgICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gICAgICB9XG4gICAgICBpZiAoIXN0cikge1xuICAgICAgICBpZiAoc2Vlbi5pbmRleE9mKHZhbHVlW2tleV0pIDwgMCkge1xuICAgICAgICAgIGlmIChyZWN1cnNlVGltZXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHN0ciA9IGZvcm1hdCh2YWx1ZVtrZXldKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RyID0gZm9ybWF0KHZhbHVlW2tleV0sIHJlY3Vyc2VUaW1lcyAtIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc3RyLmluZGV4T2YoJ1xcbicpID4gLTEpIHtcbiAgICAgICAgICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcgICcgKyBsaW5lO1xuICAgICAgICAgICAgICB9KS5qb2luKCdcXG4nKS5zdWJzdHIoMik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzdHIgPSAnXFxuJyArIHN0ci5zcGxpdCgnXFxuJykubWFwKGZ1bmN0aW9uKGxpbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyAgICcgKyBsaW5lO1xuICAgICAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RyID0gc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKHR5cGUgPT09ICdBcnJheScgJiYga2V5Lm1hdGNoKC9eXFxkKyQvKSkge1xuICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgIH1cbiAgICAgICAgbmFtZSA9IEpTT04uc3RyaW5naWZ5KCcnICsga2V5KTtcbiAgICAgICAgaWYgKG5hbWUubWF0Y2goL15cIihbYS16QS1aX11bYS16QS1aXzAtOV0qKVwiJC8pKSB7XG4gICAgICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICAgICAgbmFtZSA9IHN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuYW1lID0gbmFtZS5yZXBsYWNlKC8nL2csIFwiXFxcXCdcIilcbiAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC8oXlwifFwiJCkvZywgXCInXCIpO1xuICAgICAgICAgIG5hbWUgPSBzdHlsaXplKG5hbWUsICdzdHJpbmcnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmFtZSArICc6ICcgKyBzdHI7XG4gICAgfSk7XG5cbiAgICBzZWVuLnBvcCgpO1xuXG4gICAgdmFyIG51bUxpbmVzRXN0ID0gMDtcbiAgICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICAgIG51bUxpbmVzRXN0Kys7XG4gICAgICBpZiAoY3VyLmluZGV4T2YoJ1xcbicpID49IDApIG51bUxpbmVzRXN0Kys7XG4gICAgICByZXR1cm4gcHJldiArIGN1ci5sZW5ndGggKyAxO1xuICAgIH0sIDApO1xuXG4gICAgaWYgKGxlbmd0aCA+IDUwKSB7XG4gICAgICBvdXRwdXQgPSBicmFjZXNbMF0gK1xuICAgICAgICAgICAgICAgKGJhc2UgPT09ICcnID8gJycgOiBiYXNlICsgJ1xcbiAnKSArXG4gICAgICAgICAgICAgICAnICcgK1xuICAgICAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgICAgICcgJyArXG4gICAgICAgICAgICAgICBicmFjZXNbMV07XG5cbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0ID0gYnJhY2VzWzBdICsgYmFzZSArICcgJyArIG91dHB1dC5qb2luKCcsICcpICsgJyAnICsgYnJhY2VzWzFdO1xuICAgIH1cblxuICAgIHJldHVybiBvdXRwdXQ7XG4gIH1cbiAgcmV0dXJuIGZvcm1hdChvYmosICh0eXBlb2YgZGVwdGggPT09ICd1bmRlZmluZWQnID8gMiA6IGRlcHRoKSk7XG59O1xuXG5cbmZ1bmN0aW9uIGlzQXJyYXkoYXIpIHtcbiAgcmV0dXJuIGFyIGluc3RhbmNlb2YgQXJyYXkgfHxcbiAgICAgICAgIEFycmF5LmlzQXJyYXkoYXIpIHx8XG4gICAgICAgICAoYXIgJiYgYXIgIT09IE9iamVjdC5wcm90b3R5cGUgJiYgaXNBcnJheShhci5fX3Byb3RvX18pKTtcbn1cblxuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gcmUgaW5zdGFuY2VvZiBSZWdFeHAgfHxcbiAgICAodHlwZW9mIHJlID09PSAnb2JqZWN0JyAmJiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocmUpID09PSAnW29iamVjdCBSZWdFeHBdJyk7XG59XG5cblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgaWYgKGQgaW5zdGFuY2VvZiBEYXRlKSByZXR1cm4gdHJ1ZTtcbiAgaWYgKHR5cGVvZiBkICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICB2YXIgcHJvcGVydGllcyA9IERhdGUucHJvdG90eXBlICYmIE9iamVjdF9nZXRPd25Qcm9wZXJ0eU5hbWVzKERhdGUucHJvdG90eXBlKTtcbiAgdmFyIHByb3RvID0gZC5fX3Byb3RvX18gJiYgT2JqZWN0X2dldE93blByb3BlcnR5TmFtZXMoZC5fX3Byb3RvX18pO1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocHJvdG8pID09PSBKU09OLnN0cmluZ2lmeShwcm9wZXJ0aWVzKTtcbn1cblxuZnVuY3Rpb24gcGFkKG4pIHtcbiAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4udG9TdHJpbmcoMTApIDogbi50b1N0cmluZygxMCk7XG59XG5cbnZhciBtb250aHMgPSBbJ0phbicsICdGZWInLCAnTWFyJywgJ0FwcicsICdNYXknLCAnSnVuJywgJ0p1bCcsICdBdWcnLCAnU2VwJyxcbiAgICAgICAgICAgICAgJ09jdCcsICdOb3YnLCAnRGVjJ107XG5cbi8vIDI2IEZlYiAxNjoxOTozNFxuZnVuY3Rpb24gdGltZXN0YW1wKCkge1xuICB2YXIgZCA9IG5ldyBEYXRlKCk7XG4gIHZhciB0aW1lID0gW3BhZChkLmdldEhvdXJzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRNaW51dGVzKCkpLFxuICAgICAgICAgICAgICBwYWQoZC5nZXRTZWNvbmRzKCkpXS5qb2luKCc6Jyk7XG4gIHJldHVybiBbZC5nZXREYXRlKCksIG1vbnRoc1tkLmdldE1vbnRoKCldLCB0aW1lXS5qb2luKCcgJyk7XG59XG5cbmV4cG9ydHMubG9nID0gZnVuY3Rpb24gKG1zZykge307XG5cbmV4cG9ydHMucHVtcCA9IG51bGw7XG5cbnZhciBPYmplY3Rfa2V5cyA9IE9iamVjdC5rZXlzIHx8IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iaikgcmVzLnB1c2goa2V5KTtcbiAgICByZXR1cm4gcmVzO1xufTtcblxudmFyIE9iamVjdF9nZXRPd25Qcm9wZXJ0eU5hbWVzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgIHZhciByZXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmIChPYmplY3QuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHJlcy5wdXNoKGtleSk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59O1xuXG52YXIgT2JqZWN0X2NyZWF0ZSA9IE9iamVjdC5jcmVhdGUgfHwgZnVuY3Rpb24gKHByb3RvdHlwZSwgcHJvcGVydGllcykge1xuICAgIC8vIGZyb20gZXM1LXNoaW1cbiAgICB2YXIgb2JqZWN0O1xuICAgIGlmIChwcm90b3R5cGUgPT09IG51bGwpIHtcbiAgICAgICAgb2JqZWN0ID0geyAnX19wcm90b19fJyA6IG51bGwgfTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmICh0eXBlb2YgcHJvdG90eXBlICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgICAgICAndHlwZW9mIHByb3RvdHlwZVsnICsgKHR5cGVvZiBwcm90b3R5cGUpICsgJ10gIT0gXFwnb2JqZWN0XFwnJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgVHlwZSA9IGZ1bmN0aW9uICgpIHt9O1xuICAgICAgICBUeXBlLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcbiAgICAgICAgb2JqZWN0ID0gbmV3IFR5cGUoKTtcbiAgICAgICAgb2JqZWN0Ll9fcHJvdG9fXyA9IHByb3RvdHlwZTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBwcm9wZXJ0aWVzICE9PSAndW5kZWZpbmVkJyAmJiBPYmplY3QuZGVmaW5lUHJvcGVydGllcykge1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhvYmplY3QsIHByb3BlcnRpZXMpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuZXhwb3J0cy5pbmhlcml0cyA9IGZ1bmN0aW9uKGN0b3IsIHN1cGVyQ3Rvcikge1xuICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvcjtcbiAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3RfY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfVxuICB9KTtcbn07XG5cbnZhciBmb3JtYXRSZWdFeHAgPSAvJVtzZGolXS9nO1xuZXhwb3J0cy5mb3JtYXQgPSBmdW5jdGlvbihmKSB7XG4gIGlmICh0eXBlb2YgZiAhPT0gJ3N0cmluZycpIHtcbiAgICB2YXIgb2JqZWN0cyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBvYmplY3RzLnB1c2goZXhwb3J0cy5pbnNwZWN0KGFyZ3VtZW50c1tpXSkpO1xuICAgIH1cbiAgICByZXR1cm4gb2JqZWN0cy5qb2luKCcgJyk7XG4gIH1cblxuICB2YXIgaSA9IDE7XG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICB2YXIgbGVuID0gYXJncy5sZW5ndGg7XG4gIHZhciBzdHIgPSBTdHJpbmcoZikucmVwbGFjZShmb3JtYXRSZWdFeHAsIGZ1bmN0aW9uKHgpIHtcbiAgICBpZiAoeCA9PT0gJyUlJykgcmV0dXJuICclJztcbiAgICBpZiAoaSA+PSBsZW4pIHJldHVybiB4O1xuICAgIHN3aXRjaCAoeCkge1xuICAgICAgY2FzZSAnJXMnOiByZXR1cm4gU3RyaW5nKGFyZ3NbaSsrXSk7XG4gICAgICBjYXNlICclZCc6IHJldHVybiBOdW1iZXIoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVqJzogcmV0dXJuIEpTT04uc3RyaW5naWZ5KGFyZ3NbaSsrXSk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4geDtcbiAgICB9XG4gIH0pO1xuICBmb3IodmFyIHggPSBhcmdzW2ldOyBpIDwgbGVuOyB4ID0gYXJnc1srK2ldKXtcbiAgICBpZiAoeCA9PT0gbnVsbCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHN0ciArPSAnICcgKyB4O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgKz0gJyAnICsgZXhwb3J0cy5pbnNwZWN0KHgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufTtcbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICBpZiAoZXYuc291cmNlID09PSB3aW5kb3cgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIiwidmFyIGRub2RlID0gcmVxdWlyZSgnLi9saWIvZG5vZGUnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY29ucywgb3B0cykge1xuICAgIHJldHVybiBuZXcgZG5vZGUoY29ucywgb3B0cyk7XG59O1xuIiwiKGZ1bmN0aW9uKHByb2Nlc3Mpe3ZhciBwcm90b2NvbCA9IHJlcXVpcmUoJ2Rub2RlLXByb3RvY29sJyk7XG52YXIgU3RyZWFtID0gcmVxdWlyZSgnc3RyZWFtJyk7XG52YXIganNvbiA9IHR5cGVvZiBKU09OID09PSAnb2JqZWN0JyA/IEpTT04gOiByZXF1aXJlKCdqc29uaWZ5Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZG5vZGU7XG5kbm9kZS5wcm90b3R5cGUgPSB7fTtcbihmdW5jdGlvbiAoKSB7IC8vIGJyb3dzZXJzIGV0Y1xuICAgIGZvciAodmFyIGtleSBpbiBTdHJlYW0ucHJvdG90eXBlKSB7XG4gICAgICAgIGRub2RlLnByb3RvdHlwZVtrZXldID0gU3RyZWFtLnByb3RvdHlwZVtrZXldO1xuICAgIH1cbn0pKCk7XG5cbmZ1bmN0aW9uIGRub2RlIChjb25zLCBvcHRzKSB7XG4gICAgU3RyZWFtLmNhbGwodGhpcyk7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIFxuICAgIHNlbGYub3B0cyA9IG9wdHMgfHwge307XG4gICAgXG4gICAgc2VsZi5jb25zID0gdHlwZW9mIGNvbnMgPT09ICdmdW5jdGlvbidcbiAgICAgICAgPyBjb25zXG4gICAgICAgIDogZnVuY3Rpb24gKCkgeyByZXR1cm4gY29ucyB8fCB7fSB9XG4gICAgO1xuICAgIFxuICAgIHNlbGYucmVhZGFibGUgPSB0cnVlO1xuICAgIHNlbGYud3JpdGFibGUgPSB0cnVlO1xuICAgIFxuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2VsZi5fZW5kZWQpIHJldHVybjtcbiAgICAgICAgc2VsZi5wcm90byA9IHNlbGYuX2NyZWF0ZVByb3RvKCk7XG4gICAgICAgIHNlbGYucHJvdG8uc3RhcnQoKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghc2VsZi5faGFuZGxlUXVldWUpIHJldHVybjtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxmLl9oYW5kbGVRdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc2VsZi5oYW5kbGUoc2VsZi5faGFuZGxlUXVldWVbaV0pO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cbmRub2RlLnByb3RvdHlwZS5fY3JlYXRlUHJvdG8gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBwcm90byA9IHByb3RvY29sKGZ1bmN0aW9uIChyZW1vdGUpIHtcbiAgICAgICAgaWYgKHNlbGYuX2VuZGVkKSByZXR1cm47XG4gICAgICAgIFxuICAgICAgICB2YXIgcmVmID0gc2VsZi5jb25zLmNhbGwodGhpcywgcmVtb3RlLCBzZWxmKTtcbiAgICAgICAgaWYgKHR5cGVvZiByZWYgIT09ICdvYmplY3QnKSByZWYgPSB0aGlzO1xuICAgICAgICBcbiAgICAgICAgc2VsZi5lbWl0KCdsb2NhbCcsIHJlZiwgc2VsZik7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gcmVmO1xuICAgIH0sIHNlbGYub3B0cy5wcm90byk7XG4gICAgXG4gICAgcHJvdG8ub24oJ3JlbW90ZScsIGZ1bmN0aW9uIChyZW1vdGUpIHtcbiAgICAgICAgc2VsZi5lbWl0KCdyZW1vdGUnLCByZW1vdGUsIHNlbGYpO1xuICAgICAgICBzZWxmLmVtaXQoJ3JlYWR5Jyk7IC8vIGJhY2t3YXJkcyBjb21wYXRhYmlsaXR5LCBkZXByZWNhdGVkXG4gICAgfSk7XG4gICAgXG4gICAgcHJvdG8ub24oJ3JlcXVlc3QnLCBmdW5jdGlvbiAocmVxKSB7XG4gICAgICAgIGlmICghc2VsZi5yZWFkYWJsZSkgcmV0dXJuO1xuICAgICAgICBcbiAgICAgICAgaWYgKHNlbGYub3B0cy5lbWl0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgc2VsZi5lbWl0KCdkYXRhJywgcmVxKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHNlbGYuZW1pdCgnZGF0YScsIGpzb24uc3RyaW5naWZ5KHJlcSkgKyAnXFxuJyk7XG4gICAgfSk7XG4gICAgXG4gICAgcHJvdG8ub24oJ2ZhaWwnLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIC8vIGVycm9ycyB0aGF0IHRoZSByZW1vdGUgZW5kIHdhcyByZXNwb25zaWJsZSBmb3JcbiAgICAgICAgc2VsZi5lbWl0KCdmYWlsJywgZXJyKTtcbiAgICB9KTtcbiAgICBcbiAgICBwcm90by5vbignZXJyb3InLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIC8vIGVycm9ycyB0aGF0IHRoZSBsb2NhbCBjb2RlIHdhcyByZXNwb25zaWJsZSBmb3JcbiAgICAgICAgc2VsZi5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHByb3RvO1xufTtcblxuZG5vZGUucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKGJ1Zikge1xuICAgIGlmICh0aGlzLl9lbmRlZCkgcmV0dXJuO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcm93O1xuICAgIFxuICAgIGlmIChidWYgJiYgdHlwZW9mIGJ1ZiA9PT0gJ29iamVjdCdcbiAgICAmJiBidWYuY29uc3RydWN0b3IgJiYgYnVmLmNvbnN0cnVjdG9yLm5hbWUgPT09ICdCdWZmZXInXG4gICAgJiYgYnVmLmxlbmd0aFxuICAgICYmIHR5cGVvZiBidWYuc2xpY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gdHJlYXQgbGlrZSBhIGJ1ZmZlclxuICAgICAgICBpZiAoIXNlbGYuX2J1ZnMpIHNlbGYuX2J1ZnMgPSBbXTtcbiAgICAgICAgXG4gICAgICAgIC8vIHRyZWF0IGxpa2UgYSBidWZmZXJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGogPSAwOyBpIDwgYnVmLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoYnVmW2ldID09PSAweDBhKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5fYnVmcy5wdXNoKGJ1Zi5zbGljZShqLCBpKSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIGxpbmUgPSAnJztcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBrID0gMDsgayA8IHNlbGYuX2J1ZnMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbGluZSArPSBTdHJpbmcoc2VsZi5fYnVmc1trXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIHRyeSB7IHJvdyA9IGpzb24ucGFyc2UobGluZSkgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgcmV0dXJuIHNlbGYuZW5kKCkgfVxuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGogPSBpICsgMTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBzZWxmLmhhbmRsZShyb3cpO1xuICAgICAgICAgICAgICAgIHNlbGYuX2J1ZnMgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKGogPCBidWYubGVuZ3RoKSBzZWxmLl9idWZzLnB1c2goYnVmLnNsaWNlKGosIGJ1Zi5sZW5ndGgpKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoYnVmICYmIHR5cGVvZiBidWYgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIC8vIC5pc0J1ZmZlcigpIHdpdGhvdXQgdGhlIEJ1ZmZlclxuICAgICAgICAvLyBVc2Ugc2VsZiB0byBwaXBlIEpTT05TdHJlYW0ucGFyc2UoKSBzdHJlYW1zLlxuICAgICAgICBzZWxmLmhhbmRsZShidWYpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKHR5cGVvZiBidWYgIT09ICdzdHJpbmcnKSBidWYgPSBTdHJpbmcoYnVmKTtcbiAgICAgICAgaWYgKCFzZWxmLl9saW5lKSBzZWxmLl9saW5lID0gJyc7XG4gICAgICAgIFxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1Zi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGJ1Zi5jaGFyQ29kZUF0KGkpID09PSAweDBhKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHsgcm93ID0ganNvbi5wYXJzZShzZWxmLl9saW5lKSB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikgeyByZXR1cm4gc2VsZi5lbmQoKSB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgc2VsZi5fbGluZSA9ICcnO1xuICAgICAgICAgICAgICAgIHNlbGYuaGFuZGxlKHJvdyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHNlbGYuX2xpbmUgKz0gYnVmLmNoYXJBdChpKVxuICAgICAgICB9XG4gICAgfVxufTtcblxuZG5vZGUucHJvdG90eXBlLmhhbmRsZSA9IGZ1bmN0aW9uIChyb3cpIHtcbiAgICBpZiAoIXRoaXMucHJvdG8pIHtcbiAgICAgICAgaWYgKCF0aGlzLl9oYW5kbGVRdWV1ZSkgdGhpcy5faGFuZGxlUXVldWUgPSBbXTtcbiAgICAgICAgdGhpcy5faGFuZGxlUXVldWUucHVzaChyb3cpO1xuICAgIH1cbiAgICBlbHNlIHRoaXMucHJvdG8uaGFuZGxlKHJvdyk7XG59O1xuXG5kbm9kZS5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9lbmRlZCkgcmV0dXJuO1xuICAgIHRoaXMuX2VuZGVkID0gdHJ1ZTtcbiAgICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG4gICAgdGhpcy5yZWFkYWJsZSA9IGZhbHNlO1xuICAgIHRoaXMuZW1pdCgnZW5kJyk7XG59O1xuXG5kbm9kZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmVuZCgpO1xufTtcblxufSkocmVxdWlyZShcIl9fYnJvd3NlcmlmeV9wcm9jZXNzXCIpKSIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgc2NydWJiZXIgPSByZXF1aXJlKCcuL2xpYi9zY3J1YicpO1xudmFyIG9iamVjdEtleXMgPSByZXF1aXJlKCcuL2xpYi9rZXlzJyk7XG52YXIgZm9yRWFjaCA9IHJlcXVpcmUoJy4vbGliL2ZvcmVhY2gnKTtcbnZhciBpc0VudW1lcmFibGUgPSByZXF1aXJlKCcuL2xpYi9pc19lbnVtJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGNvbnMsIG9wdHMpIHtcbiAgICByZXR1cm4gbmV3IFByb3RvKGNvbnMsIG9wdHMpO1xufTtcblxuKGZ1bmN0aW9uICgpIHsgLy8gYnJvd3NlcnMgYmxlaFxuICAgIGZvciAodmFyIGtleSBpbiBFdmVudEVtaXR0ZXIucHJvdG90eXBlKSB7XG4gICAgICAgIFByb3RvLnByb3RvdHlwZVtrZXldID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZVtrZXldO1xuICAgIH1cbn0pKCk7XG5cbmZ1bmN0aW9uIFByb3RvIChjb25zLCBvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHNlbGYpO1xuICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAgIFxuICAgIHNlbGYucmVtb3RlID0ge307XG4gICAgc2VsZi5jYWxsYmFja3MgPSB7IGxvY2FsIDogW10sIHJlbW90ZSA6IFtdIH07XG4gICAgc2VsZi53cmFwID0gb3B0cy53cmFwO1xuICAgIHNlbGYudW53cmFwID0gb3B0cy51bndyYXA7XG4gICAgXG4gICAgc2VsZi5zY3J1YmJlciA9IHNjcnViYmVyKHNlbGYuY2FsbGJhY2tzLmxvY2FsKTtcbiAgICBcbiAgICBpZiAodHlwZW9mIGNvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgc2VsZi5pbnN0YW5jZSA9IG5ldyBjb25zKHNlbGYucmVtb3RlLCBzZWxmKTtcbiAgICB9XG4gICAgZWxzZSBzZWxmLmluc3RhbmNlID0gY29ucyB8fCB7fTtcbn1cblxuUHJvdG8ucHJvdG90eXBlLnN0YXJ0ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMucmVxdWVzdCgnbWV0aG9kcycsIFsgdGhpcy5pbnN0YW5jZSBdKTtcbn07XG5cblByb3RvLnByb3RvdHlwZS5jdWxsID0gZnVuY3Rpb24gKGlkKSB7XG4gICAgZGVsZXRlIHRoaXMuY2FsbGJhY2tzLnJlbW90ZVtpZF07XG4gICAgdGhpcy5lbWl0KCdyZXF1ZXN0Jywge1xuICAgICAgICBtZXRob2QgOiAnY3VsbCcsXG4gICAgICAgIGFyZ3VtZW50cyA6IFsgaWQgXVxuICAgIH0pO1xufTtcblxuUHJvdG8ucHJvdG90eXBlLnJlcXVlc3QgPSBmdW5jdGlvbiAobWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHNjcnViID0gdGhpcy5zY3J1YmJlci5zY3J1YihhcmdzKTtcbiAgICBcbiAgICB0aGlzLmVtaXQoJ3JlcXVlc3QnLCB7XG4gICAgICAgIG1ldGhvZCA6IG1ldGhvZCxcbiAgICAgICAgYXJndW1lbnRzIDogc2NydWIuYXJndW1lbnRzLFxuICAgICAgICBjYWxsYmFja3MgOiBzY3J1Yi5jYWxsYmFja3MsXG4gICAgICAgIGxpbmtzIDogc2NydWIubGlua3NcbiAgICB9KTtcbn07XG5cblByb3RvLnByb3RvdHlwZS5oYW5kbGUgPSBmdW5jdGlvbiAocmVxKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gc2VsZi5zY3J1YmJlci51bnNjcnViKHJlcSwgZnVuY3Rpb24gKGlkKSB7XG4gICAgICAgIGlmIChzZWxmLmNhbGxiYWNrcy5yZW1vdGVbaWRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIC8vIGNyZWF0ZSBhIG5ldyBmdW5jdGlvbiBvbmx5IGlmIG9uZSBoYXNuJ3QgYWxyZWFkeSBiZWVuIGNyZWF0ZWRcbiAgICAgICAgICAgIC8vIGZvciBhIHBhcnRpY3VsYXIgaWRcbiAgICAgICAgICAgIHZhciBjYiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnJlcXVlc3QoaWQsIFtdLnNsaWNlLmFwcGx5KGFyZ3VtZW50cykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNlbGYuY2FsbGJhY2tzLnJlbW90ZVtpZF0gPSBzZWxmLndyYXAgPyBzZWxmLndyYXAoY2IsIGlkKSA6IGNiO1xuICAgICAgICAgICAgcmV0dXJuIGNiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzZWxmLnVud3JhcFxuICAgICAgICAgICAgPyBzZWxmLnVud3JhcChzZWxmLmNhbGxiYWNrcy5yZW1vdGVbaWRdLCBpZClcbiAgICAgICAgICAgIDogc2VsZi5jYWxsYmFja3MucmVtb3RlW2lkXVxuICAgICAgICA7XG4gICAgfSk7XG4gICAgXG4gICAgaWYgKHJlcS5tZXRob2QgPT09ICdtZXRob2RzJykge1xuICAgICAgICBzZWxmLmhhbmRsZU1ldGhvZHMoYXJnc1swXSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHJlcS5tZXRob2QgPT09ICdjdWxsJykge1xuICAgICAgICBmb3JFYWNoKGFyZ3MsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgICAgICAgZGVsZXRlIHNlbGYuY2FsbGJhY2tzLmxvY2FsW2lkXTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiByZXEubWV0aG9kID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAoaXNFbnVtZXJhYmxlKHNlbGYuaW5zdGFuY2UsIHJlcS5tZXRob2QpKSB7XG4gICAgICAgICAgICBzZWxmLmFwcGx5KHNlbGYuaW5zdGFuY2VbcmVxLm1ldGhvZF0sIGFyZ3MpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5lbWl0KCdmYWlsJywgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICdyZXF1ZXN0IGZvciBub24tZW51bWVyYWJsZSBtZXRob2Q6ICcgKyByZXEubWV0aG9kXG4gICAgICAgICAgICApKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgcmVxLm1ldGhvZCA9PSAnbnVtYmVyJykge1xuICAgICAgICB2YXIgZm4gPSBzZWxmLmNhbGxiYWNrcy5sb2NhbFtyZXEubWV0aG9kXTtcbiAgICAgICAgaWYgKCFmbikge1xuICAgICAgICAgICAgc2VsZi5lbWl0KCdmYWlsJywgbmV3IEVycm9yKCdubyBzdWNoIG1ldGhvZCcpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHNlbGYuYXBwbHkoZm4sIGFyZ3MpO1xuICAgIH1cbn07XG5cblByb3RvLnByb3RvdHlwZS5oYW5kbGVNZXRob2RzID0gZnVuY3Rpb24gKG1ldGhvZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHR5cGVvZiBtZXRob2RzICE9ICdvYmplY3QnKSB7XG4gICAgICAgIG1ldGhvZHMgPSB7fTtcbiAgICB9XG4gICAgXG4gICAgLy8gY29weSBzaW5jZSBhc3NpZ25tZW50IGRpc2NhcmRzIHRoZSBwcmV2aW91cyByZWZzXG4gICAgZm9yRWFjaChvYmplY3RLZXlzKHNlbGYucmVtb3RlKSwgZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBkZWxldGUgc2VsZi5yZW1vdGVba2V5XTtcbiAgICB9KTtcbiAgICBcbiAgICBmb3JFYWNoKG9iamVjdEtleXMobWV0aG9kcyksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgc2VsZi5yZW1vdGVba2V5XSA9IG1ldGhvZHNba2V5XTtcbiAgICB9KTtcbiAgICBcbiAgICBzZWxmLmVtaXQoJ3JlbW90ZScsIHNlbGYucmVtb3RlKTtcbiAgICBzZWxmLmVtaXQoJ3JlYWR5Jyk7XG59O1xuXG5Qcm90by5wcm90b3R5cGUuYXBwbHkgPSBmdW5jdGlvbiAoZiwgYXJncykge1xuICAgIHRyeSB7IGYuYXBwbHkodW5kZWZpbmVkLCBhcmdzKSB9XG4gICAgY2F0Y2ggKGVycikgeyB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKSB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBmb3JFYWNoICh4cywgZikge1xuICAgIGlmICh4cy5mb3JFYWNoKSByZXR1cm4geHMuZm9yRWFjaChmKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZi5jYWxsKHhzLCB4c1tpXSwgaSk7XG4gICAgfVxufVxuIiwidmFyIG9iamVjdEtleXMgPSByZXF1aXJlKCcuL2tleXMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqLCBrZXkpIHtcbiAgICBpZiAoT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZSkge1xuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKG9iaiwga2V5KTtcbiAgICB9XG4gICAgdmFyIGtleXMgPSBvYmplY3RLZXlzKG9iaik7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChrZXkgPT09IGtleXNbaV0pIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIGtleXMgPSBbXTtcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgICByZXR1cm4ga2V5cztcbn07XG4iLCJ2YXIgdHJhdmVyc2UgPSByZXF1aXJlKCd0cmF2ZXJzZScpO1xudmFyIG9iamVjdEtleXMgPSByZXF1aXJlKCcuL2tleXMnKTtcbnZhciBmb3JFYWNoID0gcmVxdWlyZSgnLi9mb3JlYWNoJyk7XG5cbmZ1bmN0aW9uIGluZGV4T2YgKHhzLCB4KSB7XG4gICAgaWYgKHhzLmluZGV4T2YpIHJldHVybiB4cy5pbmRleE9mKHgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIGlmICh4c1tpXSA9PT0geCkgcmV0dXJuIGk7XG4gICAgcmV0dXJuIC0xO1xufVxuXG4vLyBzY3J1YiBjYWxsYmFja3Mgb3V0IG9mIHJlcXVlc3RzIGluIG9yZGVyIHRvIGNhbGwgdGhlbSBhZ2FpbiBsYXRlclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoY2FsbGJhY2tzKSB7XG4gICAgcmV0dXJuIG5ldyBTY3J1YmJlcihjYWxsYmFja3MpO1xufTtcblxuZnVuY3Rpb24gU2NydWJiZXIgKGNhbGxiYWNrcykge1xuICAgIHRoaXMuY2FsbGJhY2tzID0gY2FsbGJhY2tzO1xufVxuXG4vLyBUYWtlIHRoZSBmdW5jdGlvbnMgb3V0IGFuZCBub3RlIHRoZW0gZm9yIGZ1dHVyZSB1c2VcblNjcnViYmVyLnByb3RvdHlwZS5zY3J1YiA9IGZ1bmN0aW9uIChvYmopIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHBhdGhzID0ge307XG4gICAgdmFyIGxpbmtzID0gW107XG4gICAgXG4gICAgdmFyIGFyZ3MgPSB0cmF2ZXJzZShvYmopLm1hcChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBpZiAodHlwZW9mIG5vZGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHZhciBpID0gaW5kZXhPZihzZWxmLmNhbGxiYWNrcywgbm9kZSk7XG4gICAgICAgICAgICBpZiAoaSA+PSAwICYmICEoaSBpbiBwYXRocykpIHtcbiAgICAgICAgICAgICAgICAvLyBLZWVwIHByZXZpb3VzIGZ1bmN0aW9uIElEcyBvbmx5IGZvciB0aGUgZmlyc3QgZnVuY3Rpb25cbiAgICAgICAgICAgICAgICAvLyBmb3VuZC4gVGhpcyBpcyBzb21ld2hhdCBzdWJvcHRpbWFsIGJ1dCB0aGUgYWx0ZXJuYXRpdmVzXG4gICAgICAgICAgICAgICAgLy8gYXJlIHdvcnNlLlxuICAgICAgICAgICAgICAgIHBhdGhzW2ldID0gdGhpcy5wYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGlkID0gc2VsZi5jYWxsYmFja3MubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHNlbGYuY2FsbGJhY2tzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICAgICAgcGF0aHNbaWRdID0gdGhpcy5wYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZSgnW0Z1bmN0aW9uXScpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMuY2lyY3VsYXIpIHtcbiAgICAgICAgICAgIGxpbmtzLnB1c2goeyBmcm9tIDogdGhpcy5jaXJjdWxhci5wYXRoLCB0byA6IHRoaXMucGF0aCB9KTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlKCdbQ2lyY3VsYXJdJyk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgICBhcmd1bWVudHMgOiBhcmdzLFxuICAgICAgICBjYWxsYmFja3MgOiBwYXRocyxcbiAgICAgICAgbGlua3MgOiBsaW5rc1xuICAgIH07XG59O1xuIFxuLy8gUmVwbGFjZSBjYWxsYmFja3MuIFRoZSBzdXBwbGllZCBmdW5jdGlvbiBzaG91bGQgdGFrZSBhIGNhbGxiYWNrIGlkIGFuZFxuLy8gcmV0dXJuIGEgY2FsbGJhY2sgb2YgaXRzIG93bi5cblNjcnViYmVyLnByb3RvdHlwZS51bnNjcnViID0gZnVuY3Rpb24gKG1zZywgZikge1xuICAgIHZhciBhcmdzID0gbXNnLmFyZ3VtZW50cyB8fCBbXTtcbiAgICBmb3JFYWNoKG9iamVjdEtleXMobXNnLmNhbGxiYWNrcyB8fCB7fSksIGZ1bmN0aW9uIChzaWQpIHtcbiAgICAgICAgdmFyIGlkID0gcGFyc2VJbnQoc2lkLCAxMCk7XG4gICAgICAgIHZhciBwYXRoID0gbXNnLmNhbGxiYWNrc1tpZF07XG4gICAgICAgIHRyYXZlcnNlLnNldChhcmdzLCBwYXRoLCBmKGlkKSk7XG4gICAgfSk7XG4gICAgXG4gICAgZm9yRWFjaChtc2cubGlua3MgfHwgW10sIGZ1bmN0aW9uIChsaW5rKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IHRyYXZlcnNlLmdldChhcmdzLCBsaW5rLmZyb20pO1xuICAgICAgICB0cmF2ZXJzZS5zZXQoYXJncywgbGluay50bywgdmFsdWUpO1xuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiBhcmdzO1xufTtcbiIsInZhciB0cmF2ZXJzZSA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBuZXcgVHJhdmVyc2Uob2JqKTtcbn07XG5cbmZ1bmN0aW9uIFRyYXZlcnNlIChvYmopIHtcbiAgICB0aGlzLnZhbHVlID0gb2JqO1xufVxuXG5UcmF2ZXJzZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKHBzKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnZhbHVlO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHMubGVuZ3RoOyBpICsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBwc1tpXTtcbiAgICAgICAgaWYgKCFPYmplY3QuaGFzT3duUHJvcGVydHkuY2FsbChub2RlLCBrZXkpKSB7XG4gICAgICAgICAgICBub2RlID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgbm9kZSA9IG5vZGVba2V5XTtcbiAgICB9XG4gICAgcmV0dXJuIG5vZGU7XG59O1xuXG5UcmF2ZXJzZS5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24gKHBzKSB7XG4gICAgdmFyIG5vZGUgPSB0aGlzLnZhbHVlO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcHMubGVuZ3RoOyBpICsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBwc1tpXTtcbiAgICAgICAgaWYgKCFPYmplY3QuaGFzT3duUHJvcGVydHkuY2FsbChub2RlLCBrZXkpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgbm9kZSA9IG5vZGVba2V5XTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG59O1xuXG5UcmF2ZXJzZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHBzLCB2YWx1ZSkge1xuICAgIHZhciBub2RlID0gdGhpcy52YWx1ZTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBzLmxlbmd0aCAtIDE7IGkgKyspIHtcbiAgICAgICAgdmFyIGtleSA9IHBzW2ldO1xuICAgICAgICBpZiAoIU9iamVjdC5oYXNPd25Qcm9wZXJ0eS5jYWxsKG5vZGUsIGtleSkpIG5vZGVba2V5XSA9IHt9O1xuICAgICAgICBub2RlID0gbm9kZVtrZXldO1xuICAgIH1cbiAgICBub2RlW3BzW2ldXSA9IHZhbHVlO1xuICAgIHJldHVybiB2YWx1ZTtcbn07XG5cblRyYXZlcnNlLnByb3RvdHlwZS5tYXAgPSBmdW5jdGlvbiAoY2IpIHtcbiAgICByZXR1cm4gd2Fsayh0aGlzLnZhbHVlLCBjYiwgdHJ1ZSk7XG59O1xuXG5UcmF2ZXJzZS5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIChjYikge1xuICAgIHRoaXMudmFsdWUgPSB3YWxrKHRoaXMudmFsdWUsIGNiLCBmYWxzZSk7XG4gICAgcmV0dXJuIHRoaXMudmFsdWU7XG59O1xuXG5UcmF2ZXJzZS5wcm90b3R5cGUucmVkdWNlID0gZnVuY3Rpb24gKGNiLCBpbml0KSB7XG4gICAgdmFyIHNraXAgPSBhcmd1bWVudHMubGVuZ3RoID09PSAxO1xuICAgIHZhciBhY2MgPSBza2lwID8gdGhpcy52YWx1ZSA6IGluaXQ7XG4gICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uICh4KSB7XG4gICAgICAgIGlmICghdGhpcy5pc1Jvb3QgfHwgIXNraXApIHtcbiAgICAgICAgICAgIGFjYyA9IGNiLmNhbGwodGhpcywgYWNjLCB4KTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBhY2M7XG59O1xuXG5UcmF2ZXJzZS5wcm90b3R5cGUucGF0aHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGFjYyA9IFtdO1xuICAgIHRoaXMuZm9yRWFjaChmdW5jdGlvbiAoeCkge1xuICAgICAgICBhY2MucHVzaCh0aGlzLnBhdGgpOyBcbiAgICB9KTtcbiAgICByZXR1cm4gYWNjO1xufTtcblxuVHJhdmVyc2UucHJvdG90eXBlLm5vZGVzID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhY2MgPSBbXTtcbiAgICB0aGlzLmZvckVhY2goZnVuY3Rpb24gKHgpIHtcbiAgICAgICAgYWNjLnB1c2godGhpcy5ub2RlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gYWNjO1xufTtcblxuVHJhdmVyc2UucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBwYXJlbnRzID0gW10sIG5vZGVzID0gW107XG4gICAgXG4gICAgcmV0dXJuIChmdW5jdGlvbiBjbG9uZSAoc3JjKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFyZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHBhcmVudHNbaV0gPT09IHNyYykge1xuICAgICAgICAgICAgICAgIHJldHVybiBub2Rlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgaWYgKHR5cGVvZiBzcmMgPT09ICdvYmplY3QnICYmIHNyYyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyIGRzdCA9IGNvcHkoc3JjKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcGFyZW50cy5wdXNoKHNyYyk7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKGRzdCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvckVhY2gob2JqZWN0S2V5cyhzcmMpLCBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICAgICAgZHN0W2tleV0gPSBjbG9uZShzcmNba2V5XSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcGFyZW50cy5wb3AoKTtcbiAgICAgICAgICAgIG5vZGVzLnBvcCgpO1xuICAgICAgICAgICAgcmV0dXJuIGRzdDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBzcmM7XG4gICAgICAgIH1cbiAgICB9KSh0aGlzLnZhbHVlKTtcbn07XG5cbmZ1bmN0aW9uIHdhbGsgKHJvb3QsIGNiLCBpbW11dGFibGUpIHtcbiAgICB2YXIgcGF0aCA9IFtdO1xuICAgIHZhciBwYXJlbnRzID0gW107XG4gICAgdmFyIGFsaXZlID0gdHJ1ZTtcbiAgICBcbiAgICByZXR1cm4gKGZ1bmN0aW9uIHdhbGtlciAobm9kZV8pIHtcbiAgICAgICAgdmFyIG5vZGUgPSBpbW11dGFibGUgPyBjb3B5KG5vZGVfKSA6IG5vZGVfO1xuICAgICAgICB2YXIgbW9kaWZpZXJzID0ge307XG4gICAgICAgIFxuICAgICAgICB2YXIga2VlcEdvaW5nID0gdHJ1ZTtcbiAgICAgICAgXG4gICAgICAgIHZhciBzdGF0ZSA9IHtcbiAgICAgICAgICAgIG5vZGUgOiBub2RlLFxuICAgICAgICAgICAgbm9kZV8gOiBub2RlXyxcbiAgICAgICAgICAgIHBhdGggOiBbXS5jb25jYXQocGF0aCksXG4gICAgICAgICAgICBwYXJlbnQgOiBwYXJlbnRzW3BhcmVudHMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICBwYXJlbnRzIDogcGFyZW50cyxcbiAgICAgICAgICAgIGtleSA6IHBhdGguc2xpY2UoLTEpWzBdLFxuICAgICAgICAgICAgaXNSb290IDogcGF0aC5sZW5ndGggPT09IDAsXG4gICAgICAgICAgICBsZXZlbCA6IHBhdGgubGVuZ3RoLFxuICAgICAgICAgICAgY2lyY3VsYXIgOiBudWxsLFxuICAgICAgICAgICAgdXBkYXRlIDogZnVuY3Rpb24gKHgsIHN0b3BIZXJlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFzdGF0ZS5pc1Jvb3QpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUucGFyZW50Lm5vZGVbc3RhdGUua2V5XSA9IHg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHN0YXRlLm5vZGUgPSB4O1xuICAgICAgICAgICAgICAgIGlmIChzdG9wSGVyZSkga2VlcEdvaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ2RlbGV0ZScgOiBmdW5jdGlvbiAoc3RvcEhlcmUpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgc3RhdGUucGFyZW50Lm5vZGVbc3RhdGUua2V5XTtcbiAgICAgICAgICAgICAgICBpZiAoc3RvcEhlcmUpIGtlZXBHb2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlbW92ZSA6IGZ1bmN0aW9uIChzdG9wSGVyZSkge1xuICAgICAgICAgICAgICAgIGlmIChpc0FycmF5KHN0YXRlLnBhcmVudC5ub2RlKSkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5wYXJlbnQubm9kZS5zcGxpY2Uoc3RhdGUua2V5LCAxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzdGF0ZS5wYXJlbnQubm9kZVtzdGF0ZS5rZXldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoc3RvcEhlcmUpIGtlZXBHb2luZyA9IGZhbHNlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGtleXMgOiBudWxsLFxuICAgICAgICAgICAgYmVmb3JlIDogZnVuY3Rpb24gKGYpIHsgbW9kaWZpZXJzLmJlZm9yZSA9IGYgfSxcbiAgICAgICAgICAgIGFmdGVyIDogZnVuY3Rpb24gKGYpIHsgbW9kaWZpZXJzLmFmdGVyID0gZiB9LFxuICAgICAgICAgICAgcHJlIDogZnVuY3Rpb24gKGYpIHsgbW9kaWZpZXJzLnByZSA9IGYgfSxcbiAgICAgICAgICAgIHBvc3QgOiBmdW5jdGlvbiAoZikgeyBtb2RpZmllcnMucG9zdCA9IGYgfSxcbiAgICAgICAgICAgIHN0b3AgOiBmdW5jdGlvbiAoKSB7IGFsaXZlID0gZmFsc2UgfSxcbiAgICAgICAgICAgIGJsb2NrIDogZnVuY3Rpb24gKCkgeyBrZWVwR29pbmcgPSBmYWxzZSB9XG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBpZiAoIWFsaXZlKSByZXR1cm4gc3RhdGU7XG4gICAgICAgIFxuICAgICAgICBmdW5jdGlvbiB1cGRhdGVTdGF0ZSgpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGUubm9kZSA9PT0gJ29iamVjdCcgJiYgc3RhdGUubm9kZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGlmICghc3RhdGUua2V5cyB8fCBzdGF0ZS5ub2RlXyAhPT0gc3RhdGUubm9kZSkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZS5rZXlzID0gb2JqZWN0S2V5cyhzdGF0ZS5ub2RlKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBzdGF0ZS5pc0xlYWYgPSBzdGF0ZS5rZXlzLmxlbmd0aCA9PSAwO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFyZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAocGFyZW50c1tpXS5ub2RlXyA9PT0gbm9kZV8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlLmNpcmN1bGFyID0gcGFyZW50c1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgc3RhdGUuaXNMZWFmID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBzdGF0ZS5rZXlzID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgc3RhdGUubm90TGVhZiA9ICFzdGF0ZS5pc0xlYWY7XG4gICAgICAgICAgICBzdGF0ZS5ub3RSb290ID0gIXN0YXRlLmlzUm9vdDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdXBkYXRlU3RhdGUoKTtcbiAgICAgICAgXG4gICAgICAgIC8vIHVzZSByZXR1cm4gdmFsdWVzIHRvIHVwZGF0ZSBpZiBkZWZpbmVkXG4gICAgICAgIHZhciByZXQgPSBjYi5jYWxsKHN0YXRlLCBzdGF0ZS5ub2RlKTtcbiAgICAgICAgaWYgKHJldCAhPT0gdW5kZWZpbmVkICYmIHN0YXRlLnVwZGF0ZSkgc3RhdGUudXBkYXRlKHJldCk7XG4gICAgICAgIFxuICAgICAgICBpZiAobW9kaWZpZXJzLmJlZm9yZSkgbW9kaWZpZXJzLmJlZm9yZS5jYWxsKHN0YXRlLCBzdGF0ZS5ub2RlKTtcbiAgICAgICAgXG4gICAgICAgIGlmICgha2VlcEdvaW5nKSByZXR1cm4gc3RhdGU7XG4gICAgICAgIFxuICAgICAgICBpZiAodHlwZW9mIHN0YXRlLm5vZGUgPT0gJ29iamVjdCdcbiAgICAgICAgJiYgc3RhdGUubm9kZSAhPT0gbnVsbCAmJiAhc3RhdGUuY2lyY3VsYXIpIHtcbiAgICAgICAgICAgIHBhcmVudHMucHVzaChzdGF0ZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHVwZGF0ZVN0YXRlKCk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvckVhY2goc3RhdGUua2V5cywgZnVuY3Rpb24gKGtleSwgaSkge1xuICAgICAgICAgICAgICAgIHBhdGgucHVzaChrZXkpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChtb2RpZmllcnMucHJlKSBtb2RpZmllcnMucHJlLmNhbGwoc3RhdGUsIHN0YXRlLm5vZGVba2V5XSwga2V5KTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSB3YWxrZXIoc3RhdGUubm9kZVtrZXldKTtcbiAgICAgICAgICAgICAgICBpZiAoaW1tdXRhYmxlICYmIE9iamVjdC5oYXNPd25Qcm9wZXJ0eS5jYWxsKHN0YXRlLm5vZGUsIGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdGUubm9kZVtrZXldID0gY2hpbGQubm9kZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY2hpbGQuaXNMYXN0ID0gaSA9PSBzdGF0ZS5rZXlzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICAgICAgY2hpbGQuaXNGaXJzdCA9IGkgPT0gMDtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBpZiAobW9kaWZpZXJzLnBvc3QpIG1vZGlmaWVycy5wb3N0LmNhbGwoc3RhdGUsIGNoaWxkKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICBwYXRoLnBvcCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwYXJlbnRzLnBvcCgpO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBpZiAobW9kaWZpZXJzLmFmdGVyKSBtb2RpZmllcnMuYWZ0ZXIuY2FsbChzdGF0ZSwgc3RhdGUubm9kZSk7XG4gICAgICAgIFxuICAgICAgICByZXR1cm4gc3RhdGU7XG4gICAgfSkocm9vdCkubm9kZTtcbn1cblxuZnVuY3Rpb24gY29weSAoc3JjKSB7XG4gICAgaWYgKHR5cGVvZiBzcmMgPT09ICdvYmplY3QnICYmIHNyYyAhPT0gbnVsbCkge1xuICAgICAgICB2YXIgZHN0O1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzQXJyYXkoc3JjKSkge1xuICAgICAgICAgICAgZHN0ID0gW107XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXNEYXRlKHNyYykpIHtcbiAgICAgICAgICAgIGRzdCA9IG5ldyBEYXRlKHNyYyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoaXNSZWdFeHAoc3JjKSkge1xuICAgICAgICAgICAgZHN0ID0gbmV3IFJlZ0V4cChzcmMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzRXJyb3Ioc3JjKSkge1xuICAgICAgICAgICAgZHN0ID0geyBtZXNzYWdlOiBzcmMubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzQm9vbGVhbihzcmMpKSB7XG4gICAgICAgICAgICBkc3QgPSBuZXcgQm9vbGVhbihzcmMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGlzTnVtYmVyKHNyYykpIHtcbiAgICAgICAgICAgIGRzdCA9IG5ldyBOdW1iZXIoc3JjKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChpc1N0cmluZyhzcmMpKSB7XG4gICAgICAgICAgICBkc3QgPSBuZXcgU3RyaW5nKHNyYyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoT2JqZWN0LmNyZWF0ZSAmJiBPYmplY3QuZ2V0UHJvdG90eXBlT2YpIHtcbiAgICAgICAgICAgIGRzdCA9IE9iamVjdC5jcmVhdGUoT2JqZWN0LmdldFByb3RvdHlwZU9mKHNyYykpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHNyYy5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0KSB7XG4gICAgICAgICAgICBkc3QgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBwcm90byA9XG4gICAgICAgICAgICAgICAgKHNyYy5jb25zdHJ1Y3RvciAmJiBzcmMuY29uc3RydWN0b3IucHJvdG90eXBlKVxuICAgICAgICAgICAgICAgIHx8IHNyYy5fX3Byb3RvX19cbiAgICAgICAgICAgICAgICB8fCB7fVxuICAgICAgICAgICAgO1xuICAgICAgICAgICAgdmFyIFQgPSBmdW5jdGlvbiAoKSB7fTtcbiAgICAgICAgICAgIFQucHJvdG90eXBlID0gcHJvdG87XG4gICAgICAgICAgICBkc3QgPSBuZXcgVDtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgZm9yRWFjaChvYmplY3RLZXlzKHNyYyksIGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgIGRzdFtrZXldID0gc3JjW2tleV07XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZHN0O1xuICAgIH1cbiAgICBlbHNlIHJldHVybiBzcmM7XG59XG5cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24ga2V5cyAob2JqKSB7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHJlcy5wdXNoKGtleSlcbiAgICByZXR1cm4gcmVzO1xufTtcblxuZnVuY3Rpb24gdG9TIChvYmopIHsgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopIH1cbmZ1bmN0aW9uIGlzRGF0ZSAob2JqKSB7IHJldHVybiB0b1Mob2JqKSA9PT0gJ1tvYmplY3QgRGF0ZV0nIH1cbmZ1bmN0aW9uIGlzUmVnRXhwIChvYmopIHsgcmV0dXJuIHRvUyhvYmopID09PSAnW29iamVjdCBSZWdFeHBdJyB9XG5mdW5jdGlvbiBpc0Vycm9yIChvYmopIHsgcmV0dXJuIHRvUyhvYmopID09PSAnW29iamVjdCBFcnJvcl0nIH1cbmZ1bmN0aW9uIGlzQm9vbGVhbiAob2JqKSB7IHJldHVybiB0b1Mob2JqKSA9PT0gJ1tvYmplY3QgQm9vbGVhbl0nIH1cbmZ1bmN0aW9uIGlzTnVtYmVyIChvYmopIHsgcmV0dXJuIHRvUyhvYmopID09PSAnW29iamVjdCBOdW1iZXJdJyB9XG5mdW5jdGlvbiBpc1N0cmluZyAob2JqKSB7IHJldHVybiB0b1Mob2JqKSA9PT0gJ1tvYmplY3QgU3RyaW5nXScgfVxuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gaXNBcnJheSAoeHMpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHhzKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbnZhciBmb3JFYWNoID0gZnVuY3Rpb24gKHhzLCBmbikge1xuICAgIGlmICh4cy5mb3JFYWNoKSByZXR1cm4geHMuZm9yRWFjaChmbilcbiAgICBlbHNlIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZm4oeHNbaV0sIGksIHhzKTtcbiAgICB9XG59O1xuXG5mb3JFYWNoKG9iamVjdEtleXMoVHJhdmVyc2UucHJvdG90eXBlKSwgZnVuY3Rpb24gKGtleSkge1xuICAgIHRyYXZlcnNlW2tleV0gPSBmdW5jdGlvbiAob2JqKSB7XG4gICAgICAgIHZhciBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICB2YXIgdCA9IG5ldyBUcmF2ZXJzZShvYmopO1xuICAgICAgICByZXR1cm4gdFtrZXldLmFwcGx5KHQsIGFyZ3MpO1xuICAgIH07XG59KTtcbiIsImV4cG9ydHMucGFyc2UgPSByZXF1aXJlKCcuL2xpYi9wYXJzZScpO1xuZXhwb3J0cy5zdHJpbmdpZnkgPSByZXF1aXJlKCcuL2xpYi9zdHJpbmdpZnknKTtcbiIsInZhciBhdCwgLy8gVGhlIGluZGV4IG9mIHRoZSBjdXJyZW50IGNoYXJhY3RlclxuICAgIGNoLCAvLyBUaGUgY3VycmVudCBjaGFyYWN0ZXJcbiAgICBlc2NhcGVlID0ge1xuICAgICAgICAnXCInOiAgJ1wiJyxcbiAgICAgICAgJ1xcXFwnOiAnXFxcXCcsXG4gICAgICAgICcvJzogICcvJyxcbiAgICAgICAgYjogICAgJ1xcYicsXG4gICAgICAgIGY6ICAgICdcXGYnLFxuICAgICAgICBuOiAgICAnXFxuJyxcbiAgICAgICAgcjogICAgJ1xccicsXG4gICAgICAgIHQ6ICAgICdcXHQnXG4gICAgfSxcbiAgICB0ZXh0LFxuXG4gICAgZXJyb3IgPSBmdW5jdGlvbiAobSkge1xuICAgICAgICAvLyBDYWxsIGVycm9yIHdoZW4gc29tZXRoaW5nIGlzIHdyb25nLlxuICAgICAgICB0aHJvdyB7XG4gICAgICAgICAgICBuYW1lOiAgICAnU3ludGF4RXJyb3InLFxuICAgICAgICAgICAgbWVzc2FnZTogbSxcbiAgICAgICAgICAgIGF0OiAgICAgIGF0LFxuICAgICAgICAgICAgdGV4dDogICAgdGV4dFxuICAgICAgICB9O1xuICAgIH0sXG4gICAgXG4gICAgbmV4dCA9IGZ1bmN0aW9uIChjKSB7XG4gICAgICAgIC8vIElmIGEgYyBwYXJhbWV0ZXIgaXMgcHJvdmlkZWQsIHZlcmlmeSB0aGF0IGl0IG1hdGNoZXMgdGhlIGN1cnJlbnQgY2hhcmFjdGVyLlxuICAgICAgICBpZiAoYyAmJiBjICE9PSBjaCkge1xuICAgICAgICAgICAgZXJyb3IoXCJFeHBlY3RlZCAnXCIgKyBjICsgXCInIGluc3RlYWQgb2YgJ1wiICsgY2ggKyBcIidcIik7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEdldCB0aGUgbmV4dCBjaGFyYWN0ZXIuIFdoZW4gdGhlcmUgYXJlIG5vIG1vcmUgY2hhcmFjdGVycyxcbiAgICAgICAgLy8gcmV0dXJuIHRoZSBlbXB0eSBzdHJpbmcuXG4gICAgICAgIFxuICAgICAgICBjaCA9IHRleHQuY2hhckF0KGF0KTtcbiAgICAgICAgYXQgKz0gMTtcbiAgICAgICAgcmV0dXJuIGNoO1xuICAgIH0sXG4gICAgXG4gICAgbnVtYmVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBQYXJzZSBhIG51bWJlciB2YWx1ZS5cbiAgICAgICAgdmFyIG51bWJlcixcbiAgICAgICAgICAgIHN0cmluZyA9ICcnO1xuICAgICAgICBcbiAgICAgICAgaWYgKGNoID09PSAnLScpIHtcbiAgICAgICAgICAgIHN0cmluZyA9ICctJztcbiAgICAgICAgICAgIG5leHQoJy0nKTtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoY2ggPj0gJzAnICYmIGNoIDw9ICc5Jykge1xuICAgICAgICAgICAgc3RyaW5nICs9IGNoO1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaCA9PT0gJy4nKSB7XG4gICAgICAgICAgICBzdHJpbmcgKz0gJy4nO1xuICAgICAgICAgICAgd2hpbGUgKG5leHQoKSAmJiBjaCA+PSAnMCcgJiYgY2ggPD0gJzknKSB7XG4gICAgICAgICAgICAgICAgc3RyaW5nICs9IGNoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChjaCA9PT0gJ2UnIHx8IGNoID09PSAnRScpIHtcbiAgICAgICAgICAgIHN0cmluZyArPSBjaDtcbiAgICAgICAgICAgIG5leHQoKTtcbiAgICAgICAgICAgIGlmIChjaCA9PT0gJy0nIHx8IGNoID09PSAnKycpIHtcbiAgICAgICAgICAgICAgICBzdHJpbmcgKz0gY2g7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKGNoID49ICcwJyAmJiBjaCA8PSAnOScpIHtcbiAgICAgICAgICAgICAgICBzdHJpbmcgKz0gY2g7XG4gICAgICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG51bWJlciA9ICtzdHJpbmc7XG4gICAgICAgIGlmICghaXNGaW5pdGUobnVtYmVyKSkge1xuICAgICAgICAgICAgZXJyb3IoXCJCYWQgbnVtYmVyXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG51bWJlcjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgXG4gICAgc3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBQYXJzZSBhIHN0cmluZyB2YWx1ZS5cbiAgICAgICAgdmFyIGhleCxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBzdHJpbmcgPSAnJyxcbiAgICAgICAgICAgIHVmZmZmO1xuICAgICAgICBcbiAgICAgICAgLy8gV2hlbiBwYXJzaW5nIGZvciBzdHJpbmcgdmFsdWVzLCB3ZSBtdXN0IGxvb2sgZm9yIFwiIGFuZCBcXCBjaGFyYWN0ZXJzLlxuICAgICAgICBpZiAoY2ggPT09ICdcIicpIHtcbiAgICAgICAgICAgIHdoaWxlIChuZXh0KCkpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICdcIicpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3RyaW5nO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY2ggPT09ICdcXFxcJykge1xuICAgICAgICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaCA9PT0gJ3UnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1ZmZmZiA9IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGV4ID0gcGFyc2VJbnQobmV4dCgpLCAxNik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0Zpbml0ZShoZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1ZmZmZiA9IHVmZmZmICogMTYgKyBoZXg7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBzdHJpbmcgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSh1ZmZmZik7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGVzY2FwZWVbY2hdID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RyaW5nICs9IGVzY2FwZWVbY2hdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzdHJpbmcgKz0gY2g7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVycm9yKFwiQmFkIHN0cmluZ1wiKTtcbiAgICB9LFxuXG4gICAgd2hpdGUgPSBmdW5jdGlvbiAoKSB7XG5cbi8vIFNraXAgd2hpdGVzcGFjZS5cblxuICAgICAgICB3aGlsZSAoY2ggJiYgY2ggPD0gJyAnKSB7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgd29yZCA9IGZ1bmN0aW9uICgpIHtcblxuLy8gdHJ1ZSwgZmFsc2UsIG9yIG51bGwuXG5cbiAgICAgICAgc3dpdGNoIChjaCkge1xuICAgICAgICBjYXNlICd0JzpcbiAgICAgICAgICAgIG5leHQoJ3QnKTtcbiAgICAgICAgICAgIG5leHQoJ3InKTtcbiAgICAgICAgICAgIG5leHQoJ3UnKTtcbiAgICAgICAgICAgIG5leHQoJ2UnKTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICBjYXNlICdmJzpcbiAgICAgICAgICAgIG5leHQoJ2YnKTtcbiAgICAgICAgICAgIG5leHQoJ2EnKTtcbiAgICAgICAgICAgIG5leHQoJ2wnKTtcbiAgICAgICAgICAgIG5leHQoJ3MnKTtcbiAgICAgICAgICAgIG5leHQoJ2UnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgICBuZXh0KCduJyk7XG4gICAgICAgICAgICBuZXh0KCd1Jyk7XG4gICAgICAgICAgICBuZXh0KCdsJyk7XG4gICAgICAgICAgICBuZXh0KCdsJyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBlcnJvcihcIlVuZXhwZWN0ZWQgJ1wiICsgY2ggKyBcIidcIik7XG4gICAgfSxcblxuICAgIHZhbHVlLCAgLy8gUGxhY2UgaG9sZGVyIGZvciB0aGUgdmFsdWUgZnVuY3Rpb24uXG5cbiAgICBhcnJheSA9IGZ1bmN0aW9uICgpIHtcblxuLy8gUGFyc2UgYW4gYXJyYXkgdmFsdWUuXG5cbiAgICAgICAgdmFyIGFycmF5ID0gW107XG5cbiAgICAgICAgaWYgKGNoID09PSAnWycpIHtcbiAgICAgICAgICAgIG5leHQoJ1snKTtcbiAgICAgICAgICAgIHdoaXRlKCk7XG4gICAgICAgICAgICBpZiAoY2ggPT09ICddJykge1xuICAgICAgICAgICAgICAgIG5leHQoJ10nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJyYXk7ICAgLy8gZW1wdHkgYXJyYXlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlIChjaCkge1xuICAgICAgICAgICAgICAgIGFycmF5LnB1c2godmFsdWUoKSk7XG4gICAgICAgICAgICAgICAgd2hpdGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICddJykge1xuICAgICAgICAgICAgICAgICAgICBuZXh0KCddJyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhcnJheTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbmV4dCgnLCcpO1xuICAgICAgICAgICAgICAgIHdoaXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZXJyb3IoXCJCYWQgYXJyYXlcIik7XG4gICAgfSxcblxuICAgIG9iamVjdCA9IGZ1bmN0aW9uICgpIHtcblxuLy8gUGFyc2UgYW4gb2JqZWN0IHZhbHVlLlxuXG4gICAgICAgIHZhciBrZXksXG4gICAgICAgICAgICBvYmplY3QgPSB7fTtcblxuICAgICAgICBpZiAoY2ggPT09ICd7Jykge1xuICAgICAgICAgICAgbmV4dCgneycpO1xuICAgICAgICAgICAgd2hpdGUoKTtcbiAgICAgICAgICAgIGlmIChjaCA9PT0gJ30nKSB7XG4gICAgICAgICAgICAgICAgbmV4dCgnfScpO1xuICAgICAgICAgICAgICAgIHJldHVybiBvYmplY3Q7ICAgLy8gZW1wdHkgb2JqZWN0XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAoY2gpIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBzdHJpbmcoKTtcbiAgICAgICAgICAgICAgICB3aGl0ZSgpO1xuICAgICAgICAgICAgICAgIG5leHQoJzonKTtcbiAgICAgICAgICAgICAgICBpZiAoT2JqZWN0Lmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yKCdEdXBsaWNhdGUga2V5IFwiJyArIGtleSArICdcIicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvYmplY3Rba2V5XSA9IHZhbHVlKCk7XG4gICAgICAgICAgICAgICAgd2hpdGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoY2ggPT09ICd9Jykge1xuICAgICAgICAgICAgICAgICAgICBuZXh0KCd9Jyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5leHQoJywnKTtcbiAgICAgICAgICAgICAgICB3aGl0ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVycm9yKFwiQmFkIG9iamVjdFwiKTtcbiAgICB9O1xuXG52YWx1ZSA9IGZ1bmN0aW9uICgpIHtcblxuLy8gUGFyc2UgYSBKU09OIHZhbHVlLiBJdCBjb3VsZCBiZSBhbiBvYmplY3QsIGFuIGFycmF5LCBhIHN0cmluZywgYSBudW1iZXIsXG4vLyBvciBhIHdvcmQuXG5cbiAgICB3aGl0ZSgpO1xuICAgIHN3aXRjaCAoY2gpIHtcbiAgICBjYXNlICd7JzpcbiAgICAgICAgcmV0dXJuIG9iamVjdCgpO1xuICAgIGNhc2UgJ1snOlxuICAgICAgICByZXR1cm4gYXJyYXkoKTtcbiAgICBjYXNlICdcIic6XG4gICAgICAgIHJldHVybiBzdHJpbmcoKTtcbiAgICBjYXNlICctJzpcbiAgICAgICAgcmV0dXJuIG51bWJlcigpO1xuICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBjaCA+PSAnMCcgJiYgY2ggPD0gJzknID8gbnVtYmVyKCkgOiB3b3JkKCk7XG4gICAgfVxufTtcblxuLy8gUmV0dXJuIHRoZSBqc29uX3BhcnNlIGZ1bmN0aW9uLiBJdCB3aWxsIGhhdmUgYWNjZXNzIHRvIGFsbCBvZiB0aGUgYWJvdmVcbi8vIGZ1bmN0aW9ucyBhbmQgdmFyaWFibGVzLlxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzb3VyY2UsIHJldml2ZXIpIHtcbiAgICB2YXIgcmVzdWx0O1xuICAgIFxuICAgIHRleHQgPSBzb3VyY2U7XG4gICAgYXQgPSAwO1xuICAgIGNoID0gJyAnO1xuICAgIHJlc3VsdCA9IHZhbHVlKCk7XG4gICAgd2hpdGUoKTtcbiAgICBpZiAoY2gpIHtcbiAgICAgICAgZXJyb3IoXCJTeW50YXggZXJyb3JcIik7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgYSByZXZpdmVyIGZ1bmN0aW9uLCB3ZSByZWN1cnNpdmVseSB3YWxrIHRoZSBuZXcgc3RydWN0dXJlLFxuICAgIC8vIHBhc3NpbmcgZWFjaCBuYW1lL3ZhbHVlIHBhaXIgdG8gdGhlIHJldml2ZXIgZnVuY3Rpb24gZm9yIHBvc3NpYmxlXG4gICAgLy8gdHJhbnNmb3JtYXRpb24sIHN0YXJ0aW5nIHdpdGggYSB0ZW1wb3Jhcnkgcm9vdCBvYmplY3QgdGhhdCBob2xkcyB0aGUgcmVzdWx0XG4gICAgLy8gaW4gYW4gZW1wdHkga2V5LiBJZiB0aGVyZSBpcyBub3QgYSByZXZpdmVyIGZ1bmN0aW9uLCB3ZSBzaW1wbHkgcmV0dXJuIHRoZVxuICAgIC8vIHJlc3VsdC5cblxuICAgIHJldHVybiB0eXBlb2YgcmV2aXZlciA9PT0gJ2Z1bmN0aW9uJyA/IChmdW5jdGlvbiB3YWxrKGhvbGRlciwga2V5KSB7XG4gICAgICAgIHZhciBrLCB2LCB2YWx1ZSA9IGhvbGRlcltrZXldO1xuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgZm9yIChrIGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgaykpIHtcbiAgICAgICAgICAgICAgICAgICAgdiA9IHdhbGsodmFsdWUsIGspO1xuICAgICAgICAgICAgICAgICAgICBpZiAodiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVtrXSA9IHY7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdmFsdWVba107XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJldml2ZXIuY2FsbChob2xkZXIsIGtleSwgdmFsdWUpO1xuICAgIH0oeycnOiByZXN1bHR9LCAnJykpIDogcmVzdWx0O1xufTtcbiIsInZhciBjeCA9IC9bXFx1MDAwMFxcdTAwYWRcXHUwNjAwLVxcdTA2MDRcXHUwNzBmXFx1MTdiNFxcdTE3YjVcXHUyMDBjLVxcdTIwMGZcXHUyMDI4LVxcdTIwMmZcXHUyMDYwLVxcdTIwNmZcXHVmZWZmXFx1ZmZmMC1cXHVmZmZmXS9nLFxuICAgIGVzY2FwYWJsZSA9IC9bXFxcXFxcXCJcXHgwMC1cXHgxZlxceDdmLVxceDlmXFx1MDBhZFxcdTA2MDAtXFx1MDYwNFxcdTA3MGZcXHUxN2I0XFx1MTdiNVxcdTIwMGMtXFx1MjAwZlxcdTIwMjgtXFx1MjAyZlxcdTIwNjAtXFx1MjA2ZlxcdWZlZmZcXHVmZmYwLVxcdWZmZmZdL2csXG4gICAgZ2FwLFxuICAgIGluZGVudCxcbiAgICBtZXRhID0geyAgICAvLyB0YWJsZSBvZiBjaGFyYWN0ZXIgc3Vic3RpdHV0aW9uc1xuICAgICAgICAnXFxiJzogJ1xcXFxiJyxcbiAgICAgICAgJ1xcdCc6ICdcXFxcdCcsXG4gICAgICAgICdcXG4nOiAnXFxcXG4nLFxuICAgICAgICAnXFxmJzogJ1xcXFxmJyxcbiAgICAgICAgJ1xccic6ICdcXFxccicsXG4gICAgICAgICdcIicgOiAnXFxcXFwiJyxcbiAgICAgICAgJ1xcXFwnOiAnXFxcXFxcXFwnXG4gICAgfSxcbiAgICByZXA7XG5cbmZ1bmN0aW9uIHF1b3RlKHN0cmluZykge1xuICAgIC8vIElmIHRoZSBzdHJpbmcgY29udGFpbnMgbm8gY29udHJvbCBjaGFyYWN0ZXJzLCBubyBxdW90ZSBjaGFyYWN0ZXJzLCBhbmQgbm9cbiAgICAvLyBiYWNrc2xhc2ggY2hhcmFjdGVycywgdGhlbiB3ZSBjYW4gc2FmZWx5IHNsYXAgc29tZSBxdW90ZXMgYXJvdW5kIGl0LlxuICAgIC8vIE90aGVyd2lzZSB3ZSBtdXN0IGFsc28gcmVwbGFjZSB0aGUgb2ZmZW5kaW5nIGNoYXJhY3RlcnMgd2l0aCBzYWZlIGVzY2FwZVxuICAgIC8vIHNlcXVlbmNlcy5cbiAgICBcbiAgICBlc2NhcGFibGUubGFzdEluZGV4ID0gMDtcbiAgICByZXR1cm4gZXNjYXBhYmxlLnRlc3Qoc3RyaW5nKSA/ICdcIicgKyBzdHJpbmcucmVwbGFjZShlc2NhcGFibGUsIGZ1bmN0aW9uIChhKSB7XG4gICAgICAgIHZhciBjID0gbWV0YVthXTtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBjID09PSAnc3RyaW5nJyA/IGMgOlxuICAgICAgICAgICAgJ1xcXFx1JyArICgnMDAwMCcgKyBhLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpKS5zbGljZSgtNCk7XG4gICAgfSkgKyAnXCInIDogJ1wiJyArIHN0cmluZyArICdcIic7XG59XG5cbmZ1bmN0aW9uIHN0cihrZXksIGhvbGRlcikge1xuICAgIC8vIFByb2R1Y2UgYSBzdHJpbmcgZnJvbSBob2xkZXJba2V5XS5cbiAgICB2YXIgaSwgICAgICAgICAgLy8gVGhlIGxvb3AgY291bnRlci5cbiAgICAgICAgaywgICAgICAgICAgLy8gVGhlIG1lbWJlciBrZXkuXG4gICAgICAgIHYsICAgICAgICAgIC8vIFRoZSBtZW1iZXIgdmFsdWUuXG4gICAgICAgIGxlbmd0aCxcbiAgICAgICAgbWluZCA9IGdhcCxcbiAgICAgICAgcGFydGlhbCxcbiAgICAgICAgdmFsdWUgPSBob2xkZXJba2V5XTtcbiAgICBcbiAgICAvLyBJZiB0aGUgdmFsdWUgaGFzIGEgdG9KU09OIG1ldGhvZCwgY2FsbCBpdCB0byBvYnRhaW4gYSByZXBsYWNlbWVudCB2YWx1ZS5cbiAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJlxuICAgICAgICAgICAgdHlwZW9mIHZhbHVlLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB2YWx1ZSA9IHZhbHVlLnRvSlNPTihrZXkpO1xuICAgIH1cbiAgICBcbiAgICAvLyBJZiB3ZSB3ZXJlIGNhbGxlZCB3aXRoIGEgcmVwbGFjZXIgZnVuY3Rpb24sIHRoZW4gY2FsbCB0aGUgcmVwbGFjZXIgdG9cbiAgICAvLyBvYnRhaW4gYSByZXBsYWNlbWVudCB2YWx1ZS5cbiAgICBpZiAodHlwZW9mIHJlcCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICB2YWx1ZSA9IHJlcC5jYWxsKGhvbGRlciwga2V5LCB2YWx1ZSk7XG4gICAgfVxuICAgIFxuICAgIC8vIFdoYXQgaGFwcGVucyBuZXh0IGRlcGVuZHMgb24gdGhlIHZhbHVlJ3MgdHlwZS5cbiAgICBzd2l0Y2ggKHR5cGVvZiB2YWx1ZSkge1xuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgcmV0dXJuIHF1b3RlKHZhbHVlKTtcbiAgICAgICAgXG4gICAgICAgIGNhc2UgJ251bWJlcic6XG4gICAgICAgICAgICAvLyBKU09OIG51bWJlcnMgbXVzdCBiZSBmaW5pdGUuIEVuY29kZSBub24tZmluaXRlIG51bWJlcnMgYXMgbnVsbC5cbiAgICAgICAgICAgIHJldHVybiBpc0Zpbml0ZSh2YWx1ZSkgPyBTdHJpbmcodmFsdWUpIDogJ251bGwnO1xuICAgICAgICBcbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgIGNhc2UgJ251bGwnOlxuICAgICAgICAgICAgLy8gSWYgdGhlIHZhbHVlIGlzIGEgYm9vbGVhbiBvciBudWxsLCBjb252ZXJ0IGl0IHRvIGEgc3RyaW5nLiBOb3RlOlxuICAgICAgICAgICAgLy8gdHlwZW9mIG51bGwgZG9lcyBub3QgcHJvZHVjZSAnbnVsbCcuIFRoZSBjYXNlIGlzIGluY2x1ZGVkIGhlcmUgaW5cbiAgICAgICAgICAgIC8vIHRoZSByZW1vdGUgY2hhbmNlIHRoYXQgdGhpcyBnZXRzIGZpeGVkIHNvbWVkYXkuXG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgICAgIFxuICAgICAgICBjYXNlICdvYmplY3QnOlxuICAgICAgICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuICdudWxsJztcbiAgICAgICAgICAgIGdhcCArPSBpbmRlbnQ7XG4gICAgICAgICAgICBwYXJ0aWFsID0gW107XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIEFycmF5LmlzQXJyYXlcbiAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmFwcGx5KHZhbHVlKSA9PT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgICAgICAgIGxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFydGlhbFtpXSA9IHN0cihpLCB2YWx1ZSkgfHwgJ251bGwnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBKb2luIGFsbCBvZiB0aGUgZWxlbWVudHMgdG9nZXRoZXIsIHNlcGFyYXRlZCB3aXRoIGNvbW1hcywgYW5kXG4gICAgICAgICAgICAgICAgLy8gd3JhcCB0aGVtIGluIGJyYWNrZXRzLlxuICAgICAgICAgICAgICAgIHYgPSBwYXJ0aWFsLmxlbmd0aCA9PT0gMCA/ICdbXScgOiBnYXAgP1xuICAgICAgICAgICAgICAgICAgICAnW1xcbicgKyBnYXAgKyBwYXJ0aWFsLmpvaW4oJyxcXG4nICsgZ2FwKSArICdcXG4nICsgbWluZCArICddJyA6XG4gICAgICAgICAgICAgICAgICAgICdbJyArIHBhcnRpYWwuam9pbignLCcpICsgJ10nO1xuICAgICAgICAgICAgICAgIGdhcCA9IG1pbmQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIElmIHRoZSByZXBsYWNlciBpcyBhbiBhcnJheSwgdXNlIGl0IHRvIHNlbGVjdCB0aGUgbWVtYmVycyB0byBiZVxuICAgICAgICAgICAgLy8gc3RyaW5naWZpZWQuXG4gICAgICAgICAgICBpZiAocmVwICYmIHR5cGVvZiByZXAgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgbGVuZ3RoID0gcmVwLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgayA9IHJlcFtpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBrID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdiA9IHN0cihrLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpYWwucHVzaChxdW90ZShrKSArIChnYXAgPyAnOiAnIDogJzonKSArIHYpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBpdGVyYXRlIHRocm91Z2ggYWxsIG9mIHRoZSBrZXlzIGluIHRoZSBvYmplY3QuXG4gICAgICAgICAgICAgICAgZm9yIChrIGluIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwodmFsdWUsIGspKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2ID0gc3RyKGssIHZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFydGlhbC5wdXNoKHF1b3RlKGspICsgKGdhcCA/ICc6ICcgOiAnOicpICsgdik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgLy8gSm9pbiBhbGwgb2YgdGhlIG1lbWJlciB0ZXh0cyB0b2dldGhlciwgc2VwYXJhdGVkIHdpdGggY29tbWFzLFxuICAgICAgICAvLyBhbmQgd3JhcCB0aGVtIGluIGJyYWNlcy5cblxuICAgICAgICB2ID0gcGFydGlhbC5sZW5ndGggPT09IDAgPyAne30nIDogZ2FwID9cbiAgICAgICAgICAgICd7XFxuJyArIGdhcCArIHBhcnRpYWwuam9pbignLFxcbicgKyBnYXApICsgJ1xcbicgKyBtaW5kICsgJ30nIDpcbiAgICAgICAgICAgICd7JyArIHBhcnRpYWwuam9pbignLCcpICsgJ30nO1xuICAgICAgICBnYXAgPSBtaW5kO1xuICAgICAgICByZXR1cm4gdjtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHZhbHVlLCByZXBsYWNlciwgc3BhY2UpIHtcbiAgICB2YXIgaTtcbiAgICBnYXAgPSAnJztcbiAgICBpbmRlbnQgPSAnJztcbiAgICBcbiAgICAvLyBJZiB0aGUgc3BhY2UgcGFyYW1ldGVyIGlzIGEgbnVtYmVyLCBtYWtlIGFuIGluZGVudCBzdHJpbmcgY29udGFpbmluZyB0aGF0XG4gICAgLy8gbWFueSBzcGFjZXMuXG4gICAgaWYgKHR5cGVvZiBzcGFjZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHNwYWNlOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGluZGVudCArPSAnICc7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gSWYgdGhlIHNwYWNlIHBhcmFtZXRlciBpcyBhIHN0cmluZywgaXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBpbmRlbnQgc3RyaW5nLlxuICAgIGVsc2UgaWYgKHR5cGVvZiBzcGFjZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaW5kZW50ID0gc3BhY2U7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgYSByZXBsYWNlciwgaXQgbXVzdCBiZSBhIGZ1bmN0aW9uIG9yIGFuIGFycmF5LlxuICAgIC8vIE90aGVyd2lzZSwgdGhyb3cgYW4gZXJyb3IuXG4gICAgcmVwID0gcmVwbGFjZXI7XG4gICAgaWYgKHJlcGxhY2VyICYmIHR5cGVvZiByZXBsYWNlciAhPT0gJ2Z1bmN0aW9uJ1xuICAgICYmICh0eXBlb2YgcmVwbGFjZXIgIT09ICdvYmplY3QnIHx8IHR5cGVvZiByZXBsYWNlci5sZW5ndGggIT09ICdudW1iZXInKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0pTT04uc3RyaW5naWZ5Jyk7XG4gICAgfVxuICAgIFxuICAgIC8vIE1ha2UgYSBmYWtlIHJvb3Qgb2JqZWN0IGNvbnRhaW5pbmcgb3VyIHZhbHVlIHVuZGVyIHRoZSBrZXkgb2YgJycuXG4gICAgLy8gUmV0dXJuIHRoZSByZXN1bHQgb2Ygc3RyaW5naWZ5aW5nIHRoZSB2YWx1ZS5cbiAgICByZXR1cm4gc3RyKCcnLCB7Jyc6IHZhbHVlfSk7XG59O1xuIiwidmFyIGluamVjdCA9IHJlcXVpcmUoJy4vaW5qZWN0JylcbnZhciBzZXJpYWxpemVyID0gcmVxdWlyZSgnc3RyZWFtLXNlcmlhbGl6ZXInKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGluamVjdChmdW5jdGlvbiAoc3RyZWFtLCBvcHRzKSB7XG4gIHJldHVybiBzZXJpYWxpemVyKG9wdHMgJiYgb3B0cy53cmFwcGVyKSAoc3RyZWFtKVxufSlcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHRocm91Z2ggPSByZXF1aXJlKCd0aHJvdWdoJylcbiAgLCBleHRlbmQgPSByZXF1aXJlKCd4dGVuZCcpXG4gICwgZHVwbGV4ID0gcmVxdWlyZSgnZHVwbGV4JylcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAod3JhcCkge1xuXG5mdW5jdGlvbiBNdXhEZW11eCAob3B0cywgb25Db25uZWN0aW9uKSB7XG4gIGlmKCdmdW5jdGlvbicgPT09IHR5cGVvZiBvcHRzKVxuICAgIG9uQ29ubmVjdGlvbiA9IG9wdHMsIG9wdHMgPSBudWxsXG4gIG9wdHMgPSBvcHRzIHx8IHt9XG5cbiAgZnVuY3Rpb24gY3JlYXRlSUQoKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMTYpLnNsaWNlKDIpICtcbiAgICAgIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMTYpLnNsaWNlKDIpXG4gICAgKVxuICB9XG5cbiAgdmFyIHN0cmVhbXMgPSB7fSwgc3RyZWFtQ291bnQgPSAwXG4gIHZhciBtZCA9IGR1cGxleCgpLy8ucmVzdW1lKClcblxuICBtZC5vbignX2RhdGEnLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgIGlmKCEoQXJyYXkuaXNBcnJheShkYXRhKVxuICAgICAgJiYgJ3N0cmluZycgPT09IHR5cGVvZiBkYXRhWzBdXG4gICAgICAmJiAnX19wcm90b19fJyAhPT0gZGF0YVswXVxuICAgICAgJiYgJ3N0cmluZycgPT09IHR5cGVvZiBkYXRhWzFdXG4gICAgICAmJiAnX19wcm90b19fJyAhPT0gZGF0YVsxXVxuICAgICkpIHJldHVyblxuICAgIHZhciBpZCA9IGRhdGEuc2hpZnQoKVxuICAgIHZhciBldmVudCA9IGRhdGFbMF1cbiAgICB2YXIgcyA9IHN0cmVhbXNbaWRdXG4gICAgaWYoIXMpIHtcbiAgICAgIGlmKGV2ZW50ID09ICdjbG9zZScpXG4gICAgICAgIHJldHVyblxuICAgICAgaWYoZXZlbnQgIT0gJ25ldycpXG4gICAgICAgIHJldHVybiBvdXRlci5lbWl0KCd1bmtub3duJywgaWQpXG4gICAgICBtZC5lbWl0KCdjb25uZWN0aW9uJywgY3JlYXRlU3RyZWFtKGlkLCBkYXRhWzFdLm1ldGEsIGRhdGFbMV0ub3B0cykpXG4gICAgfVxuICAgIGVsc2UgaWYgKGV2ZW50ID09PSAncGF1c2UnKVxuICAgICAgcy5wYXVzZWQgPSB0cnVlXG4gICAgZWxzZSBpZiAoZXZlbnQgPT09ICdyZXN1bWUnKSB7XG4gICAgICB2YXIgcCA9IHMucGF1c2VkXG4gICAgICBzLnBhdXNlZCA9IGZhbHNlXG4gICAgICBpZihwKSBzLmVtaXQoJ2RyYWluJylcbiAgICB9XG4gICAgZWxzZSBpZiAoZXZlbnQgPT09ICdlcnJvcicpIHtcbiAgICAgIHZhciBlcnJvciA9IGRhdGFbMV1cbiAgICAgIGlmICh0eXBlb2YgZXJyb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoZXJyb3IpKVxuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZXJyb3IubWVzc2FnZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdmFyIGUgPSBuZXcgRXJyb3IoZXJyb3IubWVzc2FnZSlcbiAgICAgICAgZXh0ZW5kKGUsIGVycm9yKVxuICAgICAgICBzLmVtaXQoJ2Vycm9yJywgZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMuZW1pdCgnZXJyb3InLCBlcnJvcilcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBzLmVtaXQuYXBwbHkocywgZGF0YSlcbiAgICB9XG4gIH0pXG4gIC5vbignX2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICBkZXN0cm95QWxsKClcbiAgICBtZC5fZW5kKClcbiAgfSlcblxuICBmdW5jdGlvbiBkZXN0cm95QWxsIChfZXJyKSB7XG4gICAgbWQucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIGRlc3Ryb3lBbGwpXG4gICAgbWQucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgZGVzdHJveUFsbClcbiAgICBtZC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBkZXN0cm95QWxsKVxuICAgIHZhciBlcnIgPSBfZXJyIHx8IG5ldyBFcnJvciAoJ3VuZXhwZWN0ZWQgZGlzY29ubmVjdGlvbicpXG4gICAgZm9yICh2YXIgaSBpbiBzdHJlYW1zKSB7XG4gICAgICB2YXIgcyA9IHN0cmVhbXNbaV1cbiAgICAgIHMuZGVzdHJveWVkID0gdHJ1ZVxuICAgICAgaWYgKG9wdHMuZXJyb3IgIT09IHRydWUpIHtcbiAgICAgICAgcy5lbmQoKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcy5lbWl0KCdlcnJvcicsIGVycilcbiAgICAgICAgcy5kZXN0cm95KClcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvL2VuZCB0aGUgc3RyZWFtIG9uY2Ugc3ViLXN0cmVhbXMgaGF2ZSBlbmRlZC5cbiAgLy8od2FpdHMgZm9yIHRoZW0gdG8gY2xvc2UsIGxpa2Ugb24gYSB0Y3Agc2VydmVyKVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVN0cmVhbShpZCwgbWV0YSwgb3B0cykge1xuICAgIHN0cmVhbUNvdW50ICsrXG4gICAgdmFyIHMgPSB0aHJvdWdoKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICBpZighdGhpcy53cml0YWJsZSkge1xuICAgICAgICB2YXIgZXJyID0gRXJyb3IoJ3N0cmVhbSBpcyBub3Qgd3JpdGFibGU6ICcgKyBpZClcbiAgICAgICAgZXJyLnN0cmVhbSA9IHRoaXNcbiAgICAgICAgcmV0dXJuIG91dGVyLmVtaXQoXCJlcnJvclwiLCBlcnIpXG4gICAgICB9XG4gICAgICBtZC5fZGF0YShbcy5pZCwgJ2RhdGEnLCBkYXRhXSlcbiAgICB9LCBmdW5jdGlvbiAoKSB7XG4gICAgICBtZC5fZGF0YShbcy5pZCwgJ2VuZCddKVxuICAgICAgaWYgKHRoaXMucmVhZGFibGUgJiYgIW9wdHMuYWxsb3dIYWxmT3BlbiAmJiAhdGhpcy5lbmRlZCkge1xuICAgICAgICB0aGlzLmVtaXQoXCJlbmRcIilcbiAgICAgIH1cbiAgICB9KVxuICAgIHMucGF1c2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBtZC5fZGF0YShbcy5pZCwgJ3BhdXNlJ10pXG4gICAgfVxuICAgIHMucmVzdW1lID0gZnVuY3Rpb24gKCkge1xuICAgICAgbWQuX2RhdGEoW3MuaWQsICdyZXN1bWUnXSlcbiAgICB9XG4gICAgcy5lcnJvciA9IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICBtZC5fZGF0YShbcy5pZCwgJ2Vycm9yJywgbWVzc2FnZV0pXG4gICAgfVxuICAgIHMub25jZSgnY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBkZWxldGUgc3RyZWFtc1tpZF1cbiAgICAgIHN0cmVhbUNvdW50IC0tXG4gICAgICBtZC5fZGF0YShbcy5pZCwgJ2Nsb3NlJ10pXG4gICAgICBpZihzdHJlYW1Db3VudCA9PT0gMClcbiAgICAgICAgbWQuZW1pdCgnemVybycpXG4gICAgfSlcbiAgICBzLndyaXRhYmxlID0gb3B0cy53cml0YWJsZVxuICAgIHMucmVhZGFibGUgPSBvcHRzLnJlYWRhYmxlXG4gICAgc3RyZWFtc1tzLmlkID0gaWRdID0gc1xuICAgIHMubWV0YSA9IG1ldGFcbiAgICByZXR1cm4gc1xuICB9XG5cbiAgdmFyIG91dGVyID0gd3JhcChtZCwgb3B0cylcblxuICBpZihtZCAhPT0gb3V0ZXIpIHtcbiAgICBtZC5vbignY29ubmVjdGlvbicsIGZ1bmN0aW9uIChzdHJlYW0pIHtcbiAgICAgIG91dGVyLmVtaXQoJ2Nvbm5lY3Rpb24nLCBzdHJlYW0pXG4gICAgfSlcbiAgfVxuXG4gIG91dGVyLmNsb3NlID0gZnVuY3Rpb24gKGNiKSB7XG4gICAgbWQub25jZSgnemVybycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIG1kLl9lbmQoKVxuICAgICAgaWYoY2IpIGNiKClcbiAgICB9KVxuICAgIHJldHVybiB0aGlzXG4gIH1cblxuICBpZihvbkNvbm5lY3Rpb24pXG4gICAgb3V0ZXIub24oJ2Nvbm5lY3Rpb24nLCBvbkNvbm5lY3Rpb24pXG5cbiAgb3V0ZXIub24oJ2Nvbm5lY3Rpb24nLCBmdW5jdGlvbiAoc3RyZWFtKSB7XG4gICAgLy9pZiBtdXgtZGVtdXggcmVjaWV2ZXMgYSBzdHJlYW0gYnV0IHRoZXJlIGlzIG5vdGhpbmcgdG8gaGFuZGxlIGl0LFxuICAgIC8vdGhlbiByZXR1cm4gYW4gZXJyb3IgdG8gdGhlIG90aGVyIHNpZGUuXG4gICAgLy9zdGlsbCB0cnlpbmcgdG8gdGhpbmsgb2YgdGhlIGJlc3QgZXJyb3IgbWVzc2FnZS5cbiAgICBpZihvdXRlci5saXN0ZW5lcnMoJ2Nvbm5lY3Rpb24nKS5sZW5ndGggPT09IDEpXG4gICAgICBzdHJlYW0uZXJyb3IoJ3JlbW90ZSBlbmQgbGFja3MgY29ubmVjdGlvbiBsaXN0ZW5lciAnIFxuICAgICAgICArIG91dGVyLmxpc3RlbmVycygnY29ubmVjdGlvbicpLmxlbmd0aClcbiAgfSlcblxuICB2YXIgcGlwZSA9IG91dGVyLnBpcGVcbiAgb3V0ZXIucGlwZSA9IGZ1bmN0aW9uIChkZXN0LCBvcHRzKSB7XG4gICAgcGlwZS5jYWxsKG91dGVyLCBkZXN0LCBvcHRzKVxuICAgIG1kLm9uKCdlbmQnLCBkZXN0cm95QWxsKVxuICAgIG1kLm9uKCdjbG9zZScsIGRlc3Ryb3lBbGwpXG4gICAgbWQub24oJ2Vycm9yJywgZGVzdHJveUFsbClcbiAgICByZXR1cm4gZGVzdFxuICB9XG5cbiAgb3V0ZXIuY3JlYXRlU3RyZWFtID0gZnVuY3Rpb24gKG1ldGEsIG9wdHMpIHtcbiAgICBvcHRzID0gb3B0cyB8fCB7fVxuICAgIGlmICghb3B0cy53cml0YWJsZSAmJiAhb3B0cy5yZWFkYWJsZSlcbiAgICAgIG9wdHMucmVhZGFibGUgPSBvcHRzLndyaXRhYmxlID0gdHJ1ZVxuICAgIHZhciBzID0gY3JlYXRlU3RyZWFtKGNyZWF0ZUlEKCksIG1ldGEsIG9wdHMpXG4gICAgdmFyIF9vcHRzID0ge3dyaXRhYmxlOiBvcHRzLnJlYWRhYmxlLCByZWFkYWJsZTogb3B0cy53cml0YWJsZX1cbiAgICBtZC5fZGF0YShbcy5pZCwgJ25ldycsIHttZXRhOiBtZXRhLCBvcHRzOiBfb3B0c31dKVxuICAgIHJldHVybiBzXG4gIH1cbiAgb3V0ZXIuY3JlYXRlV3JpdGVTdHJlYW0gPSBmdW5jdGlvbiAobWV0YSkge1xuICAgIHJldHVybiBvdXRlci5jcmVhdGVTdHJlYW0obWV0YSwge3dyaXRhYmxlOiB0cnVlLCByZWFkYWJsZTogZmFsc2V9KVxuICB9XG4gIG91dGVyLmNyZWF0ZVJlYWRTdHJlYW0gPSBmdW5jdGlvbiAobWV0YSkge1xuICAgIHJldHVybiBvdXRlci5jcmVhdGVTdHJlYW0obWV0YSwge3dyaXRhYmxlOiBmYWxzZSwgcmVhZGFibGU6IHRydWV9KVxuICB9XG5cbiAgcmV0dXJuIG91dGVyXG59XG5cbiAgcmV0dXJuIE11eERlbXV4XG59IC8vaW5qZWN0XG5cbiIsIihmdW5jdGlvbihwcm9jZXNzKXt2YXIgU3RyZWFtID0gcmVxdWlyZSgnc3RyZWFtJylcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAod3JpdGUsIGVuZCkge1xuICB2YXIgc3RyZWFtID0gbmV3IFN0cmVhbSgpIFxuICB2YXIgYnVmZmVyID0gW10sIGVuZGVkID0gZmFsc2UsIGRlc3Ryb3llZCA9IGZhbHNlLCBlbWl0RW5kXG4gIHN0cmVhbS53cml0YWJsZSA9IHN0cmVhbS5yZWFkYWJsZSA9IHRydWVcbiAgc3RyZWFtLnBhdXNlZCA9IGZhbHNlXG4gIHN0cmVhbS5fcGF1c2VkID0gZmFsc2VcbiAgc3RyZWFtLmJ1ZmZlciA9IGJ1ZmZlclxuICBcbiAgc3RyZWFtXG4gICAgLm9uKCdwYXVzZScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHN0cmVhbS5fcGF1c2VkID0gdHJ1ZVxuICAgIH0pXG4gICAgLm9uKCdkcmFpbicsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHN0cmVhbS5fcGF1c2VkID0gZmFsc2VcbiAgICB9KVxuICAgXG4gIGZ1bmN0aW9uIGRlc3Ryb3lTb29uICgpIHtcbiAgICBwcm9jZXNzLm5leHRUaWNrKHN0cmVhbS5kZXN0cm95LmJpbmQoc3RyZWFtKSlcbiAgfVxuXG4gIGlmKHdyaXRlKVxuICAgIHN0cmVhbS5vbignX2RhdGEnLCB3cml0ZSlcbiAgaWYoZW5kKVxuICAgIHN0cmVhbS5vbignX2VuZCcsIGVuZClcblxuICAvL2Rlc3Ryb3kgdGhlIHN0cmVhbSBvbmNlIGJvdGggZW5kcyBhcmUgb3ZlclxuICAvL2J1dCBkbyBpdCBpbiBuZXh0VGljaywgc28gdGhhdCBvdGhlciBsaXN0ZW5lcnNcbiAgLy9vbiBlbmQgaGF2ZSB0aW1lIHRvIHJlc3BvbmRcbiAgc3RyZWFtLm9uY2UoJ2VuZCcsIGZ1bmN0aW9uICgpIHsgXG4gICAgc3RyZWFtLnJlYWRhYmxlID0gZmFsc2VcbiAgICBpZighc3RyZWFtLndyaXRhYmxlKSB7XG4gICAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3RyZWFtLmRlc3Ryb3koKVxuICAgICAgfSlcbiAgICB9XG4gIH0pXG5cbiAgc3RyZWFtLm9uY2UoJ19lbmQnLCBmdW5jdGlvbiAoKSB7IFxuICAgIHN0cmVhbS53cml0YWJsZSA9IGZhbHNlXG4gICAgaWYoIXN0cmVhbS5yZWFkYWJsZSlcbiAgICAgIHN0cmVhbS5kZXN0cm95KClcbiAgfSlcblxuICAvLyB0aGlzIGlzIHRoZSBkZWZhdWx0IHdyaXRlIG1ldGhvZCxcbiAgLy8gaWYgeW91IG92ZXJpZGUgaXQsIHlvdSBhcmUgcmVzcG9zaWJsZVxuICAvLyBmb3IgcGF1c2Ugc3RhdGUuXG5cbiAgXG4gIHN0cmVhbS5fZGF0YSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgaWYoIXN0cmVhbS5wYXVzZWQgJiYgIWJ1ZmZlci5sZW5ndGgpXG4gICAgICBzdHJlYW0uZW1pdCgnZGF0YScsIGRhdGEpXG4gICAgZWxzZSBcbiAgICAgIGJ1ZmZlci5wdXNoKGRhdGEpXG4gICAgcmV0dXJuICEoc3RyZWFtLnBhdXNlZCB8fCBidWZmZXIubGVuZ3RoKVxuICB9XG5cbiAgc3RyZWFtLl9lbmQgPSBmdW5jdGlvbiAoZGF0YSkgeyBcbiAgICBpZihkYXRhKSBzdHJlYW0uX2RhdGEoZGF0YSlcbiAgICBpZihlbWl0RW5kKSByZXR1cm5cbiAgICBlbWl0RW5kID0gdHJ1ZVxuICAgIC8vZGVzdHJveSBpcyBoYW5kbGVkIGFib3ZlLlxuICAgIHN0cmVhbS5kcmFpbigpXG4gIH1cblxuICBzdHJlYW0ud3JpdGUgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgIHN0cmVhbS5lbWl0KCdfZGF0YScsIGRhdGEpXG4gICAgcmV0dXJuICFzdHJlYW0uX3BhdXNlZFxuICB9XG5cbiAgc3RyZWFtLmVuZCA9IGZ1bmN0aW9uICgpIHtcbiAgICBzdHJlYW0ud3JpdGFibGUgPSBmYWxzZVxuICAgIGlmKHN0cmVhbS5lbmRlZCkgcmV0dXJuXG4gICAgc3RyZWFtLmVuZGVkID0gdHJ1ZVxuICAgIHN0cmVhbS5lbWl0KCdfZW5kJylcbiAgfVxuXG4gIHN0cmVhbS5kcmFpbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZighYnVmZmVyLmxlbmd0aCAmJiAhZW1pdEVuZCkgcmV0dXJuXG4gICAgLy9pZiB0aGUgc3RyZWFtIGlzIHBhdXNlZCBhZnRlciBqdXN0IGJlZm9yZSBlbWl0RW5kKClcbiAgICAvL2VuZCBzaG91bGQgYmUgYnVmZmVyZWQuXG4gICAgd2hpbGUoIXN0cmVhbS5wYXVzZWQpIHtcbiAgICAgIGlmKGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgc3RyZWFtLmVtaXQoJ2RhdGEnLCBidWZmZXIuc2hpZnQoKSlcbiAgICAgICAgaWYoYnVmZmVyLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgc3RyZWFtLmVtaXQoJ19kcmFpbicpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYoZW1pdEVuZCAmJiBzdHJlYW0ucmVhZGFibGUpIHtcbiAgICAgICAgc3RyZWFtLnJlYWRhYmxlID0gZmFsc2VcbiAgICAgICAgc3RyZWFtLmVtaXQoJ2VuZCcpXG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy9pZiB0aGUgYnVmZmVyIGhhcyBlbXB0aWVkLiBlbWl0IGRyYWluLlxuICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxuICB2YXIgc3RhcnRlZCA9IGZhbHNlXG4gIHN0cmVhbS5yZXN1bWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy90aGlzIGlzIHdoZXJlIEkgbmVlZCBwYXVzZVJlYWQsIGFuZCBwYXVzZVdyaXRlLlxuICAgIC8vaGVyZSB0aGUgcmVhZGluZyBzaWRlIGlzIHVucGF1c2VkLFxuICAgIC8vYnV0IHRoZSB3cml0aW5nIHNpZGUgbWF5IHN0aWxsIGJlIHBhdXNlZC5cbiAgICAvL3RoZSB3aG9sZSBidWZmZXIgbWlnaHQgbm90IGVtcGl0eSBhdCBvbmNlLlxuICAgIC8vaXQgbWlnaHQgcGF1c2UgYWdhaW4uXG4gICAgLy90aGUgc3RyZWFtIHNob3VsZCBuZXZlciBlbWl0IGRhdGEgaW5iZXR3ZWVuIHBhdXNlKCkuLi5yZXN1bWUoKVxuICAgIC8vYW5kIHdyaXRlIHNob3VsZCByZXR1cm4gIWJ1ZmZlci5sZW5ndGhcbiAgICBzdGFydGVkID0gdHJ1ZVxuICAgIHN0cmVhbS5wYXVzZWQgPSBmYWxzZVxuICAgIHN0cmVhbS5kcmFpbigpIC8vd2lsbCBlbWl0IGRyYWluIGlmIGJ1ZmZlciBlbXB0aWVzLlxuICAgIHJldHVybiBzdHJlYW1cbiAgfVxuXG4gIHN0cmVhbS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmKGRlc3Ryb3llZCkgcmV0dXJuXG4gICAgZGVzdHJveWVkID0gZW5kZWQgPSB0cnVlICAgICBcbiAgICBidWZmZXIubGVuZ3RoID0gMFxuICAgIHN0cmVhbS5lbWl0KCdjbG9zZScpXG4gIH1cbiAgdmFyIHBhdXNlQ2FsbGVkID0gZmFsc2VcbiAgc3RyZWFtLnBhdXNlID0gZnVuY3Rpb24gKCkge1xuICAgIHN0YXJ0ZWQgPSB0cnVlXG4gICAgc3RyZWFtLnBhdXNlZCA9IHRydWVcbiAgICBzdHJlYW0uZW1pdCgnX3BhdXNlJylcbiAgICByZXR1cm4gc3RyZWFtXG4gIH1cbiAgc3RyZWFtLl9wYXVzZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZighc3RyZWFtLl9wYXVzZWQpIHtcbiAgICAgIHN0cmVhbS5fcGF1c2VkID0gdHJ1ZVxuICAgICAgc3RyZWFtLmVtaXQoJ3BhdXNlJylcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuICBzdHJlYW0ucGF1c2VkID0gdHJ1ZVxuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAvL3VubGVzcyB0aGUgdXNlciBtYW51YWxseSBwYXVzZWRcbiAgICBpZihzdGFydGVkKSByZXR1cm5cbiAgICBzdHJlYW0ucmVzdW1lKClcbiAgfSlcbiBcbiAgcmV0dXJuIHN0cmVhbVxufVxuXG5cbn0pKHJlcXVpcmUoXCJfX2Jyb3dzZXJpZnlfcHJvY2Vzc1wiKSkiLCJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXJcblxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHdyYXBwZXIpIHtcblxuICBpZignZnVuY3Rpb24nID09IHR5cGVvZiB3cmFwcGVyKVxuICAgIHJldHVybiB3cmFwcGVyXG4gIFxuICByZXR1cm4gZXhwb3J0c1t3cmFwcGVyXSB8fCBleHBvcnRzLmpzb25cbn1cblxuZXhwb3J0cy5qc29uID0gZnVuY3Rpb24gKHN0cmVhbSkge1xuXG4gIHZhciB3cml0ZSA9IHN0cmVhbS53cml0ZVxuICB2YXIgc29GYXIgPSAnJ1xuXG4gIGZ1bmN0aW9uIHBhcnNlIChsaW5lKSB7XG4gICAgdmFyIGpzXG4gICAgdHJ5IHtcbiAgICAgIGpzID0gSlNPTi5wYXJzZShsaW5lKVxuICAgICAgLy9pZ25vcmUgbGluZXMgb2Ygd2hpdGVzcGFjZS4uLlxuICAgIH0gY2F0Y2ggKGVycikgeyBcbiAgICAgIHJldHVybiBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcnIpXG4gICAgICAvL3JldHVybiBjb25zb2xlLmVycm9yKCdpbnZhbGlkIEpTT04nLCBsaW5lKVxuICAgIH1cbiAgICBpZihqcyAhPT0gdW5kZWZpbmVkKVxuICAgICAgd3JpdGUuY2FsbChzdHJlYW0sIGpzKVxuICB9XG5cbiAgZnVuY3Rpb24gb25EYXRhIChkYXRhKSB7XG4gICAgdmFyIGxpbmVzID0gKHNvRmFyICsgZGF0YSkuc3BsaXQoJ1xcbicpXG4gICAgc29GYXIgPSBsaW5lcy5wb3AoKVxuICAgIHdoaWxlKGxpbmVzLmxlbmd0aCkge1xuICAgICAgcGFyc2UobGluZXMuc2hpZnQoKSlcbiAgICB9XG4gIH1cblxuICBzdHJlYW0ud3JpdGUgPSBvbkRhdGFcbiAgXG4gIHZhciBlbmQgPSBzdHJlYW0uZW5kXG5cbiAgc3RyZWFtLmVuZCA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgaWYoZGF0YSlcbiAgICAgIHN0cmVhbS53cml0ZShkYXRhKVxuICAgIC8vaWYgdGhlcmUgaXMgYW55IGxlZnQgb3Zlci4uLlxuICAgIGlmKHNvRmFyKSB7XG4gICAgICBwYXJzZShzb0ZhcilcbiAgICB9XG4gICAgcmV0dXJuIGVuZC5jYWxsKHN0cmVhbSlcbiAgfVxuXG4gIHN0cmVhbS5lbWl0ID0gZnVuY3Rpb24gKGV2ZW50LCBkYXRhKSB7XG5cbiAgICBpZihldmVudCA9PSAnZGF0YScpIHtcbiAgICAgIGRhdGEgPSBKU09OLnN0cmluZ2lmeShkYXRhKSArICdcXG4nXG4gICAgfVxuICAgIC8vc2luY2UgYWxsIHN0cmVhbSBldmVudHMgb25seSB1c2Ugb25lIGFyZ3VtZW50LCB0aGlzIGlzIG9rYXkuLi5cbiAgICBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQuY2FsbChzdHJlYW0sIGV2ZW50LCBkYXRhKVxuICB9XG5cbiAgcmV0dXJuIHN0cmVhbVxuLy8gIHJldHVybiBlcy5waXBlbGluZShlcy5zcGxpdCgpLCBlcy5wYXJzZSgpLCBzdHJlYW0sIGVzLnN0cmluZ2lmeSgpKVxufVxuXG5leHBvcnRzLnJhdyA9IGZ1bmN0aW9uIChzdHJlYW0pIHtcbiAgcmV0dXJuIHN0cmVhbVxufVxuXG4iLCIoZnVuY3Rpb24ocHJvY2Vzcyl7dmFyIFN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpXG5cbi8vIHRocm91Z2hcbi8vXG4vLyBhIHN0cmVhbSB0aGF0IGRvZXMgbm90aGluZyBidXQgcmUtZW1pdCB0aGUgaW5wdXQuXG4vLyB1c2VmdWwgZm9yIGFnZ3JlZ2F0aW5nIGEgc2VyaWVzIG9mIGNoYW5naW5nIGJ1dCBub3QgZW5kaW5nIHN0cmVhbXMgaW50byBvbmUgc3RyZWFtKVxuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB0aHJvdWdoXG50aHJvdWdoLnRocm91Z2ggPSB0aHJvdWdoXG5cbi8vY3JlYXRlIGEgcmVhZGFibGUgd3JpdGFibGUgc3RyZWFtLlxuXG5mdW5jdGlvbiB0aHJvdWdoICh3cml0ZSwgZW5kLCBvcHRzKSB7XG4gIHdyaXRlID0gd3JpdGUgfHwgZnVuY3Rpb24gKGRhdGEpIHsgdGhpcy5xdWV1ZShkYXRhKSB9XG4gIGVuZCA9IGVuZCB8fCBmdW5jdGlvbiAoKSB7IHRoaXMucXVldWUobnVsbCkgfVxuXG4gIHZhciBlbmRlZCA9IGZhbHNlLCBkZXN0cm95ZWQgPSBmYWxzZSwgYnVmZmVyID0gW10sIF9lbmRlZCA9IGZhbHNlXG4gIHZhciBzdHJlYW0gPSBuZXcgU3RyZWFtKClcbiAgc3RyZWFtLnJlYWRhYmxlID0gc3RyZWFtLndyaXRhYmxlID0gdHJ1ZVxuICBzdHJlYW0ucGF1c2VkID0gZmFsc2VcblxuLy8gIHN0cmVhbS5hdXRvUGF1c2UgICA9ICEob3B0cyAmJiBvcHRzLmF1dG9QYXVzZSAgID09PSBmYWxzZSlcbiAgc3RyZWFtLmF1dG9EZXN0cm95ID0gIShvcHRzICYmIG9wdHMuYXV0b0Rlc3Ryb3kgPT09IGZhbHNlKVxuXG4gIHN0cmVhbS53cml0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgd3JpdGUuY2FsbCh0aGlzLCBkYXRhKVxuICAgIHJldHVybiAhc3RyZWFtLnBhdXNlZFxuICB9XG5cbiAgZnVuY3Rpb24gZHJhaW4oKSB7XG4gICAgd2hpbGUoYnVmZmVyLmxlbmd0aCAmJiAhc3RyZWFtLnBhdXNlZCkge1xuICAgICAgdmFyIGRhdGEgPSBidWZmZXIuc2hpZnQoKVxuICAgICAgaWYobnVsbCA9PT0gZGF0YSlcbiAgICAgICAgcmV0dXJuIHN0cmVhbS5lbWl0KCdlbmQnKVxuICAgICAgZWxzZVxuICAgICAgICBzdHJlYW0uZW1pdCgnZGF0YScsIGRhdGEpXG4gICAgfVxuICB9XG5cbiAgc3RyZWFtLnF1ZXVlID0gc3RyZWFtLnB1c2ggPSBmdW5jdGlvbiAoZGF0YSkge1xuLy8gICAgY29uc29sZS5lcnJvcihlbmRlZClcbiAgICBpZihfZW5kZWQpIHJldHVybiBzdHJlYW1cbiAgICBpZihkYXRhID09IG51bGwpIF9lbmRlZCA9IHRydWVcbiAgICBidWZmZXIucHVzaChkYXRhKVxuICAgIGRyYWluKClcbiAgICByZXR1cm4gc3RyZWFtXG4gIH1cblxuICAvL3RoaXMgd2lsbCBiZSByZWdpc3RlcmVkIGFzIHRoZSBmaXJzdCAnZW5kJyBsaXN0ZW5lclxuICAvL211c3QgY2FsbCBkZXN0cm95IG5leHQgdGljaywgdG8gbWFrZSBzdXJlIHdlJ3JlIGFmdGVyIGFueVxuICAvL3N0cmVhbSBwaXBlZCBmcm9tIGhlcmUuXG4gIC8vdGhpcyBpcyBvbmx5IGEgcHJvYmxlbSBpZiBlbmQgaXMgbm90IGVtaXR0ZWQgc3luY2hyb25vdXNseS5cbiAgLy9hIG5pY2VyIHdheSB0byBkbyB0aGlzIGlzIHRvIG1ha2Ugc3VyZSB0aGlzIGlzIHRoZSBsYXN0IGxpc3RlbmVyIGZvciAnZW5kJ1xuXG4gIHN0cmVhbS5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuICAgIHN0cmVhbS5yZWFkYWJsZSA9IGZhbHNlXG4gICAgaWYoIXN0cmVhbS53cml0YWJsZSAmJiBzdHJlYW0uYXV0b0Rlc3Ryb3kpXG4gICAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3RyZWFtLmRlc3Ryb3koKVxuICAgICAgfSlcbiAgfSlcblxuICBmdW5jdGlvbiBfZW5kICgpIHtcbiAgICBzdHJlYW0ud3JpdGFibGUgPSBmYWxzZVxuICAgIGVuZC5jYWxsKHN0cmVhbSlcbiAgICBpZighc3RyZWFtLnJlYWRhYmxlICYmIHN0cmVhbS5hdXRvRGVzdHJveSlcbiAgICAgIHN0cmVhbS5kZXN0cm95KClcbiAgfVxuXG4gIHN0cmVhbS5lbmQgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgIGlmKGVuZGVkKSByZXR1cm5cbiAgICBlbmRlZCA9IHRydWVcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoKSBzdHJlYW0ud3JpdGUoZGF0YSlcbiAgICBfZW5kKCkgLy8gd2lsbCBlbWl0IG9yIHF1ZXVlXG4gICAgcmV0dXJuIHN0cmVhbVxuICB9XG5cbiAgc3RyZWFtLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYoZGVzdHJveWVkKSByZXR1cm5cbiAgICBkZXN0cm95ZWQgPSB0cnVlXG4gICAgZW5kZWQgPSB0cnVlXG4gICAgYnVmZmVyLmxlbmd0aCA9IDBcbiAgICBzdHJlYW0ud3JpdGFibGUgPSBzdHJlYW0ucmVhZGFibGUgPSBmYWxzZVxuICAgIHN0cmVhbS5lbWl0KCdjbG9zZScpXG4gICAgcmV0dXJuIHN0cmVhbVxuICB9XG5cbiAgc3RyZWFtLnBhdXNlID0gZnVuY3Rpb24gKCkge1xuICAgIGlmKHN0cmVhbS5wYXVzZWQpIHJldHVyblxuICAgIHN0cmVhbS5wYXVzZWQgPSB0cnVlXG4gICAgcmV0dXJuIHN0cmVhbVxuICB9XG5cbiAgc3RyZWFtLnJlc3VtZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZihzdHJlYW0ucGF1c2VkKSB7XG4gICAgICBzdHJlYW0ucGF1c2VkID0gZmFsc2VcbiAgICAgIHN0cmVhbS5lbWl0KCdyZXN1bWUnKVxuICAgIH1cbiAgICBkcmFpbigpXG4gICAgLy9tYXkgaGF2ZSBiZWNvbWUgcGF1c2VkIGFnYWluLFxuICAgIC8vYXMgZHJhaW4gZW1pdHMgJ2RhdGEnLlxuICAgIGlmKCFzdHJlYW0ucGF1c2VkKVxuICAgICAgc3RyZWFtLmVtaXQoJ2RyYWluJylcbiAgICByZXR1cm4gc3RyZWFtXG4gIH1cbiAgcmV0dXJuIHN0cmVhbVxufVxuXG5cbn0pKHJlcXVpcmUoXCJfX2Jyb3dzZXJpZnlfcHJvY2Vzc1wiKSkiLCJtb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFxuXG5mdW5jdGlvbiBleHRlbmQodGFyZ2V0KSB7XG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXSxcbiAgICAgICAgICAgIGtleXMgPSBPYmplY3Qua2V5cyhzb3VyY2UpXG5cbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBrZXlzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IGtleXNbal1cbiAgICAgICAgICAgIHRhcmdldFtuYW1lXSA9IHNvdXJjZVtuYW1lXVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldFxufSIsInZhciBTdHJlYW0gPSByZXF1aXJlKCdzdHJlYW0nKTtcbnZhciBzb2NranMgPSByZXF1aXJlKCdzb2NranMtY2xpZW50Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHVyaSwgY2IpIHtcbiAgICBpZiAoL15cXC9cXC9bXlxcL10rXFwvLy50ZXN0KHVyaSkpIHtcbiAgICAgICAgdXJpID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sICsgdXJpO1xuICAgIH1cbiAgICBlbHNlIGlmICghL15odHRwcz86XFwvXFwvLy50ZXN0KHVyaSkpIHtcbiAgICAgICAgdXJpID0gd2luZG93LmxvY2F0aW9uLnByb3RvY29sICsgJy8vJ1xuICAgICAgICAgICAgKyB3aW5kb3cubG9jYXRpb24uaG9zdFxuICAgICAgICAgICAgKyAoL15cXC8vLnRlc3QodXJpKSA/IHVyaSA6ICcvJyArIHVyaSlcbiAgICAgICAgO1xuICAgIH1cbiAgICBcbiAgICB2YXIgc3RyZWFtID0gbmV3IFN0cmVhbTtcbiAgICBzdHJlYW0ucmVhZGFibGUgPSB0cnVlO1xuICAgIHN0cmVhbS53cml0YWJsZSA9IHRydWU7XG4gICAgXG4gICAgdmFyIHJlYWR5ID0gZmFsc2U7XG4gICAgdmFyIGJ1ZmZlciA9IFtdO1xuICAgIFxuICAgIHZhciBzb2NrID0gc29ja2pzKHVyaSk7XG4gICAgc3RyZWFtLnNvY2sgPSBzb2NrO1xuICAgIFxuICAgIHN0cmVhbS53cml0ZSA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICAgICAgaWYgKCFyZWFkeSB8fCBidWZmZXIubGVuZ3RoKSBidWZmZXIucHVzaChtc2cpXG4gICAgICAgIGVsc2Ugc29jay5zZW5kKG1zZylcbiAgICB9O1xuICAgIFxuICAgIHN0cmVhbS5lbmQgPSBmdW5jdGlvbiAobXNnKSB7XG4gICAgICAgIGlmIChtc2cgIT09IHVuZGVmaW5lZCkgc3RyZWFtLndyaXRlKG1zZyk7XG4gICAgICAgIGlmICghcmVhZHkpIHtcbiAgICAgICAgICAgIHN0cmVhbS5fZW5kZWQgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHN0cmVhbS53cml0YWJsZSA9IGZhbHNlO1xuICAgICAgICBzb2NrLmNsb3NlKCk7XG4gICAgfTtcbiAgICBcbiAgICBzdHJlYW0uZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3RyZWFtLl9lbmRlZCA9IHRydWU7XG4gICAgICAgIHN0cmVhbS53cml0YWJsZSA9IHN0cmVhbS5yZWFkYWJsZSA9IGZhbHNlO1xuICAgICAgICBidWZmZXIubGVuZ3RoID0gMFxuICAgICAgICBzb2NrLmNsb3NlKCk7XG4gICAgfTtcbiAgICBcbiAgICBzb2NrLm9ub3BlbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykgY2IoKTtcbiAgICAgICAgcmVhZHkgPSB0cnVlO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgc29jay5zZW5kKGJ1ZmZlcltpXSk7XG4gICAgICAgIH1cbiAgICAgICAgYnVmZmVyID0gW107XG4gICAgICAgIHN0cmVhbS5lbWl0KCdjb25uZWN0Jyk7XG4gICAgICAgIGlmIChzdHJlYW0uX2VuZGVkKSBzdHJlYW0uZW5kKCk7XG4gICAgfTtcbiAgICBcbiAgICBzb2NrLm9ubWVzc2FnZSA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIHN0cmVhbS5lbWl0KCdkYXRhJywgZS5kYXRhKTtcbiAgICB9O1xuICAgIFxuICAgIHNvY2sub25jbG9zZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3RyZWFtLmVtaXQoJ2VuZCcpO1xuICAgICAgICBzdHJlYW0ud3JpdGFibGUgPSBmYWxzZTtcbiAgICAgICAgc3RyZWFtLnJlYWRhYmxlID0gZmFsc2U7XG4gICAgfTtcbiAgICBcbiAgICByZXR1cm4gc3RyZWFtO1xufTtcbiIsIihmdW5jdGlvbigpey8qIFNvY2tKUyBjbGllbnQsIHZlcnNpb24gMC4zLjEuNy5nYTY3Zi5kaXJ0eSwgaHR0cDovL3NvY2tqcy5vcmcsIE1JVCBMaWNlbnNlXG5cbkNvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuXG5QZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYSBjb3B5XG5vZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsXG5pbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzXG50byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsXG5jb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXNcbmZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XG5cblRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluXG5hbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cblxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG5GSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbkFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbkxJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG5PVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG5USEUgU09GVFdBUkUuXG4qL1xuXG4vLyBKU09OMiBieSBEb3VnbGFzIENyb2NrZm9yZCAobWluaWZpZWQpLlxudmFyIEpTT047SlNPTnx8KEpTT049e30pLGZ1bmN0aW9uKCl7ZnVuY3Rpb24gc3RyKGEsYil7dmFyIGMsZCxlLGYsZz1nYXAsaCxpPWJbYV07aSYmdHlwZW9mIGk9PVwib2JqZWN0XCImJnR5cGVvZiBpLnRvSlNPTj09XCJmdW5jdGlvblwiJiYoaT1pLnRvSlNPTihhKSksdHlwZW9mIHJlcD09XCJmdW5jdGlvblwiJiYoaT1yZXAuY2FsbChiLGEsaSkpO3N3aXRjaCh0eXBlb2YgaSl7Y2FzZVwic3RyaW5nXCI6cmV0dXJuIHF1b3RlKGkpO2Nhc2VcIm51bWJlclwiOnJldHVybiBpc0Zpbml0ZShpKT9TdHJpbmcoaSk6XCJudWxsXCI7Y2FzZVwiYm9vbGVhblwiOmNhc2VcIm51bGxcIjpyZXR1cm4gU3RyaW5nKGkpO2Nhc2VcIm9iamVjdFwiOmlmKCFpKXJldHVyblwibnVsbFwiO2dhcCs9aW5kZW50LGg9W107aWYoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5hcHBseShpKT09PVwiW29iamVjdCBBcnJheV1cIil7Zj1pLmxlbmd0aDtmb3IoYz0wO2M8ZjtjKz0xKWhbY109c3RyKGMsaSl8fFwibnVsbFwiO2U9aC5sZW5ndGg9PT0wP1wiW11cIjpnYXA/XCJbXFxuXCIrZ2FwK2guam9pbihcIixcXG5cIitnYXApK1wiXFxuXCIrZytcIl1cIjpcIltcIitoLmpvaW4oXCIsXCIpK1wiXVwiLGdhcD1nO3JldHVybiBlfWlmKHJlcCYmdHlwZW9mIHJlcD09XCJvYmplY3RcIil7Zj1yZXAubGVuZ3RoO2ZvcihjPTA7YzxmO2MrPTEpdHlwZW9mIHJlcFtjXT09XCJzdHJpbmdcIiYmKGQ9cmVwW2NdLGU9c3RyKGQsaSksZSYmaC5wdXNoKHF1b3RlKGQpKyhnYXA/XCI6IFwiOlwiOlwiKStlKSl9ZWxzZSBmb3IoZCBpbiBpKU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChpLGQpJiYoZT1zdHIoZCxpKSxlJiZoLnB1c2gocXVvdGUoZCkrKGdhcD9cIjogXCI6XCI6XCIpK2UpKTtlPWgubGVuZ3RoPT09MD9cInt9XCI6Z2FwP1wie1xcblwiK2dhcCtoLmpvaW4oXCIsXFxuXCIrZ2FwKStcIlxcblwiK2crXCJ9XCI6XCJ7XCIraC5qb2luKFwiLFwiKStcIn1cIixnYXA9ZztyZXR1cm4gZX19ZnVuY3Rpb24gcXVvdGUoYSl7ZXNjYXBhYmxlLmxhc3RJbmRleD0wO3JldHVybiBlc2NhcGFibGUudGVzdChhKT8nXCInK2EucmVwbGFjZShlc2NhcGFibGUsZnVuY3Rpb24oYSl7dmFyIGI9bWV0YVthXTtyZXR1cm4gdHlwZW9mIGI9PVwic3RyaW5nXCI/YjpcIlxcXFx1XCIrKFwiMDAwMFwiK2EuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikpLnNsaWNlKC00KX0pKydcIic6J1wiJythKydcIid9ZnVuY3Rpb24gZihhKXtyZXR1cm4gYTwxMD9cIjBcIithOmF9XCJ1c2Ugc3RyaWN0XCIsdHlwZW9mIERhdGUucHJvdG90eXBlLnRvSlNPTiE9XCJmdW5jdGlvblwiJiYoRGF0ZS5wcm90b3R5cGUudG9KU09OPWZ1bmN0aW9uKGEpe3JldHVybiBpc0Zpbml0ZSh0aGlzLnZhbHVlT2YoKSk/dGhpcy5nZXRVVENGdWxsWWVhcigpK1wiLVwiK2YodGhpcy5nZXRVVENNb250aCgpKzEpK1wiLVwiK2YodGhpcy5nZXRVVENEYXRlKCkpK1wiVFwiK2YodGhpcy5nZXRVVENIb3VycygpKStcIjpcIitmKHRoaXMuZ2V0VVRDTWludXRlcygpKStcIjpcIitmKHRoaXMuZ2V0VVRDU2Vjb25kcygpKStcIlpcIjpudWxsfSxTdHJpbmcucHJvdG90eXBlLnRvSlNPTj1OdW1iZXIucHJvdG90eXBlLnRvSlNPTj1Cb29sZWFuLnByb3RvdHlwZS50b0pTT049ZnVuY3Rpb24oYSl7cmV0dXJuIHRoaXMudmFsdWVPZigpfSk7dmFyIGN4PS9bXFx1MDAwMFxcdTAwYWRcXHUwNjAwLVxcdTA2MDRcXHUwNzBmXFx1MTdiNFxcdTE3YjVcXHUyMDBjLVxcdTIwMGZcXHUyMDI4LVxcdTIwMmZcXHUyMDYwLVxcdTIwNmZcXHVmZWZmXFx1ZmZmMC1cXHVmZmZmXS9nLGVzY2FwYWJsZT0vW1xcXFxcXFwiXFx4MDAtXFx4MWZcXHg3Zi1cXHg5ZlxcdTAwYWRcXHUwNjAwLVxcdTA2MDRcXHUwNzBmXFx1MTdiNFxcdTE3YjVcXHUyMDBjLVxcdTIwMGZcXHUyMDI4LVxcdTIwMmZcXHUyMDYwLVxcdTIwNmZcXHVmZWZmXFx1ZmZmMC1cXHVmZmZmXS9nLGdhcCxpbmRlbnQsbWV0YT17XCJcXGJcIjpcIlxcXFxiXCIsXCJcXHRcIjpcIlxcXFx0XCIsXCJcXG5cIjpcIlxcXFxuXCIsXCJcXGZcIjpcIlxcXFxmXCIsXCJcXHJcIjpcIlxcXFxyXCIsJ1wiJzonXFxcXFwiJyxcIlxcXFxcIjpcIlxcXFxcXFxcXCJ9LHJlcDt0eXBlb2YgSlNPTi5zdHJpbmdpZnkhPVwiZnVuY3Rpb25cIiYmKEpTT04uc3RyaW5naWZ5PWZ1bmN0aW9uKGEsYixjKXt2YXIgZDtnYXA9XCJcIixpbmRlbnQ9XCJcIjtpZih0eXBlb2YgYz09XCJudW1iZXJcIilmb3IoZD0wO2Q8YztkKz0xKWluZGVudCs9XCIgXCI7ZWxzZSB0eXBlb2YgYz09XCJzdHJpbmdcIiYmKGluZGVudD1jKTtyZXA9YjtpZighYnx8dHlwZW9mIGI9PVwiZnVuY3Rpb25cInx8dHlwZW9mIGI9PVwib2JqZWN0XCImJnR5cGVvZiBiLmxlbmd0aD09XCJudW1iZXJcIilyZXR1cm4gc3RyKFwiXCIse1wiXCI6YX0pO3Rocm93IG5ldyBFcnJvcihcIkpTT04uc3RyaW5naWZ5XCIpfSksdHlwZW9mIEpTT04ucGFyc2UhPVwiZnVuY3Rpb25cIiYmKEpTT04ucGFyc2U9ZnVuY3Rpb24odGV4dCxyZXZpdmVyKXtmdW5jdGlvbiB3YWxrKGEsYil7dmFyIGMsZCxlPWFbYl07aWYoZSYmdHlwZW9mIGU9PVwib2JqZWN0XCIpZm9yKGMgaW4gZSlPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxjKSYmKGQ9d2FsayhlLGMpLGQhPT11bmRlZmluZWQ/ZVtjXT1kOmRlbGV0ZSBlW2NdKTtyZXR1cm4gcmV2aXZlci5jYWxsKGEsYixlKX12YXIgajt0ZXh0PVN0cmluZyh0ZXh0KSxjeC5sYXN0SW5kZXg9MCxjeC50ZXN0KHRleHQpJiYodGV4dD10ZXh0LnJlcGxhY2UoY3gsZnVuY3Rpb24oYSl7cmV0dXJuXCJcXFxcdVwiKyhcIjAwMDBcIithLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpKS5zbGljZSgtNCl9KSk7aWYoL15bXFxdLDp7fVxcc10qJC8udGVzdCh0ZXh0LnJlcGxhY2UoL1xcXFwoPzpbXCJcXFxcXFwvYmZucnRdfHVbMC05YS1mQS1GXXs0fSkvZyxcIkBcIikucmVwbGFjZSgvXCJbXlwiXFxcXFxcblxccl0qXCJ8dHJ1ZXxmYWxzZXxudWxsfC0/XFxkKyg/OlxcLlxcZCopPyg/OltlRV1bK1xcLV0/XFxkKyk/L2csXCJdXCIpLnJlcGxhY2UoLyg/Ol58OnwsKSg/OlxccypcXFspKy9nLFwiXCIpKSl7aj1ldmFsKFwiKFwiK3RleHQrXCIpXCIpO3JldHVybiB0eXBlb2YgcmV2aXZlcj09XCJmdW5jdGlvblwiP3dhbGsoe1wiXCI6an0sXCJcIik6an10aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJKU09OLnBhcnNlXCIpfSl9KClcblxuXG4vLyAgICAgWypdIEluY2x1ZGluZyBsaWIvaW5kZXguanNcbi8vIFB1YmxpYyBvYmplY3RcbnZhciBTb2NrSlMgPSAoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgdmFyIF9kb2N1bWVudCA9IGRvY3VtZW50O1xuICAgICAgICAgICAgICB2YXIgX3dpbmRvdyA9IHdpbmRvdztcbiAgICAgICAgICAgICAgdmFyIHV0aWxzID0ge307XG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi9yZXZlbnR0YXJnZXQuanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbi8qIFNpbXBsaWZpZWQgaW1wbGVtZW50YXRpb24gb2YgRE9NMiBFdmVudFRhcmdldC5cbiAqICAgaHR0cDovL3d3dy53My5vcmcvVFIvRE9NLUxldmVsLTItRXZlbnRzL2V2ZW50cy5odG1sI0V2ZW50cy1FdmVudFRhcmdldFxuICovXG52YXIgUkV2ZW50VGFyZ2V0ID0gZnVuY3Rpb24oKSB7fTtcblJFdmVudFRhcmdldC5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uIChldmVudFR5cGUsIGxpc3RlbmVyKSB7XG4gICAgaWYoIXRoaXMuX2xpc3RlbmVycykge1xuICAgICAgICAgdGhpcy5fbGlzdGVuZXJzID0ge307XG4gICAgfVxuICAgIGlmKCEoZXZlbnRUeXBlIGluIHRoaXMuX2xpc3RlbmVycykpIHtcbiAgICAgICAgdGhpcy5fbGlzdGVuZXJzW2V2ZW50VHlwZV0gPSBbXTtcbiAgICB9XG4gICAgdmFyIGFyciA9IHRoaXMuX2xpc3RlbmVyc1tldmVudFR5cGVdO1xuICAgIGlmKHV0aWxzLmFyckluZGV4T2YoYXJyLCBsaXN0ZW5lcikgPT09IC0xKSB7XG4gICAgICAgIGFyci5wdXNoKGxpc3RlbmVyKTtcbiAgICB9XG4gICAgcmV0dXJuO1xufTtcblxuUkV2ZW50VGFyZ2V0LnByb3RvdHlwZS5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gKGV2ZW50VHlwZSwgbGlzdGVuZXIpIHtcbiAgICBpZighKHRoaXMuX2xpc3RlbmVycyAmJiAoZXZlbnRUeXBlIGluIHRoaXMuX2xpc3RlbmVycykpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGFyciA9IHRoaXMuX2xpc3RlbmVyc1tldmVudFR5cGVdO1xuICAgIHZhciBpZHggPSB1dGlscy5hcnJJbmRleE9mKGFyciwgbGlzdGVuZXIpO1xuICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgIGlmKGFyci5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICB0aGlzLl9saXN0ZW5lcnNbZXZlbnRUeXBlXSA9IGFyci5zbGljZSgwLCBpZHgpLmNvbmNhdCggYXJyLnNsaWNlKGlkeCsxKSApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyc1tldmVudFR5cGVdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmV0dXJuO1xufTtcblxuUkV2ZW50VGFyZ2V0LnByb3RvdHlwZS5kaXNwYXRjaEV2ZW50ID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgdmFyIHQgPSBldmVudC50eXBlO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgICBpZiAodGhpc1snb24nK3RdKSB7XG4gICAgICAgIHRoaXNbJ29uJyt0XS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2xpc3RlbmVycyAmJiB0IGluIHRoaXMuX2xpc3RlbmVycykge1xuICAgICAgICBmb3IodmFyIGk9MDsgaSA8IHRoaXMuX2xpc3RlbmVyc1t0XS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fbGlzdGVuZXJzW3RdW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICB9XG4gICAgfVxufTtcbi8vICAgICAgICAgWypdIEVuZCBvZiBsaWIvcmV2ZW50dGFyZ2V0LmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi9zaW1wbGVldmVudC5qc1xuLypcbiAqICoqKioqIEJFR0lOIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqIENvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuICpcbiAqIEZvciB0aGUgbGljZW5zZSBzZWUgQ09QWUlORy5cbiAqICoqKioqIEVORCBMSUNFTlNFIEJMT0NLICoqKioqXG4gKi9cblxudmFyIFNpbXBsZUV2ZW50ID0gZnVuY3Rpb24odHlwZSwgb2JqKSB7XG4gICAgdGhpcy50eXBlID0gdHlwZTtcbiAgICBpZiAodHlwZW9mIG9iaiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgZm9yKHZhciBrIGluIG9iaikge1xuICAgICAgICAgICAgaWYgKCFvYmouaGFzT3duUHJvcGVydHkoaykpIGNvbnRpbnVlO1xuICAgICAgICAgICAgdGhpc1trXSA9IG9ialtrXTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblNpbXBsZUV2ZW50LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciByID0gW107XG4gICAgZm9yKHZhciBrIGluIHRoaXMpIHtcbiAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KGspKSBjb250aW51ZTtcbiAgICAgICAgdmFyIHYgPSB0aGlzW2tdO1xuICAgICAgICBpZiAodHlwZW9mIHYgPT09ICdmdW5jdGlvbicpIHYgPSAnW2Z1bmN0aW9uXSc7XG4gICAgICAgIHIucHVzaChrICsgJz0nICsgdik7XG4gICAgfVxuICAgIHJldHVybiAnU2ltcGxlRXZlbnQoJyArIHIuam9pbignLCAnKSArICcpJztcbn07XG4vLyAgICAgICAgIFsqXSBFbmQgb2YgbGliL3NpbXBsZWV2ZW50LmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi9ldmVudGVtaXR0ZXIuanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbnZhciBFdmVudEVtaXR0ZXIgPSBmdW5jdGlvbihldmVudHMpIHtcbiAgICB0aGlzLmV2ZW50cyA9IGV2ZW50cyB8fCBbXTtcbn07XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBpZiAoIXRoYXQubnVrZWQgJiYgdGhhdFsnb24nK3R5cGVdKSB7XG4gICAgICAgIHRoYXRbJ29uJyt0eXBlXS5hcHBseSh0aGF0LCBhcmdzKTtcbiAgICB9XG4gICAgaWYgKHV0aWxzLmFyckluZGV4T2YodGhhdC5ldmVudHMsIHR5cGUpID09PSAtMSkge1xuICAgICAgICB1dGlscy5sb2coJ0V2ZW50ICcgKyBKU09OLnN0cmluZ2lmeSh0eXBlKSArXG4gICAgICAgICAgICAgICAgICAnIG5vdCBsaXN0ZWQgJyArIEpTT04uc3RyaW5naWZ5KHRoYXQuZXZlbnRzKSArXG4gICAgICAgICAgICAgICAgICAnIGluICcgKyB0aGF0KTtcbiAgICB9XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm51a2UgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHRoYXQubnVrZWQgPSB0cnVlO1xuICAgIGZvcih2YXIgaT0wOyBpPHRoYXQuZXZlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGRlbGV0ZSB0aGF0W3RoYXQuZXZlbnRzW2ldXTtcbiAgICB9XG59O1xuLy8gICAgICAgICBbKl0gRW5kIG9mIGxpYi9ldmVudGVtaXR0ZXIuanNcblxuXG4vLyAgICAgICAgIFsqXSBJbmNsdWRpbmcgbGliL3V0aWxzLmpzXG4vKlxuICogKioqKiogQkVHSU4gTElDRU5TRSBCTE9DSyAqKioqKlxuICogQ29weXJpZ2h0IChjKSAyMDExLTIwMTIgVk13YXJlLCBJbmMuXG4gKlxuICogRm9yIHRoZSBsaWNlbnNlIHNlZSBDT1BZSU5HLlxuICogKioqKiogRU5EIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqL1xuXG52YXIgcmFuZG9tX3N0cmluZ19jaGFycyA9ICdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODlfJztcbnV0aWxzLnJhbmRvbV9zdHJpbmcgPSBmdW5jdGlvbihsZW5ndGgsIG1heCkge1xuICAgIG1heCA9IG1heCB8fCByYW5kb21fc3RyaW5nX2NoYXJzLmxlbmd0aDtcbiAgICB2YXIgaSwgcmV0ID0gW107XG4gICAgZm9yKGk9MDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJldC5wdXNoKCByYW5kb21fc3RyaW5nX2NoYXJzLnN1YnN0cihNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBtYXgpLDEpICk7XG4gICAgfVxuICAgIHJldHVybiByZXQuam9pbignJyk7XG59O1xudXRpbHMucmFuZG9tX251bWJlciA9IGZ1bmN0aW9uKG1heCkge1xuICAgIHJldHVybiBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBtYXgpO1xufTtcbnV0aWxzLnJhbmRvbV9udW1iZXJfc3RyaW5nID0gZnVuY3Rpb24obWF4KSB7XG4gICAgdmFyIHQgPSAoJycrKG1heCAtIDEpKS5sZW5ndGg7XG4gICAgdmFyIHAgPSBBcnJheSh0KzEpLmpvaW4oJzAnKTtcbiAgICByZXR1cm4gKHAgKyB1dGlscy5yYW5kb21fbnVtYmVyKG1heCkpLnNsaWNlKC10KTtcbn07XG5cbi8vIEFzc3VtaW5nIHRoYXQgdXJsIGxvb2tzIGxpa2U6IGh0dHA6Ly9hc2Rhc2Q6MTExL2FzZFxudXRpbHMuZ2V0T3JpZ2luID0gZnVuY3Rpb24odXJsKSB7XG4gICAgdXJsICs9ICcvJztcbiAgICB2YXIgcGFydHMgPSB1cmwuc3BsaXQoJy8nKS5zbGljZSgwLCAzKTtcbiAgICByZXR1cm4gcGFydHMuam9pbignLycpO1xufTtcblxudXRpbHMuaXNTYW1lT3JpZ2luVXJsID0gZnVuY3Rpb24odXJsX2EsIHVybF9iKSB7XG4gICAgLy8gbG9jYXRpb24ub3JpZ2luIHdvdWxkIGRvLCBidXQgaXQncyBub3QgYWx3YXlzIGF2YWlsYWJsZS5cbiAgICBpZiAoIXVybF9iKSB1cmxfYiA9IF93aW5kb3cubG9jYXRpb24uaHJlZjtcblxuICAgIHJldHVybiAodXJsX2Euc3BsaXQoJy8nKS5zbGljZSgwLDMpLmpvaW4oJy8nKVxuICAgICAgICAgICAgICAgID09PVxuICAgICAgICAgICAgdXJsX2Iuc3BsaXQoJy8nKS5zbGljZSgwLDMpLmpvaW4oJy8nKSk7XG59O1xuXG51dGlscy5nZXRQYXJlbnREb21haW4gPSBmdW5jdGlvbih1cmwpIHtcbiAgICAvLyBpcHY0IGlwIGFkZHJlc3NcbiAgICBpZiAoL15bMC05Ll0qJC8udGVzdCh1cmwpKSByZXR1cm4gdXJsO1xuICAgIC8vIGlwdjYgaXAgYWRkcmVzc1xuICAgIGlmICgvXlxcWy8udGVzdCh1cmwpKSByZXR1cm4gdXJsO1xuICAgIC8vIG5vIGRvdHNcbiAgICBpZiAoISgvWy5dLy50ZXN0KHVybCkpKSByZXR1cm4gdXJsO1xuXG4gICAgdmFyIHBhcnRzID0gdXJsLnNwbGl0KCcuJykuc2xpY2UoMSk7XG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oJy4nKTtcbn07XG5cbnV0aWxzLm9iamVjdEV4dGVuZCA9IGZ1bmN0aW9uKGRzdCwgc3JjKSB7XG4gICAgZm9yKHZhciBrIGluIHNyYykge1xuICAgICAgICBpZiAoc3JjLmhhc093blByb3BlcnR5KGspKSB7XG4gICAgICAgICAgICBkc3Rba10gPSBzcmNba107XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGRzdDtcbn07XG5cbnZhciBXUHJlZml4ID0gJ19qcCc7XG5cbnV0aWxzLnBvbGx1dGVHbG9iYWxOYW1lc3BhY2UgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIShXUHJlZml4IGluIF93aW5kb3cpKSB7XG4gICAgICAgIF93aW5kb3dbV1ByZWZpeF0gPSB7fTtcbiAgICB9XG59O1xuXG51dGlscy5jbG9zZUZyYW1lID0gZnVuY3Rpb24gKGNvZGUsIHJlYXNvbikge1xuICAgIHJldHVybiAnYycrSlNPTi5zdHJpbmdpZnkoW2NvZGUsIHJlYXNvbl0pO1xufTtcblxudXRpbHMudXNlclNldENvZGUgPSBmdW5jdGlvbiAoY29kZSkge1xuICAgIHJldHVybiBjb2RlID09PSAxMDAwIHx8IChjb2RlID49IDMwMDAgJiYgY29kZSA8PSA0OTk5KTtcbn07XG5cbi8vIFNlZTogaHR0cDovL3d3dy5lcmcuYWJkbi5hYy51ay9+Z2Vycml0L2RjY3Avbm90ZXMvY2NpZDIvcnRvX2VzdGltYXRvci9cbi8vIGFuZCBSRkMgMjk4OC5cbnV0aWxzLmNvdW50UlRPID0gZnVuY3Rpb24gKHJ0dCkge1xuICAgIHZhciBydG87XG4gICAgaWYgKHJ0dCA+IDEwMCkge1xuICAgICAgICBydG8gPSAzICogcnR0OyAvLyBydG8gPiAzMDBtc2VjXG4gICAgfSBlbHNlIHtcbiAgICAgICAgcnRvID0gcnR0ICsgMjAwOyAvLyAyMDBtc2VjIDwgcnRvIDw9IDMwMG1zZWNcbiAgICB9XG4gICAgcmV0dXJuIHJ0bztcbn1cblxudXRpbHMubG9nID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKF93aW5kb3cuY29uc29sZSAmJiBjb25zb2xlLmxvZyAmJiBjb25zb2xlLmxvZy5hcHBseSkge1xuICAgICAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpO1xuICAgIH1cbn07XG5cbnV0aWxzLmJpbmQgPSBmdW5jdGlvbihmdW4sIHRoYXQpIHtcbiAgICBpZiAoZnVuLmJpbmQpIHtcbiAgICAgICAgcmV0dXJuIGZ1bi5iaW5kKHRoYXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBmdW4uYXBwbHkodGhhdCwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcbiAgICB9XG59O1xuXG51dGlscy5mbGF0VXJsID0gZnVuY3Rpb24odXJsKSB7XG4gICAgcmV0dXJuIHVybC5pbmRleE9mKCc/JykgPT09IC0xICYmIHVybC5pbmRleE9mKCcjJykgPT09IC0xO1xufTtcblxudXRpbHMuYW1lbmRVcmwgPSBmdW5jdGlvbih1cmwpIHtcbiAgICB2YXIgZGwgPSBfZG9jdW1lbnQubG9jYXRpb247XG4gICAgaWYgKCF1cmwpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdXcm9uZyB1cmwgZm9yIFNvY2tKUycpO1xuICAgIH1cbiAgICBpZiAoIXV0aWxzLmZsYXRVcmwodXJsKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ09ubHkgYmFzaWMgdXJscyBhcmUgc3VwcG9ydGVkIGluIFNvY2tKUycpO1xuICAgIH1cblxuICAgIC8vICAnLy9hYmMnIC0tPiAnaHR0cDovL2FiYydcbiAgICBpZiAodXJsLmluZGV4T2YoJy8vJykgPT09IDApIHtcbiAgICAgICAgdXJsID0gZGwucHJvdG9jb2wgKyB1cmw7XG4gICAgfVxuICAgIC8vICcvYWJjJyAtLT4gJ2h0dHA6Ly9sb2NhbGhvc3Q6ODAvYWJjJ1xuICAgIGlmICh1cmwuaW5kZXhPZignLycpID09PSAwKSB7XG4gICAgICAgIHVybCA9IGRsLnByb3RvY29sICsgJy8vJyArIGRsLmhvc3QgKyB1cmw7XG4gICAgfVxuICAgIC8vIHN0cmlwIHRyYWlsaW5nIHNsYXNoZXNcbiAgICB1cmwgPSB1cmwucmVwbGFjZSgvWy9dKyQvLCcnKTtcbiAgICByZXR1cm4gdXJsO1xufTtcblxuLy8gSUUgZG9lc24ndCBzdXBwb3J0IFtdLmluZGV4T2YuXG51dGlscy5hcnJJbmRleE9mID0gZnVuY3Rpb24oYXJyLCBvYmope1xuICAgIGZvcih2YXIgaT0wOyBpIDwgYXJyLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgaWYoYXJyW2ldID09PSBvYmope1xuICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xO1xufTtcblxudXRpbHMuYXJyU2tpcCA9IGZ1bmN0aW9uKGFyciwgb2JqKSB7XG4gICAgdmFyIGlkeCA9IHV0aWxzLmFyckluZGV4T2YoYXJyLCBvYmopO1xuICAgIGlmIChpZHggPT09IC0xKSB7XG4gICAgICAgIHJldHVybiBhcnIuc2xpY2UoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgZHN0ID0gYXJyLnNsaWNlKDAsIGlkeCk7XG4gICAgICAgIHJldHVybiBkc3QuY29uY2F0KGFyci5zbGljZShpZHgrMSkpO1xuICAgIH1cbn07XG5cbi8vIFZpYTogaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vMTEzMzEyMi8yMTIxYzYwMWM1NTQ5MTU1NDgzZjUwYmUzZGE1MzA1ZTgzYjhjNWRmXG51dGlscy5pc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB7fS50b1N0cmluZy5jYWxsKHZhbHVlKS5pbmRleE9mKCdBcnJheScpID49IDBcbn07XG5cbnV0aWxzLmRlbGF5ID0gZnVuY3Rpb24odCwgZnVuKSB7XG4gICAgaWYodHlwZW9mIHQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZnVuID0gdDtcbiAgICAgICAgdCA9IDA7XG4gICAgfVxuICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgdCk7XG59O1xuXG5cbi8vIENoYXJzIHdvcnRoIGVzY2FwaW5nLCBhcyBkZWZpbmVkIGJ5IERvdWdsYXMgQ3JvY2tmb3JkOlxuLy8gICBodHRwczovL2dpdGh1Yi5jb20vZG91Z2xhc2Nyb2NrZm9yZC9KU09OLWpzL2Jsb2IvNDdhOTg4MmNkZGViMWU4NTI5ZTA3YWY5NzM2MjE4MDc1MzcyYjhhYy9qc29uMi5qcyNMMTk2XG52YXIganNvbl9lc2NhcGFibGUgPSAvW1xcXFxcXFwiXFx4MDAtXFx4MWZcXHg3Zi1cXHg5ZlxcdTAwYWRcXHUwNjAwLVxcdTA2MDRcXHUwNzBmXFx1MTdiNFxcdTE3YjVcXHUyMDBjLVxcdTIwMGZcXHUyMDI4LVxcdTIwMmZcXHUyMDYwLVxcdTIwNmZcXHVmZWZmXFx1ZmZmMC1cXHVmZmZmXS9nLFxuICAgIGpzb25fbG9va3VwID0ge1xuXCJcXHUwMDAwXCI6XCJcXFxcdTAwMDBcIixcIlxcdTAwMDFcIjpcIlxcXFx1MDAwMVwiLFwiXFx1MDAwMlwiOlwiXFxcXHUwMDAyXCIsXCJcXHUwMDAzXCI6XCJcXFxcdTAwMDNcIixcblwiXFx1MDAwNFwiOlwiXFxcXHUwMDA0XCIsXCJcXHUwMDA1XCI6XCJcXFxcdTAwMDVcIixcIlxcdTAwMDZcIjpcIlxcXFx1MDAwNlwiLFwiXFx1MDAwN1wiOlwiXFxcXHUwMDA3XCIsXG5cIlxcYlwiOlwiXFxcXGJcIixcIlxcdFwiOlwiXFxcXHRcIixcIlxcblwiOlwiXFxcXG5cIixcIlxcdTAwMGJcIjpcIlxcXFx1MDAwYlwiLFwiXFxmXCI6XCJcXFxcZlwiLFwiXFxyXCI6XCJcXFxcclwiLFxuXCJcXHUwMDBlXCI6XCJcXFxcdTAwMGVcIixcIlxcdTAwMGZcIjpcIlxcXFx1MDAwZlwiLFwiXFx1MDAxMFwiOlwiXFxcXHUwMDEwXCIsXCJcXHUwMDExXCI6XCJcXFxcdTAwMTFcIixcblwiXFx1MDAxMlwiOlwiXFxcXHUwMDEyXCIsXCJcXHUwMDEzXCI6XCJcXFxcdTAwMTNcIixcIlxcdTAwMTRcIjpcIlxcXFx1MDAxNFwiLFwiXFx1MDAxNVwiOlwiXFxcXHUwMDE1XCIsXG5cIlxcdTAwMTZcIjpcIlxcXFx1MDAxNlwiLFwiXFx1MDAxN1wiOlwiXFxcXHUwMDE3XCIsXCJcXHUwMDE4XCI6XCJcXFxcdTAwMThcIixcIlxcdTAwMTlcIjpcIlxcXFx1MDAxOVwiLFxuXCJcXHUwMDFhXCI6XCJcXFxcdTAwMWFcIixcIlxcdTAwMWJcIjpcIlxcXFx1MDAxYlwiLFwiXFx1MDAxY1wiOlwiXFxcXHUwMDFjXCIsXCJcXHUwMDFkXCI6XCJcXFxcdTAwMWRcIixcblwiXFx1MDAxZVwiOlwiXFxcXHUwMDFlXCIsXCJcXHUwMDFmXCI6XCJcXFxcdTAwMWZcIixcIlxcXCJcIjpcIlxcXFxcXFwiXCIsXCJcXFxcXCI6XCJcXFxcXFxcXFwiLFxuXCJcXHUwMDdmXCI6XCJcXFxcdTAwN2ZcIixcIlxcdTAwODBcIjpcIlxcXFx1MDA4MFwiLFwiXFx1MDA4MVwiOlwiXFxcXHUwMDgxXCIsXCJcXHUwMDgyXCI6XCJcXFxcdTAwODJcIixcblwiXFx1MDA4M1wiOlwiXFxcXHUwMDgzXCIsXCJcXHUwMDg0XCI6XCJcXFxcdTAwODRcIixcIlxcdTAwODVcIjpcIlxcXFx1MDA4NVwiLFwiXFx1MDA4NlwiOlwiXFxcXHUwMDg2XCIsXG5cIlxcdTAwODdcIjpcIlxcXFx1MDA4N1wiLFwiXFx1MDA4OFwiOlwiXFxcXHUwMDg4XCIsXCJcXHUwMDg5XCI6XCJcXFxcdTAwODlcIixcIlxcdTAwOGFcIjpcIlxcXFx1MDA4YVwiLFxuXCJcXHUwMDhiXCI6XCJcXFxcdTAwOGJcIixcIlxcdTAwOGNcIjpcIlxcXFx1MDA4Y1wiLFwiXFx1MDA4ZFwiOlwiXFxcXHUwMDhkXCIsXCJcXHUwMDhlXCI6XCJcXFxcdTAwOGVcIixcblwiXFx1MDA4ZlwiOlwiXFxcXHUwMDhmXCIsXCJcXHUwMDkwXCI6XCJcXFxcdTAwOTBcIixcIlxcdTAwOTFcIjpcIlxcXFx1MDA5MVwiLFwiXFx1MDA5MlwiOlwiXFxcXHUwMDkyXCIsXG5cIlxcdTAwOTNcIjpcIlxcXFx1MDA5M1wiLFwiXFx1MDA5NFwiOlwiXFxcXHUwMDk0XCIsXCJcXHUwMDk1XCI6XCJcXFxcdTAwOTVcIixcIlxcdTAwOTZcIjpcIlxcXFx1MDA5NlwiLFxuXCJcXHUwMDk3XCI6XCJcXFxcdTAwOTdcIixcIlxcdTAwOThcIjpcIlxcXFx1MDA5OFwiLFwiXFx1MDA5OVwiOlwiXFxcXHUwMDk5XCIsXCJcXHUwMDlhXCI6XCJcXFxcdTAwOWFcIixcblwiXFx1MDA5YlwiOlwiXFxcXHUwMDliXCIsXCJcXHUwMDljXCI6XCJcXFxcdTAwOWNcIixcIlxcdTAwOWRcIjpcIlxcXFx1MDA5ZFwiLFwiXFx1MDA5ZVwiOlwiXFxcXHUwMDllXCIsXG5cIlxcdTAwOWZcIjpcIlxcXFx1MDA5ZlwiLFwiXFx1MDBhZFwiOlwiXFxcXHUwMGFkXCIsXCJcXHUwNjAwXCI6XCJcXFxcdTA2MDBcIixcIlxcdTA2MDFcIjpcIlxcXFx1MDYwMVwiLFxuXCJcXHUwNjAyXCI6XCJcXFxcdTA2MDJcIixcIlxcdTA2MDNcIjpcIlxcXFx1MDYwM1wiLFwiXFx1MDYwNFwiOlwiXFxcXHUwNjA0XCIsXCJcXHUwNzBmXCI6XCJcXFxcdTA3MGZcIixcblwiXFx1MTdiNFwiOlwiXFxcXHUxN2I0XCIsXCJcXHUxN2I1XCI6XCJcXFxcdTE3YjVcIixcIlxcdTIwMGNcIjpcIlxcXFx1MjAwY1wiLFwiXFx1MjAwZFwiOlwiXFxcXHUyMDBkXCIsXG5cIlxcdTIwMGVcIjpcIlxcXFx1MjAwZVwiLFwiXFx1MjAwZlwiOlwiXFxcXHUyMDBmXCIsXCJcXHUyMDI4XCI6XCJcXFxcdTIwMjhcIixcIlxcdTIwMjlcIjpcIlxcXFx1MjAyOVwiLFxuXCJcXHUyMDJhXCI6XCJcXFxcdTIwMmFcIixcIlxcdTIwMmJcIjpcIlxcXFx1MjAyYlwiLFwiXFx1MjAyY1wiOlwiXFxcXHUyMDJjXCIsXCJcXHUyMDJkXCI6XCJcXFxcdTIwMmRcIixcblwiXFx1MjAyZVwiOlwiXFxcXHUyMDJlXCIsXCJcXHUyMDJmXCI6XCJcXFxcdTIwMmZcIixcIlxcdTIwNjBcIjpcIlxcXFx1MjA2MFwiLFwiXFx1MjA2MVwiOlwiXFxcXHUyMDYxXCIsXG5cIlxcdTIwNjJcIjpcIlxcXFx1MjA2MlwiLFwiXFx1MjA2M1wiOlwiXFxcXHUyMDYzXCIsXCJcXHUyMDY0XCI6XCJcXFxcdTIwNjRcIixcIlxcdTIwNjVcIjpcIlxcXFx1MjA2NVwiLFxuXCJcXHUyMDY2XCI6XCJcXFxcdTIwNjZcIixcIlxcdTIwNjdcIjpcIlxcXFx1MjA2N1wiLFwiXFx1MjA2OFwiOlwiXFxcXHUyMDY4XCIsXCJcXHUyMDY5XCI6XCJcXFxcdTIwNjlcIixcblwiXFx1MjA2YVwiOlwiXFxcXHUyMDZhXCIsXCJcXHUyMDZiXCI6XCJcXFxcdTIwNmJcIixcIlxcdTIwNmNcIjpcIlxcXFx1MjA2Y1wiLFwiXFx1MjA2ZFwiOlwiXFxcXHUyMDZkXCIsXG5cIlxcdTIwNmVcIjpcIlxcXFx1MjA2ZVwiLFwiXFx1MjA2ZlwiOlwiXFxcXHUyMDZmXCIsXCJcXHVmZWZmXCI6XCJcXFxcdWZlZmZcIixcIlxcdWZmZjBcIjpcIlxcXFx1ZmZmMFwiLFxuXCJcXHVmZmYxXCI6XCJcXFxcdWZmZjFcIixcIlxcdWZmZjJcIjpcIlxcXFx1ZmZmMlwiLFwiXFx1ZmZmM1wiOlwiXFxcXHVmZmYzXCIsXCJcXHVmZmY0XCI6XCJcXFxcdWZmZjRcIixcblwiXFx1ZmZmNVwiOlwiXFxcXHVmZmY1XCIsXCJcXHVmZmY2XCI6XCJcXFxcdWZmZjZcIixcIlxcdWZmZjdcIjpcIlxcXFx1ZmZmN1wiLFwiXFx1ZmZmOFwiOlwiXFxcXHVmZmY4XCIsXG5cIlxcdWZmZjlcIjpcIlxcXFx1ZmZmOVwiLFwiXFx1ZmZmYVwiOlwiXFxcXHVmZmZhXCIsXCJcXHVmZmZiXCI6XCJcXFxcdWZmZmJcIixcIlxcdWZmZmNcIjpcIlxcXFx1ZmZmY1wiLFxuXCJcXHVmZmZkXCI6XCJcXFxcdWZmZmRcIixcIlxcdWZmZmVcIjpcIlxcXFx1ZmZmZVwiLFwiXFx1ZmZmZlwiOlwiXFxcXHVmZmZmXCJ9O1xuXG4vLyBTb21lIGV4dHJhIGNoYXJhY3RlcnMgdGhhdCBDaHJvbWUgZ2V0cyB3cm9uZywgYW5kIHN1YnN0aXR1dGVzIHdpdGhcbi8vIHNvbWV0aGluZyBlbHNlIG9uIHRoZSB3aXJlLlxudmFyIGV4dHJhX2VzY2FwYWJsZSA9IC9bXFx4MDAtXFx4MWZcXHVkODAwLVxcdWRmZmZcXHVmZmZlXFx1ZmZmZlxcdTAzMDAtXFx1MDMzM1xcdTAzM2QtXFx1MDM0NlxcdTAzNGEtXFx1MDM0Y1xcdTAzNTAtXFx1MDM1MlxcdTAzNTctXFx1MDM1OFxcdTAzNWMtXFx1MDM2MlxcdTAzNzRcXHUwMzdlXFx1MDM4N1xcdTA1OTEtXFx1MDVhZlxcdTA1YzRcXHUwNjEwLVxcdTA2MTdcXHUwNjUzLVxcdTA2NTRcXHUwNjU3LVxcdTA2NWJcXHUwNjVkLVxcdTA2NWVcXHUwNmRmLVxcdTA2ZTJcXHUwNmViLVxcdTA2ZWNcXHUwNzMwXFx1MDczMi1cXHUwNzMzXFx1MDczNS1cXHUwNzM2XFx1MDczYVxcdTA3M2RcXHUwNzNmLVxcdTA3NDFcXHUwNzQzXFx1MDc0NVxcdTA3NDdcXHUwN2ViLVxcdTA3ZjFcXHUwOTUxXFx1MDk1OC1cXHUwOTVmXFx1MDlkYy1cXHUwOWRkXFx1MDlkZlxcdTBhMzNcXHUwYTM2XFx1MGE1OS1cXHUwYTViXFx1MGE1ZVxcdTBiNWMtXFx1MGI1ZFxcdTBlMzgtXFx1MGUzOVxcdTBmNDNcXHUwZjRkXFx1MGY1MlxcdTBmNTdcXHUwZjVjXFx1MGY2OVxcdTBmNzItXFx1MGY3NlxcdTBmNzhcXHUwZjgwLVxcdTBmODNcXHUwZjkzXFx1MGY5ZFxcdTBmYTJcXHUwZmE3XFx1MGZhY1xcdTBmYjlcXHUxOTM5LVxcdTE5M2FcXHUxYTE3XFx1MWI2YlxcdTFjZGEtXFx1MWNkYlxcdTFkYzAtXFx1MWRjZlxcdTFkZmNcXHUxZGZlXFx1MWY3MVxcdTFmNzNcXHUxZjc1XFx1MWY3N1xcdTFmNzlcXHUxZjdiXFx1MWY3ZFxcdTFmYmJcXHUxZmJlXFx1MWZjOVxcdTFmY2JcXHUxZmQzXFx1MWZkYlxcdTFmZTNcXHUxZmViXFx1MWZlZS1cXHUxZmVmXFx1MWZmOVxcdTFmZmJcXHUxZmZkXFx1MjAwMC1cXHUyMDAxXFx1MjBkMC1cXHUyMGQxXFx1MjBkNC1cXHUyMGQ3XFx1MjBlNy1cXHUyMGU5XFx1MjEyNlxcdTIxMmEtXFx1MjEyYlxcdTIzMjktXFx1MjMyYVxcdTJhZGNcXHUzMDJiLVxcdTMwMmNcXHVhYWIyLVxcdWFhYjNcXHVmOTAwLVxcdWZhMGRcXHVmYTEwXFx1ZmExMlxcdWZhMTUtXFx1ZmExZVxcdWZhMjBcXHVmYTIyXFx1ZmEyNS1cXHVmYTI2XFx1ZmEyYS1cXHVmYTJkXFx1ZmEzMC1cXHVmYTZkXFx1ZmE3MC1cXHVmYWQ5XFx1ZmIxZFxcdWZiMWZcXHVmYjJhLVxcdWZiMzZcXHVmYjM4LVxcdWZiM2NcXHVmYjNlXFx1ZmI0MC1cXHVmYjQxXFx1ZmI0My1cXHVmYjQ0XFx1ZmI0Ni1cXHVmYjRlXFx1ZmZmMC1cXHVmZmZmXS9nLFxuICAgIGV4dHJhX2xvb2t1cDtcblxuLy8gSlNPTiBRdW90ZSBzdHJpbmcuIFVzZSBuYXRpdmUgaW1wbGVtZW50YXRpb24gd2hlbiBwb3NzaWJsZS5cbnZhciBKU09OUXVvdGUgPSAoSlNPTiAmJiBKU09OLnN0cmluZ2lmeSkgfHwgZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAganNvbl9lc2NhcGFibGUubGFzdEluZGV4ID0gMDtcbiAgICBpZiAoanNvbl9lc2NhcGFibGUudGVzdChzdHJpbmcpKSB7XG4gICAgICAgIHN0cmluZyA9IHN0cmluZy5yZXBsYWNlKGpzb25fZXNjYXBhYmxlLCBmdW5jdGlvbihhKSB7XG4gICAgICAgICAgICByZXR1cm4ganNvbl9sb29rdXBbYV07XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gJ1wiJyArIHN0cmluZyArICdcIic7XG59O1xuXG4vLyBUaGlzIG1heSBiZSBxdWl0ZSBzbG93LCBzbyBsZXQncyBkZWxheSB1bnRpbCB1c2VyIGFjdHVhbGx5IHVzZXMgYmFkXG4vLyBjaGFyYWN0ZXJzLlxudmFyIHVucm9sbF9sb29rdXAgPSBmdW5jdGlvbihlc2NhcGFibGUpIHtcbiAgICB2YXIgaTtcbiAgICB2YXIgdW5yb2xsZWQgPSB7fVxuICAgIHZhciBjID0gW11cbiAgICBmb3IoaT0wOyBpPDY1NTM2OyBpKyspIHtcbiAgICAgICAgYy5wdXNoKCBTdHJpbmcuZnJvbUNoYXJDb2RlKGkpICk7XG4gICAgfVxuICAgIGVzY2FwYWJsZS5sYXN0SW5kZXggPSAwO1xuICAgIGMuam9pbignJykucmVwbGFjZShlc2NhcGFibGUsIGZ1bmN0aW9uIChhKSB7XG4gICAgICAgIHVucm9sbGVkWyBhIF0gPSAnXFxcXHUnICsgKCcwMDAwJyArIGEuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikpLnNsaWNlKC00KTtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0pO1xuICAgIGVzY2FwYWJsZS5sYXN0SW5kZXggPSAwO1xuICAgIHJldHVybiB1bnJvbGxlZDtcbn07XG5cbi8vIFF1b3RlIHN0cmluZywgYWxzbyB0YWtpbmcgY2FyZSBvZiB1bmljb2RlIGNoYXJhY3RlcnMgdGhhdCBicm93c2Vyc1xuLy8gb2Z0ZW4gYnJlYWsuIEVzcGVjaWFsbHksIHRha2UgY2FyZSBvZiB1bmljb2RlIHN1cnJvZ2F0ZXM6XG4vLyAgICBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL01hcHBpbmdfb2ZfVW5pY29kZV9jaGFyYWN0ZXJzI1N1cnJvZ2F0ZXNcbnV0aWxzLnF1b3RlID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgdmFyIHF1b3RlZCA9IEpTT05RdW90ZShzdHJpbmcpO1xuXG4gICAgLy8gSW4gbW9zdCBjYXNlcyB0aGlzIHNob3VsZCBiZSB2ZXJ5IGZhc3QgYW5kIGdvb2QgZW5vdWdoLlxuICAgIGV4dHJhX2VzY2FwYWJsZS5sYXN0SW5kZXggPSAwO1xuICAgIGlmKCFleHRyYV9lc2NhcGFibGUudGVzdChxdW90ZWQpKSB7XG4gICAgICAgIHJldHVybiBxdW90ZWQ7XG4gICAgfVxuXG4gICAgaWYoIWV4dHJhX2xvb2t1cCkgZXh0cmFfbG9va3VwID0gdW5yb2xsX2xvb2t1cChleHRyYV9lc2NhcGFibGUpO1xuXG4gICAgcmV0dXJuIHF1b3RlZC5yZXBsYWNlKGV4dHJhX2VzY2FwYWJsZSwgZnVuY3Rpb24oYSkge1xuICAgICAgICByZXR1cm4gZXh0cmFfbG9va3VwW2FdO1xuICAgIH0pO1xufVxuXG52YXIgX2FsbF9wcm90b2NvbHMgPSBbJ3dlYnNvY2tldCcsXG4gICAgICAgICAgICAgICAgICAgICAgJ3hkci1zdHJlYW1pbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICd4aHItc3RyZWFtaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAnaWZyYW1lLWV2ZW50c291cmNlJyxcbiAgICAgICAgICAgICAgICAgICAgICAnaWZyYW1lLWh0bWxmaWxlJyxcbiAgICAgICAgICAgICAgICAgICAgICAneGRyLXBvbGxpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICd4aHItcG9sbGluZycsXG4gICAgICAgICAgICAgICAgICAgICAgJ2lmcmFtZS14aHItcG9sbGluZycsXG4gICAgICAgICAgICAgICAgICAgICAgJ2pzb25wLXBvbGxpbmcnXTtcblxudXRpbHMucHJvYmVQcm90b2NvbHMgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcHJvYmVkID0ge307XG4gICAgZm9yKHZhciBpPTA7IGk8X2FsbF9wcm90b2NvbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHByb3RvY29sID0gX2FsbF9wcm90b2NvbHNbaV07XG4gICAgICAgIC8vIFVzZXIgY2FuIGhhdmUgYSB0eXBvIGluIHByb3RvY29sIG5hbWUuXG4gICAgICAgIHByb2JlZFtwcm90b2NvbF0gPSBTb2NrSlNbcHJvdG9jb2xdICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBTb2NrSlNbcHJvdG9jb2xdLmVuYWJsZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHByb2JlZDtcbn07XG5cbnV0aWxzLmRldGVjdFByb3RvY29scyA9IGZ1bmN0aW9uKHByb2JlZCwgcHJvdG9jb2xzX3doaXRlbGlzdCwgaW5mbykge1xuICAgIHZhciBwZSA9IHt9LFxuICAgICAgICBwcm90b2NvbHMgPSBbXTtcbiAgICBpZiAoIXByb3RvY29sc193aGl0ZWxpc3QpIHByb3RvY29sc193aGl0ZWxpc3QgPSBfYWxsX3Byb3RvY29scztcbiAgICBmb3IodmFyIGk9MDsgaTxwcm90b2NvbHNfd2hpdGVsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBwcm90b2NvbCA9IHByb3RvY29sc193aGl0ZWxpc3RbaV07XG4gICAgICAgIHBlW3Byb3RvY29sXSA9IHByb2JlZFtwcm90b2NvbF07XG4gICAgfVxuICAgIHZhciBtYXliZV9wdXNoID0gZnVuY3Rpb24ocHJvdG9zKSB7XG4gICAgICAgIHZhciBwcm90byA9IHByb3Rvcy5zaGlmdCgpO1xuICAgICAgICBpZiAocGVbcHJvdG9dKSB7XG4gICAgICAgICAgICBwcm90b2NvbHMucHVzaChwcm90byk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAocHJvdG9zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBtYXliZV9wdXNoKHByb3Rvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAxLiBXZWJzb2NrZXRcbiAgICBpZiAoaW5mby53ZWJzb2NrZXQgIT09IGZhbHNlKSB7XG4gICAgICAgIG1heWJlX3B1c2goWyd3ZWJzb2NrZXQnXSk7XG4gICAgfVxuXG4gICAgLy8gMi4gU3RyZWFtaW5nXG4gICAgaWYgKHBlWyd4aHItc3RyZWFtaW5nJ10gJiYgIWluZm8ubnVsbF9vcmlnaW4pIHtcbiAgICAgICAgcHJvdG9jb2xzLnB1c2goJ3hoci1zdHJlYW1pbmcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocGVbJ3hkci1zdHJlYW1pbmcnXSAmJiAhaW5mby5jb29raWVfbmVlZGVkICYmICFpbmZvLm51bGxfb3JpZ2luKSB7XG4gICAgICAgICAgICBwcm90b2NvbHMucHVzaCgneGRyLXN0cmVhbWluZycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWF5YmVfcHVzaChbJ2lmcmFtZS1ldmVudHNvdXJjZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAnaWZyYW1lLWh0bWxmaWxlJ10pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gMy4gUG9sbGluZ1xuICAgIGlmIChwZVsneGhyLXBvbGxpbmcnXSAmJiAhaW5mby5udWxsX29yaWdpbikge1xuICAgICAgICBwcm90b2NvbHMucHVzaCgneGhyLXBvbGxpbmcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBpZiAocGVbJ3hkci1wb2xsaW5nJ10gJiYgIWluZm8uY29va2llX25lZWRlZCAmJiAhaW5mby5udWxsX29yaWdpbikge1xuICAgICAgICAgICAgcHJvdG9jb2xzLnB1c2goJ3hkci1wb2xsaW5nJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtYXliZV9wdXNoKFsnaWZyYW1lLXhoci1wb2xsaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdqc29ucC1wb2xsaW5nJ10pO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcm90b2NvbHM7XG59XG4vLyAgICAgICAgIFsqXSBFbmQgb2YgbGliL3V0aWxzLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi9kb20uanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbi8vIE1heSBiZSB1c2VkIGJ5IGh0bWxmaWxlIGpzb25wIGFuZCB0cmFuc3BvcnRzLlxudmFyIE1QcmVmaXggPSAnX3NvY2tqc19nbG9iYWwnO1xudXRpbHMuY3JlYXRlSG9vayA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB3aW5kb3dfaWQgPSAnYScgKyB1dGlscy5yYW5kb21fc3RyaW5nKDgpO1xuICAgIGlmICghKE1QcmVmaXggaW4gX3dpbmRvdykpIHtcbiAgICAgICAgdmFyIG1hcCA9IHt9O1xuICAgICAgICBfd2luZG93W01QcmVmaXhdID0gZnVuY3Rpb24od2luZG93X2lkKSB7XG4gICAgICAgICAgICBpZiAoISh3aW5kb3dfaWQgaW4gbWFwKSkge1xuICAgICAgICAgICAgICAgIG1hcFt3aW5kb3dfaWRdID0ge1xuICAgICAgICAgICAgICAgICAgICBpZDogd2luZG93X2lkLFxuICAgICAgICAgICAgICAgICAgICBkZWw6IGZ1bmN0aW9uKCkge2RlbGV0ZSBtYXBbd2luZG93X2lkXTt9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBtYXBbd2luZG93X2lkXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gX3dpbmRvd1tNUHJlZml4XSh3aW5kb3dfaWQpO1xufTtcblxuXG5cbnV0aWxzLmF0dGFjaE1lc3NhZ2UgPSBmdW5jdGlvbihsaXN0ZW5lcikge1xuICAgIHV0aWxzLmF0dGFjaEV2ZW50KCdtZXNzYWdlJywgbGlzdGVuZXIpO1xufTtcbnV0aWxzLmF0dGFjaEV2ZW50ID0gZnVuY3Rpb24oZXZlbnQsIGxpc3RlbmVyKSB7XG4gICAgaWYgKHR5cGVvZiBfd2luZG93LmFkZEV2ZW50TGlzdGVuZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIF93aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgbGlzdGVuZXIsIGZhbHNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJRSBxdWlya3MuXG4gICAgICAgIC8vIEFjY29yZGluZyB0bzogaHR0cDovL3N0ZXZlc291ZGVycy5jb20vbWlzYy90ZXN0LXBvc3RtZXNzYWdlLnBocFxuICAgICAgICAvLyB0aGUgbWVzc2FnZSBnZXRzIGRlbGl2ZXJlZCBvbmx5IHRvICdkb2N1bWVudCcsIG5vdCAnd2luZG93Jy5cbiAgICAgICAgX2RvY3VtZW50LmF0dGFjaEV2ZW50KFwib25cIiArIGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgICAgIC8vIEkgZ2V0ICd3aW5kb3cnIGZvciBpZTguXG4gICAgICAgIF93aW5kb3cuYXR0YWNoRXZlbnQoXCJvblwiICsgZXZlbnQsIGxpc3RlbmVyKTtcbiAgICB9XG59O1xuXG51dGlscy5kZXRhY2hNZXNzYWdlID0gZnVuY3Rpb24obGlzdGVuZXIpIHtcbiAgICB1dGlscy5kZXRhY2hFdmVudCgnbWVzc2FnZScsIGxpc3RlbmVyKTtcbn07XG51dGlscy5kZXRhY2hFdmVudCA9IGZ1bmN0aW9uKGV2ZW50LCBsaXN0ZW5lcikge1xuICAgIGlmICh0eXBlb2YgX3dpbmRvdy5hZGRFdmVudExpc3RlbmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBfd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGxpc3RlbmVyLCBmYWxzZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgX2RvY3VtZW50LmRldGFjaEV2ZW50KFwib25cIiArIGV2ZW50LCBsaXN0ZW5lcik7XG4gICAgICAgIF93aW5kb3cuZGV0YWNoRXZlbnQoXCJvblwiICsgZXZlbnQsIGxpc3RlbmVyKTtcbiAgICB9XG59O1xuXG5cbnZhciBvbl91bmxvYWQgPSB7fTtcbi8vIFRoaW5ncyByZWdpc3RlcmVkIGFmdGVyIGJlZm9yZXVubG9hZCBhcmUgdG8gYmUgY2FsbGVkIGltbWVkaWF0ZWx5LlxudmFyIGFmdGVyX3VubG9hZCA9IGZhbHNlO1xuXG52YXIgdHJpZ2dlcl91bmxvYWRfY2FsbGJhY2tzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yKHZhciByZWYgaW4gb25fdW5sb2FkKSB7XG4gICAgICAgIG9uX3VubG9hZFtyZWZdKCk7XG4gICAgICAgIGRlbGV0ZSBvbl91bmxvYWRbcmVmXTtcbiAgICB9O1xufTtcblxudmFyIHVubG9hZF90cmlnZ2VyZWQgPSBmdW5jdGlvbigpIHtcbiAgICBpZihhZnRlcl91bmxvYWQpIHJldHVybjtcbiAgICBhZnRlcl91bmxvYWQgPSB0cnVlO1xuICAgIHRyaWdnZXJfdW5sb2FkX2NhbGxiYWNrcygpO1xufTtcblxuLy8gT25iZWZvcmV1bmxvYWQgYWxvbmUgaXMgbm90IHJlbGlhYmxlLiBXZSBjb3VsZCB1c2Ugb25seSAndW5sb2FkJ1xuLy8gYnV0IGl0J3Mgbm90IHdvcmtpbmcgaW4gb3BlcmEgd2l0aGluIGFuIGlmcmFtZS4gTGV0J3MgdXNlIGJvdGguXG51dGlscy5hdHRhY2hFdmVudCgnYmVmb3JldW5sb2FkJywgdW5sb2FkX3RyaWdnZXJlZCk7XG51dGlscy5hdHRhY2hFdmVudCgndW5sb2FkJywgdW5sb2FkX3RyaWdnZXJlZCk7XG5cbnV0aWxzLnVubG9hZF9hZGQgPSBmdW5jdGlvbihsaXN0ZW5lcikge1xuICAgIHZhciByZWYgPSB1dGlscy5yYW5kb21fc3RyaW5nKDgpO1xuICAgIG9uX3VubG9hZFtyZWZdID0gbGlzdGVuZXI7XG4gICAgaWYgKGFmdGVyX3VubG9hZCkge1xuICAgICAgICB1dGlscy5kZWxheSh0cmlnZ2VyX3VubG9hZF9jYWxsYmFja3MpO1xuICAgIH1cbiAgICByZXR1cm4gcmVmO1xufTtcbnV0aWxzLnVubG9hZF9kZWwgPSBmdW5jdGlvbihyZWYpIHtcbiAgICBpZiAocmVmIGluIG9uX3VubG9hZClcbiAgICAgICAgZGVsZXRlIG9uX3VubG9hZFtyZWZdO1xufTtcblxuXG51dGlscy5jcmVhdGVJZnJhbWUgPSBmdW5jdGlvbiAoaWZyYW1lX3VybCwgZXJyb3JfY2FsbGJhY2spIHtcbiAgICB2YXIgaWZyYW1lID0gX2RvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgIHZhciB0cmVmLCB1bmxvYWRfcmVmO1xuICAgIHZhciB1bmF0dGFjaCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodHJlZik7XG4gICAgICAgIC8vIEV4cGxvcmVyIGhhZCBwcm9ibGVtcyB3aXRoIHRoYXQuXG4gICAgICAgIHRyeSB7aWZyYW1lLm9ubG9hZCA9IG51bGw7fSBjYXRjaCAoeCkge31cbiAgICAgICAgaWZyYW1lLm9uZXJyb3IgPSBudWxsO1xuICAgIH07XG4gICAgdmFyIGNsZWFudXAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGlmcmFtZSkge1xuICAgICAgICAgICAgdW5hdHRhY2goKTtcbiAgICAgICAgICAgIC8vIFRoaXMgdGltZW91dCBtYWtlcyBjaHJvbWUgZmlyZSBvbmJlZm9yZXVubG9hZCBldmVudFxuICAgICAgICAgICAgLy8gd2l0aGluIGlmcmFtZS4gV2l0aG91dCB0aGUgdGltZW91dCBpdCBnb2VzIHN0cmFpZ2h0IHRvXG4gICAgICAgICAgICAvLyBvbnVubG9hZC5cbiAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYoaWZyYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmcmFtZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGlmcmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmcmFtZSA9IG51bGw7XG4gICAgICAgICAgICB9LCAwKTtcbiAgICAgICAgICAgIHV0aWxzLnVubG9hZF9kZWwodW5sb2FkX3JlZik7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHZhciBvbmVycm9yID0gZnVuY3Rpb24ocikge1xuICAgICAgICBpZiAoaWZyYW1lKSB7XG4gICAgICAgICAgICBjbGVhbnVwKCk7XG4gICAgICAgICAgICBlcnJvcl9jYWxsYmFjayhyKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgdmFyIHBvc3QgPSBmdW5jdGlvbihtc2csIG9yaWdpbikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB0aGUgaWZyYW1lIGlzIG5vdCBsb2FkZWQsIElFIHJhaXNlcyBhbiBleGNlcHRpb25cbiAgICAgICAgICAgIC8vIG9uICdjb250ZW50V2luZG93Jy5cbiAgICAgICAgICAgIGlmIChpZnJhbWUgJiYgaWZyYW1lLmNvbnRlbnRXaW5kb3cpIHtcbiAgICAgICAgICAgICAgICBpZnJhbWUuY29udGVudFdpbmRvdy5wb3N0TWVzc2FnZShtc2csIG9yaWdpbik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKHgpIHt9O1xuICAgIH07XG5cbiAgICBpZnJhbWUuc3JjID0gaWZyYW1lX3VybDtcbiAgICBpZnJhbWUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICBpZnJhbWUuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIGlmcmFtZS5vbmVycm9yID0gZnVuY3Rpb24oKXtvbmVycm9yKCdvbmVycm9yJyk7fTtcbiAgICBpZnJhbWUub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIC8vIGBvbmxvYWRgIGlzIHRyaWdnZXJlZCBiZWZvcmUgc2NyaXB0cyBvbiB0aGUgaWZyYW1lIGFyZVxuICAgICAgICAvLyBleGVjdXRlZC4gR2l2ZSBpdCBmZXcgc2Vjb25kcyB0byBhY3R1YWxseSBsb2FkIHN0dWZmLlxuICAgICAgICBjbGVhclRpbWVvdXQodHJlZik7XG4gICAgICAgIHRyZWYgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7b25lcnJvcignb25sb2FkIHRpbWVvdXQnKTt9LCAyMDAwKTtcbiAgICB9O1xuICAgIF9kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlmcmFtZSk7XG4gICAgdHJlZiA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtvbmVycm9yKCd0aW1lb3V0Jyk7fSwgMTUwMDApO1xuICAgIHVubG9hZF9yZWYgPSB1dGlscy51bmxvYWRfYWRkKGNsZWFudXApO1xuICAgIHJldHVybiB7XG4gICAgICAgIHBvc3Q6IHBvc3QsXG4gICAgICAgIGNsZWFudXA6IGNsZWFudXAsXG4gICAgICAgIGxvYWRlZDogdW5hdHRhY2hcbiAgICB9O1xufTtcblxudXRpbHMuY3JlYXRlSHRtbGZpbGUgPSBmdW5jdGlvbiAoaWZyYW1lX3VybCwgZXJyb3JfY2FsbGJhY2spIHtcbiAgICB2YXIgZG9jID0gbmV3IEFjdGl2ZVhPYmplY3QoJ2h0bWxmaWxlJyk7XG4gICAgdmFyIHRyZWYsIHVubG9hZF9yZWY7XG4gICAgdmFyIGlmcmFtZTtcbiAgICB2YXIgdW5hdHRhY2ggPSBmdW5jdGlvbigpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRyZWYpO1xuICAgIH07XG4gICAgdmFyIGNsZWFudXAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGRvYykge1xuICAgICAgICAgICAgdW5hdHRhY2goKTtcbiAgICAgICAgICAgIHV0aWxzLnVubG9hZF9kZWwodW5sb2FkX3JlZik7XG4gICAgICAgICAgICBpZnJhbWUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuICAgICAgICAgICAgaWZyYW1lID0gZG9jID0gbnVsbDtcbiAgICAgICAgICAgIENvbGxlY3RHYXJiYWdlKCk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHZhciBvbmVycm9yID0gZnVuY3Rpb24ocikgIHtcbiAgICAgICAgaWYgKGRvYykge1xuICAgICAgICAgICAgY2xlYW51cCgpO1xuICAgICAgICAgICAgZXJyb3JfY2FsbGJhY2socik7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHZhciBwb3N0ID0gZnVuY3Rpb24obXNnLCBvcmlnaW4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gdGhlIGlmcmFtZSBpcyBub3QgbG9hZGVkLCBJRSByYWlzZXMgYW4gZXhjZXB0aW9uXG4gICAgICAgICAgICAvLyBvbiAnY29udGVudFdpbmRvdycuXG4gICAgICAgICAgICBpZiAoaWZyYW1lICYmIGlmcmFtZS5jb250ZW50V2luZG93KSB7XG4gICAgICAgICAgICAgICAgaWZyYW1lLmNvbnRlbnRXaW5kb3cucG9zdE1lc3NhZ2UobXNnLCBvcmlnaW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoICh4KSB7fTtcbiAgICB9O1xuXG4gICAgZG9jLm9wZW4oKTtcbiAgICBkb2Mud3JpdGUoJzxodG1sPjxzJyArICdjcmlwdD4nICtcbiAgICAgICAgICAgICAgJ2RvY3VtZW50LmRvbWFpbj1cIicgKyBkb2N1bWVudC5kb21haW4gKyAnXCI7JyArXG4gICAgICAgICAgICAgICc8L3MnICsgJ2NyaXB0PjwvaHRtbD4nKTtcbiAgICBkb2MuY2xvc2UoKTtcbiAgICBkb2MucGFyZW50V2luZG93W1dQcmVmaXhdID0gX3dpbmRvd1tXUHJlZml4XTtcbiAgICB2YXIgYyA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBkb2MuYm9keS5hcHBlbmRDaGlsZChjKTtcbiAgICBpZnJhbWUgPSBkb2MuY3JlYXRlRWxlbWVudCgnaWZyYW1lJyk7XG4gICAgYy5hcHBlbmRDaGlsZChpZnJhbWUpO1xuICAgIGlmcmFtZS5zcmMgPSBpZnJhbWVfdXJsO1xuICAgIHRyZWYgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7b25lcnJvcigndGltZW91dCcpO30sIDE1MDAwKTtcbiAgICB1bmxvYWRfcmVmID0gdXRpbHMudW5sb2FkX2FkZChjbGVhbnVwKTtcbiAgICByZXR1cm4ge1xuICAgICAgICBwb3N0OiBwb3N0LFxuICAgICAgICBjbGVhbnVwOiBjbGVhbnVwLFxuICAgICAgICBsb2FkZWQ6IHVuYXR0YWNoXG4gICAgfTtcbn07XG4vLyAgICAgICAgIFsqXSBFbmQgb2YgbGliL2RvbS5qc1xuXG5cbi8vICAgICAgICAgWypdIEluY2x1ZGluZyBsaWIvZG9tMi5qc1xuLypcbiAqICoqKioqIEJFR0lOIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqIENvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuICpcbiAqIEZvciB0aGUgbGljZW5zZSBzZWUgQ09QWUlORy5cbiAqICoqKioqIEVORCBMSUNFTlNFIEJMT0NLICoqKioqXG4gKi9cblxudmFyIEFic3RyYWN0WEhST2JqZWN0ID0gZnVuY3Rpb24oKXt9O1xuQWJzdHJhY3RYSFJPYmplY3QucHJvdG90eXBlID0gbmV3IEV2ZW50RW1pdHRlcihbJ2NodW5rJywgJ2ZpbmlzaCddKTtcblxuQWJzdHJhY3RYSFJPYmplY3QucHJvdG90eXBlLl9zdGFydCA9IGZ1bmN0aW9uKG1ldGhvZCwgdXJsLCBwYXlsb2FkLCBvcHRzKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuXG4gICAgdHJ5IHtcbiAgICAgICAgdGhhdC54aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICB9IGNhdGNoKHgpIHt9O1xuXG4gICAgaWYgKCF0aGF0Lnhocikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhhdC54aHIgPSBuZXcgX3dpbmRvdy5BY3RpdmVYT2JqZWN0KCdNaWNyb3NvZnQuWE1MSFRUUCcpO1xuICAgICAgICB9IGNhdGNoKHgpIHt9O1xuICAgIH1cbiAgICBpZiAoX3dpbmRvdy5BY3RpdmVYT2JqZWN0IHx8IF93aW5kb3cuWERvbWFpblJlcXVlc3QpIHtcbiAgICAgICAgLy8gSUU4IGNhY2hlcyBldmVuIFBPU1RzXG4gICAgICAgIHVybCArPSAoKHVybC5pbmRleE9mKCc/JykgPT09IC0xKSA/ICc/JyA6ICcmJykgKyAndD0nKygrbmV3IERhdGUpO1xuICAgIH1cblxuICAgIC8vIEV4cGxvcmVyIHRlbmRzIHRvIGtlZXAgY29ubmVjdGlvbiBvcGVuLCBldmVuIGFmdGVyIHRoZVxuICAgIC8vIHRhYiBnZXRzIGNsb3NlZDogaHR0cDovL2J1Z3MuanF1ZXJ5LmNvbS90aWNrZXQvNTI4MFxuICAgIHRoYXQudW5sb2FkX3JlZiA9IHV0aWxzLnVubG9hZF9hZGQoZnVuY3Rpb24oKXt0aGF0Ll9jbGVhbnVwKHRydWUpO30pO1xuICAgIHRyeSB7XG4gICAgICAgIHRoYXQueGhyLm9wZW4obWV0aG9kLCB1cmwsIHRydWUpO1xuICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAvLyBJRSByYWlzZXMgYW4gZXhjZXB0aW9uIG9uIHdyb25nIHBvcnQuXG4gICAgICAgIHRoYXQuZW1pdCgnZmluaXNoJywgMCwgJycpO1xuICAgICAgICB0aGF0Ll9jbGVhbnVwKCk7XG4gICAgICAgIHJldHVybjtcbiAgICB9O1xuXG4gICAgaWYgKCFvcHRzIHx8ICFvcHRzLm5vX2NyZWRlbnRpYWxzKSB7XG4gICAgICAgIC8vIE1vemlsbGEgZG9jcyBzYXlzIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL1hNTEh0dHBSZXF1ZXN0IDpcbiAgICAgICAgLy8gXCJUaGlzIG5ldmVyIGFmZmVjdHMgc2FtZS1zaXRlIHJlcXVlc3RzLlwiXG4gICAgICAgIHRoYXQueGhyLndpdGhDcmVkZW50aWFscyA9ICd0cnVlJztcbiAgICB9XG4gICAgaWYgKG9wdHMgJiYgb3B0cy5oZWFkZXJzKSB7XG4gICAgICAgIGZvcih2YXIga2V5IGluIG9wdHMuaGVhZGVycykge1xuICAgICAgICAgICAgdGhhdC54aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIG9wdHMuaGVhZGVyc1trZXldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoYXQueGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhhdC54aHIpIHtcbiAgICAgICAgICAgIHZhciB4ID0gdGhhdC54aHI7XG4gICAgICAgICAgICBzd2l0Y2ggKHgucmVhZHlTdGF0ZSkge1xuICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgICAgIC8vIElFIGRvZXNuJ3QgbGlrZSBwZWVraW5nIGludG8gcmVzcG9uc2VUZXh0IG9yIHN0YXR1c1xuICAgICAgICAgICAgICAgIC8vIG9uIE1pY3Jvc29mdC5YTUxIVFRQIGFuZCByZWFkeXN0YXRlPTNcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgc3RhdHVzID0geC5zdGF0dXM7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0ZXh0ID0geC5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoeCkge307XG4gICAgICAgICAgICAgICAgLy8gSUUgZG9lcyByZXR1cm4gcmVhZHlzdGF0ZSA9PSAzIGZvciA0MDQgYW5zd2Vycy5cbiAgICAgICAgICAgICAgICBpZiAodGV4dCAmJiB0ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhhdC5lbWl0KCdjaHVuaycsIHN0YXR1cywgdGV4dCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA0OlxuICAgICAgICAgICAgICAgIHRoYXQuZW1pdCgnZmluaXNoJywgeC5zdGF0dXMsIHgucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICB0aGF0Ll9jbGVhbnVwKGZhbHNlKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG4gICAgdGhhdC54aHIuc2VuZChwYXlsb2FkKTtcbn07XG5cbkFic3RyYWN0WEhST2JqZWN0LnByb3RvdHlwZS5fY2xlYW51cCA9IGZ1bmN0aW9uKGFib3J0KSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIGlmICghdGhhdC54aHIpIHJldHVybjtcbiAgICB1dGlscy51bmxvYWRfZGVsKHRoYXQudW5sb2FkX3JlZik7XG5cbiAgICAvLyBJRSBuZWVkcyB0aGlzIGZpZWxkIHRvIGJlIGEgZnVuY3Rpb25cbiAgICB0aGF0Lnhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpe307XG5cbiAgICBpZiAoYWJvcnQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoYXQueGhyLmFib3J0KCk7XG4gICAgICAgIH0gY2F0Y2goeCkge307XG4gICAgfVxuICAgIHRoYXQudW5sb2FkX3JlZiA9IHRoYXQueGhyID0gbnVsbDtcbn07XG5cbkFic3RyYWN0WEhST2JqZWN0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB0aGF0Lm51a2UoKTtcbiAgICB0aGF0Ll9jbGVhbnVwKHRydWUpO1xufTtcblxudmFyIFhIUkNvcnNPYmplY3QgPSB1dGlscy5YSFJDb3JzT2JqZWN0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzLCBhcmdzID0gYXJndW1lbnRzO1xuICAgIHV0aWxzLmRlbGF5KGZ1bmN0aW9uKCl7dGhhdC5fc3RhcnQuYXBwbHkodGhhdCwgYXJncyk7fSk7XG59O1xuWEhSQ29yc09iamVjdC5wcm90b3R5cGUgPSBuZXcgQWJzdHJhY3RYSFJPYmplY3QoKTtcblxudmFyIFhIUkxvY2FsT2JqZWN0ID0gdXRpbHMuWEhSTG9jYWxPYmplY3QgPSBmdW5jdGlvbihtZXRob2QsIHVybCwgcGF5bG9hZCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB1dGlscy5kZWxheShmdW5jdGlvbigpe1xuICAgICAgICB0aGF0Ll9zdGFydChtZXRob2QsIHVybCwgcGF5bG9hZCwge1xuICAgICAgICAgICAgbm9fY3JlZGVudGlhbHM6IHRydWVcbiAgICAgICAgfSk7XG4gICAgfSk7XG59O1xuWEhSTG9jYWxPYmplY3QucHJvdG90eXBlID0gbmV3IEFic3RyYWN0WEhST2JqZWN0KCk7XG5cblxuXG4vLyBSZWZlcmVuY2VzOlxuLy8gICBodHRwOi8vYWpheGlhbi5jb20vYXJjaGl2ZXMvMTAwLWxpbmUtYWpheC13cmFwcGVyXG4vLyAgIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9jYzI4ODA2MCh2PVZTLjg1KS5hc3B4XG52YXIgWERST2JqZWN0ID0gdXRpbHMuWERST2JqZWN0ID0gZnVuY3Rpb24obWV0aG9kLCB1cmwsIHBheWxvYWQpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdXRpbHMuZGVsYXkoZnVuY3Rpb24oKXt0aGF0Ll9zdGFydChtZXRob2QsIHVybCwgcGF5bG9hZCk7fSk7XG59O1xuWERST2JqZWN0LnByb3RvdHlwZSA9IG5ldyBFdmVudEVtaXR0ZXIoWydjaHVuaycsICdmaW5pc2gnXSk7XG5YRFJPYmplY3QucHJvdG90eXBlLl9zdGFydCA9IGZ1bmN0aW9uKG1ldGhvZCwgdXJsLCBwYXlsb2FkKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHZhciB4ZHIgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcbiAgICAvLyBJRSBjYWNoZXMgZXZlbiBQT1NUc1xuICAgIHVybCArPSAoKHVybC5pbmRleE9mKCc/JykgPT09IC0xKSA/ICc/JyA6ICcmJykgKyAndD0nKygrbmV3IERhdGUpO1xuXG4gICAgdmFyIG9uZXJyb3IgPSB4ZHIub250aW1lb3V0ID0geGRyLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhhdC5lbWl0KCdmaW5pc2gnLCAwLCAnJyk7XG4gICAgICAgIHRoYXQuX2NsZWFudXAoZmFsc2UpO1xuICAgIH07XG4gICAgeGRyLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhhdC5lbWl0KCdjaHVuaycsIDIwMCwgeGRyLnJlc3BvbnNlVGV4dCk7XG4gICAgfTtcbiAgICB4ZHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoYXQuZW1pdCgnZmluaXNoJywgMjAwLCB4ZHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgdGhhdC5fY2xlYW51cChmYWxzZSk7XG4gICAgfTtcbiAgICB0aGF0LnhkciA9IHhkcjtcbiAgICB0aGF0LnVubG9hZF9yZWYgPSB1dGlscy51bmxvYWRfYWRkKGZ1bmN0aW9uKCl7dGhhdC5fY2xlYW51cCh0cnVlKTt9KTtcbiAgICB0cnkge1xuICAgICAgICAvLyBGYWlscyB3aXRoIEFjY2Vzc0RlbmllZCBpZiBwb3J0IG51bWJlciBpcyBib2d1c1xuICAgICAgICB0aGF0Lnhkci5vcGVuKG1ldGhvZCwgdXJsKTtcbiAgICAgICAgdGhhdC54ZHIuc2VuZChwYXlsb2FkKTtcbiAgICB9IGNhdGNoKHgpIHtcbiAgICAgICAgb25lcnJvcigpO1xuICAgIH1cbn07XG5cblhEUk9iamVjdC5wcm90b3R5cGUuX2NsZWFudXAgPSBmdW5jdGlvbihhYm9ydCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBpZiAoIXRoYXQueGRyKSByZXR1cm47XG4gICAgdXRpbHMudW5sb2FkX2RlbCh0aGF0LnVubG9hZF9yZWYpO1xuXG4gICAgdGhhdC54ZHIub250aW1lb3V0ID0gdGhhdC54ZHIub25lcnJvciA9IHRoYXQueGRyLm9ucHJvZ3Jlc3MgPVxuICAgICAgICB0aGF0Lnhkci5vbmxvYWQgPSBudWxsO1xuICAgIGlmIChhYm9ydCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhhdC54ZHIuYWJvcnQoKTtcbiAgICAgICAgfSBjYXRjaCh4KSB7fTtcbiAgICB9XG4gICAgdGhhdC51bmxvYWRfcmVmID0gdGhhdC54ZHIgPSBudWxsO1xufTtcblxuWERST2JqZWN0LnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB0aGF0Lm51a2UoKTtcbiAgICB0aGF0Ll9jbGVhbnVwKHRydWUpO1xufTtcblxuLy8gMS4gSXMgbmF0aXZlbHkgdmlhIFhIUlxuLy8gMi4gSXMgbmF0aXZlbHkgdmlhIFhEUlxuLy8gMy4gTm9wZSwgYnV0IHBvc3RNZXNzYWdlIGlzIHRoZXJlIHNvIGl0IHNob3VsZCB3b3JrIHZpYSB0aGUgSWZyYW1lLlxuLy8gNC4gTm9wZSwgc29ycnkuXG51dGlscy5pc1hIUkNvcnNDYXBhYmxlID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKF93aW5kb3cuWE1MSHR0cFJlcXVlc3QgJiYgJ3dpdGhDcmVkZW50aWFscycgaW4gbmV3IFhNTEh0dHBSZXF1ZXN0KCkpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIC8vIFhEb21haW5SZXF1ZXN0IGRvZXNuJ3Qgd29yayBpZiBwYWdlIGlzIHNlcnZlZCBmcm9tIGZpbGU6Ly9cbiAgICBpZiAoX3dpbmRvdy5YRG9tYWluUmVxdWVzdCAmJiBfZG9jdW1lbnQuZG9tYWluKSB7XG4gICAgICAgIHJldHVybiAyO1xuICAgIH1cbiAgICBpZiAoSWZyYW1lVHJhbnNwb3J0LmVuYWJsZWQoKSkge1xuICAgICAgICByZXR1cm4gMztcbiAgICB9XG4gICAgcmV0dXJuIDQ7XG59O1xuLy8gICAgICAgICBbKl0gRW5kIG9mIGxpYi9kb20yLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi9zb2NranMuanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbnZhciBTb2NrSlMgPSBmdW5jdGlvbih1cmwsIGRlcF9wcm90b2NvbHNfd2hpdGVsaXN0LCBvcHRpb25zKSB7XG4gICAgaWYgKHRoaXMgPT09IHdpbmRvdykge1xuICAgICAgICAvLyBtYWtlcyBgbmV3YCBvcHRpb25hbFxuICAgICAgICByZXR1cm4gbmV3IFNvY2tKUyh1cmwsIGRlcF9wcm90b2NvbHNfd2hpdGVsaXN0LCBvcHRpb25zKTtcbiAgICB9XG4gICAgXG4gICAgdmFyIHRoYXQgPSB0aGlzLCBwcm90b2NvbHNfd2hpdGVsaXN0O1xuICAgIHRoYXQuX29wdGlvbnMgPSB7ZGV2ZWw6IGZhbHNlLCBkZWJ1ZzogZmFsc2UsIHByb3RvY29sc193aGl0ZWxpc3Q6IFtdLFxuICAgICAgICAgICAgICAgICAgICAgaW5mbzogdW5kZWZpbmVkLCBydHQ6IHVuZGVmaW5lZH07XG4gICAgaWYgKG9wdGlvbnMpIHtcbiAgICAgICAgdXRpbHMub2JqZWN0RXh0ZW5kKHRoYXQuX29wdGlvbnMsIG9wdGlvbnMpO1xuICAgIH1cbiAgICB0aGF0Ll9iYXNlX3VybCA9IHV0aWxzLmFtZW5kVXJsKHVybCk7XG4gICAgdGhhdC5fc2VydmVyID0gdGhhdC5fb3B0aW9ucy5zZXJ2ZXIgfHwgdXRpbHMucmFuZG9tX251bWJlcl9zdHJpbmcoMTAwMCk7XG4gICAgaWYgKHRoYXQuX29wdGlvbnMucHJvdG9jb2xzX3doaXRlbGlzdCAmJlxuICAgICAgICB0aGF0Ll9vcHRpb25zLnByb3RvY29sc193aGl0ZWxpc3QubGVuZ3RoKSB7XG4gICAgICAgIHByb3RvY29sc193aGl0ZWxpc3QgPSB0aGF0Ll9vcHRpb25zLnByb3RvY29sc193aGl0ZWxpc3Q7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRGVwcmVjYXRlZCBBUElcbiAgICAgICAgaWYgKHR5cGVvZiBkZXBfcHJvdG9jb2xzX3doaXRlbGlzdCA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAgIGRlcF9wcm90b2NvbHNfd2hpdGVsaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHByb3RvY29sc193aGl0ZWxpc3QgPSBbZGVwX3Byb3RvY29sc193aGl0ZWxpc3RdO1xuICAgICAgICB9IGVsc2UgaWYgKHV0aWxzLmlzQXJyYXkoZGVwX3Byb3RvY29sc193aGl0ZWxpc3QpKSB7XG4gICAgICAgICAgICBwcm90b2NvbHNfd2hpdGVsaXN0ID0gZGVwX3Byb3RvY29sc193aGl0ZWxpc3RcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb3RvY29sc193aGl0ZWxpc3QgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm90b2NvbHNfd2hpdGVsaXN0KSB7XG4gICAgICAgICAgICB0aGF0Ll9kZWJ1ZygnRGVwcmVjYXRlZCBBUEk6IFVzZSBcInByb3RvY29sc193aGl0ZWxpc3RcIiBvcHRpb24gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAnaW5zdGVhZCBvZiBzdXBwbHlpbmcgcHJvdG9jb2wgbGlzdCBhcyBhIHNlY29uZCAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICdwYXJhbWV0ZXIgdG8gU29ja0pTIGNvbnN0cnVjdG9yLicpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHRoYXQuX3Byb3RvY29scyA9IFtdO1xuICAgIHRoYXQucHJvdG9jb2wgPSBudWxsO1xuICAgIHRoYXQucmVhZHlTdGF0ZSA9IFNvY2tKUy5DT05ORUNUSU5HO1xuICAgIHRoYXQuX2lyID0gY3JlYXRlSW5mb1JlY2VpdmVyKHRoYXQuX2Jhc2VfdXJsKTtcbiAgICB0aGF0Ll9pci5vbmZpbmlzaCA9IGZ1bmN0aW9uKGluZm8sIHJ0dCkge1xuICAgICAgICB0aGF0Ll9pciA9IG51bGw7XG4gICAgICAgIGlmIChpbmZvKSB7XG4gICAgICAgICAgICBpZiAodGhhdC5fb3B0aW9ucy5pbmZvKSB7XG4gICAgICAgICAgICAgICAgLy8gT3ZlcnJpZGUgaWYgdXNlciBzdXBwbGllcyB0aGUgb3B0aW9uXG4gICAgICAgICAgICAgICAgaW5mbyA9IHV0aWxzLm9iamVjdEV4dGVuZChpbmZvLCB0aGF0Ll9vcHRpb25zLmluZm8pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoYXQuX29wdGlvbnMucnR0KSB7XG4gICAgICAgICAgICAgICAgcnR0ID0gdGhhdC5fb3B0aW9ucy5ydHQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGF0Ll9hcHBseUluZm8oaW5mbywgcnR0LCBwcm90b2NvbHNfd2hpdGVsaXN0KTtcbiAgICAgICAgICAgIHRoYXQuX2RpZENsb3NlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGF0Ll9kaWRDbG9zZSgxMDAyLCAnQ2FuXFwndCBjb25uZWN0IHRvIHNlcnZlcicsIHRydWUpO1xuICAgICAgICB9XG4gICAgfTtcbn07XG4vLyBJbmhlcml0YW5jZVxuU29ja0pTLnByb3RvdHlwZSA9IG5ldyBSRXZlbnRUYXJnZXQoKTtcblxuU29ja0pTLnZlcnNpb24gPSBcIjAuMy4xLjcuZ2E2N2YuZGlydHlcIjtcblxuU29ja0pTLkNPTk5FQ1RJTkcgPSAwO1xuU29ja0pTLk9QRU4gPSAxO1xuU29ja0pTLkNMT1NJTkcgPSAyO1xuU29ja0pTLkNMT1NFRCA9IDM7XG5cblNvY2tKUy5wcm90b3R5cGUuX2RlYnVnID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuX29wdGlvbnMuZGVidWcpXG4gICAgICAgIHV0aWxzLmxvZy5hcHBseSh1dGlscywgYXJndW1lbnRzKTtcbn07XG5cblNvY2tKUy5wcm90b3R5cGUuX2Rpc3BhdGNoT3BlbiA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBpZiAodGhhdC5yZWFkeVN0YXRlID09PSBTb2NrSlMuQ09OTkVDVElORykge1xuICAgICAgICBpZiAodGhhdC5fdHJhbnNwb3J0X3RyZWYpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGF0Ll90cmFuc3BvcnRfdHJlZik7XG4gICAgICAgICAgICB0aGF0Ll90cmFuc3BvcnRfdHJlZiA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhhdC5yZWFkeVN0YXRlID0gU29ja0pTLk9QRU47XG4gICAgICAgIHRoYXQuZGlzcGF0Y2hFdmVudChuZXcgU2ltcGxlRXZlbnQoXCJvcGVuXCIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUaGUgc2VydmVyIG1pZ2h0IGhhdmUgYmVlbiByZXN0YXJ0ZWQsIGFuZCBsb3N0IHRyYWNrIG9mIG91clxuICAgICAgICAvLyBjb25uZWN0aW9uLlxuICAgICAgICB0aGF0Ll9kaWRDbG9zZSgxMDA2LCBcIlNlcnZlciBsb3N0IHNlc3Npb25cIik7XG4gICAgfVxufTtcblxuU29ja0pTLnByb3RvdHlwZS5fZGlzcGF0Y2hNZXNzYWdlID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBpZiAodGhhdC5yZWFkeVN0YXRlICE9PSBTb2NrSlMuT1BFTilcbiAgICAgICAgICAgIHJldHVybjtcbiAgICB0aGF0LmRpc3BhdGNoRXZlbnQobmV3IFNpbXBsZUV2ZW50KFwibWVzc2FnZVwiLCB7ZGF0YTogZGF0YX0pKTtcbn07XG5cblNvY2tKUy5wcm90b3R5cGUuX2Rpc3BhdGNoSGVhcnRiZWF0ID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBpZiAodGhhdC5yZWFkeVN0YXRlICE9PSBTb2NrSlMuT1BFTilcbiAgICAgICAgcmV0dXJuO1xuICAgIHRoYXQuZGlzcGF0Y2hFdmVudChuZXcgU2ltcGxlRXZlbnQoJ2hlYXJ0YmVhdCcsIHt9KSk7XG59O1xuXG5Tb2NrSlMucHJvdG90eXBlLl9kaWRDbG9zZSA9IGZ1bmN0aW9uKGNvZGUsIHJlYXNvbiwgZm9yY2UpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgaWYgKHRoYXQucmVhZHlTdGF0ZSAhPT0gU29ja0pTLkNPTk5FQ1RJTkcgJiZcbiAgICAgICAgdGhhdC5yZWFkeVN0YXRlICE9PSBTb2NrSlMuT1BFTiAmJlxuICAgICAgICB0aGF0LnJlYWR5U3RhdGUgIT09IFNvY2tKUy5DTE9TSU5HKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJTlZBTElEX1NUQVRFX0VSUicpO1xuICAgIGlmICh0aGF0Ll9pcikge1xuICAgICAgICB0aGF0Ll9pci5udWtlKCk7XG4gICAgICAgIHRoYXQuX2lyID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAodGhhdC5fdHJhbnNwb3J0KSB7XG4gICAgICAgIHRoYXQuX3RyYW5zcG9ydC5kb0NsZWFudXAoKTtcbiAgICAgICAgdGhhdC5fdHJhbnNwb3J0ID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgY2xvc2VfZXZlbnQgPSBuZXcgU2ltcGxlRXZlbnQoXCJjbG9zZVwiLCB7XG4gICAgICAgIGNvZGU6IGNvZGUsXG4gICAgICAgIHJlYXNvbjogcmVhc29uLFxuICAgICAgICB3YXNDbGVhbjogdXRpbHMudXNlclNldENvZGUoY29kZSl9KTtcblxuICAgIGlmICghdXRpbHMudXNlclNldENvZGUoY29kZSkgJiZcbiAgICAgICAgdGhhdC5yZWFkeVN0YXRlID09PSBTb2NrSlMuQ09OTkVDVElORyAmJiAhZm9yY2UpIHtcbiAgICAgICAgaWYgKHRoYXQuX3RyeV9uZXh0X3Byb3RvY29sKGNsb3NlX2V2ZW50KSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNsb3NlX2V2ZW50ID0gbmV3IFNpbXBsZUV2ZW50KFwiY2xvc2VcIiwge2NvZGU6IDIwMDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWFzb246IFwiQWxsIHRyYW5zcG9ydHMgZmFpbGVkXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3YXNDbGVhbjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0X2V2ZW50OiBjbG9zZV9ldmVudH0pO1xuICAgIH1cbiAgICB0aGF0LnJlYWR5U3RhdGUgPSBTb2NrSlMuQ0xPU0VEO1xuXG4gICAgdXRpbHMuZGVsYXkoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgdGhhdC5kaXNwYXRjaEV2ZW50KGNsb3NlX2V2ZW50KTtcbiAgICAgICAgICAgICAgICB9KTtcbn07XG5cblNvY2tKUy5wcm90b3R5cGUuX2RpZE1lc3NhZ2UgPSBmdW5jdGlvbihkYXRhKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHZhciB0eXBlID0gZGF0YS5zbGljZSgwLCAxKTtcbiAgICBzd2l0Y2godHlwZSkge1xuICAgIGNhc2UgJ28nOlxuICAgICAgICB0aGF0Ll9kaXNwYXRjaE9wZW4oKTtcbiAgICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYSc6XG4gICAgICAgIHZhciBwYXlsb2FkID0gSlNPTi5wYXJzZShkYXRhLnNsaWNlKDEpIHx8ICdbXScpO1xuICAgICAgICBmb3IodmFyIGk9MDsgaSA8IHBheWxvYWQubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgdGhhdC5fZGlzcGF0Y2hNZXNzYWdlKHBheWxvYWRbaV0pO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ20nOlxuICAgICAgICB2YXIgcGF5bG9hZCA9IEpTT04ucGFyc2UoZGF0YS5zbGljZSgxKSB8fCAnbnVsbCcpO1xuICAgICAgICB0aGF0Ll9kaXNwYXRjaE1lc3NhZ2UocGF5bG9hZCk7XG4gICAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2MnOlxuICAgICAgICB2YXIgcGF5bG9hZCA9IEpTT04ucGFyc2UoZGF0YS5zbGljZSgxKSB8fCAnW10nKTtcbiAgICAgICAgdGhhdC5fZGlkQ2xvc2UocGF5bG9hZFswXSwgcGF5bG9hZFsxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ2gnOlxuICAgICAgICB0aGF0Ll9kaXNwYXRjaEhlYXJ0YmVhdCgpO1xuICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG5Tb2NrSlMucHJvdG90eXBlLl90cnlfbmV4dF9wcm90b2NvbCA9IGZ1bmN0aW9uKGNsb3NlX2V2ZW50KSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIGlmICh0aGF0LnByb3RvY29sKSB7XG4gICAgICAgIHRoYXQuX2RlYnVnKCdDbG9zZWQgdHJhbnNwb3J0OicsIHRoYXQucHJvdG9jb2wsICcnK2Nsb3NlX2V2ZW50KTtcbiAgICAgICAgdGhhdC5wcm90b2NvbCA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGF0Ll90cmFuc3BvcnRfdHJlZikge1xuICAgICAgICBjbGVhclRpbWVvdXQodGhhdC5fdHJhbnNwb3J0X3RyZWYpO1xuICAgICAgICB0aGF0Ll90cmFuc3BvcnRfdHJlZiA9IG51bGw7XG4gICAgfVxuXG4gICAgd2hpbGUoMSkge1xuICAgICAgICB2YXIgcHJvdG9jb2wgPSB0aGF0LnByb3RvY29sID0gdGhhdC5fcHJvdG9jb2xzLnNoaWZ0KCk7XG4gICAgICAgIGlmICghcHJvdG9jb2wpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBTb21lIHByb3RvY29scyByZXF1aXJlIGFjY2VzcyB0byBgYm9keWAsIHdoYXQgaWYgd2VyZSBpblxuICAgICAgICAvLyB0aGUgYGhlYWRgP1xuICAgICAgICBpZiAoU29ja0pTW3Byb3RvY29sXSAmJlxuICAgICAgICAgICAgU29ja0pTW3Byb3RvY29sXS5uZWVkX2JvZHkgPT09IHRydWUgJiZcbiAgICAgICAgICAgICghX2RvY3VtZW50LmJvZHkgfHxcbiAgICAgICAgICAgICAodHlwZW9mIF9kb2N1bWVudC5yZWFkeVN0YXRlICE9PSAndW5kZWZpbmVkJ1xuICAgICAgICAgICAgICAmJiBfZG9jdW1lbnQucmVhZHlTdGF0ZSAhPT0gJ2NvbXBsZXRlJykpKSB7XG4gICAgICAgICAgICB0aGF0Ll9wcm90b2NvbHMudW5zaGlmdChwcm90b2NvbCk7XG4gICAgICAgICAgICB0aGF0LnByb3RvY29sID0gJ3dhaXRpbmctZm9yLWxvYWQnO1xuICAgICAgICAgICAgdXRpbHMuYXR0YWNoRXZlbnQoJ2xvYWQnLCBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHRoYXQuX3RyeV9uZXh0X3Byb3RvY29sKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFTb2NrSlNbcHJvdG9jb2xdIHx8XG4gICAgICAgICAgICAgICFTb2NrSlNbcHJvdG9jb2xdLmVuYWJsZWQodGhhdC5fb3B0aW9ucykpIHtcbiAgICAgICAgICAgIHRoYXQuX2RlYnVnKCdTa2lwcGluZyB0cmFuc3BvcnQ6JywgcHJvdG9jb2wpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHJvdW5kVHJpcHMgPSBTb2NrSlNbcHJvdG9jb2xdLnJvdW5kVHJpcHMgfHwgMTtcbiAgICAgICAgICAgIHZhciB0byA9ICgodGhhdC5fb3B0aW9ucy5ydG8gfHwgMCkgKiByb3VuZFRyaXBzKSB8fCA1MDAwO1xuICAgICAgICAgICAgdGhhdC5fdHJhbnNwb3J0X3RyZWYgPSB1dGlscy5kZWxheSh0bywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoYXQucmVhZHlTdGF0ZSA9PT0gU29ja0pTLkNPTk5FQ1RJTkcpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSSBjYW4ndCB1bmRlcnN0YW5kIGhvdyBpdCBpcyBwb3NzaWJsZSB0byBydW5cbiAgICAgICAgICAgICAgICAgICAgLy8gdGhpcyB0aW1lciwgd2hlbiB0aGUgc3RhdGUgaXMgQ0xPU0VELCBidXRcbiAgICAgICAgICAgICAgICAgICAgLy8gYXBwYXJlbnRseSBpbiBJRSBldmVyeXRoaW4gaXMgcG9zc2libGUuXG4gICAgICAgICAgICAgICAgICAgIHRoYXQuX2RpZENsb3NlKDIwMDcsIFwiVHJhbnNwb3J0IHRpbWVvdXRlZFwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdmFyIGNvbm5pZCA9IHV0aWxzLnJhbmRvbV9zdHJpbmcoOCk7XG4gICAgICAgICAgICB2YXIgdHJhbnNfdXJsID0gdGhhdC5fYmFzZV91cmwgKyAnLycgKyB0aGF0Ll9zZXJ2ZXIgKyAnLycgKyBjb25uaWQ7XG4gICAgICAgICAgICB0aGF0Ll9kZWJ1ZygnT3BlbmluZyB0cmFuc3BvcnQ6JywgcHJvdG9jb2wsICcgdXJsOicrdHJhbnNfdXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgJyBSVE86Jyt0aGF0Ll9vcHRpb25zLnJ0byk7XG4gICAgICAgICAgICB0aGF0Ll90cmFuc3BvcnQgPSBuZXcgU29ja0pTW3Byb3RvY29sXSh0aGF0LCB0cmFuc191cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0Ll9iYXNlX3VybCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbn07XG5cblNvY2tKUy5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbihjb2RlLCByZWFzb24pIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgaWYgKGNvZGUgJiYgIXV0aWxzLnVzZXJTZXRDb2RlKGNvZGUpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJTlZBTElEX0FDQ0VTU19FUlJcIik7XG4gICAgaWYodGhhdC5yZWFkeVN0YXRlICE9PSBTb2NrSlMuQ09OTkVDVElORyAmJlxuICAgICAgIHRoYXQucmVhZHlTdGF0ZSAhPT0gU29ja0pTLk9QRU4pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB0aGF0LnJlYWR5U3RhdGUgPSBTb2NrSlMuQ0xPU0lORztcbiAgICB0aGF0Ll9kaWRDbG9zZShjb2RlIHx8IDEwMDAsIHJlYXNvbiB8fCBcIk5vcm1hbCBjbG9zdXJlXCIpO1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuU29ja0pTLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24oZGF0YSkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBpZiAodGhhdC5yZWFkeVN0YXRlID09PSBTb2NrSlMuQ09OTkVDVElORylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJTlZBTElEX1NUQVRFX0VSUicpO1xuICAgIGlmICh0aGF0LnJlYWR5U3RhdGUgPT09IFNvY2tKUy5PUEVOKSB7XG4gICAgICAgIHRoYXQuX3RyYW5zcG9ydC5kb1NlbmQodXRpbHMucXVvdGUoJycgKyBkYXRhKSk7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufTtcblxuU29ja0pTLnByb3RvdHlwZS5fYXBwbHlJbmZvID0gZnVuY3Rpb24oaW5mbywgcnR0LCBwcm90b2NvbHNfd2hpdGVsaXN0KSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHRoYXQuX29wdGlvbnMuaW5mbyA9IGluZm87XG4gICAgdGhhdC5fb3B0aW9ucy5ydHQgPSBydHQ7XG4gICAgdGhhdC5fb3B0aW9ucy5ydG8gPSB1dGlscy5jb3VudFJUTyhydHQpO1xuICAgIHRoYXQuX29wdGlvbnMuaW5mby5udWxsX29yaWdpbiA9ICFfZG9jdW1lbnQuZG9tYWluO1xuICAgIHZhciBwcm9iZWQgPSB1dGlscy5wcm9iZVByb3RvY29scygpO1xuICAgIHRoYXQuX3Byb3RvY29scyA9IHV0aWxzLmRldGVjdFByb3RvY29scyhwcm9iZWQsIHByb3RvY29sc193aGl0ZWxpc3QsIGluZm8pO1xufTtcbi8vICAgICAgICAgWypdIEVuZCBvZiBsaWIvc29ja2pzLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi90cmFucy13ZWJzb2NrZXQuanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbnZhciBXZWJTb2NrZXRUcmFuc3BvcnQgPSBTb2NrSlMud2Vic29ja2V0ID0gZnVuY3Rpb24ocmksIHRyYW5zX3VybCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB2YXIgdXJsID0gdHJhbnNfdXJsICsgJy93ZWJzb2NrZXQnO1xuICAgIGlmICh1cmwuc2xpY2UoMCwgNSkgPT09ICdodHRwcycpIHtcbiAgICAgICAgdXJsID0gJ3dzcycgKyB1cmwuc2xpY2UoNSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdXJsID0gJ3dzJyArIHVybC5zbGljZSg0KTtcbiAgICB9XG4gICAgdGhhdC5yaSA9IHJpO1xuICAgIHRoYXQudXJsID0gdXJsO1xuICAgIHZhciBDb25zdHJ1Y3RvciA9IF93aW5kb3cuV2ViU29ja2V0IHx8IF93aW5kb3cuTW96V2ViU29ja2V0O1xuXG4gICAgdGhhdC53cyA9IG5ldyBDb25zdHJ1Y3Rvcih0aGF0LnVybCk7XG4gICAgdGhhdC53cy5vbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIHRoYXQucmkuX2RpZE1lc3NhZ2UoZS5kYXRhKTtcbiAgICB9O1xuICAgIC8vIEZpcmVmb3ggaGFzIGFuIGludGVyZXN0aW5nIGJ1Zy4gSWYgYSB3ZWJzb2NrZXQgY29ubmVjdGlvbiBpc1xuICAgIC8vIGNyZWF0ZWQgYWZ0ZXIgb25iZWZvcmV1bmxvYWQsIGl0IHN0YXlzIGFsaXZlIGV2ZW4gd2hlbiB1c2VyXG4gICAgLy8gbmF2aWdhdGVzIGF3YXkgZnJvbSB0aGUgcGFnZS4gSW4gc3VjaCBzaXR1YXRpb24gbGV0J3MgbGllIC1cbiAgICAvLyBsZXQncyBub3Qgb3BlbiB0aGUgd3MgY29ubmVjdGlvbiBhdCBhbGwuIFNlZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vc29ja2pzL3NvY2tqcy1jbGllbnQvaXNzdWVzLzI4XG4gICAgLy8gaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk2MDg1XG4gICAgdGhhdC51bmxvYWRfcmVmID0gdXRpbHMudW5sb2FkX2FkZChmdW5jdGlvbigpe3RoYXQud3MuY2xvc2UoKX0pO1xuICAgIHRoYXQud3Mub25jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGF0LnJpLl9kaWRNZXNzYWdlKHV0aWxzLmNsb3NlRnJhbWUoMTAwNiwgXCJXZWJTb2NrZXQgY29ubmVjdGlvbiBicm9rZW5cIikpO1xuICAgIH07XG59O1xuXG5XZWJTb2NrZXRUcmFuc3BvcnQucHJvdG90eXBlLmRvU2VuZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB0aGlzLndzLnNlbmQoJ1snICsgZGF0YSArICddJyk7XG59O1xuXG5XZWJTb2NrZXRUcmFuc3BvcnQucHJvdG90eXBlLmRvQ2xlYW51cCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB2YXIgd3MgPSB0aGF0LndzO1xuICAgIGlmICh3cykge1xuICAgICAgICB3cy5vbm1lc3NhZ2UgPSB3cy5vbmNsb3NlID0gbnVsbDtcbiAgICAgICAgd3MuY2xvc2UoKTtcbiAgICAgICAgdXRpbHMudW5sb2FkX2RlbCh0aGF0LnVubG9hZF9yZWYpO1xuICAgICAgICB0aGF0LnVubG9hZF9yZWYgPSB0aGF0LnJpID0gdGhhdC53cyA9IG51bGw7XG4gICAgfVxufTtcblxuV2ViU29ja2V0VHJhbnNwb3J0LmVuYWJsZWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gISEoX3dpbmRvdy5XZWJTb2NrZXQgfHwgX3dpbmRvdy5Nb3pXZWJTb2NrZXQpO1xufTtcblxuLy8gSW4gdGhlb3J5LCB3cyBzaG91bGQgcmVxdWlyZSAxIHJvdW5kIHRyaXAuIEJ1dCBpbiBjaHJvbWUsIHRoaXMgaXNcbi8vIG5vdCB2ZXJ5IHN0YWJsZSBvdmVyIFNTTC4gTW9zdCBsaWtlbHkgYSB3cyBjb25uZWN0aW9uIHJlcXVpcmVzIGFcbi8vIHNlcGFyYXRlIFNTTCBjb25uZWN0aW9uLCBpbiB3aGljaCBjYXNlIDIgcm91bmQgdHJpcHMgYXJlIGFuXG4vLyBhYnNvbHV0ZSBtaW51bXVtLlxuV2ViU29ja2V0VHJhbnNwb3J0LnJvdW5kVHJpcHMgPSAyO1xuLy8gICAgICAgICBbKl0gRW5kIG9mIGxpYi90cmFucy13ZWJzb2NrZXQuanNcblxuXG4vLyAgICAgICAgIFsqXSBJbmNsdWRpbmcgbGliL3RyYW5zLXNlbmRlci5qc1xuLypcbiAqICoqKioqIEJFR0lOIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqIENvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuICpcbiAqIEZvciB0aGUgbGljZW5zZSBzZWUgQ09QWUlORy5cbiAqICoqKioqIEVORCBMSUNFTlNFIEJMT0NLICoqKioqXG4gKi9cblxudmFyIEJ1ZmZlcmVkU2VuZGVyID0gZnVuY3Rpb24oKSB7fTtcbkJ1ZmZlcmVkU2VuZGVyLnByb3RvdHlwZS5zZW5kX2NvbnN0cnVjdG9yID0gZnVuY3Rpb24oc2VuZGVyKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHRoYXQuc2VuZF9idWZmZXIgPSBbXTtcbiAgICB0aGF0LnNlbmRlciA9IHNlbmRlcjtcbn07XG5CdWZmZXJlZFNlbmRlci5wcm90b3R5cGUuZG9TZW5kID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB0aGF0LnNlbmRfYnVmZmVyLnB1c2gobWVzc2FnZSk7XG4gICAgaWYgKCF0aGF0LnNlbmRfc3RvcCkge1xuICAgICAgICB0aGF0LnNlbmRfc2NoZWR1bGUoKTtcbiAgICB9XG59O1xuXG4vLyBGb3IgcG9sbGluZyB0cmFuc3BvcnRzIGluIGEgc2l0dWF0aW9uIHdoZW4gaW4gdGhlIG1lc3NhZ2UgY2FsbGJhY2ssXG4vLyBuZXcgbWVzc2FnZSBpcyBiZWluZyBzZW5kLiBJZiB0aGUgc2VuZGluZyBjb25uZWN0aW9uIHdhcyBzdGFydGVkXG4vLyBiZWZvcmUgcmVjZWl2aW5nIG9uZSwgaXQgaXMgcG9zc2libGUgdG8gc2F0dXJhdGUgdGhlIG5ldHdvcmsgYW5kXG4vLyB0aW1lb3V0IGR1ZSB0byB0aGUgbGFjayBvZiByZWNlaXZpbmcgc29ja2V0LiBUbyBhdm9pZCB0aGF0IHdlIGRlbGF5XG4vLyBzZW5kaW5nIG1lc3NhZ2VzIGJ5IHNvbWUgc21hbGwgdGltZSwgaW4gb3JkZXIgdG8gbGV0IHJlY2VpdmluZ1xuLy8gY29ubmVjdGlvbiBiZSBzdGFydGVkIGJlZm9yZWhhbmQuIFRoaXMgaXMgb25seSBhIGhhbGZtZWFzdXJlIGFuZFxuLy8gZG9lcyBub3QgZml4IHRoZSBiaWcgcHJvYmxlbSwgYnV0IGl0IGRvZXMgbWFrZSB0aGUgdGVzdHMgZ28gbW9yZVxuLy8gc3RhYmxlIG9uIHNsb3cgbmV0d29ya3MuXG5CdWZmZXJlZFNlbmRlci5wcm90b3R5cGUuc2VuZF9zY2hlZHVsZV93YWl0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHZhciB0cmVmO1xuICAgIHRoYXQuc2VuZF9zdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoYXQuc2VuZF9zdG9wID0gbnVsbDtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRyZWYpO1xuICAgIH07XG4gICAgdHJlZiA9IHV0aWxzLmRlbGF5KDI1LCBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhhdC5zZW5kX3N0b3AgPSBudWxsO1xuICAgICAgICB0aGF0LnNlbmRfc2NoZWR1bGUoKTtcbiAgICB9KTtcbn07XG5cbkJ1ZmZlcmVkU2VuZGVyLnByb3RvdHlwZS5zZW5kX3NjaGVkdWxlID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIGlmICh0aGF0LnNlbmRfYnVmZmVyLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdmFyIHBheWxvYWQgPSAnWycgKyB0aGF0LnNlbmRfYnVmZmVyLmpvaW4oJywnKSArICddJztcbiAgICAgICAgdGhhdC5zZW5kX3N0b3AgPSB0aGF0LnNlbmRlcih0aGF0LnRyYW5zX3VybCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXlsb2FkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnNlbmRfc3RvcCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQuc2VuZF9zY2hlZHVsZV93YWl0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIHRoYXQuc2VuZF9idWZmZXIgPSBbXTtcbiAgICB9XG59O1xuXG5CdWZmZXJlZFNlbmRlci5wcm90b3R5cGUuc2VuZF9kZXN0cnVjdG9yID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIGlmICh0aGF0Ll9zZW5kX3N0b3ApIHtcbiAgICAgICAgdGhhdC5fc2VuZF9zdG9wKCk7XG4gICAgfVxuICAgIHRoYXQuX3NlbmRfc3RvcCA9IG51bGw7XG59O1xuXG52YXIganNvblBHZW5lcmljU2VuZGVyID0gZnVuY3Rpb24odXJsLCBwYXlsb2FkLCBjYWxsYmFjaykge1xuICAgIHZhciB0aGF0ID0gdGhpcztcblxuICAgIGlmICghKCdfc2VuZF9mb3JtJyBpbiB0aGF0KSkge1xuICAgICAgICB2YXIgZm9ybSA9IHRoYXQuX3NlbmRfZm9ybSA9IF9kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdmb3JtJyk7XG4gICAgICAgIHZhciBhcmVhID0gdGhhdC5fc2VuZF9hcmVhID0gX2RvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RleHRhcmVhJyk7XG4gICAgICAgIGFyZWEubmFtZSA9ICdkJztcbiAgICAgICAgZm9ybS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBmb3JtLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgZm9ybS5tZXRob2QgPSAnUE9TVCc7XG4gICAgICAgIGZvcm0uZW5jdHlwZSA9ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnO1xuICAgICAgICBmb3JtLmFjY2VwdENoYXJzZXQgPSBcIlVURi04XCI7XG4gICAgICAgIGZvcm0uYXBwZW5kQ2hpbGQoYXJlYSk7XG4gICAgICAgIF9kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGZvcm0pO1xuICAgIH1cbiAgICB2YXIgZm9ybSA9IHRoYXQuX3NlbmRfZm9ybTtcbiAgICB2YXIgYXJlYSA9IHRoYXQuX3NlbmRfYXJlYTtcbiAgICB2YXIgaWQgPSAnYScgKyB1dGlscy5yYW5kb21fc3RyaW5nKDgpO1xuICAgIGZvcm0udGFyZ2V0ID0gaWQ7XG4gICAgZm9ybS5hY3Rpb24gPSB1cmwgKyAnL2pzb25wX3NlbmQ/aT0nICsgaWQ7XG5cbiAgICB2YXIgaWZyYW1lO1xuICAgIHRyeSB7XG4gICAgICAgIC8vIGllNiBkeW5hbWljIGlmcmFtZXMgd2l0aCB0YXJnZXQ9XCJcIiBzdXBwb3J0ICh0aGFua3MgQ2hyaXMgTGFtYmFjaGVyKVxuICAgICAgICBpZnJhbWUgPSBfZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnPGlmcmFtZSBuYW1lPVwiJysgaWQgKydcIj4nKTtcbiAgICB9IGNhdGNoKHgpIHtcbiAgICAgICAgaWZyYW1lID0gX2RvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lmcmFtZScpO1xuICAgICAgICBpZnJhbWUubmFtZSA9IGlkO1xuICAgIH1cbiAgICBpZnJhbWUuaWQgPSBpZDtcbiAgICBmb3JtLmFwcGVuZENoaWxkKGlmcmFtZSk7XG4gICAgaWZyYW1lLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICB0cnkge1xuICAgICAgICBhcmVhLnZhbHVlID0gcGF5bG9hZDtcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgdXRpbHMubG9nKCdZb3VyIGJyb3dzZXIgaXMgc2VyaW91c2x5IGJyb2tlbi4gR28gaG9tZSEgJyArIGUubWVzc2FnZSk7XG4gICAgfVxuICAgIGZvcm0uc3VibWl0KCk7XG5cbiAgICB2YXIgY29tcGxldGVkID0gZnVuY3Rpb24oZSkge1xuICAgICAgICBpZiAoIWlmcmFtZS5vbmVycm9yKSByZXR1cm47XG4gICAgICAgIGlmcmFtZS5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBpZnJhbWUub25lcnJvciA9IGlmcmFtZS5vbmxvYWQgPSBudWxsO1xuICAgICAgICAvLyBPcGVyYSBtaW5pIGRvZXNuJ3QgbGlrZSBpZiB3ZSBHQyBpZnJhbWVcbiAgICAgICAgLy8gaW1tZWRpYXRlbHksIHRodXMgdGhpcyB0aW1lb3V0LlxuICAgICAgICB1dGlscy5kZWxheSg1MDAsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICBpZnJhbWUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChpZnJhbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICBpZnJhbWUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICBhcmVhLnZhbHVlID0gJyc7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgfTtcbiAgICBpZnJhbWUub25lcnJvciA9IGlmcmFtZS5vbmxvYWQgPSBjb21wbGV0ZWQ7XG4gICAgaWZyYW1lLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKGlmcmFtZS5yZWFkeVN0YXRlID09ICdjb21wbGV0ZScpIGNvbXBsZXRlZCgpO1xuICAgIH07XG4gICAgcmV0dXJuIGNvbXBsZXRlZDtcbn07XG5cbnZhciBjcmVhdGVBamF4U2VuZGVyID0gZnVuY3Rpb24oQWpheE9iamVjdCkge1xuICAgIHJldHVybiBmdW5jdGlvbih1cmwsIHBheWxvYWQsIGNhbGxiYWNrKSB7XG4gICAgICAgIHZhciB4byA9IG5ldyBBamF4T2JqZWN0KCdQT1NUJywgdXJsICsgJy94aHJfc2VuZCcsIHBheWxvYWQpO1xuICAgICAgICB4by5vbmZpbmlzaCA9IGZ1bmN0aW9uKHN0YXR1cywgdGV4dCkge1xuICAgICAgICAgICAgY2FsbGJhY2soc3RhdHVzKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKGFib3J0X3JlYXNvbikge1xuICAgICAgICAgICAgY2FsbGJhY2soMCwgYWJvcnRfcmVhc29uKTtcbiAgICAgICAgfTtcbiAgICB9O1xufTtcbi8vICAgICAgICAgWypdIEVuZCBvZiBsaWIvdHJhbnMtc2VuZGVyLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi90cmFucy1qc29ucC1yZWNlaXZlci5qc1xuLypcbiAqICoqKioqIEJFR0lOIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqIENvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuICpcbiAqIEZvciB0aGUgbGljZW5zZSBzZWUgQ09QWUlORy5cbiAqICoqKioqIEVORCBMSUNFTlNFIEJMT0NLICoqKioqXG4gKi9cblxuLy8gUGFydHMgZGVyaXZlZCBmcm9tIFNvY2tldC5pbzpcbi8vICAgIGh0dHBzOi8vZ2l0aHViLmNvbS9MZWFybkJvb3N0L3NvY2tldC5pby9ibG9iLzAuNi4xNy9saWIvc29ja2V0LmlvL3RyYW5zcG9ydHMvanNvbnAtcG9sbGluZy5qc1xuLy8gYW5kIGpRdWVyeS1KU09OUDpcbi8vICAgIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvanF1ZXJ5LWpzb25wL3NvdXJjZS9icm93c2UvdHJ1bmsvY29yZS9qcXVlcnkuanNvbnAuanNcbnZhciBqc29uUEdlbmVyaWNSZWNlaXZlciA9IGZ1bmN0aW9uKHVybCwgY2FsbGJhY2spIHtcbiAgICB2YXIgdHJlZjtcbiAgICB2YXIgc2NyaXB0ID0gX2RvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICAgIHZhciBzY3JpcHQyOyAgLy8gT3BlcmEgc3luY2hyb25vdXMgbG9hZCB0cmljay5cbiAgICB2YXIgY2xvc2Vfc2NyaXB0ID0gZnVuY3Rpb24oZnJhbWUpIHtcbiAgICAgICAgaWYgKHNjcmlwdDIpIHtcbiAgICAgICAgICAgIHNjcmlwdDIucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChzY3JpcHQyKTtcbiAgICAgICAgICAgIHNjcmlwdDIgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzY3JpcHQpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0cmVmKTtcbiAgICAgICAgICAgIHNjcmlwdC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHNjcmlwdCk7XG4gICAgICAgICAgICBzY3JpcHQub25yZWFkeXN0YXRlY2hhbmdlID0gc2NyaXB0Lm9uZXJyb3IgPVxuICAgICAgICAgICAgICAgIHNjcmlwdC5vbmxvYWQgPSBzY3JpcHQub25jbGljayA9IG51bGw7XG4gICAgICAgICAgICBzY3JpcHQgPSBudWxsO1xuICAgICAgICAgICAgY2FsbGJhY2soZnJhbWUpO1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIElFOSBmaXJlcyAnZXJyb3InIGV2ZW50IGFmdGVyIG9yc2Mgb3IgYmVmb3JlLCBpbiByYW5kb20gb3JkZXIuXG4gICAgdmFyIGxvYWRlZF9va2F5ID0gZmFsc2U7XG4gICAgdmFyIGVycm9yX3RpbWVyID0gbnVsbDtcblxuICAgIHNjcmlwdC5pZCA9ICdhJyArIHV0aWxzLnJhbmRvbV9zdHJpbmcoOCk7XG4gICAgc2NyaXB0LnNyYyA9IHVybDtcbiAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnO1xuICAgIHNjcmlwdC5jaGFyc2V0ID0gJ1VURi04JztcbiAgICBzY3JpcHQub25lcnJvciA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKCFlcnJvcl90aW1lcikge1xuICAgICAgICAgICAgLy8gRGVsYXkgZmlyaW5nIGNsb3NlX3NjcmlwdC5cbiAgICAgICAgICAgIGVycm9yX3RpbWVyID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWxvYWRlZF9va2F5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNsb3NlX3NjcmlwdCh1dGlscy5jbG9zZUZyYW1lKFxuICAgICAgICAgICAgICAgICAgICAgICAgMTAwNixcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiSlNPTlAgc2NyaXB0IGxvYWRlZCBhYm5vcm1hbGx5IChvbmVycm9yKVwiKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgMTAwMCk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHNjcmlwdC5vbmxvYWQgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIGNsb3NlX3NjcmlwdCh1dGlscy5jbG9zZUZyYW1lKDEwMDYsIFwiSlNPTlAgc2NyaXB0IGxvYWRlZCBhYm5vcm1hbGx5IChvbmxvYWQpXCIpKTtcbiAgICB9O1xuXG4gICAgc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYgKC9sb2FkZWR8Y2xvc2VkLy50ZXN0KHNjcmlwdC5yZWFkeVN0YXRlKSkge1xuICAgICAgICAgICAgaWYgKHNjcmlwdCAmJiBzY3JpcHQuaHRtbEZvciAmJiBzY3JpcHQub25jbGljaykge1xuICAgICAgICAgICAgICAgIGxvYWRlZF9va2F5ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAvLyBJbiBJRSwgYWN0dWFsbHkgZXhlY3V0ZSB0aGUgc2NyaXB0LlxuICAgICAgICAgICAgICAgICAgICBzY3JpcHQub25jbGljaygpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKHgpIHt9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2NyaXB0KSB7XG4gICAgICAgICAgICAgICAgY2xvc2Vfc2NyaXB0KHV0aWxzLmNsb3NlRnJhbWUoMTAwNiwgXCJKU09OUCBzY3JpcHQgbG9hZGVkIGFibm9ybWFsbHkgKG9ucmVhZHlzdGF0ZWNoYW5nZSlcIikpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcbiAgICAvLyBJRTogZXZlbnQvaHRtbEZvci9vbmNsaWNrIHRyaWNrLlxuICAgIC8vIE9uZSBjYW4ndCByZWx5IG9uIHByb3BlciBvcmRlciBmb3Igb25yZWFkeXN0YXRlY2hhbmdlLiBJbiBvcmRlciB0b1xuICAgIC8vIG1ha2Ugc3VyZSwgc2V0IGEgJ2h0bWxGb3InIGFuZCAnZXZlbnQnIHByb3BlcnRpZXMsIHNvIHRoYXRcbiAgICAvLyBzY3JpcHQgY29kZSB3aWxsIGJlIGluc3RhbGxlZCBhcyAnb25jbGljaycgaGFuZGxlciBmb3IgdGhlXG4gICAgLy8gc2NyaXB0IG9iamVjdC4gTGF0ZXIsIG9ucmVhZHlzdGF0ZWNoYW5nZSwgbWFudWFsbHkgZXhlY3V0ZSB0aGlzXG4gICAgLy8gY29kZS4gRkYgYW5kIENocm9tZSBkb2Vzbid0IHdvcmsgd2l0aCAnZXZlbnQnIGFuZCAnaHRtbEZvcidcbiAgICAvLyBzZXQuIEZvciByZWZlcmVuY2Ugc2VlOlxuICAgIC8vICAgaHR0cDovL2phdWJvdXJnLm5ldC8yMDEwLzA3L2xvYWRpbmctc2NyaXB0LWFzLW9uY2xpY2staGFuZGxlci1vZi5odG1sXG4gICAgLy8gQWxzbywgcmVhZCBvbiB0aGF0IGFib3V0IHNjcmlwdCBvcmRlcmluZzpcbiAgICAvLyAgIGh0dHA6Ly93aWtpLndoYXR3Zy5vcmcvd2lraS9EeW5hbWljX1NjcmlwdF9FeGVjdXRpb25fT3JkZXJcbiAgICBpZiAodHlwZW9mIHNjcmlwdC5hc3luYyA9PT0gJ3VuZGVmaW5lZCcgJiYgX2RvY3VtZW50LmF0dGFjaEV2ZW50KSB7XG4gICAgICAgIC8vIEFjY29yZGluZyB0byBtb3ppbGxhIGRvY3MsIGluIHJlY2VudCBicm93c2VycyBzY3JpcHQuYXN5bmMgZGVmYXVsdHNcbiAgICAgICAgLy8gdG8gJ3RydWUnLCBzbyB3ZSBtYXkgdXNlIGl0IHRvIGRldGVjdCBhIGdvb2QgYnJvd3NlcjpcbiAgICAgICAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vSFRNTC9FbGVtZW50L3NjcmlwdFxuICAgICAgICBpZiAoIS9vcGVyYS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCkpIHtcbiAgICAgICAgICAgIC8vIE5haXZlbHkgYXNzdW1lIHdlJ3JlIGluIElFXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHNjcmlwdC5odG1sRm9yID0gc2NyaXB0LmlkO1xuICAgICAgICAgICAgICAgIHNjcmlwdC5ldmVudCA9IFwib25jbGlja1wiO1xuICAgICAgICAgICAgfSBjYXRjaCAoeCkge31cbiAgICAgICAgICAgIHNjcmlwdC5hc3luYyA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBPcGVyYSwgc2Vjb25kIHN5bmMgc2NyaXB0IGhhY2tcbiAgICAgICAgICAgIHNjcmlwdDIgPSBfZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG4gICAgICAgICAgICBzY3JpcHQyLnRleHQgPSBcInRyeXt2YXIgYSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdcIitzY3JpcHQuaWQrXCInKTsgaWYoYSlhLm9uZXJyb3IoKTt9Y2F0Y2goeCl7fTtcIjtcbiAgICAgICAgICAgIHNjcmlwdC5hc3luYyA9IHNjcmlwdDIuYXN5bmMgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAodHlwZW9mIHNjcmlwdC5hc3luYyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgc2NyaXB0LmFzeW5jID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBGYWxsYmFjayBtb3N0bHkgZm9yIEtvbnF1ZXJvciAtIHN0dXBpZCB0aW1lciwgMzUgc2Vjb25kcyBzaGFsbCBiZSBwbGVudHkuXG4gICAgdHJlZiA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsb3NlX3NjcmlwdCh1dGlscy5jbG9zZUZyYW1lKDEwMDYsIFwiSlNPTlAgc2NyaXB0IGxvYWRlZCBhYm5vcm1hbGx5ICh0aW1lb3V0KVwiKSk7XG4gICAgICAgICAgICAgICAgICAgICAgfSwgMzUwMDApO1xuXG4gICAgdmFyIGhlYWQgPSBfZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTtcbiAgICBoZWFkLmluc2VydEJlZm9yZShzY3JpcHQsIGhlYWQuZmlyc3RDaGlsZCk7XG4gICAgaWYgKHNjcmlwdDIpIHtcbiAgICAgICAgaGVhZC5pbnNlcnRCZWZvcmUoc2NyaXB0MiwgaGVhZC5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgcmV0dXJuIGNsb3NlX3NjcmlwdDtcbn07XG4vLyAgICAgICAgIFsqXSBFbmQgb2YgbGliL3RyYW5zLWpzb25wLXJlY2VpdmVyLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi90cmFucy1qc29ucC1wb2xsaW5nLmpzXG4vKlxuICogKioqKiogQkVHSU4gTElDRU5TRSBCTE9DSyAqKioqKlxuICogQ29weXJpZ2h0IChjKSAyMDExLTIwMTIgVk13YXJlLCBJbmMuXG4gKlxuICogRm9yIHRoZSBsaWNlbnNlIHNlZSBDT1BZSU5HLlxuICogKioqKiogRU5EIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqL1xuXG4vLyBUaGUgc2ltcGxlc3QgYW5kIG1vc3Qgcm9idXN0IHRyYW5zcG9ydCwgdXNpbmcgdGhlIHdlbGwta25vdyBjcm9zc1xuLy8gZG9tYWluIGhhY2sgLSBKU09OUC4gVGhpcyB0cmFuc3BvcnQgaXMgcXVpdGUgaW5lZmZpY2llbnQgLSBvbmVcbi8vIG1zc2FnZSBjb3VsZCB1c2UgdXAgdG8gb25lIGh0dHAgcmVxdWVzdC4gQnV0IGF0IGxlYXN0IGl0IHdvcmtzIGFsbW9zdFxuLy8gZXZlcnl3aGVyZS5cbi8vIEtub3duIGxpbWl0YXRpb25zOlxuLy8gICBvIHlvdSB3aWxsIGdldCBhIHNwaW5uaW5nIGN1cnNvclxuLy8gICBvIGZvciBLb25xdWVyb3IgYSBkdW1iIHRpbWVyIGlzIG5lZWRlZCB0byBkZXRlY3QgZXJyb3JzXG5cblxudmFyIEpzb25QVHJhbnNwb3J0ID0gU29ja0pTWydqc29ucC1wb2xsaW5nJ10gPSBmdW5jdGlvbihyaSwgdHJhbnNfdXJsKSB7XG4gICAgdXRpbHMucG9sbHV0ZUdsb2JhbE5hbWVzcGFjZSgpO1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB0aGF0LnJpID0gcmk7XG4gICAgdGhhdC50cmFuc191cmwgPSB0cmFuc191cmw7XG4gICAgdGhhdC5zZW5kX2NvbnN0cnVjdG9yKGpzb25QR2VuZXJpY1NlbmRlcik7XG4gICAgdGhhdC5fc2NoZWR1bGVfcmVjdigpO1xufTtcblxuLy8gSW5oZXJpdG5hY2Vcbkpzb25QVHJhbnNwb3J0LnByb3RvdHlwZSA9IG5ldyBCdWZmZXJlZFNlbmRlcigpO1xuXG5Kc29uUFRyYW5zcG9ydC5wcm90b3R5cGUuX3NjaGVkdWxlX3JlY3YgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdmFyIGNhbGxiYWNrID0gZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICB0aGF0Ll9yZWN2X3N0b3AgPSBudWxsO1xuICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgLy8gbm8gZGF0YSAtIGhlYXJ0YmVhdDtcbiAgICAgICAgICAgIGlmICghdGhhdC5faXNfY2xvc2luZykge1xuICAgICAgICAgICAgICAgIHRoYXQucmkuX2RpZE1lc3NhZ2UoZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gVGhlIG1lc3NhZ2UgY2FuIGJlIGEgY2xvc2UgbWVzc2FnZSwgYW5kIGNoYW5nZSBpc19jbG9zaW5nIHN0YXRlLlxuICAgICAgICBpZiAoIXRoYXQuX2lzX2Nsb3NpbmcpIHtcbiAgICAgICAgICAgIHRoYXQuX3NjaGVkdWxlX3JlY3YoKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgdGhhdC5fcmVjdl9zdG9wID0ganNvblBSZWNlaXZlcldyYXBwZXIodGhhdC50cmFuc191cmwgKyAnL2pzb25wJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBqc29uUEdlbmVyaWNSZWNlaXZlciwgY2FsbGJhY2spO1xufTtcblxuSnNvblBUcmFuc3BvcnQuZW5hYmxlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0cnVlO1xufTtcblxuSnNvblBUcmFuc3BvcnQubmVlZF9ib2R5ID0gdHJ1ZTtcblxuXG5Kc29uUFRyYW5zcG9ydC5wcm90b3R5cGUuZG9DbGVhbnVwID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHRoYXQuX2lzX2Nsb3NpbmcgPSB0cnVlO1xuICAgIGlmICh0aGF0Ll9yZWN2X3N0b3ApIHtcbiAgICAgICAgdGhhdC5fcmVjdl9zdG9wKCk7XG4gICAgfVxuICAgIHRoYXQucmkgPSB0aGF0Ll9yZWN2X3N0b3AgPSBudWxsO1xuICAgIHRoYXQuc2VuZF9kZXN0cnVjdG9yKCk7XG59O1xuXG5cbi8vIEFic3RyYWN0IGF3YXkgY29kZSB0aGF0IGhhbmRsZXMgZ2xvYmFsIG5hbWVzcGFjZSBwb2xsdXRpb24uXG52YXIganNvblBSZWNlaXZlcldyYXBwZXIgPSBmdW5jdGlvbih1cmwsIGNvbnN0cnVjdFJlY2VpdmVyLCB1c2VyX2NhbGxiYWNrKSB7XG4gICAgdmFyIGlkID0gJ2EnICsgdXRpbHMucmFuZG9tX3N0cmluZyg2KTtcbiAgICB2YXIgdXJsX2lkID0gdXJsICsgJz9jPScgKyBlc2NhcGUoV1ByZWZpeCArICcuJyArIGlkKTtcbiAgICAvLyBDYWxsYmFjayB3aWxsIGJlIGNhbGxlZCBleGFjdGx5IG9uY2UuXG4gICAgdmFyIGNhbGxiYWNrID0gZnVuY3Rpb24oZnJhbWUpIHtcbiAgICAgICAgZGVsZXRlIF93aW5kb3dbV1ByZWZpeF1baWRdO1xuICAgICAgICB1c2VyX2NhbGxiYWNrKGZyYW1lKTtcbiAgICB9O1xuXG4gICAgdmFyIGNsb3NlX3NjcmlwdCA9IGNvbnN0cnVjdFJlY2VpdmVyKHVybF9pZCwgY2FsbGJhY2spO1xuICAgIF93aW5kb3dbV1ByZWZpeF1baWRdID0gY2xvc2Vfc2NyaXB0O1xuICAgIHZhciBzdG9wID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChfd2luZG93W1dQcmVmaXhdW2lkXSkge1xuICAgICAgICAgICAgX3dpbmRvd1tXUHJlZml4XVtpZF0odXRpbHMuY2xvc2VGcmFtZSgxMDAwLCBcIkpTT05QIHVzZXIgYWJvcnRlZCByZWFkXCIpKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIHN0b3A7XG59O1xuLy8gICAgICAgICBbKl0gRW5kIG9mIGxpYi90cmFucy1qc29ucC1wb2xsaW5nLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi90cmFucy14aHIuanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbnZhciBBamF4QmFzZWRUcmFuc3BvcnQgPSBmdW5jdGlvbigpIHt9O1xuQWpheEJhc2VkVHJhbnNwb3J0LnByb3RvdHlwZSA9IG5ldyBCdWZmZXJlZFNlbmRlcigpO1xuXG5BamF4QmFzZWRUcmFuc3BvcnQucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKHJpLCB0cmFuc191cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybF9zdWZmaXgsIFJlY2VpdmVyLCBBamF4T2JqZWN0KSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHRoYXQucmkgPSByaTtcbiAgICB0aGF0LnRyYW5zX3VybCA9IHRyYW5zX3VybDtcbiAgICB0aGF0LnNlbmRfY29uc3RydWN0b3IoY3JlYXRlQWpheFNlbmRlcihBamF4T2JqZWN0KSk7XG4gICAgdGhhdC5wb2xsID0gbmV3IFBvbGxpbmcocmksIFJlY2VpdmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyYW5zX3VybCArIHVybF9zdWZmaXgsIEFqYXhPYmplY3QpO1xufTtcblxuQWpheEJhc2VkVHJhbnNwb3J0LnByb3RvdHlwZS5kb0NsZWFudXAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgaWYgKHRoYXQucG9sbCkge1xuICAgICAgICB0aGF0LnBvbGwuYWJvcnQoKTtcbiAgICAgICAgdGhhdC5wb2xsID0gbnVsbDtcbiAgICB9XG59O1xuXG4vLyB4aHItc3RyZWFtaW5nXG52YXIgWGhyU3RyZWFtaW5nVHJhbnNwb3J0ID0gU29ja0pTWyd4aHItc3RyZWFtaW5nJ10gPSBmdW5jdGlvbihyaSwgdHJhbnNfdXJsKSB7XG4gICAgdGhpcy5ydW4ocmksIHRyYW5zX3VybCwgJy94aHJfc3RyZWFtaW5nJywgWGhyUmVjZWl2ZXIsIHV0aWxzLlhIUkNvcnNPYmplY3QpO1xufTtcblxuWGhyU3RyZWFtaW5nVHJhbnNwb3J0LnByb3RvdHlwZSA9IG5ldyBBamF4QmFzZWRUcmFuc3BvcnQoKTtcblxuWGhyU3RyZWFtaW5nVHJhbnNwb3J0LmVuYWJsZWQgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBTdXBwb3J0IGZvciBDT1JTIEFqYXggYWthIEFqYXgyPyBPcGVyYSAxMiBjbGFpbXMgQ09SUyBidXRcbiAgICAvLyBkb2Vzbid0IGRvIHN0cmVhbWluZy5cbiAgICByZXR1cm4gKF93aW5kb3cuWE1MSHR0cFJlcXVlc3QgJiZcbiAgICAgICAgICAgICd3aXRoQ3JlZGVudGlhbHMnIGluIG5ldyBYTUxIdHRwUmVxdWVzdCgpICYmXG4gICAgICAgICAgICAoIS9vcGVyYS9pLnRlc3QobmF2aWdhdG9yLnVzZXJBZ2VudCkpKTtcbn07XG5YaHJTdHJlYW1pbmdUcmFuc3BvcnQucm91bmRUcmlwcyA9IDI7IC8vIHByZWZsaWdodCwgYWpheFxuXG4vLyBTYWZhcmkgZ2V0cyBjb25mdXNlZCB3aGVuIGEgc3RyZWFtaW5nIGFqYXggcmVxdWVzdCBpcyBzdGFydGVkXG4vLyBiZWZvcmUgb25sb2FkLiBUaGlzIGNhdXNlcyB0aGUgbG9hZCBpbmRpY2F0b3IgdG8gc3BpbiBpbmRlZmluZXRlbHkuXG5YaHJTdHJlYW1pbmdUcmFuc3BvcnQubmVlZF9ib2R5ID0gdHJ1ZTtcblxuXG4vLyBBY2NvcmRpbmcgdG86XG4vLyAgIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMTY0MTUwNy9kZXRlY3QtYnJvd3Nlci1zdXBwb3J0LWZvci1jcm9zcy1kb21haW4teG1saHR0cHJlcXVlc3RzXG4vLyAgIGh0dHA6Ly9oYWNrcy5tb3ppbGxhLm9yZy8yMDA5LzA3L2Nyb3NzLXNpdGUteG1saHR0cHJlcXVlc3Qtd2l0aC1jb3JzL1xuXG5cbi8vIHhkci1zdHJlYW1pbmdcbnZhciBYZHJTdHJlYW1pbmdUcmFuc3BvcnQgPSBTb2NrSlNbJ3hkci1zdHJlYW1pbmcnXSA9IGZ1bmN0aW9uKHJpLCB0cmFuc191cmwpIHtcbiAgICB0aGlzLnJ1bihyaSwgdHJhbnNfdXJsLCAnL3hocl9zdHJlYW1pbmcnLCBYaHJSZWNlaXZlciwgdXRpbHMuWERST2JqZWN0KTtcbn07XG5cblhkclN0cmVhbWluZ1RyYW5zcG9ydC5wcm90b3R5cGUgPSBuZXcgQWpheEJhc2VkVHJhbnNwb3J0KCk7XG5cblhkclN0cmVhbWluZ1RyYW5zcG9ydC5lbmFibGVkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICEhX3dpbmRvdy5YRG9tYWluUmVxdWVzdDtcbn07XG5YZHJTdHJlYW1pbmdUcmFuc3BvcnQucm91bmRUcmlwcyA9IDI7IC8vIHByZWZsaWdodCwgYWpheFxuXG5cblxuLy8geGhyLXBvbGxpbmdcbnZhciBYaHJQb2xsaW5nVHJhbnNwb3J0ID0gU29ja0pTWyd4aHItcG9sbGluZyddID0gZnVuY3Rpb24ocmksIHRyYW5zX3VybCkge1xuICAgIHRoaXMucnVuKHJpLCB0cmFuc191cmwsICcveGhyJywgWGhyUmVjZWl2ZXIsIHV0aWxzLlhIUkNvcnNPYmplY3QpO1xufTtcblxuWGhyUG9sbGluZ1RyYW5zcG9ydC5wcm90b3R5cGUgPSBuZXcgQWpheEJhc2VkVHJhbnNwb3J0KCk7XG5cblhoclBvbGxpbmdUcmFuc3BvcnQuZW5hYmxlZCA9IFhoclN0cmVhbWluZ1RyYW5zcG9ydC5lbmFibGVkO1xuWGhyUG9sbGluZ1RyYW5zcG9ydC5yb3VuZFRyaXBzID0gMjsgLy8gcHJlZmxpZ2h0LCBhamF4XG5cblxuLy8geGRyLXBvbGxpbmdcbnZhciBYZHJQb2xsaW5nVHJhbnNwb3J0ID0gU29ja0pTWyd4ZHItcG9sbGluZyddID0gZnVuY3Rpb24ocmksIHRyYW5zX3VybCkge1xuICAgIHRoaXMucnVuKHJpLCB0cmFuc191cmwsICcveGhyJywgWGhyUmVjZWl2ZXIsIHV0aWxzLlhEUk9iamVjdCk7XG59O1xuXG5YZHJQb2xsaW5nVHJhbnNwb3J0LnByb3RvdHlwZSA9IG5ldyBBamF4QmFzZWRUcmFuc3BvcnQoKTtcblxuWGRyUG9sbGluZ1RyYW5zcG9ydC5lbmFibGVkID0gWGRyU3RyZWFtaW5nVHJhbnNwb3J0LmVuYWJsZWQ7XG5YZHJQb2xsaW5nVHJhbnNwb3J0LnJvdW5kVHJpcHMgPSAyOyAvLyBwcmVmbGlnaHQsIGFqYXhcbi8vICAgICAgICAgWypdIEVuZCBvZiBsaWIvdHJhbnMteGhyLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi90cmFucy1pZnJhbWUuanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbi8vIEZldyBjb29sIHRyYW5zcG9ydHMgZG8gd29yayBvbmx5IGZvciBzYW1lLW9yaWdpbi4gSW4gb3JkZXIgdG8gbWFrZVxuLy8gdGhlbSB3b3JraW5nIGNyb3NzLWRvbWFpbiB3ZSBzaGFsbCB1c2UgaWZyYW1lLCBzZXJ2ZWQgZm9ybSB0aGVcbi8vIHJlbW90ZSBkb21haW4uIE5ldyBicm93c2VycywgaGF2ZSBjYXBhYmlsaXRpZXMgdG8gY29tbXVuaWNhdGUgd2l0aFxuLy8gY3Jvc3MgZG9tYWluIGlmcmFtZSwgdXNpbmcgcG9zdE1lc3NhZ2UoKS4gSW4gSUUgaXQgd2FzIGltcGxlbWVudGVkXG4vLyBmcm9tIElFIDgrLCBidXQgb2YgY291cnNlLCBJRSBnb3Qgc29tZSBkZXRhaWxzIHdyb25nOlxuLy8gICAgaHR0cDovL21zZG4ubWljcm9zb2Z0LmNvbS9lbi11cy9saWJyYXJ5L2NjMTk3MDE1KHY9VlMuODUpLmFzcHhcbi8vICAgIGh0dHA6Ly9zdGV2ZXNvdWRlcnMuY29tL21pc2MvdGVzdC1wb3N0bWVzc2FnZS5waHBcblxudmFyIElmcmFtZVRyYW5zcG9ydCA9IGZ1bmN0aW9uKCkge307XG5cbklmcmFtZVRyYW5zcG9ydC5wcm90b3R5cGUuaV9jb25zdHJ1Y3RvciA9IGZ1bmN0aW9uKHJpLCB0cmFuc191cmwsIGJhc2VfdXJsKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHRoYXQucmkgPSByaTtcbiAgICB0aGF0Lm9yaWdpbiA9IHV0aWxzLmdldE9yaWdpbihiYXNlX3VybCk7XG4gICAgdGhhdC5iYXNlX3VybCA9IGJhc2VfdXJsO1xuICAgIHRoYXQudHJhbnNfdXJsID0gdHJhbnNfdXJsO1xuXG4gICAgdmFyIGlmcmFtZV91cmwgPSBiYXNlX3VybCArICcvaWZyYW1lLmh0bWwnO1xuICAgIGlmICh0aGF0LnJpLl9vcHRpb25zLmRldmVsKSB7XG4gICAgICAgIGlmcmFtZV91cmwgKz0gJz90PScgKyAoK25ldyBEYXRlKTtcbiAgICB9XG4gICAgdGhhdC53aW5kb3dfaWQgPSB1dGlscy5yYW5kb21fc3RyaW5nKDgpO1xuICAgIGlmcmFtZV91cmwgKz0gJyMnICsgdGhhdC53aW5kb3dfaWQ7XG5cbiAgICB0aGF0LmlmcmFtZU9iaiA9IHV0aWxzLmNyZWF0ZUlmcmFtZShpZnJhbWVfdXJsLCBmdW5jdGlvbihyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucmkuX2RpZENsb3NlKDEwMDYsIFwiVW5hYmxlIHRvIGxvYWQgYW4gaWZyYW1lIChcIiArIHIgKyBcIilcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICB0aGF0Lm9ubWVzc2FnZV9jYiA9IHV0aWxzLmJpbmQodGhhdC5vbm1lc3NhZ2UsIHRoYXQpO1xuICAgIHV0aWxzLmF0dGFjaE1lc3NhZ2UodGhhdC5vbm1lc3NhZ2VfY2IpO1xufTtcblxuSWZyYW1lVHJhbnNwb3J0LnByb3RvdHlwZS5kb0NsZWFudXAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgaWYgKHRoYXQuaWZyYW1lT2JqKSB7XG4gICAgICAgIHV0aWxzLmRldGFjaE1lc3NhZ2UodGhhdC5vbm1lc3NhZ2VfY2IpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB0aGUgaWZyYW1lIGlzIG5vdCBsb2FkZWQsIElFIHJhaXNlcyBhbiBleGNlcHRpb25cbiAgICAgICAgICAgIC8vIG9uICdjb250ZW50V2luZG93Jy5cbiAgICAgICAgICAgIGlmICh0aGF0LmlmcmFtZU9iai5pZnJhbWUuY29udGVudFdpbmRvdykge1xuICAgICAgICAgICAgICAgIHRoYXQucG9zdE1lc3NhZ2UoJ2MnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoeCkge31cbiAgICAgICAgdGhhdC5pZnJhbWVPYmouY2xlYW51cCgpO1xuICAgICAgICB0aGF0LmlmcmFtZU9iaiA9IG51bGw7XG4gICAgICAgIHRoYXQub25tZXNzYWdlX2NiID0gdGhhdC5pZnJhbWVPYmogPSBudWxsO1xuICAgIH1cbn07XG5cbklmcmFtZVRyYW5zcG9ydC5wcm90b3R5cGUub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBpZiAoZS5vcmlnaW4gIT09IHRoYXQub3JpZ2luKSByZXR1cm47XG4gICAgdmFyIHdpbmRvd19pZCA9IGUuZGF0YS5zbGljZSgwLCA4KTtcbiAgICB2YXIgdHlwZSA9IGUuZGF0YS5zbGljZSg4LCA5KTtcbiAgICB2YXIgZGF0YSA9IGUuZGF0YS5zbGljZSg5KTtcblxuICAgIGlmICh3aW5kb3dfaWQgIT09IHRoYXQud2luZG93X2lkKSByZXR1cm47XG5cbiAgICBzd2l0Y2godHlwZSkge1xuICAgIGNhc2UgJ3MnOlxuICAgICAgICB0aGF0LmlmcmFtZU9iai5sb2FkZWQoKTtcbiAgICAgICAgdGhhdC5wb3N0TWVzc2FnZSgncycsIEpTT04uc3RyaW5naWZ5KFtTb2NrSlMudmVyc2lvbiwgdGhhdC5wcm90b2NvbCwgdGhhdC50cmFuc191cmwsIHRoYXQuYmFzZV91cmxdKSk7XG4gICAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ3QnOlxuICAgICAgICB0aGF0LnJpLl9kaWRNZXNzYWdlKGRhdGEpO1xuICAgICAgICBicmVhaztcbiAgICB9XG59O1xuXG5JZnJhbWVUcmFuc3BvcnQucHJvdG90eXBlLnBvc3RNZXNzYWdlID0gZnVuY3Rpb24odHlwZSwgZGF0YSkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB0aGF0LmlmcmFtZU9iai5wb3N0KHRoYXQud2luZG93X2lkICsgdHlwZSArIChkYXRhIHx8ICcnKSwgdGhhdC5vcmlnaW4pO1xufTtcblxuSWZyYW1lVHJhbnNwb3J0LnByb3RvdHlwZS5kb1NlbmQgPSBmdW5jdGlvbiAobWVzc2FnZSkge1xuICAgIHRoaXMucG9zdE1lc3NhZ2UoJ20nLCBtZXNzYWdlKTtcbn07XG5cbklmcmFtZVRyYW5zcG9ydC5lbmFibGVkID0gZnVuY3Rpb24oKSB7XG4gICAgLy8gcG9zdE1lc3NhZ2UgbWlzYmVoYXZlcyBpbiBrb25xdWVyb3IgNC42LjUgLSB0aGUgbWVzc2FnZXMgYXJlIGRlbGl2ZXJlZCB3aXRoXG4gICAgLy8gaHVnZSBkZWxheSwgb3Igbm90IGF0IGFsbC5cbiAgICB2YXIga29ucXVlcm9yID0gbmF2aWdhdG9yICYmIG5hdmlnYXRvci51c2VyQWdlbnQgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudC5pbmRleE9mKCdLb25xdWVyb3InKSAhPT0gLTE7XG4gICAgcmV0dXJuICgodHlwZW9mIF93aW5kb3cucG9zdE1lc3NhZ2UgPT09ICdmdW5jdGlvbicgfHxcbiAgICAgICAgICAgIHR5cGVvZiBfd2luZG93LnBvc3RNZXNzYWdlID09PSAnb2JqZWN0JykgJiYgKCFrb25xdWVyb3IpKTtcbn07XG4vLyAgICAgICAgIFsqXSBFbmQgb2YgbGliL3RyYW5zLWlmcmFtZS5qc1xuXG5cbi8vICAgICAgICAgWypdIEluY2x1ZGluZyBsaWIvdHJhbnMtaWZyYW1lLXdpdGhpbi5qc1xuLypcbiAqICoqKioqIEJFR0lOIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqIENvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuICpcbiAqIEZvciB0aGUgbGljZW5zZSBzZWUgQ09QWUlORy5cbiAqICoqKioqIEVORCBMSUNFTlNFIEJMT0NLICoqKioqXG4gKi9cblxudmFyIGN1cnJfd2luZG93X2lkO1xuXG52YXIgcG9zdE1lc3NhZ2UgPSBmdW5jdGlvbiAodHlwZSwgZGF0YSkge1xuICAgIGlmKHBhcmVudCAhPT0gX3dpbmRvdykge1xuICAgICAgICBwYXJlbnQucG9zdE1lc3NhZ2UoY3Vycl93aW5kb3dfaWQgKyB0eXBlICsgKGRhdGEgfHwgJycpLCAnKicpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHV0aWxzLmxvZyhcIkNhbid0IHBvc3RNZXNzYWdlLCBubyBwYXJlbnQgd2luZG93LlwiLCB0eXBlLCBkYXRhKTtcbiAgICB9XG59O1xuXG52YXIgRmFjYWRlSlMgPSBmdW5jdGlvbigpIHt9O1xuRmFjYWRlSlMucHJvdG90eXBlLl9kaWRDbG9zZSA9IGZ1bmN0aW9uIChjb2RlLCByZWFzb24pIHtcbiAgICBwb3N0TWVzc2FnZSgndCcsIHV0aWxzLmNsb3NlRnJhbWUoY29kZSwgcmVhc29uKSk7XG59O1xuRmFjYWRlSlMucHJvdG90eXBlLl9kaWRNZXNzYWdlID0gZnVuY3Rpb24gKGZyYW1lKSB7XG4gICAgcG9zdE1lc3NhZ2UoJ3QnLCBmcmFtZSk7XG59O1xuRmFjYWRlSlMucHJvdG90eXBlLl9kb1NlbmQgPSBmdW5jdGlvbiAoZGF0YSkge1xuICAgIHRoaXMuX3RyYW5zcG9ydC5kb1NlbmQoZGF0YSk7XG59O1xuRmFjYWRlSlMucHJvdG90eXBlLl9kb0NsZWFudXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5fdHJhbnNwb3J0LmRvQ2xlYW51cCgpO1xufTtcblxudXRpbHMucGFyZW50X29yaWdpbiA9IHVuZGVmaW5lZDtcblxuU29ja0pTLmJvb3RzdHJhcF9pZnJhbWUgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgZmFjYWRlO1xuICAgIGN1cnJfd2luZG93X2lkID0gX2RvY3VtZW50LmxvY2F0aW9uLmhhc2guc2xpY2UoMSk7XG4gICAgdmFyIG9uTWVzc2FnZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgaWYoZS5zb3VyY2UgIT09IHBhcmVudCkgcmV0dXJuO1xuICAgICAgICBpZih0eXBlb2YgdXRpbHMucGFyZW50X29yaWdpbiA9PT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgICAgICB1dGlscy5wYXJlbnRfb3JpZ2luID0gZS5vcmlnaW47XG4gICAgICAgIGlmIChlLm9yaWdpbiAhPT0gdXRpbHMucGFyZW50X29yaWdpbikgcmV0dXJuO1xuXG4gICAgICAgIHZhciB3aW5kb3dfaWQgPSBlLmRhdGEuc2xpY2UoMCwgOCk7XG4gICAgICAgIHZhciB0eXBlID0gZS5kYXRhLnNsaWNlKDgsIDkpO1xuICAgICAgICB2YXIgZGF0YSA9IGUuZGF0YS5zbGljZSg5KTtcbiAgICAgICAgaWYgKHdpbmRvd19pZCAhPT0gY3Vycl93aW5kb3dfaWQpIHJldHVybjtcbiAgICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgY2FzZSAncyc6XG4gICAgICAgICAgICB2YXIgcCA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgICB2YXIgdmVyc2lvbiA9IHBbMF07XG4gICAgICAgICAgICB2YXIgcHJvdG9jb2wgPSBwWzFdO1xuICAgICAgICAgICAgdmFyIHRyYW5zX3VybCA9IHBbMl07XG4gICAgICAgICAgICB2YXIgYmFzZV91cmwgPSBwWzNdO1xuICAgICAgICAgICAgaWYgKHZlcnNpb24gIT09IFNvY2tKUy52ZXJzaW9uKSB7XG4gICAgICAgICAgICAgICAgdXRpbHMubG9nKFwiSW5jb21wYXRpYmlsZSBTb2NrSlMhIE1haW4gc2l0ZSB1c2VzOlwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXCIgXFxcIlwiICsgdmVyc2lvbiArIFwiXFxcIiwgdGhlIGlmcmFtZTpcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiIFxcXCJcIiArIFNvY2tKUy52ZXJzaW9uICsgXCJcXFwiLlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghdXRpbHMuZmxhdFVybCh0cmFuc191cmwpIHx8ICF1dGlscy5mbGF0VXJsKGJhc2VfdXJsKSkge1xuICAgICAgICAgICAgICAgIHV0aWxzLmxvZyhcIk9ubHkgYmFzaWMgdXJscyBhcmUgc3VwcG9ydGVkIGluIFNvY2tKU1wiKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdXRpbHMuaXNTYW1lT3JpZ2luVXJsKHRyYW5zX3VybCkgfHxcbiAgICAgICAgICAgICAgICAhdXRpbHMuaXNTYW1lT3JpZ2luVXJsKGJhc2VfdXJsKSkge1xuICAgICAgICAgICAgICAgIHV0aWxzLmxvZyhcIkNhbid0IGNvbm5lY3QgdG8gZGlmZmVyZW50IGRvbWFpbiBmcm9tIHdpdGhpbiBhbiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFwiaWZyYW1lLiAoXCIgKyBKU09OLnN0cmluZ2lmeShbX3dpbmRvdy5sb2NhdGlvbi5ocmVmLCB0cmFuc191cmwsIGJhc2VfdXJsXSkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcIilcIik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZmFjYWRlID0gbmV3IEZhY2FkZUpTKCk7XG4gICAgICAgICAgICBmYWNhZGUuX3RyYW5zcG9ydCA9IG5ldyBGYWNhZGVKU1twcm90b2NvbF0oZmFjYWRlLCB0cmFuc191cmwsIGJhc2VfdXJsKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdtJzpcbiAgICAgICAgICAgIGZhY2FkZS5fZG9TZW5kKGRhdGEpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2MnOlxuICAgICAgICAgICAgaWYgKGZhY2FkZSlcbiAgICAgICAgICAgICAgICBmYWNhZGUuX2RvQ2xlYW51cCgpO1xuICAgICAgICAgICAgZmFjYWRlID0gbnVsbDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIGFsZXJ0KCd0ZXN0IHRpY2tlcicpO1xuICAgIC8vIGZhY2FkZSA9IG5ldyBGYWNhZGVKUygpO1xuICAgIC8vIGZhY2FkZS5fdHJhbnNwb3J0ID0gbmV3IEZhY2FkZUpTWyd3LWlmcmFtZS14aHItcG9sbGluZyddKGZhY2FkZSwgJ2h0dHA6Ly9ob3N0LmNvbTo5OTk5L3RpY2tlci8xMi9iYXNkJyk7XG5cbiAgICB1dGlscy5hdHRhY2hNZXNzYWdlKG9uTWVzc2FnZSk7XG5cbiAgICAvLyBTdGFydFxuICAgIHBvc3RNZXNzYWdlKCdzJyk7XG59O1xuLy8gICAgICAgICBbKl0gRW5kIG9mIGxpYi90cmFucy1pZnJhbWUtd2l0aGluLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi9pbmZvLmpzXG4vKlxuICogKioqKiogQkVHSU4gTElDRU5TRSBCTE9DSyAqKioqKlxuICogQ29weXJpZ2h0IChjKSAyMDExLTIwMTIgVk13YXJlLCBJbmMuXG4gKlxuICogRm9yIHRoZSBsaWNlbnNlIHNlZSBDT1BZSU5HLlxuICogKioqKiogRU5EIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqL1xuXG52YXIgSW5mb1JlY2VpdmVyID0gZnVuY3Rpb24oYmFzZV91cmwsIEFqYXhPYmplY3QpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdXRpbHMuZGVsYXkoZnVuY3Rpb24oKXt0aGF0LmRvWGhyKGJhc2VfdXJsLCBBamF4T2JqZWN0KTt9KTtcbn07XG5cbkluZm9SZWNlaXZlci5wcm90b3R5cGUgPSBuZXcgRXZlbnRFbWl0dGVyKFsnZmluaXNoJ10pO1xuXG5JbmZvUmVjZWl2ZXIucHJvdG90eXBlLmRvWGhyID0gZnVuY3Rpb24oYmFzZV91cmwsIEFqYXhPYmplY3QpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdmFyIHQwID0gKG5ldyBEYXRlKCkpLmdldFRpbWUoKTtcbiAgICB2YXIgeG8gPSBuZXcgQWpheE9iamVjdCgnR0VUJywgYmFzZV91cmwgKyAnL2luZm8nKTtcblxuICAgIHZhciB0cmVmID0gdXRpbHMuZGVsYXkoODAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uKCl7eG8ub250aW1lb3V0KCk7fSk7XG5cbiAgICB4by5vbmZpbmlzaCA9IGZ1bmN0aW9uKHN0YXR1cywgdGV4dCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodHJlZik7XG4gICAgICAgIHRyZWYgPSBudWxsO1xuICAgICAgICBpZiAoc3RhdHVzID09PSAyMDApIHtcbiAgICAgICAgICAgIHZhciBydHQgPSAobmV3IERhdGUoKSkuZ2V0VGltZSgpIC0gdDA7XG4gICAgICAgICAgICB2YXIgaW5mbyA9IEpTT04ucGFyc2UodGV4dCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGluZm8gIT09ICdvYmplY3QnKSBpbmZvID0ge307XG4gICAgICAgICAgICB0aGF0LmVtaXQoJ2ZpbmlzaCcsIGluZm8sIHJ0dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGF0LmVtaXQoJ2ZpbmlzaCcpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICB4by5vbnRpbWVvdXQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgeG8uY2xvc2UoKTtcbiAgICAgICAgdGhhdC5lbWl0KCdmaW5pc2gnKTtcbiAgICB9O1xufTtcblxudmFyIEluZm9SZWNlaXZlcklmcmFtZSA9IGZ1bmN0aW9uKGJhc2VfdXJsKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHZhciBnbyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgaWZyID0gbmV3IElmcmFtZVRyYW5zcG9ydCgpO1xuICAgICAgICBpZnIucHJvdG9jb2wgPSAndy1pZnJhbWUtaW5mby1yZWNlaXZlcic7XG4gICAgICAgIHZhciBmdW4gPSBmdW5jdGlvbihyKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHIgPT09ICdzdHJpbmcnICYmIHIuc3Vic3RyKDAsMSkgPT09ICdtJykge1xuICAgICAgICAgICAgICAgIHZhciBkID0gSlNPTi5wYXJzZShyLnN1YnN0cigxKSk7XG4gICAgICAgICAgICAgICAgdmFyIGluZm8gPSBkWzBdLCBydHQgPSBkWzFdO1xuICAgICAgICAgICAgICAgIHRoYXQuZW1pdCgnZmluaXNoJywgaW5mbywgcnR0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhhdC5lbWl0KCdmaW5pc2gnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmci5kb0NsZWFudXAoKTtcbiAgICAgICAgICAgIGlmciA9IG51bGw7XG4gICAgICAgIH07XG4gICAgICAgIHZhciBtb2NrX3JpID0ge1xuICAgICAgICAgICAgX29wdGlvbnM6IHt9LFxuICAgICAgICAgICAgX2RpZENsb3NlOiBmdW4sXG4gICAgICAgICAgICBfZGlkTWVzc2FnZTogZnVuXG4gICAgICAgIH07XG4gICAgICAgIGlmci5pX2NvbnN0cnVjdG9yKG1vY2tfcmksIGJhc2VfdXJsLCBiYXNlX3VybCk7XG4gICAgfVxuICAgIGlmKCFfZG9jdW1lbnQuYm9keSkge1xuICAgICAgICB1dGlscy5hdHRhY2hFdmVudCgnbG9hZCcsIGdvKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBnbygpO1xuICAgIH1cbn07XG5JbmZvUmVjZWl2ZXJJZnJhbWUucHJvdG90eXBlID0gbmV3IEV2ZW50RW1pdHRlcihbJ2ZpbmlzaCddKTtcblxuXG52YXIgSW5mb1JlY2VpdmVyRmFrZSA9IGZ1bmN0aW9uKCkge1xuICAgIC8vIEl0IG1heSBub3QgYmUgcG9zc2libGUgdG8gZG8gY3Jvc3MgZG9tYWluIEFKQVggdG8gZ2V0IHRoZSBpbmZvXG4gICAgLy8gZGF0YSwgZm9yIGV4YW1wbGUgZm9yIElFNy4gQnV0IHdlIHdhbnQgdG8gcnVuIEpTT05QLCBzbyBsZXQnc1xuICAgIC8vIGZha2UgdGhlIHJlc3BvbnNlLCB3aXRoIHJ0dD0ycyAocnRvPTZzKS5cbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdXRpbHMuZGVsYXkoZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoYXQuZW1pdCgnZmluaXNoJywge30sIDIwMDApO1xuICAgIH0pO1xufTtcbkluZm9SZWNlaXZlckZha2UucHJvdG90eXBlID0gbmV3IEV2ZW50RW1pdHRlcihbJ2ZpbmlzaCddKTtcblxudmFyIGNyZWF0ZUluZm9SZWNlaXZlciA9IGZ1bmN0aW9uKGJhc2VfdXJsKSB7XG4gICAgaWYgKHV0aWxzLmlzU2FtZU9yaWdpblVybChiYXNlX3VybCkpIHtcbiAgICAgICAgLy8gSWYsIGZvciBzb21lIHJlYXNvbiwgd2UgaGF2ZSBTb2NrSlMgbG9jYWxseSAtIHRoZXJlJ3Mgbm9cbiAgICAgICAgLy8gbmVlZCB0byBzdGFydCB1cCB0aGUgY29tcGxleCBtYWNoaW5lcnkuIEp1c3QgdXNlIGFqYXguXG4gICAgICAgIHJldHVybiBuZXcgSW5mb1JlY2VpdmVyKGJhc2VfdXJsLCB1dGlscy5YSFJMb2NhbE9iamVjdCk7XG4gICAgfVxuICAgIHN3aXRjaCAodXRpbHMuaXNYSFJDb3JzQ2FwYWJsZSgpKSB7XG4gICAgY2FzZSAxOlxuICAgICAgICByZXR1cm4gbmV3IEluZm9SZWNlaXZlcihiYXNlX3VybCwgdXRpbHMuWEhSQ29yc09iamVjdCk7XG4gICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gbmV3IEluZm9SZWNlaXZlcihiYXNlX3VybCwgdXRpbHMuWERST2JqZWN0KTtcbiAgICBjYXNlIDM6XG4gICAgICAgIC8vIE9wZXJhXG4gICAgICAgIHJldHVybiBuZXcgSW5mb1JlY2VpdmVySWZyYW1lKGJhc2VfdXJsKTtcbiAgICBkZWZhdWx0OlxuICAgICAgICAvLyBJRSA3XG4gICAgICAgIHJldHVybiBuZXcgSW5mb1JlY2VpdmVyRmFrZSgpO1xuICAgIH07XG59O1xuXG5cbnZhciBXSW5mb1JlY2VpdmVySWZyYW1lID0gRmFjYWRlSlNbJ3ctaWZyYW1lLWluZm8tcmVjZWl2ZXInXSA9IGZ1bmN0aW9uKHJpLCBfdHJhbnNfdXJsLCBiYXNlX3VybCkge1xuICAgIHZhciBpciA9IG5ldyBJbmZvUmVjZWl2ZXIoYmFzZV91cmwsIHV0aWxzLlhIUkxvY2FsT2JqZWN0KTtcbiAgICBpci5vbmZpbmlzaCA9IGZ1bmN0aW9uKGluZm8sIHJ0dCkge1xuICAgICAgICByaS5fZGlkTWVzc2FnZSgnbScrSlNPTi5zdHJpbmdpZnkoW2luZm8sIHJ0dF0pKTtcbiAgICAgICAgcmkuX2RpZENsb3NlKCk7XG4gICAgfVxufTtcbldJbmZvUmVjZWl2ZXJJZnJhbWUucHJvdG90eXBlLmRvQ2xlYW51cCA9IGZ1bmN0aW9uKCkge307XG4vLyAgICAgICAgIFsqXSBFbmQgb2YgbGliL2luZm8uanNcblxuXG4vLyAgICAgICAgIFsqXSBJbmNsdWRpbmcgbGliL3RyYW5zLWlmcmFtZS1ldmVudHNvdXJjZS5qc1xuLypcbiAqICoqKioqIEJFR0lOIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqIENvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuICpcbiAqIEZvciB0aGUgbGljZW5zZSBzZWUgQ09QWUlORy5cbiAqICoqKioqIEVORCBMSUNFTlNFIEJMT0NLICoqKioqXG4gKi9cblxudmFyIEV2ZW50U291cmNlSWZyYW1lVHJhbnNwb3J0ID0gU29ja0pTWydpZnJhbWUtZXZlbnRzb3VyY2UnXSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdGhhdC5wcm90b2NvbCA9ICd3LWlmcmFtZS1ldmVudHNvdXJjZSc7XG4gICAgdGhhdC5pX2NvbnN0cnVjdG9yLmFwcGx5KHRoYXQsIGFyZ3VtZW50cyk7XG59O1xuXG5FdmVudFNvdXJjZUlmcmFtZVRyYW5zcG9ydC5wcm90b3R5cGUgPSBuZXcgSWZyYW1lVHJhbnNwb3J0KCk7XG5cbkV2ZW50U291cmNlSWZyYW1lVHJhbnNwb3J0LmVuYWJsZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICgnRXZlbnRTb3VyY2UnIGluIF93aW5kb3cpICYmIElmcmFtZVRyYW5zcG9ydC5lbmFibGVkKCk7XG59O1xuXG5FdmVudFNvdXJjZUlmcmFtZVRyYW5zcG9ydC5uZWVkX2JvZHkgPSB0cnVlO1xuRXZlbnRTb3VyY2VJZnJhbWVUcmFuc3BvcnQucm91bmRUcmlwcyA9IDM7IC8vIGh0bWwsIGphdmFzY3JpcHQsIGV2ZW50c291cmNlXG5cblxuLy8gdy1pZnJhbWUtZXZlbnRzb3VyY2VcbnZhciBFdmVudFNvdXJjZVRyYW5zcG9ydCA9IEZhY2FkZUpTWyd3LWlmcmFtZS1ldmVudHNvdXJjZSddID0gZnVuY3Rpb24ocmksIHRyYW5zX3VybCkge1xuICAgIHRoaXMucnVuKHJpLCB0cmFuc191cmwsICcvZXZlbnRzb3VyY2UnLCBFdmVudFNvdXJjZVJlY2VpdmVyLCB1dGlscy5YSFJMb2NhbE9iamVjdCk7XG59XG5FdmVudFNvdXJjZVRyYW5zcG9ydC5wcm90b3R5cGUgPSBuZXcgQWpheEJhc2VkVHJhbnNwb3J0KCk7XG4vLyAgICAgICAgIFsqXSBFbmQgb2YgbGliL3RyYW5zLWlmcmFtZS1ldmVudHNvdXJjZS5qc1xuXG5cbi8vICAgICAgICAgWypdIEluY2x1ZGluZyBsaWIvdHJhbnMtaWZyYW1lLXhoci1wb2xsaW5nLmpzXG4vKlxuICogKioqKiogQkVHSU4gTElDRU5TRSBCTE9DSyAqKioqKlxuICogQ29weXJpZ2h0IChjKSAyMDExLTIwMTIgVk13YXJlLCBJbmMuXG4gKlxuICogRm9yIHRoZSBsaWNlbnNlIHNlZSBDT1BZSU5HLlxuICogKioqKiogRU5EIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqL1xuXG52YXIgWGhyUG9sbGluZ0lmcmFtZVRyYW5zcG9ydCA9IFNvY2tKU1snaWZyYW1lLXhoci1wb2xsaW5nJ10gPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHRoYXQucHJvdG9jb2wgPSAndy1pZnJhbWUteGhyLXBvbGxpbmcnO1xuICAgIHRoYXQuaV9jb25zdHJ1Y3Rvci5hcHBseSh0aGF0LCBhcmd1bWVudHMpO1xufTtcblxuWGhyUG9sbGluZ0lmcmFtZVRyYW5zcG9ydC5wcm90b3R5cGUgPSBuZXcgSWZyYW1lVHJhbnNwb3J0KCk7XG5cblhoclBvbGxpbmdJZnJhbWVUcmFuc3BvcnQuZW5hYmxlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gX3dpbmRvdy5YTUxIdHRwUmVxdWVzdCAmJiBJZnJhbWVUcmFuc3BvcnQuZW5hYmxlZCgpO1xufTtcblxuWGhyUG9sbGluZ0lmcmFtZVRyYW5zcG9ydC5uZWVkX2JvZHkgPSB0cnVlO1xuWGhyUG9sbGluZ0lmcmFtZVRyYW5zcG9ydC5yb3VuZFRyaXBzID0gMzsgLy8gaHRtbCwgamF2YXNjcmlwdCwgeGhyXG5cblxuLy8gdy1pZnJhbWUteGhyLXBvbGxpbmdcbnZhciBYaHJQb2xsaW5nSVRyYW5zcG9ydCA9IEZhY2FkZUpTWyd3LWlmcmFtZS14aHItcG9sbGluZyddID0gZnVuY3Rpb24ocmksIHRyYW5zX3VybCkge1xuICAgIHRoaXMucnVuKHJpLCB0cmFuc191cmwsICcveGhyJywgWGhyUmVjZWl2ZXIsIHV0aWxzLlhIUkxvY2FsT2JqZWN0KTtcbn07XG5cblhoclBvbGxpbmdJVHJhbnNwb3J0LnByb3RvdHlwZSA9IG5ldyBBamF4QmFzZWRUcmFuc3BvcnQoKTtcbi8vICAgICAgICAgWypdIEVuZCBvZiBsaWIvdHJhbnMtaWZyYW1lLXhoci1wb2xsaW5nLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi90cmFucy1pZnJhbWUtaHRtbGZpbGUuanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbi8vIFRoaXMgdHJhbnNwb3J0IGdlbmVyYWxseSB3b3JrcyBpbiBhbnkgYnJvd3NlciwgYnV0IHdpbGwgY2F1c2UgYVxuLy8gc3Bpbm5pbmcgY3Vyc29yIHRvIGFwcGVhciBpbiBhbnkgYnJvd3NlciBvdGhlciB0aGFuIElFLlxuLy8gV2UgbWF5IHRlc3QgdGhpcyB0cmFuc3BvcnQgaW4gYWxsIGJyb3dzZXJzIC0gd2h5IG5vdCwgYnV0IGluXG4vLyBwcm9kdWN0aW9uIGl0IHNob3VsZCBiZSBvbmx5IHJ1biBpbiBJRS5cblxudmFyIEh0bWxGaWxlSWZyYW1lVHJhbnNwb3J0ID0gU29ja0pTWydpZnJhbWUtaHRtbGZpbGUnXSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdGhhdC5wcm90b2NvbCA9ICd3LWlmcmFtZS1odG1sZmlsZSc7XG4gICAgdGhhdC5pX2NvbnN0cnVjdG9yLmFwcGx5KHRoYXQsIGFyZ3VtZW50cyk7XG59O1xuXG4vLyBJbmhlcml0YW5jZS5cbkh0bWxGaWxlSWZyYW1lVHJhbnNwb3J0LnByb3RvdHlwZSA9IG5ldyBJZnJhbWVUcmFuc3BvcnQoKTtcblxuSHRtbEZpbGVJZnJhbWVUcmFuc3BvcnQuZW5hYmxlZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBJZnJhbWVUcmFuc3BvcnQuZW5hYmxlZCgpO1xufTtcblxuSHRtbEZpbGVJZnJhbWVUcmFuc3BvcnQubmVlZF9ib2R5ID0gdHJ1ZTtcbkh0bWxGaWxlSWZyYW1lVHJhbnNwb3J0LnJvdW5kVHJpcHMgPSAzOyAvLyBodG1sLCBqYXZhc2NyaXB0LCBodG1sZmlsZVxuXG5cbi8vIHctaWZyYW1lLWh0bWxmaWxlXG52YXIgSHRtbEZpbGVUcmFuc3BvcnQgPSBGYWNhZGVKU1sndy1pZnJhbWUtaHRtbGZpbGUnXSA9IGZ1bmN0aW9uKHJpLCB0cmFuc191cmwpIHtcbiAgICB0aGlzLnJ1bihyaSwgdHJhbnNfdXJsLCAnL2h0bWxmaWxlJywgSHRtbGZpbGVSZWNlaXZlciwgdXRpbHMuWEhSTG9jYWxPYmplY3QpO1xufTtcbkh0bWxGaWxlVHJhbnNwb3J0LnByb3RvdHlwZSA9IG5ldyBBamF4QmFzZWRUcmFuc3BvcnQoKTtcbi8vICAgICAgICAgWypdIEVuZCBvZiBsaWIvdHJhbnMtaWZyYW1lLWh0bWxmaWxlLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi90cmFucy1wb2xsaW5nLmpzXG4vKlxuICogKioqKiogQkVHSU4gTElDRU5TRSBCTE9DSyAqKioqKlxuICogQ29weXJpZ2h0IChjKSAyMDExLTIwMTIgVk13YXJlLCBJbmMuXG4gKlxuICogRm9yIHRoZSBsaWNlbnNlIHNlZSBDT1BZSU5HLlxuICogKioqKiogRU5EIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqL1xuXG52YXIgUG9sbGluZyA9IGZ1bmN0aW9uKHJpLCBSZWNlaXZlciwgcmVjdl91cmwsIEFqYXhPYmplY3QpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdGhhdC5yaSA9IHJpO1xuICAgIHRoYXQuUmVjZWl2ZXIgPSBSZWNlaXZlcjtcbiAgICB0aGF0LnJlY3ZfdXJsID0gcmVjdl91cmw7XG4gICAgdGhhdC5BamF4T2JqZWN0ID0gQWpheE9iamVjdDtcbiAgICB0aGF0Ll9zY2hlZHVsZVJlY3YoKTtcbn07XG5cblBvbGxpbmcucHJvdG90eXBlLl9zY2hlZHVsZVJlY3YgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdmFyIHBvbGwgPSB0aGF0LnBvbGwgPSBuZXcgdGhhdC5SZWNlaXZlcih0aGF0LnJlY3ZfdXJsLCB0aGF0LkFqYXhPYmplY3QpO1xuICAgIHZhciBtc2dfY291bnRlciA9IDA7XG4gICAgcG9sbC5vbm1lc3NhZ2UgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIG1zZ19jb3VudGVyICs9IDE7XG4gICAgICAgIHRoYXQucmkuX2RpZE1lc3NhZ2UoZS5kYXRhKTtcbiAgICB9O1xuICAgIHBvbGwub25jbG9zZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdGhhdC5wb2xsID0gcG9sbCA9IHBvbGwub25tZXNzYWdlID0gcG9sbC5vbmNsb3NlID0gbnVsbDtcbiAgICAgICAgaWYgKCF0aGF0LnBvbGxfaXNfY2xvc2luZykge1xuICAgICAgICAgICAgaWYgKGUucmVhc29uID09PSAncGVybWFuZW50Jykge1xuICAgICAgICAgICAgICAgIHRoYXQucmkuX2RpZENsb3NlKDEwMDYsICdQb2xsaW5nIGVycm9yICgnICsgZS5yZWFzb24gKyAnKScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGF0Ll9zY2hlZHVsZVJlY3YoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG59O1xuXG5Qb2xsaW5nLnByb3RvdHlwZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICB0aGF0LnBvbGxfaXNfY2xvc2luZyA9IHRydWU7XG4gICAgaWYgKHRoYXQucG9sbCkge1xuICAgICAgICB0aGF0LnBvbGwuYWJvcnQoKTtcbiAgICB9XG59O1xuLy8gICAgICAgICBbKl0gRW5kIG9mIGxpYi90cmFucy1wb2xsaW5nLmpzXG5cblxuLy8gICAgICAgICBbKl0gSW5jbHVkaW5nIGxpYi90cmFucy1yZWNlaXZlci1ldmVudHNvdXJjZS5qc1xuLypcbiAqICoqKioqIEJFR0lOIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqIENvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuICpcbiAqIEZvciB0aGUgbGljZW5zZSBzZWUgQ09QWUlORy5cbiAqICoqKioqIEVORCBMSUNFTlNFIEJMT0NLICoqKioqXG4gKi9cblxudmFyIEV2ZW50U291cmNlUmVjZWl2ZXIgPSBmdW5jdGlvbih1cmwpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgdmFyIGVzID0gbmV3IEV2ZW50U291cmNlKHVybCk7XG4gICAgZXMub25tZXNzYWdlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICB0aGF0LmRpc3BhdGNoRXZlbnQobmV3IFNpbXBsZUV2ZW50KCdtZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7J2RhdGEnOiB1bmVzY2FwZShlLmRhdGEpfSkpO1xuICAgIH07XG4gICAgdGhhdC5lc19jbG9zZSA9IGVzLm9uZXJyb3IgPSBmdW5jdGlvbihlLCBhYm9ydF9yZWFzb24pIHtcbiAgICAgICAgLy8gRVMgb24gcmVjb25uZWN0aW9uIGhhcyByZWFkeVN0YXRlID0gMCBvciAxLlxuICAgICAgICAvLyBvbiBuZXR3b3JrIGVycm9yIGl0J3MgQ0xPU0VEID0gMlxuICAgICAgICB2YXIgcmVhc29uID0gYWJvcnRfcmVhc29uID8gJ3VzZXInIDpcbiAgICAgICAgICAgIChlcy5yZWFkeVN0YXRlICE9PSAyID8gJ25ldHdvcmsnIDogJ3Blcm1hbmVudCcpO1xuICAgICAgICB0aGF0LmVzX2Nsb3NlID0gZXMub25tZXNzYWdlID0gZXMub25lcnJvciA9IG51bGw7XG4gICAgICAgIC8vIEV2ZW50U291cmNlIHJlY29ubmVjdHMgYXV0b21hdGljYWxseS5cbiAgICAgICAgZXMuY2xvc2UoKTtcbiAgICAgICAgZXMgPSBudWxsO1xuICAgICAgICAvLyBTYWZhcmkgYW5kIGNocm9tZSA8IDE1IGNyYXNoIGlmIHdlIGNsb3NlIHdpbmRvdyBiZWZvcmVcbiAgICAgICAgLy8gd2FpdGluZyBmb3IgRVMgY2xlYW51cC4gU2VlOlxuICAgICAgICAvLyAgIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD04OTE1NVxuICAgICAgICB1dGlscy5kZWxheSgyMDAsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5kaXNwYXRjaEV2ZW50KG5ldyBTaW1wbGVFdmVudCgnY2xvc2UnLCB7cmVhc29uOiByZWFzb259KSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgIH07XG59O1xuXG5FdmVudFNvdXJjZVJlY2VpdmVyLnByb3RvdHlwZSA9IG5ldyBSRXZlbnRUYXJnZXQoKTtcblxuRXZlbnRTb3VyY2VSZWNlaXZlci5wcm90b3R5cGUuYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgdGhhdCA9IHRoaXM7XG4gICAgaWYgKHRoYXQuZXNfY2xvc2UpIHtcbiAgICAgICAgdGhhdC5lc19jbG9zZSh7fSwgdHJ1ZSk7XG4gICAgfVxufTtcbi8vICAgICAgICAgWypdIEVuZCBvZiBsaWIvdHJhbnMtcmVjZWl2ZXItZXZlbnRzb3VyY2UuanNcblxuXG4vLyAgICAgICAgIFsqXSBJbmNsdWRpbmcgbGliL3RyYW5zLXJlY2VpdmVyLWh0bWxmaWxlLmpzXG4vKlxuICogKioqKiogQkVHSU4gTElDRU5TRSBCTE9DSyAqKioqKlxuICogQ29weXJpZ2h0IChjKSAyMDExLTIwMTIgVk13YXJlLCBJbmMuXG4gKlxuICogRm9yIHRoZSBsaWNlbnNlIHNlZSBDT1BZSU5HLlxuICogKioqKiogRU5EIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqL1xuXG52YXIgX2lzX2llX2h0bWxmaWxlX2NhcGFibGU7XG52YXIgaXNJZUh0bWxmaWxlQ2FwYWJsZSA9IGZ1bmN0aW9uKCkge1xuICAgIGlmIChfaXNfaWVfaHRtbGZpbGVfY2FwYWJsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmICgnQWN0aXZlWE9iamVjdCcgaW4gX3dpbmRvdykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBfaXNfaWVfaHRtbGZpbGVfY2FwYWJsZSA9ICEhbmV3IEFjdGl2ZVhPYmplY3QoJ2h0bWxmaWxlJyk7XG4gICAgICAgICAgICB9IGNhdGNoICh4KSB7fVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgX2lzX2llX2h0bWxmaWxlX2NhcGFibGUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gX2lzX2llX2h0bWxmaWxlX2NhcGFibGU7XG59O1xuXG5cbnZhciBIdG1sZmlsZVJlY2VpdmVyID0gZnVuY3Rpb24odXJsKSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHV0aWxzLnBvbGx1dGVHbG9iYWxOYW1lc3BhY2UoKTtcblxuICAgIHRoYXQuaWQgPSAnYScgKyB1dGlscy5yYW5kb21fc3RyaW5nKDYsIDI2KTtcbiAgICB1cmwgKz0gKCh1cmwuaW5kZXhPZignPycpID09PSAtMSkgPyAnPycgOiAnJicpICtcbiAgICAgICAgJ2M9JyArIGVzY2FwZShXUHJlZml4ICsgJy4nICsgdGhhdC5pZCk7XG5cbiAgICB2YXIgY29uc3RydWN0b3IgPSBpc0llSHRtbGZpbGVDYXBhYmxlKCkgP1xuICAgICAgICB1dGlscy5jcmVhdGVIdG1sZmlsZSA6IHV0aWxzLmNyZWF0ZUlmcmFtZTtcblxuICAgIHZhciBpZnJhbWVPYmo7XG4gICAgX3dpbmRvd1tXUHJlZml4XVt0aGF0LmlkXSA9IHtcbiAgICAgICAgc3RhcnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmcmFtZU9iai5sb2FkZWQoKTtcbiAgICAgICAgfSxcbiAgICAgICAgbWVzc2FnZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgIHRoYXQuZGlzcGF0Y2hFdmVudChuZXcgU2ltcGxlRXZlbnQoJ21lc3NhZ2UnLCB7J2RhdGEnOiBkYXRhfSkpO1xuICAgICAgICB9LFxuICAgICAgICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGF0LmlmcmFtZV9jbG9zZSh7fSwgJ25ldHdvcmsnKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgdGhhdC5pZnJhbWVfY2xvc2UgPSBmdW5jdGlvbihlLCBhYm9ydF9yZWFzb24pIHtcbiAgICAgICAgaWZyYW1lT2JqLmNsZWFudXAoKTtcbiAgICAgICAgdGhhdC5pZnJhbWVfY2xvc2UgPSBpZnJhbWVPYmogPSBudWxsO1xuICAgICAgICBkZWxldGUgX3dpbmRvd1tXUHJlZml4XVt0aGF0LmlkXTtcbiAgICAgICAgdGhhdC5kaXNwYXRjaEV2ZW50KG5ldyBTaW1wbGVFdmVudCgnY2xvc2UnLCB7cmVhc29uOiBhYm9ydF9yZWFzb259KSk7XG4gICAgfTtcbiAgICBpZnJhbWVPYmogPSBjb25zdHJ1Y3Rvcih1cmwsIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5pZnJhbWVfY2xvc2Uoe30sICdwZXJtYW5lbnQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbn07XG5cbkh0bWxmaWxlUmVjZWl2ZXIucHJvdG90eXBlID0gbmV3IFJFdmVudFRhcmdldCgpO1xuXG5IdG1sZmlsZVJlY2VpdmVyLnByb3RvdHlwZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBpZiAodGhhdC5pZnJhbWVfY2xvc2UpIHtcbiAgICAgICAgdGhhdC5pZnJhbWVfY2xvc2Uoe30sICd1c2VyJyk7XG4gICAgfVxufTtcbi8vICAgICAgICAgWypdIEVuZCBvZiBsaWIvdHJhbnMtcmVjZWl2ZXItaHRtbGZpbGUuanNcblxuXG4vLyAgICAgICAgIFsqXSBJbmNsdWRpbmcgbGliL3RyYW5zLXJlY2VpdmVyLXhoci5qc1xuLypcbiAqICoqKioqIEJFR0lOIExJQ0VOU0UgQkxPQ0sgKioqKipcbiAqIENvcHlyaWdodCAoYykgMjAxMS0yMDEyIFZNd2FyZSwgSW5jLlxuICpcbiAqIEZvciB0aGUgbGljZW5zZSBzZWUgQ09QWUlORy5cbiAqICoqKioqIEVORCBMSUNFTlNFIEJMT0NLICoqKioqXG4gKi9cblxudmFyIFhoclJlY2VpdmVyID0gZnVuY3Rpb24odXJsLCBBamF4T2JqZWN0KSB7XG4gICAgdmFyIHRoYXQgPSB0aGlzO1xuICAgIHZhciBidWZfcG9zID0gMDtcblxuICAgIHRoYXQueG8gPSBuZXcgQWpheE9iamVjdCgnUE9TVCcsIHVybCwgbnVsbCk7XG4gICAgdGhhdC54by5vbmNodW5rID0gZnVuY3Rpb24oc3RhdHVzLCB0ZXh0KSB7XG4gICAgICAgIGlmIChzdGF0dXMgIT09IDIwMCkgcmV0dXJuO1xuICAgICAgICB3aGlsZSAoMSkge1xuICAgICAgICAgICAgdmFyIGJ1ZiA9IHRleHQuc2xpY2UoYnVmX3Bvcyk7XG4gICAgICAgICAgICB2YXIgcCA9IGJ1Zi5pbmRleE9mKCdcXG4nKTtcbiAgICAgICAgICAgIGlmIChwID09PSAtMSkgYnJlYWs7XG4gICAgICAgICAgICBidWZfcG9zICs9IHArMTtcbiAgICAgICAgICAgIHZhciBtc2cgPSBidWYuc2xpY2UoMCwgcCk7XG4gICAgICAgICAgICB0aGF0LmRpc3BhdGNoRXZlbnQobmV3IFNpbXBsZUV2ZW50KCdtZXNzYWdlJywge2RhdGE6IG1zZ30pKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgdGhhdC54by5vbmZpbmlzaCA9IGZ1bmN0aW9uKHN0YXR1cywgdGV4dCkge1xuICAgICAgICB0aGF0LnhvLm9uY2h1bmsoc3RhdHVzLCB0ZXh0KTtcbiAgICAgICAgdGhhdC54byA9IG51bGw7XG4gICAgICAgIHZhciByZWFzb24gPSBzdGF0dXMgPT09IDIwMCA/ICduZXR3b3JrJyA6ICdwZXJtYW5lbnQnO1xuICAgICAgICB0aGF0LmRpc3BhdGNoRXZlbnQobmV3IFNpbXBsZUV2ZW50KCdjbG9zZScsIHtyZWFzb246IHJlYXNvbn0pKTtcbiAgICB9XG59O1xuXG5YaHJSZWNlaXZlci5wcm90b3R5cGUgPSBuZXcgUkV2ZW50VGFyZ2V0KCk7XG5cblhoclJlY2VpdmVyLnByb3RvdHlwZS5hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aGF0ID0gdGhpcztcbiAgICBpZiAodGhhdC54bykge1xuICAgICAgICB0aGF0LnhvLmNsb3NlKCk7XG4gICAgICAgIHRoYXQuZGlzcGF0Y2hFdmVudChuZXcgU2ltcGxlRXZlbnQoJ2Nsb3NlJywge3JlYXNvbjogJ3VzZXInfSkpO1xuICAgICAgICB0aGF0LnhvID0gbnVsbDtcbiAgICB9XG59O1xuLy8gICAgICAgICBbKl0gRW5kIG9mIGxpYi90cmFucy1yZWNlaXZlci14aHIuanNcblxuXG4vLyAgICAgICAgIFsqXSBJbmNsdWRpbmcgbGliL3Rlc3QtaG9va3MuanNcbi8qXG4gKiAqKioqKiBCRUdJTiBMSUNFTlNFIEJMT0NLICoqKioqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTEtMjAxMiBWTXdhcmUsIEluYy5cbiAqXG4gKiBGb3IgdGhlIGxpY2Vuc2Ugc2VlIENPUFlJTkcuXG4gKiAqKioqKiBFTkQgTElDRU5TRSBCTE9DSyAqKioqKlxuICovXG5cbi8vIEZvciB0ZXN0aW5nXG5Tb2NrSlMuZ2V0VXRpbHMgPSBmdW5jdGlvbigpe1xuICAgIHJldHVybiB1dGlscztcbn07XG5cblNvY2tKUy5nZXRJZnJhbWVUcmFuc3BvcnQgPSBmdW5jdGlvbigpe1xuICAgIHJldHVybiBJZnJhbWVUcmFuc3BvcnQ7XG59O1xuLy8gICAgICAgICBbKl0gRW5kIG9mIGxpYi90ZXN0LWhvb2tzLmpzXG5cbiAgICAgICAgICAgICAgICAgIHJldHVybiBTb2NrSlM7XG4gICAgICAgICAgfSkoKTtcbmlmICgnX3NvY2tqc19vbmxvYWQnIGluIHdpbmRvdykgc2V0VGltZW91dChfc29ja2pzX29ubG9hZCwgMSk7XG5cbi8vIEFNRCBjb21wbGlhbmNlXG5pZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKCdzb2NranMnLCBbXSwgZnVuY3Rpb24oKXtyZXR1cm4gU29ja0pTO30pO1xufVxuXG5pZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBTb2NrSlM7XG59XG4vLyAgICAgWypdIEVuZCBvZiBsaWIvaW5kZXguanNcblxuLy8gWypdIEVuZCBvZiBsaWIvYWxsLmpzXG5cblxufSkoKSIsIihmdW5jdGlvbihnbG9iYWwpey8qKlxuICogdHR5LmpzIC0gYW4geHRlcm0gZW11bGF0b3JcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTItMjAxMywgQ2hyaXN0b3BoZXIgSmVmZnJleSAoaHR0cHM6Ly9naXRodWIuY29tL2NoamovdHR5LmpzKVxuICpcbiAqIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHlcbiAqIG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlIFwiU29mdHdhcmVcIiksIHRvIGRlYWxcbiAqIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHNcbiAqIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGxcbiAqIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXQgcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpc1xuICogZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcbiAqXG4gKiBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZCBpblxuICogYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4gKlxuICogVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTUyBPUlxuICogSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksXG4gKiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEVcbiAqIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sIERBTUFHRVMgT1IgT1RIRVJcbiAqIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sXG4gKiBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOXG4gKiBUSEUgU09GVFdBUkUuXG4gKlxuICogT3JpZ2luYWxseSBmb3JrZWQgZnJvbSAod2l0aCB0aGUgYXV0aG9yJ3MgcGVybWlzc2lvbik6XG4gKiAgIEZhYnJpY2UgQmVsbGFyZCdzIGphdmFzY3JpcHQgdnQxMDAgZm9yIGpzbGludXg6XG4gKiAgIGh0dHA6Ly9iZWxsYXJkLm9yZy9qc2xpbnV4L1xuICogICBDb3B5cmlnaHQgKGMpIDIwMTEgRmFicmljZSBCZWxsYXJkXG4gKiAgIFRoZSBvcmlnaW5hbCBkZXNpZ24gcmVtYWlucy4gVGhlIHRlcm1pbmFsIGl0c2VsZlxuICogICBoYXMgYmVlbiBleHRlbmRlZCB0byBpbmNsdWRlIHh0ZXJtIENTSSBjb2RlcywgYW1vbmdcbiAqICAgb3RoZXIgZmVhdHVyZXMuXG4gKi9cblxuOyhmdW5jdGlvbigpIHtcblxuLyoqXG4gKiBUZXJtaW5hbCBFbXVsYXRpb24gUmVmZXJlbmNlczpcbiAqICAgaHR0cDovL3Z0MTAwLm5ldC9cbiAqICAgaHR0cDovL2ludmlzaWJsZS1pc2xhbmQubmV0L3h0ZXJtL2N0bHNlcXMvY3Rsc2Vxcy50eHRcbiAqICAgaHR0cDovL2ludmlzaWJsZS1pc2xhbmQubmV0L3h0ZXJtL2N0bHNlcXMvY3Rsc2Vxcy5odG1sXG4gKiAgIGh0dHA6Ly9pbnZpc2libGUtaXNsYW5kLm5ldC92dHRlc3QvXG4gKiAgIGh0dHA6Ly93d3cuaW53YXAuY29tL3BkcDEwL2Fuc2ljb2RlLnR4dFxuICogICBodHRwOi8vbGludXguZGllLm5ldC9tYW4vNC9jb25zb2xlX2NvZGVzXG4gKiAgIGh0dHA6Ly9saW51eC5kaWUubmV0L21hbi83L3VyeHZ0XG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFNoYXJlZFxuICovXG5cbnZhciB3aW5kb3cgPSB0aGlzXG4gICwgZG9jdW1lbnQgPSB0aGlzLmRvY3VtZW50O1xuXG4vKipcbiAqIEV2ZW50RW1pdHRlclxuICovXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xufVxuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdGhpcy5fZXZlbnRzW3R5cGVdID0gdGhpcy5fZXZlbnRzW3R5cGVdIHx8IFtdO1xuICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm47XG5cbiAgdmFyIG9iaiA9IHRoaXMuX2V2ZW50c1t0eXBlXVxuICAgICwgaSA9IG9iai5sZW5ndGg7XG5cbiAgd2hpbGUgKGktLSkge1xuICAgIGlmIChvYmpbaV0gPT09IGxpc3RlbmVyIHx8IG9ialtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpIHtcbiAgICAgIG9iai5zcGxpY2UoaSwgMSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9mZiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKSBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgZnVuY3Rpb24gb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgb24pO1xuICAgIHJldHVybiBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuICBvbi5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICByZXR1cm4gdGhpcy5vbih0eXBlLCBvbik7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKSByZXR1cm47XG5cbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpXG4gICAgLCBvYmogPSB0aGlzLl9ldmVudHNbdHlwZV1cbiAgICAsIGwgPSBvYmoubGVuZ3RoXG4gICAgLCBpID0gMDtcblxuICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgIG9ialtpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHJldHVybiB0aGlzLl9ldmVudHNbdHlwZV0gPSB0aGlzLl9ldmVudHNbdHlwZV0gfHwgW107XG59O1xuXG4vKipcbiAqIFN0YXRlc1xuICovXG5cbnZhciBub3JtYWwgPSAwXG4gICwgZXNjYXBlZCA9IDFcbiAgLCBjc2kgPSAyXG4gICwgb3NjID0gM1xuICAsIGNoYXJzZXQgPSA0XG4gICwgZGNzID0gNVxuICAsIGlnbm9yZSA9IDY7XG5cbi8qKlxuICogVGVybWluYWxcbiAqL1xuXG5mdW5jdGlvbiBUZXJtaW5hbChjb2xzLCByb3dzLCBoYW5kbGVyKSB7XG4gIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuXG4gIHZhciBvcHRpb25zO1xuICBpZiAodHlwZW9mIGNvbHMgPT09ICdvYmplY3QnKSB7XG4gICAgb3B0aW9ucyA9IGNvbHM7XG4gICAgY29scyA9IG9wdGlvbnMuY29scztcbiAgICByb3dzID0gb3B0aW9ucy5yb3dzO1xuICAgIGhhbmRsZXIgPSBvcHRpb25zLmhhbmRsZXI7XG4gIH1cbiAgdGhpcy5fb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgdGhpcy5jb2xzID0gY29scyB8fCBUZXJtaW5hbC5nZW9tZXRyeVswXTtcbiAgdGhpcy5yb3dzID0gcm93cyB8fCBUZXJtaW5hbC5nZW9tZXRyeVsxXTtcblxuICBpZiAoaGFuZGxlcikge1xuICAgIHRoaXMub24oJ2RhdGEnLCBoYW5kbGVyKTtcbiAgfVxuXG4gIHRoaXMueWJhc2UgPSAwO1xuICB0aGlzLnlkaXNwID0gMDtcbiAgdGhpcy54ID0gMDtcbiAgdGhpcy55ID0gMDtcbiAgdGhpcy5jdXJzb3JTdGF0ZSA9IDA7XG4gIHRoaXMuY3Vyc29ySGlkZGVuID0gZmFsc2U7XG4gIHRoaXMuY29udmVydEVvbCA9IGZhbHNlO1xuICB0aGlzLnN0YXRlID0gMDtcbiAgdGhpcy5xdWV1ZSA9ICcnO1xuICB0aGlzLnNjcm9sbFRvcCA9IDA7XG4gIHRoaXMuc2Nyb2xsQm90dG9tID0gdGhpcy5yb3dzIC0gMTtcblxuICAvLyBtb2Rlc1xuICB0aGlzLmFwcGxpY2F0aW9uS2V5cGFkID0gZmFsc2U7XG4gIHRoaXMuYXBwbGljYXRpb25DdXJzb3IgPSBmYWxzZTtcbiAgdGhpcy5vcmlnaW5Nb2RlID0gZmFsc2U7XG4gIHRoaXMuaW5zZXJ0TW9kZSA9IGZhbHNlO1xuICB0aGlzLndyYXBhcm91bmRNb2RlID0gZmFsc2U7XG4gIHRoaXMubm9ybWFsID0gbnVsbDtcblxuICAvLyBjaGFyc2V0XG4gIHRoaXMuY2hhcnNldCA9IG51bGw7XG4gIHRoaXMuZ2NoYXJzZXQgPSBudWxsO1xuICB0aGlzLmdsZXZlbCA9IDA7XG4gIHRoaXMuY2hhcnNldHMgPSBbbnVsbF07XG5cbiAgLy8gbW91c2UgcHJvcGVydGllc1xuICB0aGlzLmRlY0xvY2F0b3I7XG4gIHRoaXMueDEwTW91c2U7XG4gIHRoaXMudnQyMDBNb3VzZTtcbiAgdGhpcy52dDMwME1vdXNlO1xuICB0aGlzLm5vcm1hbE1vdXNlO1xuICB0aGlzLm1vdXNlRXZlbnRzO1xuICB0aGlzLnNlbmRGb2N1cztcbiAgdGhpcy51dGZNb3VzZTtcbiAgdGhpcy5zZ3JNb3VzZTtcbiAgdGhpcy51cnh2dE1vdXNlO1xuXG4gIC8vIG1pc2NcbiAgdGhpcy5lbGVtZW50O1xuICB0aGlzLmNoaWxkcmVuO1xuICB0aGlzLnJlZnJlc2hTdGFydDtcbiAgdGhpcy5yZWZyZXNoRW5kO1xuICB0aGlzLnNhdmVkWDtcbiAgdGhpcy5zYXZlZFk7XG4gIHRoaXMuc2F2ZWRDb2xzO1xuXG4gIC8vIHN0cmVhbVxuICB0aGlzLnJlYWRhYmxlID0gdHJ1ZTtcbiAgdGhpcy53cml0YWJsZSA9IHRydWU7XG5cbiAgdGhpcy5kZWZBdHRyID0gKDI1NyA8PCA5KSB8IDI1NjtcbiAgdGhpcy5jdXJBdHRyID0gdGhpcy5kZWZBdHRyO1xuXG4gIHRoaXMucGFyYW1zID0gW107XG4gIHRoaXMuY3VycmVudFBhcmFtID0gMDtcbiAgdGhpcy5wcmVmaXggPSAnJztcbiAgdGhpcy5wb3N0Zml4ID0gJyc7XG5cbiAgdGhpcy5saW5lcyA9IFtdO1xuICB2YXIgaSA9IHRoaXMucm93cztcbiAgd2hpbGUgKGktLSkge1xuICAgIHRoaXMubGluZXMucHVzaCh0aGlzLmJsYW5rTGluZSgpKTtcbiAgfVxuXG4gIHRoaXMudGFicztcbiAgdGhpcy5zZXR1cFN0b3BzKCk7XG59XG5cbmluaGVyaXRzKFRlcm1pbmFsLCBFdmVudEVtaXR0ZXIpO1xuXG4vKipcbiAqIENvbG9yc1xuICovXG5cbi8vIENvbG9ycyAwLTE1XG5UZXJtaW5hbC5jb2xvcnMgPSBbXG4gIC8vIGRhcms6XG4gICcjMmUzNDM2JyxcbiAgJyNjYzAwMDAnLFxuICAnIzRlOWEwNicsXG4gICcjYzRhMDAwJyxcbiAgJyMzNDY1YTQnLFxuICAnIzc1NTA3YicsXG4gICcjMDY5ODlhJyxcbiAgJyNkM2Q3Y2YnLFxuICAvLyBicmlnaHQ6XG4gICcjNTU1NzUzJyxcbiAgJyNlZjI5MjknLFxuICAnIzhhZTIzNCcsXG4gICcjZmNlOTRmJyxcbiAgJyM3MjlmY2YnLFxuICAnI2FkN2ZhOCcsXG4gICcjMzRlMmUyJyxcbiAgJyNlZWVlZWMnXG5dO1xuXG4vLyBDb2xvcnMgMTYtMjU1XG4vLyBNdWNoIHRoYW5rcyB0byBUb29UYWxsTmF0ZSBmb3Igd3JpdGluZyB0aGlzLlxuVGVybWluYWwuY29sb3JzID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgY29sb3JzID0gVGVybWluYWwuY29sb3JzXG4gICAgLCByID0gWzB4MDAsIDB4NWYsIDB4ODcsIDB4YWYsIDB4ZDcsIDB4ZmZdXG4gICAgLCBpO1xuXG4gIC8vIDE2LTIzMVxuICBpID0gMDtcbiAgZm9yICg7IGkgPCAyMTY7IGkrKykge1xuICAgIG91dChyWyhpIC8gMzYpICUgNiB8IDBdLCByWyhpIC8gNikgJSA2IHwgMF0sIHJbaSAlIDZdKTtcbiAgfVxuXG4gIC8vIDIzMi0yNTUgKGdyZXkpXG4gIGkgPSAwO1xuICBmb3IgKDsgaSA8IDI0OyBpKyspIHtcbiAgICByID0gOCArIGkgKiAxMDtcbiAgICBvdXQociwgciwgcik7XG4gIH1cblxuICBmdW5jdGlvbiBvdXQociwgZywgYikge1xuICAgIGNvbG9ycy5wdXNoKCcjJyArIGhleChyKSArIGhleChnKSArIGhleChiKSk7XG4gIH1cblxuICBmdW5jdGlvbiBoZXgoYykge1xuICAgIGMgPSBjLnRvU3RyaW5nKDE2KTtcbiAgICByZXR1cm4gYy5sZW5ndGggPCAyID8gJzAnICsgYyA6IGM7XG4gIH1cblxuICByZXR1cm4gY29sb3JzO1xufSkoKTtcblxuLy8gRGVmYXVsdCBCRy9GR1xuVGVybWluYWwuZGVmYXVsdENvbG9ycyA9IHtcbiAgYmc6ICcjMDAwMDAwJyxcbiAgZmc6ICcjZjBmMGYwJ1xufTtcblxuVGVybWluYWwuY29sb3JzWzI1Nl0gPSBUZXJtaW5hbC5kZWZhdWx0Q29sb3JzLmJnO1xuVGVybWluYWwuY29sb3JzWzI1N10gPSBUZXJtaW5hbC5kZWZhdWx0Q29sb3JzLmZnO1xuXG4vKipcbiAqIE9wdGlvbnNcbiAqL1xuXG5UZXJtaW5hbC50ZXJtTmFtZSA9ICd4dGVybSc7XG5UZXJtaW5hbC5nZW9tZXRyeSA9IFs4MCwgMjRdO1xuVGVybWluYWwuY3Vyc29yQmxpbmsgPSB0cnVlO1xuVGVybWluYWwudmlzdWFsQmVsbCA9IGZhbHNlO1xuVGVybWluYWwucG9wT25CZWxsID0gZmFsc2U7XG5UZXJtaW5hbC5zY3JvbGxiYWNrID0gMTAwMDtcblRlcm1pbmFsLnNjcmVlbktleXMgPSBmYWxzZTtcblRlcm1pbmFsLnByb2dyYW1GZWF0dXJlcyA9IGZhbHNlO1xuVGVybWluYWwuZGVidWcgPSBmYWxzZTtcblxuLyoqXG4gKiBGb2N1c2VkIFRlcm1pbmFsXG4gKi9cblxuVGVybWluYWwuZm9jdXMgPSBudWxsO1xuXG5UZXJtaW5hbC5wcm90b3R5cGUuZm9jdXMgPSBmdW5jdGlvbigpIHtcbiAgaWYgKFRlcm1pbmFsLmZvY3VzID09PSB0aGlzKSByZXR1cm47XG4gIGlmIChUZXJtaW5hbC5mb2N1cykge1xuICAgIFRlcm1pbmFsLmZvY3VzLmN1cnNvclN0YXRlID0gMDtcbiAgICBUZXJtaW5hbC5mb2N1cy5yZWZyZXNoKFRlcm1pbmFsLmZvY3VzLnksIFRlcm1pbmFsLmZvY3VzLnkpO1xuICAgIGlmIChUZXJtaW5hbC5mb2N1cy5zZW5kRm9jdXMpIFRlcm1pbmFsLmZvY3VzLnNlbmQoJ1xceDFiW08nKTtcbiAgfVxuICBUZXJtaW5hbC5mb2N1cyA9IHRoaXM7XG4gIGlmICh0aGlzLnNlbmRGb2N1cykgdGhpcy5zZW5kKCdcXHgxYltJJyk7XG4gIHRoaXMuc2hvd0N1cnNvcigpO1xufTtcblxuLyoqXG4gKiBHbG9iYWwgRXZlbnRzIGZvciBrZXkgaGFuZGxpbmdcbiAqL1xuXG5UZXJtaW5hbC5iaW5kS2V5cyA9IGZ1bmN0aW9uKCkge1xuICBpZiAoVGVybWluYWwuZm9jdXMpIHJldHVybjtcblxuICAvLyBXZSBjb3VsZCBwdXQgYW4gXCJpZiAoVGVybWluYWwuZm9jdXMpXCIgY2hlY2tcbiAgLy8gaGVyZSwgYnV0IGl0IHNob3VsZG4ndCBiZSBuZWNlc3NhcnkuXG4gIG9uKGRvY3VtZW50LCAna2V5ZG93bicsIGZ1bmN0aW9uKGV2KSB7XG4gICAgcmV0dXJuIFRlcm1pbmFsLmZvY3VzLmtleURvd24oZXYpO1xuICB9LCB0cnVlKTtcblxuICBvbihkb2N1bWVudCwgJ2tleXByZXNzJywgZnVuY3Rpb24oZXYpIHtcbiAgICByZXR1cm4gVGVybWluYWwuZm9jdXMua2V5UHJlc3MoZXYpO1xuICB9LCB0cnVlKTtcbn07XG5cbi8qKlxuICogT3BlbiBUZXJtaW5hbFxuICovXG5cblRlcm1pbmFsLnByb3RvdHlwZS5vcGVuID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpc1xuICAgICwgaSA9IDBcbiAgICAsIGRpdjtcblxuICB0aGlzLmVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdGhpcy5lbGVtZW50LmNsYXNzTmFtZSA9ICd0ZXJtaW5hbCc7XG4gIHRoaXMuY2hpbGRyZW4gPSBbXTtcblxuICBmb3IgKDsgaSA8IHRoaXMucm93czsgaSsrKSB7XG4gICAgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKGRpdik7XG4gICAgdGhpcy5jaGlsZHJlbi5wdXNoKGRpdik7XG4gIH1cblxuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZWxlbWVudCk7XG5cbiAgdGhpcy5yZWZyZXNoKDAsIHRoaXMucm93cyAtIDEpO1xuXG4gIFRlcm1pbmFsLmJpbmRLZXlzKCk7XG4gIHRoaXMuZm9jdXMoKTtcblxuICB0aGlzLnN0YXJ0QmxpbmsoKTtcblxuICBvbih0aGlzLmVsZW1lbnQsICdtb3VzZWRvd24nLCBmdW5jdGlvbigpIHtcbiAgICBzZWxmLmZvY3VzKCk7XG4gIH0pO1xuXG4gIC8vIFRoaXMgcHJvYmFibHkgc2hvdWxkbid0IHdvcmssXG4gIC8vIC4uLiBidXQgaXQgZG9lcy4gRmlyZWZveCdzIHBhc3RlXG4gIC8vIGV2ZW50IHNlZW1zIHRvIG9ubHkgd29yayBmb3IgdGV4dGFyZWFzP1xuICBvbih0aGlzLmVsZW1lbnQsICdtb3VzZWRvd24nLCBmdW5jdGlvbihldikge1xuICAgIHZhciBidXR0b24gPSBldi5idXR0b24gIT0gbnVsbFxuICAgICAgPyArZXYuYnV0dG9uXG4gICAgICA6IGV2LndoaWNoICE9IG51bGxcbiAgICAgICAgPyBldi53aGljaCAtIDFcbiAgICAgICAgOiBudWxsO1xuXG4gICAgLy8gRG9lcyBJRTkgZG8gdGhpcz9cbiAgICBpZiAofm5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZignTVNJRScpKSB7XG4gICAgICBidXR0b24gPSBidXR0b24gPT09IDEgPyAwIDogYnV0dG9uID09PSA0ID8gMSA6IGJ1dHRvbjtcbiAgICB9XG5cbiAgICBpZiAoYnV0dG9uICE9PSAyKSByZXR1cm47XG5cbiAgICBzZWxmLmVsZW1lbnQuY29udGVudEVkaXRhYmxlID0gJ3RydWUnO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBzZWxmLmVsZW1lbnQuY29udGVudEVkaXRhYmxlID0gJ2luaGVyaXQnOyAvLyAnZmFsc2UnO1xuICAgIH0sIDEpO1xuICB9LCB0cnVlKTtcblxuICBvbih0aGlzLmVsZW1lbnQsICdwYXN0ZScsIGZ1bmN0aW9uKGV2KSB7XG4gICAgaWYgKGV2LmNsaXBib2FyZERhdGEpIHtcbiAgICAgIHNlbGYuc2VuZChldi5jbGlwYm9hcmREYXRhLmdldERhdGEoJ3RleHQvcGxhaW4nKSk7XG4gICAgfSBlbHNlIGlmICh3aW5kb3cuY2xpcGJvYXJkRGF0YSkge1xuICAgICAgc2VsZi5zZW5kKHdpbmRvdy5jbGlwYm9hcmREYXRhLmdldERhdGEoJ1RleHQnKSk7XG4gICAgfVxuICAgIC8vIE5vdCBuZWNlc3NhcnkuIERvIGl0IGFueXdheSBmb3IgZ29vZCBtZWFzdXJlLlxuICAgIHNlbGYuZWxlbWVudC5jb250ZW50RWRpdGFibGUgPSAnaW5oZXJpdCc7XG4gICAgcmV0dXJuIGNhbmNlbChldik7XG4gIH0pO1xuXG4gIHRoaXMuYmluZE1vdXNlKCk7XG5cbiAgLy8gWFhYIC0gaGFjaywgbW92ZSB0aGlzIHNvbWV3aGVyZSBlbHNlLlxuICBpZiAoVGVybWluYWwuYnJva2VuQm9sZCA9PSBudWxsKSB7XG4gICAgVGVybWluYWwuYnJva2VuQm9sZCA9IGlzQm9sZEJyb2tlbigpO1xuICB9XG5cbiAgLy8gc3luYyBkZWZhdWx0IGJnL2ZnIGNvbG9yc1xuICB0aGlzLmVsZW1lbnQuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gVGVybWluYWwuZGVmYXVsdENvbG9ycy5iZztcbiAgdGhpcy5lbGVtZW50LnN0eWxlLmNvbG9yID0gVGVybWluYWwuZGVmYXVsdENvbG9ycy5mZztcblxuICAvL3RoaXMuZW1pdCgnb3BlbicpO1xufTtcblxuLy8gWFRlcm0gbW91c2UgZXZlbnRzXG4vLyBodHRwOi8vaW52aXNpYmxlLWlzbGFuZC5uZXQveHRlcm0vY3Rsc2Vxcy9jdGxzZXFzLmh0bWwjTW91c2UlMjBUcmFja2luZ1xuLy8gVG8gYmV0dGVyIHVuZGVyc3RhbmQgdGhlc2Vcbi8vIHRoZSB4dGVybSBjb2RlIGlzIHZlcnkgaGVscGZ1bDpcbi8vIFJlbGV2YW50IGZpbGVzOlxuLy8gICBidXR0b24uYywgY2hhcnByb2MuYywgbWlzYy5jXG4vLyBSZWxldmFudCBmdW5jdGlvbnMgaW4geHRlcm0vYnV0dG9uLmM6XG4vLyAgIEJ0bkNvZGUsIEVtaXRCdXR0b25Db2RlLCBFZGl0b3JCdXR0b24sIFNlbmRNb3VzZVBvc2l0aW9uXG5UZXJtaW5hbC5wcm90b3R5cGUuYmluZE1vdXNlID0gZnVuY3Rpb24oKSB7XG4gIHZhciBlbCA9IHRoaXMuZWxlbWVudFxuICAgICwgc2VsZiA9IHRoaXNcbiAgICAsIHByZXNzZWQgPSAzMjtcblxuICB2YXIgd2hlZWxFdmVudCA9ICdvbm1vdXNld2hlZWwnIGluIHdpbmRvd1xuICAgID8gJ21vdXNld2hlZWwnXG4gICAgOiAnRE9NTW91c2VTY3JvbGwnO1xuXG4gIC8vIG1vdXNldXAsIG1vdXNlZG93biwgbW91c2V3aGVlbFxuICAvLyBsZWZ0IGNsaWNrOiBeW1tNIDM8XltbTSMzPFxuICAvLyBtb3VzZXdoZWVsIHVwOiBeW1tNYDM+XG4gIGZ1bmN0aW9uIHNlbmRCdXR0b24oZXYpIHtcbiAgICB2YXIgYnV0dG9uXG4gICAgICAsIHBvcztcblxuICAgIC8vIGdldCB0aGUgeHRlcm0tc3R5bGUgYnV0dG9uXG4gICAgYnV0dG9uID0gZ2V0QnV0dG9uKGV2KTtcblxuICAgIC8vIGdldCBtb3VzZSBjb29yZGluYXRlc1xuICAgIHBvcyA9IGdldENvb3Jkcyhldik7XG4gICAgaWYgKCFwb3MpIHJldHVybjtcblxuICAgIHNlbmRFdmVudChidXR0b24sIHBvcyk7XG5cbiAgICBzd2l0Y2ggKGV2LnR5cGUpIHtcbiAgICAgIGNhc2UgJ21vdXNlZG93bic6XG4gICAgICAgIHByZXNzZWQgPSBidXR0b247XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnbW91c2V1cCc6XG4gICAgICAgIC8vIGtlZXAgaXQgYXQgdGhlIGxlZnRcbiAgICAgICAgLy8gYnV0dG9uLCBqdXN0IGluIGNhc2UuXG4gICAgICAgIHByZXNzZWQgPSAzMjtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIHdoZWVsRXZlbnQ6XG4gICAgICAgIC8vIG5vdGhpbmcuIGRvbid0XG4gICAgICAgIC8vIGludGVyZmVyZSB3aXRoXG4gICAgICAgIC8vIGBwcmVzc2VkYC5cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgLy8gbW90aW9uIGV4YW1wbGUgb2YgYSBsZWZ0IGNsaWNrOlxuICAvLyBeW1tNIDM8XltbTUA0PF5bW01ANTxeW1tNQDY8XltbTUA3PF5bW00jNzxcbiAgZnVuY3Rpb24gc2VuZE1vdmUoZXYpIHtcbiAgICB2YXIgYnV0dG9uID0gcHJlc3NlZFxuICAgICAgLCBwb3M7XG5cbiAgICBwb3MgPSBnZXRDb29yZHMoZXYpO1xuICAgIGlmICghcG9zKSByZXR1cm47XG5cbiAgICAvLyBidXR0b25zIG1hcmtlZCBhcyBtb3Rpb25zXG4gICAgLy8gYXJlIGluY3JlbWVudGVkIGJ5IDMyXG4gICAgYnV0dG9uICs9IDMyO1xuXG4gICAgc2VuZEV2ZW50KGJ1dHRvbiwgcG9zKTtcbiAgfVxuXG4gIC8vIGVuY29kZSBidXR0b24gYW5kXG4gIC8vIHBvc2l0aW9uIHRvIGNoYXJhY3RlcnNcbiAgZnVuY3Rpb24gZW5jb2RlKGRhdGEsIGNoKSB7XG4gICAgaWYgKCFzZWxmLnV0Zk1vdXNlKSB7XG4gICAgICBpZiAoY2ggPT09IDI1NSkgcmV0dXJuIGRhdGEucHVzaCgwKTtcbiAgICAgIGlmIChjaCA+IDEyNykgY2ggPSAxMjc7XG4gICAgICBkYXRhLnB1c2goY2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoY2ggPT09IDIwNDcpIHJldHVybiBkYXRhLnB1c2goMCk7XG4gICAgICBpZiAoY2ggPCAxMjcpIHtcbiAgICAgICAgZGF0YS5wdXNoKGNoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChjaCA+IDIwNDcpIGNoID0gMjA0NztcbiAgICAgICAgZGF0YS5wdXNoKDB4QzAgfCAoY2ggPj4gNikpO1xuICAgICAgICBkYXRhLnB1c2goMHg4MCB8IChjaCAmIDB4M0YpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBzZW5kIGEgbW91c2UgZXZlbnQ6XG4gIC8vIHJlZ3VsYXIvdXRmODogXltbTSBDYiBDeCBDeVxuICAvLyB1cnh2dDogXltbIENiIDsgQ3ggOyBDeSBNXG4gIC8vIHNncjogXltbIENiIDsgQ3ggOyBDeSBNL21cbiAgLy8gdnQzMDA6IF5bWyAyNCgxLzMvNSl+IFsgQ3ggLCBDeSBdIFxcclxuICAvLyBsb2NhdG9yOiBDU0kgUCBlIDsgUCBiIDsgUCByIDsgUCBjIDsgUCBwICYgd1xuICBmdW5jdGlvbiBzZW5kRXZlbnQoYnV0dG9uLCBwb3MpIHtcbiAgICAvLyBzZWxmLmVtaXQoJ21vdXNlJywge1xuICAgIC8vICAgeDogcG9zLnggLSAzMixcbiAgICAvLyAgIHk6IHBvcy54IC0gMzIsXG4gICAgLy8gICBidXR0b246IGJ1dHRvblxuICAgIC8vIH0pO1xuXG4gICAgaWYgKHNlbGYudnQzMDBNb3VzZSkge1xuICAgICAgLy8gTk9URTogVW5zdGFibGUuXG4gICAgICAvLyBodHRwOi8vd3d3LnZ0MTAwLm5ldC9kb2NzL3Z0M3h4LWdwL2NoYXB0ZXIxNS5odG1sXG4gICAgICBidXR0b24gJj0gMztcbiAgICAgIHBvcy54IC09IDMyO1xuICAgICAgcG9zLnkgLT0gMzI7XG4gICAgICB2YXIgZGF0YSA9ICdcXHgxYlsyNCc7XG4gICAgICBpZiAoYnV0dG9uID09PSAwKSBkYXRhICs9ICcxJztcbiAgICAgIGVsc2UgaWYgKGJ1dHRvbiA9PT0gMSkgZGF0YSArPSAnMyc7XG4gICAgICBlbHNlIGlmIChidXR0b24gPT09IDIpIGRhdGEgKz0gJzUnO1xuICAgICAgZWxzZSBpZiAoYnV0dG9uID09PSAzKSByZXR1cm47XG4gICAgICBlbHNlIGRhdGEgKz0gJzAnO1xuICAgICAgZGF0YSArPSAnflsnICsgcG9zLnggKyAnLCcgKyBwb3MueSArICddXFxyJztcbiAgICAgIHNlbGYuc2VuZChkYXRhKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5kZWNMb2NhdG9yKSB7XG4gICAgICAvLyBOT1RFOiBVbnN0YWJsZS5cbiAgICAgIGJ1dHRvbiAmPSAzO1xuICAgICAgcG9zLnggLT0gMzI7XG4gICAgICBwb3MueSAtPSAzMjtcbiAgICAgIGlmIChidXR0b24gPT09IDApIGJ1dHRvbiA9IDI7XG4gICAgICBlbHNlIGlmIChidXR0b24gPT09IDEpIGJ1dHRvbiA9IDQ7XG4gICAgICBlbHNlIGlmIChidXR0b24gPT09IDIpIGJ1dHRvbiA9IDY7XG4gICAgICBlbHNlIGlmIChidXR0b24gPT09IDMpIGJ1dHRvbiA9IDM7XG4gICAgICBzZWxmLnNlbmQoJ1xceDFiWydcbiAgICAgICAgKyBidXR0b25cbiAgICAgICAgKyAnOydcbiAgICAgICAgKyAoYnV0dG9uID09PSAzID8gNCA6IDApXG4gICAgICAgICsgJzsnXG4gICAgICAgICsgcG9zLnlcbiAgICAgICAgKyAnOydcbiAgICAgICAgKyBwb3MueFxuICAgICAgICArICc7J1xuICAgICAgICArIChwb3MucGFnZSB8fCAwKVxuICAgICAgICArICcmdycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLnVyeHZ0TW91c2UpIHtcbiAgICAgIHBvcy54IC09IDMyO1xuICAgICAgcG9zLnkgLT0gMzI7XG4gICAgICBwb3MueCsrO1xuICAgICAgcG9zLnkrKztcbiAgICAgIHNlbGYuc2VuZCgnXFx4MWJbJyArIGJ1dHRvbiArICc7JyArIHBvcy54ICsgJzsnICsgcG9zLnkgKyAnTScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzZWxmLnNnck1vdXNlKSB7XG4gICAgICBwb3MueCAtPSAzMjtcbiAgICAgIHBvcy55IC09IDMyO1xuICAgICAgc2VsZi5zZW5kKCdcXHgxYls8J1xuICAgICAgICArICgoYnV0dG9uICYgMykgPT09IDMgPyBidXR0b24gJiB+MyA6IGJ1dHRvbilcbiAgICAgICAgKyAnOydcbiAgICAgICAgKyBwb3MueFxuICAgICAgICArICc7J1xuICAgICAgICArIHBvcy55XG4gICAgICAgICsgKChidXR0b24gJiAzKSA9PT0gMyA/ICdtJyA6ICdNJykpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBkYXRhID0gW107XG5cbiAgICBlbmNvZGUoZGF0YSwgYnV0dG9uKTtcbiAgICBlbmNvZGUoZGF0YSwgcG9zLngpO1xuICAgIGVuY29kZShkYXRhLCBwb3MueSk7XG5cbiAgICBzZWxmLnNlbmQoJ1xceDFiW00nICsgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGRhdGEpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldEJ1dHRvbihldikge1xuICAgIHZhciBidXR0b25cbiAgICAgICwgc2hpZnRcbiAgICAgICwgbWV0YVxuICAgICAgLCBjdHJsXG4gICAgICAsIG1vZDtcblxuICAgIC8vIHR3byBsb3cgYml0czpcbiAgICAvLyAwID0gbGVmdFxuICAgIC8vIDEgPSBtaWRkbGVcbiAgICAvLyAyID0gcmlnaHRcbiAgICAvLyAzID0gcmVsZWFzZVxuICAgIC8vIHdoZWVsIHVwL2Rvd246XG4gICAgLy8gMSwgYW5kIDIgLSB3aXRoIDY0IGFkZGVkXG4gICAgc3dpdGNoIChldi50eXBlKSB7XG4gICAgICBjYXNlICdtb3VzZWRvd24nOlxuICAgICAgICBidXR0b24gPSBldi5idXR0b24gIT0gbnVsbFxuICAgICAgICAgID8gK2V2LmJ1dHRvblxuICAgICAgICAgIDogZXYud2hpY2ggIT0gbnVsbFxuICAgICAgICAgICAgPyBldi53aGljaCAtIDFcbiAgICAgICAgICAgIDogbnVsbDtcblxuICAgICAgICBpZiAofm5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZignTVNJRScpKSB7XG4gICAgICAgICAgYnV0dG9uID0gYnV0dG9uID09PSAxID8gMCA6IGJ1dHRvbiA9PT0gNCA/IDEgOiBidXR0b247XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtb3VzZXVwJzpcbiAgICAgICAgYnV0dG9uID0gMztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdET01Nb3VzZVNjcm9sbCc6XG4gICAgICAgIGJ1dHRvbiA9IGV2LmRldGFpbCA8IDBcbiAgICAgICAgICA/IDY0XG4gICAgICAgICAgOiA2NTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdtb3VzZXdoZWVsJzpcbiAgICAgICAgYnV0dG9uID0gZXYud2hlZWxEZWx0YVkgPiAwXG4gICAgICAgICAgPyA2NFxuICAgICAgICAgIDogNjU7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIG5leHQgdGhyZWUgYml0cyBhcmUgdGhlIG1vZGlmaWVyczpcbiAgICAvLyA0ID0gc2hpZnQsIDggPSBtZXRhLCAxNiA9IGNvbnRyb2xcbiAgICBzaGlmdCA9IGV2LnNoaWZ0S2V5ID8gNCA6IDA7XG4gICAgbWV0YSA9IGV2Lm1ldGFLZXkgPyA4IDogMDtcbiAgICBjdHJsID0gZXYuY3RybEtleSA/IDE2IDogMDtcbiAgICBtb2QgPSBzaGlmdCB8IG1ldGEgfCBjdHJsO1xuXG4gICAgLy8gbm8gbW9kc1xuICAgIGlmIChzZWxmLnZ0MjAwTW91c2UpIHtcbiAgICAgIC8vIGN0cmwgb25seVxuICAgICAgbW9kICY9IGN0cmw7XG4gICAgfSBlbHNlIGlmICghc2VsZi5ub3JtYWxNb3VzZSkge1xuICAgICAgbW9kID0gMDtcbiAgICB9XG5cbiAgICAvLyBpbmNyZW1lbnQgdG8gU1BcbiAgICBidXR0b24gPSAoMzIgKyAobW9kIDw8IDIpKSArIGJ1dHRvbjtcblxuICAgIHJldHVybiBidXR0b247XG4gIH1cblxuICAvLyBtb3VzZSBjb29yZGluYXRlcyBtZWFzdXJlZCBpbiBjb2xzL3Jvd3NcbiAgZnVuY3Rpb24gZ2V0Q29vcmRzKGV2KSB7XG4gICAgdmFyIHgsIHksIHcsIGgsIGVsO1xuXG4gICAgLy8gaWdub3JlIGJyb3dzZXJzIHdpdGhvdXQgcGFnZVggZm9yIG5vd1xuICAgIGlmIChldi5wYWdlWCA9PSBudWxsKSByZXR1cm47XG5cbiAgICB4ID0gZXYucGFnZVg7XG4gICAgeSA9IGV2LnBhZ2VZO1xuICAgIGVsID0gc2VsZi5lbGVtZW50O1xuXG4gICAgLy8gc2hvdWxkIHByb2JhYmx5IGNoZWNrIG9mZnNldFBhcmVudFxuICAgIC8vIGJ1dCB0aGlzIGlzIG1vcmUgcG9ydGFibGVcbiAgICB3aGlsZSAoZWwgIT09IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCkge1xuICAgICAgeCAtPSBlbC5vZmZzZXRMZWZ0O1xuICAgICAgeSAtPSBlbC5vZmZzZXRUb3A7XG4gICAgICBlbCA9IGVsLnBhcmVudE5vZGU7XG4gICAgfVxuXG4gICAgLy8gY29udmVydCB0byBjb2xzL3Jvd3NcbiAgICB3ID0gc2VsZi5lbGVtZW50LmNsaWVudFdpZHRoO1xuICAgIGggPSBzZWxmLmVsZW1lbnQuY2xpZW50SGVpZ2h0O1xuICAgIHggPSAoKHggLyB3KSAqIHNlbGYuY29scykgfCAwO1xuICAgIHkgPSAoKHkgLyBoKSAqIHNlbGYucm93cykgfCAwO1xuXG4gICAgLy8gYmUgc3VyZSB0byBhdm9pZCBzZW5kaW5nXG4gICAgLy8gYmFkIHBvc2l0aW9ucyB0byB0aGUgcHJvZ3JhbVxuICAgIGlmICh4IDwgMCkgeCA9IDA7XG4gICAgaWYgKHggPiBzZWxmLmNvbHMpIHggPSBzZWxmLmNvbHM7XG4gICAgaWYgKHkgPCAwKSB5ID0gMDtcbiAgICBpZiAoeSA+IHNlbGYucm93cykgeSA9IHNlbGYucm93cztcblxuICAgIC8vIHh0ZXJtIHNlbmRzIHJhdyBieXRlcyBhbmRcbiAgICAvLyBzdGFydHMgYXQgMzIgKFNQKSBmb3IgZWFjaC5cbiAgICB4ICs9IDMyO1xuICAgIHkgKz0gMzI7XG5cbiAgICByZXR1cm4ge1xuICAgICAgeDogeCxcbiAgICAgIHk6IHksXG4gICAgICBkb3duOiBldi50eXBlID09PSAnbW91c2Vkb3duJyxcbiAgICAgIHVwOiBldi50eXBlID09PSAnbW91c2V1cCcsXG4gICAgICB3aGVlbDogZXYudHlwZSA9PT0gd2hlZWxFdmVudCxcbiAgICAgIG1vdmU6IGV2LnR5cGUgPT09ICdtb3VzZW1vdmUnXG4gICAgfTtcbiAgfVxuXG4gIG9uKGVsLCAnbW91c2Vkb3duJywgZnVuY3Rpb24oZXYpIHtcbiAgICBpZiAoIXNlbGYubW91c2VFdmVudHMpIHJldHVybjtcblxuICAgIC8vIHNlbmQgdGhlIGJ1dHRvblxuICAgIHNlbmRCdXR0b24oZXYpO1xuXG4gICAgLy8gZW5zdXJlIGZvY3VzXG4gICAgc2VsZi5mb2N1cygpO1xuXG4gICAgLy8gZml4IGZvciBvZGQgYnVnXG4gICAgaWYgKHNlbGYudnQyMDBNb3VzZSkge1xuICAgICAgc2VuZEJ1dHRvbih7IF9fcHJvdG9fXzogZXYsIHR5cGU6ICdtb3VzZXVwJyB9KTtcbiAgICAgIHJldHVybiBjYW5jZWwoZXYpO1xuICAgIH1cblxuICAgIC8vIGJpbmQgZXZlbnRzXG4gICAgaWYgKHNlbGYubm9ybWFsTW91c2UpIG9uKGRvY3VtZW50LCAnbW91c2Vtb3ZlJywgc2VuZE1vdmUpO1xuXG4gICAgLy8geDEwIGNvbXBhdGliaWxpdHkgbW9kZSBjYW4ndCBzZW5kIGJ1dHRvbiByZWxlYXNlc1xuICAgIGlmICghc2VsZi54MTBNb3VzZSkge1xuICAgICAgb24oZG9jdW1lbnQsICdtb3VzZXVwJywgZnVuY3Rpb24gdXAoZXYpIHtcbiAgICAgICAgc2VuZEJ1dHRvbihldik7XG4gICAgICAgIGlmIChzZWxmLm5vcm1hbE1vdXNlKSBvZmYoZG9jdW1lbnQsICdtb3VzZW1vdmUnLCBzZW5kTW92ZSk7XG4gICAgICAgIG9mZihkb2N1bWVudCwgJ21vdXNldXAnLCB1cCk7XG4gICAgICAgIHJldHVybiBjYW5jZWwoZXYpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhbmNlbChldik7XG4gIH0pO1xuXG4gIG9uKGVsLCB3aGVlbEV2ZW50LCBmdW5jdGlvbihldikge1xuICAgIGlmICghc2VsZi5tb3VzZUV2ZW50cykgcmV0dXJuO1xuICAgIGlmIChzZWxmLngxME1vdXNlXG4gICAgICAgIHx8IHNlbGYudnQzMDBNb3VzZVxuICAgICAgICB8fCBzZWxmLmRlY0xvY2F0b3IpIHJldHVybjtcbiAgICBzZW5kQnV0dG9uKGV2KTtcbiAgICByZXR1cm4gY2FuY2VsKGV2KTtcbiAgfSk7XG5cbiAgLy8gYWxsb3cgbW91c2V3aGVlbCBzY3JvbGxpbmcgaW5cbiAgLy8gdGhlIHNoZWxsIGZvciBleGFtcGxlXG4gIG9uKGVsLCB3aGVlbEV2ZW50LCBmdW5jdGlvbihldikge1xuICAgIGlmIChzZWxmLm1vdXNlRXZlbnRzKSByZXR1cm47XG4gICAgaWYgKHNlbGYuYXBwbGljYXRpb25LZXlwYWQpIHJldHVybjtcbiAgICBpZiAoZXYudHlwZSA9PT0gJ0RPTU1vdXNlU2Nyb2xsJykge1xuICAgICAgc2VsZi5zY3JvbGxEaXNwKGV2LmRldGFpbCA8IDAgPyAtNSA6IDUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLnNjcm9sbERpc3AoZXYud2hlZWxEZWx0YVkgPiAwID8gLTUgOiA1KTtcbiAgICB9XG4gICAgcmV0dXJuIGNhbmNlbChldik7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBEZXN0cm95IFRlcm1pbmFsXG4gKi9cblxuVGVybWluYWwucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5yZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG4gIHRoaXMuX2V2ZW50cyA9IHt9O1xuICB0aGlzLmhhbmRsZXIgPSBmdW5jdGlvbigpIHt9O1xuICB0aGlzLndyaXRlID0gZnVuY3Rpb24oKSB7fTtcbiAgLy90aGlzLmVtaXQoJ2Nsb3NlJyk7XG59O1xuXG4vKipcbiAqIFJlbmRlcmluZyBFbmdpbmVcbiAqL1xuXG4vLyBJbiB0aGUgc2NyZWVuIGJ1ZmZlciwgZWFjaCBjaGFyYWN0ZXJcbi8vIGlzIHN0b3JlZCBhcyBhIGFuIGFycmF5IHdpdGggYSBjaGFyYWN0ZXJcbi8vIGFuZCBhIDMyLWJpdCBpbnRlZ2VyLlxuLy8gRmlyc3QgdmFsdWU6IGEgdXRmLTE2IGNoYXJhY3Rlci5cbi8vIFNlY29uZCB2YWx1ZTpcbi8vIE5leHQgOSBiaXRzOiBiYWNrZ3JvdW5kIGNvbG9yICgwLTUxMSkuXG4vLyBOZXh0IDkgYml0czogZm9yZWdyb3VuZCBjb2xvciAoMC01MTEpLlxuLy8gTmV4dCAxNCBiaXRzOiBhIG1hc2sgZm9yIG1pc2MuIGZsYWdzOlxuLy8gICAxPWJvbGQsIDI9dW5kZXJsaW5lLCA0PWludmVyc2VcblxuVGVybWluYWwucHJvdG90eXBlLnJlZnJlc2ggPSBmdW5jdGlvbihzdGFydCwgZW5kKSB7XG4gIHZhciB4XG4gICAgLCB5XG4gICAgLCBpXG4gICAgLCBsaW5lXG4gICAgLCBvdXRcbiAgICAsIGNoXG4gICAgLCB3aWR0aFxuICAgICwgZGF0YVxuICAgICwgYXR0clxuICAgICwgZmdDb2xvclxuICAgICwgYmdDb2xvclxuICAgICwgZmxhZ3NcbiAgICAsIHJvd1xuICAgICwgcGFyZW50O1xuXG4gIGlmIChlbmQgLSBzdGFydCA+PSB0aGlzLnJvd3MgLyAyKSB7XG4gICAgcGFyZW50ID0gdGhpcy5lbGVtZW50LnBhcmVudE5vZGU7XG4gICAgaWYgKHBhcmVudCkgcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuZWxlbWVudCk7XG4gIH1cblxuICB3aWR0aCA9IHRoaXMuY29scztcbiAgeSA9IHN0YXJ0O1xuXG4gIC8vIGlmIChlbmQgPiB0aGlzLmxpbmVzLmxlbmd0aCkge1xuICAvLyAgIGVuZCA9IHRoaXMubGluZXMubGVuZ3RoO1xuICAvLyB9XG5cbiAgZm9yICg7IHkgPD0gZW5kOyB5KyspIHtcbiAgICByb3cgPSB5ICsgdGhpcy55ZGlzcDtcblxuICAgIGxpbmUgPSB0aGlzLmxpbmVzW3Jvd107XG4gICAgb3V0ID0gJyc7XG5cbiAgICBpZiAoeSA9PT0gdGhpcy55XG4gICAgICAgICYmIHRoaXMuY3Vyc29yU3RhdGVcbiAgICAgICAgJiYgdGhpcy55ZGlzcCA9PT0gdGhpcy55YmFzZVxuICAgICAgICAmJiAhdGhpcy5jdXJzb3JIaWRkZW4pIHtcbiAgICAgIHggPSB0aGlzLng7XG4gICAgfSBlbHNlIHtcbiAgICAgIHggPSAtMTtcbiAgICB9XG5cbiAgICBhdHRyID0gdGhpcy5kZWZBdHRyO1xuICAgIGkgPSAwO1xuXG4gICAgZm9yICg7IGkgPCB3aWR0aDsgaSsrKSB7XG4gICAgICBkYXRhID0gbGluZVtpXVswXTtcbiAgICAgIGNoID0gbGluZVtpXVsxXTtcblxuICAgICAgaWYgKGkgPT09IHgpIGRhdGEgPSAtMTtcblxuICAgICAgaWYgKGRhdGEgIT09IGF0dHIpIHtcbiAgICAgICAgaWYgKGF0dHIgIT09IHRoaXMuZGVmQXR0cikge1xuICAgICAgICAgIG91dCArPSAnPC9zcGFuPic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEgIT09IHRoaXMuZGVmQXR0cikge1xuICAgICAgICAgIGlmIChkYXRhID09PSAtMSkge1xuICAgICAgICAgICAgb3V0ICs9ICc8c3BhbiBjbGFzcz1cInJldmVyc2UtdmlkZW9cIj4nO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvdXQgKz0gJzxzcGFuIHN0eWxlPVwiJztcblxuICAgICAgICAgICAgYmdDb2xvciA9IGRhdGEgJiAweDFmZjtcbiAgICAgICAgICAgIGZnQ29sb3IgPSAoZGF0YSA+PiA5KSAmIDB4MWZmO1xuICAgICAgICAgICAgZmxhZ3MgPSBkYXRhID4+IDE4O1xuXG4gICAgICAgICAgICBpZiAoZmxhZ3MgJiAxKSB7XG4gICAgICAgICAgICAgIGlmICghVGVybWluYWwuYnJva2VuQm9sZCkge1xuICAgICAgICAgICAgICAgIG91dCArPSAnZm9udC13ZWlnaHQ6Ym9sZDsnO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIHNlZTogWFRlcm0qYm9sZENvbG9yc1xuICAgICAgICAgICAgICBpZiAoZmdDb2xvciA8IDgpIGZnQ29sb3IgKz0gODtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZsYWdzICYgMikge1xuICAgICAgICAgICAgICBvdXQgKz0gJ3RleHQtZGVjb3JhdGlvbjp1bmRlcmxpbmU7JztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGJnQ29sb3IgIT09IDI1Nikge1xuICAgICAgICAgICAgICBvdXQgKz0gJ2JhY2tncm91bmQtY29sb3I6J1xuICAgICAgICAgICAgICAgICsgVGVybWluYWwuY29sb3JzW2JnQ29sb3JdXG4gICAgICAgICAgICAgICAgKyAnOyc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmZ0NvbG9yICE9PSAyNTcpIHtcbiAgICAgICAgICAgICAgb3V0ICs9ICdjb2xvcjonXG4gICAgICAgICAgICAgICAgKyBUZXJtaW5hbC5jb2xvcnNbZmdDb2xvcl1cbiAgICAgICAgICAgICAgICArICc7JztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb3V0ICs9ICdcIj4nO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKGNoKSB7XG4gICAgICAgIGNhc2UgJyYnOlxuICAgICAgICAgIG91dCArPSAnJmFtcDsnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgICBvdXQgKz0gJyZsdDsnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICc+JzpcbiAgICAgICAgICBvdXQgKz0gJyZndDsnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGlmIChjaCA8PSAnICcpIHtcbiAgICAgICAgICAgIG91dCArPSAnJm5ic3A7JztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3V0ICs9IGNoO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgYXR0ciA9IGRhdGE7XG4gICAgfVxuXG4gICAgaWYgKGF0dHIgIT09IHRoaXMuZGVmQXR0cikge1xuICAgICAgb3V0ICs9ICc8L3NwYW4+JztcbiAgICB9XG5cbiAgICB0aGlzLmNoaWxkcmVuW3ldLmlubmVySFRNTCA9IG91dDtcbiAgfVxuXG4gIGlmIChwYXJlbnQpIHBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLmVsZW1lbnQpO1xufTtcblxuVGVybWluYWwucHJvdG90eXBlLmN1cnNvckJsaW5rID0gZnVuY3Rpb24oKSB7XG4gIGlmIChUZXJtaW5hbC5mb2N1cyAhPT0gdGhpcykgcmV0dXJuO1xuICB0aGlzLmN1cnNvclN0YXRlIF49IDE7XG4gIHRoaXMucmVmcmVzaCh0aGlzLnksIHRoaXMueSk7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUuc2hvd0N1cnNvciA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuY3Vyc29yU3RhdGUpIHtcbiAgICB0aGlzLmN1cnNvclN0YXRlID0gMTtcbiAgICB0aGlzLnJlZnJlc2godGhpcy55LCB0aGlzLnkpO1xuICB9IGVsc2Uge1xuICAgIC8vIFRlbXBvcmFyaWx5IGRpc2FibGVkOlxuICAgIC8vIHRoaXMucmVmcmVzaEJsaW5rKCk7XG4gIH1cbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5zdGFydEJsaW5rID0gZnVuY3Rpb24oKSB7XG4gIGlmICghVGVybWluYWwuY3Vyc29yQmxpbmspIHJldHVybjtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLl9ibGlua2VyID0gZnVuY3Rpb24oKSB7XG4gICAgc2VsZi5jdXJzb3JCbGluaygpO1xuICB9O1xuICB0aGlzLl9ibGluayA9IHNldEludGVydmFsKHRoaXMuX2JsaW5rZXIsIDUwMCk7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUucmVmcmVzaEJsaW5rID0gZnVuY3Rpb24oKSB7XG4gIGlmICghVGVybWluYWwuY3Vyc29yQmxpbmspIHJldHVybjtcbiAgY2xlYXJJbnRlcnZhbCh0aGlzLl9ibGluayk7XG4gIHRoaXMuX2JsaW5rID0gc2V0SW50ZXJ2YWwodGhpcy5fYmxpbmtlciwgNTAwKTtcbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5zY3JvbGwgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHJvdztcblxuICBpZiAoKyt0aGlzLnliYXNlID09PSBUZXJtaW5hbC5zY3JvbGxiYWNrKSB7XG4gICAgdGhpcy55YmFzZSA9IHRoaXMueWJhc2UgLyAyIHwgMDtcbiAgICB0aGlzLmxpbmVzID0gdGhpcy5saW5lcy5zbGljZSgtKHRoaXMueWJhc2UgKyB0aGlzLnJvd3MpICsgMSk7XG4gIH1cblxuICB0aGlzLnlkaXNwID0gdGhpcy55YmFzZTtcblxuICAvLyBsYXN0IGxpbmVcbiAgcm93ID0gdGhpcy55YmFzZSArIHRoaXMucm93cyAtIDE7XG5cbiAgLy8gc3VidHJhY3QgdGhlIGJvdHRvbSBzY3JvbGwgcmVnaW9uXG4gIHJvdyAtPSB0aGlzLnJvd3MgLSAxIC0gdGhpcy5zY3JvbGxCb3R0b207XG5cbiAgaWYgKHJvdyA9PT0gdGhpcy5saW5lcy5sZW5ndGgpIHtcbiAgICAvLyBwb3RlbnRpYWwgb3B0aW1pemF0aW9uOlxuICAgIC8vIHB1c2hpbmcgaXMgZmFzdGVyIHRoYW4gc3BsaWNpbmdcbiAgICAvLyB3aGVuIHRoZXkgYW1vdW50IHRvIHRoZSBzYW1lXG4gICAgLy8gYmVoYXZpb3IuXG4gICAgdGhpcy5saW5lcy5wdXNoKHRoaXMuYmxhbmtMaW5lKCkpO1xuICB9IGVsc2Uge1xuICAgIC8vIGFkZCBvdXIgbmV3IGxpbmVcbiAgICB0aGlzLmxpbmVzLnNwbGljZShyb3csIDAsIHRoaXMuYmxhbmtMaW5lKCkpO1xuICB9XG5cbiAgaWYgKHRoaXMuc2Nyb2xsVG9wICE9PSAwKSB7XG4gICAgaWYgKHRoaXMueWJhc2UgIT09IDApIHtcbiAgICAgIHRoaXMueWJhc2UtLTtcbiAgICAgIHRoaXMueWRpc3AgPSB0aGlzLnliYXNlO1xuICAgIH1cbiAgICB0aGlzLmxpbmVzLnNwbGljZSh0aGlzLnliYXNlICsgdGhpcy5zY3JvbGxUb3AsIDEpO1xuICB9XG5cbiAgLy8gdGhpcy5tYXhSYW5nZSgpO1xuICB0aGlzLnVwZGF0ZVJhbmdlKHRoaXMuc2Nyb2xsVG9wKTtcbiAgdGhpcy51cGRhdGVSYW5nZSh0aGlzLnNjcm9sbEJvdHRvbSk7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUuc2Nyb2xsRGlzcCA9IGZ1bmN0aW9uKGRpc3ApIHtcbiAgdGhpcy55ZGlzcCArPSBkaXNwO1xuXG4gIGlmICh0aGlzLnlkaXNwID4gdGhpcy55YmFzZSkge1xuICAgIHRoaXMueWRpc3AgPSB0aGlzLnliYXNlO1xuICB9IGVsc2UgaWYgKHRoaXMueWRpc3AgPCAwKSB7XG4gICAgdGhpcy55ZGlzcCA9IDA7XG4gIH1cblxuICB0aGlzLnJlZnJlc2goMCwgdGhpcy5yb3dzIC0gMSk7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbihkYXRhKSB7XG4gIHZhciBsID0gZGF0YS5sZW5ndGhcbiAgICAsIGkgPSAwXG4gICAgLCBjc1xuICAgICwgY2g7XG5cbiAgdGhpcy5yZWZyZXNoU3RhcnQgPSB0aGlzLnk7XG4gIHRoaXMucmVmcmVzaEVuZCA9IHRoaXMueTtcblxuICBpZiAodGhpcy55YmFzZSAhPT0gdGhpcy55ZGlzcCkge1xuICAgIHRoaXMueWRpc3AgPSB0aGlzLnliYXNlO1xuICAgIHRoaXMubWF4UmFuZ2UoKTtcbiAgfVxuXG4gIC8vIHRoaXMubG9nKEpTT04uc3RyaW5naWZ5KGRhdGEucmVwbGFjZSgvXFx4MWIvZywgJ15bJykpKTtcblxuICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgIGNoID0gZGF0YVtpXTtcbiAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgIGNhc2Ugbm9ybWFsOlxuICAgICAgICBzd2l0Y2ggKGNoKSB7XG4gICAgICAgICAgLy8gJ1xcMCdcbiAgICAgICAgICAvLyBjYXNlICdcXDAnOlxuICAgICAgICAgIC8vIGNhc2UgJ1xcMjAwJzpcbiAgICAgICAgICAvLyAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gJ1xcYSdcbiAgICAgICAgICBjYXNlICdcXHgwNyc6XG4gICAgICAgICAgICB0aGlzLmJlbGwoKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gJ1xcbicsICdcXHYnLCAnXFxmJ1xuICAgICAgICAgIGNhc2UgJ1xcbic6XG4gICAgICAgICAgY2FzZSAnXFx4MGInOlxuICAgICAgICAgIGNhc2UgJ1xceDBjJzpcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbnZlcnRFb2wpIHtcbiAgICAgICAgICAgICAgdGhpcy54ID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMueSsrO1xuICAgICAgICAgICAgaWYgKHRoaXMueSA+IHRoaXMuc2Nyb2xsQm90dG9tKSB7XG4gICAgICAgICAgICAgIHRoaXMueS0tO1xuICAgICAgICAgICAgICB0aGlzLnNjcm9sbCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyAnXFxyJ1xuICAgICAgICAgIGNhc2UgJ1xccic6XG4gICAgICAgICAgICB0aGlzLnggPSAwO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyAnXFxiJ1xuICAgICAgICAgIGNhc2UgJ1xceDA4JzpcbiAgICAgICAgICAgIGlmICh0aGlzLnggPiAwKSB7XG4gICAgICAgICAgICAgIHRoaXMueC0tO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyAnXFx0J1xuICAgICAgICAgIGNhc2UgJ1xcdCc6XG4gICAgICAgICAgICB0aGlzLnggPSB0aGlzLm5leHRTdG9wKCk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIHNoaWZ0IG91dFxuICAgICAgICAgIGNhc2UgJ1xceDBlJzpcbiAgICAgICAgICAgIHRoaXMuc2V0Z0xldmVsKDEpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBzaGlmdCBpblxuICAgICAgICAgIGNhc2UgJ1xceDBmJzpcbiAgICAgICAgICAgIHRoaXMuc2V0Z0xldmVsKDApO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyAnXFxlJ1xuICAgICAgICAgIGNhc2UgJ1xceDFiJzpcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBlc2NhcGVkO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgLy8gJyAnXG4gICAgICAgICAgICBpZiAoY2ggPj0gJyAnKSB7XG4gICAgICAgICAgICAgIGlmICh0aGlzLmNoYXJzZXQgJiYgdGhpcy5jaGFyc2V0W2NoXSkge1xuICAgICAgICAgICAgICAgIGNoID0gdGhpcy5jaGFyc2V0W2NoXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAodGhpcy54ID49IHRoaXMuY29scykge1xuICAgICAgICAgICAgICAgIHRoaXMueCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy55Kys7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMueSA+IHRoaXMuc2Nyb2xsQm90dG9tKSB7XG4gICAgICAgICAgICAgICAgICB0aGlzLnktLTtcbiAgICAgICAgICAgICAgICAgIHRoaXMuc2Nyb2xsKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHRoaXMubGluZXNbdGhpcy55ICsgdGhpcy55YmFzZV1bdGhpcy54XSA9IFt0aGlzLmN1ckF0dHIsIGNoXTtcbiAgICAgICAgICAgICAgdGhpcy54Kys7XG4gICAgICAgICAgICAgIHRoaXMudXBkYXRlUmFuZ2UodGhpcy55KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBlc2NhcGVkOlxuICAgICAgICBzd2l0Y2ggKGNoKSB7XG4gICAgICAgICAgLy8gRVNDIFsgQ29udHJvbCBTZXF1ZW5jZSBJbnRyb2R1Y2VyICggQ1NJIGlzIDB4OWIpLlxuICAgICAgICAgIGNhc2UgJ1snOlxuICAgICAgICAgICAgdGhpcy5wYXJhbXMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFBhcmFtID0gMDtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBjc2k7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIEVTQyBdIE9wZXJhdGluZyBTeXN0ZW0gQ29tbWFuZCAoIE9TQyBpcyAweDlkKS5cbiAgICAgICAgICBjYXNlICddJzpcbiAgICAgICAgICAgIHRoaXMucGFyYW1zID0gW107XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRQYXJhbSA9IDA7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gb3NjO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgUCBEZXZpY2UgQ29udHJvbCBTdHJpbmcgKCBEQ1MgaXMgMHg5MCkuXG4gICAgICAgICAgY2FzZSAnUCc6XG4gICAgICAgICAgICB0aGlzLnBhcmFtcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50UGFyYW0gPSAwO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IGRjcztcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gRVNDIF8gQXBwbGljYXRpb24gUHJvZ3JhbSBDb21tYW5kICggQVBDIGlzIDB4OWYpLlxuICAgICAgICAgIGNhc2UgJ18nOlxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IGlnbm9yZTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gRVNDIF4gUHJpdmFjeSBNZXNzYWdlICggUE0gaXMgMHg5ZSkuXG4gICAgICAgICAgY2FzZSAnXic6XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gaWdub3JlO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgYyBGdWxsIFJlc2V0IChSSVMpLlxuICAgICAgICAgIGNhc2UgJ2MnOlxuICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgRSBOZXh0IExpbmUgKCBORUwgaXMgMHg4NSkuXG4gICAgICAgICAgLy8gRVNDIEQgSW5kZXggKCBJTkQgaXMgMHg4NCkuXG4gICAgICAgICAgY2FzZSAnRSc6XG4gICAgICAgICAgICB0aGlzLnggPSAwO1xuICAgICAgICAgICAgO1xuICAgICAgICAgIGNhc2UgJ0QnOlxuICAgICAgICAgICAgdGhpcy5pbmRleCgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgTSBSZXZlcnNlIEluZGV4ICggUkkgaXMgMHg4ZCkuXG4gICAgICAgICAgY2FzZSAnTSc6XG4gICAgICAgICAgICB0aGlzLnJldmVyc2VJbmRleCgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgJSBTZWxlY3QgZGVmYXVsdC91dGYtOCBjaGFyYWN0ZXIgc2V0LlxuICAgICAgICAgIC8vIEAgPSBkZWZhdWx0LCBHID0gdXRmLThcbiAgICAgICAgICBjYXNlICclJzpcbiAgICAgICAgICAgIC8vdGhpcy5jaGFyc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuc2V0Z0xldmVsKDApO1xuICAgICAgICAgICAgdGhpcy5zZXRnQ2hhcnNldCgwLCBUZXJtaW5hbC5jaGFyc2V0cy5VUyk7XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gbm9ybWFsO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgKCwpLCosKywtLC4gRGVzaWduYXRlIEcwLUcyIENoYXJhY3RlciBTZXQuXG4gICAgICAgICAgY2FzZSAnKCc6IC8vIDwtLSB0aGlzIHNlZW1zIHRvIGdldCBhbGwgdGhlIGF0dGVudGlvblxuICAgICAgICAgIGNhc2UgJyknOlxuICAgICAgICAgIGNhc2UgJyonOlxuICAgICAgICAgIGNhc2UgJysnOlxuICAgICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIGNhc2UgJy4nOlxuICAgICAgICAgICAgc3dpdGNoIChjaCkge1xuICAgICAgICAgICAgICBjYXNlICcoJzpcbiAgICAgICAgICAgICAgICB0aGlzLmdjaGFyc2V0ID0gMDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAnKSc6XG4gICAgICAgICAgICAgICAgdGhpcy5nY2hhcnNldCA9IDE7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJyonOlxuICAgICAgICAgICAgICAgIHRoaXMuZ2NoYXJzZXQgPSAyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICAgICAgICB0aGlzLmdjaGFyc2V0ID0gMztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgICAgICAgdGhpcy5nY2hhcnNldCA9IDE7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJy4nOlxuICAgICAgICAgICAgICAgIHRoaXMuZ2NoYXJzZXQgPSAyO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IGNoYXJzZXQ7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIERlc2lnbmF0ZSBHMyBDaGFyYWN0ZXIgU2V0IChWVDMwMCkuXG4gICAgICAgICAgLy8gQSA9IElTTyBMYXRpbi0xIFN1cHBsZW1lbnRhbC5cbiAgICAgICAgICAvLyBOb3QgaW1wbGVtZW50ZWQuXG4gICAgICAgICAgY2FzZSAnLyc6XG4gICAgICAgICAgICB0aGlzLmdjaGFyc2V0ID0gMztcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBjaGFyc2V0O1xuICAgICAgICAgICAgaS0tO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgTlxuICAgICAgICAgIC8vIFNpbmdsZSBTaGlmdCBTZWxlY3Qgb2YgRzIgQ2hhcmFjdGVyIFNldFxuICAgICAgICAgIC8vICggU1MyIGlzIDB4OGUpLiBUaGlzIGFmZmVjdHMgbmV4dCBjaGFyYWN0ZXIgb25seS5cbiAgICAgICAgICBjYXNlICdOJzpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIEVTQyBPXG4gICAgICAgICAgLy8gU2luZ2xlIFNoaWZ0IFNlbGVjdCBvZiBHMyBDaGFyYWN0ZXIgU2V0XG4gICAgICAgICAgLy8gKCBTUzMgaXMgMHg4ZikuIFRoaXMgYWZmZWN0cyBuZXh0IGNoYXJhY3RlciBvbmx5LlxuICAgICAgICAgIGNhc2UgJ08nOlxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gRVNDIG5cbiAgICAgICAgICAvLyBJbnZva2UgdGhlIEcyIENoYXJhY3RlciBTZXQgYXMgR0wgKExTMikuXG4gICAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgICB0aGlzLnNldGdMZXZlbCgyKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIEVTQyBvXG4gICAgICAgICAgLy8gSW52b2tlIHRoZSBHMyBDaGFyYWN0ZXIgU2V0IGFzIEdMIChMUzMpLlxuICAgICAgICAgIGNhc2UgJ28nOlxuICAgICAgICAgICAgdGhpcy5zZXRnTGV2ZWwoMyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAvLyBFU0MgfFxuICAgICAgICAgIC8vIEludm9rZSB0aGUgRzMgQ2hhcmFjdGVyIFNldCBhcyBHUiAoTFMzUikuXG4gICAgICAgICAgY2FzZSAnfCc6XG4gICAgICAgICAgICB0aGlzLnNldGdMZXZlbCgzKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIC8vIEVTQyB9XG4gICAgICAgICAgLy8gSW52b2tlIHRoZSBHMiBDaGFyYWN0ZXIgU2V0IGFzIEdSIChMUzJSKS5cbiAgICAgICAgICBjYXNlICd9JzpcbiAgICAgICAgICAgIHRoaXMuc2V0Z0xldmVsKDIpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gRVNDIH5cbiAgICAgICAgICAvLyBJbnZva2UgdGhlIEcxIENoYXJhY3RlciBTZXQgYXMgR1IgKExTMVIpLlxuICAgICAgICAgIGNhc2UgJ34nOlxuICAgICAgICAgICAgdGhpcy5zZXRnTGV2ZWwoMSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIEVTQyA3IFNhdmUgQ3Vyc29yIChERUNTQykuXG4gICAgICAgICAgY2FzZSAnNyc6XG4gICAgICAgICAgICB0aGlzLnNhdmVDdXJzb3IoKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBub3JtYWw7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIEVTQyA4IFJlc3RvcmUgQ3Vyc29yIChERUNSQykuXG4gICAgICAgICAgY2FzZSAnOCc6XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVDdXJzb3IoKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBub3JtYWw7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIEVTQyAjIDMgREVDIGxpbmUgaGVpZ2h0L3dpZHRoXG4gICAgICAgICAgY2FzZSAnIyc6XG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gbm9ybWFsO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgSCBUYWIgU2V0IChIVFMgaXMgMHg4OCkuXG4gICAgICAgICAgY2FzZSAnSCc6XG4gICAgICAgICAgICB0aGlzLnRhYlNldCgpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBFU0MgPSBBcHBsaWNhdGlvbiBLZXlwYWQgKERFQ1BBTSkuXG4gICAgICAgICAgY2FzZSAnPSc6XG4gICAgICAgICAgICB0aGlzLmxvZygnU2VyaWFsIHBvcnQgcmVxdWVzdGVkIGFwcGxpY2F0aW9uIGtleXBhZC4nKTtcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYXRpb25LZXlwYWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IG5vcm1hbDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gRVNDID4gTm9ybWFsIEtleXBhZCAoREVDUE5NKS5cbiAgICAgICAgICBjYXNlICc+JzpcbiAgICAgICAgICAgIHRoaXMubG9nKCdTd2l0Y2hpbmcgYmFjayB0byBub3JtYWwga2V5cGFkLicpO1xuICAgICAgICAgICAgdGhpcy5hcHBsaWNhdGlvbktleXBhZCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IG5vcm1hbDtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBub3JtYWw7XG4gICAgICAgICAgICB0aGlzLmVycm9yKCdVbmtub3duIEVTQyBjb250cm9sOiAlcy4nLCBjaCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBjaGFyc2V0OlxuICAgICAgICBzd2l0Y2ggKGNoKSB7XG4gICAgICAgICAgY2FzZSAnMCc6IC8vIERFQyBTcGVjaWFsIENoYXJhY3RlciBhbmQgTGluZSBEcmF3aW5nIFNldC5cbiAgICAgICAgICAgIGNzID0gVGVybWluYWwuY2hhcnNldHMuU0NMRDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0EnOiAvLyBVS1xuICAgICAgICAgICAgY3MgPSBUZXJtaW5hbC5jaGFyc2V0cy5VSztcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ0InOiAvLyBVbml0ZWQgU3RhdGVzIChVU0FTQ0lJKS5cbiAgICAgICAgICAgIGNzID0gVGVybWluYWwuY2hhcnNldHMuVVM7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICc0JzogLy8gRHV0Y2hcbiAgICAgICAgICAgIGNzID0gVGVybWluYWwuY2hhcnNldHMuRHV0Y2g7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdDJzogLy8gRmlubmlzaFxuICAgICAgICAgIGNhc2UgJzUnOlxuICAgICAgICAgICAgY3MgPSBUZXJtaW5hbC5jaGFyc2V0cy5GaW5uaXNoO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnUic6IC8vIEZyZW5jaFxuICAgICAgICAgICAgY3MgPSBUZXJtaW5hbC5jaGFyc2V0cy5GcmVuY2g7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdRJzogLy8gRnJlbmNoQ2FuYWRpYW5cbiAgICAgICAgICAgIGNzID0gVGVybWluYWwuY2hhcnNldHMuRnJlbmNoQ2FuYWRpYW47XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdLJzogLy8gR2VybWFuXG4gICAgICAgICAgICBjcyA9IFRlcm1pbmFsLmNoYXJzZXRzLkdlcm1hbjtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ1knOiAvLyBJdGFsaWFuXG4gICAgICAgICAgICBjcyA9IFRlcm1pbmFsLmNoYXJzZXRzLkl0YWxpYW47XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdFJzogLy8gTm9yd2VnaWFuRGFuaXNoXG4gICAgICAgICAgY2FzZSAnNic6XG4gICAgICAgICAgICBjcyA9IFRlcm1pbmFsLmNoYXJzZXRzLk5vcndlZ2lhbkRhbmlzaDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ1onOiAvLyBTcGFuaXNoXG4gICAgICAgICAgICBjcyA9IFRlcm1pbmFsLmNoYXJzZXRzLlNwYW5pc2g7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdIJzogLy8gU3dlZGlzaFxuICAgICAgICAgIGNhc2UgJzcnOlxuICAgICAgICAgICAgY3MgPSBUZXJtaW5hbC5jaGFyc2V0cy5Td2VkaXNoO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnPSc6IC8vIFN3aXNzXG4gICAgICAgICAgICBjcyA9IFRlcm1pbmFsLmNoYXJzZXRzLlN3aXNzO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnLyc6IC8vIElTT0xhdGluIChhY3R1YWxseSAvQSlcbiAgICAgICAgICAgIGNzID0gVGVybWluYWwuY2hhcnNldHMuSVNPTGF0aW47XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBkZWZhdWx0OiAvLyBEZWZhdWx0XG4gICAgICAgICAgICBjcyA9IFRlcm1pbmFsLmNoYXJzZXRzLlVTO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zZXRnQ2hhcnNldCh0aGlzLmdjaGFyc2V0LCBjcyk7XG4gICAgICAgIHRoaXMuZ2NoYXJzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLnN0YXRlID0gbm9ybWFsO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBvc2M6XG4gICAgICAgIC8vIE9TQyBQcyA7IFB0IFNUXG4gICAgICAgIC8vIE9TQyBQcyA7IFB0IEJFTFxuICAgICAgICAvLyAgIFNldCBUZXh0IFBhcmFtZXRlcnMuXG4gICAgICAgIGlmIChjaCA9PT0gJ1xceDFiJyB8fCBjaCA9PT0gJ1xceDA3Jykge1xuICAgICAgICAgIGlmIChjaCA9PT0gJ1xceDFiJykgaSsrO1xuXG4gICAgICAgICAgdGhpcy5wYXJhbXMucHVzaCh0aGlzLmN1cnJlbnRQYXJhbSk7XG5cbiAgICAgICAgICBzd2l0Y2ggKHRoaXMucGFyYW1zWzBdKSB7XG4gICAgICAgICAgICBjYXNlIDA6XG4gICAgICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgIGlmICh0aGlzLnBhcmFtc1sxXSkge1xuICAgICAgICAgICAgICAgIHRoaXMudGl0bGUgPSB0aGlzLnBhcmFtc1sxXTtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVRpdGxlKHRoaXMudGl0bGUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgICAvLyBzZXQgWCBwcm9wZXJ0eVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgIGNhc2UgNTpcbiAgICAgICAgICAgICAgLy8gY2hhbmdlIGR5bmFtaWMgY29sb3JzXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAxMDpcbiAgICAgICAgICAgIGNhc2UgMTE6XG4gICAgICAgICAgICBjYXNlIDEyOlxuICAgICAgICAgICAgY2FzZSAxMzpcbiAgICAgICAgICAgIGNhc2UgMTQ6XG4gICAgICAgICAgICBjYXNlIDE1OlxuICAgICAgICAgICAgY2FzZSAxNjpcbiAgICAgICAgICAgIGNhc2UgMTc6XG4gICAgICAgICAgICBjYXNlIDE4OlxuICAgICAgICAgICAgY2FzZSAxOTpcbiAgICAgICAgICAgICAgLy8gY2hhbmdlIGR5bmFtaWMgdWkgY29sb3JzXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA0NjpcbiAgICAgICAgICAgICAgLy8gY2hhbmdlIGxvZyBmaWxlXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA1MDpcbiAgICAgICAgICAgICAgLy8gZHluYW1pYyBmb250XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA1MTpcbiAgICAgICAgICAgICAgLy8gZW1hY3Mgc2hlbGxcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDUyOlxuICAgICAgICAgICAgICAvLyBtYW5pcHVsYXRlIHNlbGVjdGlvbiBkYXRhXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAxMDQ6XG4gICAgICAgICAgICBjYXNlIDEwNTpcbiAgICAgICAgICAgIGNhc2UgMTEwOlxuICAgICAgICAgICAgY2FzZSAxMTE6XG4gICAgICAgICAgICBjYXNlIDExMjpcbiAgICAgICAgICAgIGNhc2UgMTEzOlxuICAgICAgICAgICAgY2FzZSAxMTQ6XG4gICAgICAgICAgICBjYXNlIDExNTpcbiAgICAgICAgICAgIGNhc2UgMTE2OlxuICAgICAgICAgICAgY2FzZSAxMTc6XG4gICAgICAgICAgICBjYXNlIDExODpcbiAgICAgICAgICAgICAgLy8gcmVzZXQgY29sb3JzXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMucGFyYW1zID0gW107XG4gICAgICAgICAgdGhpcy5jdXJyZW50UGFyYW0gPSAwO1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBub3JtYWw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKCF0aGlzLnBhcmFtcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChjaCA+PSAnMCcgJiYgY2ggPD0gJzknKSB7XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudFBhcmFtID1cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRQYXJhbSAqIDEwICsgY2guY2hhckNvZGVBdCgwKSAtIDQ4O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjaCA9PT0gJzsnKSB7XG4gICAgICAgICAgICAgIHRoaXMucGFyYW1zLnB1c2godGhpcy5jdXJyZW50UGFyYW0pO1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRQYXJhbSA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnRQYXJhbSArPSBjaDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgY3NpOlxuICAgICAgICAvLyAnPycsICc+JywgJyEnXG4gICAgICAgIGlmIChjaCA9PT0gJz8nIHx8IGNoID09PSAnPicgfHwgY2ggPT09ICchJykge1xuICAgICAgICAgIHRoaXMucHJlZml4ID0gY2g7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAwIC0gOVxuICAgICAgICBpZiAoY2ggPj0gJzAnICYmIGNoIDw9ICc5Jykge1xuICAgICAgICAgIHRoaXMuY3VycmVudFBhcmFtID0gdGhpcy5jdXJyZW50UGFyYW0gKiAxMCArIGNoLmNoYXJDb2RlQXQoMCkgLSA0ODtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICckJywgJ1wiJywgJyAnLCAnXFwnJ1xuICAgICAgICBpZiAoY2ggPT09ICckJyB8fCBjaCA9PT0gJ1wiJyB8fCBjaCA9PT0gJyAnIHx8IGNoID09PSAnXFwnJykge1xuICAgICAgICAgIHRoaXMucG9zdGZpeCA9IGNoO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wYXJhbXMucHVzaCh0aGlzLmN1cnJlbnRQYXJhbSk7XG4gICAgICAgIHRoaXMuY3VycmVudFBhcmFtID0gMDtcblxuICAgICAgICAvLyAnOydcbiAgICAgICAgaWYgKGNoID09PSAnOycpIGJyZWFrO1xuXG4gICAgICAgIHRoaXMuc3RhdGUgPSBub3JtYWw7XG5cbiAgICAgICAgc3dpdGNoIChjaCkge1xuICAgICAgICAgIC8vIENTSSBQcyBBXG4gICAgICAgICAgLy8gQ3Vyc29yIFVwIFBzIFRpbWVzIChkZWZhdWx0ID0gMSkgKENVVSkuXG4gICAgICAgICAgY2FzZSAnQSc6XG4gICAgICAgICAgICB0aGlzLmN1cnNvclVwKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIEJcbiAgICAgICAgICAvLyBDdXJzb3IgRG93biBQcyBUaW1lcyAoZGVmYXVsdCA9IDEpIChDVUQpLlxuICAgICAgICAgIGNhc2UgJ0InOlxuICAgICAgICAgICAgdGhpcy5jdXJzb3JEb3duKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIENcbiAgICAgICAgICAvLyBDdXJzb3IgRm9yd2FyZCBQcyBUaW1lcyAoZGVmYXVsdCA9IDEpIChDVUYpLlxuICAgICAgICAgIGNhc2UgJ0MnOlxuICAgICAgICAgICAgdGhpcy5jdXJzb3JGb3J3YXJkKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIERcbiAgICAgICAgICAvLyBDdXJzb3IgQmFja3dhcmQgUHMgVGltZXMgKGRlZmF1bHQgPSAxKSAoQ1VCKS5cbiAgICAgICAgICBjYXNlICdEJzpcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yQmFja3dhcmQodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgOyBQcyBIXG4gICAgICAgICAgLy8gQ3Vyc29yIFBvc2l0aW9uIFtyb3c7Y29sdW1uXSAoZGVmYXVsdCA9IFsxLDFdKSAoQ1VQKS5cbiAgICAgICAgICBjYXNlICdIJzpcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yUG9zKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIEogIEVyYXNlIGluIERpc3BsYXkgKEVEKS5cbiAgICAgICAgICBjYXNlICdKJzpcbiAgICAgICAgICAgIHRoaXMuZXJhc2VJbkRpc3BsYXkodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgSyAgRXJhc2UgaW4gTGluZSAoRUwpLlxuICAgICAgICAgIGNhc2UgJ0snOlxuICAgICAgICAgICAgdGhpcy5lcmFzZUluTGluZSh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIENTSSBQbSBtICBDaGFyYWN0ZXIgQXR0cmlidXRlcyAoU0dSKS5cbiAgICAgICAgICBjYXNlICdtJzpcbiAgICAgICAgICAgIHRoaXMuY2hhckF0dHJpYnV0ZXModGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgbiAgRGV2aWNlIFN0YXR1cyBSZXBvcnQgKERTUikuXG4gICAgICAgICAgY2FzZSAnbic6XG4gICAgICAgICAgICB0aGlzLmRldmljZVN0YXR1cyh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8qKlxuICAgICAgICAgICAqIEFkZGl0aW9uc1xuICAgICAgICAgICAqL1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIEBcbiAgICAgICAgICAvLyBJbnNlcnQgUHMgKEJsYW5rKSBDaGFyYWN0ZXIocykgKGRlZmF1bHQgPSAxKSAoSUNIKS5cbiAgICAgICAgICBjYXNlICdAJzpcbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0Q2hhcnModGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgRVxuICAgICAgICAgIC8vIEN1cnNvciBOZXh0IExpbmUgUHMgVGltZXMgKGRlZmF1bHQgPSAxKSAoQ05MKS5cbiAgICAgICAgICBjYXNlICdFJzpcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yTmV4dExpbmUodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgRlxuICAgICAgICAgIC8vIEN1cnNvciBQcmVjZWRpbmcgTGluZSBQcyBUaW1lcyAoZGVmYXVsdCA9IDEpIChDTkwpLlxuICAgICAgICAgIGNhc2UgJ0YnOlxuICAgICAgICAgICAgdGhpcy5jdXJzb3JQcmVjZWRpbmdMaW5lKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIEdcbiAgICAgICAgICAvLyBDdXJzb3IgQ2hhcmFjdGVyIEFic29sdXRlICBbY29sdW1uXSAoZGVmYXVsdCA9IFtyb3csMV0pIChDSEEpLlxuICAgICAgICAgIGNhc2UgJ0cnOlxuICAgICAgICAgICAgdGhpcy5jdXJzb3JDaGFyQWJzb2x1dGUodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgTFxuICAgICAgICAgIC8vIEluc2VydCBQcyBMaW5lKHMpIChkZWZhdWx0ID0gMSkgKElMKS5cbiAgICAgICAgICBjYXNlICdMJzpcbiAgICAgICAgICAgIHRoaXMuaW5zZXJ0TGluZXModGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgTVxuICAgICAgICAgIC8vIERlbGV0ZSBQcyBMaW5lKHMpIChkZWZhdWx0ID0gMSkgKERMKS5cbiAgICAgICAgICBjYXNlICdNJzpcbiAgICAgICAgICAgIHRoaXMuZGVsZXRlTGluZXModGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgUFxuICAgICAgICAgIC8vIERlbGV0ZSBQcyBDaGFyYWN0ZXIocykgKGRlZmF1bHQgPSAxKSAoRENIKS5cbiAgICAgICAgICBjYXNlICdQJzpcbiAgICAgICAgICAgIHRoaXMuZGVsZXRlQ2hhcnModGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgWFxuICAgICAgICAgIC8vIEVyYXNlIFBzIENoYXJhY3RlcihzKSAoZGVmYXVsdCA9IDEpIChFQ0gpLlxuICAgICAgICAgIGNhc2UgJ1gnOlxuICAgICAgICAgICAgdGhpcy5lcmFzZUNoYXJzKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBtIGAgIENoYXJhY3RlciBQb3NpdGlvbiBBYnNvbHV0ZVxuICAgICAgICAgIC8vICAgW2NvbHVtbl0gKGRlZmF1bHQgPSBbcm93LDFdKSAoSFBBKS5cbiAgICAgICAgICBjYXNlICdgJzpcbiAgICAgICAgICAgIHRoaXMuY2hhclBvc0Fic29sdXRlKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gMTQxIDYxIGEgKiBIUFIgLVxuICAgICAgICAgIC8vIEhvcml6b250YWwgUG9zaXRpb24gUmVsYXRpdmVcbiAgICAgICAgICBjYXNlICdhJzpcbiAgICAgICAgICAgIHRoaXMuSFBvc2l0aW9uUmVsYXRpdmUodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUCBzIGNcbiAgICAgICAgICAvLyBTZW5kIERldmljZSBBdHRyaWJ1dGVzIChQcmltYXJ5IERBKS5cbiAgICAgICAgICAvLyBDU0kgPiBQIHMgY1xuICAgICAgICAgIC8vIFNlbmQgRGV2aWNlIEF0dHJpYnV0ZXMgKFNlY29uZGFyeSBEQSlcbiAgICAgICAgICBjYXNlICdjJzpcbiAgICAgICAgICAgIHRoaXMuc2VuZERldmljZUF0dHJpYnV0ZXModGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUG0gZFxuICAgICAgICAgIC8vIExpbmUgUG9zaXRpb24gQWJzb2x1dGUgIFtyb3ddIChkZWZhdWx0ID0gWzEsY29sdW1uXSkgKFZQQSkuXG4gICAgICAgICAgY2FzZSAnZCc6XG4gICAgICAgICAgICB0aGlzLmxpbmVQb3NBYnNvbHV0ZSh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIDE0NSA2NSBlICogVlBSIC0gVmVydGljYWwgUG9zaXRpb24gUmVsYXRpdmVcbiAgICAgICAgICBjYXNlICdlJzpcbiAgICAgICAgICAgIHRoaXMuVlBvc2l0aW9uUmVsYXRpdmUodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgOyBQcyBmXG4gICAgICAgICAgLy8gICBIb3Jpem9udGFsIGFuZCBWZXJ0aWNhbCBQb3NpdGlvbiBbcm93O2NvbHVtbl0gKGRlZmF1bHQgPVxuICAgICAgICAgIC8vICAgWzEsMV0pIChIVlApLlxuICAgICAgICAgIGNhc2UgJ2YnOlxuICAgICAgICAgICAgdGhpcy5IVlBvc2l0aW9uKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBtIGggIFNldCBNb2RlIChTTSkuXG4gICAgICAgICAgLy8gQ1NJID8gUG0gaCAtIG1vdXNlIGVzY2FwZSBjb2RlcywgY3Vyc29yIGVzY2FwZSBjb2Rlc1xuICAgICAgICAgIGNhc2UgJ2gnOlxuICAgICAgICAgICAgdGhpcy5zZXRNb2RlKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBtIGwgIFJlc2V0IE1vZGUgKFJNKS5cbiAgICAgICAgICAvLyBDU0kgPyBQbSBsXG4gICAgICAgICAgY2FzZSAnbCc6XG4gICAgICAgICAgICB0aGlzLnJlc2V0TW9kZSh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIENTSSBQcyA7IFBzIHJcbiAgICAgICAgICAvLyAgIFNldCBTY3JvbGxpbmcgUmVnaW9uIFt0b3A7Ym90dG9tXSAoZGVmYXVsdCA9IGZ1bGwgc2l6ZSBvZiB3aW4tXG4gICAgICAgICAgLy8gICBkb3cpIChERUNTVEJNKS5cbiAgICAgICAgICAvLyBDU0kgPyBQbSByXG4gICAgICAgICAgY2FzZSAncic6XG4gICAgICAgICAgICB0aGlzLnNldFNjcm9sbFJlZ2lvbih0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIENTSSBzXG4gICAgICAgICAgLy8gICBTYXZlIGN1cnNvciAoQU5TSS5TWVMpLlxuICAgICAgICAgIGNhc2UgJ3MnOlxuICAgICAgICAgICAgdGhpcy5zYXZlQ3Vyc29yKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIHVcbiAgICAgICAgICAvLyAgIFJlc3RvcmUgY3Vyc29yIChBTlNJLlNZUykuXG4gICAgICAgICAgY2FzZSAndSc6XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVDdXJzb3IodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvKipcbiAgICAgICAgICAgKiBMZXNzZXIgVXNlZFxuICAgICAgICAgICAqL1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIElcbiAgICAgICAgICAvLyBDdXJzb3IgRm9yd2FyZCBUYWJ1bGF0aW9uIFBzIHRhYiBzdG9wcyAoZGVmYXVsdCA9IDEpIChDSFQpLlxuICAgICAgICAgIGNhc2UgJ0knOlxuICAgICAgICAgICAgdGhpcy5jdXJzb3JGb3J3YXJkVGFiKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIFMgIFNjcm9sbCB1cCBQcyBsaW5lcyAoZGVmYXVsdCA9IDEpIChTVSkuXG4gICAgICAgICAgY2FzZSAnUyc6XG4gICAgICAgICAgICB0aGlzLnNjcm9sbFVwKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIFQgIFNjcm9sbCBkb3duIFBzIGxpbmVzIChkZWZhdWx0ID0gMSkgKFNEKS5cbiAgICAgICAgICAvLyBDU0kgUHMgOyBQcyA7IFBzIDsgUHMgOyBQcyBUXG4gICAgICAgICAgLy8gQ1NJID4gUHM7IFBzIFRcbiAgICAgICAgICBjYXNlICdUJzpcbiAgICAgICAgICAgIC8vIGlmICh0aGlzLnByZWZpeCA9PT0gJz4nKSB7XG4gICAgICAgICAgICAvLyAgIHRoaXMucmVzZXRUaXRsZU1vZGVzKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIC8vICAgYnJlYWs7XG4gICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAvLyBpZiAodGhpcy5wYXJhbXMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgLy8gICB0aGlzLmluaXRNb3VzZVRyYWNraW5nKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIC8vICAgYnJlYWs7XG4gICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMubGVuZ3RoIDwgMiAmJiAhdGhpcy5wcmVmaXgpIHtcbiAgICAgICAgICAgICAgdGhpcy5zY3JvbGxEb3duKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIFpcbiAgICAgICAgICAvLyBDdXJzb3IgQmFja3dhcmQgVGFidWxhdGlvbiBQcyB0YWIgc3RvcHMgKGRlZmF1bHQgPSAxKSAoQ0JUKS5cbiAgICAgICAgICBjYXNlICdaJzpcbiAgICAgICAgICAgIHRoaXMuY3Vyc29yQmFja3dhcmRUYWIodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgYiAgUmVwZWF0IHRoZSBwcmVjZWRpbmcgZ3JhcGhpYyBjaGFyYWN0ZXIgUHMgdGltZXMgKFJFUCkuXG4gICAgICAgICAgY2FzZSAnYic6XG4gICAgICAgICAgICB0aGlzLnJlcGVhdFByZWNlZGluZ0NoYXJhY3Rlcih0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIC8vIENTSSBQcyBnICBUYWIgQ2xlYXIgKFRCQykuXG4gICAgICAgICAgY2FzZSAnZyc6XG4gICAgICAgICAgICB0aGlzLnRhYkNsZWFyKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBtIGkgIE1lZGlhIENvcHkgKE1DKS5cbiAgICAgICAgICAvLyBDU0kgPyBQbSBpXG4gICAgICAgICAgLy8gY2FzZSAnaSc6XG4gICAgICAgICAgLy8gICB0aGlzLm1lZGlhQ29weSh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgLy8gICBicmVhaztcblxuICAgICAgICAgIC8vIENTSSBQbSBtICBDaGFyYWN0ZXIgQXR0cmlidXRlcyAoU0dSKS5cbiAgICAgICAgICAvLyBDU0kgPiBQczsgUHMgbVxuICAgICAgICAgIC8vIGNhc2UgJ20nOiAvLyBkdXBsaWNhdGVcbiAgICAgICAgICAvLyAgIGlmICh0aGlzLnByZWZpeCA9PT0gJz4nKSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuc2V0UmVzb3VyY2VzKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuY2hhckF0dHJpYnV0ZXModGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfVxuICAgICAgICAgIC8vICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgbiAgRGV2aWNlIFN0YXR1cyBSZXBvcnQgKERTUikuXG4gICAgICAgICAgLy8gQ1NJID4gUHMgblxuICAgICAgICAgIC8vIGNhc2UgJ24nOiAvLyBkdXBsaWNhdGVcbiAgICAgICAgICAvLyAgIGlmICh0aGlzLnByZWZpeCA9PT0gJz4nKSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuZGlzYWJsZU1vZGlmaWVycyh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgLy8gICB9IGVsc2Uge1xuICAgICAgICAgIC8vICAgICB0aGlzLmRldmljZVN0YXR1cyh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgLy8gICB9XG4gICAgICAgICAgLy8gICBicmVhaztcblxuICAgICAgICAgIC8vIENTSSA+IFBzIHAgIFNldCBwb2ludGVyIG1vZGUuXG4gICAgICAgICAgLy8gQ1NJICEgcCAgIFNvZnQgdGVybWluYWwgcmVzZXQgKERFQ1NUUikuXG4gICAgICAgICAgLy8gQ1NJIFBzJCBwXG4gICAgICAgICAgLy8gICBSZXF1ZXN0IEFOU0kgbW9kZSAoREVDUlFNKS5cbiAgICAgICAgICAvLyBDU0kgPyBQcyQgcFxuICAgICAgICAgIC8vICAgUmVxdWVzdCBERUMgcHJpdmF0ZSBtb2RlIChERUNSUU0pLlxuICAgICAgICAgIC8vIENTSSBQcyA7IFBzIFwiIHBcbiAgICAgICAgICBjYXNlICdwJzpcbiAgICAgICAgICAgIHN3aXRjaCAodGhpcy5wcmVmaXgpIHtcbiAgICAgICAgICAgICAgLy8gY2FzZSAnPic6XG4gICAgICAgICAgICAgIC8vICAgdGhpcy5zZXRQb2ludGVyTW9kZSh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICAgIC8vICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgJyEnOlxuICAgICAgICAgICAgICAgIHRoaXMuc29mdFJlc2V0KHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgLy8gY2FzZSAnPyc6XG4gICAgICAgICAgICAgIC8vICAgaWYgKHRoaXMucG9zdGZpeCA9PT0gJyQnKSB7XG4gICAgICAgICAgICAgIC8vICAgICB0aGlzLnJlcXVlc3RQcml2YXRlTW9kZSh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICAgIC8vICAgfVxuICAgICAgICAgICAgICAvLyAgIGJyZWFrO1xuICAgICAgICAgICAgICAvLyBkZWZhdWx0OlxuICAgICAgICAgICAgICAvLyAgIGlmICh0aGlzLnBvc3RmaXggPT09ICdcIicpIHtcbiAgICAgICAgICAgICAgLy8gICAgIHRoaXMuc2V0Q29uZm9ybWFuY2VMZXZlbCh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgICAgIC8vICAgfSBlbHNlIGlmICh0aGlzLnBvc3RmaXggPT09ICckJykge1xuICAgICAgICAgICAgICAvLyAgICAgdGhpcy5yZXF1ZXN0QW5zaU1vZGUodGhpcy5wYXJhbXMpO1xuICAgICAgICAgICAgICAvLyAgIH1cbiAgICAgICAgICAgICAgLy8gICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIHEgIExvYWQgTEVEcyAoREVDTEwpLlxuICAgICAgICAgIC8vIENTSSBQcyBTUCBxXG4gICAgICAgICAgLy8gQ1NJIFBzIFwiIHFcbiAgICAgICAgICAvLyBjYXNlICdxJzpcbiAgICAgICAgICAvLyAgIGlmICh0aGlzLnBvc3RmaXggPT09ICcgJykge1xuICAgICAgICAgIC8vICAgICB0aGlzLnNldEN1cnNvclN0eWxlKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gICB9XG4gICAgICAgICAgLy8gICBpZiAodGhpcy5wb3N0Zml4ID09PSAnXCInKSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuc2V0Q2hhclByb3RlY3Rpb25BdHRyKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgICAgYnJlYWs7XG4gICAgICAgICAgLy8gICB9XG4gICAgICAgICAgLy8gICB0aGlzLmxvYWRMRURzKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIDsgUHMgclxuICAgICAgICAgIC8vICAgU2V0IFNjcm9sbGluZyBSZWdpb24gW3RvcDtib3R0b21dIChkZWZhdWx0ID0gZnVsbCBzaXplIG9mIHdpbi1cbiAgICAgICAgICAvLyAgIGRvdykgKERFQ1NUQk0pLlxuICAgICAgICAgIC8vIENTSSA/IFBtIHJcbiAgICAgICAgICAvLyBDU0kgUHQ7IFBsOyBQYjsgUHI7IFBzJCByXG4gICAgICAgICAgLy8gY2FzZSAncic6IC8vIGR1cGxpY2F0ZVxuICAgICAgICAgIC8vICAgaWYgKHRoaXMucHJlZml4ID09PSAnPycpIHtcbiAgICAgICAgICAvLyAgICAgdGhpcy5yZXN0b3JlUHJpdmF0ZVZhbHVlcyh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgLy8gICB9IGVsc2UgaWYgKHRoaXMucG9zdGZpeCA9PT0gJyQnKSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuc2V0QXR0ckluUmVjdGFuZ2xlKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuc2V0U2Nyb2xsUmVnaW9uKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH1cbiAgICAgICAgICAvLyAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIHMgICAgIFNhdmUgY3Vyc29yIChBTlNJLlNZUykuXG4gICAgICAgICAgLy8gQ1NJID8gUG0gc1xuICAgICAgICAgIC8vIGNhc2UgJ3MnOiAvLyBkdXBsaWNhdGVcbiAgICAgICAgICAvLyAgIGlmICh0aGlzLnByZWZpeCA9PT0gJz8nKSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuc2F2ZVByaXZhdGVWYWx1ZXModGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyAgICAgdGhpcy5zYXZlQ3Vyc29yKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH1cbiAgICAgICAgICAvLyAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzIDsgUHMgOyBQcyB0XG4gICAgICAgICAgLy8gQ1NJIFB0OyBQbDsgUGI7IFByOyBQcyQgdFxuICAgICAgICAgIC8vIENTSSA+IFBzOyBQcyB0XG4gICAgICAgICAgLy8gQ1NJIFBzIFNQIHRcbiAgICAgICAgICAvLyBjYXNlICd0JzpcbiAgICAgICAgICAvLyAgIGlmICh0aGlzLnBvc3RmaXggPT09ICckJykge1xuICAgICAgICAgIC8vICAgICB0aGlzLnJldmVyc2VBdHRySW5SZWN0YW5nbGUodGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfSBlbHNlIGlmICh0aGlzLnBvc3RmaXggPT09ICcgJykge1xuICAgICAgICAgIC8vICAgICB0aGlzLnNldFdhcm5pbmdCZWxsVm9sdW1lKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gICAgIGlmICh0aGlzLnByZWZpeCA9PT0gJz4nKSB7XG4gICAgICAgICAgLy8gICAgICAgdGhpcy5zZXRUaXRsZU1vZGVGZWF0dXJlKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyAgICAgICB0aGlzLm1hbmlwdWxhdGVXaW5kb3codGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgICB9XG4gICAgICAgICAgLy8gICB9XG4gICAgICAgICAgLy8gICBicmVhaztcblxuICAgICAgICAgIC8vIENTSSB1ICAgICBSZXN0b3JlIGN1cnNvciAoQU5TSS5TWVMpLlxuICAgICAgICAgIC8vIENTSSBQcyBTUCB1XG4gICAgICAgICAgLy8gY2FzZSAndSc6IC8vIGR1cGxpY2F0ZVxuICAgICAgICAgIC8vICAgaWYgKHRoaXMucG9zdGZpeCA9PT0gJyAnKSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuc2V0TWFyZ2luQmVsbFZvbHVtZSh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgLy8gICB9IGVsc2Uge1xuICAgICAgICAgIC8vICAgICB0aGlzLnJlc3RvcmVDdXJzb3IodGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfVxuICAgICAgICAgIC8vICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHQ7IFBsOyBQYjsgUHI7IFBwOyBQdDsgUGw7IFBwJCB2XG4gICAgICAgICAgLy8gY2FzZSAndic6XG4gICAgICAgICAgLy8gICBpZiAodGhpcy5wb3N0Zml4ID09PSAnJCcpIHtcbiAgICAgICAgICAvLyAgICAgdGhpcy5jb3B5UmVjdGFnbGUodGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfVxuICAgICAgICAgIC8vICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHQgOyBQbCA7IFBiIDsgUHIgJyB3XG4gICAgICAgICAgLy8gY2FzZSAndyc6XG4gICAgICAgICAgLy8gICBpZiAodGhpcy5wb3N0Zml4ID09PSAnXFwnJykge1xuICAgICAgICAgIC8vICAgICB0aGlzLmVuYWJsZUZpbHRlclJlY3RhbmdsZSh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgLy8gICB9XG4gICAgICAgICAgLy8gICBicmVhaztcblxuICAgICAgICAgIC8vIENTSSBQcyB4ICBSZXF1ZXN0IFRlcm1pbmFsIFBhcmFtZXRlcnMgKERFQ1JFUVRQQVJNKS5cbiAgICAgICAgICAvLyBDU0kgUHMgeCAgU2VsZWN0IEF0dHJpYnV0ZSBDaGFuZ2UgRXh0ZW50IChERUNTQUNFKS5cbiAgICAgICAgICAvLyBDU0kgUGM7IFB0OyBQbDsgUGI7IFByJCB4XG4gICAgICAgICAgLy8gY2FzZSAneCc6XG4gICAgICAgICAgLy8gICBpZiAodGhpcy5wb3N0Zml4ID09PSAnJCcpIHtcbiAgICAgICAgICAvLyAgICAgdGhpcy5maWxsUmVjdGFuZ2xlKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMucmVxdWVzdFBhcmFtZXRlcnModGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgICAvL3RoaXMuX18odGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfVxuICAgICAgICAgIC8vICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUHMgOyBQdSAnIHpcbiAgICAgICAgICAvLyBDU0kgUHQ7IFBsOyBQYjsgUHIkIHpcbiAgICAgICAgICAvLyBjYXNlICd6JzpcbiAgICAgICAgICAvLyAgIGlmICh0aGlzLnBvc3RmaXggPT09ICdcXCcnKSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuZW5hYmxlTG9jYXRvclJlcG9ydGluZyh0aGlzLnBhcmFtcyk7XG4gICAgICAgICAgLy8gICB9IGVsc2UgaWYgKHRoaXMucG9zdGZpeCA9PT0gJyQnKSB7XG4gICAgICAgICAgLy8gICAgIHRoaXMuZXJhc2VSZWN0YW5nbGUodGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfVxuICAgICAgICAgIC8vICAgYnJlYWs7XG5cbiAgICAgICAgICAvLyBDU0kgUG0gJyB7XG4gICAgICAgICAgLy8gQ1NJIFB0OyBQbDsgUGI7IFByJCB7XG4gICAgICAgICAgLy8gY2FzZSAneyc6XG4gICAgICAgICAgLy8gICBpZiAodGhpcy5wb3N0Zml4ID09PSAnXFwnJykge1xuICAgICAgICAgIC8vICAgICB0aGlzLnNldExvY2F0b3JFdmVudHModGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfSBlbHNlIGlmICh0aGlzLnBvc3RmaXggPT09ICckJykge1xuICAgICAgICAgIC8vICAgICB0aGlzLnNlbGVjdGl2ZUVyYXNlUmVjdGFuZ2xlKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH1cbiAgICAgICAgICAvLyAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFBzICcgfFxuICAgICAgICAgIC8vIGNhc2UgJ3wnOlxuICAgICAgICAgIC8vICAgaWYgKHRoaXMucG9zdGZpeCA9PT0gJ1xcJycpIHtcbiAgICAgICAgICAvLyAgICAgdGhpcy5yZXF1ZXN0TG9jYXRvclBvc2l0aW9uKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH1cbiAgICAgICAgICAvLyAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFAgbSBTUCB9XG4gICAgICAgICAgLy8gSW5zZXJ0IFAgcyBDb2x1bW4ocykgKGRlZmF1bHQgPSAxKSAoREVDSUMpLCBWVDQyMCBhbmQgdXAuXG4gICAgICAgICAgLy8gY2FzZSAnfSc6XG4gICAgICAgICAgLy8gICBpZiAodGhpcy5wb3N0Zml4ID09PSAnICcpIHtcbiAgICAgICAgICAvLyAgICAgdGhpcy5pbnNlcnRDb2x1bW5zKHRoaXMucGFyYW1zKTtcbiAgICAgICAgICAvLyAgIH1cbiAgICAgICAgICAvLyAgIGJyZWFrO1xuXG4gICAgICAgICAgLy8gQ1NJIFAgbSBTUCB+XG4gICAgICAgICAgLy8gRGVsZXRlIFAgcyBDb2x1bW4ocykgKGRlZmF1bHQgPSAxKSAoREVDREMpLCBWVDQyMCBhbmQgdXBcbiAgICAgICAgICAvLyBjYXNlICd+JzpcbiAgICAgICAgICAvLyAgIGlmICh0aGlzLnBvc3RmaXggPT09ICcgJykge1xuICAgICAgICAgIC8vICAgICB0aGlzLmRlbGV0ZUNvbHVtbnModGhpcy5wYXJhbXMpO1xuICAgICAgICAgIC8vICAgfVxuICAgICAgICAgIC8vICAgYnJlYWs7XG5cbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhpcy5lcnJvcignVW5rbm93biBDU0kgY29kZTogJXMuJywgY2gpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnByZWZpeCA9ICcnO1xuICAgICAgICB0aGlzLnBvc3RmaXggPSAnJztcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgZGNzOlxuICAgICAgICBpZiAoY2ggPT09ICdcXHgxYicgfHwgY2ggPT09ICdcXHgwNycpIHtcbiAgICAgICAgICBpZiAoY2ggPT09ICdcXHgxYicpIGkrKztcblxuICAgICAgICAgIHN3aXRjaCAodGhpcy5wcmVmaXgpIHtcbiAgICAgICAgICAgIC8vIFVzZXItRGVmaW5lZCBLZXlzIChERUNVREspLlxuICAgICAgICAgICAgY2FzZSAnJzpcbiAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIC8vIFJlcXVlc3QgU3RhdHVzIFN0cmluZyAoREVDUlFTUykuXG4gICAgICAgICAgICAvLyB0ZXN0OiBlY2hvIC1lICdcXGVQJHFcInBcXGVcXFxcJ1xuICAgICAgICAgICAgY2FzZSAnJHEnOlxuICAgICAgICAgICAgICB2YXIgcHQgPSB0aGlzLmN1cnJlbnRQYXJhbVxuICAgICAgICAgICAgICAgICwgdmFsaWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgICBzd2l0Y2ggKHB0KSB7XG4gICAgICAgICAgICAgICAgLy8gREVDU0NBXG4gICAgICAgICAgICAgICAgY2FzZSAnXCJxJzpcbiAgICAgICAgICAgICAgICAgIHB0ID0gJzBcInEnO1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAvLyBERUNTQ0xcbiAgICAgICAgICAgICAgICBjYXNlICdcInAnOlxuICAgICAgICAgICAgICAgICAgcHQgPSAnNjFcInAnO1xuICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAvLyBERUNTVEJNXG4gICAgICAgICAgICAgICAgY2FzZSAncic6XG4gICAgICAgICAgICAgICAgICBwdCA9ICcnXG4gICAgICAgICAgICAgICAgICAgICsgKHRoaXMuc2Nyb2xsVG9wICsgMSlcbiAgICAgICAgICAgICAgICAgICAgKyAnOydcbiAgICAgICAgICAgICAgICAgICAgKyAodGhpcy5zY3JvbGxCb3R0b20gKyAxKVxuICAgICAgICAgICAgICAgICAgICArICdyJztcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgLy8gU0dSXG4gICAgICAgICAgICAgICAgY2FzZSAnbSc6XG4gICAgICAgICAgICAgICAgICBwdCA9ICcwbSc7XG4gICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICB0aGlzLmVycm9yKCdVbmtub3duIERDUyBQdDogJXMuJywgcHQpO1xuICAgICAgICAgICAgICAgICAgcHQgPSAnJztcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdGhpcy5zZW5kKCdcXHgxYlAnICsgK3ZhbGlkICsgJyRyJyArIHB0ICsgJ1xceDFiXFxcXCcpO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgLy8gU2V0IFRlcm1jYXAvVGVybWluZm8gRGF0YSAoeHRlcm0sIGV4cGVyaW1lbnRhbCkuXG4gICAgICAgICAgICBjYXNlICcrcCc6XG4gICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAvLyBSZXF1ZXN0IFRlcm1jYXAvVGVybWluZm8gU3RyaW5nICh4dGVybSwgZXhwZXJpbWVudGFsKVxuICAgICAgICAgICAgLy8gUmVndWxhciB4dGVybSBkb2VzIG5vdCBldmVuIHJlc3BvbmQgdG8gdGhpcyBzZXF1ZW5jZS5cbiAgICAgICAgICAgIC8vIFRoaXMgY2FuIGNhdXNlIGEgc21hbGwgZ2xpdGNoIGluIHZpbS5cbiAgICAgICAgICAgIC8vIHRlc3Q6IGVjaG8gLW5lICdcXGVQK3E2YjY0XFxlXFxcXCdcbiAgICAgICAgICAgIGNhc2UgJytxJzpcbiAgICAgICAgICAgICAgdmFyIHB0ID0gdGhpcy5jdXJyZW50UGFyYW1cbiAgICAgICAgICAgICAgICAsIHZhbGlkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgdGhpcy5zZW5kKCdcXHgxYlAnICsgK3ZhbGlkICsgJytyJyArIHB0ICsgJ1xceDFiXFxcXCcpO1xuICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgdGhpcy5lcnJvcignVW5rbm93biBEQ1MgcHJlZml4OiAlcy4nLCB0aGlzLnByZWZpeCk7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY3VycmVudFBhcmFtID0gMDtcbiAgICAgICAgICB0aGlzLnByZWZpeCA9ICcnO1xuICAgICAgICAgIHRoaXMuc3RhdGUgPSBub3JtYWw7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuY3VycmVudFBhcmFtKSB7XG4gICAgICAgICAgaWYgKCF0aGlzLnByZWZpeCAmJiBjaCAhPT0gJyQnICYmIGNoICE9PSAnKycpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFBhcmFtID0gY2g7XG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnByZWZpeC5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudFBhcmFtID0gY2g7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucHJlZml4ICs9IGNoO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmN1cnJlbnRQYXJhbSArPSBjaDtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSBpZ25vcmU6XG4gICAgICAgIC8vIEZvciBQTSBhbmQgQVBDLlxuICAgICAgICBpZiAoY2ggPT09ICdcXHgxYicgfHwgY2ggPT09ICdcXHgwNycpIHtcbiAgICAgICAgICBpZiAoY2ggPT09ICdcXHgxYicpIGkrKztcbiAgICAgICAgICB0aGlzLnN0YXRlID0gbm9ybWFsO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHRoaXMudXBkYXRlUmFuZ2UodGhpcy55KTtcbiAgdGhpcy5yZWZyZXNoKHRoaXMucmVmcmVzaFN0YXJ0LCB0aGlzLnJlZnJlc2hFbmQpO1xufTtcblxuVGVybWluYWwucHJvdG90eXBlLndyaXRlbG4gPSBmdW5jdGlvbihkYXRhKSB7XG4gIHRoaXMud3JpdGUoZGF0YSArICdcXHJcXG4nKTtcbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5rZXlEb3duID0gZnVuY3Rpb24oZXYpIHtcbiAgdmFyIGtleTtcblxuICBzd2l0Y2ggKGV2LmtleUNvZGUpIHtcbiAgICAvLyBiYWNrc3BhY2VcbiAgICBjYXNlIDg6XG4gICAgICBpZiAoZXYuc2hpZnRLZXkpIHtcbiAgICAgICAga2V5ID0gJ1xceDA4JzsgLy8gXkhcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBrZXkgPSAnXFx4N2YnOyAvLyBeP1xuICAgICAgYnJlYWs7XG4gICAgLy8gdGFiXG4gICAgY2FzZSA5OlxuICAgICAgaWYgKGV2LnNoaWZ0S2V5KSB7XG4gICAgICAgIGtleSA9ICdcXHgxYltaJztcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBrZXkgPSAnXFx0JztcbiAgICAgIGJyZWFrO1xuICAgIC8vIHJldHVybi9lbnRlclxuICAgIGNhc2UgMTM6XG4gICAgICBrZXkgPSAnXFxyJztcbiAgICAgIGJyZWFrO1xuICAgIC8vIGVzY2FwZVxuICAgIGNhc2UgMjc6XG4gICAgICBrZXkgPSAnXFx4MWInO1xuICAgICAgYnJlYWs7XG4gICAgLy8gbGVmdC1hcnJvd1xuICAgIGNhc2UgMzc6XG4gICAgICBpZiAodGhpcy5hcHBsaWNhdGlvbkN1cnNvcikge1xuICAgICAgICBrZXkgPSAnXFx4MWJPRCc7IC8vIFNTMyBhcyBeW08gZm9yIDctYml0XG4gICAgICAgIC8va2V5ID0gJ1xceDhmRCc7IC8vIFNTMyBhcyAweDhmIGZvciA4LWJpdFxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGtleSA9ICdcXHgxYltEJztcbiAgICAgIGJyZWFrO1xuICAgIC8vIHJpZ2h0LWFycm93XG4gICAgY2FzZSAzOTpcbiAgICAgIGlmICh0aGlzLmFwcGxpY2F0aW9uQ3Vyc29yKSB7XG4gICAgICAgIGtleSA9ICdcXHgxYk9DJztcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBrZXkgPSAnXFx4MWJbQyc7XG4gICAgICBicmVhaztcbiAgICAvLyB1cC1hcnJvd1xuICAgIGNhc2UgMzg6XG4gICAgICBpZiAodGhpcy5hcHBsaWNhdGlvbkN1cnNvcikge1xuICAgICAgICBrZXkgPSAnXFx4MWJPQSc7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGV2LmN0cmxLZXkpIHtcbiAgICAgICAgdGhpcy5zY3JvbGxEaXNwKC0xKTtcbiAgICAgICAgcmV0dXJuIGNhbmNlbChldik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBrZXkgPSAnXFx4MWJbQSc7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICAvLyBkb3duLWFycm93XG4gICAgY2FzZSA0MDpcbiAgICAgIGlmICh0aGlzLmFwcGxpY2F0aW9uQ3Vyc29yKSB7XG4gICAgICAgIGtleSA9ICdcXHgxYk9CJztcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoZXYuY3RybEtleSkge1xuICAgICAgICB0aGlzLnNjcm9sbERpc3AoMSk7XG4gICAgICAgIHJldHVybiBjYW5jZWwoZXYpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAga2V5ID0gJ1xceDFiW0InO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgLy8gZGVsZXRlXG4gICAgY2FzZSA0NjpcbiAgICAgIGtleSA9ICdcXHgxYlszfic7XG4gICAgICBicmVhaztcbiAgICAvLyBpbnNlcnRcbiAgICBjYXNlIDQ1OlxuICAgICAga2V5ID0gJ1xceDFiWzJ+JztcbiAgICAgIGJyZWFrO1xuICAgIC8vIGhvbWVcbiAgICBjYXNlIDM2OlxuICAgICAgaWYgKHRoaXMuYXBwbGljYXRpb25LZXlwYWQpIHtcbiAgICAgICAga2V5ID0gJ1xceDFiT0gnO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGtleSA9ICdcXHgxYk9IJztcbiAgICAgIGJyZWFrO1xuICAgIC8vIGVuZFxuICAgIGNhc2UgMzU6XG4gICAgICBpZiAodGhpcy5hcHBsaWNhdGlvbktleXBhZCkge1xuICAgICAgICBrZXkgPSAnXFx4MWJPRic7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAga2V5ID0gJ1xceDFiT0YnO1xuICAgICAgYnJlYWs7XG4gICAgLy8gcGFnZSB1cFxuICAgIGNhc2UgMzM6XG4gICAgICBpZiAoZXYuc2hpZnRLZXkpIHtcbiAgICAgICAgdGhpcy5zY3JvbGxEaXNwKC0odGhpcy5yb3dzIC0gMSkpO1xuICAgICAgICByZXR1cm4gY2FuY2VsKGV2KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGtleSA9ICdcXHgxYls1fic7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICAvLyBwYWdlIGRvd25cbiAgICBjYXNlIDM0OlxuICAgICAgaWYgKGV2LnNoaWZ0S2V5KSB7XG4gICAgICAgIHRoaXMuc2Nyb2xsRGlzcCh0aGlzLnJvd3MgLSAxKTtcbiAgICAgICAgcmV0dXJuIGNhbmNlbChldik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBrZXkgPSAnXFx4MWJbNn4nO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgLy8gRjFcbiAgICBjYXNlIDExMjpcbiAgICAgIGtleSA9ICdcXHgxYk9QJztcbiAgICAgIGJyZWFrO1xuICAgIC8vIEYyXG4gICAgY2FzZSAxMTM6XG4gICAgICBrZXkgPSAnXFx4MWJPUSc7XG4gICAgICBicmVhaztcbiAgICAvLyBGM1xuICAgIGNhc2UgMTE0OlxuICAgICAga2V5ID0gJ1xceDFiT1InO1xuICAgICAgYnJlYWs7XG4gICAgLy8gRjRcbiAgICBjYXNlIDExNTpcbiAgICAgIGtleSA9ICdcXHgxYk9TJztcbiAgICAgIGJyZWFrO1xuICAgIC8vIEY1XG4gICAgY2FzZSAxMTY6XG4gICAgICBrZXkgPSAnXFx4MWJbMTV+JztcbiAgICAgIGJyZWFrO1xuICAgIC8vIEY2XG4gICAgY2FzZSAxMTc6XG4gICAgICBrZXkgPSAnXFx4MWJbMTd+JztcbiAgICAgIGJyZWFrO1xuICAgIC8vIEY3XG4gICAgY2FzZSAxMTg6XG4gICAgICBrZXkgPSAnXFx4MWJbMTh+JztcbiAgICAgIGJyZWFrO1xuICAgIC8vIEY4XG4gICAgY2FzZSAxMTk6XG4gICAgICBrZXkgPSAnXFx4MWJbMTl+JztcbiAgICAgIGJyZWFrO1xuICAgIC8vIEY5XG4gICAgY2FzZSAxMjA6XG4gICAgICBrZXkgPSAnXFx4MWJbMjB+JztcbiAgICAgIGJyZWFrO1xuICAgIC8vIEYxMFxuICAgIGNhc2UgMTIxOlxuICAgICAga2V5ID0gJ1xceDFiWzIxfic7XG4gICAgICBicmVhaztcbiAgICAvLyBGMTFcbiAgICBjYXNlIDEyMjpcbiAgICAgIGtleSA9ICdcXHgxYlsyM34nO1xuICAgICAgYnJlYWs7XG4gICAgLy8gRjEyXG4gICAgY2FzZSAxMjM6XG4gICAgICBrZXkgPSAnXFx4MWJbMjR+JztcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICAvLyBhLXogYW5kIHNwYWNlXG4gICAgICBpZiAoZXYuY3RybEtleSkge1xuICAgICAgICBpZiAoZXYua2V5Q29kZSA+PSA2NSAmJiBldi5rZXlDb2RlIDw9IDkwKSB7XG4gICAgICAgICAga2V5ID0gU3RyaW5nLmZyb21DaGFyQ29kZShldi5rZXlDb2RlIC0gNjQpO1xuICAgICAgICB9IGVsc2UgaWYgKGV2LmtleUNvZGUgPT09IDMyKSB7XG4gICAgICAgICAgLy8gTlVMXG4gICAgICAgICAga2V5ID0gU3RyaW5nLmZyb21DaGFyQ29kZSgwKTtcbiAgICAgICAgfSBlbHNlIGlmIChldi5rZXlDb2RlID49IDUxICYmIGV2LmtleUNvZGUgPD0gNTUpIHtcbiAgICAgICAgICAvLyBlc2NhcGUsIGZpbGUgc2VwLCBncm91cCBzZXAsIHJlY29yZCBzZXAsIHVuaXQgc2VwXG4gICAgICAgICAga2V5ID0gU3RyaW5nLmZyb21DaGFyQ29kZShldi5rZXlDb2RlIC0gNTEgKyAyNyk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXYua2V5Q29kZSA9PT0gNTYpIHtcbiAgICAgICAgICAvLyBkZWxldGVcbiAgICAgICAgICBrZXkgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDEyNyk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXYua2V5Q29kZSA9PT0gMjE5KSB7XG4gICAgICAgICAgLy8gXlsgLSBlc2NhcGVcbiAgICAgICAgICBrZXkgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDI3KTtcbiAgICAgICAgfSBlbHNlIGlmIChldi5rZXlDb2RlID09PSAyMjEpIHtcbiAgICAgICAgICAvLyBeXSAtIGdyb3VwIHNlcFxuICAgICAgICAgIGtleSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMjkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCghaXNNYWMgJiYgZXYuYWx0S2V5KSB8fCAoaXNNYWMgJiYgZXYubWV0YUtleSkpIHtcbiAgICAgICAgaWYgKGV2LmtleUNvZGUgPj0gNjUgJiYgZXYua2V5Q29kZSA8PSA5MCkge1xuICAgICAgICAgIGtleSA9ICdcXHgxYicgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGV2LmtleUNvZGUgKyAzMik7XG4gICAgICAgIH0gZWxzZSBpZiAoZXYua2V5Q29kZSA9PT0gMTkyKSB7XG4gICAgICAgICAga2V5ID0gJ1xceDFiYCc7XG4gICAgICAgIH0gZWxzZSBpZiAoZXYua2V5Q29kZSA+PSA0OCAmJiBldi5rZXlDb2RlIDw9IDU3KSB7XG4gICAgICAgICAga2V5ID0gJ1xceDFiJyArIChldi5rZXlDb2RlIC0gNDgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgfVxuXG4gIHRoaXMuZW1pdCgna2V5ZG93bicsIGV2KTtcblxuICBpZiAoa2V5KSB7XG4gICAgdGhpcy5lbWl0KCdrZXknLCBrZXksIGV2KTtcblxuICAgIHRoaXMuc2hvd0N1cnNvcigpO1xuICAgIHRoaXMuaGFuZGxlcihrZXkpO1xuXG4gICAgcmV0dXJuIGNhbmNlbChldik7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5zZXRnTGV2ZWwgPSBmdW5jdGlvbihnKSB7XG4gIHRoaXMuZ2xldmVsID0gZztcbiAgdGhpcy5jaGFyc2V0ID0gdGhpcy5jaGFyc2V0c1tnXTtcbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5zZXRnQ2hhcnNldCA9IGZ1bmN0aW9uKGcsIGNoYXJzZXQpIHtcbiAgdGhpcy5jaGFyc2V0c1tnXSA9IGNoYXJzZXQ7XG4gIGlmICh0aGlzLmdsZXZlbCA9PT0gZykge1xuICAgIHRoaXMuY2hhcnNldCA9IGNoYXJzZXQ7XG4gIH1cbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5rZXlQcmVzcyA9IGZ1bmN0aW9uKGV2KSB7XG4gIHZhciBrZXk7XG5cbiAgY2FuY2VsKGV2KTtcblxuICBpZiAoZXYuY2hhckNvZGUpIHtcbiAgICBrZXkgPSBldi5jaGFyQ29kZTtcbiAgfSBlbHNlIGlmIChldi53aGljaCA9PSBudWxsKSB7XG4gICAga2V5ID0gZXYua2V5Q29kZTtcbiAgfSBlbHNlIGlmIChldi53aGljaCAhPT0gMCAmJiBldi5jaGFyQ29kZSAhPT0gMCkge1xuICAgIGtleSA9IGV2LndoaWNoO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGlmICgha2V5IHx8IGV2LmN0cmxLZXkgfHwgZXYuYWx0S2V5IHx8IGV2Lm1ldGFLZXkpIHJldHVybiBmYWxzZTtcblxuICBrZXkgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGtleSk7XG5cbiAgdGhpcy5lbWl0KCdrZXlwcmVzcycsIGtleSwgZXYpO1xuICB0aGlzLmVtaXQoJ2tleScsIGtleSwgZXYpO1xuXG4gIHRoaXMuc2hvd0N1cnNvcigpO1xuICB0aGlzLmhhbmRsZXIoa2V5KTtcblxuICByZXR1cm4gZmFsc2U7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghdGhpcy5xdWV1ZSkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICBzZWxmLmhhbmRsZXIoc2VsZi5xdWV1ZSk7XG4gICAgICBzZWxmLnF1ZXVlID0gJyc7XG4gICAgfSwgMSk7XG4gIH1cblxuICB0aGlzLnF1ZXVlICs9IGRhdGE7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUuYmVsbCA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIVRlcm1pbmFsLnZpc3VhbEJlbGwpIHJldHVybjtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLmVsZW1lbnQuc3R5bGUuYm9yZGVyQ29sb3IgPSAnd2hpdGUnO1xuICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIHNlbGYuZWxlbWVudC5zdHlsZS5ib3JkZXJDb2xvciA9ICcnO1xuICB9LCAxMCk7XG4gIGlmIChUZXJtaW5hbC5wb3BPbkJlbGwpIHRoaXMuZm9jdXMoKTtcbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5sb2cgPSBmdW5jdGlvbigpIHtcbiAgaWYgKCFUZXJtaW5hbC5kZWJ1ZykgcmV0dXJuO1xuICBpZiAoIXdpbmRvdy5jb25zb2xlIHx8ICF3aW5kb3cuY29uc29sZS5sb2cpIHJldHVybjtcbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICB3aW5kb3cuY29uc29sZS5sb2cuYXBwbHkod2luZG93LmNvbnNvbGUsIGFyZ3MpO1xufTtcblxuVGVybWluYWwucHJvdG90eXBlLmVycm9yID0gZnVuY3Rpb24oKSB7XG4gIGlmICghVGVybWluYWwuZGVidWcpIHJldHVybjtcbiAgaWYgKCF3aW5kb3cuY29uc29sZSB8fCAhd2luZG93LmNvbnNvbGUuZXJyb3IpIHJldHVybjtcbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICB3aW5kb3cuY29uc29sZS5lcnJvci5hcHBseSh3aW5kb3cuY29uc29sZSwgYXJncyk7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUucmVzaXplID0gZnVuY3Rpb24oeCwgeSkge1xuICB2YXIgbGluZVxuICAgICwgZWxcbiAgICAsIGlcbiAgICAsIGpcbiAgICAsIGNoO1xuXG4gIGlmICh4IDwgMSkgeCA9IDE7XG4gIGlmICh5IDwgMSkgeSA9IDE7XG5cbiAgLy8gcmVzaXplIGNvbHNcbiAgaiA9IHRoaXMuY29scztcbiAgaWYgKGogPCB4KSB7XG4gICAgY2ggPSBbdGhpcy5kZWZBdHRyLCAnICddO1xuICAgIGkgPSB0aGlzLmxpbmVzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB3aGlsZSAodGhpcy5saW5lc1tpXS5sZW5ndGggPCB4KSB7XG4gICAgICAgIHRoaXMubGluZXNbaV0ucHVzaChjaCk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGogPiB4KSB7XG4gICAgaSA9IHRoaXMubGluZXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHdoaWxlICh0aGlzLmxpbmVzW2ldLmxlbmd0aCA+IHgpIHtcbiAgICAgICAgdGhpcy5saW5lc1tpXS5wb3AoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdGhpcy5zZXR1cFN0b3BzKGopO1xuICB0aGlzLmNvbHMgPSB4O1xuXG4gIC8vIHJlc2l6ZSByb3dzXG4gIGogPSB0aGlzLnJvd3M7XG4gIGlmIChqIDwgeSkge1xuICAgIGVsID0gdGhpcy5lbGVtZW50O1xuICAgIHdoaWxlIChqKysgPCB5KSB7XG4gICAgICBpZiAodGhpcy5saW5lcy5sZW5ndGggPCB5ICsgdGhpcy55YmFzZSkge1xuICAgICAgICB0aGlzLmxpbmVzLnB1c2godGhpcy5ibGFua0xpbmUoKSk7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5jaGlsZHJlbi5sZW5ndGggPCB5KSB7XG4gICAgICAgIGxpbmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZWwuYXBwZW5kQ2hpbGQobGluZSk7XG4gICAgICAgIHRoaXMuY2hpbGRyZW4ucHVzaChsaW5lKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoaiA+IHkpIHtcbiAgICB3aGlsZSAoai0tID4geSkge1xuICAgICAgaWYgKHRoaXMubGluZXMubGVuZ3RoID4geSArIHRoaXMueWJhc2UpIHtcbiAgICAgICAgdGhpcy5saW5lcy5wb3AoKTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmNoaWxkcmVuLmxlbmd0aCA+IHkpIHtcbiAgICAgICAgZWwgPSB0aGlzLmNoaWxkcmVuLnBvcCgpO1xuICAgICAgICBpZiAoIWVsKSBjb250aW51ZTtcbiAgICAgICAgZWwucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChlbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHRoaXMucm93cyA9IHk7XG5cbiAgLy8gbWFrZSBzdXJlIHRoZSBjdXJzb3Igc3RheXMgb24gc2NyZWVuXG4gIGlmICh0aGlzLnkgPj0geSkgdGhpcy55ID0geSAtIDE7XG4gIGlmICh0aGlzLnggPj0geCkgdGhpcy54ID0geCAtIDE7XG5cbiAgdGhpcy5zY3JvbGxUb3AgPSAwO1xuICB0aGlzLnNjcm9sbEJvdHRvbSA9IHkgLSAxO1xuXG4gIHRoaXMucmVmcmVzaCgwLCB0aGlzLnJvd3MgLSAxKTtcblxuICAvLyBpdCdzIGEgcmVhbCBuaWdodG1hcmUgdHJ5aW5nXG4gIC8vIHRvIHJlc2l6ZSB0aGUgb3JpZ2luYWxcbiAgLy8gc2NyZWVuIGJ1ZmZlci4ganVzdCBzZXQgaXRcbiAgLy8gdG8gbnVsbCBmb3Igbm93LlxuICB0aGlzLm5vcm1hbCA9IG51bGw7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUudXBkYXRlUmFuZ2UgPSBmdW5jdGlvbih5KSB7XG4gIGlmICh5IDwgdGhpcy5yZWZyZXNoU3RhcnQpIHRoaXMucmVmcmVzaFN0YXJ0ID0geTtcbiAgaWYgKHkgPiB0aGlzLnJlZnJlc2hFbmQpIHRoaXMucmVmcmVzaEVuZCA9IHk7XG4gIC8vIGlmICh5ID4gdGhpcy5yZWZyZXNoRW5kKSB7XG4gIC8vICAgdGhpcy5yZWZyZXNoRW5kID0geTtcbiAgLy8gICBpZiAoeSA+IHRoaXMucm93cyAtIDEpIHtcbiAgLy8gICAgIHRoaXMucmVmcmVzaEVuZCA9IHRoaXMucm93cyAtIDE7XG4gIC8vICAgfVxuICAvLyB9XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUubWF4UmFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5yZWZyZXNoU3RhcnQgPSAwO1xuICB0aGlzLnJlZnJlc2hFbmQgPSB0aGlzLnJvd3MgLSAxO1xufTtcblxuVGVybWluYWwucHJvdG90eXBlLnNldHVwU3RvcHMgPSBmdW5jdGlvbihpKSB7XG4gIGlmIChpICE9IG51bGwpIHtcbiAgICBpZiAoIXRoaXMudGFic1tpXSkge1xuICAgICAgaSA9IHRoaXMucHJldlN0b3AoaSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRoaXMudGFicyA9IHt9O1xuICAgIGkgPSAwO1xuICB9XG5cbiAgZm9yICg7IGkgPCB0aGlzLmNvbHM7IGkgKz0gOCkge1xuICAgIHRoaXMudGFic1tpXSA9IHRydWU7XG4gIH1cbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5wcmV2U3RvcCA9IGZ1bmN0aW9uKHgpIHtcbiAgaWYgKHggPT0gbnVsbCkgeCA9IHRoaXMueDtcbiAgd2hpbGUgKCF0aGlzLnRhYnNbLS14XSAmJiB4ID4gMCk7XG4gIHJldHVybiB4ID49IHRoaXMuY29sc1xuICAgID8gdGhpcy5jb2xzIC0gMVxuICAgIDogeCA8IDAgPyAwIDogeDtcbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5uZXh0U3RvcCA9IGZ1bmN0aW9uKHgpIHtcbiAgaWYgKHggPT0gbnVsbCkgeCA9IHRoaXMueDtcbiAgd2hpbGUgKCF0aGlzLnRhYnNbKyt4XSAmJiB4IDwgdGhpcy5jb2xzKTtcbiAgcmV0dXJuIHggPj0gdGhpcy5jb2xzXG4gICAgPyB0aGlzLmNvbHMgLSAxXG4gICAgOiB4IDwgMCA/IDAgOiB4O1xufTtcblxuVGVybWluYWwucHJvdG90eXBlLmVyYXNlUmlnaHQgPSBmdW5jdGlvbih4LCB5KSB7XG4gIHZhciBsaW5lID0gdGhpcy5saW5lc1t0aGlzLnliYXNlICsgeV1cbiAgICAsIGNoID0gW3RoaXMuY3VyQXR0ciwgJyAnXTsgLy8geHRlcm1cblxuICBmb3IgKDsgeCA8IHRoaXMuY29sczsgeCsrKSB7XG4gICAgbGluZVt4XSA9IGNoO1xuICB9XG5cbiAgdGhpcy51cGRhdGVSYW5nZSh5KTtcbn07XG5cblRlcm1pbmFsLnByb3RvdHlwZS5lcmFzZUxlZnQgPSBmdW5jdGlvbih4LCB5KSB7XG4gIHZhciBsaW5lID0gdGhpcy5saW5lc1t0aGlzLnliYXNlICsgeV1cbiAgICAsIGNoID0gW3RoaXMuY3VyQXR0ciwgJyAnXTsgLy8geHRlcm1cblxuICB4Kys7XG4gIHdoaWxlICh4LS0pIGxpbmVbeF0gPSBjaDtcblxuICB0aGlzLnVwZGF0ZVJhbmdlKHkpO1xufTtcblxuVGVybWluYWwucHJvdG90eXBlLmVyYXNlTGluZSA9IGZ1bmN0aW9uKHkpIHtcbiAgdGhpcy5lcmFzZVJpZ2h0KDAsIHkpO1xufTtcblxuVGVybWluYWwucHJvdG90eXBlLmJsYW5rTGluZSA9IGZ1bmN0aW9uKGN1cikge1xuICB2YXIgYXR0ciA9IGN1clxuICAgID8gdGhpcy5jdXJBdHRyXG4gICAgOiB0aGlzLmRlZkF0dHI7XG5cbiAgdmFyIGNoID0gW2F0dHIsICcgJ11cbiAgICAsIGxpbmUgPSBbXVxuICAgICwgaSA9IDA7XG5cbiAgZm9yICg7IGkgPCB0aGlzLmNvbHM7IGkrKykge1xuICAgIGxpbmVbaV0gPSBjaDtcbiAgfVxuXG4gIHJldHVybiBsaW5lO1xufTtcblxuVGVybWluYWwucHJvdG90eXBlLmNoID0gZnVuY3Rpb24oY3VyKSB7XG4gIHJldHVybiBjdXJcbiAgICA/IFt0aGlzLmN1ckF0dHIsICcgJ11cbiAgICA6IFt0aGlzLmRlZkF0dHIsICcgJ107XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUuaXMgPSBmdW5jdGlvbih0ZXJtKSB7XG4gIHZhciBuYW1lID0gdGhpcy50ZXJtTmFtZSB8fCBUZXJtaW5hbC50ZXJtTmFtZTtcbiAgcmV0dXJuIChuYW1lICsgJycpLmluZGV4T2YodGVybSkgPT09IDA7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUuaGFuZGxlciA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgdGhpcy5lbWl0KCdkYXRhJywgZGF0YSk7XG59O1xuXG5UZXJtaW5hbC5wcm90b3R5cGUuaGFuZGxlVGl0bGUgPSBmdW5jdGlvbih0aXRsZSkge1xuICB0aGlzLmVtaXQoJ3RpdGxlJywgdGl0bGUpO1xufTtcblxuLyoqXG4gKiBFU0NcbiAqL1xuXG4vLyBFU0MgRCBJbmRleCAoSU5EIGlzIDB4ODQpLlxuVGVybWluYWwucHJvdG90eXBlLmluZGV4ID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMueSsrO1xuICBpZiAodGhpcy55ID4gdGhpcy5zY3JvbGxCb3R0b20pIHtcbiAgICB0aGlzLnktLTtcbiAgICB0aGlzLnNjcm9sbCgpO1xuICB9XG4gIHRoaXMuc3RhdGUgPSBub3JtYWw7XG59O1xuXG4vLyBFU0MgTSBSZXZlcnNlIEluZGV4IChSSSBpcyAweDhkKS5cblRlcm1pbmFsLnByb3RvdHlwZS5yZXZlcnNlSW5kZXggPSBmdW5jdGlvbigpIHtcbiAgdmFyIGo7XG4gIHRoaXMueS0tO1xuICBpZiAodGhpcy55IDwgdGhpcy5zY3JvbGxUb3ApIHtcbiAgICB0aGlzLnkrKztcbiAgICAvLyBwb3NzaWJseSBtb3ZlIHRoZSBjb2RlIGJlbG93IHRvIHRlcm0ucmV2ZXJzZVNjcm9sbCgpO1xuICAgIC8vIHRlc3Q6IGVjaG8gLW5lICdcXGVbMTsxSFxcZVs0NG1cXGVNXFxlWzBtJ1xuICAgIC8vIGJsYW5rTGluZSh0cnVlKSBpcyB4dGVybS9saW51eCBiZWhhdmlvclxuICAgIHRoaXMubGluZXMuc3BsaWNlKHRoaXMueSArIHRoaXMueWJhc2UsIDAsIHRoaXMuYmxhbmtMaW5lKHRydWUpKTtcbiAgICBqID0gdGhpcy5yb3dzIC0gMSAtIHRoaXMuc2Nyb2xsQm90dG9tO1xuICAgIHRoaXMubGluZXMuc3BsaWNlKHRoaXMucm93cyAtIDEgKyB0aGlzLnliYXNlIC0gaiArIDEsIDEpO1xuICAgIC8vIHRoaXMubWF4UmFuZ2UoKTtcbiAgICB0aGlzLnVwZGF0ZVJhbmdlKHRoaXMuc2Nyb2xsVG9wKTtcbiAgICB0aGlzLnVwZGF0ZVJhbmdlKHRoaXMuc2Nyb2xsQm90dG9tKTtcbiAgfVxuICB0aGlzLnN0YXRlID0gbm9ybWFsO1xufTtcblxuLy8gRVNDIGMgRnVsbCBSZXNldCAoUklTKS5cblRlcm1pbmFsLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICBUZXJtaW5hbC5jYWxsKHRoaXMsIHRoaXMuY29scywgdGhpcy5yb3dzKTtcbiAgdGhpcy5yZWZyZXNoKDAsIHRoaXMucm93cyAtIDEpO1xufTtcblxuLy8gRVNDIEggVGFiIFNldCAoSFRTIGlzIDB4ODgpLlxuVGVybWluYWwucHJvdG90eXBlLnRhYlNldCA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnRhYnNbdGhpcy54XSA9IHRydWU7XG4gIHRoaXMuc3RhdGUgPSBub3JtYWw7XG59O1xuXG4vKipcbiAqIENTSVxuICovXG5cbi8vIENTSSBQcyBBXG4vLyBDdXJzb3IgVXAgUHMgVGltZXMgKGRlZmF1bHQgPSAxKSAoQ1VVKS5cblRlcm1pbmFsLnByb3RvdHlwZS5jdXJzb3JVcCA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgcGFyYW0gPSBwYXJhbXNbMF07XG4gIGlmIChwYXJhbSA8IDEpIHBhcmFtID0gMTtcbiAgdGhpcy55IC09IHBhcmFtO1xuICBpZiAodGhpcy55IDwgMCkgdGhpcy55ID0gMDtcbn07XG5cbi8vIENTSSBQcyBCXG4vLyBDdXJzb3IgRG93biBQcyBUaW1lcyAoZGVmYXVsdCA9IDEpIChDVUQpLlxuVGVybWluYWwucHJvdG90eXBlLmN1cnNvckRvd24gPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgdmFyIHBhcmFtID0gcGFyYW1zWzBdO1xuICBpZiAocGFyYW0gPCAxKSBwYXJhbSA9IDE7XG4gIHRoaXMueSArPSBwYXJhbTtcbiAgaWYgKHRoaXMueSA+PSB0aGlzLnJvd3MpIHtcbiAgICB0aGlzLnkgPSB0aGlzLnJvd3MgLSAxO1xuICB9XG59O1xuXG4vLyBDU0kgUHMgQ1xuLy8gQ3Vyc29yIEZvcndhcmQgUHMgVGltZXMgKGRlZmF1bHQgPSAxKSAoQ1VGKS5cblRlcm1pbmFsLnByb3RvdHlwZS5jdXJzb3JGb3J3YXJkID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuICB0aGlzLnggKz0gcGFyYW07XG4gIGlmICh0aGlzLnggPj0gdGhpcy5jb2xzKSB7XG4gICAgdGhpcy54ID0gdGhpcy5jb2xzIC0gMTtcbiAgfVxufTtcblxuLy8gQ1NJIFBzIERcbi8vIEN1cnNvciBCYWNrd2FyZCBQcyBUaW1lcyAoZGVmYXVsdCA9IDEpIChDVUIpLlxuVGVybWluYWwucHJvdG90eXBlLmN1cnNvckJhY2t3YXJkID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuICB0aGlzLnggLT0gcGFyYW07XG4gIGlmICh0aGlzLnggPCAwKSB0aGlzLnggPSAwO1xufTtcblxuLy8gQ1NJIFBzIDsgUHMgSFxuLy8gQ3Vyc29yIFBvc2l0aW9uIFtyb3c7Y29sdW1uXSAoZGVmYXVsdCA9IFsxLDFdKSAoQ1VQKS5cblRlcm1pbmFsLnByb3RvdHlwZS5jdXJzb3JQb3MgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgdmFyIHJvdywgY29sO1xuXG4gIHJvdyA9IHBhcmFtc1swXSAtIDE7XG5cbiAgaWYgKHBhcmFtcy5sZW5ndGggPj0gMikge1xuICAgIGNvbCA9IHBhcmFtc1sxXSAtIDE7XG4gIH0gZWxzZSB7XG4gICAgY29sID0gMDtcbiAgfVxuXG4gIGlmIChyb3cgPCAwKSB7XG4gICAgcm93ID0gMDtcbiAgfSBlbHNlIGlmIChyb3cgPj0gdGhpcy5yb3dzKSB7XG4gICAgcm93ID0gdGhpcy5yb3dzIC0gMTtcbiAgfVxuXG4gIGlmIChjb2wgPCAwKSB7XG4gICAgY29sID0gMDtcbiAgfSBlbHNlIGlmIChjb2wgPj0gdGhpcy5jb2xzKSB7XG4gICAgY29sID0gdGhpcy5jb2xzIC0gMTtcbiAgfVxuXG4gIHRoaXMueCA9IGNvbDtcbiAgdGhpcy55ID0gcm93O1xufTtcblxuLy8gQ1NJIFBzIEogIEVyYXNlIGluIERpc3BsYXkgKEVEKS5cbi8vICAgICBQcyA9IDAgIC0+IEVyYXNlIEJlbG93IChkZWZhdWx0KS5cbi8vICAgICBQcyA9IDEgIC0+IEVyYXNlIEFib3ZlLlxuLy8gICAgIFBzID0gMiAgLT4gRXJhc2UgQWxsLlxuLy8gICAgIFBzID0gMyAgLT4gRXJhc2UgU2F2ZWQgTGluZXMgKHh0ZXJtKS5cbi8vIENTSSA/IFBzIEpcbi8vICAgRXJhc2UgaW4gRGlzcGxheSAoREVDU0VEKS5cbi8vICAgICBQcyA9IDAgIC0+IFNlbGVjdGl2ZSBFcmFzZSBCZWxvdyAoZGVmYXVsdCkuXG4vLyAgICAgUHMgPSAxICAtPiBTZWxlY3RpdmUgRXJhc2UgQWJvdmUuXG4vLyAgICAgUHMgPSAyICAtPiBTZWxlY3RpdmUgRXJhc2UgQWxsLlxuVGVybWluYWwucHJvdG90eXBlLmVyYXNlSW5EaXNwbGF5ID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBqO1xuICBzd2l0Y2ggKHBhcmFtc1swXSkge1xuICAgIGNhc2UgMDpcbiAgICAgIHRoaXMuZXJhc2VSaWdodCh0aGlzLngsIHRoaXMueSk7XG4gICAgICBqID0gdGhpcy55ICsgMTtcbiAgICAgIGZvciAoOyBqIDwgdGhpcy5yb3dzOyBqKyspIHtcbiAgICAgICAgdGhpcy5lcmFzZUxpbmUoaik7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlIDE6XG4gICAgICB0aGlzLmVyYXNlTGVmdCh0aGlzLngsIHRoaXMueSk7XG4gICAgICBqID0gdGhpcy55O1xuICAgICAgd2hpbGUgKGotLSkge1xuICAgICAgICB0aGlzLmVyYXNlTGluZShqKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMjpcbiAgICAgIGogPSB0aGlzLnJvd3M7XG4gICAgICB3aGlsZSAoai0tKSB0aGlzLmVyYXNlTGluZShqKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMzpcbiAgICAgIDsgLy8gbm8gc2F2ZWQgbGluZXNcbiAgICAgIGJyZWFrO1xuICB9XG59O1xuXG4vLyBDU0kgUHMgSyAgRXJhc2UgaW4gTGluZSAoRUwpLlxuLy8gICAgIFBzID0gMCAgLT4gRXJhc2UgdG8gUmlnaHQgKGRlZmF1bHQpLlxuLy8gICAgIFBzID0gMSAgLT4gRXJhc2UgdG8gTGVmdC5cbi8vICAgICBQcyA9IDIgIC0+IEVyYXNlIEFsbC5cbi8vIENTSSA/IFBzIEtcbi8vICAgRXJhc2UgaW4gTGluZSAoREVDU0VMKS5cbi8vICAgICBQcyA9IDAgIC0+IFNlbGVjdGl2ZSBFcmFzZSB0byBSaWdodCAoZGVmYXVsdCkuXG4vLyAgICAgUHMgPSAxICAtPiBTZWxlY3RpdmUgRXJhc2UgdG8gTGVmdC5cbi8vICAgICBQcyA9IDIgIC0+IFNlbGVjdGl2ZSBFcmFzZSBBbGwuXG5UZXJtaW5hbC5wcm90b3R5cGUuZXJhc2VJbkxpbmUgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgc3dpdGNoIChwYXJhbXNbMF0pIHtcbiAgICBjYXNlIDA6XG4gICAgICB0aGlzLmVyYXNlUmlnaHQodGhpcy54LCB0aGlzLnkpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxOlxuICAgICAgdGhpcy5lcmFzZUxlZnQodGhpcy54LCB0aGlzLnkpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAyOlxuICAgICAgdGhpcy5lcmFzZUxpbmUodGhpcy55KTtcbiAgICAgIGJyZWFrO1xuICB9XG59O1xuXG4vLyBDU0kgUG0gbSAgQ2hhcmFjdGVyIEF0dHJpYnV0ZXMgKFNHUikuXG4vLyAgICAgUHMgPSAwICAtPiBOb3JtYWwgKGRlZmF1bHQpLlxuLy8gICAgIFBzID0gMSAgLT4gQm9sZC5cbi8vICAgICBQcyA9IDQgIC0+IFVuZGVybGluZWQuXG4vLyAgICAgUHMgPSA1ICAtPiBCbGluayAoYXBwZWFycyBhcyBCb2xkKS5cbi8vICAgICBQcyA9IDcgIC0+IEludmVyc2UuXG4vLyAgICAgUHMgPSA4ICAtPiBJbnZpc2libGUsIGkuZS4sIGhpZGRlbiAoVlQzMDApLlxuLy8gICAgIFBzID0gMiAyICAtPiBOb3JtYWwgKG5laXRoZXIgYm9sZCBub3IgZmFpbnQpLlxuLy8gICAgIFBzID0gMiA0ICAtPiBOb3QgdW5kZXJsaW5lZC5cbi8vICAgICBQcyA9IDIgNSAgLT4gU3RlYWR5IChub3QgYmxpbmtpbmcpLlxuLy8gICAgIFBzID0gMiA3ICAtPiBQb3NpdGl2ZSAobm90IGludmVyc2UpLlxuLy8gICAgIFBzID0gMiA4ICAtPiBWaXNpYmxlLCBpLmUuLCBub3QgaGlkZGVuIChWVDMwMCkuXG4vLyAgICAgUHMgPSAzIDAgIC0+IFNldCBmb3JlZ3JvdW5kIGNvbG9yIHRvIEJsYWNrLlxuLy8gICAgIFBzID0gMyAxICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBSZWQuXG4vLyAgICAgUHMgPSAzIDIgIC0+IFNldCBmb3JlZ3JvdW5kIGNvbG9yIHRvIEdyZWVuLlxuLy8gICAgIFBzID0gMyAzICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBZZWxsb3cuXG4vLyAgICAgUHMgPSAzIDQgIC0+IFNldCBmb3JlZ3JvdW5kIGNvbG9yIHRvIEJsdWUuXG4vLyAgICAgUHMgPSAzIDUgIC0+IFNldCBmb3JlZ3JvdW5kIGNvbG9yIHRvIE1hZ2VudGEuXG4vLyAgICAgUHMgPSAzIDYgIC0+IFNldCBmb3JlZ3JvdW5kIGNvbG9yIHRvIEN5YW4uXG4vLyAgICAgUHMgPSAzIDcgIC0+IFNldCBmb3JlZ3JvdW5kIGNvbG9yIHRvIFdoaXRlLlxuLy8gICAgIFBzID0gMyA5ICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBkZWZhdWx0IChvcmlnaW5hbCkuXG4vLyAgICAgUHMgPSA0IDAgIC0+IFNldCBiYWNrZ3JvdW5kIGNvbG9yIHRvIEJsYWNrLlxuLy8gICAgIFBzID0gNCAxICAtPiBTZXQgYmFja2dyb3VuZCBjb2xvciB0byBSZWQuXG4vLyAgICAgUHMgPSA0IDIgIC0+IFNldCBiYWNrZ3JvdW5kIGNvbG9yIHRvIEdyZWVuLlxuLy8gICAgIFBzID0gNCAzICAtPiBTZXQgYmFja2dyb3VuZCBjb2xvciB0byBZZWxsb3cuXG4vLyAgICAgUHMgPSA0IDQgIC0+IFNldCBiYWNrZ3JvdW5kIGNvbG9yIHRvIEJsdWUuXG4vLyAgICAgUHMgPSA0IDUgIC0+IFNldCBiYWNrZ3JvdW5kIGNvbG9yIHRvIE1hZ2VudGEuXG4vLyAgICAgUHMgPSA0IDYgIC0+IFNldCBiYWNrZ3JvdW5kIGNvbG9yIHRvIEN5YW4uXG4vLyAgICAgUHMgPSA0IDcgIC0+IFNldCBiYWNrZ3JvdW5kIGNvbG9yIHRvIFdoaXRlLlxuLy8gICAgIFBzID0gNCA5ICAtPiBTZXQgYmFja2dyb3VuZCBjb2xvciB0byBkZWZhdWx0IChvcmlnaW5hbCkuXG5cbi8vICAgSWYgMTYtY29sb3Igc3VwcG9ydCBpcyBjb21waWxlZCwgdGhlIGZvbGxvd2luZyBhcHBseS4gIEFzc3VtZVxuLy8gICB0aGF0IHh0ZXJtJ3MgcmVzb3VyY2VzIGFyZSBzZXQgc28gdGhhdCB0aGUgSVNPIGNvbG9yIGNvZGVzIGFyZVxuLy8gICB0aGUgZmlyc3QgOCBvZiBhIHNldCBvZiAxNi4gIFRoZW4gdGhlIGFpeHRlcm0gY29sb3JzIGFyZSB0aGVcbi8vICAgYnJpZ2h0IHZlcnNpb25zIG9mIHRoZSBJU08gY29sb3JzOlxuLy8gICAgIFBzID0gOSAwICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBCbGFjay5cbi8vICAgICBQcyA9IDkgMSAgLT4gU2V0IGZvcmVncm91bmQgY29sb3IgdG8gUmVkLlxuLy8gICAgIFBzID0gOSAyICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBHcmVlbi5cbi8vICAgICBQcyA9IDkgMyAgLT4gU2V0IGZvcmVncm91bmQgY29sb3IgdG8gWWVsbG93LlxuLy8gICAgIFBzID0gOSA0ICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBCbHVlLlxuLy8gICAgIFBzID0gOSA1ICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBNYWdlbnRhLlxuLy8gICAgIFBzID0gOSA2ICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBDeWFuLlxuLy8gICAgIFBzID0gOSA3ICAtPiBTZXQgZm9yZWdyb3VuZCBjb2xvciB0byBXaGl0ZS5cbi8vICAgICBQcyA9IDEgMCAwICAtPiBTZXQgYmFja2dyb3VuZCBjb2xvciB0byBCbGFjay5cbi8vICAgICBQcyA9IDEgMCAxICAtPiBTZXQgYmFja2dyb3VuZCBjb2xvciB0byBSZWQuXG4vLyAgICAgUHMgPSAxIDAgMiAgLT4gU2V0IGJhY2tncm91bmQgY29sb3IgdG8gR3JlZW4uXG4vLyAgICAgUHMgPSAxIDAgMyAgLT4gU2V0IGJhY2tncm91bmQgY29sb3IgdG8gWWVsbG93LlxuLy8gICAgIFBzID0gMSAwIDQgIC0+IFNldCBiYWNrZ3JvdW5kIGNvbG9yIHRvIEJsdWUuXG4vLyAgICAgUHMgPSAxIDAgNSAgLT4gU2V0IGJhY2tncm91bmQgY29sb3IgdG8gTWFnZW50YS5cbi8vICAgICBQcyA9IDEgMCA2ICAtPiBTZXQgYmFja2dyb3VuZCBjb2xvciB0byBDeWFuLlxuLy8gICAgIFBzID0gMSAwIDcgIC0+IFNldCBiYWNrZ3JvdW5kIGNvbG9yIHRvIFdoaXRlLlxuXG4vLyAgIElmIHh0ZXJtIGlzIGNvbXBpbGVkIHdpdGggdGhlIDE2LWNvbG9yIHN1cHBvcnQgZGlzYWJsZWQsIGl0XG4vLyAgIHN1cHBvcnRzIHRoZSBmb2xsb3dpbmcsIGZyb20gcnh2dDpcbi8vICAgICBQcyA9IDEgMCAwICAtPiBTZXQgZm9yZWdyb3VuZCBhbmQgYmFja2dyb3VuZCBjb2xvciB0b1xuLy8gICAgIGRlZmF1bHQuXG5cbi8vICAgSWYgODgtIG9yIDI1Ni1jb2xvciBzdXBwb3J0IGlzIGNvbXBpbGVkLCB0aGUgZm9sbG93aW5nIGFwcGx5LlxuLy8gICAgIFBzID0gMyA4ICA7IDUgIDsgUHMgLT4gU2V0IGZvcmVncm91bmQgY29sb3IgdG8gdGhlIHNlY29uZFxuLy8gICAgIFBzLlxuLy8gICAgIFBzID0gNCA4ICA7IDUgIDsgUHMgLT4gU2V0IGJhY2tncm91bmQgY29sb3IgdG8gdGhlIHNlY29uZFxuLy8gICAgIFBzLlxuVGVybWluYWwucHJvdG90eXBlLmNoYXJBdHRyaWJ1dGVzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBsID0gcGFyYW1zLmxlbmd0aFxuICAgICwgaSA9IDBcbiAgICAsIGJnXG4gICAgLCBmZ1xuICAgICwgcDtcblxuICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgIHAgPSBwYXJhbXNbaV07XG4gICAgaWYgKHAgPj0gMzAgJiYgcCA8PSAzNykge1xuICAgICAgLy8gZmcgY29sb3IgOFxuICAgICAgdGhpcy5jdXJBdHRyID0gKHRoaXMuY3VyQXR0ciAmIH4oMHgxZmYgPDwgOSkpIHwgKChwIC0gMzApIDw8IDkpO1xuICAgIH0gZWxzZSBpZiAocCA+PSA0MCAmJiBwIDw9IDQ3KSB7XG4gICAgICAvLyBiZyBjb2xvciA4XG4gICAgICB0aGlzLmN1ckF0dHIgPSAodGhpcy5jdXJBdHRyICYgfjB4MWZmKSB8IChwIC0gNDApO1xuICAgIH0gZWxzZSBpZiAocCA+PSA5MCAmJiBwIDw9IDk3KSB7XG4gICAgICAvLyBmZyBjb2xvciAxNlxuICAgICAgcCArPSA4O1xuICAgICAgdGhpcy5jdXJBdHRyID0gKHRoaXMuY3VyQXR0ciAmIH4oMHgxZmYgPDwgOSkpIHwgKChwIC0gOTApIDw8IDkpO1xuICAgIH0gZWxzZSBpZiAocCA+PSAxMDAgJiYgcCA8PSAxMDcpIHtcbiAgICAgIC8vIGJnIGNvbG9yIDE2XG4gICAgICBwICs9IDg7XG4gICAgICB0aGlzLmN1ckF0dHIgPSAodGhpcy5jdXJBdHRyICYgfjB4MWZmKSB8IChwIC0gMTAwKTtcbiAgICB9IGVsc2UgaWYgKHAgPT09IDApIHtcbiAgICAgIC8vIGRlZmF1bHRcbiAgICAgIHRoaXMuY3VyQXR0ciA9IHRoaXMuZGVmQXR0cjtcbiAgICB9IGVsc2UgaWYgKHAgPT09IDEpIHtcbiAgICAgIC8vIGJvbGQgdGV4dFxuICAgICAgdGhpcy5jdXJBdHRyID0gdGhpcy5jdXJBdHRyIHwgKDEgPDwgMTgpO1xuICAgIH0gZWxzZSBpZiAocCA9PT0gNCkge1xuICAgICAgLy8gdW5kZXJsaW5lZCB0ZXh0XG4gICAgICB0aGlzLmN1ckF0dHIgPSB0aGlzLmN1ckF0dHIgfCAoMiA8PCAxOCk7XG4gICAgfSBlbHNlIGlmIChwID09PSA3IHx8IHAgPT09IDI3KSB7XG4gICAgICAvLyBpbnZlcnNlIGFuZCBwb3NpdGl2ZVxuICAgICAgLy8gdGVzdCB3aXRoOiBlY2hvIC1lICdcXGVbMzFtXFxlWzQybWhlbGxvXFxlWzdtd29ybGRcXGVbMjdtaGlcXGVbbSdcbiAgICAgIGlmIChwID09PSA3KSB7XG4gICAgICAgIGlmICgodGhpcy5jdXJBdHRyID4+IDE4KSAmIDQpIGNvbnRpbnVlO1xuICAgICAgICB0aGlzLmN1ckF0dHIgPSB0aGlzLmN1ckF0dHIgfCAoNCA8PCAxOCk7XG4gICAgICB9IGVsc2UgaWYgKHAgPT09IDI3KSB7XG4gICAgICAgIGlmICh+KHRoaXMuY3VyQXR0ciA+PiAxOCkgJiA0KSBjb250aW51ZTtcbiAgICAgICAgdGhpcy5jdXJBdHRyID0gdGhpcy5jdXJBdHRyICYgfig0IDw8IDE4KTtcbiAgICAgIH1cblxuICAgICAgYmcgPSB0aGlzLmN1ckF0dHIgJiAweDFmZjtcbiAgICAgIGZnID0gKHRoaXMuY3VyQXR0ciA+PiA5KSAmIDB4MWZmO1xuXG4gICAgICB0aGlzLmN1ckF0dHIgPSAodGhpcy5jdXJBdHRyICYgfjB4M2ZmZmYpIHwgKChiZyA8PCA5KSB8IGZnKTtcbiAgICB9IGVsc2UgaWYgKHAgPT09IDIyKSB7XG4gICAgICAvLyBub3QgYm9sZFxuICAgICAgdGhpcy5jdXJBdHRyID0gdGhpcy5jdXJBdHRyICYgfigxIDw8IDE4KTtcbiAgICB9IGVsc2UgaWYgKHAgPT09IDI0KSB7XG4gICAgICAvLyBub3QgdW5kZXJsaW5lZFxuICAgICAgdGhpcy5jdXJBdHRyID0gdGhpcy5jdXJBdHRyICYgfigyIDw8IDE4KTtcbiAgICB9IGVsc2UgaWYgKHAgPT09IDM5KSB7XG4gICAgICAvLyByZXNldCBmZ1xuICAgICAgdGhpcy5jdXJBdHRyID0gdGhpcy5jdXJBdHRyICYgfigweDFmZiA8PCA5KTtcbiAgICAgIHRoaXMuY3VyQXR0ciA9IHRoaXMuY3VyQXR0ciB8ICgoKHRoaXMuZGVmQXR0ciA+PiA5KSAmIDB4MWZmKSA8PCA5KTtcbiAgICB9IGVsc2UgaWYgKHAgPT09IDQ5KSB7XG4gICAgICAvLyByZXNldCBiZ1xuICAgICAgdGhpcy5jdXJBdHRyID0gdGhpcy5jdXJBdHRyICYgfjB4MWZmO1xuICAgICAgdGhpcy5jdXJBdHRyID0gdGhpcy5jdXJBdHRyIHwgKHRoaXMuZGVmQXR0ciAmIDB4MWZmKTtcbiAgICB9IGVsc2UgaWYgKHAgPT09IDM4KSB7XG4gICAgICAvLyBmZyBjb2xvciAyNTZcbiAgICAgIGlmIChwYXJhbXNbaSsxXSAhPT0gNSkgY29udGludWU7XG4gICAgICBpICs9IDI7XG4gICAgICBwID0gcGFyYW1zW2ldICYgMHhmZjtcbiAgICAgIC8vIGNvbnZlcnQgODggY29sb3JzIHRvIDI1NlxuICAgICAgLy8gaWYgKHRoaXMuaXMoJ3J4dnQtdW5pY29kZScpICYmIHAgPCA4OCkgcCA9IHAgKiAyLjkwOTAgfCAwO1xuICAgICAgdGhpcy5jdXJBdHRyID0gKHRoaXMuY3VyQXR0ciAmIH4oMHgxZmYgPDwgOSkpIHwgKHAgPDwgOSk7XG4gICAgfSBlbHNlIGlmIChwID09PSA0OCkge1xuICAgICAgLy8gYmcgY29sb3IgMjU2XG4gICAgICBpZiAocGFyYW1zW2krMV0gIT09IDUpIGNvbnRpbnVlO1xuICAgICAgaSArPSAyO1xuICAgICAgcCA9IHBhcmFtc1tpXSAmIDB4ZmY7XG4gICAgICAvLyBjb252ZXJ0IDg4IGNvbG9ycyB0byAyNTZcbiAgICAgIC8vIGlmICh0aGlzLmlzKCdyeHZ0LXVuaWNvZGUnKSAmJiBwIDwgODgpIHAgPSBwICogMi45MDkwIHwgMDtcbiAgICAgIHRoaXMuY3VyQXR0ciA9ICh0aGlzLmN1ckF0dHIgJiB+MHgxZmYpIHwgcDtcbiAgICB9XG4gIH1cbn07XG5cbi8vIENTSSBQcyBuICBEZXZpY2UgU3RhdHVzIFJlcG9ydCAoRFNSKS5cbi8vICAgICBQcyA9IDUgIC0+IFN0YXR1cyBSZXBvcnQuICBSZXN1bHQgKGBgT0snJykgaXNcbi8vICAgQ1NJIDAgblxuLy8gICAgIFBzID0gNiAgLT4gUmVwb3J0IEN1cnNvciBQb3NpdGlvbiAoQ1BSKSBbcm93O2NvbHVtbl0uXG4vLyAgIFJlc3VsdCBpc1xuLy8gICBDU0kgciA7IGMgUlxuLy8gQ1NJID8gUHMgblxuLy8gICBEZXZpY2UgU3RhdHVzIFJlcG9ydCAoRFNSLCBERUMtc3BlY2lmaWMpLlxuLy8gICAgIFBzID0gNiAgLT4gUmVwb3J0IEN1cnNvciBQb3NpdGlvbiAoQ1BSKSBbcm93O2NvbHVtbl0gYXMgQ1NJXG4vLyAgICAgPyByIDsgYyBSIChhc3N1bWVzIHBhZ2UgaXMgemVybykuXG4vLyAgICAgUHMgPSAxIDUgIC0+IFJlcG9ydCBQcmludGVyIHN0YXR1cyBhcyBDU0kgPyAxIDAgIG4gIChyZWFkeSkuXG4vLyAgICAgb3IgQ1NJID8gMSAxICBuICAobm90IHJlYWR5KS5cbi8vICAgICBQcyA9IDIgNSAgLT4gUmVwb3J0IFVESyBzdGF0dXMgYXMgQ1NJID8gMiAwICBuICAodW5sb2NrZWQpXG4vLyAgICAgb3IgQ1NJID8gMiAxICBuICAobG9ja2VkKS5cbi8vICAgICBQcyA9IDIgNiAgLT4gUmVwb3J0IEtleWJvYXJkIHN0YXR1cyBhc1xuLy8gICBDU0kgPyAyIDcgIDsgIDEgIDsgIDAgIDsgIDAgIG4gIChOb3J0aCBBbWVyaWNhbikuXG4vLyAgIFRoZSBsYXN0IHR3byBwYXJhbWV0ZXJzIGFwcGx5IHRvIFZUNDAwICYgdXAsIGFuZCBkZW5vdGUga2V5LVxuLy8gICBib2FyZCByZWFkeSBhbmQgTEswMSByZXNwZWN0aXZlbHkuXG4vLyAgICAgUHMgPSA1IDMgIC0+IFJlcG9ydCBMb2NhdG9yIHN0YXR1cyBhc1xuLy8gICBDU0kgPyA1IDMgIG4gIExvY2F0b3IgYXZhaWxhYmxlLCBpZiBjb21waWxlZC1pbiwgb3Jcbi8vICAgQ1NJID8gNSAwICBuICBObyBMb2NhdG9yLCBpZiBub3QuXG5UZXJtaW5hbC5wcm90b3R5cGUuZGV2aWNlU3RhdHVzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIGlmICghdGhpcy5wcmVmaXgpIHtcbiAgICBzd2l0Y2ggKHBhcmFtc1swXSkge1xuICAgICAgY2FzZSA1OlxuICAgICAgICAvLyBzdGF0dXMgcmVwb3J0XG4gICAgICAgIHRoaXMuc2VuZCgnXFx4MWJbMG4nKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDY6XG4gICAgICAgIC8vIGN1cnNvciBwb3NpdGlvblxuICAgICAgICB0aGlzLnNlbmQoJ1xceDFiWydcbiAgICAgICAgICArICh0aGlzLnkgKyAxKVxuICAgICAgICAgICsgJzsnXG4gICAgICAgICAgKyAodGhpcy54ICsgMSlcbiAgICAgICAgICArICdSJyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfSBlbHNlIGlmICh0aGlzLnByZWZpeCA9PT0gJz8nKSB7XG4gICAgLy8gbW9kZXJuIHh0ZXJtIGRvZXNudCBzZWVtIHRvXG4gICAgLy8gcmVzcG9uZCB0byBhbnkgb2YgdGhlc2UgZXhjZXB0ID82LCA2LCBhbmQgNVxuICAgIHN3aXRjaCAocGFyYW1zWzBdKSB7XG4gICAgICBjYXNlIDY6XG4gICAgICAgIC8vIGN1cnNvciBwb3NpdGlvblxuICAgICAgICB0aGlzLnNlbmQoJ1xceDFiWz8nXG4gICAgICAgICAgKyAodGhpcy55ICsgMSlcbiAgICAgICAgICArICc7J1xuICAgICAgICAgICsgKHRoaXMueCArIDEpXG4gICAgICAgICAgKyAnUicpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTU6XG4gICAgICAgIC8vIG5vIHByaW50ZXJcbiAgICAgICAgLy8gdGhpcy5zZW5kKCdcXHgxYls/MTFuJyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyNTpcbiAgICAgICAgLy8gZG9udCBzdXBwb3J0IHVzZXIgZGVmaW5lZCBrZXlzXG4gICAgICAgIC8vIHRoaXMuc2VuZCgnXFx4MWJbPzIxbicpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjY6XG4gICAgICAgIC8vIG5vcnRoIGFtZXJpY2FuIGtleWJvYXJkXG4gICAgICAgIC8vIHRoaXMuc2VuZCgnXFx4MWJbPzI3OzE7MDswbicpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgNTM6XG4gICAgICAgIC8vIG5vIGRlYyBsb2NhdG9yL21vdXNlXG4gICAgICAgIC8vIHRoaXMuc2VuZCgnXFx4MWJbPzUwbicpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogQWRkaXRpb25zXG4gKi9cblxuLy8gQ1NJIFBzIEBcbi8vIEluc2VydCBQcyAoQmxhbmspIENoYXJhY3RlcihzKSAoZGVmYXVsdCA9IDEpIChJQ0gpLlxuVGVybWluYWwucHJvdG90eXBlLmluc2VydENoYXJzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSwgcm93LCBqLCBjaDtcblxuICBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuXG4gIHJvdyA9IHRoaXMueSArIHRoaXMueWJhc2U7XG4gIGogPSB0aGlzLng7XG4gIGNoID0gW3RoaXMuY3VyQXR0ciwgJyAnXTsgLy8geHRlcm1cblxuICB3aGlsZSAocGFyYW0tLSAmJiBqIDwgdGhpcy5jb2xzKSB7XG4gICAgdGhpcy5saW5lc1tyb3ddLnNwbGljZShqKyssIDAsIGNoKTtcbiAgICB0aGlzLmxpbmVzW3Jvd10ucG9wKCk7XG4gIH1cbn07XG5cbi8vIENTSSBQcyBFXG4vLyBDdXJzb3IgTmV4dCBMaW5lIFBzIFRpbWVzIChkZWZhdWx0ID0gMSkgKENOTCkuXG4vLyBzYW1lIGFzIENTSSBQcyBCID9cblRlcm1pbmFsLnByb3RvdHlwZS5jdXJzb3JOZXh0TGluZSA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgcGFyYW0gPSBwYXJhbXNbMF07XG4gIGlmIChwYXJhbSA8IDEpIHBhcmFtID0gMTtcbiAgdGhpcy55ICs9IHBhcmFtO1xuICBpZiAodGhpcy55ID49IHRoaXMucm93cykge1xuICAgIHRoaXMueSA9IHRoaXMucm93cyAtIDE7XG4gIH1cbiAgdGhpcy54ID0gMDtcbn07XG5cbi8vIENTSSBQcyBGXG4vLyBDdXJzb3IgUHJlY2VkaW5nIExpbmUgUHMgVGltZXMgKGRlZmF1bHQgPSAxKSAoQ05MKS5cbi8vIHJldXNlIENTSSBQcyBBID9cblRlcm1pbmFsLnByb3RvdHlwZS5jdXJzb3JQcmVjZWRpbmdMaW5lID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuICB0aGlzLnkgLT0gcGFyYW07XG4gIGlmICh0aGlzLnkgPCAwKSB0aGlzLnkgPSAwO1xuICB0aGlzLnggPSAwO1xufTtcblxuLy8gQ1NJIFBzIEdcbi8vIEN1cnNvciBDaGFyYWN0ZXIgQWJzb2x1dGUgIFtjb2x1bW5dIChkZWZhdWx0ID0gW3JvdywxXSkgKENIQSkuXG5UZXJtaW5hbC5wcm90b3R5cGUuY3Vyc29yQ2hhckFic29sdXRlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuICB0aGlzLnggPSBwYXJhbSAtIDE7XG59O1xuXG4vLyBDU0kgUHMgTFxuLy8gSW5zZXJ0IFBzIExpbmUocykgKGRlZmF1bHQgPSAxKSAoSUwpLlxuVGVybWluYWwucHJvdG90eXBlLmluc2VydExpbmVzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSwgcm93LCBqO1xuXG4gIHBhcmFtID0gcGFyYW1zWzBdO1xuICBpZiAocGFyYW0gPCAxKSBwYXJhbSA9IDE7XG4gIHJvdyA9IHRoaXMueSArIHRoaXMueWJhc2U7XG5cbiAgaiA9IHRoaXMucm93cyAtIDEgLSB0aGlzLnNjcm9sbEJvdHRvbTtcbiAgaiA9IHRoaXMucm93cyAtIDEgKyB0aGlzLnliYXNlIC0gaiArIDE7XG5cbiAgd2hpbGUgKHBhcmFtLS0pIHtcbiAgICAvLyB0ZXN0OiBlY2hvIC1lICdcXGVbNDRtXFxlWzFMXFxlWzBtJ1xuICAgIC8vIGJsYW5rTGluZSh0cnVlKSAtIHh0ZXJtL2xpbnV4IGJlaGF2aW9yXG4gICAgdGhpcy5saW5lcy5zcGxpY2Uocm93LCAwLCB0aGlzLmJsYW5rTGluZSh0cnVlKSk7XG4gICAgdGhpcy5saW5lcy5zcGxpY2UoaiwgMSk7XG4gIH1cblxuICAvLyB0aGlzLm1heFJhbmdlKCk7XG4gIHRoaXMudXBkYXRlUmFuZ2UodGhpcy55KTtcbiAgdGhpcy51cGRhdGVSYW5nZSh0aGlzLnNjcm9sbEJvdHRvbSk7XG59O1xuXG4vLyBDU0kgUHMgTVxuLy8gRGVsZXRlIFBzIExpbmUocykgKGRlZmF1bHQgPSAxKSAoREwpLlxuVGVybWluYWwucHJvdG90eXBlLmRlbGV0ZUxpbmVzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSwgcm93LCBqO1xuXG4gIHBhcmFtID0gcGFyYW1zWzBdO1xuICBpZiAocGFyYW0gPCAxKSBwYXJhbSA9IDE7XG4gIHJvdyA9IHRoaXMueSArIHRoaXMueWJhc2U7XG5cbiAgaiA9IHRoaXMucm93cyAtIDEgLSB0aGlzLnNjcm9sbEJvdHRvbTtcbiAgaiA9IHRoaXMucm93cyAtIDEgKyB0aGlzLnliYXNlIC0gajtcblxuICB3aGlsZSAocGFyYW0tLSkge1xuICAgIC8vIHRlc3Q6IGVjaG8gLWUgJ1xcZVs0NG1cXGVbMU1cXGVbMG0nXG4gICAgLy8gYmxhbmtMaW5lKHRydWUpIC0geHRlcm0vbGludXggYmVoYXZpb3JcbiAgICB0aGlzLmxpbmVzLnNwbGljZShqICsgMSwgMCwgdGhpcy5ibGFua0xpbmUodHJ1ZSkpO1xuICAgIHRoaXMubGluZXMuc3BsaWNlKHJvdywgMSk7XG4gIH1cblxuICAvLyB0aGlzLm1heFJhbmdlKCk7XG4gIHRoaXMudXBkYXRlUmFuZ2UodGhpcy55KTtcbiAgdGhpcy51cGRhdGVSYW5nZSh0aGlzLnNjcm9sbEJvdHRvbSk7XG59O1xuXG4vLyBDU0kgUHMgUFxuLy8gRGVsZXRlIFBzIENoYXJhY3RlcihzKSAoZGVmYXVsdCA9IDEpIChEQ0gpLlxuVGVybWluYWwucHJvdG90eXBlLmRlbGV0ZUNoYXJzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSwgcm93LCBjaDtcblxuICBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuXG4gIHJvdyA9IHRoaXMueSArIHRoaXMueWJhc2U7XG4gIGNoID0gW3RoaXMuY3VyQXR0ciwgJyAnXTsgLy8geHRlcm1cblxuICB3aGlsZSAocGFyYW0tLSkge1xuICAgIHRoaXMubGluZXNbcm93XS5zcGxpY2UodGhpcy54LCAxKTtcbiAgICB0aGlzLmxpbmVzW3Jvd10ucHVzaChjaCk7XG4gIH1cbn07XG5cbi8vIENTSSBQcyBYXG4vLyBFcmFzZSBQcyBDaGFyYWN0ZXIocykgKGRlZmF1bHQgPSAxKSAoRUNIKS5cblRlcm1pbmFsLnByb3RvdHlwZS5lcmFzZUNoYXJzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSwgcm93LCBqLCBjaDtcblxuICBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuXG4gIHJvdyA9IHRoaXMueSArIHRoaXMueWJhc2U7XG4gIGogPSB0aGlzLng7XG4gIGNoID0gW3RoaXMuY3VyQXR0ciwgJyAnXTsgLy8geHRlcm1cblxuICB3aGlsZSAocGFyYW0tLSAmJiBqIDwgdGhpcy5jb2xzKSB7XG4gICAgdGhpcy5saW5lc1tyb3ddW2orK10gPSBjaDtcbiAgfVxufTtcblxuLy8gQ1NJIFBtIGAgIENoYXJhY3RlciBQb3NpdGlvbiBBYnNvbHV0ZVxuLy8gICBbY29sdW1uXSAoZGVmYXVsdCA9IFtyb3csMV0pIChIUEEpLlxuVGVybWluYWwucHJvdG90eXBlLmNoYXJQb3NBYnNvbHV0ZSA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgcGFyYW0gPSBwYXJhbXNbMF07XG4gIGlmIChwYXJhbSA8IDEpIHBhcmFtID0gMTtcbiAgdGhpcy54ID0gcGFyYW0gLSAxO1xuICBpZiAodGhpcy54ID49IHRoaXMuY29scykge1xuICAgIHRoaXMueCA9IHRoaXMuY29scyAtIDE7XG4gIH1cbn07XG5cbi8vIDE0MSA2MSBhICogSFBSIC1cbi8vIEhvcml6b250YWwgUG9zaXRpb24gUmVsYXRpdmVcbi8vIHJldXNlIENTSSBQcyBDID9cblRlcm1pbmFsLnByb3RvdHlwZS5IUG9zaXRpb25SZWxhdGl2ZSA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgcGFyYW0gPSBwYXJhbXNbMF07XG4gIGlmIChwYXJhbSA8IDEpIHBhcmFtID0gMTtcbiAgdGhpcy54ICs9IHBhcmFtO1xuICBpZiAodGhpcy54ID49IHRoaXMuY29scykge1xuICAgIHRoaXMueCA9IHRoaXMuY29scyAtIDE7XG4gIH1cbn07XG5cbi8vIENTSSBQcyBjICBTZW5kIERldmljZSBBdHRyaWJ1dGVzIChQcmltYXJ5IERBKS5cbi8vICAgICBQcyA9IDAgIG9yIG9taXR0ZWQgLT4gcmVxdWVzdCBhdHRyaWJ1dGVzIGZyb20gdGVybWluYWwuICBUaGVcbi8vICAgICByZXNwb25zZSBkZXBlbmRzIG9uIHRoZSBkZWNUZXJtaW5hbElEIHJlc291cmNlIHNldHRpbmcuXG4vLyAgICAgLT4gQ1NJID8gMSA7IDIgYyAgKGBgVlQxMDAgd2l0aCBBZHZhbmNlZCBWaWRlbyBPcHRpb24nJylcbi8vICAgICAtPiBDU0kgPyAxIDsgMCBjICAoYGBWVDEwMSB3aXRoIE5vIE9wdGlvbnMnJylcbi8vICAgICAtPiBDU0kgPyA2IGMgIChgYFZUMTAyJycpXG4vLyAgICAgLT4gQ1NJID8gNiAwIDsgMSA7IDIgOyA2IDsgOCA7IDkgOyAxIDUgOyBjICAoYGBWVDIyMCcnKVxuLy8gICBUaGUgVlQxMDAtc3R5bGUgcmVzcG9uc2UgcGFyYW1ldGVycyBkbyBub3QgbWVhbiBhbnl0aGluZyBieVxuLy8gICB0aGVtc2VsdmVzLiAgVlQyMjAgcGFyYW1ldGVycyBkbywgdGVsbGluZyB0aGUgaG9zdCB3aGF0IGZlYS1cbi8vICAgdHVyZXMgdGhlIHRlcm1pbmFsIHN1cHBvcnRzOlxuLy8gICAgIFBzID0gMSAgLT4gMTMyLWNvbHVtbnMuXG4vLyAgICAgUHMgPSAyICAtPiBQcmludGVyLlxuLy8gICAgIFBzID0gNiAgLT4gU2VsZWN0aXZlIGVyYXNlLlxuLy8gICAgIFBzID0gOCAgLT4gVXNlci1kZWZpbmVkIGtleXMuXG4vLyAgICAgUHMgPSA5ICAtPiBOYXRpb25hbCByZXBsYWNlbWVudCBjaGFyYWN0ZXIgc2V0cy5cbi8vICAgICBQcyA9IDEgNSAgLT4gVGVjaG5pY2FsIGNoYXJhY3RlcnMuXG4vLyAgICAgUHMgPSAyIDIgIC0+IEFOU0kgY29sb3IsIGUuZy4sIFZUNTI1LlxuLy8gICAgIFBzID0gMiA5ICAtPiBBTlNJIHRleHQgbG9jYXRvciAoaS5lLiwgREVDIExvY2F0b3IgbW9kZSkuXG4vLyBDU0kgPiBQcyBjXG4vLyAgIFNlbmQgRGV2aWNlIEF0dHJpYnV0ZXMgKFNlY29uZGFyeSBEQSkuXG4vLyAgICAgUHMgPSAwICBvciBvbWl0dGVkIC0+IHJlcXVlc3QgdGhlIHRlcm1pbmFsJ3MgaWRlbnRpZmljYXRpb25cbi8vICAgICBjb2RlLiAgVGhlIHJlc3BvbnNlIGRlcGVuZHMgb24gdGhlIGRlY1Rlcm1pbmFsSUQgcmVzb3VyY2Ugc2V0LVxuLy8gICAgIHRpbmcuICBJdCBzaG91bGQgYXBwbHkgb25seSB0byBWVDIyMCBhbmQgdXAsIGJ1dCB4dGVybSBleHRlbmRzXG4vLyAgICAgdGhpcyB0byBWVDEwMC5cbi8vICAgICAtPiBDU0kgID4gUHAgOyBQdiA7IFBjIGNcbi8vICAgd2hlcmUgUHAgZGVub3RlcyB0aGUgdGVybWluYWwgdHlwZVxuLy8gICAgIFBwID0gMCAgLT4gYGBWVDEwMCcnLlxuLy8gICAgIFBwID0gMSAgLT4gYGBWVDIyMCcnLlxuLy8gICBhbmQgUHYgaXMgdGhlIGZpcm13YXJlIHZlcnNpb24gKGZvciB4dGVybSwgdGhpcyB3YXMgb3JpZ2luYWxseVxuLy8gICB0aGUgWEZyZWU4NiBwYXRjaCBudW1iZXIsIHN0YXJ0aW5nIHdpdGggOTUpLiAgSW4gYSBERUMgdGVybWktXG4vLyAgIG5hbCwgUGMgaW5kaWNhdGVzIHRoZSBST00gY2FydHJpZGdlIHJlZ2lzdHJhdGlvbiBudW1iZXIgYW5kIGlzXG4vLyAgIGFsd2F5cyB6ZXJvLlxuLy8gTW9yZSBpbmZvcm1hdGlvbjpcbi8vICAgeHRlcm0vY2hhcnByb2MuYyAtIGxpbmUgMjAxMiwgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4vLyAgIHZpbSByZXNwb25kcyB3aXRoIF5bWz8wYyBvciBeW1s/MWMgYWZ0ZXIgdGhlIHRlcm1pbmFsJ3MgcmVzcG9uc2UgKD8pXG5UZXJtaW5hbC5wcm90b3R5cGUuc2VuZERldmljZUF0dHJpYnV0ZXMgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgaWYgKHBhcmFtc1swXSA+IDApIHJldHVybjtcblxuICBpZiAoIXRoaXMucHJlZml4KSB7XG4gICAgaWYgKHRoaXMuaXMoJ3h0ZXJtJylcbiAgICAgICAgfHwgdGhpcy5pcygncnh2dC11bmljb2RlJylcbiAgICAgICAgfHwgdGhpcy5pcygnc2NyZWVuJykpIHtcbiAgICAgIHRoaXMuc2VuZCgnXFx4MWJbPzE7MmMnKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXMoJ2xpbnV4JykpIHtcbiAgICAgIHRoaXMuc2VuZCgnXFx4MWJbPzZjJyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHRoaXMucHJlZml4ID09PSAnPicpIHtcbiAgICAvLyB4dGVybSBhbmQgdXJ4dnRcbiAgICAvLyBzZWVtIHRvIHNwaXQgdGhpc1xuICAgIC8vIG91dCBhcm91bmQgfjM3MCB0aW1lcyAoPykuXG4gICAgaWYgKHRoaXMuaXMoJ3h0ZXJtJykpIHtcbiAgICAgIHRoaXMuc2VuZCgnXFx4MWJbPjA7Mjc2OzBjJyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmlzKCdyeHZ0LXVuaWNvZGUnKSkge1xuICAgICAgdGhpcy5zZW5kKCdcXHgxYls+ODU7OTU7MGMnKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXMoJ2xpbnV4JykpIHtcbiAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgYnkgbGludXggY29uc29sZS5cbiAgICAgIC8vIGxpbnV4IGNvbnNvbGUgZWNob2VzIHBhcmFtZXRlcnMuXG4gICAgICB0aGlzLnNlbmQocGFyYW1zWzBdICsgJ2MnKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuaXMoJ3NjcmVlbicpKSB7XG4gICAgICB0aGlzLnNlbmQoJ1xceDFiWz44Mzs0MDAwMzswYycpO1xuICAgIH1cbiAgfVxufTtcblxuLy8gQ1NJIFBtIGRcbi8vIExpbmUgUG9zaXRpb24gQWJzb2x1dGUgIFtyb3ddIChkZWZhdWx0ID0gWzEsY29sdW1uXSkgKFZQQSkuXG5UZXJtaW5hbC5wcm90b3R5cGUubGluZVBvc0Fic29sdXRlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuICB0aGlzLnkgPSBwYXJhbSAtIDE7XG4gIGlmICh0aGlzLnkgPj0gdGhpcy5yb3dzKSB7XG4gICAgdGhpcy55ID0gdGhpcy5yb3dzIC0gMTtcbiAgfVxufTtcblxuLy8gMTQ1IDY1IGUgKiBWUFIgLSBWZXJ0aWNhbCBQb3NpdGlvbiBSZWxhdGl2ZVxuLy8gcmV1c2UgQ1NJIFBzIEIgP1xuVGVybWluYWwucHJvdG90eXBlLlZQb3NpdGlvblJlbGF0aXZlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDwgMSkgcGFyYW0gPSAxO1xuICB0aGlzLnkgKz0gcGFyYW07XG4gIGlmICh0aGlzLnkgPj0gdGhpcy5yb3dzKSB7XG4gICAgdGhpcy55ID0gdGhpcy5yb3dzIC0gMTtcbiAgfVxufTtcblxuLy8gQ1NJIFBzIDsgUHMgZlxuLy8gICBIb3Jpem9udGFsIGFuZCBWZXJ0aWNhbCBQb3NpdGlvbiBbcm93O2NvbHVtbl0gKGRlZmF1bHQgPVxuLy8gICBbMSwxXSkgKEhWUCkuXG5UZXJtaW5hbC5wcm90b3R5cGUuSFZQb3NpdGlvbiA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICBpZiAocGFyYW1zWzBdIDwgMSkgcGFyYW1zWzBdID0gMTtcbiAgaWYgKHBhcmFtc1sxXSA8IDEpIHBhcmFtc1sxXSA9IDE7XG5cbiAgdGhpcy55ID0gcGFyYW1zWzBdIC0gMTtcbiAgaWYgKHRoaXMueSA+PSB0aGlzLnJvd3MpIHtcbiAgICB0aGlzLnkgPSB0aGlzLnJvd3MgLSAxO1xuICB9XG5cbiAgdGhpcy54ID0gcGFyYW1zWzFdIC0gMTtcbiAgaWYgKHRoaXMueCA+PSB0aGlzLmNvbHMpIHtcbiAgICB0aGlzLnggPSB0aGlzLmNvbHMgLSAxO1xuICB9XG59O1xuXG4vLyBDU0kgUG0gaCAgU2V0IE1vZGUgKFNNKS5cbi8vICAgICBQcyA9IDIgIC0+IEtleWJvYXJkIEFjdGlvbiBNb2RlIChBTSkuXG4vLyAgICAgUHMgPSA0ICAtPiBJbnNlcnQgTW9kZSAoSVJNKS5cbi8vICAgICBQcyA9IDEgMiAgLT4gU2VuZC9yZWNlaXZlIChTUk0pLlxuLy8gICAgIFBzID0gMiAwICAtPiBBdXRvbWF0aWMgTmV3bGluZSAoTE5NKS5cbi8vIENTSSA/IFBtIGhcbi8vICAgREVDIFByaXZhdGUgTW9kZSBTZXQgKERFQ1NFVCkuXG4vLyAgICAgUHMgPSAxICAtPiBBcHBsaWNhdGlvbiBDdXJzb3IgS2V5cyAoREVDQ0tNKS5cbi8vICAgICBQcyA9IDIgIC0+IERlc2lnbmF0ZSBVU0FTQ0lJIGZvciBjaGFyYWN0ZXIgc2V0cyBHMC1HM1xuLy8gICAgIChERUNBTk0pLCBhbmQgc2V0IFZUMTAwIG1vZGUuXG4vLyAgICAgUHMgPSAzICAtPiAxMzIgQ29sdW1uIE1vZGUgKERFQ0NPTE0pLlxuLy8gICAgIFBzID0gNCAgLT4gU21vb3RoIChTbG93KSBTY3JvbGwgKERFQ1NDTE0pLlxuLy8gICAgIFBzID0gNSAgLT4gUmV2ZXJzZSBWaWRlbyAoREVDU0NOTSkuXG4vLyAgICAgUHMgPSA2ICAtPiBPcmlnaW4gTW9kZSAoREVDT00pLlxuLy8gICAgIFBzID0gNyAgLT4gV3JhcGFyb3VuZCBNb2RlIChERUNBV00pLlxuLy8gICAgIFBzID0gOCAgLT4gQXV0by1yZXBlYXQgS2V5cyAoREVDQVJNKS5cbi8vICAgICBQcyA9IDkgIC0+IFNlbmQgTW91c2UgWCAmIFkgb24gYnV0dG9uIHByZXNzLiAgU2VlIHRoZSBzZWMtXG4vLyAgICAgdGlvbiBNb3VzZSBUcmFja2luZy5cbi8vICAgICBQcyA9IDEgMCAgLT4gU2hvdyB0b29sYmFyIChyeHZ0KS5cbi8vICAgICBQcyA9IDEgMiAgLT4gU3RhcnQgQmxpbmtpbmcgQ3Vyc29yIChhdHQ2MTApLlxuLy8gICAgIFBzID0gMSA4ICAtPiBQcmludCBmb3JtIGZlZWQgKERFQ1BGRikuXG4vLyAgICAgUHMgPSAxIDkgIC0+IFNldCBwcmludCBleHRlbnQgdG8gZnVsbCBzY3JlZW4gKERFQ1BFWCkuXG4vLyAgICAgUHMgPSAyIDUgIC0+IFNob3cgQ3Vyc29yIChERUNUQ0VNKS5cbi8vICAgICBQcyA9IDMgMCAgLT4gU2hvdyBzY3JvbGxiYXIgKHJ4dnQpLlxuLy8gICAgIFBzID0gMyA1ICAtPiBFbmFibGUgZm9udC1zaGlmdGluZyBmdW5jdGlvbnMgKHJ4dnQpLlxuLy8gICAgIFBzID0gMyA4ICAtPiBFbnRlciBUZWt0cm9uaXggTW9kZSAoREVDVEVLKS5cbi8vICAgICBQcyA9IDQgMCAgLT4gQWxsb3cgODAgLT4gMTMyIE1vZGUuXG4vLyAgICAgUHMgPSA0IDEgIC0+IG1vcmUoMSkgZml4IChzZWUgY3Vyc2VzIHJlc291cmNlKS5cbi8vICAgICBQcyA9IDQgMiAgLT4gRW5hYmxlIE5hdGlvbiBSZXBsYWNlbWVudCBDaGFyYWN0ZXIgc2V0cyAoREVDTi1cbi8vICAgICBSQ00pLlxuLy8gICAgIFBzID0gNCA0ICAtPiBUdXJuIE9uIE1hcmdpbiBCZWxsLlxuLy8gICAgIFBzID0gNCA1ICAtPiBSZXZlcnNlLXdyYXBhcm91bmQgTW9kZS5cbi8vICAgICBQcyA9IDQgNiAgLT4gU3RhcnQgTG9nZ2luZy4gIFRoaXMgaXMgbm9ybWFsbHkgZGlzYWJsZWQgYnkgYVxuLy8gICAgIGNvbXBpbGUtdGltZSBvcHRpb24uXG4vLyAgICAgUHMgPSA0IDcgIC0+IFVzZSBBbHRlcm5hdGUgU2NyZWVuIEJ1ZmZlci4gIChUaGlzIG1heSBiZSBkaXMtXG4vLyAgICAgYWJsZWQgYnkgdGhlIHRpdGVJbmhpYml0IHJlc291cmNlKS5cbi8vICAgICBQcyA9IDYgNiAgLT4gQXBwbGljYXRpb24ga2V5cGFkIChERUNOS00pLlxuLy8gICAgIFBzID0gNiA3ICAtPiBCYWNrYXJyb3cga2V5IHNlbmRzIGJhY2tzcGFjZSAoREVDQktNKS5cbi8vICAgICBQcyA9IDEgMCAwIDAgIC0+IFNlbmQgTW91c2UgWCAmIFkgb24gYnV0dG9uIHByZXNzIGFuZFxuLy8gICAgIHJlbGVhc2UuICBTZWUgdGhlIHNlY3Rpb24gTW91c2UgVHJhY2tpbmcuXG4vLyAgICAgUHMgPSAxIDAgMCAxICAtPiBVc2UgSGlsaXRlIE1vdXNlIFRyYWNraW5nLlxuLy8gICAgIFBzID0gMSAwIDAgMiAgLT4gVXNlIENlbGwgTW90aW9uIE1vdXNlIFRyYWNraW5nLlxuLy8gICAgIFBzID0gMSAwIDAgMyAgLT4gVXNlIEFsbCBNb3Rpb24gTW91c2UgVHJhY2tpbmcuXG4vLyAgICAgUHMgPSAxIDAgMCA0ICAtPiBTZW5kIEZvY3VzSW4vRm9jdXNPdXQgZXZlbnRzLlxuLy8gICAgIFBzID0gMSAwIDAgNSAgLT4gRW5hYmxlIEV4dGVuZGVkIE1vdXNlIE1vZGUuXG4vLyAgICAgUHMgPSAxIDAgMSAwICAtPiBTY3JvbGwgdG8gYm90dG9tIG9uIHR0eSBvdXRwdXQgKHJ4dnQpLlxuLy8gICAgIFBzID0gMSAwIDEgMSAgLT4gU2Nyb2xsIHRvIGJvdHRvbSBvbiBrZXkgcHJlc3MgKHJ4dnQpLlxuLy8gICAgIFBzID0gMSAwIDMgNCAgLT4gSW50ZXJwcmV0IFwibWV0YVwiIGtleSwgc2V0cyBlaWdodGggYml0LlxuLy8gICAgIChlbmFibGVzIHRoZSBlaWdodEJpdElucHV0IHJlc291cmNlKS5cbi8vICAgICBQcyA9IDEgMCAzIDUgIC0+IEVuYWJsZSBzcGVjaWFsIG1vZGlmaWVycyBmb3IgQWx0IGFuZCBOdW0tXG4vLyAgICAgTG9jayBrZXlzLiAgKFRoaXMgZW5hYmxlcyB0aGUgbnVtTG9jayByZXNvdXJjZSkuXG4vLyAgICAgUHMgPSAxIDAgMyA2ICAtPiBTZW5kIEVTQyAgIHdoZW4gTWV0YSBtb2RpZmllcyBhIGtleS4gIChUaGlzXG4vLyAgICAgZW5hYmxlcyB0aGUgbWV0YVNlbmRzRXNjYXBlIHJlc291cmNlKS5cbi8vICAgICBQcyA9IDEgMCAzIDcgIC0+IFNlbmQgREVMIGZyb20gdGhlIGVkaXRpbmcta2V5cGFkIERlbGV0ZVxuLy8gICAgIGtleS5cbi8vICAgICBQcyA9IDEgMCAzIDkgIC0+IFNlbmQgRVNDICB3aGVuIEFsdCBtb2RpZmllcyBhIGtleS4gIChUaGlzXG4vLyAgICAgZW5hYmxlcyB0aGUgYWx0U2VuZHNFc2NhcGUgcmVzb3VyY2UpLlxuLy8gICAgIFBzID0gMSAwIDQgMCAgLT4gS2VlcCBzZWxlY3Rpb24gZXZlbiBpZiBub3QgaGlnaGxpZ2h0ZWQuXG4vLyAgICAgKFRoaXMgZW5hYmxlcyB0aGUga2VlcFNlbGVjdGlvbiByZXNvdXJjZSkuXG4vLyAgICAgUHMgPSAxIDAgNCAxICAtPiBVc2UgdGhlIENMSVBCT0FSRCBzZWxlY3Rpb24uICAoVGhpcyBlbmFibGVzXG4vLyAgICAgdGhlIHNlbGVjdFRvQ2xpcGJvYXJkIHJlc291cmNlKS5cbi8vICAgICBQcyA9IDEgMCA0IDIgIC0+IEVuYWJsZSBVcmdlbmN5IHdpbmRvdyBtYW5hZ2VyIGhpbnQgd2hlblxuLy8gICAgIENvbnRyb2wtRyBpcyByZWNlaXZlZC4gIChUaGlzIGVuYWJsZXMgdGhlIGJlbGxJc1VyZ2VudFxuLy8gICAgIHJlc291cmNlKS5cbi8vICAgICBQcyA9IDEgMCA0IDMgIC0+IEVuYWJsZSByYWlzaW5nIG9mIHRoZSB3aW5kb3cgd2hlbiBDb250cm9sLUdcbi8vICAgICBpcyByZWNlaXZlZC4gIChlbmFibGVzIHRoZSBwb3BPbkJlbGwgcmVzb3VyY2UpLlxuLy8gICAgIFBzID0gMSAwIDQgNyAgLT4gVXNlIEFsdGVybmF0ZSBTY3JlZW4gQnVmZmVyLiAgKFRoaXMgbWF5IGJlXG4vLyAgICAgZGlzYWJsZWQgYnkgdGhlIHRpdGVJbmhpYml0IHJlc291cmNlKS5cbi8vICAgICBQcyA9IDEgMCA0IDggIC0+IFNhdmUgY3Vyc29yIGFzIGluIERFQ1NDLiAgKFRoaXMgbWF5IGJlIGRpcy1cbi8vICAgICBhYmxlZCBieSB0aGUgdGl0ZUluaGliaXQgcmVzb3VyY2UpLlxuLy8gICAgIFBzID0gMSAwIDQgOSAgLT4gU2F2ZSBjdXJzb3IgYXMgaW4gREVDU0MgYW5kIHVzZSBBbHRlcm5hdGVcbi8vICAgICBTY3JlZW4gQnVmZmVyLCBjbGVhcmluZyBpdCBmaXJzdC4gIChUaGlzIG1heSBiZSBkaXNhYmxlZCBieVxuLy8gICAgIHRoZSB0aXRlSW5oaWJpdCByZXNvdXJjZSkuICBUaGlzIGNvbWJpbmVzIHRoZSBlZmZlY3RzIG9mIHRoZSAxXG4vLyAgICAgMCA0IDcgIGFuZCAxIDAgNCA4ICBtb2Rlcy4gIFVzZSB0aGlzIHdpdGggdGVybWluZm8tYmFzZWRcbi8vICAgICBhcHBsaWNhdGlvbnMgcmF0aGVyIHRoYW4gdGhlIDQgNyAgbW9kZS5cbi8vICAgICBQcyA9IDEgMCA1IDAgIC0+IFNldCB0ZXJtaW5mby90ZXJtY2FwIGZ1bmN0aW9uLWtleSBtb2RlLlxuLy8gICAgIFBzID0gMSAwIDUgMSAgLT4gU2V0IFN1biBmdW5jdGlvbi1rZXkgbW9kZS5cbi8vICAgICBQcyA9IDEgMCA1IDIgIC0+IFNldCBIUCBmdW5jdGlvbi1rZXkgbW9kZS5cbi8vICAgICBQcyA9IDEgMCA1IDMgIC0+IFNldCBTQ08gZnVuY3Rpb24ta2V5IG1vZGUuXG4vLyAgICAgUHMgPSAxIDAgNiAwICAtPiBTZXQgbGVnYWN5IGtleWJvYXJkIGVtdWxhdGlvbiAoWDExUjYpLlxuLy8gICAgIFBzID0gMSAwIDYgMSAgLT4gU2V0IFZUMjIwIGtleWJvYXJkIGVtdWxhdGlvbi5cbi8vICAgICBQcyA9IDIgMCAwIDQgIC0+IFNldCBicmFja2V0ZWQgcGFzdGUgbW9kZS5cbi8vIE1vZGVzOlxuLy8gICBodHRwOi8vdnQxMDAubmV0L2RvY3MvdnQyMjAtcm0vY2hhcHRlcjQuaHRtbFxuVGVybWluYWwucHJvdG90eXBlLnNldE1vZGUgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgaWYgKHR5cGVvZiBwYXJhbXMgPT09ICdvYmplY3QnKSB7XG4gICAgdmFyIGwgPSBwYXJhbXMubGVuZ3RoXG4gICAgICAsIGkgPSAwO1xuXG4gICAgZm9yICg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHRoaXMuc2V0TW9kZShwYXJhbXNbaV0pO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICghdGhpcy5wcmVmaXgpIHtcbiAgICBzd2l0Y2ggKHBhcmFtcykge1xuICAgICAgY2FzZSA0OlxuICAgICAgICB0aGlzLmluc2VydE1vZGUgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjA6XG4gICAgICAgIC8vdGhpcy5jb252ZXJ0RW9sID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9IGVsc2UgaWYgKHRoaXMucHJlZml4ID09PSAnPycpIHtcbiAgICBzd2l0Y2ggKHBhcmFtcykge1xuICAgICAgY2FzZSAxOlxuICAgICAgICB0aGlzLmFwcGxpY2F0aW9uQ3Vyc29yID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIHRoaXMuc2V0Z0NoYXJzZXQoMCwgVGVybWluYWwuY2hhcnNldHMuVVMpO1xuICAgICAgICB0aGlzLnNldGdDaGFyc2V0KDEsIFRlcm1pbmFsLmNoYXJzZXRzLlVTKTtcbiAgICAgICAgdGhpcy5zZXRnQ2hhcnNldCgyLCBUZXJtaW5hbC5jaGFyc2V0cy5VUyk7XG4gICAgICAgIHRoaXMuc2V0Z0NoYXJzZXQoMywgVGVybWluYWwuY2hhcnNldHMuVVMpO1xuICAgICAgICAvLyBzZXQgVlQxMDAgbW9kZSBoZXJlXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOiAvLyAxMzIgY29sIG1vZGVcbiAgICAgICAgdGhpcy5zYXZlZENvbHMgPSB0aGlzLmNvbHM7XG4gICAgICAgIHRoaXMucmVzaXplKDEzMiwgdGhpcy5yb3dzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDY6XG4gICAgICAgIHRoaXMub3JpZ2luTW9kZSA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSA3OlxuICAgICAgICB0aGlzLndyYXBhcm91bmRNb2RlID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDEyOlxuICAgICAgICAvLyB0aGlzLmN1cnNvckJsaW5rID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDk6IC8vIFgxMCBNb3VzZVxuICAgICAgICAvLyBubyByZWxlYXNlLCBubyBtb3Rpb24sIG5vIHdoZWVsLCBubyBtb2RpZmllcnMuXG4gICAgICBjYXNlIDEwMDA6IC8vIHZ0MjAwIG1vdXNlXG4gICAgICAgIC8vIG5vIG1vdGlvbi5cbiAgICAgICAgLy8gbm8gbW9kaWZpZXJzLCBleGNlcHQgY29udHJvbCBvbiB0aGUgd2hlZWwuXG4gICAgICBjYXNlIDEwMDI6IC8vIGJ1dHRvbiBldmVudCBtb3VzZVxuICAgICAgY2FzZSAxMDAzOiAvLyBhbnkgZXZlbnQgbW91c2VcbiAgICAgICAgLy8gYW55IGV2ZW50IC0gc2VuZHMgbW90aW9uIGV2ZW50cyxcbiAgICAgICAgLy8gZXZlbiBpZiB0aGVyZSBpcyBubyBidXR0b24gaGVsZCBkb3duLlxuICAgICAgICB0aGlzLngxME1vdXNlID0gcGFyYW1zID09PSA5O1xuICAgICAgICB0aGlzLnZ0MjAwTW91c2UgPSBwYXJhbXMgPT09IDEwMDA7XG4gICAgICAgIHRoaXMubm9ybWFsTW91c2UgPSBwYXJhbXMgPiAxMDAwO1xuICAgICAgICB0aGlzLm1vdXNlRXZlbnRzID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLmN1cnNvciA9ICdkZWZhdWx0JztcbiAgICAgICAgdGhpcy5sb2coJ0JpbmRpbmcgdG8gbW91c2UgZXZlbnRzLicpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTAwNDogLy8gc2VuZCBmb2N1c2luL2ZvY3Vzb3V0IGV2ZW50c1xuICAgICAgICAvLyBmb2N1c2luOiBeW1tJXG4gICAgICAgIC8vIGZvY3Vzb3V0OiBeW1tPXG4gICAgICAgIHRoaXMuc2VuZEZvY3VzID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDEwMDU6IC8vIHV0ZjggZXh0IG1vZGUgbW91c2VcbiAgICAgICAgdGhpcy51dGZNb3VzZSA9IHRydWU7XG4gICAgICAgIC8vIGZvciB3aWRlIHRlcm1pbmFsc1xuICAgICAgICAvLyBzaW1wbHkgZW5jb2RlcyBsYXJnZSB2YWx1ZXMgYXMgdXRmOCBjaGFyYWN0ZXJzXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAxMDA2OiAvLyBzZ3IgZXh0IG1vZGUgbW91c2VcbiAgICAgICAgdGhpcy5zZ3JNb3VzZSA9IHRydWU7XG4gICAgICAgIC8vIGZvciB3aWRlIHRlcm1pbmFsc1xuICAgICAgICAvLyBkb2VzIG5vdCBhZGQgMzIgdG8gZmllbGRzXG4gICAgICAgIC8vIHByZXNzOiBeW1s8Yjt4O3lNXG4gICAgICAgIC8vIHJlbGVhc2U6IF5bWzxiO3g7eW1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDEwMTU6IC8vIHVyeHZ0IGV4dCBtb2RlIG1vdXNlXG4gICAgICAgIHRoaXMudXJ4dnRNb3VzZSA9IHRydWU7XG4gICAgICAgIC8vIGZvciB3aWRlIHRlcm1pbmFsc1xuICAgICAgICAvLyBudW1iZXJzIGZvciBmaWVsZHNcbiAgICAgICAgLy8gcHJlc3M6IF5bW2I7eDt5TVxuICAgICAgICAvLyBtb3Rpb246IF5bW2I7eDt5VFxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjU6IC8vIHNob3cgY3Vyc29yXG4gICAgICAgIHRoaXMuY3Vyc29ySGlkZGVuID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAxMDQ5OiAvLyBhbHQgc2NyZWVuIGJ1ZmZlciBjdXJzb3JcbiAgICAgICAgLy90aGlzLnNhdmVDdXJzb3IoKTtcbiAgICAgICAgOyAvLyBGQUxMLVRIUk9VR0hcbiAgICAgIGNhc2UgNDc6IC8vIGFsdCBzY3JlZW4gYnVmZmVyXG4gICAgICBjYXNlIDEwNDc6IC8vIGFsdCBzY3JlZW4gYnVmZmVyXG4gICAgICAgIGlmICghdGhpcy5ub3JtYWwpIHtcbiAgICAgICAgICB2YXIgbm9ybWFsID0ge1xuICAgICAgICAgICAgbGluZXM6IHRoaXMubGluZXMsXG4gICAgICAgICAgICB5YmFzZTogdGhpcy55YmFzZSxcbiAgICAgICAgICAgIHlkaXNwOiB0aGlzLnlkaXNwLFxuICAgICAgICAgICAgeDogdGhpcy54LFxuICAgICAgICAgICAgeTogdGhpcy55LFxuICAgICAgICAgICAgc2Nyb2xsVG9wOiB0aGlzLnNjcm9sbFRvcCxcbiAgICAgICAgICAgIHNjcm9sbEJvdHRvbTogdGhpcy5zY3JvbGxCb3R0b20sXG4gICAgICAgICAgICB0YWJzOiB0aGlzLnRhYnNcbiAgICAgICAgICAgIC8vIFhYWCBzYXZlIGNoYXJzZXQocykgaGVyZT9cbiAgICAgICAgICAgIC8vIGNoYXJzZXQ6IHRoaXMuY2hhcnNldCxcbiAgICAgICAgICAgIC8vIGdsZXZlbDogdGhpcy5nbGV2ZWwsXG4gICAgICAgICAgICAvLyBjaGFyc2V0czogdGhpcy5jaGFyc2V0c1xuICAgICAgICAgIH07XG4gICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICAgIHRoaXMubm9ybWFsID0gbm9ybWFsO1xuICAgICAgICAgIHRoaXMuc2hvd0N1cnNvcigpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufTtcblxuLy8gQ1NJIFBtIGwgIFJlc2V0IE1vZGUgKFJNKS5cbi8vICAgICBQcyA9IDIgIC0+IEtleWJvYXJkIEFjdGlvbiBNb2RlIChBTSkuXG4vLyAgICAgUHMgPSA0ICAtPiBSZXBsYWNlIE1vZGUgKElSTSkuXG4vLyAgICAgUHMgPSAxIDIgIC0+IFNlbmQvcmVjZWl2ZSAoU1JNKS5cbi8vICAgICBQcyA9IDIgMCAgLT4gTm9ybWFsIExpbmVmZWVkIChMTk0pLlxuLy8gQ1NJID8gUG0gbFxuLy8gICBERUMgUHJpdmF0ZSBNb2RlIFJlc2V0IChERUNSU1QpLlxuLy8gICAgIFBzID0gMSAgLT4gTm9ybWFsIEN1cnNvciBLZXlzIChERUNDS00pLlxuLy8gICAgIFBzID0gMiAgLT4gRGVzaWduYXRlIFZUNTIgbW9kZSAoREVDQU5NKS5cbi8vICAgICBQcyA9IDMgIC0+IDgwIENvbHVtbiBNb2RlIChERUNDT0xNKS5cbi8vICAgICBQcyA9IDQgIC0+IEp1bXAgKEZhc3QpIFNjcm9sbCAoREVDU0NMTSkuXG4vLyAgICAgUHMgPSA1ICAtPiBOb3JtYWwgVmlkZW8gKERFQ1NDTk0pLlxuLy8gICAgIFBzID0gNiAgLT4gTm9ybWFsIEN1cnNvciBNb2RlIChERUNPTSkuXG4vLyAgICAgUHMgPSA3ICAtPiBObyBXcmFwYXJvdW5kIE1vZGUgKERFQ0FXTSkuXG4vLyAgICAgUHMgPSA4ICAtPiBObyBBdXRvLXJlcGVhdCBLZXlzIChERUNBUk0pLlxuLy8gICAgIFBzID0gOSAgLT4gRG9uJ3Qgc2VuZCBNb3VzZSBYICYgWSBvbiBidXR0b24gcHJlc3MuXG4vLyAgICAgUHMgPSAxIDAgIC0+IEhpZGUgdG9vbGJhciAocnh2dCkuXG4vLyAgICAgUHMgPSAxIDIgIC0+IFN0b3AgQmxpbmtpbmcgQ3Vyc29yIChhdHQ2MTApLlxuLy8gICAgIFBzID0gMSA4ICAtPiBEb24ndCBwcmludCBmb3JtIGZlZWQgKERFQ1BGRikuXG4vLyAgICAgUHMgPSAxIDkgIC0+IExpbWl0IHByaW50IHRvIHNjcm9sbGluZyByZWdpb24gKERFQ1BFWCkuXG4vLyAgICAgUHMgPSAyIDUgIC0+IEhpZGUgQ3Vyc29yIChERUNUQ0VNKS5cbi8vICAgICBQcyA9IDMgMCAgLT4gRG9uJ3Qgc2hvdyBzY3JvbGxiYXIgKHJ4dnQpLlxuLy8gICAgIFBzID0gMyA1ICAtPiBEaXNhYmxlIGZvbnQtc2hpZnRpbmcgZnVuY3Rpb25zIChyeHZ0KS5cbi8vICAgICBQcyA9IDQgMCAgLT4gRGlzYWxsb3cgODAgLT4gMTMyIE1vZGUuXG4vLyAgICAgUHMgPSA0IDEgIC0+IE5vIG1vcmUoMSkgZml4IChzZWUgY3Vyc2VzIHJlc291cmNlKS5cbi8vICAgICBQcyA9IDQgMiAgLT4gRGlzYWJsZSBOYXRpb24gUmVwbGFjZW1lbnQgQ2hhcmFjdGVyIHNldHMgKERFQy1cbi8vICAgICBOUkNNKS5cbi8vICAgICBQcyA9IDQgNCAgLT4gVHVybiBPZmYgTWFyZ2luIEJlbGwuXG4vLyAgICAgUHMgPSA0IDUgIC0+IE5vIFJldmVyc2Utd3JhcGFyb3VuZCBNb2RlLlxuLy8gICAgIFBzID0gNCA2ICAtPiBTdG9wIExvZ2dpbmcuICAoVGhpcyBpcyBub3JtYWxseSBkaXNhYmxlZCBieSBhXG4vLyAgICAgY29tcGlsZS10aW1lIG9wdGlvbikuXG4vLyAgICAgUHMgPSA0IDcgIC0+IFVzZSBOb3JtYWwgU2NyZWVuIEJ1ZmZlci5cbi8vICAgICBQcyA9IDYgNiAgLT4gTnVtZXJpYyBrZXlwYWQgKERFQ05LTSkuXG4vLyAgICAgUHMgPSA2IDcgIC0+IEJhY2thcnJvdyBrZXkgc2VuZHMgZGVsZXRlIChERUNCS00pLlxuLy8gICAgIFBzID0gMSAwIDAgMCAgLT4gRG9uJ3Qgc2VuZCBNb3VzZSBYICYgWSBvbiBidXR0b24gcHJlc3MgYW5kXG4vLyAgICAgcmVsZWFzZS4gIFNlZSB0aGUgc2VjdGlvbiBNb3VzZSBUcmFja2luZy5cbi8vICAgICBQcyA9IDEgMCAwIDEgIC0+IERvbid0IHVzZSBIaWxpdGUgTW91c2UgVHJhY2tpbmcuXG4vLyAgICAgUHMgPSAxIDAgMCAyICAtPiBEb24ndCB1c2UgQ2VsbCBNb3Rpb24gTW91c2UgVHJhY2tpbmcuXG4vLyAgICAgUHMgPSAxIDAgMCAzICAtPiBEb24ndCB1c2UgQWxsIE1vdGlvbiBNb3VzZSBUcmFja2luZy5cbi8vICAgICBQcyA9IDEgMCAwIDQgIC0+IERvbid0IHNlbmQgRm9jdXNJbi9Gb2N1c091dCBldmVudHMuXG4vLyAgICAgUHMgPSAxIDAgMCA1ICAtPiBEaXNhYmxlIEV4dGVuZGVkIE1vdXNlIE1vZGUuXG4vLyAgICAgUHMgPSAxIDAgMSAwICAtPiBEb24ndCBzY3JvbGwgdG8gYm90dG9tIG9uIHR0eSBvdXRwdXRcbi8vICAgICAocnh2dCkuXG4vLyAgICAgUHMgPSAxIDAgMSAxICAtPiBEb24ndCBzY3JvbGwgdG8gYm90dG9tIG9uIGtleSBwcmVzcyAocnh2dCkuXG4vLyAgICAgUHMgPSAxIDAgMyA0ICAtPiBEb24ndCBpbnRlcnByZXQgXCJtZXRhXCIga2V5LiAgKFRoaXMgZGlzYWJsZXNcbi8vICAgICB0aGUgZWlnaHRCaXRJbnB1dCByZXNvdXJjZSkuXG4vLyAgICAgUHMgPSAxIDAgMyA1ICAtPiBEaXNhYmxlIHNwZWNpYWwgbW9kaWZpZXJzIGZvciBBbHQgYW5kIE51bS1cbi8vICAgICBMb2NrIGtleXMuICAoVGhpcyBkaXNhYmxlcyB0aGUgbnVtTG9jayByZXNvdXJjZSkuXG4vLyAgICAgUHMgPSAxIDAgMyA2ICAtPiBEb24ndCBzZW5kIEVTQyAgd2hlbiBNZXRhIG1vZGlmaWVzIGEga2V5LlxuLy8gICAgIChUaGlzIGRpc2FibGVzIHRoZSBtZXRhU2VuZHNFc2NhcGUgcmVzb3VyY2UpLlxuLy8gICAgIFBzID0gMSAwIDMgNyAgLT4gU2VuZCBWVDIyMCBSZW1vdmUgZnJvbSB0aGUgZWRpdGluZy1rZXlwYWRcbi8vICAgICBEZWxldGUga2V5LlxuLy8gICAgIFBzID0gMSAwIDMgOSAgLT4gRG9uJ3Qgc2VuZCBFU0MgIHdoZW4gQWx0IG1vZGlmaWVzIGEga2V5LlxuLy8gICAgIChUaGlzIGRpc2FibGVzIHRoZSBhbHRTZW5kc0VzY2FwZSByZXNvdXJjZSkuXG4vLyAgICAgUHMgPSAxIDAgNCAwICAtPiBEbyBub3Qga2VlcCBzZWxlY3Rpb24gd2hlbiBub3QgaGlnaGxpZ2h0ZWQuXG4vLyAgICAgKFRoaXMgZGlzYWJsZXMgdGhlIGtlZXBTZWxlY3Rpb24gcmVzb3VyY2UpLlxuLy8gICAgIFBzID0gMSAwIDQgMSAgLT4gVXNlIHRoZSBQUklNQVJZIHNlbGVjdGlvbi4gIChUaGlzIGRpc2FibGVzXG4vLyAgICAgdGhlIHNlbGVjdFRvQ2xpcGJvYXJkIHJlc291cmNlKS5cbi8vICAgICBQcyA9IDEgMCA0IDIgIC0+IERpc2FibGUgVXJnZW5jeSB3aW5kb3cgbWFuYWdlciBoaW50IHdoZW5cbi8vICAgICBDb250cm9sLUcgaXMgcmVjZWl2ZWQuICAoVGhpcyBkaXNhYmxlcyB0aGUgYmVsbElzVXJnZW50XG4vLyAgICAgcmVzb3VyY2UpLlxuLy8gICAgIFBzID0gMSAwIDQgMyAgLT4gRGlzYWJsZSByYWlzaW5nIG9mIHRoZSB3aW5kb3cgd2hlbiBDb250cm9sLVxuLy8gICAgIEcgaXMgcmVjZWl2ZWQuICAoVGhpcyBkaXNhYmxlcyB0aGUgcG9wT25CZWxsIHJlc291cmNlKS5cbi8vICAgICBQcyA9IDEgMCA0IDcgIC0+IFVzZSBOb3JtYWwgU2NyZWVuIEJ1ZmZlciwgY2xlYXJpbmcgc2NyZWVuXG4vLyAgICAgZmlyc3QgaWYgaW4gdGhlIEFsdGVybmF0ZSBTY3JlZW4uICAoVGhpcyBtYXkgYmUgZGlzYWJsZWQgYnlcbi8vICAgICB0aGUgdGl0ZUluaGliaXQgcmVzb3VyY2UpLlxuLy8gICAgIFBzID0gMSAwIDQgOCAgLT4gUmVzdG9yZSBjdXJzb3IgYXMgaW4gREVDUkMuICAoVGhpcyBtYXkgYmVcbi8vICAgICBkaXNhYmxlZCBieSB0aGUgdGl0ZUluaGliaXQgcmVzb3VyY2UpLlxuLy8gICAgIFBzID0gMSAwIDQgOSAgLT4gVXNlIE5vcm1hbCBTY3JlZW4gQnVmZmVyIGFuZCByZXN0b3JlIGN1cnNvclxuLy8gICAgIGFzIGluIERFQ1JDLiAgKFRoaXMgbWF5IGJlIGRpc2FibGVkIGJ5IHRoZSB0aXRlSW5oaWJpdFxuLy8gICAgIHJlc291cmNlKS4gIFRoaXMgY29tYmluZXMgdGhlIGVmZmVjdHMgb2YgdGhlIDEgMCA0IDcgIGFuZCAxIDBcbi8vICAgICA0IDggIG1vZGVzLiAgVXNlIHRoaXMgd2l0aCB0ZXJtaW5mby1iYXNlZCBhcHBsaWNhdGlvbnMgcmF0aGVyXG4vLyAgICAgdGhhbiB0aGUgNCA3ICBtb2RlLlxuLy8gICAgIFBzID0gMSAwIDUgMCAgLT4gUmVzZXQgdGVybWluZm8vdGVybWNhcCBmdW5jdGlvbi1rZXkgbW9kZS5cbi8vICAgICBQcyA9IDEgMCA1IDEgIC0+IFJlc2V0IFN1biBmdW5jdGlvbi1rZXkgbW9kZS5cbi8vICAgICBQcyA9IDEgMCA1IDIgIC0+IFJlc2V0IEhQIGZ1bmN0aW9uLWtleSBtb2RlLlxuLy8gICAgIFBzID0gMSAwIDUgMyAgLT4gUmVzZXQgU0NPIGZ1bmN0aW9uLWtleSBtb2RlLlxuLy8gICAgIFBzID0gMSAwIDYgMCAgLT4gUmVzZXQgbGVnYWN5IGtleWJvYXJkIGVtdWxhdGlvbiAoWDExUjYpLlxuLy8gICAgIFBzID0gMSAwIDYgMSAgLT4gUmVzZXQga2V5Ym9hcmQgZW11bGF0aW9uIHRvIFN1bi9QQyBzdHlsZS5cbi8vICAgICBQcyA9IDIgMCAwIDQgIC0+IFJlc2V0IGJyYWNrZXRlZCBwYXN0ZSBtb2RlLlxuVGVybWluYWwucHJvdG90eXBlLnJlc2V0TW9kZSA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICBpZiAodHlwZW9mIHBhcmFtcyA9PT0gJ29iamVjdCcpIHtcbiAgICB2YXIgbCA9IHBhcmFtcy5sZW5ndGhcbiAgICAgICwgaSA9IDA7XG5cbiAgICBmb3IgKDsgaSA8IGw7IGkrKykge1xuICAgICAgdGhpcy5yZXNldE1vZGUocGFyYW1zW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAoIXRoaXMucHJlZml4KSB7XG4gICAgc3dpdGNoIChwYXJhbXMpIHtcbiAgICAgIGNhc2UgNDpcbiAgICAgICAgdGhpcy5pbnNlcnRNb2RlID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyMDpcbiAgICAgICAgLy90aGlzLmNvbnZlcnRFb2wgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9IGVsc2UgaWYgKHRoaXMucHJlZml4ID09PSAnPycpIHtcbiAgICBzd2l0Y2ggKHBhcmFtcykge1xuICAgICAgY2FzZSAxOlxuICAgICAgICB0aGlzLmFwcGxpY2F0aW9uQ3Vyc29yID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBpZiAodGhpcy5jb2xzID09PSAxMzIgJiYgdGhpcy5zYXZlZENvbHMpIHtcbiAgICAgICAgICB0aGlzLnJlc2l6ZSh0aGlzLnNhdmVkQ29scywgdGhpcy5yb3dzKTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgdGhpcy5zYXZlZENvbHM7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSA2OlxuICAgICAgICB0aGlzLm9yaWdpbk1vZGUgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDc6XG4gICAgICAgIHRoaXMud3JhcGFyb3VuZE1vZGUgPSBmYWxzZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDEyOlxuICAgICAgICAvLyB0aGlzLmN1cnNvckJsaW5rID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSA5OiAvLyBYMTAgTW91c2VcbiAgICAgIGNhc2UgMTAwMDogLy8gdnQyMDAgbW91c2VcbiAgICAgIGNhc2UgMTAwMjogLy8gYnV0dG9uIGV2ZW50IG1vdXNlXG4gICAgICBjYXNlIDEwMDM6IC8vIGFueSBldmVudCBtb3VzZVxuICAgICAgICB0aGlzLngxME1vdXNlID0gZmFsc2U7XG4gICAgICAgIHRoaXMudnQyMDBNb3VzZSA9IGZhbHNlO1xuICAgICAgICB0aGlzLm5vcm1hbE1vdXNlID0gZmFsc2U7XG4gICAgICAgIHRoaXMubW91c2VFdmVudHMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5lbGVtZW50LnN0eWxlLmN1cnNvciA9ICcnO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTAwNDogLy8gc2VuZCBmb2N1c2luL2ZvY3Vzb3V0IGV2ZW50c1xuICAgICAgICB0aGlzLnNlbmRGb2N1cyA9IGZhbHNlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTAwNTogLy8gdXRmOCBleHQgbW9kZSBtb3VzZVxuICAgICAgICB0aGlzLnV0Zk1vdXNlID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAxMDA2OiAvLyBzZ3IgZXh0IG1vZGUgbW91c2VcbiAgICAgICAgdGhpcy5zZ3JNb3VzZSA9IGZhbHNlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTAxNTogLy8gdXJ4dnQgZXh0IG1vZGUgbW91c2VcbiAgICAgICAgdGhpcy51cnh2dE1vdXNlID0gZmFsc2U7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyNTogLy8gaGlkZSBjdXJzb3JcbiAgICAgICAgdGhpcy5jdXJzb3JIaWRkZW4gPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMTA0OTogLy8gYWx0IHNjcmVlbiBidWZmZXIgY3Vyc29yXG4gICAgICAgIDsgLy8gRkFMTC1USFJPVUdIXG4gICAgICBjYXNlIDQ3OiAvLyBub3JtYWwgc2NyZWVuIGJ1ZmZlclxuICAgICAgY2FzZSAxMDQ3OiAvLyBub3JtYWwgc2NyZWVuIGJ1ZmZlciAtIGNsZWFyaW5nIGl0IGZpcnN0XG4gICAgICAgIGlmICh0aGlzLm5vcm1hbCkge1xuICAgICAgICAgIHRoaXMubGluZXMgPSB0aGlzLm5vcm1hbC5saW5lcztcbiAgICAgICAgICB0aGlzLnliYXNlID0gdGhpcy5ub3JtYWwueWJhc2U7XG4gICAgICAgICAgdGhpcy55ZGlzcCA9IHRoaXMubm9ybWFsLnlkaXNwO1xuICAgICAgICAgIHRoaXMueCA9IHRoaXMubm9ybWFsLng7XG4gICAgICAgICAgdGhpcy55ID0gdGhpcy5ub3JtYWwueTtcbiAgICAgICAgICB0aGlzLnNjcm9sbFRvcCA9IHRoaXMubm9ybWFsLnNjcm9sbFRvcDtcbiAgICAgICAgICB0aGlzLnNjcm9sbEJvdHRvbSA9IHRoaXMubm9ybWFsLnNjcm9sbEJvdHRvbTtcbiAgICAgICAgICB0aGlzLnRhYnMgPSB0aGlzLm5vcm1hbC50YWJzO1xuICAgICAgICAgIHRoaXMubm9ybWFsID0gbnVsbDtcbiAgICAgICAgICAvLyBpZiAocGFyYW1zID09PSAxMDQ5KSB7XG4gICAgICAgICAgLy8gICB0aGlzLnggPSB0aGlzLnNhdmVkWDtcbiAgICAgICAgICAvLyAgIHRoaXMueSA9IHRoaXMuc2F2ZWRZO1xuICAgICAgICAgIC8vIH1cbiAgICAgICAgICB0aGlzLnJlZnJlc2goMCwgdGhpcy5yb3dzIC0gMSk7XG4gICAgICAgICAgdGhpcy5zaG93Q3Vyc29yKCk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59O1xuXG4vLyBDU0kgUHMgOyBQcyByXG4vLyAgIFNldCBTY3JvbGxpbmcgUmVnaW9uIFt0b3A7Ym90dG9tXSAoZGVmYXVsdCA9IGZ1bGwgc2l6ZSBvZiB3aW4tXG4vLyAgIGRvdykgKERFQ1NUQk0pLlxuLy8gQ1NJID8gUG0gclxuVGVybWluYWwucHJvdG90eXBlLnNldFNjcm9sbFJlZ2lvbiA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICBpZiAodGhpcy5wcmVmaXgpIHJldHVybjtcbiAgdGhpcy5zY3JvbGxUb3AgPSAocGFyYW1zWzBdIHx8IDEpIC0gMTtcbiAgdGhpcy5zY3JvbGxCb3R0b20gPSAocGFyYW1zWzFdIHx8IHRoaXMucm93cykgLSAxO1xuICB0aGlzLnggPSAwO1xuICB0aGlzLnkgPSAwO1xufTtcblxuLy8gQ1NJIHNcbi8vICAgU2F2ZSBjdXJzb3IgKEFOU0kuU1lTKS5cblRlcm1pbmFsLnByb3RvdHlwZS5zYXZlQ3Vyc29yID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHRoaXMuc2F2ZWRYID0gdGhpcy54O1xuICB0aGlzLnNhdmVkWSA9IHRoaXMueTtcbn07XG5cbi8vIENTSSB1XG4vLyAgIFJlc3RvcmUgY3Vyc29yIChBTlNJLlNZUykuXG5UZXJtaW5hbC5wcm90b3R5cGUucmVzdG9yZUN1cnNvciA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB0aGlzLnggPSB0aGlzLnNhdmVkWCB8fCAwO1xuICB0aGlzLnkgPSB0aGlzLnNhdmVkWSB8fCAwO1xufTtcblxuLyoqXG4gKiBMZXNzZXIgVXNlZFxuICovXG5cbi8vIENTSSBQcyBJXG4vLyAgIEN1cnNvciBGb3J3YXJkIFRhYnVsYXRpb24gUHMgdGFiIHN0b3BzIChkZWZhdWx0ID0gMSkgKENIVCkuXG5UZXJtaW5hbC5wcm90b3R5cGUuY3Vyc29yRm9yd2FyZFRhYiA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgcGFyYW0gPSBwYXJhbXNbMF0gfHwgMTtcbiAgd2hpbGUgKHBhcmFtLS0pIHtcbiAgICB0aGlzLnggPSB0aGlzLm5leHRTdG9wKCk7XG4gIH1cbn07XG5cbi8vIENTSSBQcyBTICBTY3JvbGwgdXAgUHMgbGluZXMgKGRlZmF1bHQgPSAxKSAoU1UpLlxuVGVybWluYWwucHJvdG90eXBlLnNjcm9sbFVwID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXSB8fCAxO1xuICB3aGlsZSAocGFyYW0tLSkge1xuICAgIHRoaXMubGluZXMuc3BsaWNlKHRoaXMueWJhc2UgKyB0aGlzLnNjcm9sbFRvcCwgMSk7XG4gICAgdGhpcy5saW5lcy5zcGxpY2UodGhpcy55YmFzZSArIHRoaXMuc2Nyb2xsQm90dG9tLCAwLCB0aGlzLmJsYW5rTGluZSgpKTtcbiAgfVxuICAvLyB0aGlzLm1heFJhbmdlKCk7XG4gIHRoaXMudXBkYXRlUmFuZ2UodGhpcy5zY3JvbGxUb3ApO1xuICB0aGlzLnVwZGF0ZVJhbmdlKHRoaXMuc2Nyb2xsQm90dG9tKTtcbn07XG5cbi8vIENTSSBQcyBUICBTY3JvbGwgZG93biBQcyBsaW5lcyAoZGVmYXVsdCA9IDEpIChTRCkuXG5UZXJtaW5hbC5wcm90b3R5cGUuc2Nyb2xsRG93biA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgcGFyYW0gPSBwYXJhbXNbMF0gfHwgMTtcbiAgd2hpbGUgKHBhcmFtLS0pIHtcbiAgICB0aGlzLmxpbmVzLnNwbGljZSh0aGlzLnliYXNlICsgdGhpcy5zY3JvbGxCb3R0b20sIDEpO1xuICAgIHRoaXMubGluZXMuc3BsaWNlKHRoaXMueWJhc2UgKyB0aGlzLnNjcm9sbFRvcCwgMCwgdGhpcy5ibGFua0xpbmUoKSk7XG4gIH1cbiAgLy8gdGhpcy5tYXhSYW5nZSgpO1xuICB0aGlzLnVwZGF0ZVJhbmdlKHRoaXMuc2Nyb2xsVG9wKTtcbiAgdGhpcy51cGRhdGVSYW5nZSh0aGlzLnNjcm9sbEJvdHRvbSk7XG59O1xuXG4vLyBDU0kgUHMgOyBQcyA7IFBzIDsgUHMgOyBQcyBUXG4vLyAgIEluaXRpYXRlIGhpZ2hsaWdodCBtb3VzZSB0cmFja2luZy4gIFBhcmFtZXRlcnMgYXJlXG4vLyAgIFtmdW5jO3N0YXJ0eDtzdGFydHk7Zmlyc3Ryb3c7bGFzdHJvd10uICBTZWUgdGhlIHNlY3Rpb24gTW91c2Vcbi8vICAgVHJhY2tpbmcuXG5UZXJtaW5hbC5wcm90b3R5cGUuaW5pdE1vdXNlVHJhY2tpbmcgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgLy8gUmVsZXZhbnQ6IERFQ1NFVCAxMDAxXG59O1xuXG4vLyBDU0kgPiBQczsgUHMgVFxuLy8gICBSZXNldCBvbmUgb3IgbW9yZSBmZWF0dXJlcyBvZiB0aGUgdGl0bGUgbW9kZXMgdG8gdGhlIGRlZmF1bHRcbi8vICAgdmFsdWUuICBOb3JtYWxseSwgXCJyZXNldFwiIGRpc2FibGVzIHRoZSBmZWF0dXJlLiAgSXQgaXMgcG9zc2ktXG4vLyAgIGJsZSB0byBkaXNhYmxlIHRoZSBhYmlsaXR5IHRvIHJlc2V0IGZlYXR1cmVzIGJ5IGNvbXBpbGluZyBhXG4vLyAgIGRpZmZlcmVudCBkZWZhdWx0IGZvciB0aGUgdGl0bGUgbW9kZXMgaW50byB4dGVybS5cbi8vICAgICBQcyA9IDAgIC0+IERvIG5vdCBzZXQgd2luZG93L2ljb24gbGFiZWxzIHVzaW5nIGhleGFkZWNpbWFsLlxuLy8gICAgIFBzID0gMSAgLT4gRG8gbm90IHF1ZXJ5IHdpbmRvdy9pY29uIGxhYmVscyB1c2luZyBoZXhhZGVjaS1cbi8vICAgICBtYWwuXG4vLyAgICAgUHMgPSAyICAtPiBEbyBub3Qgc2V0IHdpbmRvdy9pY29uIGxhYmVscyB1c2luZyBVVEYtOC5cbi8vICAgICBQcyA9IDMgIC0+IERvIG5vdCBxdWVyeSB3aW5kb3cvaWNvbiBsYWJlbHMgdXNpbmcgVVRGLTguXG4vLyAgIChTZWUgZGlzY3Vzc2lvbiBvZiBcIlRpdGxlIE1vZGVzXCIpLlxuVGVybWluYWwucHJvdG90eXBlLnJlc2V0VGl0bGVNb2RlcyA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICA7XG59O1xuXG4vLyBDU0kgUHMgWiAgQ3Vyc29yIEJhY2t3YXJkIFRhYnVsYXRpb24gUHMgdGFiIHN0b3BzIChkZWZhdWx0ID0gMSkgKENCVCkuXG5UZXJtaW5hbC5wcm90b3R5cGUuY3Vyc29yQmFja3dhcmRUYWIgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgdmFyIHBhcmFtID0gcGFyYW1zWzBdIHx8IDE7XG4gIHdoaWxlIChwYXJhbS0tKSB7XG4gICAgdGhpcy54ID0gdGhpcy5wcmV2U3RvcCgpO1xuICB9XG59O1xuXG4vLyBDU0kgUHMgYiAgUmVwZWF0IHRoZSBwcmVjZWRpbmcgZ3JhcGhpYyBjaGFyYWN0ZXIgUHMgdGltZXMgKFJFUCkuXG5UZXJtaW5hbC5wcm90b3R5cGUucmVwZWF0UHJlY2VkaW5nQ2hhcmFjdGVyID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXSB8fCAxXG4gICAgLCBsaW5lID0gdGhpcy5saW5lc1t0aGlzLnliYXNlICsgdGhpcy55XVxuICAgICwgY2ggPSBsaW5lW3RoaXMueCAtIDFdIHx8IFt0aGlzLmRlZkF0dHIsICcgJ107XG5cbiAgd2hpbGUgKHBhcmFtLS0pIGxpbmVbdGhpcy54KytdID0gY2g7XG59O1xuXG4vLyBDU0kgUHMgZyAgVGFiIENsZWFyIChUQkMpLlxuLy8gICAgIFBzID0gMCAgLT4gQ2xlYXIgQ3VycmVudCBDb2x1bW4gKGRlZmF1bHQpLlxuLy8gICAgIFBzID0gMyAgLT4gQ2xlYXIgQWxsLlxuLy8gUG90ZW50aWFsbHk6XG4vLyAgIFBzID0gMiAgLT4gQ2xlYXIgU3RvcHMgb24gTGluZS5cbi8vICAgaHR0cDovL3Z0MTAwLm5ldC9hbm5hcmJvci9hYWEtdWcvc2VjdGlvbjYuaHRtbFxuVGVybWluYWwucHJvdG90eXBlLnRhYkNsZWFyID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciBwYXJhbSA9IHBhcmFtc1swXTtcbiAgaWYgKHBhcmFtIDw9IDApIHtcbiAgICBkZWxldGUgdGhpcy50YWJzW3RoaXMueF07XG4gIH0gZWxzZSBpZiAocGFyYW0gPT09IDMpIHtcbiAgICB0aGlzLnRhYnMgPSB7fTtcbiAgfVxufTtcblxuLy8gQ1NJIFBtIGkgIE1lZGlhIENvcHkgKE1DKS5cbi8vICAgICBQcyA9IDAgIC0+IFByaW50IHNjcmVlbiAoZGVmYXVsdCkuXG4vLyAgICAgUHMgPSA0ICAtPiBUdXJuIG9mZiBwcmludGVyIGNvbnRyb2xsZXIgbW9kZS5cbi8vICAgICBQcyA9IDUgIC0+IFR1cm4gb24gcHJpbnRlciBjb250cm9sbGVyIG1vZGUuXG4vLyBDU0kgPyBQbSBpXG4vLyAgIE1lZGlhIENvcHkgKE1DLCBERUMtc3BlY2lmaWMpLlxuLy8gICAgIFBzID0gMSAgLT4gUHJpbnQgbGluZSBjb250YWluaW5nIGN1cnNvci5cbi8vICAgICBQcyA9IDQgIC0+IFR1cm4gb2ZmIGF1dG9wcmludCBtb2RlLlxuLy8gICAgIFBzID0gNSAgLT4gVHVybiBvbiBhdXRvcHJpbnQgbW9kZS5cbi8vICAgICBQcyA9IDEgIDAgIC0+IFByaW50IGNvbXBvc2VkIGRpc3BsYXksIGlnbm9yZXMgREVDUEVYLlxuLy8gICAgIFBzID0gMSAgMSAgLT4gUHJpbnQgYWxsIHBhZ2VzLlxuVGVybWluYWwucHJvdG90eXBlLm1lZGlhQ29weSA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICA7XG59O1xuXG4vLyBDU0kgPiBQczsgUHMgbVxuLy8gICBTZXQgb3IgcmVzZXQgcmVzb3VyY2UtdmFsdWVzIHVzZWQgYnkgeHRlcm0gdG8gZGVjaWRlIHdoZXRoZXJcbi8vICAgdG8gY29uc3RydWN0IGVzY2FwZSBzZXF1ZW5jZXMgaG9sZGluZyBpbmZvcm1hdGlvbiBhYm91dCB0aGVcbi8vICAgbW9kaWZpZXJzIHByZXNzZWQgd2l0aCBhIGdpdmVuIGtleS4gIFRoZSBmaXJzdCBwYXJhbWV0ZXIgaWRlbi1cbi8vICAgdGlmaWVzIHRoZSByZXNvdXJjZSB0byBzZXQvcmVzZXQuICBUaGUgc2Vjb25kIHBhcmFtZXRlciBpcyB0aGVcbi8vICAgdmFsdWUgdG8gYXNzaWduIHRvIHRoZSByZXNvdXJjZS4gIElmIHRoZSBzZWNvbmQgcGFyYW1ldGVyIGlzXG4vLyAgIG9taXR0ZWQsIHRoZSByZXNvdXJjZSBpcyByZXNldCB0byBpdHMgaW5pdGlhbCB2YWx1ZS5cbi8vICAgICBQcyA9IDEgIC0+IG1vZGlmeUN1cnNvcktleXMuXG4vLyAgICAgUHMgPSAyICAtPiBtb2RpZnlGdW5jdGlvbktleXMuXG4vLyAgICAgUHMgPSA0ICAtPiBtb2RpZnlPdGhlcktleXMuXG4vLyAgIElmIG5vIHBhcmFtZXRlcnMgYXJlIGdpdmVuLCBhbGwgcmVzb3VyY2VzIGFyZSByZXNldCB0byB0aGVpclxuLy8gICBpbml0aWFsIHZhbHVlcy5cblRlcm1pbmFsLnByb3RvdHlwZS5zZXRSZXNvdXJjZXMgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgO1xufTtcblxuLy8gQ1NJID4gUHMgblxuLy8gICBEaXNhYmxlIG1vZGlmaWVycyB3aGljaCBtYXkgYmUgZW5hYmxlZCB2aWEgdGhlIENTSSA+IFBzOyBQcyBtXG4vLyAgIHNlcXVlbmNlLiAgVGhpcyBjb3JyZXNwb25kcyB0byBhIHJlc291cmNlIHZhbHVlIG9mIFwiLTFcIiwgd2hpY2hcbi8vICAgY2Fubm90IGJlIHNldCB3aXRoIHRoZSBvdGhlciBzZXF1ZW5jZS4gIFRoZSBwYXJhbWV0ZXIgaWRlbnRpLVxuLy8gICBmaWVzIHRoZSByZXNvdXJjZSB0byBiZSBkaXNhYmxlZDpcbi8vICAgICBQcyA9IDEgIC0+IG1vZGlmeUN1cnNvcktleXMuXG4vLyAgICAgUHMgPSAyICAtPiBtb2RpZnlGdW5jdGlvbktleXMuXG4vLyAgICAgUHMgPSA0ICAtPiBtb2RpZnlPdGhlcktleXMuXG4vLyAgIElmIHRoZSBwYXJhbWV0ZXIgaXMgb21pdHRlZCwgbW9kaWZ5RnVuY3Rpb25LZXlzIGlzIGRpc2FibGVkLlxuLy8gICBXaGVuIG1vZGlmeUZ1bmN0aW9uS2V5cyBpcyBkaXNhYmxlZCwgeHRlcm0gdXNlcyB0aGUgbW9kaWZpZXJcbi8vICAga2V5cyB0byBtYWtlIGFuIGV4dGVuZGVkIHNlcXVlbmNlIG9mIGZ1bmN0aW9ucyByYXRoZXIgdGhhblxuLy8gICBhZGRpbmcgYSBwYXJhbWV0ZXIgdG8gZWFjaCBmdW5jdGlvbiBrZXkgdG8gZGVub3RlIHRoZSBtb2RpLVxuLy8gICBmaWVycy5cblRlcm1pbmFsLnByb3RvdHlwZS5kaXNhYmxlTW9kaWZpZXJzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSA+IFBzIHBcbi8vICAgU2V0IHJlc291cmNlIHZhbHVlIHBvaW50ZXJNb2RlLiAgVGhpcyBpcyB1c2VkIGJ5IHh0ZXJtIHRvXG4vLyAgIGRlY2lkZSB3aGV0aGVyIHRvIGhpZGUgdGhlIHBvaW50ZXIgY3Vyc29yIGFzIHRoZSB1c2VyIHR5cGVzLlxuLy8gICBWYWxpZCB2YWx1ZXMgZm9yIHRoZSBwYXJhbWV0ZXI6XG4vLyAgICAgUHMgPSAwICAtPiBuZXZlciBoaWRlIHRoZSBwb2ludGVyLlxuLy8gICAgIFBzID0gMSAgLT4gaGlkZSBpZiB0aGUgbW91c2UgdHJhY2tpbmcgbW9kZSBpcyBub3QgZW5hYmxlZC5cbi8vICAgICBQcyA9IDIgIC0+IGFsd2F5cyBoaWRlIHRoZSBwb2ludGVyLiAgSWYgbm8gcGFyYW1ldGVyIGlzXG4vLyAgICAgZ2l2ZW4sIHh0ZXJtIHVzZXMgdGhlIGRlZmF1bHQsIHdoaWNoIGlzIDEgLlxuVGVybWluYWwucHJvdG90eXBlLnNldFBvaW50ZXJNb2RlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSAhIHAgICBTb2Z0IHRlcm1pbmFsIHJlc2V0IChERUNTVFIpLlxuLy8gaHR0cDovL3Z0MTAwLm5ldC9kb2NzL3Z0MjIwLXJtL3RhYmxlNC0xMC5odG1sXG5UZXJtaW5hbC5wcm90b3R5cGUuc29mdFJlc2V0ID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHRoaXMuY3Vyc29ySGlkZGVuID0gZmFsc2U7XG4gIHRoaXMuaW5zZXJ0TW9kZSA9IGZhbHNlO1xuICB0aGlzLm9yaWdpbk1vZGUgPSBmYWxzZTtcbiAgdGhpcy53cmFwYXJvdW5kTW9kZSA9IGZhbHNlOyAvLyBhdXRvd3JhcFxuICB0aGlzLmFwcGxpY2F0aW9uS2V5cGFkID0gZmFsc2U7IC8vID9cbiAgdGhpcy5hcHBsaWNhdGlvbkN1cnNvciA9IGZhbHNlO1xuICB0aGlzLnNjcm9sbFRvcCA9IDA7XG4gIHRoaXMuc2Nyb2xsQm90dG9tID0gdGhpcy5yb3dzIC0gMTtcbiAgdGhpcy5jdXJBdHRyID0gdGhpcy5kZWZBdHRyO1xuICB0aGlzLnggPSB0aGlzLnkgPSAwOyAvLyA/XG4gIHRoaXMuY2hhcnNldCA9IG51bGw7XG4gIHRoaXMuZ2xldmVsID0gMDsgLy8gPz9cbiAgdGhpcy5jaGFyc2V0cyA9IFtudWxsXTsgLy8gPz9cbn07XG5cbi8vIENTSSBQcyQgcFxuLy8gICBSZXF1ZXN0IEFOU0kgbW9kZSAoREVDUlFNKS4gIEZvciBWVDMwMCBhbmQgdXAsIHJlcGx5IGlzXG4vLyAgICAgQ1NJIFBzOyBQbSQgeVxuLy8gICB3aGVyZSBQcyBpcyB0aGUgbW9kZSBudW1iZXIgYXMgaW4gUk0sIGFuZCBQbSBpcyB0aGUgbW9kZVxuLy8gICB2YWx1ZTpcbi8vICAgICAwIC0gbm90IHJlY29nbml6ZWRcbi8vICAgICAxIC0gc2V0XG4vLyAgICAgMiAtIHJlc2V0XG4vLyAgICAgMyAtIHBlcm1hbmVudGx5IHNldFxuLy8gICAgIDQgLSBwZXJtYW5lbnRseSByZXNldFxuVGVybWluYWwucHJvdG90eXBlLnJlcXVlc3RBbnNpTW9kZSA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICA7XG59O1xuXG4vLyBDU0kgPyBQcyQgcFxuLy8gICBSZXF1ZXN0IERFQyBwcml2YXRlIG1vZGUgKERFQ1JRTSkuICBGb3IgVlQzMDAgYW5kIHVwLCByZXBseSBpc1xuLy8gICAgIENTSSA/IFBzOyBQbSQgcFxuLy8gICB3aGVyZSBQcyBpcyB0aGUgbW9kZSBudW1iZXIgYXMgaW4gREVDU0VULCBQbSBpcyB0aGUgbW9kZSB2YWx1ZVxuLy8gICBhcyBpbiB0aGUgQU5TSSBERUNSUU0uXG5UZXJtaW5hbC5wcm90b3R5cGUucmVxdWVzdFByaXZhdGVNb2RlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQcyA7IFBzIFwiIHBcbi8vICAgU2V0IGNvbmZvcm1hbmNlIGxldmVsIChERUNTQ0wpLiAgVmFsaWQgdmFsdWVzIGZvciB0aGUgZmlyc3Rcbi8vICAgcGFyYW1ldGVyOlxuLy8gICAgIFBzID0gNiAxICAtPiBWVDEwMC5cbi8vICAgICBQcyA9IDYgMiAgLT4gVlQyMDAuXG4vLyAgICAgUHMgPSA2IDMgIC0+IFZUMzAwLlxuLy8gICBWYWxpZCB2YWx1ZXMgZm9yIHRoZSBzZWNvbmQgcGFyYW1ldGVyOlxuLy8gICAgIFBzID0gMCAgLT4gOC1iaXQgY29udHJvbHMuXG4vLyAgICAgUHMgPSAxICAtPiA3LWJpdCBjb250cm9scyAoYWx3YXlzIHNldCBmb3IgVlQxMDApLlxuLy8gICAgIFBzID0gMiAgLT4gOC1iaXQgY29udHJvbHMuXG5UZXJtaW5hbC5wcm90b3R5cGUuc2V0Q29uZm9ybWFuY2VMZXZlbCA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICA7XG59O1xuXG4vLyBDU0kgUHMgcSAgTG9hZCBMRURzIChERUNMTCkuXG4vLyAgICAgUHMgPSAwICAtPiBDbGVhciBhbGwgTEVEUyAoZGVmYXVsdCkuXG4vLyAgICAgUHMgPSAxICAtPiBMaWdodCBOdW0gTG9jay5cbi8vICAgICBQcyA9IDIgIC0+IExpZ2h0IENhcHMgTG9jay5cbi8vICAgICBQcyA9IDMgIC0+IExpZ2h0IFNjcm9sbCBMb2NrLlxuLy8gICAgIFBzID0gMiAgMSAgLT4gRXh0aW5ndWlzaCBOdW0gTG9jay5cbi8vICAgICBQcyA9IDIgIDIgIC0+IEV4dGluZ3Vpc2ggQ2FwcyBMb2NrLlxuLy8gICAgIFBzID0gMiAgMyAgLT4gRXh0aW5ndWlzaCBTY3JvbGwgTG9jay5cblRlcm1pbmFsLnByb3RvdHlwZS5sb2FkTEVEcyA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICA7XG59O1xuXG4vLyBDU0kgUHMgU1AgcVxuLy8gICBTZXQgY3Vyc29yIHN0eWxlIChERUNTQ1VTUiwgVlQ1MjApLlxuLy8gICAgIFBzID0gMCAgLT4gYmxpbmtpbmcgYmxvY2suXG4vLyAgICAgUHMgPSAxICAtPiBibGlua2luZyBibG9jayAoZGVmYXVsdCkuXG4vLyAgICAgUHMgPSAyICAtPiBzdGVhZHkgYmxvY2suXG4vLyAgICAgUHMgPSAzICAtPiBibGlua2luZyB1bmRlcmxpbmUuXG4vLyAgICAgUHMgPSA0ICAtPiBzdGVhZHkgdW5kZXJsaW5lLlxuVGVybWluYWwucHJvdG90eXBlLnNldEN1cnNvclN0eWxlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQcyBcIiBxXG4vLyAgIFNlbGVjdCBjaGFyYWN0ZXIgcHJvdGVjdGlvbiBhdHRyaWJ1dGUgKERFQ1NDQSkuICBWYWxpZCB2YWx1ZXNcbi8vICAgZm9yIHRoZSBwYXJhbWV0ZXI6XG4vLyAgICAgUHMgPSAwICAtPiBERUNTRUQgYW5kIERFQ1NFTCBjYW4gZXJhc2UgKGRlZmF1bHQpLlxuLy8gICAgIFBzID0gMSAgLT4gREVDU0VEIGFuZCBERUNTRUwgY2Fubm90IGVyYXNlLlxuLy8gICAgIFBzID0gMiAgLT4gREVDU0VEIGFuZCBERUNTRUwgY2FuIGVyYXNlLlxuVGVybWluYWwucHJvdG90eXBlLnNldENoYXJQcm90ZWN0aW9uQXR0ciA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICA7XG59O1xuXG4vLyBDU0kgPyBQbSByXG4vLyAgIFJlc3RvcmUgREVDIFByaXZhdGUgTW9kZSBWYWx1ZXMuICBUaGUgdmFsdWUgb2YgUHMgcHJldmlvdXNseVxuLy8gICBzYXZlZCBpcyByZXN0b3JlZC4gIFBzIHZhbHVlcyBhcmUgdGhlIHNhbWUgYXMgZm9yIERFQ1NFVC5cblRlcm1pbmFsLnByb3RvdHlwZS5yZXN0b3JlUHJpdmF0ZVZhbHVlcyA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICA7XG59O1xuXG4vLyBDU0kgUHQ7IFBsOyBQYjsgUHI7IFBzJCByXG4vLyAgIENoYW5nZSBBdHRyaWJ1dGVzIGluIFJlY3Rhbmd1bGFyIEFyZWEgKERFQ0NBUkEpLCBWVDQwMCBhbmQgdXAuXG4vLyAgICAgUHQ7IFBsOyBQYjsgUHIgZGVub3RlcyB0aGUgcmVjdGFuZ2xlLlxuLy8gICAgIFBzIGRlbm90ZXMgdGhlIFNHUiBhdHRyaWJ1dGVzIHRvIGNoYW5nZTogMCwgMSwgNCwgNSwgNy5cbi8vIE5PVEU6IHh0ZXJtIGRvZXNuJ3QgZW5hYmxlIHRoaXMgY29kZSBieSBkZWZhdWx0LlxuVGVybWluYWwucHJvdG90eXBlLnNldEF0dHJJblJlY3RhbmdsZSA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgdCA9IHBhcmFtc1swXVxuICAgICwgbCA9IHBhcmFtc1sxXVxuICAgICwgYiA9IHBhcmFtc1syXVxuICAgICwgciA9IHBhcmFtc1szXVxuICAgICwgYXR0ciA9IHBhcmFtc1s0XTtcblxuICB2YXIgbGluZVxuICAgICwgaTtcblxuICBmb3IgKDsgdCA8IGIgKyAxOyB0KyspIHtcbiAgICBsaW5lID0gdGhpcy5saW5lc1t0aGlzLnliYXNlICsgdF07XG4gICAgZm9yIChpID0gbDsgaSA8IHI7IGkrKykge1xuICAgICAgbGluZVtpXSA9IFthdHRyLCBsaW5lW2ldWzFdXTtcbiAgICB9XG4gIH1cblxuICAvLyB0aGlzLm1heFJhbmdlKCk7XG4gIHRoaXMudXBkYXRlUmFuZ2UocGFyYW1zWzBdKTtcbiAgdGhpcy51cGRhdGVSYW5nZShwYXJhbXNbMl0pO1xufTtcblxuLy8gQ1NJID8gUG0gc1xuLy8gICBTYXZlIERFQyBQcml2YXRlIE1vZGUgVmFsdWVzLiAgUHMgdmFsdWVzIGFyZSB0aGUgc2FtZSBhcyBmb3Jcbi8vICAgREVDU0VULlxuVGVybWluYWwucHJvdG90eXBlLnNhdmVQcml2YXRlVmFsdWVzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQcyA7IFBzIDsgUHMgdFxuLy8gICBXaW5kb3cgbWFuaXB1bGF0aW9uIChmcm9tIGR0dGVybSwgYXMgd2VsbCBhcyBleHRlbnNpb25zKS5cbi8vICAgVGhlc2UgY29udHJvbHMgbWF5IGJlIGRpc2FibGVkIHVzaW5nIHRoZSBhbGxvd1dpbmRvd09wc1xuLy8gICByZXNvdXJjZS4gIFZhbGlkIHZhbHVlcyBmb3IgdGhlIGZpcnN0IChhbmQgYW55IGFkZGl0aW9uYWxcbi8vICAgcGFyYW1ldGVycykgYXJlOlxuLy8gICAgIFBzID0gMSAgLT4gRGUtaWNvbmlmeSB3aW5kb3cuXG4vLyAgICAgUHMgPSAyICAtPiBJY29uaWZ5IHdpbmRvdy5cbi8vICAgICBQcyA9IDMgIDsgIHggOyAgeSAtPiBNb3ZlIHdpbmRvdyB0byBbeCwgeV0uXG4vLyAgICAgUHMgPSA0ICA7ICBoZWlnaHQgOyAgd2lkdGggLT4gUmVzaXplIHRoZSB4dGVybSB3aW5kb3cgdG9cbi8vICAgICBoZWlnaHQgYW5kIHdpZHRoIGluIHBpeGVscy5cbi8vICAgICBQcyA9IDUgIC0+IFJhaXNlIHRoZSB4dGVybSB3aW5kb3cgdG8gdGhlIGZyb250IG9mIHRoZSBzdGFjay1cbi8vICAgICBpbmcgb3JkZXIuXG4vLyAgICAgUHMgPSA2ICAtPiBMb3dlciB0aGUgeHRlcm0gd2luZG93IHRvIHRoZSBib3R0b20gb2YgdGhlXG4vLyAgICAgc3RhY2tpbmcgb3JkZXIuXG4vLyAgICAgUHMgPSA3ICAtPiBSZWZyZXNoIHRoZSB4dGVybSB3aW5kb3cuXG4vLyAgICAgUHMgPSA4ICA7ICBoZWlnaHQgOyAgd2lkdGggLT4gUmVzaXplIHRoZSB0ZXh0IGFyZWEgdG9cbi8vICAgICBbaGVpZ2h0O3dpZHRoXSBpbiBjaGFyYWN0ZXJzLlxuLy8gICAgIFBzID0gOSAgOyAgMCAgLT4gUmVzdG9yZSBtYXhpbWl6ZWQgd2luZG93LlxuLy8gICAgIFBzID0gOSAgOyAgMSAgLT4gTWF4aW1pemUgd2luZG93IChpLmUuLCByZXNpemUgdG8gc2NyZWVuXG4vLyAgICAgc2l6ZSkuXG4vLyAgICAgUHMgPSAxIDAgIDsgIDAgIC0+IFVuZG8gZnVsbC1zY3JlZW4gbW9kZS5cbi8vICAgICBQcyA9IDEgMCAgOyAgMSAgLT4gQ2hhbmdlIHRvIGZ1bGwtc2NyZWVuLlxuLy8gICAgIFBzID0gMSAxICAtPiBSZXBvcnQgeHRlcm0gd2luZG93IHN0YXRlLiAgSWYgdGhlIHh0ZXJtIHdpbmRvd1xuLy8gICAgIGlzIG9wZW4gKG5vbi1pY29uaWZpZWQpLCBpdCByZXR1cm5zIENTSSAxIHQgLiAgSWYgdGhlIHh0ZXJtXG4vLyAgICAgd2luZG93IGlzIGljb25pZmllZCwgaXQgcmV0dXJucyBDU0kgMiB0IC5cbi8vICAgICBQcyA9IDEgMyAgLT4gUmVwb3J0IHh0ZXJtIHdpbmRvdyBwb3NpdGlvbi4gIFJlc3VsdCBpcyBDU0kgM1xuLy8gICAgIDsgeCA7IHkgdFxuLy8gICAgIFBzID0gMSA0ICAtPiBSZXBvcnQgeHRlcm0gd2luZG93IGluIHBpeGVscy4gIFJlc3VsdCBpcyBDU0lcbi8vICAgICA0ICA7ICBoZWlnaHQgOyAgd2lkdGggdFxuLy8gICAgIFBzID0gMSA4ICAtPiBSZXBvcnQgdGhlIHNpemUgb2YgdGhlIHRleHQgYXJlYSBpbiBjaGFyYWN0ZXJzLlxuLy8gICAgIFJlc3VsdCBpcyBDU0kgIDggIDsgIGhlaWdodCA7ICB3aWR0aCB0XG4vLyAgICAgUHMgPSAxIDkgIC0+IFJlcG9ydCB0aGUgc2l6ZSBvZiB0aGUgc2NyZWVuIGluIGNoYXJhY3RlcnMuXG4vLyAgICAgUmVzdWx0IGlzIENTSSAgOSAgOyAgaGVpZ2h0IDsgIHdpZHRoIHRcbi8vICAgICBQcyA9IDIgMCAgLT4gUmVwb3J0IHh0ZXJtIHdpbmRvdydzIGljb24gbGFiZWwuICBSZXN1bHQgaXNcbi8vICAgICBPU0MgIEwgIGxhYmVsIFNUXG4vLyAgICAgUHMgPSAyIDEgIC0+IFJlcG9ydCB4dGVybSB3aW5kb3cncyB0aXRsZS4gIFJlc3VsdCBpcyBPU0MgIGxcbi8vICAgICBsYWJlbCBTVFxuLy8gICAgIFBzID0gMiAyICA7ICAwICAtPiBTYXZlIHh0ZXJtIGljb24gYW5kIHdpbmRvdyB0aXRsZSBvblxuLy8gICAgIHN0YWNrLlxuLy8gICAgIFBzID0gMiAyICA7ICAxICAtPiBTYXZlIHh0ZXJtIGljb24gdGl0bGUgb24gc3RhY2suXG4vLyAgICAgUHMgPSAyIDIgIDsgIDIgIC0+IFNhdmUgeHRlcm0gd2luZG93IHRpdGxlIG9uIHN0YWNrLlxuLy8gICAgIFBzID0gMiAzICA7ICAwICAtPiBSZXN0b3JlIHh0ZXJtIGljb24gYW5kIHdpbmRvdyB0aXRsZSBmcm9tXG4vLyAgICAgc3RhY2suXG4vLyAgICAgUHMgPSAyIDMgIDsgIDEgIC0+IFJlc3RvcmUgeHRlcm0gaWNvbiB0aXRsZSBmcm9tIHN0YWNrLlxuLy8gICAgIFBzID0gMiAzICA7ICAyICAtPiBSZXN0b3JlIHh0ZXJtIHdpbmRvdyB0aXRsZSBmcm9tIHN0YWNrLlxuLy8gICAgIFBzID49IDIgNCAgLT4gUmVzaXplIHRvIFBzIGxpbmVzIChERUNTTFBQKS5cblRlcm1pbmFsLnByb3RvdHlwZS5tYW5pcHVsYXRlV2luZG93ID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQdDsgUGw7IFBiOyBQcjsgUHMkIHRcbi8vICAgUmV2ZXJzZSBBdHRyaWJ1dGVzIGluIFJlY3Rhbmd1bGFyIEFyZWEgKERFQ1JBUkEpLCBWVDQwMCBhbmRcbi8vICAgdXAuXG4vLyAgICAgUHQ7IFBsOyBQYjsgUHIgZGVub3RlcyB0aGUgcmVjdGFuZ2xlLlxuLy8gICAgIFBzIGRlbm90ZXMgdGhlIGF0dHJpYnV0ZXMgdG8gcmV2ZXJzZSwgaS5lLiwgIDEsIDQsIDUsIDcuXG4vLyBOT1RFOiB4dGVybSBkb2Vzbid0IGVuYWJsZSB0aGlzIGNvZGUgYnkgZGVmYXVsdC5cblRlcm1pbmFsLnByb3RvdHlwZS5yZXZlcnNlQXR0ckluUmVjdGFuZ2xlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSA+IFBzOyBQcyB0XG4vLyAgIFNldCBvbmUgb3IgbW9yZSBmZWF0dXJlcyBvZiB0aGUgdGl0bGUgbW9kZXMuICBFYWNoIHBhcmFtZXRlclxuLy8gICBlbmFibGVzIGEgc2luZ2xlIGZlYXR1cmUuXG4vLyAgICAgUHMgPSAwICAtPiBTZXQgd2luZG93L2ljb24gbGFiZWxzIHVzaW5nIGhleGFkZWNpbWFsLlxuLy8gICAgIFBzID0gMSAgLT4gUXVlcnkgd2luZG93L2ljb24gbGFiZWxzIHVzaW5nIGhleGFkZWNpbWFsLlxuLy8gICAgIFBzID0gMiAgLT4gU2V0IHdpbmRvdy9pY29uIGxhYmVscyB1c2luZyBVVEYtOC5cbi8vICAgICBQcyA9IDMgIC0+IFF1ZXJ5IHdpbmRvdy9pY29uIGxhYmVscyB1c2luZyBVVEYtOC4gIChTZWUgZGlzLVxuLy8gICAgIGN1c3Npb24gb2YgXCJUaXRsZSBNb2Rlc1wiKVxuVGVybWluYWwucHJvdG90eXBlLnNldFRpdGxlTW9kZUZlYXR1cmUgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgO1xufTtcblxuLy8gQ1NJIFBzIFNQIHRcbi8vICAgU2V0IHdhcm5pbmctYmVsbCB2b2x1bWUgKERFQ1NXQlYsIFZUNTIwKS5cbi8vICAgICBQcyA9IDAgIG9yIDEgIC0+IG9mZi5cbi8vICAgICBQcyA9IDIgLCAzICBvciA0ICAtPiBsb3cuXG4vLyAgICAgUHMgPSA1ICwgNiAsIDcgLCBvciA4ICAtPiBoaWdoLlxuVGVybWluYWwucHJvdG90eXBlLnNldFdhcm5pbmdCZWxsVm9sdW1lID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQcyBTUCB1XG4vLyAgIFNldCBtYXJnaW4tYmVsbCB2b2x1bWUgKERFQ1NNQlYsIFZUNTIwKS5cbi8vICAgICBQcyA9IDEgIC0+IG9mZi5cbi8vICAgICBQcyA9IDIgLCAzICBvciA0ICAtPiBsb3cuXG4vLyAgICAgUHMgPSAwICwgNSAsIDYgLCA3ICwgb3IgOCAgLT4gaGlnaC5cblRlcm1pbmFsLnByb3RvdHlwZS5zZXRNYXJnaW5CZWxsVm9sdW1lID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQdDsgUGw7IFBiOyBQcjsgUHA7IFB0OyBQbDsgUHAkIHZcbi8vICAgQ29weSBSZWN0YW5ndWxhciBBcmVhIChERUNDUkEsIFZUNDAwIGFuZCB1cCkuXG4vLyAgICAgUHQ7IFBsOyBQYjsgUHIgZGVub3RlcyB0aGUgcmVjdGFuZ2xlLlxuLy8gICAgIFBwIGRlbm90ZXMgdGhlIHNvdXJjZSBwYWdlLlxuLy8gICAgIFB0OyBQbCBkZW5vdGVzIHRoZSB0YXJnZXQgbG9jYXRpb24uXG4vLyAgICAgUHAgZGVub3RlcyB0aGUgdGFyZ2V0IHBhZ2UuXG4vLyBOT1RFOiB4dGVybSBkb2Vzbid0IGVuYWJsZSB0aGlzIGNvZGUgYnkgZGVmYXVsdC5cblRlcm1pbmFsLnByb3RvdHlwZS5jb3B5UmVjdGFuZ2xlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQdCA7IFBsIDsgUGIgOyBQciAnIHdcbi8vICAgRW5hYmxlIEZpbHRlciBSZWN0YW5nbGUgKERFQ0VGUiksIFZUNDIwIGFuZCB1cC5cbi8vICAgUGFyYW1ldGVycyBhcmUgW3RvcDtsZWZ0O2JvdHRvbTtyaWdodF0uXG4vLyAgIERlZmluZXMgdGhlIGNvb3JkaW5hdGVzIG9mIGEgZmlsdGVyIHJlY3RhbmdsZSBhbmQgYWN0aXZhdGVzXG4vLyAgIGl0LiAgQW55dGltZSB0aGUgbG9jYXRvciBpcyBkZXRlY3RlZCBvdXRzaWRlIG9mIHRoZSBmaWx0ZXJcbi8vICAgcmVjdGFuZ2xlLCBhbiBvdXRzaWRlIHJlY3RhbmdsZSBldmVudCBpcyBnZW5lcmF0ZWQgYW5kIHRoZVxuLy8gICByZWN0YW5nbGUgaXMgZGlzYWJsZWQuICBGaWx0ZXIgcmVjdGFuZ2xlcyBhcmUgYWx3YXlzIHRyZWF0ZWRcbi8vICAgYXMgXCJvbmUtc2hvdFwiIGV2ZW50cy4gIEFueSBwYXJhbWV0ZXJzIHRoYXQgYXJlIG9taXR0ZWQgZGVmYXVsdFxuLy8gICB0byB0aGUgY3VycmVudCBsb2NhdG9yIHBvc2l0aW9uLiAgSWYgYWxsIHBhcmFtZXRlcnMgYXJlIG9taXQtXG4vLyAgIHRlZCwgYW55IGxvY2F0b3IgbW90aW9uIHdpbGwgYmUgcmVwb3J0ZWQuICBERUNFTFIgYWx3YXlzIGNhbi1cbi8vICAgY2VscyBhbnkgcHJldm91cyByZWN0YW5nbGUgZGVmaW5pdGlvbi5cblRlcm1pbmFsLnByb3RvdHlwZS5lbmFibGVGaWx0ZXJSZWN0YW5nbGUgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgO1xufTtcblxuLy8gQ1NJIFBzIHggIFJlcXVlc3QgVGVybWluYWwgUGFyYW1ldGVycyAoREVDUkVRVFBBUk0pLlxuLy8gICBpZiBQcyBpcyBhIFwiMFwiIChkZWZhdWx0KSBvciBcIjFcIiwgYW5kIHh0ZXJtIGlzIGVtdWxhdGluZyBWVDEwMCxcbi8vICAgdGhlIGNvbnRyb2wgc2VxdWVuY2UgZWxpY2l0cyBhIHJlc3BvbnNlIG9mIHRoZSBzYW1lIGZvcm0gd2hvc2Vcbi8vICAgcGFyYW1ldGVycyBkZXNjcmliZSB0aGUgdGVybWluYWw6XG4vLyAgICAgUHMgLT4gdGhlIGdpdmVuIFBzIGluY3JlbWVudGVkIGJ5IDIuXG4vLyAgICAgUG4gPSAxICA8LSBubyBwYXJpdHkuXG4vLyAgICAgUG4gPSAxICA8LSBlaWdodCBiaXRzLlxuLy8gICAgIFBuID0gMSAgPC0gMiAgOCAgdHJhbnNtaXQgMzguNGsgYmF1ZC5cbi8vICAgICBQbiA9IDEgIDwtIDIgIDggIHJlY2VpdmUgMzguNGsgYmF1ZC5cbi8vICAgICBQbiA9IDEgIDwtIGNsb2NrIG11bHRpcGxpZXIuXG4vLyAgICAgUG4gPSAwICA8LSBTVFAgZmxhZ3MuXG5UZXJtaW5hbC5wcm90b3R5cGUucmVxdWVzdFBhcmFtZXRlcnMgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgO1xufTtcblxuLy8gQ1NJIFBzIHggIFNlbGVjdCBBdHRyaWJ1dGUgQ2hhbmdlIEV4dGVudCAoREVDU0FDRSkuXG4vLyAgICAgUHMgPSAwICAtPiBmcm9tIHN0YXJ0IHRvIGVuZCBwb3NpdGlvbiwgd3JhcHBlZC5cbi8vICAgICBQcyA9IDEgIC0+IGZyb20gc3RhcnQgdG8gZW5kIHBvc2l0aW9uLCB3cmFwcGVkLlxuLy8gICAgIFBzID0gMiAgLT4gcmVjdGFuZ2xlIChleGFjdCkuXG5UZXJtaW5hbC5wcm90b3R5cGUuc2VsZWN0Q2hhbmdlRXh0ZW50ID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQYzsgUHQ7IFBsOyBQYjsgUHIkIHhcbi8vICAgRmlsbCBSZWN0YW5ndWxhciBBcmVhIChERUNGUkEpLCBWVDQyMCBhbmQgdXAuXG4vLyAgICAgUGMgaXMgdGhlIGNoYXJhY3RlciB0byB1c2UuXG4vLyAgICAgUHQ7IFBsOyBQYjsgUHIgZGVub3RlcyB0aGUgcmVjdGFuZ2xlLlxuLy8gTk9URTogeHRlcm0gZG9lc24ndCBlbmFibGUgdGhpcyBjb2RlIGJ5IGRlZmF1bHQuXG5UZXJtaW5hbC5wcm90b3R5cGUuZmlsbFJlY3RhbmdsZSA9IGZ1bmN0aW9uKHBhcmFtcykge1xuICB2YXIgY2ggPSBwYXJhbXNbMF1cbiAgICAsIHQgPSBwYXJhbXNbMV1cbiAgICAsIGwgPSBwYXJhbXNbMl1cbiAgICAsIGIgPSBwYXJhbXNbM11cbiAgICAsIHIgPSBwYXJhbXNbNF07XG5cbiAgdmFyIGxpbmVcbiAgICAsIGk7XG5cbiAgZm9yICg7IHQgPCBiICsgMTsgdCsrKSB7XG4gICAgbGluZSA9IHRoaXMubGluZXNbdGhpcy55YmFzZSArIHRdO1xuICAgIGZvciAoaSA9IGw7IGkgPCByOyBpKyspIHtcbiAgICAgIGxpbmVbaV0gPSBbbGluZVtpXVswXSwgU3RyaW5nLmZyb21DaGFyQ29kZShjaCldO1xuICAgIH1cbiAgfVxuXG4gIC8vIHRoaXMubWF4UmFuZ2UoKTtcbiAgdGhpcy51cGRhdGVSYW5nZShwYXJhbXNbMV0pO1xuICB0aGlzLnVwZGF0ZVJhbmdlKHBhcmFtc1szXSk7XG59O1xuXG4vLyBDU0kgUHMgOyBQdSAnIHpcbi8vICAgRW5hYmxlIExvY2F0b3IgUmVwb3J0aW5nIChERUNFTFIpLlxuLy8gICBWYWxpZCB2YWx1ZXMgZm9yIHRoZSBmaXJzdCBwYXJhbWV0ZXI6XG4vLyAgICAgUHMgPSAwICAtPiBMb2NhdG9yIGRpc2FibGVkIChkZWZhdWx0KS5cbi8vICAgICBQcyA9IDEgIC0+IExvY2F0b3IgZW5hYmxlZC5cbi8vICAgICBQcyA9IDIgIC0+IExvY2F0b3IgZW5hYmxlZCBmb3Igb25lIHJlcG9ydCwgdGhlbiBkaXNhYmxlZC5cbi8vICAgVGhlIHNlY29uZCBwYXJhbWV0ZXIgc3BlY2lmaWVzIHRoZSBjb29yZGluYXRlIHVuaXQgZm9yIGxvY2F0b3Jcbi8vICAgcmVwb3J0cy5cbi8vICAgVmFsaWQgdmFsdWVzIGZvciB0aGUgc2Vjb25kIHBhcmFtZXRlcjpcbi8vICAgICBQdSA9IDAgIDwtIG9yIG9taXR0ZWQgLT4gZGVmYXVsdCB0byBjaGFyYWN0ZXIgY2VsbHMuXG4vLyAgICAgUHUgPSAxICA8LSBkZXZpY2UgcGh5c2ljYWwgcGl4ZWxzLlxuLy8gICAgIFB1ID0gMiAgPC0gY2hhcmFjdGVyIGNlbGxzLlxuVGVybWluYWwucHJvdG90eXBlLmVuYWJsZUxvY2F0b3JSZXBvcnRpbmcgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgdmFyIHZhbCA9IHBhcmFtc1swXSA+IDA7XG4gIC8vdGhpcy5tb3VzZUV2ZW50cyA9IHZhbDtcbiAgLy90aGlzLmRlY0xvY2F0b3IgPSB2YWw7XG59O1xuXG4vLyBDU0kgUHQ7IFBsOyBQYjsgUHIkIHpcbi8vICAgRXJhc2UgUmVjdGFuZ3VsYXIgQXJlYSAoREVDRVJBKSwgVlQ0MDAgYW5kIHVwLlxuLy8gICAgIFB0OyBQbDsgUGI7IFByIGRlbm90ZXMgdGhlIHJlY3RhbmdsZS5cbi8vIE5PVEU6IHh0ZXJtIGRvZXNuJ3QgZW5hYmxlIHRoaXMgY29kZSBieSBkZWZhdWx0LlxuVGVybWluYWwucHJvdG90eXBlLmVyYXNlUmVjdGFuZ2xlID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIHZhciB0ID0gcGFyYW1zWzBdXG4gICAgLCBsID0gcGFyYW1zWzFdXG4gICAgLCBiID0gcGFyYW1zWzJdXG4gICAgLCByID0gcGFyYW1zWzNdO1xuXG4gIHZhciBsaW5lXG4gICAgLCBpXG4gICAgLCBjaDtcblxuICBjaCA9IFt0aGlzLmN1ckF0dHIsICcgJ107IC8vIHh0ZXJtP1xuXG4gIGZvciAoOyB0IDwgYiArIDE7IHQrKykge1xuICAgIGxpbmUgPSB0aGlzLmxpbmVzW3RoaXMueWJhc2UgKyB0XTtcbiAgICBmb3IgKGkgPSBsOyBpIDwgcjsgaSsrKSB7XG4gICAgICBsaW5lW2ldID0gY2g7XG4gICAgfVxuICB9XG5cbiAgLy8gdGhpcy5tYXhSYW5nZSgpO1xuICB0aGlzLnVwZGF0ZVJhbmdlKHBhcmFtc1swXSk7XG4gIHRoaXMudXBkYXRlUmFuZ2UocGFyYW1zWzJdKTtcbn07XG5cbi8vIENTSSBQbSAnIHtcbi8vICAgU2VsZWN0IExvY2F0b3IgRXZlbnRzIChERUNTTEUpLlxuLy8gICBWYWxpZCB2YWx1ZXMgZm9yIHRoZSBmaXJzdCAoYW5kIGFueSBhZGRpdGlvbmFsIHBhcmFtZXRlcnMpXG4vLyAgIGFyZTpcbi8vICAgICBQcyA9IDAgIC0+IG9ubHkgcmVzcG9uZCB0byBleHBsaWNpdCBob3N0IHJlcXVlc3RzIChERUNSUUxQKS5cbi8vICAgICAgICAgICAgICAgIChUaGlzIGlzIGRlZmF1bHQpLiAgSXQgYWxzbyBjYW5jZWxzIGFueSBmaWx0ZXJcbi8vICAgcmVjdGFuZ2xlLlxuLy8gICAgIFBzID0gMSAgLT4gcmVwb3J0IGJ1dHRvbiBkb3duIHRyYW5zaXRpb25zLlxuLy8gICAgIFBzID0gMiAgLT4gZG8gbm90IHJlcG9ydCBidXR0b24gZG93biB0cmFuc2l0aW9ucy5cbi8vICAgICBQcyA9IDMgIC0+IHJlcG9ydCBidXR0b24gdXAgdHJhbnNpdGlvbnMuXG4vLyAgICAgUHMgPSA0ICAtPiBkbyBub3QgcmVwb3J0IGJ1dHRvbiB1cCB0cmFuc2l0aW9ucy5cblRlcm1pbmFsLnByb3RvdHlwZS5zZXRMb2NhdG9yRXZlbnRzID0gZnVuY3Rpb24ocGFyYW1zKSB7XG4gIDtcbn07XG5cbi8vIENTSSBQdDsgUGw7IFBiOyBQciQge1xuLy8gICBTZWxlY3RpdmUgRXJhc2UgUmVjdGFuZ3VsYXIgQXJlYSAoREVDU0VSQSksIFZUNDAwIGFuZCB1cC5cbi8vICAgICBQdDsgUGw7IFBiOyBQciBkZW5vdGVzIHRoZSByZWN0YW5nbGUuXG5UZXJtaW5hbC5wcm90b3R5cGUuc2VsZWN0aXZlRXJhc2VSZWN0YW5nbGUgPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgO1xufTtcblxuLy8gQ1NJIFBzICcgfFxuLy8gICBSZXF1ZXN0IExvY2F0b3IgUG9zaXRpb24gKERFQ1JRTFApLlxuLy8gICBWYWxpZCB2YWx1ZXMgZm9yIHRoZSBwYXJhbWV0ZXIgYXJlOlxuLy8gICAgIFBzID0gMCAsIDEgb3Igb21pdHRlZCAtPiB0cmFuc21pdCBhIHNpbmdsZSBERUNMUlAgbG9jYXRvclxuLy8gICAgIHJlcG9ydC5cblxuLy8gICBJZiBMb2NhdG9yIFJlcG9ydGluZyBoYXMgYmVlbiBlbmFibGVkIGJ5IGEgREVDRUxSLCB4dGVybSB3aWxsXG4vLyAgIHJlc3BvbmQgd2l0aCBhIERFQ0xSUCBMb2NhdG9yIFJlcG9ydC4gIFRoaXMgcmVwb3J0IGlzIGFsc29cbi8vICAgZ2VuZXJhdGVkIG9uIGJ1dHRvbiB1cCBhbmQgZG93biBldmVudHMgaWYgdGhleSBoYXZlIGJlZW5cbi8vICAgZW5hYmxlZCB3aXRoIGEgREVDU0xFLCBvciB3aGVuIHRoZSBsb2NhdG9yIGlzIGRldGVjdGVkIG91dHNpZGVcbi8vICAgb2YgYSBmaWx0ZXIgcmVjdGFuZ2xlLCBpZiBmaWx0ZXIgcmVjdGFuZ2xlcyBoYXZlIGJlZW4gZW5hYmxlZFxuLy8gICB3aXRoIGEgREVDRUZSLlxuXG4vLyAgICAgLT4gQ1NJIFBlIDsgUGIgOyBQciA7IFBjIDsgUHAgJiAgd1xuXG4vLyAgIFBhcmFtZXRlcnMgYXJlIFtldmVudDtidXR0b247cm93O2NvbHVtbjtwYWdlXS5cbi8vICAgVmFsaWQgdmFsdWVzIGZvciB0aGUgZXZlbnQ6XG4vLyAgICAgUGUgPSAwICAtPiBsb2NhdG9yIHVuYXZhaWxhYmxlIC0gbm8gb3RoZXIgcGFyYW1ldGVycyBzZW50LlxuLy8gICAgIFBlID0gMSAgLT4gcmVxdWVzdCAtIHh0ZXJtIHJlY2VpdmVkIGEgREVDUlFMUC5cbi8vICAgICBQZSA9IDIgIC0+IGxlZnQgYnV0dG9uIGRvd24uXG4vLyAgICAgUGUgPSAzICAtPiBsZWZ0IGJ1dHRvbiB1cC5cbi8vICAgICBQZSA9IDQgIC0+IG1pZGRsZSBidXR0b24gZG93bi5cbi8vICAgICBQZSA9IDUgIC0+IG1pZGRsZSBidXR0b24gdXAuXG4vLyAgICAgUGUgPSA2ICAtPiByaWdodCBidXR0b24gZG93bi5cbi8vICAgICBQZSA9IDcgIC0+IHJpZ2h0IGJ1dHRvbiB1cC5cbi8vICAgICBQZSA9IDggIC0+IE00IGJ1dHRvbiBkb3duLlxuLy8gICAgIFBlID0gOSAgLT4gTTQgYnV0dG9uIHVwLlxuLy8gICAgIFBlID0gMSAwICAtPiBsb2NhdG9yIG91dHNpZGUgZmlsdGVyIHJlY3RhbmdsZS5cbi8vICAgYGBidXR0b24nJyBwYXJhbWV0ZXIgaXMgYSBiaXRtYXNrIGluZGljYXRpbmcgd2hpY2ggYnV0dG9ucyBhcmVcbi8vICAgICBwcmVzc2VkOlxuLy8gICAgIFBiID0gMCAgPC0gbm8gYnV0dG9ucyBkb3duLlxuLy8gICAgIFBiICYgMSAgPC0gcmlnaHQgYnV0dG9uIGRvd24uXG4vLyAgICAgUGIgJiAyICA8LSBtaWRkbGUgYnV0dG9uIGRvd24uXG4vLyAgICAgUGIgJiA0ICA8LSBsZWZ0IGJ1dHRvbiBkb3duLlxuLy8gICAgIFBiICYgOCAgPC0gTTQgYnV0dG9uIGRvd24uXG4vLyAgIGBgcm93JycgYW5kIGBgY29sdW1uJycgcGFyYW1ldGVycyBhcmUgdGhlIGNvb3JkaW5hdGVzIG9mIHRoZVxuLy8gICAgIGxvY2F0b3IgcG9zaXRpb24gaW4gdGhlIHh0ZXJtIHdpbmRvdywgZW5jb2RlZCBhcyBBU0NJSSBkZWNpLVxuLy8gICAgIG1hbC5cbi8vICAgVGhlIGBgcGFnZScnIHBhcmFtZXRlciBpcyBub3QgdXNlZCBieSB4dGVybSwgYW5kIHdpbGwgYmUgb21pdC1cbi8vICAgdGVkLlxuVGVybWluYWwucHJvdG90eXBlLnJlcXVlc3RMb2NhdG9yUG9zaXRpb24gPSBmdW5jdGlvbihwYXJhbXMpIHtcbiAgO1xufTtcblxuLy8gQ1NJIFAgbSBTUCB9XG4vLyBJbnNlcnQgUCBzIENvbHVtbihzKSAoZGVmYXVsdCA9IDEpIChERUNJQyksIFZUNDIwIGFuZCB1cC5cbi8vIE5PVEU6IHh0ZXJtIGRvZXNuJ3QgZW5hYmxlIHRoaXMgY29kZSBieSBkZWZhdWx0LlxuVGVybWluYWwucHJvdG90eXBlLmluc2VydENvbHVtbnMgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBhcmFtID0gcGFyYW1zWzBdXG4gICAgLCBsID0gdGhpcy55YmFzZSArIHRoaXMucm93c1xuICAgICwgY2ggPSBbdGhpcy5jdXJBdHRyLCAnICddIC8vIHh0ZXJtP1xuICAgICwgaTtcblxuICB3aGlsZSAocGFyYW0tLSkge1xuICAgIGZvciAoaSA9IHRoaXMueWJhc2U7IGkgPCBsOyBpKyspIHtcbiAgICAgIHRoaXMubGluZXNbaV0uc3BsaWNlKHRoaXMueCArIDEsIDAsIGNoKTtcbiAgICAgIHRoaXMubGluZXNbaV0ucG9wKCk7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5tYXhSYW5nZSgpO1xufTtcblxuLy8gQ1NJIFAgbSBTUCB+XG4vLyBEZWxldGUgUCBzIENvbHVtbihzKSAoZGVmYXVsdCA9IDEpIChERUNEQyksIFZUNDIwIGFuZCB1cFxuLy8gTk9URTogeHRlcm0gZG9lc24ndCBlbmFibGUgdGhpcyBjb2RlIGJ5IGRlZmF1bHQuXG5UZXJtaW5hbC5wcm90b3R5cGUuZGVsZXRlQ29sdW1ucyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcGFyYW0gPSBwYXJhbXNbMF1cbiAgICAsIGwgPSB0aGlzLnliYXNlICsgdGhpcy5yb3dzXG4gICAgLCBjaCA9IFt0aGlzLmN1ckF0dHIsICcgJ10gLy8geHRlcm0/XG4gICAgLCBpO1xuXG4gIHdoaWxlIChwYXJhbS0tKSB7XG4gICAgZm9yIChpID0gdGhpcy55YmFzZTsgaSA8IGw7IGkrKykge1xuICAgICAgdGhpcy5saW5lc1tpXS5zcGxpY2UodGhpcy54LCAxKTtcbiAgICAgIHRoaXMubGluZXNbaV0ucHVzaChjaCk7XG4gICAgfVxuICB9XG5cbiAgdGhpcy5tYXhSYW5nZSgpO1xufTtcblxuLyoqXG4gKiBDaGFyYWN0ZXIgU2V0c1xuICovXG5cblRlcm1pbmFsLmNoYXJzZXRzID0ge307XG5cbi8vIERFQyBTcGVjaWFsIENoYXJhY3RlciBhbmQgTGluZSBEcmF3aW5nIFNldC5cbi8vIGh0dHA6Ly92dDEwMC5uZXQvZG9jcy92dDEwMi11Zy90YWJsZTUtMTMuaHRtbFxuLy8gQSBsb3Qgb2YgY3Vyc2VzIGFwcHMgdXNlIHRoaXMgaWYgdGhleSBzZWUgVEVSTT14dGVybS5cbi8vIHRlc3Rpbmc6IGVjaG8gLWUgJ1xcZSgwYVxcZShCJ1xuLy8gVGhlIHh0ZXJtIG91dHB1dCBzb21ldGltZXMgc2VlbXMgdG8gY29uZmxpY3Qgd2l0aCB0aGVcbi8vIHJlZmVyZW5jZSBhYm92ZS4geHRlcm0gc2VlbXMgaW4gbGluZSB3aXRoIHRoZSByZWZlcmVuY2Vcbi8vIHdoZW4gcnVubmluZyB2dHRlc3QgaG93ZXZlci5cbi8vIFRoZSB0YWJsZSBiZWxvdyBub3cgdXNlcyB4dGVybSdzIG91dHB1dCBmcm9tIHZ0dGVzdC5cblRlcm1pbmFsLmNoYXJzZXRzLlNDTEQgPSB7IC8vICgwXG4gICdgJzogJ1xcdTI1YzYnLCAvLyAn4peGJ1xuICAnYSc6ICdcXHUyNTkyJywgLy8gJ+KWkidcbiAgJ2InOiAnXFx1MDAwOScsIC8vICdcXHQnXG4gICdjJzogJ1xcdTAwMGMnLCAvLyAnXFxmJ1xuICAnZCc6ICdcXHUwMDBkJywgLy8gJ1xccidcbiAgJ2UnOiAnXFx1MDAwYScsIC8vICdcXG4nXG4gICdmJzogJ1xcdTAwYjAnLCAvLyAnwrAnXG4gICdnJzogJ1xcdTAwYjEnLCAvLyAnwrEnXG4gICdoJzogJ1xcdTI0MjQnLCAvLyAnXFx1MjQyNCcgKE5MKVxuICAnaSc6ICdcXHUwMDBiJywgLy8gJ1xcdidcbiAgJ2onOiAnXFx1MjUxOCcsIC8vICfilJgnXG4gICdrJzogJ1xcdTI1MTAnLCAvLyAn4pSQJ1xuICAnbCc6ICdcXHUyNTBjJywgLy8gJ+KUjCdcbiAgJ20nOiAnXFx1MjUxNCcsIC8vICfilJQnXG4gICduJzogJ1xcdTI1M2MnLCAvLyAn4pS8J1xuICAnbyc6ICdcXHUyM2JhJywgLy8gJ+KOuidcbiAgJ3AnOiAnXFx1MjNiYicsIC8vICfijrsnXG4gICdxJzogJ1xcdTI1MDAnLCAvLyAn4pSAJ1xuICAncic6ICdcXHUyM2JjJywgLy8gJ+KOvCdcbiAgJ3MnOiAnXFx1MjNiZCcsIC8vICfijr0nXG4gICd0JzogJ1xcdTI1MWMnLCAvLyAn4pScJ1xuICAndSc6ICdcXHUyNTI0JywgLy8gJ+KUpCdcbiAgJ3YnOiAnXFx1MjUzNCcsIC8vICfilLQnXG4gICd3JzogJ1xcdTI1MmMnLCAvLyAn4pSsJ1xuICAneCc6ICdcXHUyNTAyJywgLy8gJ+KUgidcbiAgJ3knOiAnXFx1MjI2NCcsIC8vICfiiaQnXG4gICd6JzogJ1xcdTIyNjUnLCAvLyAn4omlJ1xuICAneyc6ICdcXHUwM2MwJywgLy8gJ8+AJ1xuICAnfCc6ICdcXHUyMjYwJywgLy8gJ+KJoCdcbiAgJ30nOiAnXFx1MDBhMycsIC8vICfCoydcbiAgJ34nOiAnXFx1MDBiNycgIC8vICfCtydcbn07XG5cblRlcm1pbmFsLmNoYXJzZXRzLlVLID0gbnVsbDsgLy8gKEFcblRlcm1pbmFsLmNoYXJzZXRzLlVTID0gbnVsbDsgLy8gKEIgKFVTQVNDSUkpXG5UZXJtaW5hbC5jaGFyc2V0cy5EdXRjaCA9IG51bGw7IC8vICg0XG5UZXJtaW5hbC5jaGFyc2V0cy5GaW5uaXNoID0gbnVsbDsgLy8gKEMgb3IgKDVcblRlcm1pbmFsLmNoYXJzZXRzLkZyZW5jaCA9IG51bGw7IC8vIChSXG5UZXJtaW5hbC5jaGFyc2V0cy5GcmVuY2hDYW5hZGlhbiA9IG51bGw7IC8vIChRXG5UZXJtaW5hbC5jaGFyc2V0cy5HZXJtYW4gPSBudWxsOyAvLyAoS1xuVGVybWluYWwuY2hhcnNldHMuSXRhbGlhbiA9IG51bGw7IC8vIChZXG5UZXJtaW5hbC5jaGFyc2V0cy5Ob3J3ZWdpYW5EYW5pc2ggPSBudWxsOyAvLyAoRSBvciAoNlxuVGVybWluYWwuY2hhcnNldHMuU3BhbmlzaCA9IG51bGw7IC8vIChaXG5UZXJtaW5hbC5jaGFyc2V0cy5Td2VkaXNoID0gbnVsbDsgLy8gKEggb3IgKDdcblRlcm1pbmFsLmNoYXJzZXRzLlN3aXNzID0gbnVsbDsgLy8gKD1cblRlcm1pbmFsLmNoYXJzZXRzLklTT0xhdGluID0gbnVsbDsgLy8gL0FcblxuLyoqXG4gKiBIZWxwZXJzXG4gKi9cblxuZnVuY3Rpb24gb24oZWwsIHR5cGUsIGhhbmRsZXIsIGNhcHR1cmUpIHtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBoYW5kbGVyLCBjYXB0dXJlIHx8IGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gb2ZmKGVsLCB0eXBlLCBoYW5kbGVyLCBjYXB0dXJlKSB7XG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgaGFuZGxlciwgY2FwdHVyZSB8fCBmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIGNhbmNlbChldikge1xuICBpZiAoZXYucHJldmVudERlZmF1bHQpIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gIGV2LnJldHVyblZhbHVlID0gZmFsc2U7XG4gIGlmIChldi5zdG9wUHJvcGFnYXRpb24pIGV2LnN0b3BQcm9wYWdhdGlvbigpO1xuICBldi5jYW5jZWxCdWJibGUgPSB0cnVlO1xuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIGluaGVyaXRzKGNoaWxkLCBwYXJlbnQpIHtcbiAgZnVuY3Rpb24gZigpIHtcbiAgICB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7XG4gIH1cbiAgZi5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlO1xuICBjaGlsZC5wcm90b3R5cGUgPSBuZXcgZjtcbn1cblxudmFyIGlzTWFjID0gfm5hdmlnYXRvci51c2VyQWdlbnQuaW5kZXhPZignTWFjJyk7XG5cbi8vIGlmIGJvbGQgaXMgYnJva2VuLCB3ZSBjYW4ndFxuLy8gdXNlIGl0IGluIHRoZSB0ZXJtaW5hbC5cbmZ1bmN0aW9uIGlzQm9sZEJyb2tlbigpIHtcbiAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBlbC5pbm5lckhUTUwgPSAnaGVsbG8gd29ybGQnO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGVsKTtcbiAgdmFyIHcxID0gZWwuc2Nyb2xsV2lkdGg7XG4gIGVsLnN0eWxlLmZvbnRXZWlnaHQgPSAnYm9sZCc7XG4gIHZhciB3MiA9IGVsLnNjcm9sbFdpZHRoO1xuICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGVsKTtcbiAgcmV0dXJuIHcxICE9PSB3Mjtcbn1cblxudmFyIFN0cmluZyA9IHRoaXMuU3RyaW5nO1xudmFyIHNldFRpbWVvdXQgPSB0aGlzLnNldFRpbWVvdXQ7XG52YXIgc2V0SW50ZXJ2YWwgPSB0aGlzLnNldEludGVydmFsO1xuXG4vKipcbiAqIEV4cG9zZVxuICovXG5cblRlcm1pbmFsLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblRlcm1pbmFsLmlzTWFjID0gaXNNYWM7XG5UZXJtaW5hbC5pbmhlcml0cyA9IGluaGVyaXRzO1xuVGVybWluYWwub24gPSBvbjtcblRlcm1pbmFsLm9mZiA9IG9mZjtcblRlcm1pbmFsLmNhbmNlbCA9IGNhbmNlbDtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gVGVybWluYWw7XG59IGVsc2Uge1xuICB0aGlzLlRlcm1pbmFsID0gVGVybWluYWw7XG59XG5cbn0pLmNhbGwoZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzIHx8ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IGdsb2JhbCk7XG59KCkpO1xuXG59KShzZWxmKSJdfQ==
;