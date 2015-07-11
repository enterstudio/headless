/**
 * Headless Hello World.
 *
 * @author   Patrick Schroen <ps@ufotechnologies.com>
 * @license  MIT Licensed
 */

/*jshint
 strict:true, eqeqeq:true, newcap:false, multistr:true, expr:true,
 loopfunc:true, shadow:true, node:true, phantom:true, indent:4
*/

var utils = require(shell.path+'/modules/utils'),
    Script = utils.Script(module.id, "Hello World");

/**
 * Initialize.
 *
 * @param    {Probe} probe Instance
 * @param    {undefined|initCallback} [callback]
 */
function init(probe, callback) {
    "use strict";
    probe.log(exports.name);
    if (callback) callback();

    // When you're done, exit() or next()
    probe.exit();
    //probe.next("Done");
}
Script.prototype.init = init;

module.exports = exports = new Script();