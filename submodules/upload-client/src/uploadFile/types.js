"use strict";
exports.__esModule = true;
exports.isUrl = exports.isUuid = exports.isFileData = void 0;
/**
 * FileData type guard.
 */
var isFileData = function (data) {
    return (data !== undefined &&
        ((typeof Blob !== 'undefined' && data instanceof Blob) ||
            (typeof File !== 'undefined' && data instanceof File) ||
            (typeof Buffer !== 'undefined' && data instanceof Buffer)));
};
exports.isFileData = isFileData;
/**
 * Uuid type guard.
 */
var isUuid = function (data) {
    var UUID_REGEX = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
    var regExp = new RegExp(UUID_REGEX);
    return !(0, exports.isFileData)(data) && regExp.test(data);
};
exports.isUuid = isUuid;
/**
 * Url type guard.
 *
 * @param {NodeFile | BrowserFile | Url | Uuid} data
 */
var isUrl = function (data) {
    var URL_REGEX = '^(?:\\w+:)?\\/\\/([^\\s\\.]+\\.\\S{2}|localhost[\\:?\\d]*)\\S*$';
    var regExp = new RegExp(URL_REGEX);
    return !(0, exports.isFileData)(data) && regExp.test(data);
};
exports.isUrl = isUrl;
