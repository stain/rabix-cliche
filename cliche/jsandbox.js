var Worker = require('webworker-threads').Worker;

/*
 * JSandbox JavaScript Library v0.2.3
 * 2009-01-25
 * By Elijah Grey, http://eligrey.com
 * Licensed under the X11/MIT License
 *   See LICENSE.md
 */

/*global self */

/*jslint undef: true, nomen: true, eqeqeq: true, bitwise: true, regexp: true,
newcap: true, immed: true, maxerr: 1000, strict: true */

/*! @source http://purl.eligrey.com/github/jsandbox/blob/master/src/jsandbox.js*/

var JSandbox = (function (self) {
	var undef_type = "undefined";
	
	if (typeof Worker === undef_type) {
		return;
	}
	
	var
	// repeatedly used properties/strings (for minification)
	$eval       = "eval",
	$exec       = "exec",
	$load       = "load",
	$requests   = "requests",
	$input      = "input",
	$terminate  = "terminate",
	$data       = "data",
	$callback   = "callback",
	$onerror    = "onerror",
	$worker     = "worker",
	$onresponse = "onresponse",
	$prototype  = "prototype",
	$call       = "call",
	
	str_type   = "string",
	fun_type   = "function",
	
	
	Sandbox = function () {
		var sandbox = this;
		
		if (!(sandbox instanceof Sandbox)) {
			return new Sandbox();
		}


        // Note: window.webkitURL.createObjectURL() in Chrome 10+.
		sandbox[$worker] = new Worker(function () {
            var self = this;
            var globalEval = globalEval || self.eval || eval;
            console.log('Instantiated worker');
            var postMessage   = self.postMessage,
                importScripts = self.importScripts,
                messageEventType  = 'message',

                messageHandler = function (event) {
                    var request = event.data,
                        response = {};

                    response.id = request.id;

                    var data = request.data;
                    self.input = request.input;

                    if (typeof self.input === 'object') {
                        for (var key in self.input) {
                            self[key] = self.input[key];
                        }
                    }

                    try {
                        switch (request.method) {
                            case 'eval': // JSLint has something against indenting cases
                                response.results = globalEval(data);
                                break;
                            case 'exec':
                                importScripts('data:application/javascript,' + encodeURIComponent(data));
                                break;
                            case 'load':
                                importScripts.apply(self, data);
                                break;

                        }
                    } catch (e) {
                        response.error = {
                            name: e.name,
                            message: e.message,
                            stack: e.stack
                        };
                    }

                    delete self.input;
                    if (self.onmessage) {
                        delete self.onmessage; // in case the code defined it
                    }

                    postMessage(response);
                };

            if (self.addEventListener) {
                self.addEventListener(messageEventType, messageHandler, false);
            } else if (self.attachEvent) { // for future compatibility with IE
                self.attachEvent('on' + messageEventType, messageHandler);
            }

            self.window = self; // provide a window object for scripts

            // dereference unsafe functions
            // some might not be dereferenced: https://bugzilla.mozilla.org/show_bug.cgi?id=512464
            self.Worker              =
                self.addEventListener    =
                    self.removeEventListener =
                        self.importScripts       =
                            self.XMLHttpRequest      =
                                self.postMessage         =
                                    //self.dispatchEvent       =
                                    // in case IE implements web workers
                                    self.attachEvent         =
                                        self.detachEvent         =
                                            self.ActiveXObject       =

                                                undefined;

        });
		sandbox[$requests] = {};

		sandbox[$worker].onmessage = function (event) {
            console.log('GOT MESSAGE', event);
			var data = event[$data], request;
			if (typeof data !== "object") {
				return;
			}
			request = sandbox[$requests][data.id];
			if (request) {
				if (data.error) {
					if (typeof sandbox[$onerror] === fun_type) {
						sandbox[$onerror](data, request);
					}
					if (typeof request[$onerror] === fun_type) {
						request[$onerror][$call](sandbox, data.error);
					}
				} else {
					if (typeof sandbox[$onresponse] === fun_type) {
						sandbox[$onresponse](data, request);
					}
				
					if (typeof request[$callback] === fun_type) {
						request[$callback][$call](sandbox, data.results);
					}
				}
				delete sandbox[$requests][data.id];
			}
		};
	},
	proto = Sandbox[$prototype],
	
	createRequestMethod = function (method) {
		proto[method] = function (options, callback, input, onerror) {
            
			if (typeof options === str_type ||
			    Object[$prototype].toString[$call](options) === "[object Array]" ||
			    arguments.length > 1)
			{ // called in (data, callback, input, onerror) style
				options = {
					data     : options,
					input    : input,
					callback : callback,
					onerror  : onerror
				};
			}
			
			if (method === $load && typeof options[$data] === str_type) {
				options[$data] = [options[$data]];
			}
			
			var data  = options[$data],
				id    = this.createRequestID();
			
			input = options[$input];
			
			delete options[$data];
			delete options[$input];
			
			this[$requests][id] = options;
			
			this[$worker].postMessage({
				id       : id,
				method   : method,
				data     : data,
				input    : input
			});
            
			return id;
		};
		Sandbox[method] = function () {
			var sandbox = new Sandbox();
		
			sandbox[$onresponse] = sandbox[$onerror] = function () {
				sandbox[$terminate]();
				sandbox = null;
			};
		
			Sandbox[$prototype][method].apply(
				sandbox,
				Array[$prototype].slice[$call](arguments)
			);
			return Sandbox;
		};
	},
	methods = [$eval, $load, $exec],
	i = 3; // methods.length
	
	while (i--) {
		createRequestMethod(methods[i]);
	}
	
	proto[$terminate] = function () {
		this[$requests] = {};
		this[$worker].onmessage = null;
		this[$worker][$terminate]();
	};
	
	proto.abort = function (id) {
		delete this[$requests][id];
	};
	
	proto.createRequestID = function () {
		var id = Math.random().toString();
		if (id in this[$requests]) {
			return this.createRequestID();
		}
		return id;
	};

	return Sandbox;
})(),
Sandbox = JSandbox;

module.exports = JSandbox;