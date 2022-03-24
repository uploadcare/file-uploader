"use strict";
exports.__esModule = true;
exports.isMultipart = exports.getFileSize = void 0;
var defaultSettings_1 = require("../defaultSettings");
/**
 * Get file size.
 */
var getFileSize = function (file) {
    return file.length || file.size;
};
exports.getFileSize = getFileSize;
/**
 * Check if FileData is multipart data.
 */
var isMultipart = function (fileSize, multipartMinFileSize) {
    if (multipartMinFileSize === void 0) { multipartMinFileSize = defaultSettings_1["default"].multipartMinFileSize; }
    return fileSize >= multipartMinFileSize;
};
exports.isMultipart = isMultipart;
