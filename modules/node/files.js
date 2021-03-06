/**
 * Headless node file utilities.
 *
 * @author   Patrick Schroen / https://github.com/pschroen
 * @license  MIT Licensed
 */

/* jshint strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true, loopfunc:true, shadow:true, node:true, indent:4 */
/* globals fs, utils, shell, error:true */
"use strict";

if (typeof process === 'undefined') {
    console.error("Headless shell needs to be executed from a mothership");
}

var path = require('path');

var Shell = function () {};
if (utils.basename(module.parent.id) === 'shell') utils.inherits(Shell, require('../shell').constructor);

Shell.prototype.path = process.cwd();
Shell.prototype.separator = path.sep;
Shell.prototype.dirname = path.dirname;
Shell.prototype.basename = path.basename;
Shell.prototype.extname = path.extname;
Shell.prototype.join = path.join;

/**
 * Check if path exists.
 *
 * @param    {string} filepath
 * @returns  {boolean}
 */
function exists(filepath) {
    return fs.existsSync(filepath);
}
Shell.prototype.exists = exists;

/**
 * Read file.
 *
 * @param    {string} filename
 * @returns  {Object}
 */
function read(filename) {
    return fs.readFileSync(filename);
}
Shell.prototype.read = read;

/**
 * Read directory.
 *
 * @param    {string} dir Path
 * @returns  {string[]}
 */
function readdir(dir) {
    return fs.readdirSync(dir);
}
Shell.prototype.readdir = readdir;

/**
 * Read directory and sub-directories.
 *
 * @param    {string} dir Path
 * @param    {undefined|string[]} paths Path list
 * @returns  {string[]}
 */
function files(dir, paths) {
    if (typeof paths === 'undefined') paths = [];
    var filenames = readdir(dir);
    filenames.sort(function (a, b) {
        return a < b ? -1 : 1;
    });
    filenames.forEach(function (file) {
        var fullpath = path.join(dir, file);
        if (fs.lstatSync(fullpath).isDirectory()) {
            files(fullpath, paths);
        } else {
            paths.push(fullpath);
        }
    });
    return paths;
}
Shell.prototype.files = files;

/**
 * Read directory of JSON lists.
 *
 * @param    {string} dir Path
 * @returns  {string[]}
 */
function lists(dir) {
    var paths = [],
        filenames = readdir(dir);
    filenames.sort(function (a, b) {
        return a < b ? -1 : 1;
    });
    filenames.forEach(function (file) {
        var fullpath = path.join(dir, file);
        if (!/\.json$/.test(fullpath)) return;
        try {
            paths.push({
                path: fullpath,
                list: JSON.parse(read(fullpath))
            });
        } catch (err) {
            var match = (new RegExp('\\('+shell.path+'\/(.*):(.*):(.*)\\)', 'i')).exec(err.stack);
            if (match) error = {
                path: fullpath,
                line: 0,
                ch: 0,
                message: err.message,
                stack: err.stack
            };
        }
    });
    return paths;
}
Shell.prototype.lists = lists;

/**
 * Move path.
 *
 * @param    {string} src Path
 * @param    {string} dest Path
 * @returns  {Object}
 */
function move(src, dest) {
    return fs.renameSync(src, dest);
}
Shell.prototype.move = move;

/**
 * Write file.
 *
 * @param    {string} filename
 * @param    {string} data
 * @returns  {Object}
 */
function write(filename, data) {
    return fs.writeFileSync(filename, data);
}
Shell.prototype.write = write;

/**
 * Make directory recursively equivalent of `mkdir -p`.
 *
 * @param    {string} p Path
 */
function mkdir(p) {
    p = path.resolve(p);
    try {
        fs.mkdirSync(p);
    } catch (err) {
        if (err.code === 'ENOENT') {
            mkdir(path.dirname(p));
            mkdir(p);
        } else if (err.code !== 'EEXIST') {
            throw err;
        }
    }
}
Shell.prototype.mkdir = mkdir;

/**
 * Copy directory recursively equivalent of `cp -r`.
 *
 * @param    {string} src Path
 * @param    {string} dest Path
 */
function cpdir(src, dest) {
    if (fs.lstatSync(src).isDirectory()) {
        mkdir(dest);
        readdir(src).forEach(function (file) {
            cpdir(path.join(src, file), path.join(dest, file));
        });
    } else {
        write(dest, read(src));
    }
}
Shell.prototype.cpdir = cpdir;

/**
 * Remove directory recursively equivalent of `rm -rf`.
 *
 * @param    {string} dir Path
 * @param    {undefined|boolean} [empty] Remove empty directory tree
 */
function rmdir(dir, empty) {
    if (fs.lstatSync(dir).isDirectory()) {
        readdir(dir).forEach(function (file) {
            var fullpath = path.join(dir, file);
            if (fs.lstatSync(fullpath).isDirectory()) {
                rmdir(fullpath);
            } else {
                fs.unlinkSync(fullpath);
            }
        });
        fs.rmdirSync(dir);
        if (empty) rmdirEmpty(dir);
    }
}
Shell.prototype.rmdir = rmdir;

/**
 * Remove empty directory tree.
 *
 * @param    {string} dir Path
 */
function rmdirEmpty(dir) {
    var parts = dir.split(path.sep);
    for (var i = parts.length; i > 0; i--) {
        var fullpath = parts.slice(0, i).join(path.sep);
        if (readdir(fullpath).length) break;
        fs.rmdirSync(fullpath);
    }
}
Shell.prototype.rmdirEmpty = rmdirEmpty;

module.exports = exports = new Shell();
