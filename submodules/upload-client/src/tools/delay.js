"use strict";
exports.__esModule = true;
exports.delay = void 0;
/**
 * setTimeout as Promise.
 *
 * @param {number} ms Timeout in milliseconds.
 */
var delay = function (ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
};
exports.delay = delay;
