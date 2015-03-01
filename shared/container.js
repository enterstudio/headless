/**
 * Headless shell container functions.
 *
 * Parts abducted from node-phantom's node-phantom.js.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, indent:4
*/

if (typeof process === 'undefined') {
    console.error("Headless shell needs to be executed from mothership");
}

var uname = require('uname'),
    utsname = uname.uname();

var Shell = function (container, user, list, index, load) {
    "use strict";
    this.container = container;
    try {
        this.list = JSON.parse(fs.readFileSync(list).toString());
    } catch (err) {
        var match = (new RegExp('\\('+shell.path+'\/(.*):(.*):(.*)\\)', 'i')).exec(err.stack);
        if (match) error = {
            path: list,
            line: 0,
            ch: 0,
            message: err.message,
            stack: err.stack
        };
    }
    this.callback = null;
    var self = this;
    switch (this.container) {
        case 'node':
            var node = cp.fork('shell.js', [list, index]);
            node.on('message', function (payload) {
                var message = payload.message,
                    data = payload.data;
                switch (message) {
                    case 'request':
                        self[data.command](user, data, function (args) {
                            node.send({
                                message: 'response',
                                data: {
                                    id: data.id,
                                    command: data.command,
                                    args: args
                                }
                            });
                        });
                        break;
                    case 'data':
                        var args = data.args;
                        if (user) {
                            send(user.socket, {
                                name: user.name,
                                message: 'data',
                                data: data
                            });
                        }
                        if (data.command === 'log' || data.command === 'box') {
                            node.send({
                                message: 'response',
                                data: {
                                    id: data.id,
                                    command: data.command,
                                    args: args
                                }
                            });
                        }
                        if (args.error) error = args.error;
                        break;
                    case 'error':
                        if (user) {
                            send(user.socket, {
                                name: user.name,
                                message: 'error',
                                data: data
                            });
                        }
                        util.error(data.stack);
                        break;
                }
            });
            node.on('exit', function (code, signal) {
                if (user) {
                    send(user.socket, {
                        name: user.name,
                        message: 'data',
                        data: {
                            args: {
                                error: error,
                                message: "Exited",
                                progress: 100
                            }
                        }
                    });
                }
                if (self.list.run === 'forever') {
                    if (user) {
                        util.log("Respawning "+list);
                        send(user.socket, {
                            name: user.name,
                            message: 'data',
                            data: {
                                args: {
                                    error: error,
                                    message: "Respawning",
                                    progress: 0
                                }
                            }
                        });
                    }
                    var run = new Shell(container, user, list, index, load);
                }
            });
            node.send({
                message: 'init',
                data: {
                    headlessVersion: version,
                    version: process.version.substring(1),
                    arch: os.platform()+"-"+utsname.machine,
                    hostname: os.hostname(),
                    payload: load
                }
            });
            self.node = node;
            break;
        case 'phantom':
            var server = http.createServer(function (req, res) {
                res.writeHead(200, {'Content-Type':'text/html'});
                res.end("<html><head><script>\n\
                    var socket = new WebSocket('ws://'+location.host);\n\
                    socket.onopen = function (){\n\
                        alert(JSON.stringify({\n\
                            message: 'init',\n\
                            data: {\n\
                                headlessVersion: '"+version+"',\n\
                                version: '"+process.version.substring(1)+"',\n\
                                arch: '"+os.platform()+"-"+utsname.machine+"',\n\
                                hostname: '"+os.hostname()+"',\n\
                                payload: JSON.parse('"+utils.addslashes(JSON.stringify(load))+"')\n\
                            }\n\
                        }));\n\
                    };\n\
                    socket.onmessage = function (event){\n\
                        alert(event.data);\n\
                    };\n\
                </script></head><body></body></html>");
            }).listen(function () {
                var phantom = cp.spawn(config.phantomjs ? config.phantomjs : require('phantomjs').path, ['--ignore-ssl-errors=true', 'shell.js', server.address().port, list, index]);
                phantom.stdout.on('data', function (data) {
                    util.log("Phantom stdout: "+data);
                });
                phantom.stderr.on('data', function (data) {
                    util.error("Phantom stderr: "+data);
                });
                phantom.on('exit', function (code, signal) {
                    if (user) {
                        send(user.socket, {
                            name: user.name,
                            message: 'data',
                            data: {
                                args: {
                                    error: error,
                                    message: "Exited",
                                    progress: 100
                                }
                            }
                        });
                    }
                    server.close(function () {
                        if (self.list.run === 'forever') {
                            if (user) {
                                util.log("Respawning "+list);
                                send(user.socket, {
                                    name: user.name,
                                    message: 'data',
                                    data: {
                                        args: {
                                            error: error,
                                            message: "Respawning",
                                            progress: 0
                                        }
                                    }
                                });
                            }
                            var run = new Shell(container, user, list, index, load);
                        }
                    });
                });
                var wss = new ws.Server({server:server});
                wss.on('connection', function (socket) {
                    socket.on('message', function (payload) {
                        payload = JSON.parse(payload);
                        var message = payload.message,
                            data = payload.data;
                        switch (message) {
                            case 'request':
                                self[data.command](user, data, function (args) {
                                    send(socket, {
                                        message: 'response',
                                        data: {
                                            id: data.id,
                                            command: data.command,
                                            args: args
                                        }
                                    });
                                });
                                break;
                            case 'data':
                                var args = data.args;
                                if (user) {
                                    send(user.socket, {
                                        name: user.name,
                                        message: 'data',
                                        data: data
                                    });
                                }
                                if (data.command === 'log' || data.command === 'box') {
                                    send(socket, {
                                        message: 'response',
                                        data: {
                                            id: data.id,
                                            command: data.command,
                                            args: args
                                        }
                                    });
                                }
                                if (args.error) error = args.error;
                                break;
                            case 'error':
                                if (user) {
                                    send(user.socket, {
                                        name: user.name,
                                        message: 'error',
                                        data: data
                                    });
                                }
                                util.error(data.stack);
                                break;
                        }
                    });
                    self.socket = socket;
                });
                wss.on('close', function () {
                    util.error("Phantom control page disconnected");
                });
            });
            break;
        default:
            util.error("Container "+this.container+" not an option");
            return;
    }
};

function get(user, data, callback) {
    "use strict";
    var args = data.args,
        uri = url.parse(args.url),
        options = {
            host: uri.hostname,
            port: uri.port,
            path: uri.path
        };
    if (args.headers) options.headers = args.headers;
    http.get(options, function (res) {
        if (res.statusCode === 200) {
            var body = '';
            res.on('data', function (chunk) {
                body += chunk;
            }).on('end', function (error) {
                args.error = error;
                args.body = body;
                args.headers = res.headers;
                callback(args);
            });
        } else {
            args.error = res.statusCode;
            args.body = null;
            args.headers = res.headers;
            callback(args);
        }
    }).on('error', function (error) {
        args.error = error.message;
        args.body = null;
        args.headers = null;
        callback(args);
    });
}
Shell.prototype.get = get;

function download(user, data, callback) {
    "use strict";
    var args = data.args,
        uri = url.parse(args.url),
        options = {
            host: uri.hostname,
            port: uri.port,
            path: uri.path
        };
    if (args.headers) options.headers = args.headers;
    http.get(options, function (res) {
        if (res.statusCode === 200) {
            res.setEncoding('binary');
            var body = '';
            res.on('data', function (chunk) {
                body += chunk;
            }).on('end', function (error) {
                var dest = args.dest+'/'+(res.headers['content-disposition'] ? res.headers['content-disposition'].split('"')[1] : uri.path.replace(/.*\//, ''));
                if (!files.exists(dest)) {
                    fs.open(dest, "a", 755, function (error, fd) {
                        if (!error) {
                            fs.write(fd, body, null, 'binary', function (err, written) {
                                args.error = err;
                                args.dest = dest;
                                callback(args);
                            });
                        } else {
                            args.error = error;
                            args.dest = dest;
                            callback(args);
                        }
                    });
                } else {
                    if (user) {
                        send(user.socket, {
                            name: user.name,
                            message: 'data',
                            data: {
                                args: {
                                    error: null,
                                    message: "File exists",
                                    progress: null
                                }
                            }
                        });
                    }
                    args.error = null;
                    args.dest = dest;
                    callback(args);
                }
            });
        } else {
            args.error = res.statusCode;
            args.dest = null;
            callback(args);
        }
    }).on('error', function (error) {
        args.error = error.message;
        args.dest = null;
        callback(args);
    });
}
Shell.prototype.download = download;

function post(user, data, callback) {
    "use strict";
    var args = data.args,
        uri = url.parse(args.url),
        options = {
            host: uri.hostname,
            port: uri.port,
            path: uri.path,
            method: 'POST',
            headers: args.headers
        };
    var req = http.request(options, function (res) {
        if (res.statusCode === 200) {
            var body = '';
            res.on('data', function (chunk) {
                body += chunk;
            }).on('end', function (error) {
                args.error = error;
                args.body = body;
                args.headers = res.headers;
                callback(args);
            });
        } else {
            args.error = res.statusCode;
            args.body = null;
            args.headers = res.headers;
            callback(args);
        }
    }).on('error', function (error) {
        args.error = error.message;
        args.body = null;
        args.headers = null;
        callback(args);
    });
    req.write(args.data);
    req.end();
}
Shell.prototype.post = post;

function exec(user, data, callback) {
    "use strict";
    var args = data.args;
    cp.exec(args.command, args.options, function (error, stdout, stderr) {
        args.error = error;
        args.stdout = stdout;
        args.stderr = stderr;
        callback(args);
    });
}
Shell.prototype.exec = exec;

function out(user, data, callback) {
    "use strict";
    /*jshint validthis:true */
    var self = this,
        args = data.args;
    if (self.callback) {
        if (user && args.stream) {
            fs.stat(args.data, function (err, stats) {
                if (!err) {
                    send(user.socket, {
                        name: user.name,
                        message: 'data',
                        data: {
                            args: {
                                error: null,
                                message: "Streaming "+stats.size+" bytes of data at "+config.streamrate+" bytes per second",
                                progress: null
                            }
                        }
                    });
                    self.callback({stream:'start', type:args.type, size:stats.size});
                    var stream = fs.createReadStream(args.data).pipe(new (require('stream-throttle').Throttle)({rate:config.streamrate}));
                    stream.on('data', function (data) {
                        self.callback({stream:'data', data:data.toString('base64')});
                    });
                    stream.on('end', function () {
                        self.callback({stream:'end'});
                        self.callback = null;
                        send(user.socket, {
                            name: user.name,
                            message: 'data',
                            data: {
                                args: {
                                    error: null,
                                    message: "Stream end",
                                    progress: null
                                }
                            }
                        });
                        callback(args);
                    });
                } else {
                    self.callback = null;
                    send(user.socket, {
                        name: user.name,
                        message: 'data',
                        data: {
                            args: {
                                error: null,
                                message: "Could not retrieve file "+args.data,
                                progress: null
                            }
                        }
                    });
                    callback(args);
                }
            });
        } else {
            self.callback(args);
            self.callback = null;
            callback(args);
        }
    }
}
Shell.prototype.out = out;

function kill() {
    "use strict";
    /*jshint validthis:true */
    switch (this.container) {
        case 'node':
            this.node.send({message:'kill'});
            break;
        case 'phantom':
            send(this.socket, {message:'kill'});
            break;
    }
}
Shell.prototype.kill = kill;

module.exports = exports = Shell;