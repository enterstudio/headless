/**
 * Headless phantom shell functions.
 *
 * Parts abducted from node-phantom's bridge.js.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, phantom:true, indent:4 */
/* globals fs, webpage, utils, shell */
"use strict";

if (typeof phantom === 'undefined') {
    console.error("Headless shell needs to be executed from a mothership");
}

var Shell = function () {};
utils.inherits(Shell, require('./files').constructor);

var user = phantom.args[1].split(fs.separator)[1],
    config = fs.workingDirectory+fs.separator+Shell.prototype.join('users', user, 'config.json');
Shell.prototype.user = user;
Shell.prototype.ghost = fs.exists(config) ? JSON.parse(fs.read(config)) : {};
Shell.prototype.list = {path:phantom.args[1], list:JSON.parse(fs.read(phantom.args[1]))};
Shell.prototype.index = parseInt(phantom.args[2], 10);

function timeout(f, millisec) {
    // Hack for PhantomJS setTimout/setInterval issue
    // https://github.com/ariya/phantomjs/issues/10832
    var out;
    setTimeout(function () {
        out = setTimeout(function () {f();}, millisec);
    }, 0);
    return out;
}
Shell.prototype.setTimeout = timeout;

function interval(f, millisec) {
    // Hack for PhantomJS setTimout/setInterval issue
    // https://github.com/ariya/phantomjs/issues/10832
    var out;
    setTimeout(function () {
        out = setInterval(function () {f();}, millisec);
    }, 0);
    return out;
}
Shell.prototype.setInterval = interval;

// PhantomJS to Node.js bridge
function send(data) {
    shell.controlpage.evaluate("function(){socket.send('"+utils.addslashes(JSON.stringify(data))+"');}");
}
Shell.prototype.send = send;

function exit(exit) {
    if (exit) {
        shell.queue--;
    } else if (!shell.queue) {
        shell.controlpage.close();
        phantom.exit();
    } else {
        timeout(function () {
            shell.exit();
        }, 1000);
    }
}
Shell.prototype.exit = exit;

function kill() {
    shell.controlpage.close();
    phantom.exit();
}
Shell.prototype.kill = kill;

var controlpage = webpage.create();
controlpage.onAlert = function (payload) {
    shell.receive(payload);
};
controlpage.open('http://127.0.0.1:'+phantom.args[0]+'/', function (status) {
    if (status !== 'success') {
        console.error("Headless shell needs to be executed from a mothership");
        phantom.exit();
    }
});
Shell.prototype.controlpage = controlpage;

module.exports = exports = new Shell();
