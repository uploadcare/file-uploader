"use strict";
exports.__esModule = true;
exports.camelize = void 0;
var SEPARATOR = /\W|_/g;
/**
 * Transforms a string to camelCased.
 */
function camelize(text) {
    return text
        .split(SEPARATOR)
        .map(function (word, index) {
        return word.charAt(0)[index > 0 ? 'toUpperCase' : 'toLowerCase']() +
            word.slice(1);
    })
        .join('');
}
exports.camelize = camelize;
/**
 * Transforms keys of an object to camelCased recursively.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function camelizeKeys(source) {
    if (!source || typeof source !== 'object') {
        return source;
    }
    return Object.keys(source).reduce(function (accumulator, key) {
        accumulator[camelize(key)] =
            typeof source[key] === 'object' ? camelizeKeys(source[key]) : source[key];
        return accumulator;
    }, {});
}
exports["default"] = camelizeKeys;
